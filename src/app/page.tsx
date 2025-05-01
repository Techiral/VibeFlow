
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Dashboard from '@/components/dashboard/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Import Card components for error display

export default async function Home() {
  let supabase;
  let user = null;
  let initialError: Error | null = null;
  let errorMessage: string | null = null;

  try {
    // Attempt to create client first. This will throw if env vars are missing or URL is invalid.
    supabase = createClient();

    // Try fetching the user *after* confirming the client was created
    const { data, error: authError } = await supabase.auth.getUser();

    if (authError) {
       // Check if it's an expected "Auth session missing" state
       if (authError.message.includes("Auth session missing")) {
           // Normal case, user not logged in - redirect silently
           redirect('/login'); // Use redirect function directly
       }
       // Log other auth errors and redirect with a generic message
      console.error("Authentication error:", authError.message); // Keep this log for other auth errors
      redirect(`/login?message=Error+authenticating+user`); // Use redirect function directly
    }

    user = data.user;

  } catch (error: any) {
    // If error is NOT specifically "Auth session missing", handle it.
    // Redirects are automatically handled by Next.js when thrown.
    if (!error.message?.includes("Auth session missing")) {
        // Log the underlying error unless it's just the internal NEXT_REDIRECT signal
        if (error.message !== 'NEXT_REDIRECT') {
            console.error("Error during Supabase initialization or user fetch:", error.message);
        }
        initialError = error; // Store the error to potentially display

        // Determine the specific error message for configuration issues
        if (error.message.includes("URL and Key are required")) {
           errorMessage = "Supabase URL or Key is missing. Please check your environment variables (`.env.local`) and ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly. Refer to the README for setup instructions.";
        } else if (error.message.includes("Invalid URL")) {
             errorMessage = "Invalid Supabase URL format. Please check the `NEXT_PUBLIC_SUPABASE_URL` in your `.env.local` file. It should look like `https://<your-project-ref>.supabase.co`.";
        } else if (error.message === 'NEXT_REDIRECT') {
             // This case means a redirect was triggered, likely because the user wasn't authenticated.
             // Next.js handles this, so we don't need to show an error card here.
             // We'll let the redirect happen. No need to set errorMessage.
             // The function will exit due to the redirect.
             // If we reach here unexpectedly, it might indicate a deeper issue,
             // but normally the redirect should halt execution earlier.
             ; // No action needed, let Next.js handle the redirect.
        } else {
             // Handle other potential errors
             errorMessage = `An unexpected error occurred during application startup: ${error.message}. Please contact the administrator or check your Supabase configuration.`;
        }
     } else {
         // If the error *is* "Auth session missing", redirect to login (should have been caught above, but acts as safety net)
         redirect('/login');
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
    // This should theoretically not be reached if authError was "Auth session missing"
    // or if createClient threw an error, or if a redirect happened, but acts as a fallback.
    console.log("No user session found or error occurred, redirecting to login.");
    redirect('/login');
  }

  // If user is logged in and no errors occurred, show the dashboard
  return <Dashboard user={user} />;
}
