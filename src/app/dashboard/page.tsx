
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Dashboard from '@/components/dashboard/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Profile, Quota } from '@/types/supabase'; // Import specific types

// Revalidate this page every 60 seconds
// export const revalidate = 60; // Removed revalidation for now, may cause issues with redirects

export default async function DashboardPage() {
  let supabase;
  let user = null;
  let profile: Profile | null = null; // Type for profile
  let quota: Quota | null = null;     // Type for quota
  let initialError: Error | null = null;
  let errorMessage: string | null = null;

  try {
    // Attempt to create client first. This will throw if env vars are missing or URL is invalid.
    supabase = createClient();

    // Try fetching the user *after* confirming the client was created
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData.user) {
       // If there's an auth error OR no user data, redirect to login
       // No need to log "Auth session missing" as it's the expected case
       if (authError && !authError.message.includes("Auth session missing")) {
         console.error("Authentication error:", authError.message); // Log other auth errors
       }
       // Don't throw redirect here, let the code below handle it
       // throw redirect('/login'); // This causes NEXT_REDIRECT error in catch
    } else {
       user = userData.user; // Set user if fetch succeeded

        // Fetch profile and quota only if user exists
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError && profileError.code !== 'PGRST116') { // Ignore 'PGRST116' (no rows found) for now
          console.error("Error fetching profile:", profileError.message);
          errorMessage = `Error loading user profile: ${profileError.message}`;
          throw profileError; // Throw to be caught below
        }
        profile = profileData;

        const { data: quotaData, error: quotaError } = await supabase
          .from('quotas')
          .select('*')
          .eq('user_id', user.id)
          .single();

         if (quotaError && quotaError.code !== 'PGRST116') { // Ignore 'PGRST116' (no rows found)
          console.error("Error fetching quota:", quotaError.message);
          errorMessage = `Error loading usage quota: ${quotaError.message}`;
          throw quotaError; // Throw to be caught below
        }
        quota = quotaData;

        // If profile or quota is null, it might be the first login, handle in Dashboard component or create here
        if (!profile) {
           console.log("Profile not found for user:", user.id, "Likely first login.");
           // Potential: Create a default profile here if needed, or handle in component
        }
        if (!quota) {
           console.log("Quota not found for user:", user.id, "Likely first login.");
            // Potential: Create a default quota record here if needed, or handle in component
             const { data: newQuota, error: createQuotaError } = await supabase
                .from('quotas')
                .insert({ user_id: user.id }) // Let DB handle defaults for count, limit, reset_at
                .select()
                .single();

            if (createQuotaError) {
                console.error("Error creating initial quota:", createQuotaError.message);
                errorMessage = `Error initializing usage quota: ${createQuotaError.message}`;
                throw createQuotaError;
            }
            quota = newQuota; // Use the newly created quota
        }
    }

  } catch (error: any) {
      // Log the underlying error for debugging purposes
      console.error("Error during Supabase initialization or data fetch:", error.message);
      initialError = error; // Store the error to potentially display

      // Determine the specific error message for configuration issues
      if (error.message.includes("URL and Key are required")) {
         errorMessage = "Supabase URL or Key is missing. Please check your environment variables (`.env.local`) and ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly. Refer to the README for setup instructions.";
      } else if (error.message.includes("Invalid URL")) {
           errorMessage = "Invalid Supabase URL format. Please check the `NEXT_PUBLIC_SUPABASE_URL` in your `.env.local` file. It should look like `https://<your-project-ref>.supabase.co`.";
      } else if (!errorMessage) { // If not already set by profile/quota errors
           // Handle other potential errors
           errorMessage = `An unexpected error occurred during application startup: ${error.message}. Please contact the administrator or check your Supabase configuration.`;
      }
  }

  // Redirect to login if user fetch failed OR if there was an initial setup error
  if (!user || (initialError && !errorMessage?.includes("loading"))) { // Redirect on critical errors, but not profile/quota load issues initially
    // Ensure redirect happens outside the try block if auth failed initially
     if (!user && !initialError) { // Case where auth just failed silently
        console.log("No user session found, redirecting to login.");
     }
    redirect('/login');
  }


  // Display specific error card ONLY if there's a configuration error message set
  if (initialError && (errorMessage?.includes("Supabase URL or Key") || errorMessage?.includes("Invalid Supabase URL"))) {
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

  // If user is logged in and critical setup is ok, show the dashboard
  // Pass user, profile, and quota data. Handle potential null profile/quota in the Dashboard component.
  return <Dashboard user={user} initialProfile={profile} initialQuota={quota} />;
}
