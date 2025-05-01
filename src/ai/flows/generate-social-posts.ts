'use server';

/**
 * @fileOverview A flow for generating social media posts tailored to different platforms.
 *
 * - generateSocialPosts - A function that generates social media posts.
 * - GenerateSocialPostsInput - The input type for the generateSocialPosts function.
 * - GenerateSocialPostsOutput - The return type for the generateSocialPosts function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const GenerateSocialPostsInputSchema = z.object({
  summary: z.string().describe('The summarized content to generate social media posts from.'),
  platform: z.enum(['linkedin', 'twitter', 'youtube']).describe('The social media platform to generate a post for.'),
});
export type GenerateSocialPostsInput = z.infer<typeof GenerateSocialPostsInputSchema>;

const GenerateSocialPostsOutputSchema = z.object({
  post: z.string().describe('The generated social media post for the specified platform.'),
});
export type GenerateSocialPostsOutput = z.infer<typeof GenerateSocialPostsOutputSchema>;

export async function generateSocialPosts(input: GenerateSocialPostsInput): Promise<GenerateSocialPostsOutput> {
  return generateSocialPostsFlow(input);
}

const prompt = ai.definePrompt({
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
  prompt: `You are a social media expert. Generate a social media post for the following platform: {{{platform}}}.\n\nHere is the content summary: {{{summary}}}.\n\nMake sure the post is engaging and tailored to the platform. The length of the post should be appropriate for the platform (e.g., Twitter posts should be less than 280 characters).`,
});

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1 second

const generateSocialPostsFlow = ai.defineFlow<
  typeof GenerateSocialPostsInputSchema,
  typeof GenerateSocialPostsOutputSchema
>(
  {
    name: 'generateSocialPostsFlow',
    inputSchema: GenerateSocialPostsInputSchema,
    outputSchema: GenerateSocialPostsOutputSchema,
  },
  async input => {
    let retries = 0;
    let backoff = INITIAL_BACKOFF_MS;

    while (retries < MAX_RETRIES) {
        try {
            const {output} = await prompt(input);
            return output!;
        } catch (error: any) {
             // Check if the error is a 503 Service Unavailable or similar overload error
            if ((error.status === 503 || error.message?.includes("503") || error.message?.toLowerCase().includes("overloaded")) && retries < MAX_RETRIES - 1) {
                console.warn(`GenerateSocialPostsFlow: Service unavailable (503). Retrying in ${backoff}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                retries++;
                backoff *= 2; // Exponential backoff
            } else {
                // If it's not a 503 or retries are exhausted, re-throw the error
                console.error(`GenerateSocialPostsFlow: Failed after ${retries} retries.`, error);
                throw error; // Re-throw the original error or a custom one
            }
        }
    }
    // This line should theoretically be unreachable if MAX_RETRIES > 0,
    // but needed for type safety if MAX_RETRIES could be 0.
    throw new Error("GenerateSocialPostsFlow: Max retries reached.");
  }
);
