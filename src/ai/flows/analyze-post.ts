
'use server';

/**
 * @fileOverview Analyzes social media posts for tone, clarity, and potential issues.
 *
 * - analyzePost - A function that analyzes a social media post draft.
 * - AnalyzePostInput - The input type for the analyzePost function.
 * - AnalyzePostOutput - The return type for the analyzePost function.
 */

import { ai as defaultAi } from '@/ai/ai-instance';
import { GenkitError } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit';

// Define options type including the API key
type FlowOptions = {
  apiKey: string;
};

const AnalyzePostInputSchema = z.object({
  postContent: z.string().describe('The content of the social media post draft to analyze.'),
  platform: z.enum(['linkedin', 'twitter', 'youtube']).describe('The platform the post is intended for.'),
});
export type AnalyzePostInput = z.infer<typeof AnalyzePostInputSchema>;

// Define the structure for a single issue/suggestion flag
const PostFlagSchema = z.object({
    start: z.number().describe('The starting character index of the flagged text in the original post.'),
    end: z.number().describe('The ending character index (exclusive) of the flagged text in the original post.'),
    originalText: z.string().describe('The specific text segment that was flagged.'),
    issue: z.string().describe('A brief description of the issue found (e.g., "Too formal", "Unclear phrasing", "Weak call-to-action").'),
    suggestion: z.string().describe('A suggested replacement or improvement for the flagged text.'),
});
export type PostFlag = z.infer<typeof PostFlagSchema>;

const AnalyzePostOutputSchema = z.object({
  analysis: z.string().describe('A brief overall analysis of the post.'),
  flags: z.array(PostFlagSchema).describe('An array of specific issues found in the post, including the original text and suggestions.'),
});
export type AnalyzePostOutput = z.infer<typeof AnalyzePostOutputSchema>;


// Modify the exported function to accept options
export async function analyzePost(
    input: AnalyzePostInput,
    options: FlowOptions
): Promise<AnalyzePostOutput> {
   if (!options?.apiKey) {
     throw new GenkitError({
         status: 'INVALID_ARGUMENT',
         message: 'API key is required for analyzing posts.',
     });
   }
  // Pass options to the flow runner
  return analyzePostFlow(input, options);
}


const prompt = defaultAi.definePrompt({
  name: 'analyzePostPrompt',
  input: {
    schema: AnalyzePostInputSchema,
  },
  output: {
    schema: AnalyzePostOutputSchema,
  },
  prompt: `You are an expert social media copy editor. Analyze the following post draft intended for {{platform}}.

Draft:
{{{postContent}}}

Review the draft for tone (is it appropriate for {{platform}}?), clarity (is it easy to understand?), and engagement (is it likely to capture attention? Does it have a clear call-to-action if appropriate?).

Provide a brief overall analysis. Then, identify specific segments ("flags") that could be improved. For each flag, provide:
1.  The exact original text segment.
2.  The start and end character index of that segment in the original draft.
3.  A concise description of the issue (e.g., "Too formal", "Weak verb", "Vague language", "Readability issue", "Tone mismatch for {{platform}}").
4.  A concrete suggestion for rewriting the flagged segment.

If the post looks good, provide a positive overall analysis and an empty array for flags. Focus on actionable, specific feedback.`,
  // Define config schema to accept API key
  configSchema: z.object({
    apiKey: z.string().optional(),
  }),
  // Use the apiKey from config for the Google AI plugin
  plugins: [googleAI(config => ({ apiKey: config?.apiKey }))],
  // Ensure the model is specified
  model: 'googleai/gemini-2.0-flash',
});


const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1 second

// Function to check if an error is retriable
const isRetriableError = (error: any): boolean => {
    const message = error.message?.toLowerCase() || '';
    const status = error.status || (error instanceof GenkitError ? error.status : null);

    if (status === 'UNAVAILABLE' || status === 'RESOURCE_EXHAUSTED') {
        return true;
    }
    if (
        error.status === 503 ||
        message.includes('503') ||
        message.includes('service unavailable') ||
        message.includes('overloaded') ||
        message.includes('internal error') ||
        message.includes('the model is overloaded') ||
        message.includes('rate limit exceeded') ||
        message.includes('quota exceeded')
    ) {
       return true;
    }
    return false;
};

