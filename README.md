# Firebase Studio - VibeFlow

This is a NextJS starter project called VibeFlow, built within Firebase Studio. It allows users to input content (URL or text), summarize it using AI, and generate tailored social media posts for different platforms (LinkedIn, Twitter, YouTube). Users can then tune these posts and (placeholder for) publish them.

## Getting Started

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Set Up Environment Variables:**

    Create a `.env.local` file in the root of the project and add your Supabase and Google GenAI API keys:

    ```plaintext
    # Replace with your actual Supabase URL and Anon Key
    # Find these in your Supabase project settings > API
    NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

    # Replace with your Google Generative AI API Key
    # Get one from Google AI Studio: https://aistudio.google.com/app/apikey
    GOOGLE_GENAI_API_KEY=YOUR_GOOGLE_GENAI_API_KEY
    ```

    **Important:** Keep your API keys secure and do not commit `.env.local` to version control.

3.  **Run Development Server:**
    ```bash
    npm run dev
    ```
    This will start the Next.js application, typically on `http://localhost:9002`.

4.  **(Optional) Run Genkit Developer UI:**
    If you want to inspect or test the AI flows directly using the Genkit developer UI, run:
    ```bash
    npm run genkit:watch
    ```
    This will start the Genkit UI, usually on `http://localhost:4000`.

5.  **Open the App:**
    Navigate to `http://localhost:9002` (or the specified port) in your browser.

## Project Structure

-   `src/app/`: Contains the Next.js App Router pages and layouts.
    -   `page.tsx`: The main dashboard page (requires login).
    -   `login/page.tsx`: The authentication page.
    -   `layout.tsx`: The root layout for the application.
-   `src/components/`: Reusable React components.
    -   `dashboard/dashboard.tsx`: The core UI for content input and post generation.
    -   `ui/`: ShadCN UI components.
-   `src/ai/`: Contains AI-related code using Genkit.
    -   `ai-instance.ts`: Configures the Genkit instance and AI model.
    -   `flows/`: Defines the AI workflows (summarization, post generation, tuning).
    -   `dev.ts`: Entry point for running Genkit flows in development mode.
-   `src/lib/`: Utility functions and library integrations.
    -   `supabase/`: Supabase client setup (client, server, middleware).
    -   `utils.ts`: General utility functions (like `cn` for class names).
-   `src/services/`: Business logic services (e.g., content parsing).
-   `src/hooks/`: Custom React hooks (e.g., `useToast`, `useMobile`).
-   `public/`: Static assets.
-   `middleware.ts`: Next.js middleware for Supabase session handling.
-   `next.config.ts`: Next.js configuration.
-   `tailwind.config.ts`: Tailwind CSS configuration.
-   `tsconfig.json`: TypeScript configuration.
-   `components.json`: ShadCN UI configuration.

## Features

-   **Authentication:** Supabase Auth for user login/signup.
-   **Content Input:** Accepts URLs or raw text.
-   **AI Summarization:** Uses Google Gemini via Genkit to summarize input content.
-   **Social Post Generation:** Generates posts for LinkedIn, Twitter, and YouTube based on the summary.
-   **Post Tuning:** Allows users to refine generated posts with AI assistance (e.g., make wittier, more concise).
-   **UI:** Built with Next.js App Router, React Server Components, ShadCN UI, and Tailwind CSS.
-   **State Management:** Uses React hooks (`useState`, `useTransition`).
-   **(Placeholder) Publishing:** Includes UI elements for publishing posts (integration with Composio MCP is intended but not fully implemented).
-   **(Placeholder) Quota Management:** UI elements and basic structure for usage limits.
