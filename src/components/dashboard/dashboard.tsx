// dashboard.tsx
'use client';

import type { User } from '@supabase/supabase-js';
import type { Profile, Quota } from '@/types/supabase';
import { useState, useTransition, useEffect, useCallback, useRef } from 'react'; // Added useRef
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'; // Added SelectGroup, SelectLabel
import { useToast } from "@/hooks/use-toast";
import { LogOut, Loader2, Bot, Twitter, Linkedin, Youtube, Copy, Send, Wand2, Info, BarChart, User as UserIcon, Database, Zap, Sparkles, Trophy, Star, BrainCircuit, HelpCircle, Hash, Smile, Palette, Settings2, Fuel, CreditCard, Key, Lock, Lightbulb, X, ChevronRight } from 'lucide-react'; // Added icons
import { summarizeContent, type SummarizeContentOutput } from '@/ai/flows/summarize-content';
import { generateSocialPosts, type GenerateSocialPostsOutput } from '@/ai/flows/generate-social-posts';
import { tuneSocialPosts, type TuneSocialPostsOutput } from '@/ai/flows/tune-social-posts';
import { analyzePost, type AnalyzePostOutput } from '@/ai/flows/analyze-post'; // Added analyzePost
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from 'next/link';
import { ProfileDialog } from './profile-dialog'; // Import the profile dialog
import { Progress } from "@/components/ui/progress"; // Import Progress component
import AiAdvisorPanel from './ai-advisor-panel'; // Import AI Advisor Panel
import { toast as sonnerToast } from 'sonner'; // Import sonner toast for confetti effect
import Confetti from 'react-confetti';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride'; // Import STATUS
import { Separator } from '@/components/ui/separator'; // Import Separator
import BoostPanel from './boost-panel';
import ToneTunerSheet from './tone-tuner-sheet';
import HelpModal from './help-modal';
import PreviewMockup from './preview-mockup';
import { cn } from "@/lib/utils"; // Import cn utility function


// Persona types and mapping (updated with optgroups)
type Persona = 'default' | 'tech_ceo' | 'casual_gen_z' | 'thought_leader' | 'meme_lord' | 'formal_pro' | 'fun_vibes';
const PERSONAS: Record<string, { label: string; prompt?: string; group: string }> = {
  'default': { label: 'Default', group: 'General' },
  'casual_gen_z': { label: 'Casual Gen Z', prompt: 'Write in a laid-back, emoji-friendly style...', group: 'Casual' },
  'fun_vibes': { label: 'Fun Vibes', prompt: 'Write in an upbeat, playful, and engaging tone...', group: 'Casual' },
  'meme_lord': { label: 'Meme Lord', prompt: 'Write like an internet meme lord, witty and sarcastic...', group: 'Casual' },
  'tech_ceo': { label: 'Tech CEO', prompt: 'Write like a visionary, authoritative tech CEO...', group: 'Professional' },
  'thought_leader': { label: 'Thought Leader', prompt: 'Write like an insightful industry thought leader...', group: 'Professional' },
  'formal_pro': { label: 'Formal Pro', prompt: 'Write in a strictly formal and professional business tone...', group: 'Professional' },
};
const PERSONA_GROUPS = Array.from(new Set(Object.values(PERSONAS).map(p => p.group)));

// Define default quota limit
const DEFAULT_QUOTA_LIMIT = 100;
const XP_PER_REQUEST = 10;