// Define the flow using defaultAi.defineFlow
const analyzePostFlow = defaultAi.defineFlow<
  typeof AnalyzePostInputSchema,
  typeof AnalyzePostOutputSchema,
  FlowOptions // Add FlowOptions
>({
  name: 'analyzePostFlow',
  inputSchema: AnalyzePostInputSchema,
  outputSchema: AnalyzePostOutputSchema,
},
async (input, flowOptions) => {

    let retries = 0;
    let backoff = INITIAL_BACKOFF_MS;

    while (retries < MAX_RETRIES) {
        try {
            // Call the prompt object, passing the API key via config
            const {output} = await prompt(
                input, // Prompt input
                { config: { apiKey: flowOptions.apiKey } } // Prompt config
            );

            // Validate output structure
            if (!output || typeof output.analysis !== 'string' || !Array.isArray(output.flags)) {
                console.warn(`AnalyzePostFlow (${input.platform}): Received invalid or empty analysis from AI.`);
                throw new Error("AI returned invalid or empty analysis results.");
            }
            return output; // Success
        } catch (error: any) {
            // Handle non-retriable API key error
            if (error instanceof GenkitError && error.status === 'UNAUTHENTICATED' || error.message?.includes("API key not valid")) {
                console.error(`AnalyzePostFlow (${input.platform}): Invalid API Key used.`);
                throw new GenkitError({ status: 'UNAUTHENTICATED', message: "Invalid API key provided.", cause: error });
            }

            // Check for retriable errors before max retries
            if (isRetriableError(error) && retries < MAX_RETRIES - 1) {
                let reason = "AI service unavailable/overloaded";
                if (error.message.includes("invalid or empty analysis")) {
                     reason = "Received invalid analysis";
                 } else if (error.status === 'RESOURCE_EXHAUSTED' || error.message?.toLowerCase().includes('rate limit exceeded')) {
                     reason = "AI service rate limit potentially hit";
                 }
                console.warn(`AnalyzePostFlow (${input.platform}): ${reason}. Retrying in ${backoff}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, backoff));
                retries++;
                backoff *= 2; // Exponential backoff
                continue;
            } else {
                // Non-retriable error OR retries exhausted
                console.error(`AnalyzePostFlow (${input.platform}): Failed after ${retries} retries. Original Error:`, error);

                let finalStatus: GenkitError['status'] = 'INTERNAL';
                let finalMessage = `Post analysis failed: ${error.message || 'Unknown AI error'}`;
                const messageLower = error.message?.toLowerCase() || '';

                 if (error instanceof GenkitError) {
                     finalStatus = error.status ?? finalStatus;
                 } else if (isRetriableError(error)) { // Retriable but exhausted
                      if (error.status === 503 || messageLower.includes('503') || messageLower.includes('overloaded') || messageLower.includes('service unavailable')) {
                          finalStatus = 'UNAVAILABLE';
                          finalMessage = `AI service was unavailable for analysis (${input.platform}) after multiple retry attempts.`;
                      } else if (error.status === 'RESOURCE_EXHAUSTED' || messageLower.includes('rate limit exceeded')) {
                           finalStatus = 'RESOURCE_EXHAUSTED';
                           finalMessage = `AI service rate limit issues persisted during analysis (${input.platform}) after multiple retry attempts. Please check your Google API quota.`;
                      } else {
                           finalStatus = 'INTERNAL';
                           finalMessage = `Post analysis for ${input.platform} failed due to a temporary AI service issue after ${MAX_RETRIES} attempts. Original error: ${error.message}`;
                      }
                 } else if (error.status === 400 || error.statusCode === 400) {
                       finalStatus = 'INVALID_ARGUMENT';
                       finalMessage = `Analysis failed for ${input.platform} due to invalid input or configuration: ${error.message || 'Bad request'}`;
                 } else if (error.message.includes("invalid or empty analysis")) {
                      finalMessage = `Analysis for ${input.platform} failed because the AI returned an invalid or empty result after ${MAX_RETRIES} attempts.`;
                      finalStatus = 'INTERNAL';
                 }

                throw new GenkitError({
                    status: finalStatus,
                    message: finalMessage,
                    cause: error,
                });
            }
        }
    }
    // Fallback error if loop finishes unexpectedly (should not happen if MAX_RETRIES > 0)
    throw new GenkitError({ status: 'DEADLINE_EXCEEDED', message: `AnalyzePostFlow (${input.platform}): Max retries (${MAX_RETRIES}) reached.` });
});

