
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

// Define a default AI instance. This might be used for:
// 1. Operations that don't require a user-specific key (if any).
// 2. As a base configuration that gets overridden in flows.
// 3. Development/testing where a global key might be temporarily used (though discouraged).
// IMPORTANT: If a global key is required *at all*, it should come from environment variables,
// but the current design moves the key to the user profile.

export const ai = genkit({
  promptDir: './prompts', // Keep if you have shared prompts
  plugins: [
    // Configure Google AI plugin *without* a hardcoded API key here.
    // The key will be provided dynamically within each flow execution.
    googleAI({
       // No apiKey specified here. It will be provided per-request in the flows.
       // apiKey: process.env.GOOGLE_GENAI_API_KEY, // REMOVED
    }),
  ],
  // Define a default model, can still be overridden per-request/per-flow instance
  model: 'googleai/gemini-2.0-flash',
  // Optional: Configure logging, telemetry, etc.
   logLevel: 'debug', // Example: set log level
   enableTracing: true, // Example: enable tracing
});

// Note: Flows like summarizeContent, generateSocialPosts, tuneSocialPosts
// will now need to dynamically create a genkit instance using the user's API key
// passed in via options/context, rather than directly using this exported `ai` instance.