// Badge definitions and XP meter structure
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
  initialXp: number;
  initialBadges: string[];
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
  const searchParams = useSearchParams();
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
  const [persona, setPersona] = useState<Persona>('default');
  const [analysisStates, setAnalysisStates] = useState<AnalysisStates>({});
  const [analysisResults, setAnalysisResults] = useState<AnalysisResults>({});
  const [showAiAdvisor, setShowAiAdvisor] = useState<Partial<Record<SocialPlatform, boolean>>>({});
  const [showConfetti, setShowConfetti] = useState(false);
  const [runOnboarding, setRunOnboarding] = useState(false);
  const [lastAwardedBadge, setLastAwardedBadge] = useState<string | null>(null);
  const [xp, setXp] = useState<number>(initialXp);
  const [badges, setBadges] = useState<string[]>(initialBadges);
  const [isClient, setIsClient] = useState(false);
  const [isBoostPanelOpen, setIsBoostPanelOpen] = useState(false); // State for Boost Panel
  const [isToneSheetOpen, setIsToneSheetOpen] = useState(false); // State for Tone Tuner
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false); // State for Help Modal
  const [activeTab, setActiveTab] = useState<SocialPlatform>('linkedin'); // State for active tab
  const outputTextareaRef = useRef<HTMLTextAreaElement>(null); // Ref for output textarea

   // --- Derived State ---
   const quotaUsed = quota?.request_count ?? 0;
   const quotaLimit = quota?.quota_limit ?? DEFAULT_QUOTA_LIMIT;
   const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
   const quotaPercentage = quotaLimit > 0 ? Math.min(100, (quotaUsed / quotaLimit) * 100) : 0; // Cap at 100%
   const quotaExceeded = quotaUsed >= quotaLimit && !!quota; // >= to include exactly 100%

   // --- Effects ---

   useEffect(() => {
    setIsClient(true);
  }, []);

  // Effect to show toast messages (removed Composio logic)
  useEffect(() => {
    // Placeholder for any future toast logic based on search params
    const message = searchParams.get('message');
    if (message) {
      toast({ title: "Notification", description: message });
      // Clean the URL (optional)
      // router.replace('/dashboard', undefined); // Use router.replace to avoid history stack pollution
    }
  }, [searchParams, toast, router]);


   // Function to check and award badges (Defined earlier)
   const checkAndAwardBadges = useCallback(async (currentXp: number, currentBadges: string[]) => {
        let newlyAwardedBadge: string | null = null;
        let updatedBadges = [...currentBadges]; // Start with current badges

        for (const badge of BADGES) {
            // Check if XP threshold is met AND the badge hasn't been awarded yet
            if (currentXp >= badge.xp && !updatedBadges.includes(badge.name)) {
                 console.log(`Badge condition met: ${badge.name}`);
                 newlyAwardedBadge = badge.name; // Store the latest badge to award
                 updatedBadges.push(badge.name); // Add to the array we will update with
            }
        }

        // If new badges were found, update state and DB
        if (newlyAwardedBadge && user?.id) { // Check if user.id exists
             setBadges(updatedBadges); // Optimistic UI update

             const { error } = await supabase
               .from('profiles')
               .update({ badges: updatedBadges }) // Use the updated badges array
               .eq('id', user.id);

             if (error) {
                   console.error(`Failed to save badges to database:`, error);
                   toast({ title: "Badge Save Error", description: `Could not save newly earned badges.`, variant: "destructive"});
                   // Revert optimistic UI update
                   setBadges(currentBadges);
             } else {
                  console.log(`Badges saved to DB: ${updatedBadges.join(', ')}`);
                  // Update the main profile state as well after DB success
                   setProfile(prev => prev ? { ...prev, badges: updatedBadges } : null);

                   // Notify about the *last* newly awarded badge
                   const badgeInfo = BADGES.find(b => b.name === newlyAwardedBadge);
                    if (badgeInfo && newlyAwardedBadge !== lastAwardedBadge) {
                       setShowConfetti(true);
                       sonnerToast.success(`Badge Unlocked: ${badgeInfo.name}!`, {
                         description: badgeInfo.description,
                         duration: 5000,
                         icon: <badgeInfo.icon className="text-green-500" />,
                       });
                       setLastAwardedBadge(newlyAwardedBadge);
                       setTimeout(() => setShowConfetti(false), 5000);
                    }
             }
        }

   }, [supabase, user?.id, toast, lastAwardedBadge]); // Added user.id dependency


  // Fetch or confirm profile/quota data on client-side if needed (minor adjustments)
  useEffect(() => {
    const ensureData = async () => {
      let currentProfile = profile;
      let currentQuota = quota;
      let setupErrorMsg: string | null = null;

      // --- Ensure Profile ---
       if (!currentProfile) {
         try {
            console.log("Attempting to fetch profile via RPC on client...");
            const { data, error } = await supabase
              .rpc('get_user_profile', { p_user_id: user.id });

             if (error) {
                  console.error("Error fetching/creating profile on client:", error.message);
                  if (error.message.includes("function public.get_user_profile") && error.message.includes("does not exist")) {
                      setupErrorMsg = "Database setup incomplete: Missing 'get_user_profile' function. Please run the SQL script from `supabase/schema.sql`. See README Step 3.";
                  } else if (error.message.includes("relation") && error.message.includes("does not exist")) {
                       setupErrorMsg = `Database setup incomplete: Missing required table or relation (${error.message}). Please run the SQL script from \`supabase/schema.sql\`. See README Step 3.`;
                  } else if (error.message.includes("permission denied")) {
                      setupErrorMsg = "Database access error: Permission denied for profile data. Check Row Level Security policies. See README Step 3.";
                   } else if (error.message.includes("Could not find the") && error.message.includes("column") && error.message.includes("in the schema cache")) {
                      const missingColumnMatch = error.message.match(/'(.*?)'/);
                      const missingColumn = missingColumnMatch ? missingColumnMatch[1] : 'unknown';
                      setupErrorMsg = `Database schema mismatch: Column '${missingColumn}' not found. Run the latest 'supabase/schema.sql'. See README Step 3.`;
                  } else {
                     toast({ title: "Profile Error", description: `Could not load your profile data: ${error.message}`, variant: "destructive" });
                     setupErrorMsg = `Profile Error: ${error.message}`; // Use the error message directly
                  }
                  if (setupErrorMsg) setDbSetupError(setupErrorMsg);
             } else if (data && Array.isArray(data) && data.length > 0) {
                 console.log("Profile fetched successfully on client.");
                 currentProfile = data[0] as Profile;
                 setProfile(currentProfile);
                 setXp(currentProfile.xp ?? initialXp);
                 setBadges(currentProfile.badges ?? initialBadges);
                 if (!setupErrorMsg) setDbSetupError(null); // Clear error if profile fetch succeeds
             } else {
                 console.warn("Profile still null/empty after calling get_user_profile on client");
                 // Set a specific error message if profile is unexpectedly null
                 setupErrorMsg = "Failed to load or initialize user profile data. Please try logging out and back in or check DB schema (README Step 3).";
                 toast({ title: "Profile Error", description: setupErrorMsg, variant: "destructive" });
                 setDbSetupError(setupErrorMsg);
             }
         } catch (error: any) {
             console.error("Unexpected client error fetching/creating profile:", error.message);
             setupErrorMsg = `Unexpected error loading profile data. Check console. Details: ${error.message}`;
             toast({ title: "Profile Error", description: setupErrorMsg, variant: "destructive" });
             setDbSetupError(setupErrorMsg);
         }
      } else {
         // Profile already exists, sync XP/badges from initial props if needed
         setXp(currentProfile.xp ?? initialXp);
         setBadges(currentProfile.badges ?? initialBadges);
         if (!setupErrorMsg) setDbSetupError(null); // Clear error if profile exists
      }


      // --- Ensure Quota ---
      if (!currentQuota && !setupErrorMsg) { // Only fetch quota if profile is okay
        try {
          console.log("Attempting to fetch quota via RPC on client...");
          // Use get_remaining_quota first, as it handles potential resets
          const { data: remainingQuotaRpc, error: rpcError } = await supabase
             .rpc('get_remaining_quota', { p_user_id: user.id });

           if (rpcError) {
             console.error('Error calling get_remaining_quota RPC:', rpcError.message);
             let errorMsg = `Failed to load usage data: ${rpcError.message}`;
             // Check for specific errors indicating setup issues
             if (rpcError.message.includes("function public.get_remaining_quota") && rpcError.message.includes("does not exist")) {
                 errorMsg = "Database setup incomplete: Missing 'get_remaining_quota' function. Run setup script.";
             } else if (rpcError.message.includes("relation") && rpcError.message.includes("does not exist")) {
                 errorMsg = `Database setup incomplete: Missing required table or relation (${rpcError.message}). Run setup script.`;
             } else if (rpcError.message.includes("permission denied")) {
                 errorMsg = "Database access error: Permission denied for 'get_remaining_quota'. Check RLS/function security.";
             } else if (rpcError.message.includes("406")) { // Handle 406 Not Acceptable, often RLS related
                 errorMsg = `Database access error: Could not fetch quota (406). Check RLS policies/function return type.`;
                 toast({ title: "Quota Load Error", description: "Could not retrieve usage details (406).", variant: "destructive" });
             }
             setupErrorMsg = errorMsg;
             toast({ title: 'Quota Error', description: errorMsg, variant: 'destructive' });
             setDbSetupError(setupErrorMsg); // Set DB setup error
           } else if (typeof remainingQuotaRpc === 'number') {
               // Quota function executed, now fetch the full details
               console.log("RPC get_remaining_quota successful, fetching full details...");
               const { data: quotaDetails, error: selectError } = await supabase
                 .from('quotas')
                 .select('*') // Select all columns
                 .eq('user_id', user.id)
                 .maybeSingle(); // Use maybeSingle to handle potentially missing rows

               if (selectError && selectError.code !== 'PGRST116') { // Ignore 'PGRST116' (No rows found)
                   console.error('Error fetching quota details after RPC:', selectError.message);
                   let errorMsg = `Failed to load full usage details: ${selectError.message}`;
                    if (selectError.message.includes("relation") && selectError.message.includes("does not exist")) {
                      errorMsg = `Database setup incomplete: Missing required table (${selectError.message}). Run setup script.`;
                    } else if (selectError.message.includes("permission denied")) {
                      errorMsg = "Database access error: Permission denied for 'quotas' table. Check RLS.";
                    } else if (selectError.message.includes("406")) {
                        errorMsg = `Config issue: Could not fetch quota details (406). Check RLS/table access.`;
                        toast({ title: "Quota Load Error", description: "Could not retrieve usage details (406).", variant: "destructive" });
                    }
                   if (!setupErrorMsg) setupErrorMsg = errorMsg; // Prioritize previous errors
                   toast({ title: 'Quota Error', description: errorMsg, variant: 'destructive' });
                   setDbSetupError(setupErrorMsg);
               } else if (quotaDetails) {
                   console.log("Quota details fetched successfully on client.");
                   currentQuota = quotaDetails as Quota;
                   setQuota(currentQuota);
                   if (!setupErrorMsg) setDbSetupError(null); // Clear error if quota fetch succeeds
               } else {
                   // This case means get_remaining_quota worked, but no row exists in quotas table yet.
                   // This might happen if the increment_quota/get_remaining_quota functions handle upsert logic.
                   // We can construct a temporary quota object based on the RPC result.
                   console.log("Quota record not found, constructing temporary quota state from RPC result.");
                   const limit = DEFAULT_QUOTA_LIMIT; // Assume default limit
                   const used = limit - remainingQuotaRpc;
                   const nowISO = new Date().toISOString();
                   currentQuota = {
                       user_id: user.id,
                       request_count: Math.max(0, used), // Ensure count isn't negative
                       quota_limit: limit,
                       last_reset_at: nowISO, // Placeholder, real reset time is managed by DB function
                       created_at: nowISO,    // Placeholder
                       ip_address: null       // Placeholder
                   };
                   setQuota(currentQuota);
                   if (!setupErrorMsg) setDbSetupError(null);
               }
           } else {
               // get_remaining_quota returned something unexpected (not null, not number)
               console.warn("get_remaining_quota RPC returned unexpected data:", remainingQuotaRpc);
               if (!setupErrorMsg) setupErrorMsg = "Could not determine quota state from database function.";
               toast({ title: 'Quota Error', description: setupErrorMsg, variant: 'destructive' });
               setDbSetupError(setupErrorMsg);
           }
        } catch (err: any) {
          console.error('Unexpected error fetching quota:', err.message);
          if (!setupErrorMsg) setupErrorMsg = `Unexpected error loading usage data: ${err.message}`;
          toast({ title: 'Quota Error', description: setupErrorMsg, variant: 'destructive' });
          setDbSetupError(setupErrorMsg);
        }
      } else if (setupErrorMsg) {
          // If there was a profile error, make sure dbSetupError reflects it
          setDbSetupError(setupErrorMsg);
      } else if (currentQuota && currentProfile) {
          // Both profile and quota exist, clear any transient setup error
           setDbSetupError(null);
      }
    };
    ensureData();
  }, [user.id, supabase, toast, profile, quota, dbSetupError, initialXp, initialBadges, initialQuota, initialProfile, checkAndAwardBadges]); // Dependencies adjusted


  // Effect to check onboarding status only on client-side after profile is loaded
  useEffect(() => {
    if (isClient && profile && !profile.badges?.includes('onboarded') && !dbSetupError) { // Don't run onboarding if DB error
      setRunOnboarding(true);
    }
  }, [isClient, profile, dbSetupError]);


  // Effect for Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+H or Cmd+H to open Help Modal
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        setIsHelpModalOpen(prev => !prev);
      }
      // Add other shortcuts here if needed
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty dependency array ensures this runs once on mount


   // Function to handle profile updates from the dialog
   const handleProfileUpdate = useCallback((updatedProfile: Profile) => {
    setProfile(updatedProfile);
    // Update local state for XP and badges based on the updated profile
    const newXp = updatedProfile.xp ?? 0; // Default to 0 if null
    const newBadges = updatedProfile.badges ?? []; // Default to empty array if null
    setXp(newXp);
    setBadges(newBadges);
    // Check for new badges earned due to XP update
    checkAndAwardBadges(newXp, newBadges);
    toast({ title: "Profile Updated", description: "Your profile information has been saved." });
  }, [toast, checkAndAwardBadges]); // Include checkAndAwardBadges in dependencies


  // Check for badge awards whenever XP or badges change
  useEffect(() => {
    checkAndAwardBadges(xp, badges);
  }, [xp, badges, checkAndAwardBadges]); // Added checkAndAwardBadges dependency


   // Function to check quota and increment if allowed
  const checkAndIncrementQuota = useCallback(async (incrementAmount: number = 1): Promise<boolean> => {
     if (dbSetupError) {
         toast({ title: "Database Error", description: `Cannot process request due to database setup issue: ${dbSetupError}`, variant: "destructive" });
         return false;
     }
      if (!user?.id) { // Check if user ID is available
          toast({ title: "Authentication Error", description: "User not identified. Cannot update quota.", variant: "destructive" });
          return false;
      }

     let currentRemaining = quotaRemaining;
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
                   } else if (fetchError.message.includes("406")) {
                       setDbSetupError("Database access error: Could not fetch quota (406). Check RLS/function return type.");
                       toast({ title: "Quota Load Error", description: "Could not retrieve usage details (406).", variant: "destructive" });
                   } else {
                       toast({ title: "Quota Check Error", description: `Failed to check usage limit: ${fetchError.message}`, variant: "destructive" });
                   }
                  return false;
              }
              if (typeof fetchedQuotaRemaining === 'number') {
                  currentRemaining = fetchedQuotaRemaining;
                  console.log("Fetched remaining quota via RPC:", currentRemaining);
                  // Update local state if quota was null before
                  const limit = DEFAULT_QUOTA_LIMIT;
                  const used = limit - currentRemaining;
                  setQuota(prev => ({
                      ...prev, // Keep potential other fields if they exist
                      user_id: user.id,
                      request_count: Math.max(0, used),
                      quota_limit: limit,
                      last_reset_at: prev?.last_reset_at || new Date().toISOString() // Keep existing or set placeholder
                  }));

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
       // Optionally update quota state to reflect limit reached
       if (quota) setQuota(prev => prev ? {...prev, request_count: prev.quota_limit ?? DEFAULT_QUOTA_LIMIT} : null);
       return false;
     }

     // Optimistic UI Update
     const optimisticQuotaUsed = (quota?.request_count ?? 0) + incrementAmount;
     const optimisticQuota = quota ? { ...quota, request_count: optimisticQuotaUsed } : null;
     if (optimisticQuota) setQuota(optimisticQuota);

     const optimisticXp = xp + (incrementAmount * XP_PER_REQUEST);
     setXp(optimisticXp);


    // --- Call increment_quota RPC ---
    try {
        console.log(`Attempting to increment quota by ${incrementAmount} for user ${user.id}`);
        const { data: newRemainingRpc, error } = await supabase.rpc('increment_quota', {
           p_user_id: user.id,
           p_increment_amount: incrementAmount
        });

       if (error) {
          // Revert optimistic updates on error
          setQuota(quota);
          setXp(xp);

          console.error("Error incrementing quota RPC:", error.message);
          if (error.message.includes("quota_exceeded")) {
             toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
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

       // --- Refetch data after successful RPC ---
        console.log("Quota increment RPC successful, refetching data...");
        // Use Promise.allSettled to handle potential errors during refetch gracefully
        const [quotaResult, profileResult] = await Promise.allSettled([
            supabase
                .from('quotas')
                .select('*') // Select all columns
                .eq('user_id', user.id)
                .single(),
            supabase
                .from('profiles')
                .select('*, xp, badges') // Explicitly select XP and badges
                .eq('id', user.id)
                .single()
        ]);

        // Process quota refetch result
        if (quotaResult.status === 'fulfilled' && quotaResult.value.data) {
             console.log("Refetched quota data:", quotaResult.value.data);
             setQuota(quotaResult.value.data as Quota);
        } else if (quotaResult.status === 'rejected' || (quotaResult.status === 'fulfilled' && quotaResult.value.error)) {
            const fetchQuotaError = quotaResult.status === 'rejected' ? quotaResult.reason : quotaResult.value.error;
            console.error("Error fetching quota after increment:", fetchQuotaError?.message || fetchQuotaError);
            toast({ title: "Quota Update Warning", description: "Usage updated, but failed to refresh details.", variant: "default" });
            // Keep optimistic state if refetch fails
        }

        // Process profile refetch result
        if (profileResult.status === 'fulfilled' && profileResult.value.data) {
            console.log("Refetched profile data:", profileResult.value.data);
            const completeProfile = profileResult.value.data as Profile;
            setProfile(completeProfile); // Update profile state
            const newXp = completeProfile.xp ?? 0; // Use 0 as default
            const newBadges = completeProfile.badges ?? []; // Use [] as default
            setXp(newXp);
            setBadges(newBadges);
            checkAndAwardBadges(newXp, newBadges); // Check for badges
        } else if (profileResult.status === 'rejected' || (profileResult.status === 'fulfilled' && profileResult.value.error)) {
            const fetchProfileError = profileResult.status === 'rejected' ? profileResult.reason : profileResult.value.error;
            console.error("Error fetching profile after increment:", fetchProfileError?.message || fetchProfileError);
             toast({ title: "Profile Update Warning", description: "Usage updated, but failed to refresh profile data (XP/badges).", variant: "default" });
             // Keep optimistic XP/badge state
        }

       // Final check based on RPC return value (optional, as refetch is more reliable)
       if (typeof newRemainingRpc === 'number' && newRemainingRpc < 0) {
           // This indicates the RPC itself detected exceeding quota, update state if refetch missed it
           if (quota && quota.request_count < (quota.quota_limit ?? DEFAULT_QUOTA_LIMIT)) {
               setQuota(prev => prev ? {...prev, request_count: prev.quota_limit ?? DEFAULT_QUOTA_LIMIT} : null);
           }
           toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
           return false;
       }

      return true; // Increment successful
    } catch (rpcError: any) {
        // Revert optimistic updates on unexpected catch
        setQuota(quota);
        setXp(xp);
        console.error("Unexpected Error calling increment_quota RPC:", rpcError.message);
        toast({ title: "Quota Error", description: `An unexpected error occurred updating usage: ${rpcError.message}`, variant: "destructive" });
        return false;
    }
  }, [dbSetupError, quota, quotaRemaining, quotaLimit, xp, supabase, user?.id, toast, checkAndAwardBadges]); // Added user.id


  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Error Signing Out", description: error.message, variant: "destructive" });
    } else {
      setProfile(null);
      setQuota(null);
      setXp(0);
      setBadges([]);
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

    const COST = 4; // 1 for summary + 3 for posts
    if (!await checkAndIncrementQuota(COST)) return;

    setIsGeneratingSummary(true);
    setIsGeneratingPosts(true);
    setSummary(null);
    setPostDrafts({});
    setAnalysisResults({});
    setShowAiAdvisor({});

    const apiKey = profile.gemini_api_key;
    let summarySuccess = false;
    let postsSuccessCount = 0;
    let summaryErrorOccurred = false;

    startTransition(async () => {
        let summaryResult: SummarizeContentOutput | null = null;
        try {
            console.log("Starting summarization...");
            summaryResult = await summarizeContent({ content: contentInput }, { apiKey });
            if (summaryResult?.summary) {
                setSummary(summaryResult.summary);
                summarySuccess = true;
                console.log("Summarization successful:", summaryResult);
            } else {
                throw new Error("AI returned an empty summary.");
            }
        } catch (summaryError: any) {
            summaryErrorOccurred = true;
            console.error("Summarization failed:", summaryError);
            let description = `Summarization failed: ${summaryError.message || 'Unknown AI error'}`;
            if (summaryError.message?.includes("parsing")) {
                description = "Could not parse content from URL. Check URL or paste text.";
            } else if (summaryError.status === 'UNAUTHENTICATED' || summaryError.message?.includes("API key not valid")) {
                description = "Invalid Gemini API Key. Check profile.";
                setIsProfileDialogOpen(true);
            } else if (summaryError.status === 'UNAVAILABLE') {
                description = `AI service for summarization was unavailable. Please try again later.`;
            } else if (summaryError.status === 'RESOURCE_EXHAUSTED') {
                description = `AI rate limit hit during summarization. Please check quota or try later.`;
            } else if (summaryError.message?.includes("empty summary")) {
                description = "Summarization failed: AI returned an empty result after retries.";
            }
            toast({ title: "Summarization Failed", description, variant: "destructive" });
        } finally {
            setIsGeneratingSummary(false);
        }

        if (summarySuccess && summaryResult) {
            console.log("Starting post generation...");
            const platforms: SocialPlatform[] = ['linkedin', 'twitter', 'youtube'];
            const postPromises = platforms.map(platform =>
                generateSocialPosts({ summary: summaryResult!.summary, platform }, { apiKey }) // Removed persona for simplicity, assuming persona logic is handled internally or via prompt tuning if needed
                .then(result => {
                    if (result?.post) {
                        postsSuccessCount++;
                        console.log(`Post generation for ${platform} successful.`);
                        return { platform, post: result.post };
                    } else {
                        throw new Error(`AI returned an empty post for ${platform}.`);
                    }
                })
                .catch(async (err) => {
                    console.error(`Error generating ${platform} post:`, err);
                    let description = `Post generation for ${platform} failed: ${err.message || 'Unknown AI error'}`;
                     if (err.status === 'UNAUTHENTICATED' || err.message?.includes("API key not valid")) {
                       description = "Invalid Gemini API Key. Check profile.";
                       setIsProfileDialogOpen(true);
                    } else if (err.status === 'UNAVAILABLE') {
                        description = `AI service for ${platform} post generation was unavailable. Try later.`;
                    } else if (err.status === 'RESOURCE_EXHAUSTED') {
                        description = `AI rate limit hit generating ${platform} post. Check quota or try later.`;
                    } else if (err.message?.includes("empty post")) {
                       description = `Generation for ${platform} failed: AI returned empty result after retries.`;
                    }
                    toast({ title: `Post Gen Failed (${platform})`, description, variant: "destructive" });
                    return { platform, post: `Error generating post for ${platform}. ${description}` }; // Include error in draft
                })
            );
            const results = await Promise.all(postPromises);
            const newDrafts = results.reduce((acc, { platform, post }) => {
                acc[platform] = post;
                return acc;
            }, {} as PostDrafts);
            setPostDrafts(newDrafts);
        } else {
            // No successful summary, clear drafts
            setPostDrafts({});
        }

        // Calculate and apply refund if necessary
        const actualCost = (summarySuccess ? 1 : 0) + postsSuccessCount;
        const refundAmount = COST - actualCost;
        if (refundAmount > 0 && user?.id) {
            console.log(`Refunding ${refundAmount} quota points due to errors.`);
            try {
                const { error: refundRpcError } = await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -refundAmount });
                 if (refundRpcError) {
                     console.error("Error during quota refund RPC:", refundRpcError.message);
                 } else {
                     // Refetch locally without toast after refund
                    const [quotaResult, profileResult] = await Promise.allSettled([
                         supabase.from('quotas').select('*').eq('user_id', user.id).single(),
                         supabase.from('profiles').select('*, xp, badges').eq('id', user.id).single()
                    ]);
                    if (quotaResult.status === 'fulfilled' && quotaResult.value.data) setQuota(quotaResult.value.data as Quota);
                     if (profileResult.status === 'fulfilled' && profileResult.value.data) {
                         const completeProfile = profileResult.value.data as Profile;
                         setProfile(completeProfile);
                          const newXp = completeProfile.xp ?? 0;
                          const newBadges = completeProfile.badges ?? [];
                          setXp(newXp);
                          setBadges(newBadges);
                         checkAndAwardBadges(newXp, newBadges);
                     }
                 }
            } catch (refundCatchError: any) {
                 console.error("Unexpected Error during quota refund attempt:", refundCatchError.message);
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

    const COST = 1;
    if (!await checkAndIncrementQuota(COST)) return;

    setIsTuning(prev => ({ ...prev, [platform]: true }));
    setAnalysisResults(prev => ({ ...prev, [platform]: null })); // Clear analysis on tune
    const apiKey = profile.gemini_api_key;
    let tuneSuccess = false;
    let tuneErrorOccurred = false;

    startTransition(async () => {
        try {
            console.log(`Starting tuning for ${platform} with feedback: "${feedback}"`);
            const tunedResult = await tuneSocialPosts({ originalPost, feedback, platform }, { apiKey });
            if (tunedResult?.tunedPost) {
                setPostDrafts(prev => ({ ...prev, [platform]: tunedResult.tunedPost }));
                toast({ title: "Post Tuned!", description: `Applied feedback: "${feedback}"`, variant: "default" });
                tuneSuccess = true;
                console.log(`Tuning for ${platform} successful.`);
            } else {
                throw new Error(`AI returned an empty tuned post for ${platform}.`);
            }
        } catch (error: any) {
            tuneErrorOccurred = true;
            console.error(`Tuning ${platform} post failed:`, error);
             let description = `Post tuning failed: ${error.message || 'Unknown AI error'}`;
             if (error.status === 'UNAUTHENTICATED' || error.message?.includes("API key not valid")) {
               description = "Invalid Gemini API Key. Check profile.";
               setIsProfileDialogOpen(true);
            } else if (error.status === 'UNAVAILABLE') {
                description = `AI service for tuning (${platform}) was unavailable. Try later.`;
            } else if (error.status === 'RESOURCE_EXHAUSTED') {
                description = `AI rate limit hit during tuning (${platform}). Check quota or try later.`;
            } else if (error.message?.includes("empty tuned post")) {
                description = `Tuning for ${platform} failed: AI returned empty result after retries.`;
            }
            toast({ title: "Tuning Failed", description, variant: "destructive" });
        } finally {
            // Calculate and apply refund if tuning failed
            const actualCost = tuneSuccess ? 1 : 0;
            const refundAmount = COST - actualCost;
            if (refundAmount > 0 && user?.id) {
                console.log(`Refunding ${refundAmount} quota point for failed tuning.`);
                 try {
                     const { error: refundRpcError } = await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -refundAmount });
                     if (refundRpcError) {
                         console.error("Error during quota refund RPC for tuning:", refundRpcError.message);
                     } else {
                         // Refetch locally without toast
                        const [quotaResult, profileResult] = await Promise.allSettled([
                           supabase.from('quotas').select('*').eq('user_id', user.id).single(),
                           supabase.from('profiles').select('*, xp, badges').eq('id', user.id).single()
                       ]);
                       if (quotaResult.status === 'fulfilled' && quotaResult.value.data) setQuota(quotaResult.value.data as Quota);
                       if (profileResult.status === 'fulfilled' && profileResult.value.data) {
                           const completeProfile = profileResult.value.data as Profile;
                           setProfile(completeProfile);
                           const newXp = completeProfile.xp ?? 0;
                           const newBadges = completeProfile.badges ?? [];
                            setXp(newXp);
                            setBadges(newBadges);
                           checkAndAwardBadges(newXp, newBadges);
                       }
                     }
                 } catch (refundCatchError: any) {
                     console.error("Unexpected Error during tuning quota refund attempt:", refundCatchError.message);
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

     const COST = 1;
     if (!await checkAndIncrementQuota(COST)) return;

    setAnalysisStates(prev => ({ ...prev, [platform]: true }));
    setAnalysisResults(prev => ({ ...prev, [platform]: null }));
    setShowAiAdvisor(prev => ({ ...prev, [platform]: true })); // Show advisor panel
    const apiKey = profile.gemini_api_key;
    let analysisSuccess = false;
    let analysisErrorOccurred = false;

    startTransition(async () => {
      try {
        console.log(`Starting analysis for ${platform} post...`);
        const result = await analyzePost({ postContent: currentPost, platform }, { apiKey });
         if (result && result.analysis !== undefined && result.flags !== undefined) {
             setAnalysisResults(prev => ({ ...prev, [platform]: result }));
             analysisSuccess = true;
             console.log(`Analysis for ${platform} successful.`);
             if (result.flags.length === 0) {
                toast({title: "AI Advisor", description: "Post looks good! No major issues found.", variant: "default"});
             }
         } else {
             throw new Error("AI returned invalid or empty analysis results.");
         }

      } catch (error: any) {
        analysisErrorOccurred = true;
        console.error(`Analyzing ${platform} post failed:`, error);
        let description = `Post analysis failed: ${error.message || 'Unknown AI error'}`;
         if (error.status === 'UNAUTHENTICATED' || error.message?.includes("API key not valid")) {
           description = "Invalid Gemini API Key. Check profile.";
           setIsProfileDialogOpen(true);
        } else if (error.status === 'UNAVAILABLE') {
            description = `AI service for analysis (${platform}) was unavailable. Try later.`;
        } else if (error.status === 'RESOURCE_EXHAUSTED') {
            description = `AI rate limit hit during analysis (${platform}). Check quota or try later.`;
        } else if (error.message?.includes("empty analysis") || error.message?.includes("invalid analysis")) {
             description = `Analysis for ${platform} failed: AI returned empty/invalid result after retries.`;
         }
        toast({ title: "Analysis Failed", description, variant: "destructive" });
        setShowAiAdvisor(prev => ({ ...prev, [platform]: false })); // Hide advisor on failure
      } finally {
         // Calculate and apply refund if analysis failed
         const actualCost = analysisSuccess ? 1 : 0;
         const refundAmount = COST - actualCost;
          if (refundAmount > 0 && user?.id) {
            console.log(`Refunding ${refundAmount} quota point for failed analysis.`);
            try {
                const { error: refundRpcError } = await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -refundAmount });
                if (refundRpcError) {
                    console.error("Error during quota refund RPC for analysis:", refundRpcError.message);
                } else {
                     // Refetch locally without toast
                    const [quotaResult, profileResult] = await Promise.allSettled([
                       supabase.from('quotas').select('*').eq('user_id', user.id).single(),
                       supabase.from('profiles').select('*, xp, badges').eq('id', user.id).single()
                   ]);
                   if (quotaResult.status === 'fulfilled' && quotaResult.value.data) setQuota(quotaResult.value.data as Quota);
                   if (profileResult.status === 'fulfilled' && profileResult.value.data) {
                       const completeProfile = profileResult.value.data as Profile;
                       setProfile(completeProfile);
                       const newXp = completeProfile.xp ?? 0;
                       const newBadges = completeProfile.badges ?? [];
                        setXp(newXp);
                        setBadges(newBadges);
                       checkAndAwardBadges(newXp, newBadges);
                   }
                }
            } catch (refundCatchError: any) {
                console.error("Unexpected Error during analysis quota refund attempt:", refundCatchError.message);
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

      setAnalysisResults(prev => ({ ...prev, [platform]: null })); // Clear analysis result
      // setShowAiAdvisor(prev => ({ ...prev, [platform]: false })); // Optionally close advisor
      toast({ title: "Suggestion Applied", description: "Post updated with AI suggestion."});
  };


  const handlePublishPost = async (platform: SocialPlatform) => {
     if (dbSetupError) {
        toast({ title: "Database Setup Error", description: dbSetupError, variant: "destructive" });
        return;
     }
    // Placeholder: Feature disabled
    toast({ title: "Publishing Unavailable", description: "Social media publishing feature is currently disabled.", variant: "default" });
  };

  const copyToClipboard = (text: string | undefined) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Copied!", description: "Post content copied to clipboard." }))
      .catch(err => toast({ title: "Copy Failed", description: "Could not copy text.", variant: "destructive" }));
  };

  // Insert text (emoji/hashtag) into the currently active output textarea
  const handleInsertText = (text: string) => {
     if (outputTextareaRef.current) {
       const { selectionStart, selectionEnd, value } = outputTextareaRef.current;
       const newValue = value.substring(0, selectionStart) + text + value.substring(selectionEnd);
       // Update the specific draft based on the activeTab
       setPostDrafts(prev => ({ ...prev, [activeTab]: newValue }));

       // Optional: Move cursor after inserted text
       const newCursorPosition = selectionStart + text.length;
       // Use setTimeout to allow state update before setting selection
        setTimeout(() => {
            if (outputTextareaRef.current) {
                 outputTextareaRef.current.focus();
                 outputTextareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
            }
        }, 0);
     } else {
         toast({ title: "Action Failed", description: "Could not find the active post draft to insert text.", variant: "destructive"});
     }
   };


  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, action } = data;
     const FINISHED_STATUSES: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

     if (FINISHED_STATUSES.includes(status)) {
         setRunOnboarding(false);
         if (profile && !profile.badges?.includes('onboarded') && user?.id) {
             const updatedBadges = [...(profile.badges ?? []), 'onboarded'];
             supabase
                .from('profiles')
                .update({ badges: updatedBadges })
                .eq('id', user.id)
                 .then(({ error }) => {
                     if (error) console.error("Failed to mark onboarding complete:", error);
                     else {
                          const completeProfile = {...profile, badges: updatedBadges};
                          setProfile(completeProfile);
                          setBadges(updatedBadges);
                          checkAndAwardBadges(completeProfile.xp ?? 0, updatedBadges);
                     }
                 });
         }
     } else if (type === 'error') {
         console.error("Onboarding tour error:", data);
         setRunOnboarding(false);
     }
  };


  // Determine if generation/tuning should be globally disabled
  const isDisabled = isPending || quotaExceeded || !!dbSetupError;
  const maxXPForLevel = BADGES[BADGES.length - 1]?.xp || 500; // Max XP for progress
  const xpPercentage = maxXPForLevel > 0 ? Math.min(100, (xp / maxXPForLevel) * 100) : 0; // XP progress relative to max badge


  return (
    <TooltipProvider>
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
              zIndex: 10000,
              primaryColor: 'hsl(var(--primary))',
              arrowColor: 'hsl(var(--card))',
            },
            tooltip: {
              backgroundColor: 'hsl(var(--card))',
              color: 'hsl(var(--card-foreground))',
              borderRadius: 'var(--radius)',
              border: '1px solid hsl(var(--border))',
            },
            buttonNext: {
              backgroundColor: 'hsl(var(--primary))',
              borderRadius: 'calc(var(--radius) - 4px)',
              fontSize: '0.875rem',
              padding: '0.5rem 1rem',
            },
             buttonBack: {
              color: 'hsl(var(--muted-foreground))',
               fontSize: '0.875rem',
               marginRight: '0.5rem',
            },
             buttonSkip: {
               color: 'hsl(var(--muted-foreground))',
               fontSize: '0.875rem',
             },
          }}
        />
     )}

      {showConfetti && <Confetti recycle={false} numberOfPieces={300} />}

    <div className="flex flex-col min-h-screen bg-background text-foreground p-4 md:p-6 lg:p-8">
      {/* Header Bar */}
      <header className="flex justify-between items-center mb-6 md:mb-8 shrink-0">
          <Link href="/" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring rounded-md p-1 -ml-1">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-gradient hidden sm:block">VibeFlow</h1>
          </Link>
        {/* Right side icons and buttons */}
        <div className="flex items-center gap-2 md:gap-4">
           {/* XP & Quota Display */}
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
           ) : quota !== null || profile !== null ? (
             <Tooltip>
               <TooltipTrigger asChild>
                  <div id="quota-display-tooltip-trigger" className="flex items-center gap-3 cursor-help bg-muted/30 border border-border/50 rounded-full px-3 py-1.5">
                      {/* XP Meter */}
                       <div className="flex items-center gap-1 text-xs font-medium text-purple-400">
                         <BrainCircuit className="h-3.5 w-3.5"/>
                         <span>{xp.toLocaleString()} XP</span>
                      </div>
                       <Separator orientation="vertical" className="h-4 bg-border/50"/>
                       {/* Quota Bar */}
                      {quota !== null && (
                        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                            <Progress value={quotaPercentage} className="w-16 h-1.5" title={`${quotaUsed}/${quotaLimit} requests used`} aria-label={`Quota usage: ${quotaUsed} of ${quotaLimit} requests used (${quotaPercentage.toFixed(0)}%)`} />
                            <span>{quotaRemaining} left</span>
                         </div>
                      )}
                  </div>
               </TooltipTrigger>
               <TooltipContent side="bottom" align="end">
                  <div className="flex flex-col gap-1 text-xs">
                     <p>{xp.toLocaleString()} Experience Points earned.</p>
                      {quota !== null ? (
                        <p>{quotaRemaining} requests remaining this month.</p>
                      ) : (
                        <p>Quota loading...</p>
                      )}
                  </div>
               </TooltipContent>
             </Tooltip>
           ) : (
               <div className="flex items-center gap-1 text-sm text-muted-foreground bg-muted/30 border border-border/50 rounded-full px-3 py-1.5">
                   <Loader2 className="h-4 w-4 animate-spin"/>
                   <span>Loading...</span>
               </div>
           )}

           {/* Help Button */}
          <Tooltip>
             <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setIsHelpModalOpen(true)} aria-label="Open Keyboard Shortcuts">
                     <HelpCircle className="h-5 w-5" />
                  </Button>
             </TooltipTrigger>
             <TooltipContent><p>Help & Shortcuts (Ctrl+H)</p></TooltipContent>
           </Tooltip>

          {/* Profile Button */}
          <Tooltip>
             <TooltipTrigger asChild>
                  <Button id="profile-button-tooltip-trigger" variant="ghost" size="icon" onClick={() => setIsProfileDialogOpen(true)} disabled={!!dbSetupError} aria-label="Open Profile Settings">
                     <UserIcon className="h-5 w-5" />
                  </Button>
             </TooltipTrigger>
             <TooltipContent><p>Profile & Settings</p></TooltipContent>
           </Tooltip>

          {/* Sign Out Button (Pill Style) */}
          <Tooltip>
             <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleSignOut} className="rounded-full px-3 py-1 h-8" aria-label="Sign Out">
                  <LogOut className="h-4 w-4" />
                </Button>
             </TooltipTrigger>
             <TooltipContent><p>Sign Out</p></TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Gamification Badge Bar (Slim under header) */}
      {isClient && !dbSetupError && profile && (
         <div className="mb-4 -mt-4">
            <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out" style={{ width: `${xpPercentage}%` }}></div>
            </div>
             <div className="flex justify-between mt-1 px-1 relative -top-3">
               {BADGES.map((badge) => {
                 const isUnlocked = badges.includes(badge.name);
                 const badgePosition = maxXPForLevel > 0 ? (badge.xp / maxXPForLevel) * 100 : 0;
                 const Icon = isUnlocked ? badge.icon : Lock;
                 return (
                   <Tooltip key={badge.name}>
                     <TooltipTrigger asChild>
                       <div
                         className={cn(
                           "absolute transform -translate-x-1/2 transition-opacity duration-300",
                           isUnlocked ? "opacity-100" : "opacity-40"
                         )}
                         style={{ left: `${badgePosition}%` }}
                       >
                         <Icon className={cn("h-4 w-4", isUnlocked ? "text-yellow-400" : "text-muted-foreground")} />
                       </div>
                     </TooltipTrigger>
                     <TooltipContent side="bottom">
                       <p className="text-xs font-semibold">{badge.name}</p>
                       {!isUnlocked && <p className="text-xs italic">Unlock at {badge.xp} XP</p>}
                     </TooltipContent>
                   </Tooltip>
                 );
               })}
             </div>
         </div>
       )}


       {dbSetupError && (
          <Alert variant="destructive" className="mb-6">
             <Database className="h-4 w-4" />
            <AlertTitle>Database Setup Required</AlertTitle>
            <AlertDescription>
              {dbSetupError} Please check the README or Supabase setup instructions.
            </AlertDescription>
          </Alert>
        )}

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

      <main className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

        {/* Content Input Column */}
        <Card className="lg:col-span-1 bg-card/80 border-border/30 shadow-lg flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot className="text-primary" /> Content Input</CardTitle>
            <CardDescription>Enter URL or text, choose a persona, and generate posts.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col gap-4">
             {/* AI Persona Selector */}
             <div className="w-full sm:w-2/3 md:w-1/2">
                <Label htmlFor="persona-select">AI Persona</Label>
                 <Select value={persona} onValueChange={(value) => setPersona(value as Persona)}>
                   <SelectTrigger id="persona-select-trigger" className="w-full" disabled={isDisabled} aria-label="Select AI Persona" textValue={PERSONAS[persona]?.label}>
                     <SelectValue placeholder="Select Persona" />
                   </SelectTrigger>
                   <SelectContent>
                      {PERSONA_GROUPS.map(group => (
                          <SelectGroup key={group}>
                              <SelectLabel>{group}</SelectLabel>
                              {Object.entries(PERSONAS)
                                  .filter(([_, p]) => p.group === group)
                                  .map(([key, p]) => (
                                      <SelectItem key={key} value={key} textValue={p.label}>
                                          {p.label}
                                      </SelectItem>
                                  ))}
                          </SelectGroup>
                      ))}
                   </SelectContent>
                 </Select>
              </div>
             {/* Main Textarea Input */}
            <Textarea
              id="content-input-textarea"
              placeholder="Paste your content or URL here..."
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              rows={4} // Start with 4 rows
              className="min-h-[150px] md:min-h-[200px] lg:min-h-[250px] bg-input/50 border-border/50 text-base resize-y flex-grow" // Allow vertical resize
              disabled={isDisabled}
              suppressHydrationWarning
              spellCheck={true} // Enable spellcheck
              aria-label="Content Input"
            />
          </CardContent>
          <CardFooter>
            <Button
              id="generate-posts-button"
              onClick={handleGenerate}
              disabled={isDisabled || !contentInput.trim() || !profile?.gemini_api_key}
              loading={isGeneratingSummary || isGeneratingPosts}
              className="w-full md:w-auto ml-auto transition-transform duration-200 hover:scale-105" // Added hover effect
            >
              <Wand2 className="mr-2 h-4 w-4" /> Generate Posts
            </Button>
          </CardFooter>
        </Card>

        {/* Output Column (with Boost Panel) */}
        <div className="lg:col-span-2 flex gap-0 overflow-hidden">
            {/* Generated Drafts Section */}
            <Card className="bg-card/80 border-border/30 shadow-lg flex flex-col flex-grow">
              <CardHeader>
                <CardTitle>Generated Drafts</CardTitle>
                <CardDescription>Review, analyze, tune, and publish your social media posts.</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col"> {/* Ensure flex-col for proper layout */}
                 {(isGeneratingSummary || isGeneratingPosts) && (
                    <div className="flex h-full items-center justify-center p-10 text-muted-foreground">
                       <Loader2 className="h-8 w-8 animate-spin mr-3" />
                       <span>Generating content...</span>
                    </div>
                 )}

                {!(isGeneratingSummary || isGeneratingPosts) && !summary && Object.keys(postDrafts).length === 0 && (
                    <div className="flex h-full items-center justify-center p-10 text-muted-foreground text-center">
                       <p>{dbSetupError ? "Cannot generate posts due to database setup issue." : "Your generated posts will appear here."}</p>
                    </div>
                 )}

                {summary && Object.keys(postDrafts).length > 0 && !dbSetupError && (
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SocialPlatform)} className="w-full flex flex-col h-full">
                    <TabsList id="output-tabs-list" className="shrink-0 mb-4 justify-start border-b border-border rounded-none p-0 bg-transparent">
                      {(['linkedin', 'twitter', 'youtube'] as SocialPlatform[]).map(p => (
                          <TabsTrigger
                            key={p}
                            value={p}
                            className="tabs-trigger-underline data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground hover:text-foreground transition-colors duration-150"
                          >
                            {p === 'linkedin' && <Linkedin className="h-4 w-4 mr-1.5 inline"/>}
                            {p === 'twitter' && <Twitter className="h-4 w-4 mr-1.5 inline"/>}
                            {p === 'youtube' && <Youtube className="h-4 w-4 mr-1.5 inline"/>}
                             <span className="capitalize">{p}</span>
                          </TabsTrigger>
                      ))}
                    </TabsList>

                    {(['linkedin', 'twitter', 'youtube'] as SocialPlatform[]).map((platform) => (
                      <TabsContent key={platform} value={platform} className="flex-grow mt-0 flex flex-col"> {/* Ensure flex-col here */}
                        <div className="flex gap-4 h-full flex-grow"> {/* Ensure flex-grow here */}
                            {/* Main Output Card for the Platform */}
                            <Card className="bg-background border-border/50 h-full flex flex-col flex-grow">
                              <CardContent className="p-4 space-y-4 relative flex-grow flex flex-col"> {/* Flex-col for textarea growth */}
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
                                      ref={platform === activeTab ? outputTextareaRef : null} // Assign ref only to active textarea
                                      value={postDrafts[platform] || ''}
                                      onChange={(e) => setPostDrafts(prev => ({...prev, [platform]: e.target.value}))}
                                      className="min-h-[200px] bg-input/30 border-border/30 resize-y text-sm h-full flex-grow" // Allow resize, use flex-grow
                                      suppressHydrationWarning
                                      spellCheck={true}
                                      disabled={isDisabled || isTuning[platform]}
                                      aria-label={`${platform} post draft`}
                                    />
                                 )}
                                {/* Preview Mockup */}
                                <PreviewMockup platform={platform} content={postDrafts[platform] || ''} />

                                {/* Tune Buttons */}
                                {!postDrafts[platform]?.startsWith("Error generating") && (
                                     <div className="flex flex-wrap gap-2 shrink-0 pt-2 tune-buttons-group">
                                      <span className="text-xs text-muted-foreground mr-2 mt-1.5">Quick Tune:</span>
                                       <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'Make wittier')} disabled={isDisabled || !postDrafts[platform] || isTuning[platform]}>Witty</Button>
                                       <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'More concise')} disabled={isDisabled || !postDrafts[platform] || isTuning[platform]}>Concise</Button>
                                       <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'More professional')} disabled={isDisabled || !postDrafts[platform] || isTuning[platform]}>Professional</Button>
                                       {/* Tone Tuner Trigger */}
                                       <Button size="sm" variant="outline" onClick={() => setIsToneSheetOpen(true)} disabled={isDisabled || !postDrafts[platform] || isTuning[platform]}>
                                         <Palette className="mr-1.5 h-3.5 w-3.5"/> Tune Tone...
                                       </Button>
                                     </div>
                                )}
                              </CardContent>
                              {/* Footer with Action Buttons */}
                              {!postDrafts[platform]?.startsWith("Error generating") && (
                                  <CardFooter className="flex justify-end gap-2 shrink-0 pt-0">
                                    {/* AI Advisor Button */}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                             <Button
                                               variant="ghost"
                                               size="icon"
                                               onClick={() => handleAnalyzePost(platform)}
                                               disabled={isDisabled || !postDrafts[platform] || analysisStates[platform]}
                                               loading={analysisStates[platform]}
                                               className="ai-advisor-button hover:bg-purple-500/10"
                                               aria-label="Get AI feedback"
                                             >
                                                <Sparkles className="h-4 w-4 text-purple-400" />
                                             </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>AI Advisor: Analyze Post</p></TooltipContent>
                                    </Tooltip>
                                    {/* Boost Panel Trigger */}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setIsBoostPanelOpen(true)}
                                                disabled={isDisabled || !postDrafts[platform]}
                                                className="hover:bg-cyan-500/10"
                                                aria-label="Boost with Hashtags & Emojis"
                                            >
                                                <Hash className="h-4 w-4 text-cyan-400" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Hashtags & Emojis</p></TooltipContent>
                                    </Tooltip>
                                    {/* Copy Button */}
                                    <Tooltip>
                                       <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" onClick={() => copyToClipboard(postDrafts[platform])} disabled={!postDrafts[platform] || isPublishing[platform]} aria-label="Copy Post">
                                             <Copy className="h-4 w-4" />
                                          </Button>
                                       </TooltipTrigger>
                                       <TooltipContent><p>Copy Post</p></TooltipContent>
                                    </Tooltip>
                                    {/* Publish Button */}
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                           <Button
                                             onClick={() => handlePublishPost(platform)}
                                             disabled={true} // Always disabled for now
                                             loading={isPublishing[platform]}
                                             size="sm"
                                             className="hover:scale-105"
                                           >
                                             <Send className="mr-1.5 h-4 w-4" /> Publish
                                           </Button>
                                      </TooltipTrigger>
                                      <TooltipContent><p>Publish this post (coming soon!)</p></TooltipContent>
                                    </Tooltip>
                                  </CardFooter>
                               )}
                            </Card>

                            {/* AI Advisor Panel (Conditional Rendering) */}
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

             {/* Boost Panel (Hashtags & Emojis) */}
             <BoostPanel
                isOpen={isBoostPanelOpen}
                onToggle={() => setIsBoostPanelOpen(!isBoostPanelOpen)}
                onInsertText={handleInsertText}
              />
        </div>

      </main>

      <footer className="text-center mt-8 text-xs text-muted-foreground shrink-0">
        Powered by Gemini | Built for the Hackathon
      </footer>

       <ProfileDialog
          isOpen={isProfileDialogOpen}
          onOpenChange={setIsProfileDialogOpen}
          user={user}
          initialProfile={profile}
          initialQuota={quota}
          onProfileUpdate={handleProfileUpdate}
          initialXp={xp}
          initialBadges={badges}
          dbSetupError={dbSetupError}
        />

       {/* Tone Tuner Sheet */}
        <ToneTunerSheet
          isOpen={isToneSheetOpen}
          onOpenChange={setIsToneSheetOpen}
          currentTone={persona} // Assuming persona maps to tone for now
          onApplyTone={(newTone) => {
            setPersona(newTone as Persona); // Update persona state
            // Optionally, trigger a re-tune/re-generation here
            handleTunePost(activeTab, `Change tone to ${PERSONAS[newTone as Persona]?.label || newTone}`);
            setIsToneSheetOpen(false); // Close sheet after applying
          }}
        />

        {/* Help Modal */}
        <HelpModal
          isOpen={isHelpModalOpen}
          onOpenChange={setIsHelpModalOpen}
        />

    </div>
    </TooltipProvider>
  );
}
