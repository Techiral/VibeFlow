// dashboard.tsx
'use client';

import type { User } from '@supabase/supabase-js';
import type { Profile, Quota } from '@/types/supabase';
import { useState, useTransition, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import { LogOut, Loader2, Bot, Twitter, Linkedin, Youtube, Copy, Send, Wand2, Info, BarChart, User as UserIcon, Database, Zap, Sparkles, Trophy, Star, BrainCircuit, HelpCircle, Hash, Smile, Palette, Settings2, Fuel, CreditCard, Key, Lock, Lightbulb, X, ChevronRight, Timer } from 'lucide-react'; // Added Timer icon
import { summarizeContent, type SummarizeContentOutput } from '@/ai/flows/summarize-content';
import { generateSocialPosts, type GenerateSocialPostsOutput } from '@/ai/flows/generate-social-posts';
import { tuneSocialPosts, type TuneSocialPostsOutput } from '@/ai/flows/tune-social-posts';
import { analyzePost, type AnalyzePostOutput } from '@/ai/flows/analyze-post';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from 'next/link';
import { ProfileDialog } from './profile-dialog';
import { Progress } from "@/components/ui/progress";
import AiAdvisorPanel from './ai-advisor-panel';
import { toast as sonnerToast } from 'sonner';
import Confetti from 'react-confetti';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';
import { Separator } from '@/components/ui/separator';
import BoostPanel from './boost-panel';
import ToneTunerSheet from './tone-tuner-sheet';
import HelpModal from './help-modal';
import PreviewMockup from './preview-mockup';
import { cn } from "@/lib/utils";


// Persona types and mapping
type Persona = 'default' | 'tech_ceo' | 'casual_gen_z' | 'thought_leader' | 'meme_lord' | 'formal_pro' | 'fun_vibes';
const PERSONAS: Record<Persona, { label: string; prompt?: string; group: string }> = {
  'default': { label: 'Default', group: 'General' },
  'casual_gen_z': { label: 'Casual Gen Z', prompt: 'Write in a laid-back, emoji-friendly style with internet slang.', group: 'Casual' },
  'fun_vibes': { label: 'Fun Vibes', prompt: 'Write in an upbeat, playful, and engaging tone. Use exclamation points and positive language.', group: 'Casual' },
  'meme_lord': { label: 'Meme Lord', prompt: 'Write like an internet meme lord, witty, sarcastic, and slightly absurd. Reference current memes if appropriate.', group: 'Casual' },
  'tech_ceo': { label: 'Tech CEO', prompt: 'Write like a visionary, authoritative tech CEO. Focus on innovation, disruption, and the future.', group: 'Professional' },
  'thought_leader': { label: 'Thought Leader', prompt: 'Write like an insightful industry thought leader. Use sophisticated language and offer unique perspectives.', group: 'Professional' },
  'formal_pro': { label: 'Formal Pro', prompt: 'Write in a strictly formal and professional business tone. Avoid contractions and slang.', group: 'Professional' },
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
// Add state for rate limiting
type RateLimitState = {
    [key: string]: { // key could be 'generate', 'tune_linkedin', etc.
        limited: boolean;
        retryAfter: number | null; // Timestamp when retry is possible
    }
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

// Function to check if an error is retriable (defined outside component)
const isRetriableError = (error: any): boolean => {
    const message = error.message?.toLowerCase() || '';
    const status = error.status || (error instanceof Error ? (error as any).status : null); // Basic check
    const statusCode = error.statusCode; // Check for statusCode property as well

    // Check for Genkit specific statuses or common HTTP errors indicating temporary issues
    if (status === 'UNAVAILABLE' || status === 'RESOURCE_EXHAUSTED' || status === 503 || statusCode === 503 || status === 429 || statusCode === 429) {
        return true;
    }

    // Check for common textual indicators
    if (
        message.includes('503') ||
        message.includes('service unavailable') ||
        message.includes('overloaded') ||
        message.includes('internal error') || // Sometimes 500s are temporary
        message.includes('the model is overloaded') ||
        message.includes('rate limit exceeded') ||
        message.includes('quota exceeded') // Treat quota issues as potentially retriable short-term
    ) {
       return true;
    }

    return false;
};

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1 second

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
  const [isBoostPanelOpen, setIsBoostPanelOpen] = useState(false);
  const [isToneSheetOpen, setIsToneSheetOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SocialPlatform>('linkedin');
  const outputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({}); // Rate limit state
  const rateLimitTimers = useRef<Record<string, NodeJS.Timeout>>({}); // Store timers

   // --- Derived State ---
   const quotaUsed = quota?.request_count ?? 0;
   const quotaLimit = quota?.quota_limit ?? DEFAULT_QUOTA_LIMIT;
   const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
   const quotaPercentage = quotaLimit > 0 ? Math.min(100, (quotaUsed / quotaLimit) * 100) : 0; // Cap at 100%
   const quotaExceeded = quotaUsed >= quotaLimit && !!quota; // >= to include exactly 100%

   // --- Effects ---

   useEffect(() => {
    setIsClient(true);
    // Clear any existing timers on unmount
    return () => {
        Object.values(rateLimitTimers.current).forEach(clearTimeout);
    };
  }, []);

   // Function to check and award badges
   const checkAndAwardBadges = useCallback(async (currentXp: number, currentBadges: string[]) => {
        let newlyAwardedBadge: string | null = null;
        let updatedBadges = [...currentBadges];

        for (const badge of BADGES) {
            if (currentXp >= badge.xp && !updatedBadges.includes(badge.name)) {
                console.log(`Badge condition met: ${badge.name}`);
                newlyAwardedBadge = badge.name;
                updatedBadges.push(badge.name);
            }
        }

        if (newlyAwardedBadge && user?.id) {
            setBadges(updatedBadges);

            const { error } = await supabase
               .from('profiles')
               .update({ badges: updatedBadges })
               .eq('id', user.id);

            if (error) {
                console.error(`Failed to save badges to database:`, error);
                toast({ title: "Badge Save Error", description: `Could not save newly earned badges.`, variant: "destructive"});
                setBadges(currentBadges); // Revert
            } else {
                console.log(`Badges saved to DB: ${updatedBadges.join(', ')}`);
                setProfile(prev => prev ? { ...prev, badges: updatedBadges } : null);

                const badgeInfo = BADGES.find(b => b.name === newlyAwardedBadge);
                if (badgeInfo && newlyAwardedBadge !== lastAwardedBadge) {
                   setShowConfetti(true);
                   sonnerToast.success(`Badge Unlocked: ${badgeInfo.name}!`, {
                     description: badgeInfo.description,
                     duration: 5000,
                     icon: <badgeInfo.icon className="text-yellow-500" />, // Use yellow for unlocked
                   });
                   setLastAwardedBadge(newlyAwardedBadge);
                   setTimeout(() => setShowConfetti(false), 5000);
                }
            }
        }
   }, [supabase, user?.id, toast, lastAwardedBadge]);


  // Effect to show toast messages
  useEffect(() => {
    const message = searchParams.get('message');
    if (message) {
      toast({ title: "Notification", description: message });
    }
  }, [searchParams, toast, router]);


  // Effect to fetch or confirm profile/quota data
  useEffect(() => {
    const ensureData = async () => {
      let currentProfile = profile;
      let currentQuota = quota;
      let setupErrorMsg: string | null = null;

       if (!currentProfile && user?.id) { // Ensure user ID exists before fetching
         try {
            console.log("Attempting to fetch profile via RPC on client...");
            const { data, error } = await supabase
              .rpc('get_user_profile', { p_user_id: user.id });

             if (error) {
                  console.error("Error fetching/creating profile on client:", error.message);
                  if (error.message.includes("function public.get_user_profile") && error.message.includes("does not exist")) {
                      setupErrorMsg = "Database setup incomplete: Missing 'get_user_profile' function. Run setup script.";
                  } else {
                     setupErrorMsg = `Profile Error: ${error.message}`;
                  }
                  if (setupErrorMsg) setDbSetupError(setupErrorMsg);
             } else if (data && Array.isArray(data) && data.length > 0) {
                 currentProfile = data[0] as Profile;
                 setProfile(currentProfile);
                 setXp(currentProfile.xp ?? initialXp);
                 setBadges(currentProfile.badges ?? initialBadges);
                 if (!setupErrorMsg) setDbSetupError(null);
             } else {
                 setupErrorMsg = "Failed to load or initialize user profile data.";
                 toast({ title: "Profile Error", description: setupErrorMsg, variant: "destructive" });
                 setDbSetupError(setupErrorMsg);
             }
         } catch (error: any) {
             setupErrorMsg = `Unexpected error loading profile data. Details: ${error.message}`;
             toast({ title: "Profile Error", description: setupErrorMsg, variant: "destructive" });
             setDbSetupError(setupErrorMsg);
         }
      } else if (currentProfile) { // Profile exists
         setXp(currentProfile.xp ?? initialXp);
         setBadges(currentProfile.badges ?? initialBadges);
         if (!setupErrorMsg) setDbSetupError(null);
      }


      if (!currentQuota && user?.id && !setupErrorMsg) {
        try {
          console.log("Attempting to fetch quota via RPC on client...");
          const { data: remainingQuotaRpc, error: rpcError } = await supabase
             .rpc('get_remaining_quota', { p_user_id: user.id });

           if (rpcError) {
             console.error('Error calling get_remaining_quota RPC:', rpcError.message);
             let errorMsg = `Failed to load usage data: ${rpcError.message}`;
              if (rpcError.message.includes("function public.get_remaining_quota") && rpcError.message.includes("does not exist")) {
                 errorMsg = "Database setup incomplete: Missing 'get_remaining_quota' function. Run setup script.";
             } else if (rpcError.message.includes("relation \"public.quotas\" does not exist")) {
                 errorMsg = "Database setup incomplete: Missing 'quotas' table. Run setup script.";
             }
             setupErrorMsg = errorMsg;
             toast({ title: 'Quota Error', description: errorMsg, variant: 'destructive' });
             setDbSetupError(setupErrorMsg);
           } else if (typeof remainingQuotaRpc === 'number') {
               console.log("RPC get_remaining_quota successful, fetching full details...");
               const { data: quotaDetails, error: selectError } = await supabase
                 .from('quotas')
                 .select('*')
                 .eq('user_id', user.id)
                 .maybeSingle();

               if (selectError && selectError.code !== 'PGRST116') {
                   console.error('Error fetching quota details after RPC:', selectError.message);
                   let errorMsg = `Failed to load full usage details: ${selectError.message}`;
                    if (selectError.message.includes("relation \"public.quotas\" does not exist")) {
                      errorMsg = `Database setup incomplete: Missing required table (${selectError.message}). Run setup script.`;
                    }
                   if (!setupErrorMsg) setupErrorMsg = errorMsg;
                   toast({ title: 'Quota Error', description: errorMsg, variant: 'destructive' });
                   setDbSetupError(setupErrorMsg);
               } else if (quotaDetails) {
                   currentQuota = quotaDetails as Quota;
                   setQuota(currentQuota);
                   if (!setupErrorMsg) setDbSetupError(null);
               } else {
                   console.log("Quota record not found, constructing temporary quota state from RPC result.");
                   const limit = DEFAULT_QUOTA_LIMIT;
                   const used = limit - remainingQuotaRpc;
                   const nowISO = new Date().toISOString();
                   currentQuota = {
                       user_id: user.id,
                       request_count: Math.max(0, used),
                       quota_limit: limit,
                       last_reset_at: nowISO,
                       created_at: nowISO,
                       ip_address: null
                   };
                   setQuota(currentQuota);
                   if (!setupErrorMsg) setDbSetupError(null);
               }
           } else {
               if (!setupErrorMsg) setupErrorMsg = "Could not determine quota state from database function.";
               toast({ title: 'Quota Error', description: setupErrorMsg, variant: 'destructive' });
               setDbSetupError(setupErrorMsg);
           }
        } catch (err: any) {
          if (!setupErrorMsg) setupErrorMsg = `Unexpected error loading usage data: ${err.message}`;
          toast({ title: 'Quota Error', description: setupErrorMsg, variant: 'destructive' });
          setDbSetupError(setupErrorMsg);
        }
      } else if (setupErrorMsg) {
          setDbSetupError(setupErrorMsg);
      } else if (currentQuota && currentProfile) {
           setDbSetupError(null);
      }
    };
    if(user?.id) ensureData(); // Only run if user ID is available
  }, [user?.id, supabase, toast, profile, quota, dbSetupError, initialXp, initialBadges]); // Dependencies adjusted


  // Effect to check onboarding status
  useEffect(() => {
    if (isClient && profile && !profile.badges?.includes('onboarded') && !dbSetupError) {
      setRunOnboarding(true);
    }
  }, [isClient, profile, dbSetupError]);


  // Effect for Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        setIsHelpModalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);


  // Update profile and check badges
  const handleProfileUpdate = useCallback((updatedProfile: Profile) => {
    setProfile(updatedProfile);
    const newXp = updatedProfile.xp ?? 0;
    const newBadges = updatedProfile.badges ?? [];
    setXp(newXp);
    setBadges(newBadges);
    checkAndAwardBadges(newXp, newBadges);
    toast({ title: "Profile Updated", description: "Your profile information has been saved." });
  }, [toast, checkAndAwardBadges]);


  // Effect to check badges whenever XP or badges array itself changes
  useEffect(() => {
    if (profile && badges) { // Check if badges array exists
      checkAndAwardBadges(xp, badges);
    }
  }, [xp, badges, profile, checkAndAwardBadges]); // badges is now a dependency


  // Check and increment quota
  const checkAndIncrementQuota = useCallback(async (incrementAmount: number = 1): Promise<boolean> => {
     if (dbSetupError) {
         toast({ title: "Database Error", description: `Cannot process request due to database setup issue: ${dbSetupError}`, variant: "destructive" });
         return false;
     }
      if (!user?.id) {
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
                   let errorMsg = `Failed to check usage limit: ${fetchError.message}`;
                   if (fetchError.message.includes("function public.get_remaining_quota") && fetchError.message.includes("does not exist")) {
                       errorMsg = "Database function 'get_remaining_quota' missing. Run setup script.";
                       setDbSetupError(errorMsg);
                   } else if (fetchError.message.includes("relation \"public.quotas\" does not exist")) {
                        errorMsg = "Database table 'quotas' missing. Run setup script.";
                        setDbSetupError(errorMsg);
                   }
                   toast({ title: "Quota Check Error", description: errorMsg, variant: "destructive" });
                  return false;
              }
              if (typeof fetchedQuotaRemaining === 'number') {
                  currentRemaining = fetchedQuotaRemaining;
                  console.log("Fetched remaining quota via RPC:", currentRemaining);
                  const limit = DEFAULT_QUOTA_LIMIT;
                  const used = limit - currentRemaining;
                  const tempQuota: Quota = {
                      user_id: user.id,
                      request_count: Math.max(0, used),
                      quota_limit: limit,
                      last_reset_at: new Date().toISOString(), // Placeholder
                      created_at: new Date().toISOString(),    // Placeholder
                      ip_address: null
                  };
                  setQuota(tempQuota); // Update local state

              } else {
                  toast({ title: "Quota Check Error", description: "Could not determine remaining usage.", variant: "destructive" });
                  return false;
              }
         } catch (rpcError: any) {
              toast({ title: "Quota Check Error", description: `Unexpected error checking usage: ${rpcError.message}`, variant: "destructive" });
              return false;
         }
     }


     if (currentRemaining < incrementAmount) {
       toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
       if (quota) setQuota(prev => prev ? {...prev, request_count: prev.quota_limit ?? DEFAULT_QUOTA_LIMIT} : null);
       return false;
     }

     const optimisticQuotaUsed = (quota?.request_count ?? 0) + incrementAmount;
     const optimisticQuota = quota ? { ...quota, request_count: optimisticQuotaUsed } : null;
     if (optimisticQuota) setQuota(optimisticQuota);

     const optimisticXp = xp + (incrementAmount * XP_PER_REQUEST);
     setXp(optimisticXp);

    try {
        console.log(`Attempting to increment quota by ${incrementAmount} for user ${user.id}`);
        const { data: newRemainingRpc, error } = await supabase.rpc('increment_quota', {
           p_user_id: user.id,
           p_increment_amount: incrementAmount
        });

       if (error) {
          setQuota(quota); // Revert optimistic quota
          setXp(xp);       // Revert optimistic XP

          console.error("Error incrementing quota RPC:", error.message);
          let errorMsg = `Failed to update usage count: ${error.message}`;
          if (error.message.includes("quota_exceeded")) {
             errorMsg = "You have reached your monthly usage limit.";
             if(quota) setQuota(prev => prev ? {...prev, request_count: prev.quota_limit ?? DEFAULT_QUOTA_LIMIT} : null);
          } else if (error.message.includes("function public.increment_quota") && error.message.includes("does not exist")) {
             errorMsg = "Database function 'increment_quota' missing. Run setup script.";
             setDbSetupError(errorMsg);
          }
          toast({ title: "Quota Error", description: errorMsg, variant: "destructive" });
          return false;
       }

        console.log("Quota increment RPC successful, refetching data...");
        const [quotaResult, profileResult] = await Promise.allSettled([
            supabase.from('quotas').select('*').eq('user_id', user.id).single(),
            supabase.from('profiles').select('*, xp, badges').eq('id', user.id).single()
        ]);

        if (quotaResult.status === 'fulfilled' && quotaResult.value.data) {
             setQuota(quotaResult.value.data as Quota);
        } else {
            console.error("Error fetching quota after increment:", quotaResult.status === 'rejected' ? quotaResult.reason : quotaResult.value.error);
            // Keep optimistic state if refetch fails but RPC succeeded
        }

        if (profileResult.status === 'fulfilled' && profileResult.value.data) {
            const completeProfile = profileResult.value.data as Profile;
            setProfile(completeProfile);
            const newXp = completeProfile.xp ?? initialXp; // Use initialXp as fallback
            const newBadges = completeProfile.badges ?? initialBadges; // Use initialBadges as fallback
            setXp(newXp);
            setBadges(newBadges);
            checkAndAwardBadges(newXp, newBadges);
        } else {
            console.error("Error fetching profile after increment:", profileResult.status === 'rejected' ? profileResult.reason : profileResult.value.error);
             // Keep optimistic XP/badge state
        }

       if (typeof newRemainingRpc === 'number' && newRemainingRpc < 0) {
           if (quota && quota.request_count < (quota.quota_limit ?? DEFAULT_QUOTA_LIMIT)) {
               setQuota(prev => prev ? {...prev, request_count: prev.quota_limit ?? DEFAULT_QUOTA_LIMIT} : null);
           }
           toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
           return false;
       }

      return true;
    } catch (rpcError: any) {
        setQuota(quota); // Revert optimistic
        setXp(xp);
        toast({ title: "Quota Error", description: `An unexpected error occurred updating usage: ${rpcError.message}`, variant: "destructive" });
        return false;
    }
  }, [dbSetupError, quota, quotaRemaining, quotaLimit, xp, supabase, user?.id, toast, checkAndAwardBadges, initialXp, initialBadges]); // Added initialXp, initialBadges


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
      setRateLimitState({}); // Clear rate limit state on sign out
      router.push('/login');
    }
  };

 // Countdown Timer Component
 const CountdownTimer = ({ targetTime, onComplete }: { targetTime: number, onComplete: () => void }) => {
     const [remaining, setRemaining] = useState(Math.max(0, Math.ceil((targetTime - Date.now()) / 1000)));

     useEffect(() => {
         if (remaining <= 0) {
             onComplete();
             return;
         }
         const timer = setInterval(() => {
             const newRemaining = Math.max(0, Math.ceil((targetTime - Date.now()) / 1000));
             setRemaining(newRemaining);
             if (newRemaining <= 0) {
                 clearInterval(timer);
                 onComplete();
             }
         }, 1000);
         return () => clearInterval(timer);
     }, [targetTime, onComplete, remaining]);

     const minutes = Math.floor(remaining / 60);
     const seconds = remaining % 60;

     return <span>Try again in {minutes}:{seconds < 10 ? `0${seconds}` : seconds}</span>;
 };


 // Wrapper function for AI calls with retry and rate limit handling
 const callAiWithRetry = async <T>(
    aiFunction: () => Promise<T>,
    operationName: string,
    cost: number,
    operationKey: string // Unique key for rate limiting state (e.g., 'generate', 'tune_linkedin')
): Promise<{ data: T | null; error: any | null; rateLimited?: boolean; retryAfter?: number }> => {
    let retries = 0;
    let backoff = INITIAL_BACKOFF_MS;
    let success = false;
    let data: T | null = null;
    let error: any = null;
    let rateLimited = false;
    let apiRetryAfterSeconds: number | null = null; // Store potential retry-after from API

    // Check local rate limit state first
    const currentLimit = rateLimitState[operationKey];
    if (currentLimit?.limited && currentLimit.retryAfter && currentLimit.retryAfter > Date.now()) {
        console.log(`${operationName} is rate-limited locally. Retry after ${new Date(currentLimit.retryAfter).toLocaleTimeString()}`);
        return { data: null, error: new Error("Rate limited"), rateLimited: true, retryAfter: currentLimit.retryAfter };
    }

    // Check quota before attempting the operation
    if (!await checkAndIncrementQuota(cost)) {
      return { data: null, error: new Error("Quota exceeded") };
    }

    while (retries < MAX_RETRIES) {
        try {
            data = await aiFunction();
            success = true;
            console.log(`${operationName} successful.`);
             // Clear rate limit state on success
            setRateLimitState(prev => {
                const newState = { ...prev };
                delete newState[operationKey];
                return newState;
            });
            if (rateLimitTimers.current[operationKey]) {
                clearTimeout(rateLimitTimers.current[operationKey]);
                delete rateLimitTimers.current[operationKey];
            }
            break;
        } catch (err: any) {
            error = err;

             if (err.status === 'UNAUTHENTICATED' || err.message?.includes("API key not valid")) {
                 console.error(`${operationName}: Invalid API Key used.`);
                 toast({ title: `${operationName} Failed`, description: "Invalid Gemini API Key. Check profile.", variant: "destructive" });
                 setIsProfileDialogOpen(true);
                 break; // No retry for invalid key
             }

             // Check specifically for Rate Limit / Resource Exhausted errors
            if (err.status === 'RESOURCE_EXHAUSTED' || err.statusCode === 429 || err.message?.toLowerCase().includes('rate limit exceeded') || err.message?.toLowerCase().includes('quota exceeded')) {
                rateLimited = true;
                // Attempt to parse Retry-After header if available (logic depends on API response structure)
                // Example: apiRetryAfterSeconds = parseRetryAfterHeader(err.headers);
                apiRetryAfterSeconds = 60; // Default to 60 seconds if not provided by API

                const retryTimestamp = Date.now() + (apiRetryAfterSeconds * 1000);
                console.warn(`${operationName}: Rate limit hit. Setting retry after ${apiRetryAfterSeconds}s.`);
                setRateLimitState(prev => ({
                    ...prev,
                    [operationKey]: { limited: true, retryAfter: retryTimestamp }
                }));

                // Set a timer to clear the rate limit state
                if (rateLimitTimers.current[operationKey]) {
                   clearTimeout(rateLimitTimers.current[operationKey]);
                }
                rateLimitTimers.current[operationKey] = setTimeout(() => {
                    console.log(`Rate limit timer expired for ${operationKey}. Clearing state.`);
                    setRateLimitState(prev => {
                        const newState = { ...prev };
                        if (newState[operationKey]?.retryAfter === retryTimestamp) { // Avoid race conditions
                           delete newState[operationKey];
                        }
                        return newState;
                    });
                    delete rateLimitTimers.current[operationKey];
                }, apiRetryAfterSeconds * 1000);

                toast({
                    title: "Rate Limit Reached",
                    description: `${operationName} is temporarily unavailable due to rate limits.`,
                    variant: "destructive",
                    duration: 5000
                });
                break; // Exit loop on rate limit
            }

            // Check for other retriable errors
            if (isRetriableError(err) && retries < MAX_RETRIES - 1) {
                const reason = err.status === 503 || err.statusCode === 503 ? "Service unavailable (503)" : "Temporary issue";
                console.warn(`${operationName}: ${reason}. Retrying in ${backoff}ms... (Attempt ${retries + 1}/${MAX_RETRIES})`);
                toast({
                    title: "AI Busy",
                    description: `${operationName} is taking longer than usual. Retrying... (${retries + 1})`,
                    variant: "default",
                    duration: backoff,
                });
                await new Promise(resolve => setTimeout(resolve, backoff));
                retries++;
                backoff *= 2;
            } else {
                // Non-retriable error or max retries reached
                console.error(`${operationName} failed after ${retries + 1} attempts:`, err);
                 let description = `AI operation failed: ${err.message || 'Unknown AI error'}`;
                 if (err.status === 'UNAVAILABLE' || err.status === 503 || err.statusCode === 503) {
                     description = `AI service for ${operationName.toLowerCase()} was unavailable after retries. Try later.`;
                 }
                toast({ title: `${operationName} Failed`, description, variant: "destructive" });
                break; // Exit loop
            }
        }
    }

     if (!success && cost > 0 && user?.id) {
         console.log(`Refunding ${cost} quota point(s) for failed ${operationName}.`);
         try {
             const { error: refundRpcError } = await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -cost });
             if (refundRpcError) {
                 console.error(`Error during quota refund RPC for ${operationName}:`, refundRpcError.message);
             } else {
                  const [quotaResult, profileResult] = await Promise.allSettled([
                      supabase.from('quotas').select('*').eq('user_id', user.id).single(),
                      supabase.from('profiles').select('*, xp, badges').eq('id', user.id).single()
                  ]);
                  if (quotaResult.status === 'fulfilled' && quotaResult.value.data) setQuota(quotaResult.value.data as Quota);
                  if (profileResult.status === 'fulfilled' && profileResult.value.data) {
                      const p = profileResult.value.data as Profile;
                      setProfile(p); setXp(p.xp ?? 0); setBadges(p.badges ?? []);
                      checkAndAwardBadges(p.xp ?? 0, p.badges ?? []);
                  }
             }
         } catch (refundCatchError: any) {
             console.error(`Unexpected Error during ${operationName} quota refund attempt:`, refundCatchError.message);
         }
     }

    return { data, error, rateLimited, retryAfter: rateLimited ? rateLimitState[operationKey]?.retryAfter : undefined };
};


 // Generate Summary and Posts Handler
 const handleGenerate = async () => {
    const operationKey = 'generate';
    if (dbSetupError) { /* ... */ return; }
    if (!profile?.gemini_api_key) { /* ... */ return; }
    if (!contentInput.trim()) { /* ... */ return; }
    if (rateLimitState[operationKey]?.limited) {
        toast({ title: "Rate Limited", description: "Generation is currently rate limited.", variant: "default" });
        return;
    }

    const SUMMARY_COST = 1;
    const POST_COST_PER_PLATFORM = 1;
    const TOTAL_INITIAL_COST = SUMMARY_COST + (['linkedin', 'twitter', 'youtube'].length * POST_COST_PER_PLATFORM);

    setIsGeneratingSummary(true);
    setIsGeneratingPosts(true);
    setSummary(null);
    setPostDrafts({});
    setAnalysisResults({});
    setShowAiAdvisor({});

    const apiKey = profile.gemini_api_key;
    const currentPersonaPrompt = PERSONAS[persona]?.prompt;

    startTransition(async () => {
        // --- Summarization ---
        const { data: summaryResult, error: summaryError, rateLimited: summaryRateLimited, retryAfter: summaryRetryAfter } = await callAiWithRetry(
            () => summarizeContent({ content: contentInput }, { apiKey }),
            "Summarization",
            SUMMARY_COST,
            `${operationKey}_summary` // More specific key
        );

        setIsGeneratingSummary(false);

        if (summaryRateLimited) {
             setIsGeneratingPosts(false);
             // Toast or specific UI update handled by callAiWithRetry
             return;
        }
        if (summaryError || !summaryResult?.summary) {
             if (summaryError?.message?.includes("parsing")) {
               toast({ title: "Content Parsing Failed", description: "Could not parse content from URL. Check URL or paste text.", variant: "destructive"});
            }
            setIsGeneratingPosts(false);
            return;
        }

        setSummary(summaryResult.summary);
        console.log("Summarization successful:", summaryResult);

        // --- Post Generation ---
        console.log("Starting post generation...");
        const platforms: SocialPlatform[] = ['linkedin', 'twitter', 'youtube'];
        const postPromises = platforms.map(async (platform) => {
             const platformOpKey = `${operationKey}_${platform}`;
              // Check rate limit *before* calling
             if (rateLimitState[platformOpKey]?.limited) {
                  console.log(`Post generation for ${platform} skipped due to rate limit.`);
                  return { platform, post: `Rate limited. Try again later.` };
             }

             const { data: postResult, error: postError, rateLimited: postRateLimited } = await callAiWithRetry(
                 // Pass persona prompt here if needed for initial generation too
                 () => generateSocialPosts({ summary: summaryResult.summary!, platform, personaPrompt: currentPersonaPrompt }, { apiKey }),
                 `Post Generation (${platform})`,
                 POST_COST_PER_PLATFORM,
                 platformOpKey // Platform-specific key
             );

            if (postRateLimited) {
                return { platform, post: `Rate limited. Try again later.` };
            }
            if (postError || !postResult?.post) {
                return { platform, post: `Error generating post for ${platform}.` };
            }
            return { platform, post: postResult.post };
        });

        const results = await Promise.all(postPromises);
        const newDrafts = results.reduce((acc, { platform, post }) => {
            acc[platform] = post;
            return acc;
        }, {} as PostDrafts);

        setPostDrafts(newDrafts);
        setIsGeneratingPosts(false);
        console.log("Post generation phase complete.");
    });
 };


 // Tune Post Handler
 const handleTunePost = async (platform: SocialPlatform, feedback: string) => {
    const operationKey = `tune_${platform}`;
    if (dbSetupError) { /* ... */ return; }
    if (!profile?.gemini_api_key) { /* ... */ return; }
    const originalPost = postDrafts[platform];
    if (!originalPost || originalPost.startsWith("Error generating") || originalPost.startsWith("Rate limited")) { /* ... */ return; }
     if (rateLimitState[operationKey]?.limited) {
        toast({ title: "Rate Limited", description: `Tuning for ${platform} is currently rate limited.`, variant: "default" });
        return;
    }

    const COST = 1;
    setIsTuning(prev => ({ ...prev, [platform]: true }));
    setAnalysisResults(prev => ({ ...prev, [platform]: null }));
    const apiKey = profile.gemini_api_key;
    const currentPersonaPrompt = PERSONAS[persona]?.prompt; // Get current persona prompt

    startTransition(async () => {
        const { data: tunedResult, error: tuneError, rateLimited: tuneRateLimited } = await callAiWithRetry(
            () => tuneSocialPosts({ originalPost, feedback, platform, personaPrompt: currentPersonaPrompt }, { apiKey }), // Pass persona prompt
            `Tuning (${platform})`,
            COST,
            operationKey // Use the specific operation key
        );

        setIsTuning(prev => ({ ...prev, [platform]: false }));

        if (tuneRateLimited) {
            // UI update handled by callAiWithRetry (toast) and the rateLimitState check
        } else if (tuneError || !tunedResult?.tunedPost) {
            // Error toast handled within callAiWithRetry
        } else {
            setPostDrafts(prev => ({ ...prev, [platform]: tunedResult.tunedPost }));
            toast({ title: "Post Tuned!", description: `Applied feedback: "${feedback}"`, variant: "default" });
            console.log(`Tuning for ${platform} successful.`);
        }
    });
 };


 // Analyze Post Handler
 const handleAnalyzePost = async (platform: SocialPlatform) => {
     const operationKey = `analyze_${platform}`;
    if (dbSetupError) { /* ... */ return; }
    if (!profile?.gemini_api_key) { /* ... */ return; }
    const currentPost = postDrafts[platform];
    if (!currentPost || currentPost.startsWith("Error generating") || currentPost.startsWith("Rate limited")) { /* ... */ return; }
     if (rateLimitState[operationKey]?.limited) {
        toast({ title: "Rate Limited", description: `Analysis for ${platform} is currently rate limited.`, variant: "default" });
        return;
    }

     const COST = 1;
    setAnalysisStates(prev => ({ ...prev, [platform]: true }));
    setAnalysisResults(prev => ({ ...prev, [platform]: null }));
    setShowAiAdvisor(prev => ({ ...prev, [platform]: true }));
    const apiKey = profile.gemini_api_key;

    startTransition(async () => {
       const { data: result, error: analysisError, rateLimited: analysisRateLimited } = await callAiWithRetry(
           () => analyzePost({ postContent: currentPost, platform }, { apiKey }),
           `Analysis (${platform})`,
           COST,
           operationKey // Use the specific operation key
       );

       setAnalysisStates(prev => ({ ...prev, [platform]: false }));

        if (analysisRateLimited) {
            setShowAiAdvisor(prev => ({ ...prev, [platform]: false })); // Hide advisor if rate limited
        } else if (analysisError || !result) {
            setShowAiAdvisor(prev => ({ ...prev, [platform]: false }));
        } else if (result.analysis !== undefined && result.flags !== undefined) {
             setAnalysisResults(prev => ({ ...prev, [platform]: result }));
             console.log(`Analysis for ${platform} successful.`);
             if (result.flags.length === 0) {
                toast({title: "AI Advisor", description: "Post looks good! No major issues found.", variant: "default"});
             }
         } else {
             console.error(`Analysis for ${platform} returned invalid format.`);
             toast({ title: "Analysis Failed", description: "AI returned an unexpected result format.", variant: "destructive" });
             setShowAiAdvisor(prev => ({ ...prev, [platform]: false }));
         }
    });
  };

 // Apply AI Advisor Suggestion
 const handleApplySuggestion = (platform: SocialPlatform, start: number, end: number, suggestion: string) => {
     const currentPost = postDrafts[platform];
     if (!currentPost) return;

     const updatedPost = currentPost.substring(0, start) + suggestion + currentPost.substring(end);
     setPostDrafts(prev => ({ ...prev, [platform]: updatedPost }));

      setAnalysisResults(prev => ({ ...prev, [platform]: null }));
      toast({ title: "Suggestion Applied", description: "Post updated with AI suggestion."});
  };


  const handlePublishPost = async (platform: SocialPlatform) => {
     if (dbSetupError) {
        toast({ title: "Database Setup Error", description: dbSetupError, variant: "destructive" });
        return;
     }
    toast({ title: "Publishing Unavailable", description: "Social media publishing feature is currently disabled.", variant: "default" });
  };

  const copyToClipboard = (text: string | undefined) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Copied!", description: "Post content copied to clipboard." }))
      .catch(err => toast({ title: "Copy Failed", description: "Could not copy text.", variant: "destructive" }));
  };

  // Insert text (emoji/hashtag)
  const handleInsertText = (text: string) => {
     if (outputTextareaRef.current) {
       const { selectionStart, selectionEnd, value } = outputTextareaRef.current;
       const newValue = value.substring(0, selectionStart) + text + value.substring(selectionEnd);
       setPostDrafts(prev => ({ ...prev, [activeTab]: newValue }));
        const newCursorPosition = selectionStart + text.length;
        setTimeout(() => {
            if (outputTextareaRef.current) {
                 outputTextareaRef.current.focus();
                 outputTextareaRef.current.setSelectionRange(newCursorPosition, newCursorPosition);
            }
        }, 0);
     } else {
         toast({ title: "Action Failed", description: "Could not find the active post draft.", variant: "destructive"});
     }
   };


  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type } = data;
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

   // Function to clear a specific rate limit state
   const clearRateLimit = (key: string) => {
        console.log(`Clearing rate limit state for ${key}`);
        setRateLimitState(prev => {
            const newState = { ...prev };
            delete newState[key];
            return newState;
        });
         if (rateLimitTimers.current[key]) {
            clearTimeout(rateLimitTimers.current[key]);
            delete rateLimitTimers.current[key];
        }
    };


  // Determine if generation/tuning should be globally disabled
  const isDisabled = isPending || quotaExceeded || !!dbSetupError;
  const maxXPForLevel = BADGES[BADGES.length - 1]?.xp || 500;
  const xpPercentage = maxXPForLevel > 0 ? Math.min(100, (xp / maxXPForLevel) * 100) : 0;

  // --- Button Specific Disabled States ---
  const isGenerateDisabled = isDisabled || !contentInput.trim() || !profile?.gemini_api_key || !!rateLimitState['generate_summary']?.limited || !!rateLimitState['generate_linkedin']?.limited || !!rateLimitState['generate_twitter']?.limited || !!rateLimitState['generate_youtube']?.limited;
  const getTuneDisabledState = (platform: SocialPlatform) => isDisabled || !postDrafts[platform] || postDrafts[platform]?.startsWith("Error") || postDrafts[platform]?.startsWith("Rate limited") || isTuning[platform] || !!rateLimitState[`tune_${platform}`]?.limited;
  const getAnalyzeDisabledState = (platform: SocialPlatform) => isDisabled || !postDrafts[platform] || postDrafts[platform]?.startsWith("Error") || postDrafts[platform]?.startsWith("Rate limited") || analysisStates[platform] || !!rateLimitState[`analyze_${platform}`]?.limited;


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
          styles={{ /* styles */ }}
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
        <div className="flex items-center gap-2 md:gap-4">
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
                       <div className="flex items-center gap-1 text-xs font-medium text-purple-400" title={`${xp.toLocaleString()} Experience Points`}>
                         <BrainCircuit className="h-3.5 w-3.5"/>
                         <span>{xp.toLocaleString()} XP</span>
                      </div>
                       <Separator orientation="vertical" className="h-4 bg-border/50"/>
                      {quota !== null ? (
                        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground" title={`${quotaUsed}/${quotaLimit} requests used`}>
                            <Progress value={quotaPercentage} className="w-16 h-1.5" aria-label={`Quota usage: ${quotaUsed} of ${quotaLimit} (${quotaPercentage.toFixed(0)}%)`} />
                            <span>{quotaRemaining} left</span>
                         </div>
                      ): (
                        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                           <Loader2 className="h-3.5 w-3.5 animate-spin"/>
                           <span>Quota...</span>
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
           ) : ( /* Loading state */
               <div className="flex items-center gap-1 text-sm text-muted-foreground bg-muted/30 border border-border/50 rounded-full px-3 py-1.5">
                   <Loader2 className="h-4 w-4 animate-spin"/>
                   <span>Loading...</span>
               </div>
           )}

           <Tooltip>
             <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setIsHelpModalOpen(true)} aria-label="Open Keyboard Shortcuts">
                     <HelpCircle className="h-5 w-5" />
                  </Button>
             </TooltipTrigger>
             <TooltipContent><p>Help & Shortcuts (Ctrl+H)</p></TooltipContent>
           </Tooltip>

          <Tooltip>
             <TooltipTrigger asChild>
                  <Button id="profile-button-tooltip-trigger" variant="ghost" size="icon" onClick={() => setIsProfileDialogOpen(true)} disabled={!!dbSetupError} aria-label="Open Profile Settings">
                     <UserIcon className="h-5 w-5" />
                  </Button>
             </TooltipTrigger>
             <TooltipContent><p>Profile & Settings</p></TooltipContent>
           </Tooltip>

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

      {/* Gamification Badge Bar */}
       {isClient && !dbSetupError && profile && (
         <div className="mb-4 -mt-4">
           <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden" title={`XP Progress: ${xpPercentage.toFixed(0)}% towards next badge`}>
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
              {dbSetupError} Please run the setup script.
            </AlertDescription>
          </Alert>
        )}

       {quotaExceeded && !dbSetupError && (
          <Alert variant="destructive" className="mb-6">
             <Info className="h-4 w-4" />
            <AlertTitle>Quota Limit Reached</AlertTitle>
            <AlertDescription>
              You've used all your requests. Upgrade or wait for reset.
            </AlertDescription>
          </Alert>
        )}

      {/* Display Rate Limit Timers */}
      {Object.entries(rateLimitState).map(([key, limit]) => (
          limit.limited && limit.retryAfter && limit.retryAfter > Date.now() && (
              <Alert key={key} variant="default" className="mb-4 bg-yellow-500/10 border-yellow-500/30">
                  <Timer className="h-4 w-4 text-yellow-500" />
                  <AlertTitle className="text-yellow-600">Rate Limit Active</AlertTitle>
                  <AlertDescription className="text-yellow-700">
                      Action "{key.replace(/_/g, ' ')}" is temporarily limited. {' '}
                      <CountdownTimer targetTime={limit.retryAfter} onComplete={() => clearRateLimit(key)} />
                  </AlertDescription>
              </Alert>
          )
      ))}


      <main className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

        {/* Content Input Column */}
        <Card className="lg:col-span-1 bg-card/80 border-border/30 shadow-lg flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot className="text-primary" /> Content Input</CardTitle>
            <CardDescription>Enter URL or text, choose a persona, and generate posts.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col gap-4">
             <div className="w-full sm:w-2/3 md:w-1/2">
                <Label htmlFor="persona-select">AI Persona</Label>
                 <Select value={persona} onValueChange={(value) => setPersona(value as Persona)}>
                   <SelectTrigger id="persona-select-trigger" className="w-full" disabled={isDisabled} aria-label="Select AI Persona">
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
            <Textarea
              id="content-input-textarea"
              placeholder="Paste your content or URL here..."
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              rows={4}
              className="min-h-[150px] md:min-h-[200px] lg:min-h-[250px] bg-input/50 border-border/50 text-base resize-y flex-grow"
              disabled={isDisabled}
              suppressHydrationWarning
              spellCheck={true}
              aria-label="Content Input"
            />
          </CardContent>
          <CardFooter>
            <Button
              id="generate-posts-button"
              onClick={handleGenerate}
              disabled={isGenerateDisabled} // Use specific disabled state
              loading={isGeneratingSummary || isGeneratingPosts}
              className="w-full md:w-auto ml-auto transition-transform duration-200 hover:scale-105"
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
              <CardContent className="flex-grow flex flex-col">
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
                      <TabsContent key={platform} value={platform} className="flex-grow mt-0 flex flex-col">
                        <div className="flex gap-4 h-full flex-grow">
                            {/* Main Output Card for the Platform */}
                            <Card className="bg-background border-border/50 h-full flex flex-col flex-grow">
                              <CardContent className="p-4 space-y-4 relative flex-grow flex flex-col">
                                {isTuning[platform] && (
                                   <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-md">
                                      <Loader2 className="h-6 w-6 animate-spin text-primary-foreground"/>
                                   </div>
                                 )}
                                 {postDrafts[platform]?.startsWith("Error generating") || postDrafts[platform]?.startsWith("Rate limited") ? (
                                    <div className="flex h-full items-center justify-center text-destructive p-4 border border-dashed border-destructive/50 rounded-md">
                                        {postDrafts[platform]}
                                    </div>
                                 ) : (
                                    <Textarea
                                      ref={platform === activeTab ? outputTextareaRef : null}
                                      value={postDrafts[platform] || ''}
                                      onChange={(e) => setPostDrafts(prev => ({...prev, [platform]: e.target.value}))}
                                      className="min-h-[200px] bg-input/30 border-border/30 resize-y text-sm h-full flex-grow"
                                      suppressHydrationWarning
                                      spellCheck={true}
                                      disabled={isDisabled || isTuning[platform]}
                                      aria-label={`${platform} post draft`}
                                    />
                                 )}
                                <PreviewMockup platform={platform} content={postDrafts[platform] || ''} />

                                {/* Tune Buttons */}
                                {!postDrafts[platform]?.startsWith("Error generating") && !postDrafts[platform]?.startsWith("Rate limited") && (
                                     <div className="flex flex-wrap gap-2 shrink-0 pt-2 tune-buttons-group">
                                      <span className="text-xs text-muted-foreground mr-2 mt-1.5">Quick Tune:</span>
                                       <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'Make wittier')} disabled={getTuneDisabledState(platform)}>Witty</Button>
                                       <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'More concise')} disabled={getTuneDisabledState(platform)}>Concise</Button>
                                       <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'More professional')} disabled={getTuneDisabledState(platform)}>Professional</Button>
                                       <Button size="sm" variant="outline" onClick={() => setIsToneSheetOpen(true)} disabled={getTuneDisabledState(platform)}>
                                         <Palette className="mr-1.5 h-3.5 w-3.5"/> Tune Tone...
                                       </Button>
                                     </div>
                                )}
                              </CardContent>
                              {/* Footer with Action Buttons */}
                              {!postDrafts[platform]?.startsWith("Error generating") && !postDrafts[platform]?.startsWith("Rate limited") && (
                                  <CardFooter className="flex justify-end gap-2 shrink-0 pt-0">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                             <Button
                                               variant="ghost"
                                               size="icon"
                                               onClick={() => handleAnalyzePost(platform)}
                                               disabled={getAnalyzeDisabledState(platform)} // Use specific disabled state
                                               loading={analysisStates[platform]}
                                               className="ai-advisor-button hover:bg-purple-500/10"
                                               aria-label="Get AI feedback"
                                             >
                                                <Sparkles className="h-4 w-4 text-purple-400" />
                                             </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>AI Advisor: Analyze Post</p></TooltipContent>
                                    </Tooltip>
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
                                    <Tooltip>
                                       <TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" onClick={() => copyToClipboard(postDrafts[platform])} disabled={!postDrafts[platform] || isPublishing[platform]} aria-label="Copy Post">
                                             <Copy className="h-4 w-4" />
                                          </Button>
                                       </TooltipTrigger>
                                       <TooltipContent><p>Copy Post</p></TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                           <Button
                                             onClick={() => handlePublishPost(platform)}
                                             disabled={true}
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

             {/* Boost Panel */}
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
          currentTone={persona}
          onApplyTone={(newTone) => {
            const selectedPersona = newTone as Persona;
            const personaData = PERSONAS[selectedPersona];
            setPersona(selectedPersona);
            // Trigger tune with the *new* persona's prompt
            handleTunePost(activeTab, `Change tone to ${personaData?.label || selectedPersona}`);
            setIsToneSheetOpen(false);
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
