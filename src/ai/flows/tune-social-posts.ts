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

const tuneSocialPostsFlow = ai.defineFlow<
  typeof TuneSocialPostsInputSchema,
  typeof TuneSocialPostsOutputSchema
>({
  name: 'tuneSocialPostsFlow',
  inputSchema: TuneSocialPostsInputSchema,
  outputSchema: TuneSocialPostsOutputSchema,
},
async input => {
  const {output} = await prompt(input);
  return output!;
});
