'use server';

/**
 * @fileOverview A flow for generating social media posts tailored to different platforms.
 *
 * - generateSocialPosts - A function that generates social media posts.
 * - GenerateSocialPostsInput - The input type for the generateSocialPosts function.
 * - GenerateSocialPostsOutput - The return type for the generateSocialPosts function.
 */

import {ai as defaultAi} from '@/ai/ai-instance';
import { GenkitError } from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {z} from 'genkit';

// Define options type including the API key
type FlowOptions = {
  apiKey: string;
};

const GenerateSocialPostsInputSchema = z.object({
  summary: z.string().describe('The summarized content to generate social media posts from.'),
  platform: z.enum(['linkedin', 'twitter', 'youtube']).describe('The social media platform to generate a post for.'),
  personaPrompt: z.string().optional().describe('An optional prompt snippet defining the desired AI persona or writing style.'), // Added personaPrompt
});
export type GenerateSocialPostsInput = z.infer<typeof GenerateSocialPostsInputSchema>;

const GenerateSocialPostsOutputSchema = z.object({
  post: z.string().describe('The generated social media post for the specified platform.'),
});
export type GenerateSocialPostsOutput = z.infer<typeof GenerateSocialPostsOutputSchema>;

// Modify the exported function to accept options
export async function generateSocialPosts(
    input: GenerateSocialPostsInput,
    options: FlowOptions // Add options parameter
): Promise<GenerateSocialPostsOutput> {
   if (!options?.apiKey) {
     throw new GenkitError({
         status: 'INVALID_ARGUMENT',
         message: 'API key is required for generating posts.',
     });
   }
   // Pass options to the flow runner
  return generateSocialPostsFlow(input, options);
}

const prompt = defaultAi.definePrompt({
  name: 'generateSocialPostsPrompt',
  input: {
    schema: GenerateSocialPostsInputSchema, // Use updated schema
  },
  output: {
    schema: GenerateSocialPostsOutputSchema,
  },
  // Updated prompt to use persona if provided
  prompt: `You are a social media expert. Generate a social media post for the following platform: {{{platform}}}.
{{#if personaPrompt}}
Adopt the following writing style: {{{personaPrompt}}}
{{/if}}

Here is the content summary: {{{summary}}}.

Make the post engaging and tailored to the platform. The length should be appropriate (e.g., Twitter < 280 chars). For YouTube, generate a video description including relevant hashtags.`,
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
const generateSocialPostsFlow = defaultAi.defineFlow<
  typeof GenerateSocialPostsInputSchema,
  typeof GenerateSocialPostsOutputSchema,
  FlowOptions // Add FlowOptions
>(
  {
    name: 'generateSocialPostsFlow',
    inputSchema: GenerateSocialPostsInputSchema,
    outputSchema: GenerateSocialPostsOutputSchema,
  },
  async (input, flowOptions) => { // Receive flowOptions

    let retries = 0;
    let backoff = INITIAL_BACKOFF_MS;

    while (retries < MAX_RETRIES) {
        try {
            const {output} = await prompt(
                input, // Prompt input now includes personaPrompt
                { config: { apiKey: flowOptions.apiKey } } // Prompt config with API key
            );

             if (!output?.post) {
                 console.warn(`GenerateSocialPostsFlow (${input.platform}): Received empty post from AI.`);
                 throw new Error("AI returned an empty post.");
             }
            return output!; // Success!
        } catch (error: any) {
             if (error instanceof GenkitError && error.status === 'UNAUTHENTICATED' || error.message?.includes("API key not valid")) {
                 console.error(`GenerateSocialPostsFlow (${input.platform}): Invalid API Key used.`);
                 throw new GenkitError({ status: 'UNAUTHENTICATED', message: "Invalid API key provided.", cause: error });
            }

            if (isRetriableError(error) && retries < MAX_RETRIES - 1) {
                 let reason = "AI service unavailable/overloaded";
                 const message = error.message?.toLowerCase() || '';
                 if (error.message === "AI returned an empty post.") {
                      reason = "Received empty post";
                 } else if (error.status === 'RESOURCE_EXHAUSTED' || message.includes('rate limit exceeded') || message.includes('quota exceeded')) {
                      reason = "AI service rate limit or quota potentially hit";
                 } else if (error.status === 503 || error.statusCode === 503 || message.includes('503')) {
                      reason = "AI service unavailable (503)";
                 }
                 console.warn(`GenerateSocialPostsFlow (${input.platform}): ${reason}. Retrying in ${backoff}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
                 await new Promise(resolve => setTimeout(resolve, backoff));
                 retries++;
                 backoff *= 2;
                 continue;
            } else {
                console.error(`GenerateSocialPostsFlow (${input.platform}): Failed after ${retries} retries. Original Error:`, error);

                 let finalStatus: GenkitError['status'] = 'INTERNAL';
                 let finalMessage = `Post generation for ${input.platform} failed: ${error.message || 'Unknown AI error'}`;
                 const messageLower = error.message?.toLowerCase() || '';

                 if (error instanceof GenkitError) {
                     finalStatus = error.status ?? finalStatus;
                 } else if (isRetriableError(error)) {
                      if (error.status === 503 || error.statusCode === 503 || messageLower.includes('503') || messageLower.includes('overloaded') || messageLower.includes('service unavailable')) {
                          finalStatus = 'UNAVAILABLE';
                          finalMessage = `AI service was unavailable generating ${input.platform} post after multiple retry attempts.`;
                      } else if (error.status === 'RESOURCE_EXHAUSTED' || messageLower.includes('rate limit exceeded') || messageLower.includes('quota exceeded')) {
                           finalStatus = 'RESOURCE_EXHAUSTED';
                           finalMessage = `AI service rate limit/quota issues persisted generating ${input.platform} post after multiple retry attempts. Please check your Google API quota or wait.`;
                      } else {
                           finalStatus = 'INTERNAL';
                           finalMessage = `Post generation for ${input.platform} failed due to a temporary AI service issue after ${MAX_RETRIES} attempts. Please try again later. Original error: ${error.message}`;
                      }
                 } else if (error.status === 400 || error.statusCode === 400) {
                      finalStatus = 'INVALID_ARGUMENT';
                      finalMessage = `Generation for ${input.platform} failed due to invalid input or configuration: ${error.message || 'Bad request'}`;
                  } else if (error.message === "AI returned an empty post.") {
                      finalMessage = `Generation for ${input.platform} failed because the AI returned an empty result after ${MAX_RETRIES} attempts.`;
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
    throw new GenkitError({ status: 'DEADLINE_EXCEEDED', message: `GenerateSocialPostsFlow (${input.platform}): Max retries (${MAX_RETRIES}) reached after encountering errors.` });
  }
);

    