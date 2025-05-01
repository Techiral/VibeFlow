
'use server';

/**
 * @fileOverview A flow for generating social media posts tailored to different platforms.
 *
 * - generateSocialPosts - A function that generates social media posts.
 * - GenerateSocialPostsInput - The input type for the generateSocialPosts function.
 * - GenerateSocialPostsOutput - The return type for the generateSocialPosts function.
 */

import {ai as defaultAi} from '@/ai/ai-instance'; // Use the configured instance
import { genkit, GenkitError } from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {z} from 'genkit';

// Define options type including the API key
type FlowOptions = {
  apiKey: string;
};

const GenerateSocialPostsInputSchema = z.object({
  summary: z.string().describe('The summarized content to generate social media posts from.'),
  platform: z.enum(['linkedin', 'twitter', 'youtube']).describe('The social media platform to generate a post for.'),
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
    schema: z.object({
      summary: z.string().describe('The summarized content to generate social media posts from.'),
      platform: z.enum(['linkedin', 'twitter', 'youtube']).describe('The social media platform to generate a post for.'),
    }),
  },
  output: {
    schema: z.object({
      post: z.string().describe('The generated social media post for the specified platform.'),
    }),
  },
  prompt: `You are a social media expert. Generate a social media post for the following platform: {{{platform}}}.\n\nHere is the content summary: {{{summary}}}.\n\nMake sure the post is engaging and tailored to the platform. The length of the post should be appropriate for the platform (e.g., Twitter posts should be less than 280 characters). For YouTube, generate a video description including relevant hashtags.`, // Added YouTube clarification
});

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1 second

// Modify the flow definition to accept and use options
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
      // Initialize AI instance specific to this flow run
      const ai = genkit({
           plugins: [
               googleAI({ apiKey: flowOptions.apiKey }), // Use apiKey from flowOptions
           ],
           model: 'googleai/gemini-2.0-flash',
      });

    let retries = 0;
    let backoff = INITIAL_BACKOFF_MS;

    while (retries < MAX_RETRIES) {
        try {
             // Use the flow-specific AI instance
            const {output} = await ai.run(prompt, input);
             if (!output?.post) {
                 console.warn(`GenerateSocialPostsFlow (${input.platform}): Received empty post from AI.`);
                 throw new Error("AI returned an empty post.");
             }
            return output!;
        } catch (error: any) {
             // Check for specific API key error
            if (error.status === 'UNAUTHENTICATED' || error.message?.includes("API key not valid")) {
                 console.error(`GenerateSocialPostsFlow: Invalid API Key used.`);
                 throw new GenkitError({ status: 'UNAUTHENTICATED', message: "Invalid API key provided.", cause: error });
            }
             // Check for quota or overload errors
             if ((error.status === 'RESOURCE_EXHAUSTED' || error.status === 503 || error.message?.includes("503") || error.message?.toLowerCase().includes("overloaded")) && retries < MAX_RETRIES - 1) {
                console.warn(`GenerateSocialPostsFlow (${input.platform}): Service unavailable/overloaded. Retrying in ${backoff}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                retries++;
                backoff *= 2; // Exponential backoff
            } else if (error.message === "AI returned an empty post." && retries < MAX_RETRIES - 1) {
                 console.warn(`GenerateSocialPostsFlow (${input.platform}): Received empty post. Retrying in ${backoff}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
                 await new Promise(resolve => setTimeout(resolve, backoff));
                 retries++;
                 backoff *= 2;
            } else {
                // If it's not a retriable error or retries are exhausted, re-throw
                console.error(`GenerateSocialPostsFlow (${input.platform}): Failed after ${retries} retries.`, error);
                 throw new GenkitError({
                     status: error.status || 'INTERNAL',
                     message: `Post generation for ${input.platform} failed: ${error.message || 'Unknown AI error'}`,
                     cause: error,
                 });
            }
        }
    }
     // Should be unreachable
    throw new GenkitError({ status: 'DEADLINE_EXCEEDED', message: `GenerateSocialPostsFlow (${input.platform}): Max retries reached.` });
  }
);
