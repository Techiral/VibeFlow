
'use server';

/**
 * @fileOverview Summarizes content from a URL or text input.
 *
 * - summarizeContent - A function that summarizes content.
 * - SummarizeContentInput - The input type for the summarizeContent function.
 * - SummarizeContentOutput - The return type for the summarizeContent function.
 */

import {ai as defaultAi} from '@/ai/ai-instance'; // Use the configured instance
import { GenkitError } from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import {z} from 'genkit';
import {parseContent} from '@/services/content-parser';

// Define options type including the API key
type FlowOptions = {
  apiKey: string;
};

const SummarizeContentInputSchema = z.object({
  content: z.string().describe('The content to summarize, either a URL or text.'),
});
export type SummarizeContentInput = z.infer<typeof SummarizeContentInputSchema>;

const SummarizeContentOutputSchema = z.object({
  summary: z.string().describe('The summarized content.'),
});
export type SummarizeContentOutput = z.infer<typeof SummarizeContentOutputSchema>;

// Modify the exported function to accept options
export async function summarizeContent(
  input: SummarizeContentInput,
  options: FlowOptions
): Promise<SummarizeContentOutput> {
  if (!options?.apiKey) {
    throw new GenkitError({
        status: 'INVALID_ARGUMENT',
        message: 'API key is required for summarization.',
    });
  }
  // Pass options to the flow runner
  return summarizeContentFlow(input, options);
}

