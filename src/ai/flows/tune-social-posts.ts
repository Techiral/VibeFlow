'use server';

/**
 * @fileOverview A flow for tuning social media posts based on user feedback.
 *
 * - tuneSocialPosts - A function that tunes a social media post.
 * - TuneSocialPostsInput - The input type for the tuneSocialPosts function.
 * - TuneSocialPostsOutput - The return type for the tuneSocialPosts function.
 */

import { ai as defaultAi } from '@/ai/ai-instance';
import { GenkitError } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit';

// Define options type including the API key
type FlowOptions = {
  apiKey: string;
};

const TuneSocialPostsInputSchema = z.object({
  postContent: z.string().describe('The current content of the social media post.'),
  platform: z.enum(['linkedin', 'twitter', 'youtube']).describe('The social media platform the post is intended for.'),
  instruction: z.string().describe('The user\'s instruction for tuning the post (e.g., "Make it wittier", "Add emojis", "More concise").'),
  personaPrompt: z.string().optional().describe('An optional prompt snippet defining the desired AI persona or writing style.'), // Added personaPrompt
});
export type TuneSocialPostsInput = z.infer<typeof TuneSocialPostsInputSchema>;

const TuneSocialPostsOutputSchema = z.object({
  tunedPost: z.string().describe('The tuned social media post content.'),
});
export type TuneSocialPostsOutput = z.infer<typeof TuneSocialPostsOutputSchema>;

// Modify the exported function to accept options
export async function tuneSocialPosts(
  input: TuneSocialPostsInput,
  options: FlowOptions // Add options parameter
): Promise<TuneSocialPostsOutput> {
  if (!options?.apiKey) {
    throw new GenkitError({
      status: 'INVALID_ARGUMENT',
      message: 'API key is required for tuning posts.',
    });
  }
  // Pass options to the flow runner
  return tuneSocialPostsFlow(input, options);
}

const prompt = defaultAi.definePrompt({
  name: 'tuneSocialPostsPrompt',
  input: {
    schema: TuneSocialPostsInputSchema, // Use updated schema
  },
  output: {
    schema: TuneSocialPostsOutputSchema,
  },
  // Updated prompt to include persona and tuning instruction
  prompt: `You are a social media expert. Tune the following post draft intended for {{platform}}.
{{#if personaPrompt}}
Adopt the following writing style: {{{personaPrompt}}}
{{/if}}

Current Draft:
{{{postContent}}}

Apply the following instruction: {{{instruction}}}

Return only the tuned post content, ensuring it remains appropriate for the {{platform}} platform.`,
  // Define config schema to accept API key
  configSchema: z.object({
    apiKey: z.string().optional(),
  }),
  // Use the apiKey from config for the Google AI plugin
  plugins: [googleAI(config => ({ apiKey: config?.apiKey }))],
  // Ensure the model is specified
  model: 'googleai/gemini-2.0-flash',
});

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1 second

// Function to check if an error is retriable
const isRetriableError = (error: any): boolean => {
  const message = error.message?.toLowerCase() || '';
  const status = error.status || (error instanceof GenkitError ? error.status : null);
  const statusCode = error.statusCode; // Check for statusCode property as well

  if (status === 'UNAVAILABLE' || status === 'RESOURCE_EXHAUSTED' || status === 503 || statusCode === 503 || status === 429 || statusCode === 429) {
    return true;
  }

  if (
    message.includes('503') ||
    message.includes('service unavailable') ||
    message.includes('overloaded') ||
    message.includes('internal error') ||
    message.includes('the model is overloaded') ||
    message.includes('rate limit exceeded') ||
    message.includes('quota exceeded')
  ) {
    return true;
  }

  return false;
};

// Use defaultAi.defineFlow
const tuneSocialPostsFlow = defaultAi.defineFlow<
  typeof TuneSocialPostsInputSchema,
  typeof TuneSocialPostsOutputSchema,
  FlowOptions // Add FlowOptions
