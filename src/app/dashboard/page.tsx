
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Dashboard from '@/components/dashboard/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Revalidate this page every 60 seconds
// export const revalidate = 60; // Removed revalidation for now, may cause issues with redirects

export default async function DashboardPage() {
  let supabase;
  let user = null;
  let initialError: Error | null = null;
  let errorMessage: string | null = null;

  try {
    // Attempt to create client first. This will throw if env vars are missing or URL is invalid.
    supabase = createClient();

    // Try fetching the user *after* confirming the client was created
    const { data, error: authError } = await supabase.auth.getUser();

    if (authError || !data.user) {
       // If there's an auth error OR no user data, redirect to login
       // No need to log "Auth session missing" as it's the expected case
       if (authError && !authError.message.includes("Auth session missing")) {
         console.error("Authentication error:", authError.message); // Log other auth errors
       }
       redirect('/login'); // Redirect to login if session missing or any other auth error
    }

    user = data.user;

  } catch (error: any) {
     // Catch errors from createClient (missing vars, invalid URL) or other unexpected issues
     if (error.message === 'NEXT_REDIRECT') {
        // If the error is NEXT_REDIRECT, it means redirect() was called.
        // Allow Next.js to handle it; re-throw the error.
        throw error;
     }

      // Log the underlying error for debugging purposes
      console.error("Error during Supabase initialization or user fetch:", error.message);
      initialError = error; // Store the error to potentially display

      // Determine the specific error message for configuration issues
      if (error.message.includes("URL and Key are required")) {
         errorMessage = "Supabase URL or Key is missing. Please check your environment variables (`.env.local`) and ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly. Refer to the README for setup instructions.";
      } else if (error.message.includes("Invalid URL")) {
           errorMessage = "Invalid Supabase URL format. Please check the `NEXT_PUBLIC_SUPABASE_URL` in your `.env.local` file. It should look like `https://<your-project-ref>.supabase.co`.";
      } else {
           // Handle other potential errors
           errorMessage = `An unexpected error occurred during application startup: ${error.message}. Please contact the administrator or check your Supabase configuration.`;
      }
  }

  // Display specific error card ONLY if there's a configuration error message set
  // Do NOT display a card for NEXT_REDIRECT, as Next.js handles it.
  if (initialError && errorMessage) {
     return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
            <Card className="mx-auto max-w-md w-full z-10 bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
                <CardHeader>
                    <CardTitle className="text-destructive">Configuration Error</CardTitle>
                    <CardDescription className="text-destructive-foreground">
                       {errorMessage}
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <p className="text-sm text-muted-foreground">Detailed Error:</p>
                    <pre className="mt-2 w-full rounded-md bg-muted p-4 overflow-x-auto text-sm">
                        {initialError.message}
                    </pre>
                 </CardContent>
            </Card>
        </div>
    );
  }

  if (!user) {
    // This should theoretically not be reached due to the checks above,
    // but acts as a final safety net.
    console.log("No user session found or unexpected error occurred, redirecting to login.");
    redirect('/login');
  }

  // If user is logged in and no errors occurred, show the dashboard
  return <Dashboard user={user} />;
}
