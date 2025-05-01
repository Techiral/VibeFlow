
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
         // Ignore "Auth session missing", let logic below handle redirect
       }
       // Let the logic after the try-catch handle the redirect if !user
    } else {
       user = userData.user; // Set user if fetch succeeded

        // --- Fetch profile using RPC function ---
        // This function handles creation if the profile doesn't exist yet.
        const { data: rpcProfileData, error: rpcProfileError } = await supabase
             .rpc('get_user_profile', { p_user_id: user.id });

        if (rpcProfileError) {
             // Check for specific DB setup errors *before* logging
             if (rpcProfileError.message.includes("function public.get_user_profile") && rpcProfileError.message.includes("does not exist")) {
                 errorMessage = "Database setup incomplete: The 'get_user_profile' function is missing. Please run the SQL script in `supabase/schema.sql` located in the project's `supabase` directory. See README Step 3.";
                 isDbSetupError = true;
             } else if (rpcProfileError.message.includes("relation") && rpcProfileError.message.includes("does not exist")) {
                 // This usually means the 'profiles' table is missing
                 errorMessage = "Database setup incomplete: The 'profiles' table is missing. Please run the SQL script in `supabase/schema.sql` located in the project's `supabase` directory. See README Step 3.";
                 isDbSetupError = true;
             } else {
                 errorMessage = `Error initializing user profile: ${rpcProfileError.message}`;
             }
             // If it's a DB setup error or another error we want to display, throw to outer catch
             if (isDbSetupError || errorMessage) throw rpcProfileError;
         }

         // The RPC function `get_user_profile` returns an array (SETOF).
         if (rpcProfileData && Array.isArray(rpcProfileData) && rpcProfileData.length > 0) {
             profile = rpcProfileData[0] as Profile; // Use the first profile returned by the RPC
         } else {
             // This case should ideally not happen if the RPC function works correctly.
             console.warn("get_user_profile RPC returned no data for user:", user.id);
             errorMessage = "Failed to load or initialize user profile. Please try logging out and back in.";
             // Don't throw here, maybe quota will load
         }


         // --- Fetch quota ---
         const { data: quotaData, error: quotaError } = await supabase
           .from('quotas')
           .select('*')
           .eq('user_id', user.id)
           .single();

         if (quotaError) {
           // Check for specific DB setup errors
           if (quotaError.message.includes("relation \"public.quotas\" does not exist") || quotaError.code === '42P01') {
              errorMessage = "Database setup incomplete: The 'quotas' table is missing. Please run the SQL script in `supabase/schema.sql` located in the project's `supabase` directory. See README Step 3.";
              isDbSetupError = true;
           } else if (quotaError.message.includes("permission denied for table quotas")) {
               // More specific RLS error
               errorMessage = "Database access error: Row Level Security policy for the 'quotas' table might be missing or incorrect. Please verify the policies in `supabase/schema.sql` have been applied. See README Step 3.";
               isDbSetupError = true; // Treat as setup error
           } else if (quotaError.message.includes("violates row-level security policy")) {
               // Error related to inserting/updating quota (shouldn't happen on select, but catch just in case)
               errorMessage = "Database security error: An operation on the 'quotas' table violated security policies. Please check the policies in `supabase/schema.sql`. See README Step 3.";
               isDbSetupError = true; // Treat as setup error
           } else if (quotaError.code !== 'PGRST116') { // Ignore 'PGRST116' (no rows found), log others
             // Log only unexpected errors, don't overwrite a profile error message if one exists
             if (!errorMessage) {
                errorMessage = `Error loading usage quota: ${quotaError.message}`;
             }
           }
           // If it's a DB setup error or another error we want to display, throw to outer catch
           if (isDbSetupError || (errorMessage && !errorMessage.includes('profile'))) throw quotaError;
        }
        quota = quotaData;

    }

  } catch (error: any) {
      // Check if it's a redirect error first, and re-throw it if so
      if (error.message === 'NEXT_REDIRECT') {
        throw error; // Re-throw the redirect error
      }
      // Log only if it's NOT a handled DB setup error or config error that we already have a message for.
      if (!errorMessage && !error.message.includes('Auth session missing')) {
         // console.error("Error during Supabase initialization or data fetch:", error.message); // Reduced noise
      }
      initialError = error; // Store the error regardless for potential display

      // Prioritize specific known error messages (only set generic message if not already set by specific checks inside the try block)
      if (!errorMessage) {
          if (error.message.includes("URL and Key are required")) {
             errorMessage = "Supabase URL or Key is missing. Please check your environment variables (`.env.local`) and ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly. Refer to the README for setup instructions.";
          } else if (error.message.includes("Invalid URL")) {
               errorMessage = "Invalid Supabase URL format. Please check the `NEXT_PUBLIC_SUPABASE_URL` in your `.env.local` file. It should look like `https://<your-project-ref>.supabase.co`.";
          } else if (error.message.includes('Auth session missing')) {
              // This is expected if not logged in, ignore here, redirect below will handle it.
          } else if (error.message.includes("relation") && error.message.includes("does not exist")) {
              // Generic catch for missing relations if specific checks failed
              errorMessage = `Database setup incomplete: A required table (${error.message.match(/relation "(.*?)"/)?.[1] || 'unknown'}) is missing. Please run the SQL script in \`supabase/schema.sql\`. See README Step 3.`;
              isDbSetupError = true;
          } else if (error.message.includes("function") && error.message.includes("does not exist")) {
              // Generic catch for missing functions
              errorMessage = `Database setup incomplete: A required function (${error.message.match(/function (.*?)\(/)?.[1] || 'unknown'}) is missing. Please run the SQL script in \`supabase/schema.sql\`. See README Step 3.`;
              isDbSetupError = true;
          } else if (error.message.includes("permission denied for table") || error.message.includes("violates row-level security policy")) {
               errorMessage = `Database security error: Access to a table was denied due to Row Level Security. Please ensure the policies defined in \`supabase/schema.sql\` have been correctly applied. See README Step 3. Details: ${error.message}`;
               isDbSetupError = true; // Treat as setup error
          } else {
               // Generic fallback message for other unexpected errors
               errorMessage = `An unexpected error occurred during application startup: ${error.message}. Please check your Supabase configuration and ensure the database schema is set up correctly (see README Step 3).`;
          }
      }
  }

  // --- Redirect or Show Error/Dashboard ---

  // 1. If no user session exists, redirect to login immediately.
  if (!user) {
     redirect('/login');
  }

  // 2. If user exists BUT there was an error (config or DB setup), show the error card.
  // `errorMessage` will be set if a DB setup issue or config issue was detected.
  if (errorMessage) {
     return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
            <Card className="mx-auto max-w-lg w-full z-10 bg-card/80 backdrop-blur-sm border-destructive/50 shadow-xl">
                <CardHeader>
                    <CardTitle className="text-destructive">{isDbSetupError ? "Database Setup Required" : "Configuration Error"}</CardTitle>
                    <CardDescription className="text-destructive-foreground">
                       {errorMessage}
                    </CardDescription>
                </CardHeader>
                 <CardContent>
                     {isDbSetupError && (
                         <p className="text-sm text-muted-foreground mb-4">
                           Please navigate to the **SQL Editor** section in your Supabase project dashboard. Then, **copy and paste the entire content** of the `supabase/schema.sql` file (located in the `supabase` directory of this project) into the editor and click **Run**. You can find detailed instructions in the project's README file under "Getting Started - Step 3". **Make sure to run the *entire* updated script.**
                         </p>
                     )}
                     {!isDbSetupError && ( // Show technical details for non-setup errors if available
                       <>
                         <p className="text-sm text-muted-foreground">If the problem persists, check your `.env.local` file for correct Supabase keys or consult the console logs.</p>
                         {initialError && (
                            <>
                             <p className="text-sm text-muted-foreground mt-4">Detailed Error:</p>
                             <pre className="mt-2 w-full rounded-md bg-muted p-4 overflow-x-auto text-xs">
                                {initialError.message}
                             </pre>
                            </>
                         )}
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

