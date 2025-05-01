
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Dashboard from '@/components/dashboard/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Import Card components for error display

export default async function Home() {
  let supabase;
  let user = null;
  let initialError: Error | null = null;

  try {
    // Attempt to create client first. This will throw if env vars are missing.
    supabase = createClient();

    // Try fetching the user *after* confirming the client was created
    const { data, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("Error fetching user:", authError.message);
      // Redirect to login, but include a more specific error if possible
      // Check if it's an auth error vs. a connection error already handled by createClient throw
       if (authError.message.includes("Auth session missing")) {
           // Normal case, user not logged in
           return redirect('/login');
       }
      // For other auth errors, redirect with message
      return redirect(`/login?message=Error+authenticating+user:+${encodeURIComponent(authError.message)}`);
    }

    user = data.user;

  } catch (error: any) {
    console.error("Error during Supabase initialization or user fetch:", error.message);
    initialError = error; // Store the error to display
    // Don't try to use supabase client further if creation failed
  }

  // Display specific error if client creation failed due to missing env vars
  if (initialError && initialError.message.includes("URL and Key are required")) {
     return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
            <Card className="mx-auto max-w-md w-full z-10 bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
                <CardHeader>
                    <CardTitle className="text-destructive">Configuration Error</CardTitle>
                    <CardDescription className="text-destructive-foreground">
                       Supabase URL or Key is missing. Please check your environment variables (`.env.local`) and ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly. Refer to the README for setup instructions.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <pre className="mt-2 w-full rounded-md bg-muted p-4 overflow-x-auto text-sm">
                        {initialError.message}
                    </pre>
                 </CardContent>
            </Card>
        </div>
    );
  } else if (initialError) {
     // Display generic error for other initialization issues
     return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
            <Card className="mx-auto max-w-md w-full z-10 bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
                <CardHeader>
                    <CardTitle>Initialization Error</CardTitle>
                    <CardDescription>
                       An unexpected error occurred during application startup. Please contact the administrator.
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                    <pre className="mt-2 w-full rounded-md bg-muted p-4 overflow-x-auto text-sm">
                        {initialError.message}
                    </pre>
                 </CardContent>
            </Card>
        </div>
    );
  }


  if (!user) {
    // If there was no error during initialization but no user, redirect to login normally
    return redirect('/login');
  }

  // If user is logged in, show the dashboard
  return <Dashboard user={user} />;
}
