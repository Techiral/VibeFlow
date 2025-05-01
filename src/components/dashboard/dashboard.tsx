
// dashboard.tsx
'use client';

import type { User } from '@supabase/supabase-js';
import type { Profile, Quota } from '@/types/supabase'; // Import specific types
import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { LogOut, Loader2, Bot, Twitter, Linkedin, Youtube, Copy, Send, Wand2, Info, BarChart, User as UserIcon, Database, Zap } from 'lucide-react';
import { summarizeContent, type SummarizeContentOutput } from '@/ai/flows/summarize-content';
import { generateSocialPosts, type GenerateSocialPostsOutput } from '@/ai/flows/generate-social-posts';
import { tuneSocialPosts, type TuneSocialPostsOutput } from '@/ai/flows/tune-social-posts';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from 'next/link';
import { ProfileDialog } from './profile-dialog'; // Import the new dialog
import { Progress } from "@/components/ui/progress"; // Import Progress component

interface DashboardProps {
  user: User;
  initialProfile: Profile | null;
  initialQuota: Quota | null;
}

type SocialPlatform = 'linkedin' | 'twitter' | 'youtube';
type PostDrafts = {
  [key in SocialPlatform]?: string;
};
type TuningStates = {
  [key in SocialPlatform]?: boolean;
};
type PublishStates = {
  [key in SocialPlatform]?: boolean;
};

// Define default quota limit
const DEFAULT_QUOTA_LIMIT = 100;

