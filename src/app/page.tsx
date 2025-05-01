
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
           return redirect('/login');
       }
       // Log other auth errors and redirect with a generic message
      console.error("Authentication error:", authError.message);
      return redirect(`/login?message=Error+authenticating+user`);
    }

    user = data.user;

  } catch (error: any) {
    console.error("Error during Supabase initialization or user fetch:", error.message);
    initialError = error; // Store the error to display

    // Determine the specific error message for configuration issues
    if (error.message.includes("URL and Key are required")) {
       errorMessage = "Supabase URL or Key is missing. Please check your environment variables (`.env.local`) and ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly. Refer to the README for setup instructions.";
    } else if (error.message.includes("Invalid URL")) {
         errorMessage = "Invalid Supabase URL format. Please check the `NEXT_PUBLIC_SUPABASE_URL` in your `.env.local` file. It should look like `https://<your-project-ref>.supabase.co`.";
    } else {
         errorMessage = `An unexpected error occurred during application startup: ${error.message}. Please contact the administrator or check your Supabase configuration.`;
    }
  }

  // Display specific error if client creation failed
  if (initialError) {
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
    // This should theoretically not be reached if authError was "Auth session missing",
    // but acts as a fallback if getUser returns no error but also no user.
    console.log("No user session found, redirecting to login.");
    return redirect('/login');
  }

  // If user is logged in, show the dashboard
  return <Dashboard user={user} />;
}
