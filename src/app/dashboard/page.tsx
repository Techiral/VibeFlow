
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
  let isDbSetupError = false;

  try {
    // Attempt to create client first. This will throw if env vars are missing or URL is invalid.
    supabase = createClient();

    // Try fetching the user *after* confirming the client was created
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData.user) {
       // If there's an auth error OR no user data, redirect to login
       if (authError && !authError.message.includes("Auth session missing")) {
         console.error("Authentication error:", authError.message); // Log other auth errors
       }
       // Let the logic after the try-catch handle the redirect if !user
    } else {
       user = userData.user; // Set user if fetch succeeded

        // Fetch profile and quota only if user exists
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) {
          // Check for specific DB setup errors *before* logging
          if (profileError.message.includes("relation \"public.profiles\" does not exist") || profileError.code === '42P01') {
              errorMessage = "Database setup incomplete: The 'profiles' table is missing. Please run the SQL script in `supabase/schema.sql` as per the README instructions.";
              isDbSetupError = true;
          } else if (profileError.code !== 'PGRST116') { // Ignore 'PGRST116' (no rows found), log others
            // console.error("Error fetching profile:", profileError.message); // Removed: Log only unexpected errors
            errorMessage = `Error loading user profile: ${profileError.message}`;
          }
          // If it's a DB setup error or another error we want to display, throw to outer catch
          if (isDbSetupError || errorMessage) throw profileError;
        }
        profile = profileData;

        const { data: quotaData, error: quotaError } = await supabase
          .from('quotas')
          .select('*')
          .eq('user_id', user.id)
          .single();

         if (quotaError) {
           // Check for specific DB setup errors *before* logging
           if (quotaError.message.includes("relation \"public.quotas\" does not exist") || quotaError.code === '42P01') {
              errorMessage = "Database setup incomplete: The 'quotas' table is missing. Please run the SQL script in `supabase/schema.sql` as per the README instructions.";
              isDbSetupError = true;
           } else if (quotaError.code !== 'PGRST116') { // Ignore 'PGRST116' (no rows found), log others
             // console.error("Error fetching quota:", quotaError.message); // Removed: Log only unexpected errors
             errorMessage = `Error loading usage quota: ${quotaError.message}`;
           }
           // If it's a DB setup error or another error we want to display, throw to outer catch
           if (isDbSetupError || errorMessage) throw quotaError;
        }
        quota = quotaData;

        // If profile or quota is null, it might be the first login, handle in Dashboard component or create here
        if (!profile && !isDbSetupError) { // Only try creating if DB seems set up
           console.log("Profile not found for user:", user.id, "Likely first login.");
           // Use the RPC function which handles creation
            const { data: rpcProfileData, error: rpcProfileError } = await supabase
                .rpc('get_user_profile', { p_user_id: user.id });

            if (rpcProfileError) {
                 // Check for specific DB setup errors *before* logging
                 if (rpcProfileError.message.includes("function public.get_user_profile") && rpcProfileError.message.includes("does not exist")) {
                     errorMessage = "Database setup incomplete: The 'get_user_profile' function is missing. Please run the SQL script in `supabase/schema.sql` as per the README instructions.";
                     isDbSetupError = true;
                 } else {
                    // console.error("Error calling get_user_profile RPC:", rpcProfileError.message); // Removed: Log unexpected errors
                    errorMessage = `Error initializing user profile: ${rpcProfileError.message}`;
                 }
                 // If it's a DB setup error or another error we want to display, throw to outer catch
                 if (isDbSetupError || errorMessage) throw rpcProfileError;
            }
             // The RPC function `get_user_profile` returns an array (SETOF).
             // Check if the array is empty or if the first element is null.
             if (rpcProfileData && Array.isArray(rpcProfileData) && rpcProfileData.length > 0) {
                 profile = rpcProfileData[0] as Profile; // Use the first profile returned by the RPC
             } else {
                 // This case should ideally not happen if the RPC function works correctly (inserts if not found).
                 // Log a warning if profile is still unexpectedly null.
                 console.warn("get_user_profile RPC returned no data for user:", user.id);
                 errorMessage = "Failed to initialize user profile. Please try logging out and back in.";
                 throw new Error(errorMessage); // Throw to trigger the error display logic
             }
        }

        if (!quota && !isDbSetupError) { // Only try creating if DB seems set up
           console.log("Quota not found for user:", user.id, "Likely first login.");
             const { data: newQuota, error: createQuotaError } = await supabase
                .from('quotas')
                .insert({ user_id: user.id }) // Let DB handle defaults
                .select()
                .single();

            if (createQuotaError) {
                 // Check if this error is also due to missing table, although less likely if profiles worked
                 if (createQuotaError.message.includes("relation \"public.quotas\" does not exist")) {
                    errorMessage = "Database setup incomplete: The 'quotas' table is missing. Please run the SQL script in `supabase/schema.sql` as per the README instructions.";
                    isDbSetupError = true;
                 } else {
                    // console.error("Error creating initial quota:", createQuotaError.message); // Removed: Log unexpected errors
                    errorMessage = `Error initializing usage quota: ${createQuotaError.message}`;
                 }
                 // If it's a DB setup error or another error we want to display, throw to outer catch
                if (isDbSetupError || errorMessage) throw createQuotaError;
            }
            quota = newQuota; // Use the newly created quota
        }
    }

  } catch (error: any) {
      // Log only if it's NOT a handled DB setup error that we already have a message for.
      // Also skip logging NEXT_REDIRECT errors which are handled internally by Next.js
      if (!errorMessage && error.message !== 'NEXT_REDIRECT') {
        console.error("Error during Supabase initialization or data fetch:", error.message);
      }
      initialError = error; // Store the error regardless for potential display

      // Prioritize specific known error messages
      if (!errorMessage) { // Only set generic message if not already set by specific DB checks inside the try block
          if (error.message.includes("URL and Key are required")) {
             errorMessage = "Supabase URL or Key is missing. Please check your environment variables (`.env.local`) and ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly. Refer to the README for setup instructions.";
          } else if (error.message.includes("Invalid URL")) {
               errorMessage = "Invalid Supabase URL format. Please check the `NEXT_PUBLIC_SUPABASE_URL` in your `.env.local` file. It should look like `https://<your-project-ref>.supabase.co`.";
          } else if (error.message !== 'NEXT_REDIRECT') { // Don't show generic message for redirects
               // Generic fallback message (if not already set by DB checks)
               errorMessage = `An unexpected error occurred during application startup: ${error.message}. Please check your Supabase configuration and ensure the database schema is set up correctly (see README).`;
          }
      }
  }

  // --- Redirect or Show Error/Dashboard ---

  // 1. If no user session exists, redirect to login immediately.
  if (!user) {
     console.log("No user session found, redirecting to login.");
     redirect('/login');
  }

  // 2. If user exists BUT there was an error (config or DB setup), show the error card.
  // `errorMessage` will be set if a DB setup issue or config issue was detected.
  if (errorMessage) {
     return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
            <Card className="mx-auto max-w-md w-full z-10 bg-card/80 backdrop-blur-sm border-destructive/50 shadow-xl">
                <CardHeader>
                    <CardTitle className="text-destructive">{isDbSetupError ? "Database Setup Required" : "Configuration Error"}</CardTitle>
                    <CardDescription className="text-destructive-foreground">
                       {errorMessage}
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                     {isDbSetupError && (
                         <p className="text-sm text-muted-foreground mb-4">
                           Please go to the Supabase SQL Editor in your project dashboard and run the entire script from the `supabase/schema.sql` file. You can find detailed instructions in the project's README file under "Getting Started - Step 3".
                         </p>
                     )}
                     {initialError && !isDbSetupError && initialError.message !== 'NEXT_REDIRECT' && ( // Show technical details for non-setup/non-redirect errors
                       <>
                         <p className="text-sm text-muted-foreground">Detailed Error:</p>
                         <pre className="mt-2 w-full rounded-md bg-muted p-4 overflow-x-auto text-sm">
                            {initialError.message}
                         </pre>
                       </>
                     )}
                 </CardContent>
            </Card>
        </div>
    );
  }

  // 3. If user exists and NO error message is set, show the dashboard.
  // Pass user, profile, and quota data. Handle potential null profile/quota in the Dashboard component.
  return <Dashboard user={user!} initialProfile={profile} initialQuota={quota} />;
}