export default function Dashboard({ user, initialProfile, initialQuota }: DashboardProps) {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [contentInput, setContentInput] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [postDrafts, setPostDrafts] = useState<PostDrafts>({});
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingPosts, setIsGeneratingPosts] = useState(false);
  const [isTuning, setIsTuning] = useState<TuningStates>({});
  const [isPublishing, setIsPublishing] = useState<PublishStates>({});
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [quota, setQuota] = useState<Quota | null>(initialQuota);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [dbSetupError, setDbSetupError] = useState<string | null>(null); // State for DB setup error message

  const quotaUsed = quota?.request_count ?? 0;
  const quotaLimit = quota?.quota_limit ?? DEFAULT_QUOTA_LIMIT;
  const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
  const quotaPercentage = quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0;
  const quotaExceeded = quotaRemaining <= 0 && !!quota; // Only exceeded if quota is loaded

  // Fetch or confirm profile/quota data on client-side if needed
  useEffect(() => {
    const ensureData = async () => {
      let currentProfile = profile;
      let currentQuota = quota;
      let setupErrorMsg: string | null = null;

      // --- Ensure Profile ---
      if (!currentProfile) {
         try {
            // Use RPC function which also creates if not exists
            const { data, error } = await supabase
              .rpc('get_user_profile', { p_user_id: user.id });

             if (error) {
                  console.error("Error fetching/creating profile on client:", error.message); // Log client-side fetch error
                  if (error.message.includes("function public.get_user_profile") && error.message.includes("does not exist")) {
                      setupErrorMsg = "Database setup incomplete: Missing 'get_user_profile' function. Please run the SQL script from `supabase/schema.sql`. See README Step 3.";
                  } else if (error.message.includes("relation \"public.profiles\" does not exist")) {
                     setupErrorMsg = "Database setup incomplete: Missing 'profiles' table. Please run the SQL script from `supabase/schema.sql`. See README Step 3.";
                  } else if (error.message.includes("permission denied")) {
                      setupErrorMsg = "Database access error: Permission denied for profile data. Check Row Level Security policies. See README Step 3.";
                  } else {
                     toast({ title: "Profile Error", description: `Could not load your profile data: ${error.message}`, variant: "destructive" });
                  }
                  if (setupErrorMsg) setDbSetupError(setupErrorMsg); // Set state if setup error found
             } else if (data && Array.isArray(data) && data.length > 0) {
                 currentProfile = data[0] as Profile;
                 setProfile(currentProfile);
             } else {
                 // Should not happen if RPC works, but handle gracefully
                 console.warn("Profile still null/empty after calling get_user_profile on client");
                 toast({ title: "Profile Error", description: "Failed to load profile data. Please refresh.", variant: "destructive" });
             }
         } catch (error: any) { // Catch unexpected errors during RPC call itself
             console.error("Unexpected client error fetching/creating profile:", error.message);
             toast({ title: "Profile Error", description: `Unexpected error: ${error.message}`, variant: "destructive" });
             setupErrorMsg = `Unexpected error loading profile data. Check console. Details: ${error.message}`; // Generic setup error
             setDbSetupError(setupErrorMsg);
         }
      }

      // --- Ensure Quota ---
      // Fetch quota even if profile load failed, to check for quota table issues.
      if (!currentQuota) {
        try {
          // Select specific columns instead of '*'
          const { data, error } = await supabase
            .from('quotas')
            .select('user_id, request_count, quota_limit, last_reset_at')
            .eq('user_id', user.id)
            .single();

          if (error && error.code === 'PGRST116') { // Not found - This is expected on first load before any generation
             // console.log("Quota record not found yet for user:", user.id); // Normal case initially
             // Do nothing, `increment_quota` will create it on first action.
             // Reset potential setup error if profile succeeded but quota just doesn't exist yet
             if (currentProfile && !setupErrorMsg) setDbSetupError(null);
          } else if (error) { // Other error during select
              console.error("Error fetching/creating quota on client:", error.message); // Log client-side fetch error
              if (error.message.includes("relation \"public.quotas\" does not exist")) {
                  setupErrorMsg = "Database setup incomplete: Missing 'quotas' table. Please run the SQL script from `supabase/schema.sql`. See README Step 3.";
              } else if (error.message.includes("permission denied for table quotas")) {
                  setupErrorMsg = "Database access error: Permission denied for 'quotas' table. Check Row Level Security policies. See README Step 3.";
              } else if (error.code === '42501') { // More specific permission denied code
                  setupErrorMsg = "Database access error: Permission denied for 'quotas' table (Code: 42501). Verify RLS policies. See README Step 3.";
              } else if (error.message.includes("406")) { // Handle 406 specifically
                  setupErrorMsg = `Database configuration issue: Could not fetch quota (Error 406 - Not Acceptable). Please check table/column access and RLS policies. See README Step 3. Details: ${error.message}`;
                  toast({ title: "Quota Load Error", description: "Could not retrieve usage data due to a configuration issue (406).", variant: "destructive" });
              } else {
                  toast({ title: "Quota Error", description: `Could not load usage data: ${error.message}`, variant: "destructive" });
                  // Set general error if specific one not found, but don't overwrite profile error
                  if (!setupErrorMsg) setupErrorMsg = `Error loading quota data. Details: ${error.message}`;
              }
              if (setupErrorMsg) setDbSetupError(setupErrorMsg); // Set state if setup error found
          } else { // Select succeeded
              // Ensure all necessary fields are present in the returned data before setting state
              if (data && 'user_id' in data && 'request_count' in data && 'quota_limit' in data && 'last_reset_at' in data) {
                 currentQuota = data as Quota; // Cast after checking required fields
                 setQuota(currentQuota);
                 // Clear setup error if profile and quota loaded successfully
                 if (currentProfile) setDbSetupError(null);
              } else {
                 console.warn("Fetched quota data is missing expected fields:", data);
                 if (!setupErrorMsg) setupErrorMsg = `Incomplete quota data received from database.`;
                 setDbSetupError(setupErrorMsg);
              }
          }
        } catch (error: any) { // Catch unexpected errors
          console.error("Unexpected client error fetching quota:", error.message);
          toast({ title: "Quota Error", description: `Unexpected error: ${error.message}`, variant: "destructive" });
           if (!setupErrorMsg) setupErrorMsg = `Unexpected error loading quota data. Check console. Details: ${error.message}`;
           setDbSetupError(setupErrorMsg);
        }
      } else {
         // Quota was loaded initially, clear potential setup error if profile also loaded
         if (currentProfile && !setupErrorMsg) {
             setDbSetupError(null);
         }
      }

      // Final check: if a setup error was detected at any point, make sure it's set
       if (setupErrorMsg) {
         setDbSetupError(setupErrorMsg);
       }

    };

    // Run ensureData on initial mount or if user changes
    ensureData();
    // Rerun if user.id changes (e.g., logout/login without full refresh)
  }, [user.id, supabase, toast, profile, quota]); // Dependencies


  // Function to handle profile updates from the dialog
  const handleProfileUpdate = (updatedProfile: Profile) => {
    setProfile(updatedProfile);
    // If quota limit can be updated via profile, update it here too
    // setQuota(prev => prev ? { ...prev, quota_limit: updatedProfile.some_new_limit_field ?? DEFAULT_QUOTA_LIMIT } : null);
    toast({ title: "Profile Updated", description: "Your profile information has been saved." });
  };

   // Function to check quota and increment if allowed
  const checkAndIncrementQuota = async (incrementAmount: number = 1): Promise<boolean> => {
     if (dbSetupError) {
         toast({ title: "Database Error", description: `Cannot process request due to database setup issue: ${dbSetupError}`, variant: "destructive" });
         return false;
     }
     // Fetch current quota state directly for the most up-to-date check
     let currentRemaining = quotaRemaining;
     if (quota) {
       // Ensure request_count and quota_limit are numbers before calculating
       const currentCount = typeof quota.request_count === 'number' ? quota.request_count : 0;
       const currentLimit = typeof quota.quota_limit === 'number' ? quota.quota_limit : DEFAULT_QUOTA_LIMIT;
       currentRemaining = Math.max(0, currentLimit - currentCount);
     } else {
        // If quota is not yet loaded, try fetching it once more using the RPC function
        try {
             const { data: fetchedQuotaRemaining, error: fetchError } = await supabase
                 .rpc('get_remaining_quota', { p_user_id: user.id });

             if (fetchError) {
                 console.error("RPC Error checking remaining quota:", fetchError.message); // Log the RPC error
                 // Handle potential errors from get_remaining_quota, especially setup errors
                  if (fetchError.message.includes("function public.get_remaining_quota") && fetchError.message.includes("does not exist")) {
                     setDbSetupError("Database function 'get_remaining_quota' missing. Please run the setup script. See README Step 3.");
                     toast({ title: "Database Error", description: "Failed to check usage limit due to missing function.", variant: "destructive" });
                  } else if (fetchError.message.includes("permission denied")) {
                      setDbSetupError("Database permission error checking quota. Verify RLS for 'get_remaining_quota'. See README Step 3.");
                      toast({ title: "Database Error", description: "Permission denied checking usage limit.", variant: "destructive" });
                  } else {
                      toast({ title: "Quota Check Error", description: `Failed to check usage limit: ${fetchError.message}`, variant: "destructive" });
                  }
                 return false;
             }
             // Assuming get_remaining_quota returns the remaining count directly
             if (typeof fetchedQuotaRemaining === 'number') {
                 currentRemaining = fetchedQuotaRemaining;
                 // Optionally update local quota state if needed, though increment_quota will provide the most accurate final state
             } else {
                 // Fallback if function doesn't return expected value
                 console.warn("get_remaining_quota RPC did not return a number:", fetchedQuotaRemaining);
                 toast({ title: "Quota Check Error", description: "Could not determine remaining usage limit.", variant: "destructive" });
                 return false;
             }

        } catch (rpcError: any) {
             console.error("Unexpected Error calling get_remaining_quota RPC:", rpcError.message);
             toast({ title: "Quota Check Error", description: `Unexpected error checking usage: ${rpcError.message}`, variant: "destructive" });
             return false;
        }
     }


     if (currentRemaining < incrementAmount) {
       toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
       return false;
     }

     // Optimistic UI update (optional but improves UX)
     const optimisticQuota = quota ? { ...quota, request_count: (quota.request_count ?? 0) + incrementAmount } : null;
     if (optimisticQuota) setQuota(optimisticQuota);

    try {
        // Call the RPC function which handles creation, reset, and increment
        const { data: newRemaining, error } = await supabase.rpc('increment_quota', {
           p_user_id: user.id,
           p_increment_amount: incrementAmount
        });

       if (error) {
          // Revert optimistic update on error if it was applied
          if (optimisticQuota) setQuota(quota); // Revert to the state before optimistic update
          console.error("Error incrementing quota RPC:", error.message); // Log RPC error
          if (error.message.includes("quota_exceeded")) {
             toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
             // Ensure local state reflects exceeded quota if possible
             if(quota) setQuota(prev => prev ? {...prev, request_count: prev.quota_limit ?? DEFAULT_QUOTA_LIMIT} : null);
          } else if (error.message.includes("function public.increment_quota") && error.message.includes("does not exist")) {
             setDbSetupError("Database function 'increment_quota' missing. Please run the setup script. See README Step 3.");
             toast({ title: "Database Error", description: "Failed to update usage count due to missing function.", variant: "destructive" });
          } else if (error.message.includes("permission denied")) { // Check for general permission denied
              setDbSetupError("Database permission error incrementing quota. Verify RLS policies for 'increment_quota'. See README Step 3.");
              toast({ title: "Database Security Error", description: "Failed to update usage count due to security policy.", variant: "destructive" });
          } else if (error.message.includes("violates row-level security policy for table \\\"quotas\\\"")) {
             setDbSetupError("RLS policy prevents quota update. Check insert/update policies for 'quotas'. See README Step 3.");
             toast({ title: "Database Security Error", description: "Failed to update usage count due to security policy.", variant: "destructive" });
          } else {
             toast({ title: "Quota Error", description: `Failed to update usage count: ${error.message}`, variant: "destructive" });
          }
          return false;
       }

       // --- Success ---
       // Refetch the full quota record to get the most accurate state after increment
       const { data: updatedQuotaData, error: fetchError } = await supabase
             .from('quotas')
             .select('user_id, request_count, quota_limit, last_reset_at') // Select specific columns
             .eq('user_id', user.id)
             .single();

       if (fetchError){
           console.error("Error fetching quota after increment:", fetchError.message);
           toast({ title: "Quota Update Warning", description: "Usage updated, but failed to refresh full quota details.", variant: "default" });
           // Fallback: Try to update count based on returned remaining value (less reliable for limit/reset time)
            if (typeof newRemaining === 'number' && newRemaining >= 0) {
                 setQuota(prev => {
                    const currentLimit = prev?.quota_limit ?? DEFAULT_QUOTA_LIMIT;
                    const newCount = currentLimit - newRemaining;
                    const nowISO = new Date().toISOString(); // Get current timestamp
                    return prev ?
                        { ...prev, request_count: newCount } :
                        // Construct a basic quota object if none existed
                        { user_id: user.id, request_count: newCount, quota_limit: currentLimit, last_reset_at: nowISO, created_at: nowISO, ip_address: null};
                 });
             }
       } else if (updatedQuotaData) {
           setQuota(updatedQuotaData as Quota); // Set the full updated state from the database
       }

       // Double-check if the operation resulted in exceeding the quota (edge case)
       if (typeof newRemaining === 'number' && newRemaining < 0) {
           toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
           return false;
       }

      return true; // Increment successful
    } catch (rpcError: any) {
        // Revert optimistic update on RPC error
        if (optimisticQuota) setQuota(quota); // Revert to the state before optimistic update
      console.error("Unexpected Error calling increment_quota RPC:", rpcError.message);
      toast({ title: "Quota Error", description: `An unexpected error occurred updating usage: ${rpcError.message}`, variant: "destructive" });
      return false;
    }
  };


  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Error Signing Out", description: error.message, variant: "destructive" });
    } else {
      setProfile(null); // Clear local state on sign out
      setQuota(null);
      setContentInput('');
      setSummary(null);
      setPostDrafts({});
      setDbSetupError(null); // Clear DB error on sign out
      router.push('/login'); // Redirect to login page after sign out
      // router.refresh(); // This might cause issues, push should be enough
    }
  };

 const handleGenerate = async () => {
     // 0. Check DB Setup Error first
     if (dbSetupError) {
        toast({ title: "Database Setup Error", description: dbSetupError, variant: "destructive" });
        return;
     }

     // 1. Check Gemini API Key
    if (!profile?.gemini_api_key) {
       toast({
          title: "API Key Missing",
          description: "Please add your Google Gemini API key in your profile.",
          variant: "destructive",
       });
       setIsProfileDialogOpen(true); // Open profile dialog
       return;
    }

    // 2. Check Input
    if (!contentInput.trim()) {
      toast({ title: "Input Required", description: "Please enter content or a URL.", variant: "destructive" });
      return; // No quota check needed if input is empty
    }


    // 3. Check and Increment Quota (BEFORE starting generation)
     // Cost: 1 for summary + 3 for posts = 4 total
    if (!await checkAndIncrementQuota(4)) {
       return; // Stop if quota check/increment fails
    }

    // --- If quota check passed, proceed ---
    setIsGeneratingSummary(true);
    setIsGeneratingPosts(true);
    setSummary(null);
    setPostDrafts({});

    // Pass API key to the AI flows
    const apiKey = profile.gemini_api_key;
    let summarySuccess = false;
    let postsSuccessCount = 0;
    const totalCostAttempted = 4; // 1 summary + 3 posts


    startTransition(async () => {
        let summaryResult: SummarizeContentOutput | null = null;

        try {
          // 1. Summarize Content
          summaryResult = await summarizeContent({ content: contentInput }, { apiKey });
          if (summaryResult.summary) { // Check if summary is not empty
             console.log("Summarization successful:", summaryResult); // Added console log
             setSummary(summaryResult.summary);
             summarySuccess = true; // Mark summary as successful
          } else {
              // Handle empty summary from AI as an error
               console.warn("Summarization returned an empty result.");
               throw new Error("AI returned an empty summary.");
          }
        } catch (summaryError: any) {
           console.error("Summarization failed:", summaryError);
           let description = "Error summarizing content.";
            if (summaryError.message.includes("parsing")) {
               description = "Could not parse content from the URL. Please check the URL or paste text directly.";
            } else if (summaryError.status === 'UNAUTHENTICATED' || summaryError.message.includes("API key not valid")) {
               description = "Invalid Gemini API Key. Please check your profile.";
               setIsProfileDialogOpen(true); // Prompt user to fix key
            } else if (summaryError.status === 'UNAVAILABLE' || summaryError.message.includes("503") || summaryError.message.toLowerCase().includes("overloaded") || summaryError.message.toLowerCase().includes("service unavailable")) {
                description = "AI service is temporarily overloaded during summarization. Please try again later.";
            } else if (summaryError.status === 'INVALID_ARGUMENT' && summaryError.message.includes("API key is required")) {
                 description = "API Key was missing during generation.";
                 setIsProfileDialogOpen(true); // Should be caught earlier, but handle just in case
            } else if (summaryError.message.includes("empty summary")) {
                 description = "Summarization failed because the AI returned an empty result. Please try again.";
            } else {
                 // Include the original error message for other Genkit errors
                 description = `Summarization failed: ${summaryError.message || 'Unknown AI error'}`;
            }
           toast({ title: "Summarization Failed", description: description, variant: "destructive" });
           // Don't set summary, let finally block handle UI state
        } finally {
            setIsGeneratingSummary(false); // Summary attempt finished
        }

        // 2. Generate Posts (only if summary succeeded)
        if (summarySuccess && summaryResult) {
           const platforms: SocialPlatform[] = ['linkedin', 'twitter', 'youtube'];
          const postPromises = platforms.map(platform =>
            generateSocialPosts({ summary: summaryResult!.summary, platform }, { apiKey })
              .then(result => {
                  if (result.post) { // Check if post is not empty
                     postsSuccessCount++; // Increment success count only if post is valid
                     return { platform, post: result.post };
                  } else {
                     console.warn(`Generation for ${platform} returned an empty post.`);
                     throw new Error(`AI returned an empty post for ${platform}.`); // Treat empty post as error
                  }
              })
              .catch(async (err) => { // Make catch async for potential rollback
                 console.error(`Error generating ${platform} post:`, err);
                  let description = `Error generating ${platform} post.`;
                  if (err.status === 'UNAUTHENTICATED' || err.message.includes("API key not valid")) {
                     description = "Invalid Gemini API Key. Please check your profile."
                     setIsProfileDialogOpen(true);
                  } else if (err.status === 'UNAVAILABLE' || err.message.includes("503") || err.message.toLowerCase().includes("overloaded") || err.message.toLowerCase().includes("service unavailable")) {
                      description = `AI service is temporarily overloaded generating ${platform} post. Please try again later.`;
                  } else if (err.status === 'INVALID_ARGUMENT' && err.message.includes("API key is required")) {
                      description = "API Key was missing during generation.";
                       setIsProfileDialogOpen(true);
                  } else if (err.message.includes("empty post")) {
                       description = `Generation for ${platform} failed because the AI returned an empty result. Please try again.`;
                  } else {
                      description = `Post generation for ${platform} failed: ${err.message || 'Unknown AI error'}`;
                  }
                  toast({ title: "Post Generation Failed", description: description, variant: "destructive" });
                 return { platform, post: `Error generating post for ${platform}.` }; // Return error placeholder
              })
          );

          const results = await Promise.all(postPromises);
          const newDrafts = results.reduce((acc, { platform, post }) => {
            acc[platform] = post;
            return acc;
          }, {} as PostDrafts);
          setPostDrafts(newDrafts);
        } else {
            // If summary failed, clear drafts as well
             setPostDrafts({});
        }

        // --- Final Quota Adjustment ---
         // Calculate cost based *only* on successful generations
         const actualCost = (summarySuccess ? 1 : 0) + postsSuccessCount;
         const refundAmount = totalCostAttempted - actualCost;

         if (refundAmount > 0) {
             console.log(`Refunding ${refundAmount} quota points due to errors.`);
             // Don't check quota again for refund, just attempt decrement
              try {
                  const { error: refundRpcError } = await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -refundAmount });
                  if (refundRpcError) {
                      // Handle refund RPC error separately
                      console.error("Error during quota refund RPC:", refundRpcError.message);
                      toast({ title: "Quota Refund Issue", description: `Failed to process quota refund for failed generations: ${refundRpcError.message}`, variant: "destructive"});
                  } else {
                      // Refetch quota locally after successful refund attempt
                      const { data: refreshedQuota, error: refreshError } = await supabase
                          .from('quotas')
                          .select('user_id, request_count, quota_limit, last_reset_at') // Select specific columns
                          .eq('user_id', user.id)
                          .single();
                      if (!refreshError && refreshedQuota) {
                          setQuota(refreshedQuota as Quota);
                      } else if (refreshError) {
                           console.error("Error refreshing quota after refund:", refreshError.message);
                      }
                  }
              } catch (refundCatchError: any) {
                   console.error("Unexpected Error during quota refund attempt:", refundCatchError.message);
                   toast({ title: "Quota Refund Issue", description: "An unexpected error occurred trying to refund quota.", variant: "destructive"});
              }
         } else if (refundAmount < 0) {
             // This should theoretically not happen if initial check is correct, but log if it does
             console.warn(`Calculated negative refund amount (${refundAmount}). Initial charge might have been incorrect.`);
         }

         setIsGeneratingPosts(false); // All post generation attempts finished
    });
  };

 const handleTunePost = async (platform: SocialPlatform, feedback: string) => {
      // 0. Check DB Setup Error first
     if (dbSetupError) {
        toast({ title: "Database Setup Error", description: dbSetupError, variant: "destructive" });
        return;
     }
    // 1. Check API Key
    if (!profile?.gemini_api_key) {
       toast({ title: "API Key Missing", description: "Please add your Google Gemini API key in your profile.", variant: "destructive" });
       setIsProfileDialogOpen(true);
       return;
    }

     const originalPost = postDrafts[platform];
    if (!originalPost || originalPost.startsWith("Error generating")) {
        toast({ title: "Cannot Tune", description: "Cannot tune a post that failed generation.", variant: "destructive" });
        return;
    }

    // 2. Check and Increment Quota (Cost: 1)
    if (!await checkAndIncrementQuota(1)) {
        return;
    }

    // --- If quota check passed, proceed ---
    setIsTuning(prev => ({ ...prev, [platform]: true }));
    const apiKey = profile.gemini_api_key;
    const totalCostAttempted = 1;
    let tuneSuccess = false;

    startTransition(async () => {
      try {
        const tunedResult = await tuneSocialPosts({ originalPost, feedback }, { apiKey });
        if (tunedResult.tunedPost) { // Check if tuned post is not empty
            setPostDrafts(prev => ({ ...prev, [platform]: tunedResult.tunedPost }));
            toast({ title: "Post Tuned!", description: `Applied feedback: "${feedback}"`, variant: "default" });
            tuneSuccess = true;
        } else {
             console.warn(`Tuning for ${platform} returned an empty post.`);
             throw new Error(`AI returned an empty tuned post for ${platform}.`); // Treat empty post as error
        }
      } catch (error: any) {
        console.error(`Tuning ${platform} post failed:`, error);
         let description = "An error occurred while tuning the post.";
         if (error.status === 'UNAUTHENTICATED' || error.message.includes("API key not valid")) {
             description = "Invalid Gemini API Key. Please check your profile."
             setIsProfileDialogOpen(true);
          } else if (error.status === 'UNAVAILABLE' || error.message.includes("503") || error.message.toLowerCase().includes("overloaded") || error.message.toLowerCase().includes("service unavailable")) {
              description = "AI service is temporarily overloaded. Please try tuning again later.";
          } else if (error.status === 'INVALID_ARGUMENT' && error.message.includes("API key is required")) {
              description = "API Key was missing during tuning.";
              setIsProfileDialogOpen(true);
          } else if (error.message.includes("empty tuned post")) {
              description = `Tuning for ${platform} failed because the AI returned an empty result. Please try again.`;
          } else {
              description = `Post tuning failed: ${error.message || 'Unknown AI error'}`;
          }
        toast({ title: "Tuning Failed", description: description, variant: "destructive" });
      } finally {
        // --- Quota Adjustment for Tuning ---
        const actualCost = tuneSuccess ? 1 : 0;
        const refundAmount = totalCostAttempted - actualCost;

        if (refundAmount > 0) {
          console.log(`Refunding ${refundAmount} quota point for failed tuning.`);
          try {
            const { error: refundRpcError } = await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -refundAmount });
            if (refundRpcError) {
              console.error("Error during quota refund RPC for tuning:", refundRpcError.message);
              toast({ title: "Quota Refund Issue", description: `Failed to process quota refund for failed tuning: ${refundRpcError.message}`, variant: "destructive" });
            } else {
              // Refetch quota locally after successful refund
              const { data: refreshedQuota, error: refreshError } = await supabase
                .from('quotas')
                .select('user_id, request_count, quota_limit, last_reset_at')
                .eq('user_id', user.id)
                .single();
              if (!refreshError && refreshedQuota) {
                setQuota(refreshedQuota as Quota);
              } else if (refreshError) {
                console.error("Error refreshing quota after tuning refund:", refreshError.message);
              }
            }
          } catch (refundCatchError: any) {
            console.error("Unexpected Error during tuning quota refund attempt:", refundCatchError.message);
            toast({ title: "Quota Refund Issue", description: "An unexpected error occurred trying to refund quota for tuning.", variant: "destructive" });
          }
        }
        setIsTuning(prev => ({ ...prev, [platform]: false }));
      }
    });
  };

  const handlePublishPost = async (platform: SocialPlatform) => {
     // 0. Check DB Setup Error first
     if (dbSetupError) {
        toast({ title: "Database Setup Error", description: dbSetupError, variant: "destructive" });
        return;
     }
    // 1. Check Composio URL (if applicable for publishing)
    if (!profile?.composio_url) {
        toast({ title: "Composio URL Missing", description: "Please add your Composio URL in your profile to enable publishing.", variant: "destructive" });
        setIsProfileDialogOpen(true);
        return;
    }

    const postContent = postDrafts[platform];
    if (!postContent || postContent.startsWith("Error generating")) {
         toast({ title: "Cannot Publish", description: "Cannot publish a post that failed generation.", variant: "destructive" });
        return;
    }


     // 2. Check and Increment Quota (assuming publishing costs 1 credit)
     if (!await checkAndIncrementQuota(1)) {
         return;
     }

     // --- If quota check passed, proceed ---
    setIsPublishing(prev => ({ ...prev, [platform]: true }));
    const totalCostAttempted = 1;
    let publishSuccess = false;

    startTransition(async () => {
      try {
        // Placeholder for actual Composio MCP publishing call using profile.composio_url
        console.log(`Publishing to ${platform} via ${profile.composio_url}:`, postContent);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call

        // TODO: Replace with actual API call:
        // await publishPost({ platform, content: postContent, composioUrl: profile.composio_url });

        toast({ title: "Post Published!", description: `Successfully published to ${platform}.`, variant: "default" });
        publishSuccess = true;

      } catch (error: any) {
         console.error(`Publishing to ${platform} failed:`, error);
         let description = "An error occurred while publishing the post.";
          if (error.message.includes("authentication") || error.message.includes("connect")) { // Example error check
              description = `Please connect your ${platform} account via Composio first.`
              // TODO: Add link/button to connect account via Composio OAuth flow (using profile.composio_url?)
          } else if (error.message.includes("invalid Composio URL")) {
               description = "Invalid Composio URL in profile. Please check and update.";
               setIsProfileDialogOpen(true);
          }
        toast({ title: "Publishing Failed", description: description, variant: "destructive" });
      } finally {
         // --- Quota Adjustment for Publishing ---
         const actualCost = publishSuccess ? 1 : 0;
         const refundAmount = totalCostAttempted - actualCost;

         if (refundAmount > 0) {
             console.log(`Refunding ${refundAmount} quota point for failed publishing.`);
             try {
                 const { error: refundRpcError } = await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -refundAmount });
                 if(refundRpcError) {
                     console.error("Error during quota refund RPC for publishing:", refundRpcError.message);
                     toast({ title: "Quota Refund Issue", description: `Failed to process quota refund for failed publishing: ${refundRpcError.message}`, variant: "destructive"});
                 } else {
                     // Refetch quota locally after successful refund
                     const { data: refreshedQuota, error: refreshError } = await supabase
                         .from('quotas')
                         .select('user_id, request_count, quota_limit, last_reset_at')
                         .eq('user_id', user.id)
                         .single();
                     if (!refreshError && refreshedQuota) {
                         setQuota(refreshedQuota as Quota);
                     } else if (refreshError) {
                          console.error("Error refreshing quota after publishing refund:", refreshError.message);
                     }
                 }
             } catch (refundCatchError: any) {
                 console.error("Unexpected Error during publishing quota refund attempt:", refundCatchError.message);
                 toast({ title: "Quota Refund Issue", description: "An unexpected error occurred trying to refund quota for publishing.", variant: "destructive"});
             }
         }
        setIsPublishing(prev => ({ ...prev, [platform]: false }));
      }
   });
  };

  const copyToClipboard = (text: string | undefined) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Copied!", description: "Post content copied to clipboard." }))
      .catch(err => toast({ title: "Copy Failed", description: "Could not copy text.", variant: "destructive" }));
  };


  // Determine if generation/tuning should be globally disabled
  const isDisabled = isPending || quotaExceeded || !!dbSetupError;


  return (
    <TooltipProvider>
    <div className="flex flex-col min-h-screen bg-background text-foreground p-4 md:p-8">
      {/* Header */}
       <header className="flex justify-between items-center mb-6 md:mb-8">
          <Link href="/" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-gradient">VibeFlow</h1>
          </Link>
        <div className="flex items-center gap-3 md:gap-4">
           {/* Quota Display */}
           {dbSetupError ? ( // Show DB Error state first
                <Tooltip>
                   <TooltipTrigger asChild>
                       <div className="flex items-center gap-1 text-sm text-destructive cursor-help" onClick={() => toast({ title: "Database Error", description: dbSetupError, variant: "destructive", duration: 10000 })}>
                           <Database className="h-4 w-4" />
                           <span>DB Error</span>
                       </div>
                   </TooltipTrigger>
                   <TooltipContent><p>Database setup required. Click for details.</p></TooltipContent>
               </Tooltip>
           ) : quota !== null ? ( // If no DB error and quota loaded
             <Tooltip>
               <TooltipTrigger asChild>
                  <div className="flex flex-col items-end cursor-help">
                     <div className="flex items-center gap-1 text-sm text-muted-foreground">
                       <BarChart className="h-4 w-4" />
                       <span>{quotaUsed} / {quotaLimit} used</span>
                     </div>
                      <Progress value={quotaPercentage} className="w-20 h-1 mt-0.5" />
                  </div>
               </TooltipTrigger>
               <TooltipContent side="bottom" align="end">
                 <p>{quotaRemaining} requests remaining this month.</p>
                  {/* Add billing info/link here later */}
               </TooltipContent>
             </Tooltip>
           ) : ( // Loading state (only if no DB error)
               <div className="flex items-center gap-1 text-sm text-muted-foreground">
                   <Loader2 className="h-4 w-4 animate-spin"/>
                   <span>Loading quota...</span>
               </div>
           )}

          {/* Profile Button/Dialog Trigger */}
          <Tooltip>
             <TooltipTrigger asChild>
                 <Button variant="ghost" size="icon" onClick={() => setIsProfileDialogOpen(true)} disabled={!!dbSetupError}> {/* Disable if DB error */}
                   <UserIcon className="h-5 w-5" />
                 </Button>
             </TooltipTrigger>
             <TooltipContent><p>Profile & Settings</p></TooltipContent>
           </Tooltip>

           {/* Sign Out Button */}
          <Tooltip>
             <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleSignOut}>
                  <LogOut className="h-5 w-5" />
                </Button>
             </TooltipTrigger>
             <TooltipContent><p>Sign Out</p></TooltipContent>
          </Tooltip>
        </div>
      </header>

       {/* DB Setup Error Alert */}
       {dbSetupError && (
          <Alert variant="destructive" className="mb-6">
             <Database className="h-4 w-4" /> {/* Changed icon */}
            <AlertTitle>Database Setup Required</AlertTitle>
            <AlertDescription>
              {dbSetupError} Please ensure you have run the **entire updated** SQL script from `supabase/schema.sql` in your Supabase SQL Editor (see README Step 3).
            </AlertDescription>
          </Alert>
        )}


       {/* Quota Exceeded Alert */}
       {quotaExceeded && !dbSetupError && ( // Only show if no DB error
          <Alert variant="destructive" className="mb-6">
             <Info className="h-4 w-4" />
            <AlertTitle>Quota Limit Reached</AlertTitle>
            <AlertDescription>
              You've used all your requests for this month. Please{' '}
                {/* Add link to upgrade/billing page here */}
                <Button variant="link" className="p-0 h-auto text-destructive-foreground underline" onClick={() => setIsProfileDialogOpen(true)}>upgrade your plan</Button>
                {' '}or wait until next month for the quota to reset.
            </AlertDescription>
          </Alert>
        )}

      {/* Main Content Area */}
      <main className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">

        {/* Input Section */}
        <Card className="bg-card/80 border-border/30 shadow-lg flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot className="text-primary" /> Content Input</CardTitle>
            <CardDescription>Enter a URL (article, video) or paste raw text below.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <Textarea
              placeholder="Paste your content or URL here..."
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              className="min-h-[200px] md:min-h-[300px] lg:min-h-[400px] bg-input/50 border-border/50 text-base resize-none h-full" // Make textarea take available height
              disabled={isDisabled} // Use the combined disabled state
              suppressHydrationWarning // Prevent hydration mismatch from browser extensions
            />
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleGenerate}
              disabled={isDisabled || !contentInput.trim() || !profile?.gemini_api_key} // Also disable if key is missing
              loading={isGeneratingSummary || isGeneratingPosts} // Show loading only for generation
              className="w-full md:w-auto ml-auto"
            >
              <Wand2 className="mr-2 h-4 w-4" /> Generate Posts
            </Button>
          </CardFooter>
        </Card>

        {/* Output Section */}
        <Card className="bg-card/80 border-border/30 shadow-lg flex flex-col">
          <CardHeader>
            <CardTitle>Generated Drafts</CardTitle>
            <CardDescription>Review, tune, and publish your social media posts.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow"> {/* Make content area grow */}
             {(isGeneratingSummary || isGeneratingPosts) && (
                <div className="flex h-full items-center justify-center p-10 text-muted-foreground">
                   <Loader2 className="h-8 w-8 animate-spin mr-3" />
                   <span>Generating content...</span>
                </div>
             )}

            {!(isGeneratingSummary || isGeneratingPosts) && !summary && Object.keys(postDrafts).length === 0 && (
                <div className="flex h-full items-center justify-center p-10 text-muted-foreground">
                   <p>{dbSetupError ? "Cannot generate posts due to database setup issue." : "Your generated posts will appear here."}</p>
                </div>
             )}

            {summary && Object.keys(postDrafts).length > 0 && !dbSetupError && ( // Only show tabs if no DB error and we have content
              <Tabs defaultValue="linkedin" className="w-full flex flex-col h-full"> {/* Flex column for tabs */}
                <TabsList className="grid w-full grid-cols-3 bg-muted/50 mb-4 shrink-0"> {/* Prevent list from growing */}
                  <TabsTrigger value="linkedin"><Linkedin className="h-4 w-4 mr-1 inline"/> LinkedIn</TabsTrigger>
                  <TabsTrigger value="twitter"><Twitter className="h-4 w-4 mr-1 inline"/> Twitter</TabsTrigger>
                  <TabsTrigger value="youtube"><Youtube className="h-4 w-4 mr-1 inline"/> YouTube</TabsTrigger>
                </TabsList>

                {/* Make TabsContent grow */}
                {(['linkedin', 'twitter', 'youtube'] as SocialPlatform[]).map((platform) => (
                  <TabsContent key={platform} value={platform} className="flex-grow mt-0">
                    <Card className="bg-background border-border/50 h-full flex flex-col"> {/* Full height card */}
                      <CardContent className="p-4 space-y-4 relative flex-grow"> {/* Content grows */}
                        {isTuning[platform] && (
                           <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-md">
                              <Loader2 className="h-6 w-6 animate-spin text-primary-foreground"/>
                           </div>
                         )}
                         {postDrafts[platform]?.startsWith("Error generating") ? (
                            <div className="flex h-full items-center justify-center text-destructive p-4 border border-dashed border-destructive/50 rounded-md">
                                {postDrafts[platform]}
                            </div>
                         ) : (
                            <Textarea
                              value={postDrafts[platform] || ''}
                              readOnly // Make textarea read-only, tuning happens via buttons
                              className="min-h-[150px] bg-input/30 border-border/30 resize-none text-sm h-full" // Full height textarea
                              suppressHydrationWarning // Prevent hydration mismatch from browser extensions
                            />
                         )}
                        {/* Tuning Buttons (only show if post generated successfully) */}
                        {!postDrafts[platform]?.startsWith("Error generating") && (
                             <div className="flex flex-wrap gap-2 shrink-0 pt-2"> {/* Prevent tuning buttons from growing */}
                              <span className="text-xs text-muted-foreground mr-2 mt-1.5">Tune:</span>
                               <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'Make wittier')} disabled={isDisabled || !postDrafts[platform] || isTuning[platform]}>Witty</Button>
                               <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'More concise')} disabled={isDisabled || !postDrafts[platform] || isTuning[platform]}>Concise</Button>
                               <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'More professional')} disabled={isDisabled || !postDrafts[platform] || isTuning[platform]}>Professional</Button>
                               <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'Add emojis')} disabled={isDisabled || !postDrafts[platform] || isTuning[platform]}>Add Emojis ✨</Button>
                             </div>
                        )}
                      </CardContent>
                       {/* Footer (only show if post generated successfully) */}
                       {!postDrafts[platform]?.startsWith("Error generating") && (
                          <CardFooter className="flex justify-end gap-2 shrink-0 pt-0"> {/* Prevent footer from growing */}
                            <Tooltip>
                               <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(postDrafts[platform])} disabled={!postDrafts[platform] || isPublishing[platform]}>
                                     <Copy className="h-4 w-4" />
                                  </Button>
                               </TooltipTrigger>
                               <TooltipContent><p>Copy Post</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => handlePublishPost(platform)}
                                  disabled={isDisabled || !postDrafts[platform] || !profile?.composio_url || isPublishing[platform]} // Disable if no composio URL or other issues
                                  loading={isPublishing[platform]}
                                  size="sm"
                                >
                                  <Send className="mr-1.5 h-4 w-4" /> Publish to {platform.charAt(0).toUpperCase() + platform.slice(1)}
                                </Button>
                              </TooltipTrigger>
                               <TooltipContent>
                                 {!profile?.composio_url
                                    ? <p>Add Composio URL in profile to publish</p>
                                    : <p>Publish this post (placeholder)</p>
                                 }
                               </TooltipContent>
                            </Tooltip>
                          </CardFooter>
                       )}
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>

      </main>

      {/* Footer (optional) */}
      <footer className="text-center mt-8 text-xs text-muted-foreground">
        Powered by Gemini & Composio | Built for the Hackathon
      </footer>

       {/* Profile Dialog */}
       <ProfileDialog
          isOpen={isProfileDialogOpen}
          onOpenChange={setIsProfileDialogOpen}
          user={user}
          initialProfile={profile}
          initialQuota={quota} // Pass potentially null quota
          onProfileUpdate={handleProfileUpdate}
          dbSetupError={dbSetupError} // Pass DB error status to dialog
        />
    </div>
    </TooltipProvider>
  );
}

