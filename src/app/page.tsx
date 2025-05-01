import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Dashboard from '@/components/dashboard/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Import Card components for error display

export default async function Home() {
  let supabase;
  let user = null;
  let initialError: Error | null = null;

  try {
    supabase = createClient(); // Attempt to create client first

    // Try fetching the user *after* confirming the client was created
    const { data, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error("Error fetching user:", authError.message);
      // Redirect to login, but include a more specific error if possible
      return redirect(`/login?message=Error+authenticating+user:+${encodeURIComponent(authError.message)}`);
    }

    user = data.user;

  } catch (error: any) {
    console.error("Error during Supabase initialization or user fetch:", error.message);
    initialError = error; // Store the error to display
    // Don't try to use supabase client further if creation failed
  }

  // Display error if client creation failed
  if (initialError) {
    let errorMessage = "Could not initialize application.";
    if (initialError.message.includes("URL and Key are required")) {
       errorMessage = "Application configuration error: Supabase URL or Key is missing. Please contact the administrator.";
    } else {
        errorMessage = `An unexpected error occurred: ${initialError.message}`;
    }

     return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
            <Card className="mx-auto max-w-md w-full z-10 bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
                <CardHeader>
                    <CardTitle>Initialization Error</CardTitle>
                    <CardDescription>
                        {errorMessage}
                    </CardDescription>
                </CardHeader>
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
