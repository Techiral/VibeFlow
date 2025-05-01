
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
import { LogOut, Loader2, Bot, Twitter, Linkedin, Youtube, Copy, Send, Wand2, Info, BarChart, User as UserIcon, Database, Zap } from 'lucide-react'; // Added UserIcon, Database icon, Zap
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
                  if (error.message.includes("function public.get_user_profile") && error.message.includes("does not exist")) {
                      setupErrorMsg = "Database function 'get_user_profile' missing. Please run the setup script from `supabase/schema.sql`. See README.";
                  } else if (error.message.includes("relation") && error.message.includes("does not exist")) {
                     // This might mean profiles table is missing, which get_user_profile also needs
                     setupErrorMsg = "Database table 'profiles' missing. Please run the setup script from `supabase/schema.sql`. See README.";
                  } else {
                     toast({ title: "Profile Error", description: `Could not load your profile data: ${error.message}`, variant: "destructive" });
                  }
                  if (setupErrorMsg) setDbSetupError(setupErrorMsg);
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
             setupErrorMsg = "Unexpected error loading profile data."; // Generic setup error
             setDbSetupError(setupErrorMsg);
         }
      }

      // --- Ensure Quota ---
      // We assume the quota record is created by the trigger or the increment function.
      // We just fetch it here. If it's missing initially, increment_quota will handle creation later.
      if (!currentQuota) {
        try {
          const { data, error } = await supabase
            .from('quotas')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (error && error.code === 'PGRST116') { // Not found - This is expected on first load before any generation
             // console.log("Quota record not found yet for user:", user.id); // Normal case initially
             // Do nothing, `increment_quota` will create it on first action.
          } else if (error) { // Other error during select
              if (error.message.includes("relation \"public.quotas\" does not exist")) {
                  setupErrorMsg = "Database table 'quotas' missing. Please run the setup script from `supabase/schema.sql`. See README.";
              } else {
                  toast({ title: "Quota Error", description: `Could not load usage data: ${error.message}`, variant: "destructive" });
                  if (!setupErrorMsg) setupErrorMsg = "Error loading quota data."; // Set general error if specific one not found
              }
              if (setupErrorMsg) setDbSetupError(setupErrorMsg);
          } else { // Select succeeded
              currentQuota = data;
              setQuota(currentQuota);
          }
        } catch (error: any) { // Catch unexpected errors
          console.error("Unexpected client error fetching quota:", error.message);
          toast({ title: "Quota Error", description: `Unexpected error: ${error.message}`, variant: "destructive" });
           if (!setupErrorMsg) setupErrorMsg = "Unexpected error loading quota data.";
           setDbSetupError(setupErrorMsg);
        }
      }

      // If any setup error was detected, ensure it's reflected in the state
       if (setupErrorMsg) {
         setDbSetupError(setupErrorMsg);
       }

    };

    // Only run ensureData if initialProfile or initialQuota was null
    if (!initialProfile || !initialQuota) {
        ensureData();
    }
    // We still listen to user.id changes in case of user switch without full page reload
  }, [user.id, supabase, toast, initialProfile, initialQuota, profile, quota]); // Rerun if needed


  // Function to handle profile updates from the dialog
  const handleProfileUpdate = (updatedProfile: Profile) => {
    setProfile(updatedProfile);
    // If quota limit can be updated via profile, update it here too
    // setQuota(prev => ({ ...prev, quota_limit: updatedProfile.some_new_limit_field ?? DEFAULT_QUOTA_LIMIT }));
    toast({ title: "Profile Updated", description: "Your profile information has been saved." });
  };

   // Function to check quota and increment if allowed
  const checkAndIncrementQuota = async (incrementAmount: number = 1): Promise<boolean> => {
     if (dbSetupError) {
         toast({ title: "Database Error", description: "Cannot process request due to database setup issue. Please run the SQL script from the README.", variant: "destructive" });
         return false;
     }
     // It's possible quota is still null if user hasn't done anything yet.
     // The increment_quota function handles the initial creation.

     // Check if quota *is* loaded and *is* exceeded
     if (quota && quotaExceeded) {
       toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
       return false;
     }

     // Optimistic UI update (optional but improves UX)
     // Only update optimistically if quota is already loaded
     const optimisticQuota = quota ? { ...quota, request_count: quota.request_count + incrementAmount } : null;
     if (optimisticQuota) setQuota(optimisticQuota);

    try {
        // Call the RPC function which handles creation, reset, and increment
        const { data: newRemaining, error } = await supabase.rpc('increment_quota', {
           p_user_id: user.id,
           p_increment_amount: incrementAmount
        });

       if (error) {
          // Revert optimistic update on error if it was applied
          if (optimisticQuota) setQuota(quota);
          console.error("Error incrementing quota:", error.message);
          if (error.message.includes("quota_exceeded")) {
             toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
             // Ensure local state reflects exceeded quota if possible
             if(quota) setQuota(prev => prev ? {...prev, request_count: prev.quota_limit} : null);
          } else if (error.message.includes("function public.increment_quota") && error.message.includes("does not exist")) {
             setDbSetupError("Database function 'increment_quota' missing. Please run the setup script. See README.");
             toast({ title: "Database Error", description: "Failed to update usage count due to missing function.", variant: "destructive" });
          } else if (error.message.includes("Failed to create or find quota record")) {
              // This might happen if the INSERT policy is missing or failed
              setDbSetupError("Failed to initialize quota record. Check RLS policies for 'quotas' table.");
              toast({ title: "Database Error", description: "Failed to initialize usage data. Check database setup.", variant: "destructive" });
          } else {
             toast({ title: "Quota Error", description: `Failed to update usage count: ${error.message}`, variant: "destructive" });
          }
          return false;
       }

       // --- Success ---
       // The RPC returns the new *remaining* quota. Update local state accurately.
       if (typeof newRemaining === 'number') {
            // Fetch the potentially updated quota record (including last_reset_at and limit)
            const { data: updatedQuotaData, error: fetchError } = await supabase
               .from('quotas')
               .select('*')
               .eq('user_id', user.id)
               .single();

            if (fetchError){
                console.error("Error fetching quota after increment:", fetchError.message);
                toast({ title: "Quota Update Warning", description: "Usage updated, but failed to refresh full quota details.", variant: "default" });
                // Fallback: update count based on remaining, keep old limit/reset time
                 setQuota(prev => prev ?
                    { ...prev, request_count: prev.quota_limit - newRemaining } :
                    { user_id: user.id, request_count: DEFAULT_QUOTA_LIMIT - newRemaining, quota_limit: DEFAULT_QUOTA_LIMIT, last_reset_at: new Date().toISOString(), created_at: new Date().toISOString(), ip_address: null} // Basic fallback structure
                 );

            } else if (updatedQuotaData) {
                setQuota(updatedQuotaData); // Set the full updated state
            }

           if (newRemaining < 0) { // Should be caught by DB, but double-check
               toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
               return false; // Treat as failure if somehow negative remaining
           }
       } else {
            // Fallback: refetch quota state if RPC doesn't return remaining (less ideal)
            console.warn("increment_quota RPC did not return a number. Refetching quota.");
            const { data: refreshedQuota, error: refreshError } = await supabase
                .from('quotas')
                .select('*')
                .eq('user_id', user.id)
                .single();
            if (refreshError) {
                 toast({ title: "Quota Error", description: "Failed to refresh usage data after update.", variant: "destructive" });
            } else {
                setQuota(refreshedQuota);
            }
       }

      return true; // Increment successful
    } catch (rpcError: any) {
        // Revert optimistic update on RPC error
        if (optimisticQuota) setQuota(quota);
      console.error("RPC Error incrementing quota:", rpcError.message);
      toast({ title: "Quota Error", description: `An unexpected error occurred updating usage: ${rpcError.message}`, variant: "destructive" });
      return false;
    }
  };


  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Error Signing Out", description: error.message, variant: "destructive" });
    } else {
      router.push('/login'); // Redirect to login page after sign out
      router.refresh(); // Refresh server components
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

    startTransition(async () => {
        let summarySuccess = false;
        let postsSuccessCount = 0;
        const platforms: SocialPlatform[] = ['linkedin', 'twitter', 'youtube'];
        let summaryResult: SummarizeContentOutput | null = null;

        try {
          // 1. Summarize Content
          summaryResult = await summarizeContent({ content: contentInput }, { apiKey });
          setSummary(summaryResult.summary);
          summarySuccess = true; // Mark summary as successful
        } catch (summaryError: any) {
           console.error("Summarization failed:", summaryError);
           let description = "Error summarizing content.";
            if (summaryError.message.includes("parsing")) {
               description = "Could not parse content from the URL. Please check the URL or paste text directly.";
            } else if (summaryError.message.includes("API key not valid")) {
               description = "AI service configuration error (API key). Please check your profile.";
            } else if (summaryError.message.includes("503") || summaryError.message.toLowerCase().includes("overloaded")) {
                description = "AI service is temporarily overloaded during summarization. Please try again later.";
            } else if (summaryError.status === 'INVALID_ARGUMENT' && summaryError.message.includes("API key is required")) {
                 description = "API Key was missing during generation.";
            }
           toast({ title: "Summarization Failed", description: description, variant: "destructive" });
           // Don't set summary, proceed to finally block for quota rollback
        } finally {
            setIsGeneratingSummary(false); // Summary attempt finished
        }

        // 2. Generate Posts (only if summary succeeded)
        if (summarySuccess && summaryResult) {
          const postPromises = platforms.map(platform =>
            generateSocialPosts({ summary: summaryResult!.summary, platform }, { apiKey })
              .then(result => {
                  postsSuccessCount++; // Increment success count
                  return { platform, post: result.post };
              })
              .catch(async (err) => { // Make catch async for potential rollback
                 console.error(`Error generating ${platform} post:`, err);
                  let description = `Error generating ${platform} post.`;
                  if (err.message.includes("API key not valid")) {
                     description = "AI service configuration error (API key). Please check your profile."
                  } else if (err.message.includes("503") || err.message.toLowerCase().includes("overloaded")) {
                      description = `AI service is temporarily overloaded generating ${platform} post. Please try again later.`;
                  } else if (err.status === 'INVALID_ARGUMENT' && err.message.includes("API key is required")) {
                      description = "API Key was missing during generation.";
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
        } else if (!summarySuccess) {
            // If summary failed, clear drafts as well
             setPostDrafts({});
        }

        // --- Final Quota Adjustment ---
         const totalCostAttempted = 4;
         const actualCost = (summarySuccess ? 1 : 0) + postsSuccessCount;
         const refundAmount = totalCostAttempted - actualCost;

         if (refundAmount > 0) {
             console.log(`Refunding ${refundAmount} quota points due to errors.`);
             await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -refundAmount });
             // Refetch quota to reflect refund
             const { data: refreshedQuota, error: refreshError } = await supabase
                .from('quotas')
                .select('*')
                .eq('user_id', user.id)
                .single();
             if (!refreshError && refreshedQuota) {
                setQuota(refreshedQuota);
             }
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

    startTransition(async () => {
      try {
        const tunedResult = await tuneSocialPosts({ originalPost, feedback }, { apiKey });
        setPostDrafts(prev => ({ ...prev, [platform]: tunedResult.tunedPost }));
         toast({ title: "Post Tuned!", description: `Applied feedback: "${feedback}"`, variant: "default" });
      } catch (error: any) {
        console.error(`Tuning ${platform} post failed:`, error);
        // --- Rollback Quota on Failure ---
        await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -1 });
         // Refetch quota to reflect refund
         const { data: refreshedQuota, error: refreshError } = await supabase
            .from('quotas')
            .select('*')
            .eq('user_id', user.id)
            .single();
         if (!refreshError && refreshedQuota) {
            setQuota(refreshedQuota);
         }


         let description = "An error occurred while tuning the post.";
          if (error.message.includes("API key not valid")) {
             description = "AI service configuration error (API key). Please check your profile."
          } else if (error.message.includes("503") || error.message.toLowerCase().includes("overloaded")) {
              description = "AI service is temporarily overloaded. Please try tuning again later.";
          } else if (error.status === 'INVALID_ARGUMENT' && error.message.includes("API key is required")) {
              description = "API Key was missing during tuning.";
          }
        toast({ title: "Tuning Failed", description: description, variant: "destructive" });
      } finally {
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

    startTransition(async () => {
      try {
        // Placeholder for actual Composio MCP publishing call using profile.composio_url
        console.log(`Publishing to ${platform} via ${profile.composio_url}:`, postContent);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call

        // TODO: Replace with actual API call:
        // await publishPost({ platform, content: postContent, composioUrl: profile.composio_url });

        toast({ title: "Post Published!", description: `Successfully published to ${platform}.`, variant: "default" });

      } catch (error: any) {
         console.error(`Publishing to ${platform} failed:`, error);
        // --- Rollback Quota on Failure ---
         await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -1 });
         // Refetch quota to reflect refund
         const { data: refreshedQuota, error: refreshError } = await supabase
            .from('quotas')
            .select('*')
            .eq('user_id', user.id)
            .single();
         if (!refreshError && refreshedQuota) {
            setQuota(refreshedQuota);
         }


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
                       <div className="flex items-center gap-1 text-sm text-destructive">
                           <Database className="h-4 w-4" />
                           <span>DB Error</span>
                       </div>
                   </TooltipTrigger>
                   <TooltipContent><p>Database setup required. See alerts.</p></TooltipContent>
               </Tooltip>
           ) : quota !== null ? ( // If no DB error and quota loaded
             <Tooltip>
               <TooltipTrigger asChild>
                  <div className="flex flex-col items-end cursor-help">
                     <div className="flex items-center gap-1 text-sm text-muted-foreground">
                       <BarChart className="h-4 w-4" />
                       <span>{quotaUsed} / {quotaLimit} used</span>
                     </div>
                      <Progress value={(quotaUsed / quotaLimit) * 100} className="w-20 h-1 mt-0.5" />
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
                 <Button variant="ghost" size="icon" onClick={() => setIsProfileDialogOpen(true)}>
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
            <AlertTitle>Database Setup Incomplete</AlertTitle>
            <AlertDescription>
              {dbSetupError} Please ensure you have run the **entire updated** SQL script from `supabase/schema.sql` in your Supabase SQL Editor.
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
            />
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleGenerate}
              disabled={isDisabled || !contentInput.trim() || !profile?.gemini_api_key} // Also disable if key is missing
              loading={isGeneratingSummary || isGeneratingPosts} // Show loading only for generation
              className="w-full md:w-auto ml-auto"
            >
              <Wand2 className="mr-2" /> Generate Posts
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
                            />
                         )}
                        {/* Tuning Buttons (only show if post generated successfully) */}
                        {!postDrafts[platform]?.startsWith("Error generating") && (
                             <div className="flex flex-wrap gap-2 shrink-0"> {/* Prevent tuning buttons from growing */}
                              <span className="text-xs text-muted-foreground mr-2 mt-1.5">Tune:</span>
                               <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'Make wittier')} disabled={isDisabled || !postDrafts[platform]}>Witty</Button>
                               <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'More concise')} disabled={isDisabled || !postDrafts[platform]}>Concise</Button>
                               <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'More professional')} disabled={isDisabled || !postDrafts[platform]}>Professional</Button>
                               <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'Add emojis')} disabled={isDisabled || !postDrafts[platform]}>Add Emojis ✨</Button>
                             </div>
                        )}
                      </CardContent>
                       {/* Footer (only show if post generated successfully) */}
                       {!postDrafts[platform]?.startsWith("Error generating") && (
                          <CardFooter className="flex justify-end gap-2 shrink-0"> {/* Prevent footer from growing */}
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
                                  disabled={isDisabled || !postDrafts[platform] || !profile?.composio_url} // Disable if no composio URL or other issues
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
        />
    </div>
    </TooltipProvider>
  );
}

// Placeholder API interaction functions (to be moved to API routes/server actions)

// async function publishPost(data: { platform: SocialPlatform; content: string }): Promise<void> {
//   // Replace with actual API call to POST /api/publish
//   console.log(`Calling API to publish to ${data.platform}...`);
//   await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API latency
//   // Simulate potential API error (e.g., 10% chance of failure)
//    if (Math.random() < 0.1) {
//       throw new Error("Failed to publish post via API.");
//    }
//   console.log("Publish API call successful.");
// }
