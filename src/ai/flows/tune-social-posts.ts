'use server';

/**
 * @fileOverview Tunes social media posts based on user feedback and persona.
 *
 * - tuneSocialPosts - A function that tunes social media posts.
 * - TuneSocialPostsInput - The input type for the tuneSocialPosts function.
 * - TuneSocialPostsOutput - The return type for the tuneSocialPosts function.
 */

import {ai as defaultAi} from '@/ai/ai-instance';
import { GenkitError } from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {z} from 'genkit';

// Define options type including the API key
type FlowOptions = {
  apiKey: string;
};

const TuneSocialPostsInputSchema = z.object({
  originalPost: z.string().describe('The original social media post.'),
  feedback: z.string().describe('User feedback on the post (e.g., Make wittier, More concise).'),
  platform: z.enum(['linkedin', 'twitter', 'youtube']).describe('The platform the original post was intended for (influences length considerations).'),
  personaPrompt: z.string().optional().describe('An optional prompt snippet defining the desired AI persona or writing style.'), // Added personaPrompt
});
export type TuneSocialPostsInput = z.infer<typeof TuneSocialPostsInputSchema>;

const TuneSocialPostsOutputSchema = z.object({
  tunedPost: z.string().describe('The tuned social media post.'),
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
    schema: TuneSocialPostsInputSchema, // Use the updated schema
  },
  output: {
    schema: TuneSocialPostsOutputSchema,
  },
  // Updated prompt to incorporate persona if provided
  prompt: `You are a social media expert. You will be given an original social media post and feedback on how to improve it. Tune the post based on the feedback.
{{#if personaPrompt}}
Adopt the following writing style: {{{personaPrompt}}}
{{/if}}

Original Post (intended for {{platform}}):
{{{originalPost}}}

Feedback:
{{{feedback}}}

Tuned Post (keep appropriate for {{platform}}):`,
  // Define config schema to accept API key
  configSchema: z.object({
    apiKey: z.string().optional(),
  }),
  // Use the apiKey from config for the Google AI plugin
  plugins: [googleAI(config => ({ apiKey: config?.apiKey }))],
  // Ensure the model is specified, can be overridden per call if needed
  model: 'googleai/gemini-2.0-flash',
});


const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1 second

// Function to check if an error is retriable (5xx, unavailable, overloaded, rate limit)
const isRetriableError = (error: any): boolean => {
    const message = error.message?.toLowerCase() || '';
    const status = error.status || (error instanceof GenkitError ? error.status : null);

     // Check for Genkit specific statuses
    if (status === 'UNAVAILABLE' || status === 'RESOURCE_EXHAUSTED') {
        return true;
    }

    // Check for HTTP status codes within the error message or structure (e.g., 503)
    // Also check for common textual indicators of temporary issues.
    if (
        error.status === 503 || error.statusCode === 503 || // Added statusCode check
        message.includes('503') ||
        message.includes('service unavailable') ||
        message.includes('overloaded') ||
        message.includes('internal error') || // Sometimes 500s are temporary
        message.includes('the model is overloaded') ||
        message.includes('rate limit exceeded') ||
        message.includes('quota exceeded') // Treat quota issues as potentially retriable short-term
    ) {
       return true;
    }

    return false;
};

// Modify the flow definition to accept and use options
// Use defaultAi.defineFlow
const tuneSocialPostsFlow = defaultAi.defineFlow<
  typeof TuneSocialPostsInputSchema,
  typeof TuneSocialPostsOutputSchema,
  FlowOptions // Add FlowOptions
