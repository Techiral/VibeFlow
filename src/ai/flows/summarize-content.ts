'use server';

/**
 * @fileOverview Summarizes content from a URL or text input.
 *
 * - summarizeContent - A function that summarizes content.
 * - SummarizeContentInput - The input type for the summarizeContent function.
 * - SummarizeContentOutput - The return type for the summarizeContent function.
 */

import {ai} from '@/ai/ai-instance';
import {z} from 'genkit';
import {parseContent} from '@/services/content-parser';

const SummarizeContentInputSchema = z.object({
  content: z.string().describe('The content to summarize, either a URL or text.'),
});
export type SummarizeContentInput = z.infer<typeof SummarizeContentInputSchema>;

const SummarizeContentOutputSchema = z.object({
  summary: z.string().describe('The summarized content.'),
});
export type SummarizeContentOutput = z.infer<typeof SummarizeContentOutputSchema>;

export async function summarizeContent(input: SummarizeContentInput): Promise<SummarizeContentOutput> {
  return summarizeContentFlow(input);
}

const summarizeContentPrompt = ai.definePrompt({
  name: 'summarizeContentPrompt',
  input: {
    schema: z.object({
      content: z.string().describe('The content to summarize.'),
    }),
  },
  output: {
    schema: z.object({
      summary: z.string().describe('The summarized content.'),
    }),
  },
  prompt: `Summarize the following content:\n\n{{content}}`,
});

const summarizeContentFlow = ai.defineFlow<
  typeof SummarizeContentInputSchema,
  typeof SummarizeContentOutputSchema
>({
  name: 'summarizeContentFlow',
  inputSchema: SummarizeContentInputSchema,
  outputSchema: SummarizeContentOutputSchema,
},
async input => {
  let content = input.content;
  // If the input is a URL, parse the content from the URL.
  if (input.content.startsWith('http://') || input.content.startsWith('https://')) {
    const parsedContent = await parseContent(input.content);
    content = parsedContent.body;
  }

  const {output} = await summarizeContentPrompt({content});
  return output!;
});
