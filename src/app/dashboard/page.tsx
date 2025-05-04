import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Dashboard from '@/components/dashboard/dashboard'; // Ensure this path is correct
import type { Profile, Quota, UserProfileFunctionReturn } from '@/types/supabase';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

// Helper function to parse JSON safely
function safeJsonParse<T>(jsonString: string | null): T | null {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    return null;
  }
}

export default async function DashboardPage() {
  let supabase;
  let user = null;
  let profile: UserProfileFunctionReturn | null = null;
  let quota: Quota | null = null;
  let initialError: Error | null = null;
  let errorMessage: string | null = null;
  let isDbSetupError = false; // Flag for DB setup specific errors

  try {
    supabase = await createClient();

    const { data: userData, error: authError } = await supabase.auth.getUser();

    if (authError) {
       // Check if it's an expected auth error vs. a critical connection error
       if (authError.message.includes("Auth session missing") || authError.message.includes("Unauthorized")) {
            // This is an expected case if the user isn't logged in, log info and redirect silently
            console.log("Auth session missing, redirecting to login.");
            return redirect('/login');
       } else {
           // Log other auth errors as actual errors
           console.error("Authentication error:", authError.message);
           errorMessage = `Authentication error: ${authError.message}`;
           // Don't assign initialError here, as we want to show the specific auth message
       }
       // If it's not a silent redirect case, we fall through to display the error
    } else if (!userData?.user) {
      console.log("No user session found, redirecting to login.");
      return redirect('/login');
    } else {
        user = userData.user;

        // Fetch profile using the function - Expects an array, take the first element
        const { data: profileDataArray, error: profileError } = await supabase
        .rpc('get_user_profile', { p_user_id: user.id }); // Use the user ID

        if (profileError) {
          console.error("Error fetching profile:", profileError.message);
          if (profileError.message.includes("relation \"public.profiles\" does not exist") || profileError.code === '42P01') {
              errorMessage = "Database setup incomplete: The 'profiles' table is missing. Please run the SQL script in `supabase/schema.sql` as per the README instructions.";
              isDbSetupError = true;
          } else if (profileError.message.includes("function public.get_user_profile does not exist")) {
              errorMessage = "Database setup incomplete: The 'get_user_profile' function is missing. Please run the SQL script in `supabase/schema.sql` as per the README instructions.";
              isDbSetupError = true;
          } else {
               errorMessage = `Error loading profile: ${profileError.message}. Please ensure the database schema is up-to-date (README Step 3).`;
               // Consider if this should be a DbSetupError as well
          }
           // Set profile to null or an empty object if fetching fails, depending on how Dashboard handles it
           profile = null;
        } else if (!profileDataArray || profileDataArray.length === 0) {
           // This case *should* be handled by get_user_profile upserting, but handle it defensively
            console.warn("Profile not found and could not be created for user:", user.id);
            errorMessage = "Failed to load or initialize user profile. Please try logging out and back in or check DB schema (README Step 3).";
            // isDbSetupError = true; // This might indicate a db setup issue too
            profile = null;
        } else {
            profile = profileDataArray[0]; // Get the first profile from the array
            console.log("Profile loaded successfully:", profile?.username);
             // Check if Gemini API key is missing *after* successfully loading profile
             if (!profile?.gemini_api_key) {
                 // Don't set errorMessage here, let the Dashboard component handle prompting the user
                 console.log("User profile loaded, but Gemini API key is missing.");
             }
        }


         // Fetch quota only if profile fetch was somewhat successful (no major DB setup error)
         if (!isDbSetupError && user?.id) {
             const { data: quotaData, error: quotaError } = await supabase
                .from('quotas')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle(); // Use maybeSingle to handle 0 or 1 row gracefully

             if (quotaError) {
                console.error("Error fetching quota:", quotaError.message);
                 if (quotaError.message.includes("relation \"public.quotas\" does not exist") || quotaError.code === '42P01') {
                      errorMessage = (errorMessage ? errorMessage + "\n" : "") + "Database setup incomplete: The 'quotas' table is missing. Please run the SQL script.";
                      isDbSetupError = true;
                 } else if (quotaError.message.includes('JSON object requested, multiple (or no) rows returned') && !quotaData){
                     // This specific error with !quotaData indicates no row found, which we handle below
                     console.log("Quota record not found for user (PGRST116 equivalent), attempting to create default.");
                 } else {
                     errorMessage = (errorMessage ? errorMessage + "\n" : "") + `Error loading usage quota: ${quotaError.message}. Check DB schema.`;
                 }
                 quota = null; // Ensure quota is null if there was an error other than 'not found'
             }

             // Handle case where no quota record exists (either no row found or specific error handled above)
             if (!quotaData && !quotaError?.message.includes("relation \"public.quotas\" does not exist")) { // Check !quotaData AND it wasn't a 'table missing' error
                  console.log("Quota record not found for user, attempting to create default.");
                  // Attempt to create a default quota record if none exists
                  const { data: newQuota, error: insertQuotaError } = await supabase
                      .from('quotas')
                      .insert({ user_id: user.id, request_count: 0, quota_limit: 100, last_reset_at: new Date().toISOString() })
                      .select()
                      .single(); // Expect the newly inserted row

                   if (insertQuotaError) {
                      console.error("Error creating default quota:", insertQuotaError.message);
                      // This might indicate RLS issues or other DB problems
                       errorMessage = (errorMessage ? errorMessage + "\n" : "") + `Error initializing usage quota: ${insertQuotaError.message}`;
                       if (insertQuotaError.message.includes("violates row-level security policy")) {
                            errorMessage = (errorMessage ? errorMessage + "\n" : "") + "Database permissions error: Could not create initial quota record due to RLS policy. Please check Supabase policies for the 'quotas' table.";
                            isDbSetupError = true; // Treat RLS issue as a setup error
                       }
                       quota = null;
                   } else {
                      console.log("Default quota created successfully.");
                      quota = newQuota;
                   }

             } else if (quotaData) { // If quotaData exists (fetched successfully)
                 quota = quotaData;
                 console.log("Quota loaded successfully:", quota.request_count, "/", quota.quota_limit);
             }
         }
    }
  } catch (error: any) {
      // Catch errors from createClient or other unexpected issues
       if (error.message.includes('NEXT_REDIRECT')) {
        // Don't log redirect errors, just re-throw them
        throw error;
      }
      console.error("Error during Supabase initialization or data fetch:", error.message);
      initialError = error; // Store the error

      // Prioritize specific known error messages
      if (error.message.includes("URL or Key is missing")) {
         errorMessage = "Configuration Error: Supabase URL or Key is missing in environment variables (.env.local). Please contact the administrator.";
      } else if (error.message.includes("Invalid URL")) {
         errorMessage = "Configuration Error: Invalid Supabase URL format in environment variables (.env.local). Please contact the administrator.";
      } else if (profileError && (profileError.message.includes("relation \"public.profiles\" does not exist") || profileError.code === '42P01')) {
         errorMessage = "Database setup incomplete: The 'profiles' table is missing. Please run the SQL script in `supabase/schema.sql`.";
         isDbSetupError = true;
      } else if (quotaError && (quotaError.message.includes("relation \"public.quotas\" does not exist") || quotaError.code === '42P01')) {
          errorMessage = (errorMessage ? errorMessage + "\n" : "") + "Database setup incomplete: The 'quotas' table is missing. Please run the SQL script.";
          isDbSetupError = true;
      } else if (profileError && profileError.message.includes("function public.get_user_profile does not exist")) {
           errorMessage = "Database setup incomplete: The 'get_user_profile' function is missing. Please run the SQL script.";
           isDbSetupError = true;
      } else if (!errorMessage) { // If no specific error message was already set
         errorMessage = `An unexpected error occurred: ${error.message}. Please try again later or contact support.`;
      }
  }

  // If there's a critical initial error (config issue) or DB setup error, show a specific error UI
  if (initialError || isDbSetupError) {
    return (
       <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
         <Alert variant="destructive" className="max-w-2xl">
           <AlertCircle className="h-4 w-4" />
           <AlertTitle>{isDbSetupError ? "Database Setup Required" : "Configuration Error"}</AlertTitle>
           <AlertDescription>
             <p className="mb-4">{errorMessage}</p>
             {isDbSetupError && (
               <p className="text-sm text-muted-foreground">
                 Please go to the Supabase SQL Editor in your project dashboard and run the entire script from the <code>supabase/schema.sql</code> file. You can find detailed instructions in the project's README file under "Getting Started - Step 3". Ensure the script runs successfully without errors.
               </p>
             )}
              {initialError && !isDbSetupError && (
                 <p className="text-sm text-muted-foreground">
                    Please check your <code>.env.local</code> file and ensure <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> are correctly set.
                 </p>
              )}
              {/* Optional: Add a button to try reloading or go to login */}
               <div className="mt-4">
                   <a href="/login" className="text-sm underline">Go to Login</a>
               </div>
           </AlertDescription>
         </Alert>
       </div>
    );
  }


  // If user is null even after checks (shouldn't happen if redirect worked), redirect
  if (!user) {
     console.error("Dashboard reached without a valid user session after initial checks. Redirecting.");
     return redirect('/login?message=Session invalid. Please log in again.');
  }

  // If profile or quota fetch failed but it wasn't a DB setup/config error,
  // pass the potentially null data to the Dashboard component to handle display.
  // The Dashboard component should check for null profile/quota and display appropriate messages.
  if (!profile || !quota) {
      console.warn("Dashboard loading with incomplete data (profile or quota might be null).");
      // We proceed, the Dashboard component must handle null states gracefully.
       if (!profile) errorMessage = (errorMessage ? errorMessage + "\n" : "") + "Failed to load profile data.";
       if (!quota) errorMessage = (errorMessage ? errorMessage + "\n" : "") + "Failed to load quota data.";
  }


  return (
    <Dashboard
      user={user}
      initialProfile={profile} // Pass potentially null profile
      initialQuota={quota} // Pass potentially null quota
      // Pass initial XP and badges, handling null case
      initialXp={profile?.xp ?? 0}
      initialBadges={profile?.badges ?? []}
      dbSetupError={isDbSetupError} // Pass the flag
      serverErrorMessage={errorMessage} // Pass any non-DB setup error message
    />
  );
}