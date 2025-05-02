// dashboard.tsx
'use client';

import type { User } from '@supabase/supabase-js';
import type { Profile, Quota } from '@/types/supabase'; // Import specific types
import { useState, useTransition, useEffect, useCallback } from 'react'; // Added useCallback
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Added Select
import { useToast } from "@/hooks/use-toast";
import { LogOut, Loader2, Bot, Twitter, Linkedin, Youtube, Copy, Send, Wand2, Info, BarChart, User as UserIcon, Database, Zap, Sparkles, Trophy, Star, BrainCircuit } from 'lucide-react'; // Added Sparkles
import { summarizeContent, type SummarizeContentOutput } from '@/ai/flows/summarize-content';
import { generateSocialPosts, type GenerateSocialPostsOutput } from '@/ai/flows/generate-social-posts';
import { tuneSocialPosts, type TuneSocialPostsOutput } from '@/ai/flows/tune-social-posts';
import { analyzePost, type AnalyzePostOutput } from '@/ai/flows/analyze-post'; // Corrected import path
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from 'next/link';
import { ProfileDialog } from './profile-dialog'; // Import the profile dialog
import { Progress } from "@/components/ui/progress"; // Import Progress component
import AiAdvisorPanel from '@/components/dashboard/ai-advisor-panel'; // Corrected import path
import { toast as sonnerToast } from 'sonner'; // Import sonner toast for confetti effect
import Confetti from 'react-confetti';
import Joyride, { Step, CallBackProps } from 'react-joyride'; // Import react-joyride

// Persona types
type Persona = 'default' | 'tech_ceo' | 'casual_gen_z' | 'thought_leader' | 'meme_lord';

// Define default quota limit
const DEFAULT_QUOTA_LIMIT = 100;
const XP_PER_REQUEST = 10; // XP awarded per successful request

// Badge definitions
const BADGES = [
  { xp: 50, name: 'Vibe Starter ✨', description: 'Generated 5 posts!', icon: Star },
  { xp: 100, name: 'Content Ninja 🥷', description: 'Generated 10 posts!', icon: Trophy },
  { xp: 200, name: 'Social Samurai ⚔️', description: 'Generated 20 posts!', icon: Zap },
  { xp: 500, name: 'AI Maestro 🧑‍🔬', description: 'Mastered 50 generations!', icon: BrainCircuit },
];