>(
  {
    name: 'tuneSocialPostsFlow',
    inputSchema: TuneSocialPostsInputSchema,
    outputSchema: TuneSocialPostsOutputSchema,
  },
  async (input, flowOptions) => { // Receive flowOptions
    let retries = 0;
    let backoff = INITIAL_BACKOFF_MS;

    while (retries < MAX_RETRIES) {
      try {
        const { output } = await prompt(
          input, // Prompt input now includes personaPrompt and instruction
          { config: { apiKey: flowOptions.apiKey } } // Prompt config with API key
        );

        if (!output?.tunedPost) {
          console.warn(`TuneSocialPostsFlow (${input.platform} - "${input.instruction}"): Received empty tuned post from AI.`);
          throw new Error("AI returned an empty tuned post.");
        }
        return output; // Success!
      } catch (error: any) {
        // Handle non-retriable API key error
        if (error instanceof GenkitError && error.status === 'UNAUTHENTICATED' || error.message?.includes("API key not valid")) {
          console.error(`TuneSocialPostsFlow (${input.platform}): Invalid API Key used.`);
          throw new GenkitError({ status: 'UNAUTHENTICATED', message: "Invalid API key provided.", cause: error });
        }

        // Check for retriable errors before max retries
        if (isRetriableError(error) && retries < MAX_RETRIES - 1) {
          let reason = "AI service unavailable/overloaded";
          const message = error.message?.toLowerCase() || '';
          if (error.message === "AI returned an empty tuned post.") {
            reason = "Received empty tuned post";
          } else if (error.status === 'RESOURCE_EXHAUSTED' || message.includes('rate limit exceeded') || message.includes('quota exceeded')) {
            reason = "AI service rate limit or quota potentially hit";
          } else if (error.status === 503 || error.statusCode === 503 || message.includes('503')) {
            reason = "AI service unavailable (503)";
          }
          console.warn(`TuneSocialPostsFlow (${input.platform} - "${input.instruction}"): ${reason}. Retrying in ${backoff}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          retries++;
          backoff *= 2; // Exponential backoff
          continue;
        } else {
          // Non-retriable error OR retries exhausted
          console.error(`TuneSocialPostsFlow (${input.platform} - "${input.instruction}"): Failed after ${retries} retries. Original Error:`, error);

          let finalStatus: GenkitError['status'] = 'INTERNAL';
          let finalMessage = `Tuning post for ${input.platform} ("${input.instruction}") failed: ${error.message || 'Unknown AI error'}`;
          const messageLower = error.message?.toLowerCase() || '';

          if (error instanceof GenkitError) {
            finalStatus = error.status ?? finalStatus;
          } else if (isRetriableError(error)) { // Retriable but exhausted
            if (error.status === 503 || error.statusCode === 503 || messageLower.includes('503') || messageLower.includes('overloaded') || messageLower.includes('service unavailable')) {
              finalStatus = 'UNAVAILABLE';
              finalMessage = `AI service was unavailable for tuning (${input.platform} - "${input.instruction}") after multiple retry attempts.`;
            } else if (error.status === 'RESOURCE_EXHAUSTED' || messageLower.includes('rate limit exceeded') || messageLower.includes('quota exceeded')) {
              finalStatus = 'RESOURCE_EXHAUSTED';
              finalMessage = `AI service rate limit/quota issues persisted during tuning (${input.platform} - "${input.instruction}") after multiple retry attempts. Please check your Google API quota or wait.`;
            } else {
              finalStatus = 'INTERNAL';
              finalMessage = `Post tuning for ${input.platform} ("${input.instruction}") failed due to a temporary AI service issue after ${MAX_RETRIES} attempts. Please try again later. Original error: ${error.message}`;
            }
          } else if (error.status === 400 || error.statusCode === 400) {
            finalStatus = 'INVALID_ARGUMENT';
            finalMessage = `Tuning for ${input.platform} ("${input.instruction}") failed due to invalid input or configuration: ${error.message || 'Bad request'}`;
          } else if (error.message === "AI returned an empty tuned post.") {
            finalMessage = `Tuning for ${input.platform} ("${input.instruction}") failed because the AI returned an empty result after ${MAX_RETRIES} attempts.`;
            finalStatus = 'INTERNAL';
          }

          throw new GenkitError({
            status: finalStatus,
            message: finalMessage,
            cause: error,
          });
        }
      }
    }
    // Fallback error if loop finishes unexpectedly (should not happen if MAX_RETRIES > 0)
    throw new GenkitError({ status: 'DEADLINE_EXCEEDED', message: `TuneSocialPostsFlow (${input.platform} - "${input.instruction}"): Max retries (${MAX_RETRIES}) reached.` });
  }
);