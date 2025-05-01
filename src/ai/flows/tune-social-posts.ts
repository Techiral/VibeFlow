
'use server';

/**
 * @fileOverview Tunes social media posts based on user feedback.
 *
 * - tuneSocialPosts - A function that tunes social media posts.
 * - TuneSocialPostsInput - The input type for the tuneSocialPosts function.
 * - TuneSocialPostsOutput - The return type for the tuneSocialPosts function.
 */

import {ai as defaultAi} from '@/ai/ai-instance'; // Use the configured instance
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
    schema: z.object({
      originalPost: z.string().describe('The original social media post.'),
      feedback: z.string().describe('User feedback on the post (e.g., Make wittier, More concise).'),
    }),
  },
  output: {
    schema: z.object({
      tunedPost: z.string().describe('The tuned social media post.'),
    }),
  },
  prompt: `You are a social media expert. You will be given an original social media post and feedback on how to improve it. Please tune the post based on the feedback, ensuring the length remains appropriate for the likely platform.

Original Post: {{{originalPost}}}
Feedback: {{{feedback}}}

Tuned Post:`, // Simplified prompt
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

// Function to check if an error is retriable (5xx, unavailable, overloaded)
const isRetriableError = (error: any): boolean => {
    const message = error.message?.toLowerCase() || '';
    const status = error.status || (error instanceof GenkitError ? error.status : null);

    return (
        status === 'UNAVAILABLE' ||
        status === 'RESOURCE_EXHAUSTED' ||
        status === 503 || // Check direct status code
        message.includes('503') ||
        message.includes('overloaded') ||
        message.includes('service unavailable') ||
        message.includes('internal error') // Sometimes Gemini returns this for overload
    );
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
                input, // Prompt input
                { config: { apiKey: flowOptions.apiKey } } // Prompt config with API key
            );

            if (!output?.tunedPost) {
                console.warn("TuneSocialPostsFlow: Received empty tuned post from AI.");
                throw new Error("AI returned an empty tuned post.");
            }
            return output!;
        } catch (error: any) {
             // Check for specific API key error
            if (error instanceof GenkitError && error.status === 'UNAUTHENTICATED' || error.message?.includes("API key not valid")) {
                 console.error(`TuneSocialPostsFlow: Invalid API Key used.`);
                 throw new GenkitError({ status: 'UNAUTHENTICATED', message: "Invalid API key provided.", cause: error });
            }

            // Check for retriable errors (5xx, UNAVAILABLE, etc.)
            if (isRetriableError(error) && retries < MAX_RETRIES - 1) {
                console.warn(`TuneSocialPostsFlow: Service unavailable/overloaded. Retrying in ${backoff}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                retries++;
                backoff *= 2; // Exponential backoff
             } else if (error.message === "AI returned an empty tuned post." && retries < MAX_RETRIES - 1) {
                 console.warn(`TuneSocialPostsFlow: Received empty tuned post. Retrying in ${backoff}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
                 await new Promise(resolve => setTimeout(resolve, backoff));
                 retries++;
                 backoff *= 2;
            } else {
                // If it's not a retriable error or retries are exhausted, re-throw
                console.error(`TuneSocialPostsFlow: Failed after ${retries} retries. Original Error:`, error);

                 // Determine the best status code and message
                 let finalStatus: GenkitError['status'] = 'INTERNAL';
                 let finalMessage = `Post tuning failed: ${error.message || 'Unknown AI error'}`;

                  if (error instanceof GenkitError) {
                     finalStatus = error.status ?? finalStatus;
                 } else if (isRetriableError(error)) {
                      finalStatus = 'UNAVAILABLE';
                 } else if (error.status === 400) {
                       finalStatus = 'INVALID_ARGUMENT';
                 }

                  if (finalStatus === 'UNAVAILABLE') {
                      finalMessage = "AI service is temporarily unavailable for tuning. Please try again later.";
                  }

                throw new GenkitError({
                     status: finalStatus,
                     message: finalMessage,
                     cause: error, // Include the original error as cause
                 });
            }
        }
    }
    // Should be unreachable if MAX_RETRIES > 0
    throw new GenkitError({ status: 'DEADLINE_EXCEEDED', message: "TuneSocialPostsFlow: Max retries reached after encountering errors."});
});