interface DashboardProps {
  user: User;
  initialProfile: Profile | null;
  initialQuota: Quota | null;
  initialXp: number; // Added initial XP
  initialBadges: string[]; // Added initial badges
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
type AnalysisStates = {
  [key in SocialPlatform]?: boolean;
};
type AnalysisResults = {
  [key in SocialPlatform]?: AnalyzePostOutput | null;
};


// Onboarding Steps
const ONBOARDING_STEPS: Step[] = [
  {
    target: '#content-input-textarea',
    content: 'Start by pasting your content (URL or text) here.',
    placement: 'bottom',
  },
  {
    target: '#persona-select-trigger', // Target the trigger element
    content: 'Choose an AI writing style persona.',
    placement: 'bottom',
  },
  {
    target: '#generate-posts-button',
    content: 'Click here to summarize the content and generate initial drafts.',
    placement: 'bottom',
  },
  {
    target: '#output-tabs-list',
    content: 'Review the generated drafts for each platform here.',
    placement: 'bottom',
  },
  {
    target: '.ai-advisor-button', // Use class selector - assumes only one is visible initially or target the first
    content: 'Click the Sparkles icon to get AI feedback on your draft.',
    placement: 'left',
    // Add offset if needed, e.g., offset: [0, 10]
  },
    {
    target: '.tune-buttons-group', // Use class selector for the group
    content: 'Refine your post instantly with these AI tuning suggestions.',
    placement: 'top',
    },
  {
    target: '#quota-display-tooltip-trigger', // Add ID to TooltipTrigger
    content: 'Keep an eye on your monthly usage here. Earn XP and badges for generating!',
    placement: 'bottom',
  },
  {
    target: '#profile-button-tooltip-trigger', // Add ID to TooltipTrigger
    content: 'Manage your profile, API keys, and connections here.',
    placement: 'bottom',
  },
];


export default function Dashboard({ user, initialProfile, initialQuota, initialXp, initialBadges }: DashboardProps) {
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
  const [dbSetupError, setDbSetupError] = useState<string | null>(null);
  const [persona, setPersona] = useState<Persona>('default'); // State for selected persona
  const [analysisStates, setAnalysisStates] = useState<AnalysisStates>({}); // Loading state for analysis
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults>({}); // Results from analysis
  const [showAiAdvisor, setShowAiAdvisor] = useState<Partial<Record<SocialPlatform, boolean>>>({}); // Visibility state per platform
  const [showConfetti, setShowConfetti] = useState(false);
  const [runOnboarding, setRunOnboarding] = useState(false);
  const [lastAwardedBadge, setLastAwardedBadge] = useState<string | null>(null); // Track last badge for notification
  // Use initial values for XP and badges directly
  const [xp, setXp] = useState<number>(initialXp);
  const [badges, setBadges] = useState<string[]>(initialBadges);
  const [isClient, setIsClient] = useState(false); // State to track client-side mount

   // --- Calculate Derived State ---
   const quotaUsed = quota?.request_count ?? 0;
   const quotaLimit = quota?.quota_limit ?? DEFAULT_QUOTA_LIMIT;
   const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
   const quotaPercentage = quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0;
   const quotaExceeded = quotaRemaining <= 0 && !!quota; // Only exceeded if quota is loaded

   // --- Effects ---

   // Set isClient to true after mount to enable client-only rendering
   useEffect(() => {
    setIsClient(true);
  }, []);


  // Fetch or confirm profile/quota data on client-side if needed
  useEffect(() => {
    const ensureData = async () => {
      let currentProfile = profile;
      let currentQuota = quota;
      let setupErrorMsg: string | null = null;

      // --- Ensure Profile ---
      if (!currentProfile) {
         try {
            // Use RPC function which handles upsert logic
            const { data, error } = await supabase
              .rpc('get_user_profile', { p_user_id: user.id });

             if (error) {
                  console.error("Error fetching/creating profile on client:", error.message);
                  if (error.message.includes("function public.get_user_profile") && error.message.includes("does not exist")) {
                      setupErrorMsg = "Database setup incomplete: Missing 'get_user_profile' function. Please run the SQL script from `supabase/schema.sql`. See README Step 3.";
                  } else if (error.message.includes("relation \"public.profiles\" does not exist")) {
                     setupErrorMsg = "Database setup incomplete: Missing 'profiles' table. Please run the SQL script from `supabase/schema.sql`. See README Step 3.";
                  } else if (error.message.includes("permission denied")) {
                      setupErrorMsg = "Database access error: Permission denied for profile data. Check Row Level Security policies. See README Step 3.";
                   } else if (error.message.includes("Could not find the") && error.message.includes("column") && error.message.includes("in the schema cache")) {
                      const missingColumnMatch = error.message.match(/'(.*?)'/);
                      const missingColumn = missingColumnMatch ? missingColumnMatch[1] : 'unknown';
                      setupErrorMsg = `Database schema mismatch: Column '${missingColumn}' not found. Run the latest 'supabase/schema.sql'. See README Step 3.`;
                  } else {
                     toast({ title: "Profile Error", description: `Could not load your profile data: ${error.message}`, variant: "destructive" });
                  }
                  if (setupErrorMsg) setDbSetupError(setupErrorMsg);
             } else if (data && Array.isArray(data) && data.length > 0) {
                 currentProfile = data[0] as Profile;
                 setProfile(currentProfile);
                 // Also update local XP/Badges state from fetched profile
                 setXp(currentProfile.xp ?? initialXp);
                 setBadges(currentProfile.badges ?? initialBadges);

                  // Check if onboarding needs to run for this profile
                  // Moved onboarding check to the client-only effect
             } else {
                 console.warn("Profile still null/empty after calling get_user_profile on client");
                 toast({ title: "Profile Error", description: "Failed to load profile data. Please refresh.", variant: "destructive" });
             }
         } catch (error: any) {
             console.error("Unexpected client error fetching/creating profile:", error.message);
             toast({ title: "Profile Error", description: `Unexpected error: ${error.message}`, variant: "destructive" });
             setupErrorMsg = `Unexpected error loading profile data. Check console. Details: ${error.message}`;
             setDbSetupError(setupErrorMsg);
         }
      } else {
         // Profile was loaded initially, check onboarding status
         // Moved onboarding check to the client-only effect
         // Ensure local XP/Badge state matches initial profile if profile exists
         setXp(profile.xp ?? initialXp);
         setBadges(profile.badges ?? initialBadges);
      }


      // --- Ensure Quota ---
      if (!currentQuota) {
        try {
          // Use RPC function to get remaining quota (handles reset logic)
          const { data: remainingQuota, error: rpcError } = await supabase
             .rpc('get_remaining_quota', { p_user_id: user.id });

           if (rpcError) {
             console.error('Error calling get_remaining_quota RPC:', rpcError.message);
             let errorMsg = `Failed to load usage data: ${rpcError.message}`;
             if (rpcError.message.includes("function public.get_remaining_quota") && rpcError.message.includes("does not exist")) {
                 errorMsg = "Database setup incomplete: Missing 'get_remaining_quota' function. Run setup script.";
             } else if (rpcError.message.includes("relation \"public.quotas\" does not exist")) { // Check if function itself reports missing table
                 errorMsg = "Database setup incomplete: Missing 'quotas' table. Run setup script.";
             } else if (rpcError.message.includes("permission denied")) {
                 errorMsg = "Database access error: Permission denied for 'get_remaining_quota'. Check RLS/function security.";
             }
             setupErrorMsg = errorMsg; // Overwrite previous profile error if quota fails more specifically
             toast({ title: 'Quota Error', description: errorMsg, variant: 'destructive' });
           } else {
              // RPC succeeded, now fetch the full quota details for display
               const { data: quotaDetails, error: selectError } = await supabase
                 .from('quotas')
                 .select('user_id, request_count, quota_limit, last_reset_at')
                 .eq('user_id', user.id)
                 .maybeSingle(); // Handle no row found gracefully

               if (selectError && selectError.code !== 'PGRST116') { // Handle errors other than "No rows found"
                   console.error('Error fetching quota details after RPC:', selectError.message);
                   let errorMsg = `Failed to load full usage details: ${selectError.message}`;
                   if (selectError.message.includes("relation \"public.quotas\" does not exist")) {
                     errorMsg = "Database setup incomplete: Missing 'quotas' table. Run setup script.";
                   } else if (selectError.message.includes("permission denied")) {
                     errorMsg = "Database access error: Permission denied for 'quotas' table. Check RLS.";
                   } else if (selectError.message.includes("406")) {
                       errorMsg = `Config issue: Could not fetch quota details (406). Check RLS/table access.`;
                       toast({ title: "Quota Load Error", description: "Could not retrieve usage details (406).", variant: "destructive" });
                   }
                   if (!setupErrorMsg) setupErrorMsg = errorMsg;
                   toast({ title: 'Quota Error', description: errorMsg, variant: 'destructive' });
               } else if (quotaDetails) {
                   currentQuota = quotaDetails as Quota;
                   setQuota(currentQuota);
                   if (currentProfile && !setupErrorMsg) setDbSetupError(null); // Clear setup error if profile loaded and quota now loaded
               } else if (typeof remainingQuota === 'number') {
                  // If select found no row but RPC worked, initialize local state
                  console.log("Quota record not found yet for user:", user.id);
                  const limit = DEFAULT_QUOTA_LIMIT; // Assume default limit
                  const used = Math.max(0, limit - remainingQuota);
                  const nowISO = new Date().toISOString();
                  currentQuota = {
                      user_id: user.id,
                      request_count: used,
                      quota_limit: limit,
                      last_reset_at: nowISO, // Use current time as placeholder reset
                      created_at: nowISO, // Placeholder
                      ip_address: null // Placeholder
                  };
                  setQuota(currentQuota);
                  if (currentProfile && !setupErrorMsg) setDbSetupError(null);
               } else {
                   if (!setupErrorMsg) setupErrorMsg = "Could not determine initial quota state.";
                   toast({ title: 'Quota Error', description: setupErrorMsg, variant: 'destructive' });
               }
           }
        } catch (err: any) {
          console.error('Unexpected error fetching quota:', err.message);
          if (!setupErrorMsg) setupErrorMsg = `Unexpected error loading usage data: ${err.message}`;
          toast({ title: 'Quota Error', description: setupErrorMsg, variant: 'destructive' });
        }
      } else {
         // Quota was loaded initially, ensure no latent DB error remains displayed
         if (currentProfile && !setupErrorMsg) {
             setDbSetupError(null);
         }
      }

      // Finally, set the derived DB setup error state
       if (setupErrorMsg) {
         setDbSetupError(setupErrorMsg);
       }
    };
    ensureData();
  }, [user.id, supabase, toast, profile, quota, dbSetupError, initialBadges, initialXp]); // Added initial props as deps


  // Effect to check onboarding status only on client-side after profile is loaded
  useEffect(() => {
    if (isClient && profile && !profile.badges?.includes('onboarded')) {
      setRunOnboarding(true);
    }
  }, [isClient, profile]); // Depend on isClient and profile


  // --- Callbacks and Event Handlers ---

  // Function to handle profile updates from the dialog
  const handleProfileUpdate = useCallback((updatedProfile: Profile) => {
    setProfile(updatedProfile);
    // Update local state for XP and badges based on the updated profile
    const newXp = updatedProfile.xp ?? initialXp;
    const newBadges = updatedProfile.badges ?? initialBadges;
    setXp(newXp);
    setBadges(newBadges);
    // Check for new badges earned due to XP update
    checkAndAwardBadges(newXp, newBadges);
    toast({ title: "Profile Updated", description: "Your profile information has been saved." });
  }, [toast, initialBadges, initialXp]); // Include initial props in dependency array


  // Check for badge awards whenever XP or badges change
  useEffect(() => {
    checkAndAwardBadges(xp, badges);
  }, [xp, badges]); // Depends on state variables


   // Function to check and award badges
   const checkAndAwardBadges = useCallback((currentXp: number, currentBadges: string[]) => {
        let newlyAwardedBadge: string | null = null;

        BADGES.forEach(badge => {
            // Check if XP threshold is met AND the badge hasn't been awarded yet
            if (currentXp >= badge.xp && !currentBadges.includes(badge.name)) {
                 console.log(`Badge condition met: ${badge.name}`);
                 newlyAwardedBadge = badge.name; // Store the latest badge to award

                 // Update badge state immediately (optimistic UI)
                 const updatedBadges = [...currentBadges, badge.name];
                 setBadges(updatedBadges);


                 // Update badge in the database (fire and forget for now, error handled below)
                 supabase
                   .from('profiles')
                   .update({ badges: updatedBadges }) // Use the updated badges array
                   .eq('id', user.id)
                   .then(({ error }) => {
                       if (error) {
                           console.error(`Failed to save badge "${badge.name}" to database:`, error);
                           toast({ title: "Badge Save Error", description: `Could not save badge: ${badge.name}`, variant: "destructive"});
                           // Revert optimistic UI update if needed
                           setBadges(currentBadges); // Revert to previous state
                       } else {
                          console.log(`Badge "${badge.name}" saved to DB.`);
                          // Update the main profile state as well after DB success
                           setProfile(prev => prev ? { ...prev, badges: updatedBadges } : null);
                       }
                   });
            }
        });

        // Notify about the *last* newly awarded badge in this check
        if (newlyAwardedBadge && newlyAwardedBadge !== lastAwardedBadge) {
            const badgeInfo = BADGES.find(b => b.name === newlyAwardedBadge);
             if (badgeInfo) {
                 setShowConfetti(true);
                 sonnerToast.success(`Badge Unlocked: ${badgeInfo.name}!`, {
                   description: badgeInfo.description,
                   duration: 5000,
                   icon: <badgeInfo.icon className="text-green-500" />,
                 });
                 setLastAwardedBadge(newlyAwardedBadge); // Avoid re-notifying for the same badge immediately
                 setTimeout(() => setShowConfetti(false), 5000);
             }
        }

   }, [supabase, user.id, toast, lastAwardedBadge]); // Removed profile?.badges dependency


   // Function to check quota and increment if allowed
  const checkAndIncrementQuota = useCallback(async (incrementAmount: number = 1): Promise<boolean> => {
     if (dbSetupError) {
         toast({ title: "Database Error", description: `Cannot process request due to database setup issue: ${dbSetupError}`, variant: "destructive" });
         return false;
     }

     let currentRemaining = quotaRemaining;
     // If quota is not loaded, attempt to fetch remaining via RPC
     if (quota === null) {
         console.log("Quota is null, attempting to fetch remaining via RPC...");
         try {
              const { data: fetchedQuotaRemaining, error: fetchError } = await supabase
                  .rpc('get_remaining_quota', { p_user_id: user.id });

              if (fetchError) {
                  console.error("RPC Error checking remaining quota:", fetchError.message);
                   if (fetchError.message.includes("function public.get_remaining_quota") && fetchError.message.includes("does not exist")) {
                       setDbSetupError("Database function 'get_remaining_quota' missing. Run setup script.");
                       toast({ title: "Database Error", description: "Missing function to check usage.", variant: "destructive" });
                   } else {
                       toast({ title: "Quota Check Error", description: `Failed to check usage limit: ${fetchError.message}`, variant: "destructive" });
                   }
                  return false;
              }
              if (typeof fetchedQuotaRemaining === 'number') {
                  currentRemaining = fetchedQuotaRemaining;
                  console.log("Fetched remaining quota via RPC:", currentRemaining);
              } else {
                  console.warn("get_remaining_quota RPC did not return a number:", fetchedQuotaRemaining);
                  toast({ title: "Quota Check Error", description: "Could not determine remaining usage.", variant: "destructive" });
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

     // Optimistic UI update for quota count
     const optimisticQuotaUsed = quotaUsed + incrementAmount;
     const optimisticQuotaRemaining = quotaLimit - optimisticQuotaUsed;
     const optimisticQuotaPercentage = quotaLimit > 0 ? (optimisticQuotaUsed / quotaLimit) * 100 : 0;
     const optimisticQuota = quota ? { ...quota, request_count: optimisticQuotaUsed } : null;
     if (optimisticQuota) setQuota(optimisticQuota);
     // Optimistic UI update for XP
     const optimisticXp = xp + (incrementAmount * XP_PER_REQUEST);
     setXp(optimisticXp); // Update XP state


    try {
        console.log(`Attempting to increment quota by ${incrementAmount} for user ${user.id}`);
        const { data: newRemainingRpc, error } = await supabase.rpc('increment_quota', {
           p_user_id: user.id,
           p_increment_amount: incrementAmount
        });

       if (error) {
          // Revert optimistic updates
          setQuota(quota);
          setXp(xp); // Revert XP state

          console.error("Error incrementing quota RPC:", error.message);
          if (error.message.includes("quota_exceeded")) {
             toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
             // Ensure UI reflects the limit being hit
             if(quota) setQuota(prev => prev ? {...prev, request_count: prev.quota_limit ?? DEFAULT_QUOTA_LIMIT} : null);
          } else if (error.message.includes("function public.increment_quota") && error.message.includes("does not exist")) {
             setDbSetupError("Database function 'increment_quota' missing. Run setup script.");
             toast({ title: "Database Error", description: "Missing function to update usage.", variant: "destructive" });
          } else if (error.message.includes("permission denied") || error.message.includes("violates row-level security policy")) {
              setDbSetupError("Database permission error updating quota. Check RLS policies.");
              toast({ title: "Database Security Error", description: "Failed to update usage count.", variant: "destructive" });
          } else {
             toast({ title: "Quota Error", description: `Failed to update usage count: ${error.message}`, variant: "destructive" });
          }
          return false;
       }

       // --- Success: Refetch BOTH quota and profile (including XP/badges) ---
        console.log("Quota increment RPC successful, refetching data...");
       const [{ data: updatedQuotaData, error: fetchQuotaError }, { data: updatedProfileData, error: fetchProfileError }] = await Promise.all([
            supabase
                .from('quotas')
                .select('user_id, request_count, quota_limit, last_reset_at')
                .eq('user_id', user.id)
                .single(),
            supabase // Fetch profile again to get updated XP and badges
                .from('profiles')
                .select('*, xp, badges') // Explicitly select xp and badges
                .eq('id', user.id)
                .single()
        ]);


        if (fetchQuotaError){
           console.error("Error fetching quota after increment:", fetchQuotaError.message);
           toast({ title: "Quota Update Warning", description: "Usage updated, but failed to refresh details.", variant: "default" });
            // Keep optimistic update if refetch fails
        } else if (updatedQuotaData) {
            console.log("Refetched quota data:", updatedQuotaData);
            setQuota(updatedQuotaData as Quota);
        }

        if (fetchProfileError) {
            console.error("Error fetching profile after increment:", fetchProfileError.message);
             toast({ title: "Profile Update Warning", description: "Usage updated, but failed to refresh profile data (XP/badges).", variant: "default" });
            // Keep optimistic update if refetch fails
        } else if (updatedProfileData) {
            console.log("Refetched profile data:", updatedProfileData);
            const completeProfile = updatedProfileData as Profile;
            setProfile(completeProfile); // Update profile state with new XP/badges
            // Update local state for XP and badges
            const newXp = completeProfile.xp ?? initialXp;
            const newBadges = completeProfile.badges ?? initialBadges;
            setXp(newXp);
            setBadges(newBadges);
             // Explicitly trigger badge check after profile update from DB
            checkAndAwardBadges(newXp, newBadges);
        }


       if (typeof newRemainingRpc === 'number' && newRemainingRpc < 0) {
           toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
           return false;
       }

      return true; // Increment successful
    } catch (rpcError: any) {
        // Revert optimistic updates on unexpected error
        setQuota(quota);
        setXp(xp); // Revert XP state
        console.error("Unexpected Error calling increment_quota RPC:", rpcError.message);
        toast({ title: "Quota Error", description: `An unexpected error occurred updating usage: ${rpcError.message}`, variant: "destructive" });
        return false;
    }
  }, [dbSetupError, quota, quotaRemaining, quotaUsed, quotaLimit, xp, supabase, user.id, toast, checkAndAwardBadges, initialXp, initialBadges]); // Added dependencies


  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Error Signing Out", description: error.message, variant: "destructive" });
    } else {
      setProfile(null);
      setQuota(null);
      setXp(0); // Reset XP
      setBadges([]); // Reset badges
      setContentInput('');
      setSummary(null);
      setPostDrafts({});
      setDbSetupError(null);
      router.push('/login');
    }
  };

 // Generate Summary and Posts Handler
 const handleGenerate = async () => {
    if (dbSetupError) {
        toast({ title: "Database Setup Error", description: dbSetupError, variant: "destructive" });
        return;
    }
    if (!profile?.gemini_api_key) {
        toast({ title: "API Key Missing", description: "Please add your Google Gemini API key in profile.", variant: "destructive" });
        setIsProfileDialogOpen(true);
        return;
    }
    if (!contentInput.trim()) {
        toast({ title: "Input Required", description: "Please enter content or a URL.", variant: "destructive" });
        return;
    }

    // Calculate cost: 1 summary + 3 posts = 4
    const COST = 4;
    if (!await checkAndIncrementQuota(COST)) return;

    setIsGeneratingSummary(true);
    setIsGeneratingPosts(true);
    setSummary(null);
    setPostDrafts({});
    setAnalysisResults({}); // Clear previous analysis
    setShowAiAdvisor({}); // Hide advisor panels

    const apiKey = profile.gemini_api_key;
    let summarySuccess = false;
    let postsSuccessCount = 0;

    startTransition(async () => {
        let summaryResult: SummarizeContentOutput | null = null;
        try {
            // 1. Summarize Content (includes retry logic)
            summaryResult = await summarizeContent({ content: contentInput }, { apiKey });
            if (summaryResult?.summary) {
                setSummary(summaryResult.summary);
                summarySuccess = true;
                console.log("Summarization successful:", summaryResult);
            } else {
                throw new Error("AI returned an empty summary.");
            }
        } catch (summaryError: any) {
            console.error("Summarization failed:", summaryError);
            // Error handling with user-friendly messages (as before)
            let description = `Summarization failed: ${summaryError.message || 'Unknown AI error'}`;
            if (summaryError.message.includes("parsing")) {
                description = "Could not parse content from URL. Check URL or paste text.";
            } else if (summaryError.status === 'UNAUTHENTICATED' || summaryError.message.includes("API key not valid")) {
                description = "Invalid Gemini API Key. Check profile.";
                setIsProfileDialogOpen(true);
            } else if (summaryError.status === 'UNAVAILABLE') {
                description = "AI service unavailable during summarization after retries. Try again later.";
            } else if (summaryError.status === 'RESOURCE_EXHAUSTED') {
                description = "AI rate limit exceeded during summarization after retries. Check Google API quota or try later.";
            } else if (summaryError.message.includes("empty summary")) {
                description = "Summarization failed: AI returned an empty result after retries.";
            }
            toast({ title: "Summarization Failed", description, variant: "destructive" });
        } finally {
            setIsGeneratingSummary(false);
        }

        // 2. Generate Posts if summary succeeded (includes retry logic)
        if (summarySuccess && summaryResult) {
            const platforms: SocialPlatform[] = ['linkedin', 'twitter', 'youtube'];
            const postPromises = platforms.map(platform =>
                generateSocialPosts({ summary: summaryResult!.summary, platform }, { apiKey })
                .then(result => {
                    if (result?.post) {
                        postsSuccessCount++;
                        return { platform, post: result.post };
                    } else {
                        throw new Error(`AI returned an empty post for ${platform}.`);
                    }
                })
                .catch(async (err) => {
                    console.error(`Error generating ${platform} post:`, err);
                    // User-friendly error handling (as before)
                    let description = `Post generation for ${platform} failed: ${err.message || 'Unknown AI error'}`;
                     if (err.status === 'UNAUTHENTICATED' || err.message.includes("API key not valid")) {
                       description = "Invalid Gemini API Key. Check profile."
                       setIsProfileDialogOpen(true);
                    } else if (err.status === 'UNAVAILABLE') {
                        description = `AI service unavailable generating ${platform} post after retries. Try later.`;
                    } else if (err.status === 'RESOURCE_EXHAUSTED') {
                        description = `AI rate limit exceeded generating ${platform} post after retries. Check quota or try later.`;
                    } else if (err.message.includes("empty post")) {
                       description = `Generation for ${platform} failed: AI returned empty result after retries.`;
                    }
                    toast({ title: `Post Gen Failed (${platform})`, description, variant: "destructive" });
                    return { platform, post: `Error generating post for ${platform}.` };
                })
            );
            const results = await Promise.all(postPromises);
            const newDrafts = results.reduce((acc, { platform, post }) => {
                acc[platform] = post;
                return acc;
            }, {} as PostDrafts);
            setPostDrafts(newDrafts);
        } else {
            setPostDrafts({});
        }

        // --- Final Quota Adjustment ---
        const actualCost = (summarySuccess ? 1 : 0) + postsSuccessCount;
        const refundAmount = COST - actualCost;
        if (refundAmount > 0) {
            console.log(`Refunding ${refundAmount} quota points due to errors.`);
            try {
                // Use negative increment amount for refund
                const { error: refundRpcError } = await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -refundAmount });
                 if (refundRpcError) {
                     console.error("Error during quota refund RPC:", refundRpcError.message);
                     toast({ title: "Quota Refund Issue", description: `Failed to process quota refund: ${refundRpcError.message}`, variant: "destructive"});
                 } else {
                     // Refetch quota and profile locally after successful refund attempt
                    const [{ data: refreshedQuota, error: refreshQuotaError }, { data: refreshedProfile, error: refreshProfileError }] = await Promise.all([
                         supabase.from('quotas').select('*').eq('user_id', user.id).single(),
                         supabase.from('profiles').select('*, xp, badges').eq('id', user.id).single()
                    ]);
                    if (!refreshQuotaError && refreshedQuota) setQuota(refreshedQuota as Quota);
                     if (!refreshProfileError && refreshedProfile) {
                         const completeProfile = refreshedProfile as Profile;
                         setProfile(completeProfile);
                          // Update local state for XP and badges
                          const newXp = completeProfile.xp ?? initialXp;
                          const newBadges = completeProfile.badges ?? initialBadges;
                          setXp(newXp);
                          setBadges(newBadges);
                         checkAndAwardBadges(newXp, newBadges); // Recheck badges after profile refresh
                     }
                 }
            } catch (refundCatchError: any) {
                 console.error("Unexpected Error during quota refund attempt:", refundCatchError.message);
                 toast({ title: "Quota Refund Issue", description: "Unexpected error trying to refund quota.", variant: "destructive"});
            }
        }
        setIsGeneratingPosts(false);
    });
 };