// Define the prompt separately, it doesn't need the API key directly
const summarizeContentPrompt = defaultAi.definePrompt({
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
  prompt: `Summarize the following content concisely:\n\n{{{content}}}`, // Added concisely
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

// Function to check if an error is retriable (5xx, unavailable, overloaded, rate limit)
const isRetriableError = (error: any): boolean => {
    const message = error.message?.toLowerCase() || '';
    const status = error.status || (error instanceof GenkitError ? error.status : null);

    // Check for Genkit specific statuses
    if (status === 'UNAVAILABLE' || status === 'RESOURCE_EXHAUSTED') {
        return true;
    }

    // Check for HTTP status codes within the error message or structure (e.g., 503)
    // Also check for common textual indicators of temporary issues.
    if (
        error.status === 503 ||
        message.includes('503') ||
        message.includes('service unavailable') ||
        message.includes('overloaded') ||
        message.includes('internal error') || // Sometimes 500s are temporary
        message.includes('the model is overloaded') ||
        message.includes('rate limit exceeded') ||
        message.includes('quota exceeded') // Treat quota issues as potentially retriable short-term
    ) {
       return true;
    }

    return false;
};


// Modify the flow definition to accept and use options
// Use defaultAi.defineFlow
const summarizeContentFlow = defaultAi.defineFlow<
  typeof SummarizeContentInputSchema,
  typeof SummarizeContentOutputSchema,
  FlowOptions // Add FlowOptions as the third generic parameter for flow context/options
>({
  name: 'summarizeContentFlow',
  inputSchema: SummarizeContentInputSchema,
  outputSchema: SummarizeContentOutputSchema,
},
async (input, flowOptions) => { // Receive flowOptions here

  let content = input.content;
  // If the input is a URL, parse the content from the URL.
  try {
      if (input.content.startsWith('http://') || input.content.startsWith('https://')) {
        const parsedContent = await parseContent(input.content);
        if (!parsedContent || !parsedContent.body || parsedContent.body.trim().length < 10) {
            console.warn("Content parsing might have failed or returned very little content for URL:", input.content);
            // Use a more descriptive placeholder if parsing fails substantially
            content = `Could not extract meaningful content from the URL: ${input.content}. Please paste the text directly.`;
        } else {
             content = parsedContent.body;
        }
      }
  } catch (parseError: any) {
       console.error("Error parsing content from URL:", input.content, parseError);
       // Use a specific error status and message for parsing failures
       throw new GenkitError({
          status: 'INVALID_ARGUMENT', // Indicate bad input (the URL)
          message: `Error parsing content from URL: ${parseError.message || 'Unknown parsing error'}. Please check the URL or paste text directly.`,
          cause: parseError,
       });
  }

  let retries = 0;
  let backoff = INITIAL_BACKOFF_MS;

   while (retries < MAX_RETRIES) {
        try {
            // Call the prompt object directly, passing the API key via config
            const {output} = await summarizeContentPrompt(
              { content }, // Prompt input
              { config: { apiKey: flowOptions.apiKey } } // Prompt config with API key
            );

            if (!output?.summary) {
                console.warn("SummarizeContentFlow: Received empty summary from AI.");
                throw new Error("AI returned an empty summary.");
            }
            return output; // Success! Exit the loop and return.
        } catch (error: any) {
             // Check for specific API key error - this is not retriable
            if (error instanceof GenkitError && error.status === 'UNAUTHENTICATED' || error.message?.includes("API key not valid")) {
                 console.error(`SummarizeContentFlow: Invalid API Key used.`);
                 // Throw immediately, no retry
                 throw new GenkitError({ status: 'UNAUTHENTICATED', message: "Invalid API key provided.", cause: error });
            }

            // Check for retriable errors *before* reaching max retries
            if (isRetriableError(error) && retries < MAX_RETRIES - 1) {
                let reason = "AI service unavailable/overloaded";
                const message = error.message?.toLowerCase() || '';
                if (error.message === "AI returned an empty summary.") {
                    reason = "Received empty summary";
                } else if (error.status === 'RESOURCE_EXHAUSTED' || message.includes('rate limit exceeded')) {
                     reason = "AI service rate limit potentially hit";
                }
                console.warn(`SummarizeContentFlow: ${reason}. Retrying in ${backoff}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                retries++;
                backoff *= 2; // Exponential backoff
                continue; // Explicitly continue to the next iteration of the loop
            } else {
                // If it's not a retriable error OR retries are exhausted, prepare to throw
                console.error(`SummarizeContentFlow: Failed after ${retries} retries. Original Error:`, error);

                 // Determine the best status code and message for the final error
                 let finalStatus: GenkitError['status'] = 'INTERNAL';
                 let finalMessage = `Summarization failed: ${error.message || 'Unknown AI error'}`;
                 const messageLower = error.message?.toLowerCase() || '';

                  if (error instanceof GenkitError) {
                     finalStatus = error.status ?? finalStatus;
                 } else if (isRetriableError(error)) { // If it was retriable but retries exhausted
                      if (error.status === 503 || messageLower.includes('503') || messageLower.includes('overloaded') || messageLower.includes('service unavailable')) {
                          finalStatus = 'UNAVAILABLE';
                          finalMessage = "AI service was unavailable for summarization after multiple retry attempts."; // Specific message
                      } else if (error.status === 'RESOURCE_EXHAUSTED' || messageLower.includes('rate limit exceeded')) {
                           finalStatus = 'RESOURCE_EXHAUSTED';
                           finalMessage = "AI service rate limit issues persisted during summarization after multiple retry attempts. Please check your Google API quota."; // Specific message
                      } else {
                           finalStatus = 'INTERNAL'; // Default for other retriable errors after exhaustion
                           finalMessage = `Summarization failed due to a temporary AI service issue after ${MAX_RETRIES} attempts. Please try again later. Original error: ${error.message}`;
                      }
                  } else if (error.status === 400 || error.statusCode === 400) { // Check for 400 status
                       finalStatus = 'INVALID_ARGUMENT';
                       finalMessage = `Summarization failed due to invalid input or configuration: ${error.message || 'Bad request'}`;
                  } else if (error.message === "AI returned an empty summary.") {
                      finalMessage = `Summarization failed because the AI returned an empty result after ${MAX_RETRIES} attempts.`;
                      finalStatus = 'INTERNAL'; // Treat empty summary after retries as internal failure
                  }

                 // Throw the final, consolidated error
                 throw new GenkitError({
                   status: finalStatus,
                   message: finalMessage,
                   cause: error, // Include the original error as cause
                 });
            }
        }
    }
     // Should be unreachable if MAX_RETRIES > 0, but needed for TypeScript compilation
    throw new GenkitError({ status: 'DEADLINE_EXCEEDED', message: `SummarizeContentFlow: Max retries (${MAX_RETRIES}) reached after encountering errors.`});
});

    