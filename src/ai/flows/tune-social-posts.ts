// tune-social-posts.ts
'use server';

/**
 * @fileOverview Tunes social media posts based on user feedback.
 *
 * - tuneSocialPosts - A function that tunes social media posts.
 * - TuneSocialPostsInput - The input type for the tuneSocialPosts function.
 * - TuneSocialPostsOutput - The return type for the tuneSocialPosts function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';

const TuneSocialPostsInputSchema = z.object({
  originalPost: z.string().describe('The original social media post.'),
  feedback: z.string().describe('User feedback on the post (e.g., Make wittier, More concise).'),
});
export type TuneSocialPostsInput = z.infer<typeof TuneSocialPostsInputSchema>;

const TuneSocialPostsOutputSchema = z.object({
  tunedPost: z.string().describe('The tuned social media post.'),
});
export type TuneSocialPostsOutput = z.infer<typeof TuneSocialPostsOutputSchema>;

export async function tuneSocialPosts(input: TuneSocialPostsInput): Promise<TuneSocialPostsOutput> {
  return tuneSocialPostsFlow(input);
}

const prompt = ai.definePrompt({
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
  prompt: `You are a social media expert. You will be given an original social media post and feedback on how to improve it. Please tune the post based on the feedback.

Original Post: {{{originalPost}}}
Feedback: {{{feedback}}}

Tuned Post:`, // Keep prompt simple
});


const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1 second

const tuneSocialPostsFlow = ai.defineFlow<
  typeof TuneSocialPostsInputSchema,
  typeof TuneSocialPostsOutputSchema
>({
  name: 'tuneSocialPostsFlow',
  inputSchema: TuneSocialPostsInputSchema,
  outputSchema: TuneSocialPostsOutputSchema,
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
                console.warn(`TuneSocialPostsFlow: Service unavailable (503). Retrying in ${backoff}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                retries++;
                backoff *= 2; // Exponential backoff
            } else {
                // If it's not a 503 or retries are exhausted, re-throw the error
                console.error(`TuneSocialPostsFlow: Failed after ${retries} retries.`, error);
                throw error; // Re-throw the original error or a custom one
            }
        }
    }
     // This line should theoretically be unreachable if MAX_RETRIES > 0,
    // but needed for type safety if MAX_RETRIES could be 0.
    throw new Error("TuneSocialPostsFlow: Max retries reached.");
});