>({
  name: 'tuneSocialPostsFlow',
  inputSchema: TuneSocialPostsInputSchema,
  outputSchema: TuneSocialPostsOutputSchema,
},
async (input, flowOptions) => { // Receive flowOptions

    let retries = 0;
    let backoff = INITIAL_BACKOFF_MS;

    while (retries < MAX_RETRIES) {
        try {
            // Call the prompt object directly, passing the API key via config
            const {output} = await prompt(
                input, // Prompt input now includes personaPrompt
                { config: { apiKey: flowOptions.apiKey } } // Prompt config with API key
            );

            if (!output?.tunedPost) {
                console.warn(`TuneSocialPostsFlow (${input.platform}): Received empty tuned post from AI.`);
                throw new Error("AI returned an empty tuned post.");
            }
            return output!; // Success! Exit the loop and return.
        } catch (error: any) {
             // Check for specific API key error - this is not retriable
            if (error instanceof GenkitError && error.status === 'UNAUTHENTICATED' || error.message?.includes("API key not valid")) {
                 console.error(`TuneSocialPostsFlow (${input.platform}): Invalid API Key used.`);
                 // Throw immediately, no retry
                 throw new GenkitError({ status: 'UNAUTHENTICATED', message: "Invalid API key provided.", cause: error });
            }

            // Check for retriable errors *before* reaching max retries
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
                console.warn(`TuneSocialPostsFlow (${input.platform}): ${reason}. Retrying in ${backoff}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                retries++;
                backoff *= 2; // Exponential backoff
                continue; // Explicitly continue to the next iteration of the loop
            } else {
                // If it's not a retriable error OR retries are exhausted, prepare to throw
                console.error(`TuneSocialPostsFlow (${input.platform}): Failed after ${retries} retries. Original Error:`, error);

                 // Determine the best status code and message for the final error
                 let finalStatus: GenkitError['status'] = 'INTERNAL';
                 let finalMessage = `Post tuning failed: ${error.message || 'Unknown AI error'}`;
                 const messageLower = error.message?.toLowerCase() || '';

                  if (error instanceof GenkitError) {
                     finalStatus = error.status ?? finalStatus;
                 } else if (isRetriableError(error)) { // If it was retriable but retries exhausted
                      if (error.status === 503 || error.statusCode === 503 || messageLower.includes('503') || messageLower.includes('overloaded') || messageLower.includes('service unavailable')) {
                          finalStatus = 'UNAVAILABLE';
                          finalMessage = `AI service was unavailable for tuning (${input.platform}) after multiple retry attempts.`; // Specific message
                      } else if (error.status === 'RESOURCE_EXHAUSTED' || messageLower.includes('rate limit exceeded') || messageLower.includes('quota exceeded')) {
                           finalStatus = 'RESOURCE_EXHAUSTED';
                           finalMessage = `AI service rate limit/quota issues persisted during tuning (${input.platform}) after multiple retry attempts. Please check your Google API quota or wait.`; // Specific message
                      } else {
                           finalStatus = 'INTERNAL'; // Default for other retriable errors after exhaustion
                           finalMessage = `Post tuning for ${input.platform} failed due to a temporary AI service issue after ${MAX_RETRIES} attempts. Please try again later. Original error: ${error.message}`;
                      }
                 } else if (error.status === 400 || error.statusCode === 400) { // Check for 400 status
                       finalStatus = 'INVALID_ARGUMENT';
                       finalMessage = `Tuning failed for ${input.platform} due to invalid input or configuration: ${error.message || 'Bad request'}`;
                  } else if (error.message === "AI returned an empty tuned post.") {
                      finalMessage = `Tuning for ${input.platform} failed because the AI returned an empty result after ${MAX_RETRIES} attempts.`;
                      finalStatus = 'INTERNAL'; // Treat empty tuned post after retries as internal failure
                  }

                 // Throw the final, consolidated error
                throw new GenkitError({
                     status: finalStatus,
                     message: finalMessage,
                     cause: error, // Include the original error as cause
                 });
            }
        }
    }
    // Should be unreachable if MAX_RETRIES > 0, but needed for TypeScript compilation
    throw new GenkitError({ status: 'DEADLINE_EXCEEDED', message: `TuneSocialPostsFlow (${input.platform}): Max retries (${MAX_RETRIES}) reached after encountering errors.`});
});

    