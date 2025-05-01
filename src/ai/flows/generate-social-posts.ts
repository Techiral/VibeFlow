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
    const {output} = await prompt(input);
    return output!;
  }
);
