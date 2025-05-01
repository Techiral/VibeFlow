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

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1 second


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
  try {
      if (input.content.startsWith('http://') || input.content.startsWith('https://')) {
        const parsedContent = await parseContent(input.content);
        // Basic check if parsing returned something meaningful
        if (!parsedContent || !parsedContent.body || parsedContent.body.trim().length < 10) {
            console.warn("Content parsing might have failed or returned very little content for URL:", input.content);
            // Depending on requirements, you might throw an error here or proceed cautiously.
            // For now, we'll proceed but use a fallback if body is empty.
            content = parsedContent?.body || "Could not parse content from URL.";
        } else {
             content = parsedContent.body;
        }
      }
  } catch (parseError: any) {
       console.error("Error parsing content from URL:", input.content, parseError);
       // Re-throw a more specific error to be caught by the frontend
       throw new Error(`Error parsing content from URL: ${parseError.message || 'Unknown parsing error'}`);
  }

  let retries = 0;
  let backoff = INITIAL_BACKOFF_MS;

   while (retries < MAX_RETRIES) {
        try {
            const {output} = await summarizeContentPrompt({content});
            if (!output?.summary) {
                console.warn("SummarizeContentFlow: Received empty summary from AI.");
                throw new Error("AI returned an empty summary."); // Treat empty summary as an error for retry logic
            }
            return output;
        } catch (error: any) {
             // Check if the error is a 503 Service Unavailable or similar overload error
            if ((error.status === 503 || error.message?.includes("503") || error.message?.toLowerCase().includes("overloaded")) && retries < MAX_RETRIES - 1) {
                console.warn(`SummarizeContentFlow: Service unavailable (503). Retrying in ${backoff}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                retries++;
                backoff *= 2; // Exponential backoff
            } else if (error.message === "AI returned an empty summary." && retries < MAX_RETRIES - 1) {
                 console.warn(`SummarizeContentFlow: Received empty summary. Retrying in ${backoff}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
                 await new Promise(resolve => setTimeout(resolve, backoff));
                 retries++;
                 backoff *= 2;
            } else {
                // If it's not a 503 or retries are exhausted, re-throw the error
                console.error(`SummarizeContentFlow: Failed after ${retries} retries.`, error);
                throw error; // Re-throw the original error or a custom one
            }
        }
    }
     // This line should theoretically be unreachable if MAX_RETRIES > 0,
    // but needed for type safety if MAX_RETRIES could be 0.
    throw new Error("SummarizeContentFlow: Max retries reached after encountering errors.");
});

