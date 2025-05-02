
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Dashboard from '@/components/dashboard/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Profile, Quota } from '@/types/supabase'; // Import specific types

// Revalidate this page every 60 seconds (optional, consider implications)
// export const revalidate = 60;

// Default values for gamification
const DEFAULT_XP = 0;
const DEFAULT_BADGES: string[] = [];

export default async function DashboardPage() {
  let supabase;
  let user = null;
  let profile: Profile | null = null;
  let quota: Quota | null = null;
  let xp: number = DEFAULT_XP; // Initialize XP
  let badges: string[] = DEFAULT_BADGES; // Initialize badges
  let initialError: Error | null = null;
  let errorMessage: string | null = null;
  let isDbSetupError = false;

  try {
    supabase = await createClient();
    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError || !userData.user) {
      if (authError && !authError.message.includes("Auth session missing")) {
        console.error("Auth error:", authError.message);
      }
      // Redirect will happen after the try-catch if user is null
    } else {
      user = userData.user;

      // --- Fetch profile using RPC function ---
      const { data: rpcProfileData, error: rpcProfileError } = await supabase
        .rpc('get_user_profile', { p_user_id: user.id });

      if (rpcProfileError) {
        if (rpcProfileError.message.includes("function public.get_user_profile") && rpcProfileError.message.includes("does not exist")) {
          errorMessage = "Database setup incomplete: The 'get_user_profile' function is missing. Please run the SQL script in `supabase/schema.sql` located in the project's `supabase` directory. See README Step 3.";
          isDbSetupError = true;
        } else if (rpcProfileError.message.includes("relation") && rpcProfileError.message.includes("does not exist")) {
          errorMessage = "Database setup incomplete: The 'profiles' table is missing. Please run the SQL script in `supabase/schema.sql` located in the project's `supabase` directory. See README Step 3.";
          isDbSetupError = true;
        } else {
           // Check for schema cache error specifically for composio_mcp_url
           if (rpcProfileError.message.includes("column") && rpcProfileError.message.includes("composio_mcp_url") && rpcProfileError.message.includes("does not exist")) {
                errorMessage = `Database schema mismatch: The column 'composio_mcp_url' is missing or named incorrectly in the 'profiles' table or 'get_user_profile' function. Please run the latest 'supabase/schema.sql' script.`;
                isDbSetupError = true; // Treat as setup error
           } else {
                errorMessage = `Error initializing user profile: ${rpcProfileError.message}`;
           }
        }
        if (!isDbSetupError) {
          console.error("Error fetching profile:", rpcProfileError.message);
        }
        if (isDbSetupError || errorMessage) throw rpcProfileError;
      }

      // The RPC function `get_user_profile` returns an array (SETOF).
      if (rpcProfileData && Array.isArray(rpcProfileData) && rpcProfileData.length > 0) {
         // Ensure the returned object conforms to the Profile type
         const fetchedProfile = rpcProfileData[0] as Profile;
         // Validate required fields if necessary, though RPC should handle creation
         if (fetchedProfile && fetchedProfile.id) {
              profile = fetchedProfile;
         } else {
             console.warn("get_user_profile RPC returned incomplete data for user:", user.id);
             errorMessage = "Failed to load or initialize user profile data. Please try logging out and back in.";
         }
      } else {
        console.warn("get_user_profile RPC returned no data for user:", user.id);
        errorMessage = "Failed to load or initialize user profile. Please try logging out and back in.";
      }

      // --- Fetch quota ---
      const { data: quotaData, error: quotaError } = await supabase
        .from('quotas')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (quotaError) {
        if (quotaError.message.includes("relation \"public.quotas\" does not exist") || quotaError.code === '42P01') {
          errorMessage = "Database setup incomplete: The 'quotas' table is missing. Please run the SQL script in `supabase/schema.sql` located in the project's `supabase` directory. See README Step 3.";
          isDbSetupError = true;
        } else if (quotaError.message.includes("permission denied for table quotas") || quotaError.code === '42501') {
          errorMessage = "Database access error: Row Level Security policy for the 'quotas' table might be missing or incorrect. Please verify the policies in `supabase/schema.sql` have been applied. See README Step 3.";
          isDbSetupError = true;
        } else if (quotaError.message.includes("violates row-level security policy")) {
            // This specific error for INSERT might indicate an issue with the increment_quota function's SECURITY DEFINER or RLS policies.
           errorMessage = `Database security error: Could not update 'quotas' table due to security policy. Ensure 'increment_quota' function has SECURITY DEFINER and check RLS. Details: ${quotaError.message}`;
           isDbSetupError = true;
        } else if (quotaError.code !== 'PGRST116') { // Ignore 'PGRST116' (no rows found)
          if (!errorMessage) {
            errorMessage = `Error loading usage quota: ${quotaError.message}`;
          }
          console.error("Error fetching quota:", quotaError.message);
        }
         // If it's a DB setup error or another error we want to display, throw to outer catch
         if (isDbSetupError || (errorMessage && !errorMessage.includes('profile'))) {
            // Check if it's the specific RLS violation on insert
            if (quotaError.message.includes("violates row-level security policy")) {
                // Don't throw, but set the error message to be displayed
            } else {
                throw quotaError;
            }
         }
      }
      quota = quotaData;

      // Calculate initial XP and Badges based on quota (can be expanded later)
       if (quota) {
         xp = (quota.request_count || 0) * 10; // Example: 10 XP per request
         // Logic to determine initial badges based on XP or request count
         // This is simplified; a real app might store badges separately
         badges = ['Vibe Starter ✨', 'Content Ninja 🥷'] // Example initial badges
             .filter((_, index) => xp >= [50, 100][index]); // Adjust thresholds as needed
       }

    }

  } catch (error: any) {
    if (error.message === 'NEXT_REDIRECT') {
      throw error;
    }
     if (!errorMessage && !error.message?.includes('Auth session missing')) {
        // Avoid logging the generic "relation does not exist" if we already captured it
        const isKnownSetupError = errorMessage?.includes('Database setup incomplete') || errorMessage?.includes('Database schema mismatch') || errorMessage?.includes('Database access error') || errorMessage?.includes('Database security error');
        if (!isKnownSetupError) {
             if (!error.message?.includes("relation") || !error.message?.includes("does not exist")) {
                 console.error("Error during Supabase initialization or data fetch:", error.message);
             }
        }
     }
    initialError = error;

    // Set error message if not already set by specific checks inside try block
    if (!errorMessage) {
      if (error.message.includes("URL or Key is missing")) {
        errorMessage = "Supabase URL or Key is missing. Please check your environment variables (`.env.local`) and ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set correctly. Refer to the README for setup instructions.";
      } else if (error.message.includes("Invalid URL")) {
        errorMessage = "Invalid Supabase URL format. Please check the `NEXT_PUBLIC_SUPABASE_URL` in your `.env.local` file. It should look like `https://<your-project-ref>.supabase.co`.";
      } else if (error.message?.includes('Auth session missing')) {
        // Handled by redirect below
      } else if ((error.message.includes("relation") || error.message.includes("function")) && error.message.includes("does not exist")) {
        const missingType = error.message.includes("relation") ? "table" : "function";
        const missingName = error.message.match(/(?:relation|function) "?(.*?)"?\.?\(?\S*\)? does not exist/)?.[1] || 'unknown';
        errorMessage = `Database setup incomplete: The required ${missingType} '${missingName}' is missing. Please run the SQL script in \`supabase/schema.sql\`. See README Step 3.`;
        isDbSetupError = true;
      } else if (error.message.includes("permission denied") || error.message.includes("violates row-level security policy")) {
          errorMessage = `Database security error: Access denied. Ensure RLS policies in \`supabase/schema.sql\` are applied. Details: ${error.message}`;
          isDbSetupError = true;
      } else if (error.message.includes("column") && error.message.includes("does not exist") && error.message.includes("schema cache")) {
          const missingColumn = error.message.match(/'(.*?)'/)?.[1];
          errorMessage = `Database schema mismatch: Column '${missingColumn || 'unknown'}' not found. Run the latest 'supabase/schema.sql' script.`;
          isDbSetupError = true;
      } else {
        errorMessage = `An unexpected error occurred: ${error.message}. Check configuration and DB setup (README Step 3).`;
      }
    }
  }

  // --- Redirect or Show Error/Dashboard ---

  if (!user) {
    return redirect('/login');
  }

  if (errorMessage) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
        <Card className="mx-auto max-w-lg w-full z-10 bg-card/80 backdrop-blur-sm border-destructive/50 shadow-xl">
          <CardHeader>
            <CardTitle className="text-destructive">{isDbSetupError ? "Database Setup/Configuration Required" : "Application Error"}</CardTitle>
            <CardDescription className="text-destructive-foreground">
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isDbSetupError && (
              <p className="text-sm text-muted-foreground mb-4">
                Please navigate to the **SQL Editor** section in your Supabase project dashboard. **Copy and paste the entire content** of the `supabase/schema.sql` file from this project into the editor and click **Run**. Ensure you run the *entire updated* script. See README Step 3.
              </p>
            )}
            {!isDbSetupError && initialError && (
              <>
                <p className="text-sm text-muted-foreground">If the problem persists, check your environment variables or console logs.</p>
                <p className="text-sm text-muted-foreground mt-4">Detailed Error:</p>
                <pre className="mt-2 w-full rounded-md bg-muted p-4 overflow-x-auto text-xs">
                  {initialError.message}
                </pre>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pass gamification data along with user, profile, and quota
  return <Dashboard user={user} initialProfile={profile} initialQuota={quota} initialXp={xp} initialBadges={badges} />;
}
