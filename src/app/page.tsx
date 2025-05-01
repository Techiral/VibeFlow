import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Dashboard from '@/components/dashboard/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'; // Import Card components for error display

export default async function Home() {
  // Check if Supabase env vars are set FIRST
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("Supabase URL or Anon Key is missing. Environment variables might not be configured properly.");
    // Render an error component or message directly
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
            <Card className="mx-auto max-w-md w-full z-10 bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
                <CardHeader>
                    <CardTitle>Configuration Error</CardTitle>
                    <CardDescription>
                        The application is missing necessary configuration (Supabase URL or Key). Please contact the administrator.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
  }

  let supabase;
  try {
    supabase = createClient();
  } catch (error: any) {
    console.error("Error creating Supabase client:", error.message);
    // Render an error component or message directly
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
            <Card className="mx-auto max-w-md w-full z-10 bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
                <CardHeader>
                    <CardTitle>Connection Error</CardTitle>
                    <CardDescription>
                        Could not initialize connection to the database. Please contact the administrator. Error: {error.message}
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
  }

  // Try fetching the user *after* confirming the client was created
  let user = null;
  let authError = null;
  try {
      const { data, error } = await supabase.auth.getUser();
      user = data.user;
      authError = error; // Store potential auth error
  } catch (error: any) { // Catch potential errors from getUser itself (less likely but possible)
      console.error("Critical error during user authentication check:", error.message);
      authError = error; // Treat this as an auth error for consistent handling
  }

   if (authError) {
    console.error("Error fetching user:", authError.message);
    // Redirect to login, but include a more specific error if possible
    return redirect(`/login?message=Error+authenticating+user:+${encodeURIComponent(authError.message)}`);
   }


  if (!user) {
    // If there was no error but no user, redirect to login normally
    return redirect('/login');
  }

  // If user is logged in, show the dashboard
  return <Dashboard user={user} />;
}
