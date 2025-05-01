
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
  platform: z.enum(['linkedin', 'twitter', 'youtube']).describe('The platform the original post was intended for (influences length considerations).') // Added platform context
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
      platform: z.enum(['linkedin', 'twitter', 'youtube']).describe('The platform the original post was intended for (influences length considerations).') // Added platform context
    }),
  },
  output: {
    schema: z.object({
      tunedPost: z.string().describe('The tuned social media post.'),
    }),
  },
  prompt: `You are a social media expert. You will be given an original social media post and feedback on how to improve it. Please tune the post based on the feedback.

Original Post (intended for {{platform}}):
{{{originalPost}}}

Feedback:
{{{feedback}}}

Tuned Post (keep appropriate for {{platform}}):`, // Enhanced prompt with platform context
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

     // Check for Genkit specific statuses
    if (status === 'UNAVAILABLE' || status === 'RESOURCE_EXHAUSTED') {
        return true;
    }

    // Check for HTTP status codes within the error message or structure
    if (error.status === 503 || message.includes('503') || message.includes('service unavailable') || message.includes('overloaded') || message.includes('internal error')) {
       return true;
    }

    // Check for specific error messages from Google AI
    if (message.includes('the model is overloaded')) {
        return true;
    }

     // Check for rate limit exceeded errors from Google (might appear as RESOURCE_EXHAUSTED or specific messages)
    if (message.includes('rate limit exceeded') || message.includes('quota exceeded')) {
        return true; // Treat quota issues as potentially retriable short-term, but also handle specifically later
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

            // Check for retriable errors (5xx, UNAVAILABLE, etc.) or empty tuned post
            if (isRetriableError(error) && retries < MAX_RETRIES - 1) {
                 let reason = "AI service unavailable/overloaded";
                 if (error.message === "AI returned an empty tuned post.") {
                      reason = "Received empty tuned post";
                 } else if (error.status === 'RESOURCE_EXHAUSTED' || error.message?.includes('rate limit exceeded')) {
                      reason = "AI service rate limit potentially hit";
                 }
                console.warn(`TuneSocialPostsFlow: ${reason}. Retrying in ${backoff}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                retries++;
                backoff *= 2; // Exponential backoff
            } else {
                // If it's not a retriable error or retries are exhausted, re-throw
                console.error(`TuneSocialPostsFlow: Failed after ${retries} retries. Original Error:`, error);

                 // Determine the best status code and message
                 let finalStatus: GenkitError['status'] = 'INTERNAL';
                 let finalMessage = `Post tuning failed: ${error.message || 'Unknown AI error'}`;

                  if (error instanceof GenkitError) {
                     finalStatus = error.status ?? finalStatus;
                 } else if (isRetriableError(error)) {
                     // Even if retriable, if retries are exhausted, report based on type
                      const message = error.message?.toLowerCase() || ''; // Get lowercase message for checks
                      if (error.status === 503 || message.includes('503') || message.includes('overloaded') || message.includes('service unavailable')) {
                          finalStatus = 'UNAVAILABLE';
                      } else if (error.status === 'RESOURCE_EXHAUSTED' || message.includes('rate limit exceeded')) {
                           finalStatus = 'RESOURCE_EXHAUSTED';
                      } else {
                           finalStatus = 'INTERNAL'; // Default for other retriable errors after exhaustion
                      }
                 } else if (error.status === 400 || error.statusCode === 400) { // Check for 400 status
                       finalStatus = 'INVALID_ARGUMENT';
                 }

                  // Customize messages based on status
                  if (finalStatus === 'UNAVAILABLE') {
                      finalMessage = "AI service was unavailable for tuning after multiple retry attempts."; // Updated message
                  } else if (finalStatus === 'RESOURCE_EXHAUSTED') {
                       finalMessage = "AI service rate limit issues persisted during tuning after multiple retry attempts. Please check your Google API quota."; // Updated message
                  } else if (finalStatus === 'INVALID_ARGUMENT') {
                       finalMessage = `Tuning failed due to invalid input or configuration: ${error.message || 'Bad request'}`;
                  } else if (error.message === "AI returned an empty tuned post.") {
                      finalMessage = "Tuning failed because the AI returned an empty result after multiple retries.";
                      finalStatus = 'INTERNAL'; // Treat empty tuned post after retries as internal failure
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