 // Tune Post Handler
 const handleTunePost = async (platform: SocialPlatform, feedback: string) => {
    if (dbSetupError) {
        toast({ title: "Database Error", description: dbSetupError, variant: "destructive" });
        return;
    }
    if (!profile?.gemini_api_key) {
        toast({ title: "API Key Missing", description: "Please add your Gemini API key in profile.", variant: "destructive" });
        setIsProfileDialogOpen(true);
        return;
    }
    const originalPost = postDrafts[platform];
    if (!originalPost || originalPost.startsWith("Error generating")) {
        toast({ title: "Cannot Tune", description: "Cannot tune a post that failed generation.", variant: "destructive" });
        return;
    }

    // Cost: 1
    const COST = 1;
    if (!await checkAndIncrementQuota(COST)) return;

    setIsTuning(prev => ({ ...prev, [platform]: true }));
    setAnalysisResults(prev => ({ ...prev, [platform]: null })); // Clear analysis on tune
    const apiKey = profile.gemini_api_key;
    let tuneSuccess = false;

    startTransition(async () => {
        try {
            // Pass platform context to the tuning function (includes retry logic)
            const tunedResult = await tuneSocialPosts({ originalPost, feedback, platform }, { apiKey });
            if (tunedResult?.tunedPost) {
                setPostDrafts(prev => ({ ...prev, [platform]: tunedResult.tunedPost }));
                toast({ title: "Post Tuned!", description: `Applied feedback: "${feedback}"`, variant: "default" });
                tuneSuccess = true;
            } else {
                throw new Error(`AI returned an empty tuned post for ${platform}.`);
            }
        } catch (error: any) {
            console.error(`Tuning ${platform} post failed:`, error);
            // User-friendly error handling (as before)
             let description = `Post tuning failed: ${error.message || 'Unknown AI error'}`;
             if (error.status === 'UNAUTHENTICATED' || error.message.includes("API key not valid")) {
               description = "Invalid Gemini API Key. Check profile."
               setIsProfileDialogOpen(true);
            } else if (error.status === 'UNAVAILABLE') {
                description = "AI service unavailable for tuning after retries. Try again later.";
            } else if (error.status === 'RESOURCE_EXHAUSTED') {
                description = "AI rate limit exceeded during tuning after retries. Check quota or try later.";
            } else if (error.message.includes("empty tuned post")) {
                description = `Tuning for ${platform} failed: AI returned empty result after retries.`;
            }
            toast({ title: "Tuning Failed", description, variant: "destructive" });
        } finally {
            // --- Quota Adjustment for Tuning ---
            const actualCost = tuneSuccess ? 1 : 0;
            const refundAmount = COST - actualCost;
            if (refundAmount > 0) {
                console.log(`Refunding ${refundAmount} quota point for failed tuning.`);
                 try {
                     const { error: refundRpcError } = await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -refundAmount });
                     if (refundRpcError) {
                         console.error("Error during quota refund RPC for tuning:", refundRpcError.message);
                         toast({ title: "Quota Refund Issue", description: `Failed refund for tuning: ${refundRpcError.message}`, variant: "destructive"});
                     } else {
                         // Refetch quota and profile locally after successful refund
                        const [{ data: refreshedQuota, error: refreshQuotaError }, { data: refreshedProfile, error: refreshProfileError }] = await Promise.all([
                           supabase.from('quotas').select('*').eq('user_id', user.id).single(),
                           supabase.from('profiles').select('*, xp, badges').eq('id', user.id).single()
                       ]);
                       if (!refreshQuotaError && refreshedQuota) setQuota(refreshedQuota as Quota);
                       if (!refreshProfileError && refreshedProfile) {
                           const completeProfile = refreshedProfile as Profile;
                           setProfile(completeProfile);
                           // Update local state for XP and badges
                            const newXp = completeProfile.xp ?? initialXp;
                            const newBadges = completeProfile.badges ?? initialBadges;
                            setXp(newXp);
                            setBadges(newBadges);
                            checkAndAwardBadges(newXp, newBadges);
                       }
                     }
                 } catch (refundCatchError: any) {
                     console.error("Unexpected Error during tuning quota refund attempt:", refundCatchError.message);
                     toast({ title: "Quota Refund Issue", description: "Unexpected error refunding quota.", variant: "destructive"});
                 }
            }
            setIsTuning(prev => ({ ...prev, [platform]: false }));
        }
    });
 };

 // Analyze Post Handler
 const handleAnalyzePost = async (platform: SocialPlatform) => {
    if (dbSetupError) {
      toast({ title: "Database Error", description: dbSetupError, variant: "destructive" });
      return;
    }
    if (!profile?.gemini_api_key) {
      toast({ title: "API Key Missing", description: "Please add your Gemini API key in profile.", variant: "destructive" });
      setIsProfileDialogOpen(true);
      return;
    }
    const currentPost = postDrafts[platform];
    if (!currentPost || currentPost.startsWith("Error generating")) {
      toast({ title: "Cannot Analyze", description: "Cannot analyze a post that failed generation.", variant: "destructive" });
      return;
    }

     // Cost: 1
     const COST = 1;
     if (!await checkAndIncrementQuota(COST)) return;

    setAnalysisStates(prev => ({ ...prev, [platform]: true }));
    setAnalysisResults(prev => ({ ...prev, [platform]: null })); // Clear previous results
    setShowAiAdvisor(prev => ({ ...prev, [platform]: true })); // Show panel
    const apiKey = profile.gemini_api_key;
    let analysisSuccess = false;

    startTransition(async () => {
      try {
        const result = await analyzePost({ postContent: currentPost, platform }, { apiKey });
         if (result && result.analysis) { // Check if analysis exists
             setAnalysisResults(prev => ({ ...prev, [platform]: result }));
             analysisSuccess = true;
         } else {
             // Handle case where analysis is unexpectedly empty
             throw new Error("AI returned empty analysis results.");
         }

      } catch (error: any) {
        console.error(`Analyzing ${platform} post failed:`, error);
        let description = `Post analysis failed: ${error.message || 'Unknown AI error'}`;
         if (error.status === 'UNAUTHENTICATED' || error.message.includes("API key not valid")) {
           description = "Invalid Gemini API Key. Check profile."
           setIsProfileDialogOpen(true);
        } else if (error.status === 'UNAVAILABLE') {
            description = "AI service unavailable for analysis after retries. Try again later.";
        } else if (error.status === 'RESOURCE_EXHAUSTED') {
            description = "AI rate limit exceeded during analysis after retries. Check quota or try later.";
        } else if (error.message.includes("empty analysis")) {
             description = `Analysis for ${platform} failed: AI returned empty result after retries.`;
         }
        toast({ title: "Analysis Failed", description, variant: "destructive" });
        setShowAiAdvisor(prev => ({ ...prev, [platform]: false })); // Hide panel on error
      } finally {
         // --- Quota Adjustment for Analysis ---
         const actualCost = analysisSuccess ? 1 : 0;
         const refundAmount = COST - actualCost;
          if (refundAmount > 0) {
            console.log(`Refunding ${refundAmount} quota point for failed analysis.`);
            try {
                const { error: refundRpcError } = await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -refundAmount });
                if (refundRpcError) {
                    console.error("Error during quota refund RPC for analysis:", refundRpcError.message);
                    toast({ title: "Quota Refund Issue", description: `Failed refund for analysis: ${refundRpcError.message}`, variant: "destructive"});
                } else {
                    // Refetch quota and profile locally after successful refund
                    const [{ data: refreshedQuota, error: refreshQuotaError }, { data: refreshedProfile, error: refreshProfileError }] = await Promise.all([
                       supabase.from('quotas').select('*').eq('user_id', user.id).single(),
                       supabase.from('profiles').select('*, xp, badges').eq('id', user.id).single()
                   ]);
                   if (!refreshQuotaError && refreshedQuota) setQuota(refreshedQuota as Quota);
                   if (!refreshProfileError && refreshedProfile) {
                       const completeProfile = refreshedProfile as Profile;
                       setProfile(completeProfile);
                       // Update local state for XP and badges
                        const newXp = completeProfile.xp ?? initialXp;
                        const newBadges = completeProfile.badges ?? initialBadges;
                        setXp(newXp);
                        setBadges(newBadges);
                       checkAndAwardBadges(newXp, newBadges);
                   }
                }
            } catch (refundCatchError: any) {
                console.error("Unexpected Error during analysis quota refund attempt:", refundCatchError.message);
                toast({ title: "Quota Refund Issue", description: "Unexpected error refunding quota.", variant: "destructive"});
            }
        }
        setAnalysisStates(prev => ({ ...prev, [platform]: false }));
      }
    });
  };

 // Apply AI Advisor Suggestion
 const handleApplySuggestion = (platform: SocialPlatform, start: number, end: number, suggestion: string) => {
     const currentPost = postDrafts[platform];
     if (!currentPost) return;

     const updatedPost = currentPost.substring(0, start) + suggestion + currentPost.substring(end);
     setPostDrafts(prev => ({ ...prev, [platform]: updatedPost }));

     // Re-analyze after applying suggestion (optional, could be costly)
     // handleAnalyzePost(platform);

      // For now, just clear the current analysis results for that platform
      setAnalysisResults(prev => ({ ...prev, [platform]: null }));
      toast({ title: "Suggestion Applied", description: "Post updated with AI suggestion."});
  };


  const handlePublishPost = async (platform: SocialPlatform) => {
     if (dbSetupError) {
        toast({ title: "Database Setup Error", description: dbSetupError, variant: "destructive" });
        return;
     }
     let targetUrl: string | null | undefined = null;
      switch (platform) {
          case 'linkedin': targetUrl = profile?.linkedin_url; break;
          case 'twitter': targetUrl = profile?.twitter_url; break;
          case 'youtube': targetUrl = profile?.youtube_url; break;
      }

     if (!profile?.composio_mcp_url || !targetUrl) {
         toast({ title: `Composio URL Missing`, description: `Please add your main Composio MCP URL and the specific ${platform} app URL in your profile to enable publishing.`, variant: "destructive" });
         setIsProfileDialogOpen(true);
         return;
     }

    const postContent = postDrafts[platform];
    if (!postContent || postContent.startsWith("Error generating")) {
         toast({ title: "Cannot Publish", description: "Cannot publish a post that failed generation.", variant: "destructive" });
        return;
    }

     // Cost: 1 (example)
     const COST = 1;
     if (!await checkAndIncrementQuota(COST)) return;

    setIsPublishing(prev => ({ ...prev, [platform]: true }));
    let publishSuccess = false;

    startTransition(async () => {
      try {
        console.log(`Publishing to ${platform} via ${targetUrl}:`, postContent);
        // Placeholder: Replace with actual API call to Composio/Platform
        await new Promise(resolve => setTimeout(resolve, 1500));
        toast({ title: "Post Published!", description: `Successfully published to ${platform}.`, variant: "default" });
        publishSuccess = true;
      } catch (error: any) {
         console.error(`Publishing to ${platform} failed:`, error);
         let description = `Publishing to ${platform} failed: ${error.message || 'Unknown error'}`;
          if (error.message.includes("authentication") || error.message.includes("connect")) {
              description = `Please connect your ${platform} account via Composio first.`
              // Consider adding a button/link to trigger the auth flow again
          } else if (error.message.includes("invalid Composio URL")) {
               description = `Invalid Composio ${platform} URL in profile. Please check and update.`;
               setIsProfileDialogOpen(true);
          }
        toast({ title: "Publishing Failed", description, variant: "destructive" });
      } finally {
         // --- Quota Adjustment for Publishing ---
         const actualCost = publishSuccess ? 1 : 0;
         const refundAmount = COST - actualCost;
          if (refundAmount > 0) {
            console.log(`Refunding ${refundAmount} quota point for failed publishing.`);
             try {
                 const { error: refundRpcError } = await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -refundAmount });
                 if(refundRpcError) {
                     console.error("Error during quota refund RPC for publishing:", refundRpcError.message);
                     toast({ title: "Quota Refund Issue", description: `Failed refund for publishing: ${refundRpcError.message}`, variant: "destructive"});
                 } else {
                     // Refetch quota and profile locally after successful refund
                     const [{ data: refreshedQuota, error: refreshQuotaError }, { data: refreshedProfile, error: refreshProfileError }] = await Promise.all([
                         supabase.from('quotas').select('*').eq('user_id', user.id).single(),
                         supabase.from('profiles').select('*, xp, badges').eq('id', user.id).single()
                     ]);
                     if (!refreshQuotaError && refreshedQuota) setQuota(refreshedQuota as Quota);
                     if (!refreshProfileError && refreshedProfile) {
                          const completeProfile = refreshedProfile as Profile;
                         setProfile(completeProfile);
                           // Update local state for XP and badges
                           const newXp = completeProfile.xp ?? initialXp;
                           const newBadges = completeProfile.badges ?? initialBadges;
                           setXp(newXp);
                           setBadges(newBadges);
                         checkAndAwardBadges(newXp, newBadges);
                     }
                 }
             } catch (refundCatchError: any) {
                 console.error("Unexpected Error during publishing quota refund attempt:", refundCatchError.message);
                 toast({ title: "Quota Refund Issue", description: "Unexpected error refunding quota.", variant: "destructive"});
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

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, action } = data;
     const FINISHED_STATUSES: string[] = ['finished', 'skipped'];

     if (FINISHED_STATUSES.includes(status)) {
         setRunOnboarding(false);
         // Mark onboarding as completed in the database
         if (profile && !profile.badges?.includes('onboarded')) {
             const updatedBadges = [...(profile.badges ?? []), 'onboarded'];
             supabase
                .from('profiles')
                .update({ badges: updatedBadges })
                .eq('id', user.id)
                 .then(({ error }) => {
                     if (error) console.error("Failed to mark onboarding complete:", error);
                     else {
                         // Update local profile state as well
                          const completeProfile = {...profile, badges: updatedBadges};
                          setProfile(completeProfile);
                          setBadges(updatedBadges); // Update local badge state
                          checkAndAwardBadges(completeProfile.xp ?? 0, updatedBadges); // Recheck badges immediately
                     }
                 });
         }
     } else if (type === 'error') {
         console.error("Onboarding tour error:", data);
         setRunOnboarding(false); // Stop tour on error
     }
  };


  // Determine if generation/tuning should be globally disabled
  const isDisabled = isPending || quotaExceeded || !!dbSetupError;


  return (
    <TooltipProvider>
     {/* Onboarding Tour - Render only on the client */}
     {isClient && (
        <Joyride
          steps={ONBOARDING_STEPS}
          run={runOnboarding}
          continuous
          showProgress
          showSkipButton
          callback={handleJoyrideCallback}
          styles={{
            options: {
              zIndex: 10000, // Ensure it's above other elements like dialogs
              primaryColor: '#6D28D9', // Use primary color from theme
            },
            tooltip: {
              backgroundColor: 'hsl(var(--card))', // Use card background
              color: 'hsl(var(--card-foreground))', // Use card foreground
              borderRadius: 'var(--radius)',
            },
            buttonNext: {
              backgroundColor: 'hsl(var(--primary))',
            },
            buttonBack: {
              color: 'hsl(var(--muted-foreground))',
            },
          }}
        />
     )}

      {/* Confetti Effect */}
      {showConfetti && <Confetti recycle={false} numberOfPieces={300} />}

    <div className="flex flex-col min-h-screen bg-background text-foreground p-4 md:p-8">
      {/* Header */}
       <header className="flex justify-between items-center mb-6 md:mb-8">
          <Link href="/" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-gradient">VibeFlow</h1>
          </Link>
        <div className="flex items-center gap-3 md:gap-4">
           {/* Quota/XP Display */}
           {dbSetupError ? (
                <Tooltip>
                   <TooltipTrigger asChild>
                       <div id="quota-display-tooltip-trigger" className="flex items-center gap-1 text-sm text-destructive cursor-help" onClick={() => toast({ title: "Database Error", description: dbSetupError, variant: "destructive", duration: 10000 })}>
                           <Database className="h-4 w-4" />
                           <span>DB Error</span>
                       </div>
                   </TooltipTrigger>
                   <TooltipContent><p>Database setup required. Click for details.</p></TooltipContent>
               </Tooltip>
           ) : quota !== null || profile !== null ? ( // Show if either quota or profile (for XP) is loaded
             <Tooltip>
               <TooltipTrigger asChild>
                  <div id="quota-display-tooltip-trigger" className="flex flex-col items-end cursor-help">
                      {/* XP Display */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                         <BrainCircuit className="h-3 w-3 text-purple-400"/>
                         <span>{xp.toLocaleString()} XP</span>
                      </div>
                      {/* Quota Progress Bar */}
                      {quota !== null && (
                        <Progress value={quotaPercentage} className="w-20 h-1 mt-0.5" title={`${quotaUsed}/${quotaLimit} requests used`} />
                      )}
                  </div>
               </TooltipTrigger>
               <TooltipContent side="bottom" align="end">
                 {quota !== null ? (
                    <p>{quotaRemaining} requests remaining this month.</p>
                 ) : (
                    <p>Quota loading...</p>
                 )}
                  <p>{xp.toLocaleString()} XP earned.</p>
               </TooltipContent>
             </Tooltip>
           ) : (
               <div className="flex items-center gap-1 text-sm text-muted-foreground">
                   <Loader2 className="h-4 w-4 animate-spin"/>
                   <span>Loading...</span>
               </div>
           )}

          {/* Profile Button/Dialog Trigger */}
          <Tooltip>
             <TooltipTrigger asChild>
                  <Button id="profile-button-tooltip-trigger" variant="ghost" size="icon" onClick={() => setIsProfileDialogOpen(true)} disabled={!!dbSetupError}>
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
             <Database className="h-4 w-4" />
            <AlertTitle>Database Setup Required</AlertTitle>
            <AlertDescription>
              {dbSetupError}
            </AlertDescription>
          </Alert>
        )}

       {/* Quota Exceeded Alert */}
       {quotaExceeded && !dbSetupError && (
          <Alert variant="destructive" className="mb-6">
             <Info className="h-4 w-4" />
            <AlertTitle>Quota Limit Reached</AlertTitle>
            <AlertDescription>
              You've used all your requests for this month. Please{' '}
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
            <CardDescription>Enter URL or text, choose a persona, and generate posts.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col gap-4"> {/* Added gap */}
             {/* Persona Selector */}
             <div className="w-full sm:w-1/2 md:w-1/3"> {/* Limit width */}
                <Label htmlFor="persona-select">AI Persona</Label>
                 <Select value={persona} onValueChange={(value) => setPersona(value as Persona)}>
                   <SelectTrigger id="persona-select-trigger" className="w-full" disabled={isDisabled}>
                     <SelectValue placeholder="Select Persona" />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="default">Default</SelectItem>
                     <SelectItem value="tech_ceo">Tech CEO</SelectItem>
                     <SelectItem value="casual_gen_z">Casual Gen Z</SelectItem>
                     <SelectItem value="thought_leader">Thought Leader</SelectItem>
                     <SelectItem value="meme_lord">Meme Lord</SelectItem>
                   </SelectContent>
                 </Select>
              </div>
            <Textarea
              id="content-input-textarea"
              placeholder="Paste your content or URL here..."
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              className="min-h-[200px] md:min-h-[300px] lg:min-h-[350px] bg-input/50 border-border/50 text-base resize-none flex-grow" // Use flex-grow
              disabled={isDisabled}
              suppressHydrationWarning
            />
          </CardContent>
          <CardFooter>
            <Button
              id="generate-posts-button"
              onClick={handleGenerate}
              disabled={isDisabled || !contentInput.trim() || !profile?.gemini_api_key}
              loading={isGeneratingSummary || isGeneratingPosts}
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
            <CardDescription>Review, analyze, tune, and publish your social media posts.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
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

            {summary && Object.keys(postDrafts).length > 0 && !dbSetupError && (
              <Tabs defaultValue="linkedin" className="w-full flex flex-col h-full">
                <TabsList id="output-tabs-list" className="grid w-full grid-cols-3 bg-muted/50 mb-4 shrink-0">
                  <TabsTrigger value="linkedin"><Linkedin className="h-4 w-4 mr-1 inline"/> LinkedIn</TabsTrigger>
                  <TabsTrigger value="twitter"><Twitter className="h-4 w-4 mr-1 inline"/> Twitter</TabsTrigger>
                  <TabsTrigger value="youtube"><Youtube className="h-4 w-4 mr-1 inline"/> YouTube</TabsTrigger>
                </TabsList>

                {(['linkedin', 'twitter', 'youtube'] as SocialPlatform[]).map((platform) => (
                  <TabsContent key={platform} value={platform} className="flex-grow mt-0">
                    <div className="flex gap-4 h-full"> {/* Flex container for post and advisor */}
                         {/* Post Card */}
                        <Card className="bg-background border-border/50 h-full flex flex-col flex-grow">
                          <CardContent className="p-4 space-y-4 relative flex-grow">
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
                                  onChange={(e) => setPostDrafts(prev => ({...prev, [platform]: e.target.value}))} // Allow editing
                                  className="min-h-[150px] bg-input/30 border-border/30 resize-none text-sm h-full"
                                  suppressHydrationWarning
                                />
                             )}
                            {/* Tuning Buttons */}
                            {!postDrafts[platform]?.startsWith("Error generating") && (
                                 <div className="flex flex-wrap gap-2 shrink-0 pt-2 tune-buttons-group"> {/* Added class */}
                                  <span className="text-xs text-muted-foreground mr-2 mt-1.5">Tune:</span>
                                   <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'Make wittier')} disabled={isDisabled || !postDrafts[platform] || isTuning[platform]}>Witty</Button>
                                   <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'More concise')} disabled={isDisabled || !postDrafts[platform] || isTuning[platform]}>Concise</Button>
                                   <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'More professional')} disabled={isDisabled || !postDrafts[platform] || isTuning[platform]}>Professional</Button>
                                   <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'Add emojis')} disabled={isDisabled || !postDrafts[platform] || isTuning[platform]}>Add Emojis ✨</Button>
                                 </div>
                            )}
                          </CardContent>
                          {/* Footer */}
                          {!postDrafts[platform]?.startsWith("Error generating") && (
                              <CardFooter className="flex justify-end gap-2 shrink-0 pt-0">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                         {/* AI Advisor Button */}
                                         <Button
                                           variant="ghost"
                                           size="icon"
                                           onClick={() => handleAnalyzePost(platform)}
                                           disabled={isDisabled || !postDrafts[platform] || analysisStates[platform]}
                                           loading={analysisStates[platform]}
                                           className="ai-advisor-button" // Added class
                                         >
                                            <Sparkles className="h-4 w-4 text-purple-400" />
                                         </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>AI Advisor: Analyze Post</p></TooltipContent>
                                </Tooltip>

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
                                      {/* Conditional rendering for publish button */}
                                       <Button
                                         onClick={() => handlePublishPost(platform)}
                                         disabled={isDisabled || !postDrafts[platform] || !profile?.composio_mcp_url || !profile?.[`${platform}_url` as keyof Profile] || isPublishing[platform]}
                                         loading={isPublishing[platform]}
                                         size="sm"
                                       >
                                         <Send className="mr-1.5 h-4 w-4" /> Publish
                                       </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {!profile?.composio_mcp_url || !profile?.[`${platform}_url` as keyof Profile]
                                      ? <p>Add Composio MCP & {platform} URLs in profile</p>
                                      : <p>Publish this post (placeholder)</p>
                                    }
                                  </TooltipContent>
                                </Tooltip>
                              </CardFooter>
                           )}
                        </Card>

                         {/* AI Advisor Panel */}
                        <AiAdvisorPanel
                           isOpen={!!showAiAdvisor[platform]}
                           isLoading={!!analysisStates[platform]}
                           analysis={analysisResults[platform]}
                           onApplySuggestion={(start, end, suggestion) => handleApplySuggestion(platform, start, end, suggestion)}
                           onClose={() => setShowAiAdvisor(prev => ({ ...prev, [platform]: false }))}
                        />

                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>

      </main>

      {/* Footer */}
      <footer className="text-center mt-8 text-xs text-muted-foreground">
        Powered by Gemini & Composio | Built for the Hackathon
      </footer>

       {/* Profile Dialog */}
       <ProfileDialog
          isOpen={isProfileDialogOpen}
          onOpenChange={setIsProfileDialogOpen}
          user={user}
          initialProfile={profile}
          initialQuota={quota}
          onProfileUpdate={handleProfileUpdate}
          // Pass current XP and badges to dialog for display consistency
          initialXp={xp}
          initialBadges={badges}
          dbSetupError={dbSetupError}
        />
    </div>
    </TooltipProvider>
  );
}
