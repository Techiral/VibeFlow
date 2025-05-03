// src/components/dashboard/dashboard.tsx
'use client';

import type { User } from '@supabase/supabase-js';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Quota, UserProfileFunctionReturn } from '@/types/supabase';
import { summarizeContent, type SummarizeContentOutput } from '@/ai/flows/summarize-content';
import { generateSocialPosts, type GenerateSocialPostsOutput } from '@/ai/flows/generate-social-posts';
import { tuneSocialPosts, type TuneSocialPostsOutput } from '@/ai/flows/tune-social-posts';
import { analyzePost, type AnalyzePostOutput } from '@/ai/flows/analyze-post'; // Added analyzePost
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from 'next/link'; // Corrected import
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
    Zap, User as UserIcon, LogOut, Copy, Bot, Palette, Lightbulb, AlertCircle, X, Loader2,
    Check, Sparkles, Settings2, BookOpen, Info, Hash, Smile, BrainCircuit, Trophy, Star, ChevronRight
} from 'lucide-react'; // Added ChevronRight
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileDialog } from './profile-dialog'; // Import the profile dialog
import { Progress } from "@/components/ui/progress"; // Import Progress component
import AiAdvisorPanel from './ai-advisor-panel'; // Import AI Advisor Panel
import { toast as sonnerToast } from 'sonner'; // Import sonner toast for confetti effect
import Confetti from 'react-confetti';
import Joyride, { Step, CallBackProps } from 'react-joyride'; // Import react-joyride
import ToneTunerSheet from './tone-tuner-sheet'; // Import ToneTunerSheet
import BoostPanel from './boost-panel'; // Import BoostPanel
import PreviewMockup from './preview-mockup'; // Import PreviewMockup
import HelpModal from './help-modal'; // Import HelpModal
import { Separator } from '@/components/ui/separator'; // Added import for Separator
import { cn } from '@/lib/utils'; // Import cn utility


// Type definitions
type SocialPlatform = 'linkedin' | 'twitter' | 'youtube';
type LoadingState = {
  summarizing: boolean;
  generating: SocialPlatform | null;
  tuning: { [K in SocialPlatform]?: string | null }; // Track instruction being tuned per platform
  analyzing: SocialPlatform | null;
};

// Define RateLimitState with specific operation keys
type RateLimitOperation = 'summarize' | 'generate' | 'tune' | 'analyze';
type RateLimitState = {
  [key in RateLimitOperation]?: {
    active: boolean;
    retryAfter: number; // Timestamp when retry is possible
    retryCount: number; // Track retries
  };
};

const MAX_AI_RETRIES = 3; // Define max retries for AI operations
const INITIAL_BACKOFF_MS = 1000; // Initial backoff for retries

interface DashboardProps {
  user: User;
  initialProfile: UserProfileFunctionReturn | null;
  initialQuota: Quota | null;
  initialXp: number;
  initialBadges: string[];
  dbSetupError: boolean;
  serverErrorMessage: string | null; // Non-DB setup related error from server
}

const PLATFORMS: SocialPlatform[] = ['linkedin', 'twitter', 'youtube'];

const PERSONAS = [
    { value: 'default', label: 'Default', prompt: '' },
    { value: 'tech_ceo', label: 'Tech CEO', prompt: 'Write like a visionary, authoritative tech CEO. Focus on innovation, disruption, and market leadership. Use strong verbs and a confident tone.' },
    { value: 'casual_gen_z', label: 'Casual Gen Z', prompt: 'Write in a laid-back, emoji-friendly style. Use current slang (appropriately), keep it concise, and add a touch of humor. Vibes should be chill and relatable. ✨' },
    { value: 'thought_leader', label: 'Thought Leader', prompt: 'Write like an insightful industry expert. Offer unique perspectives, data-backed arguments, and forward-looking statements. Maintain a professional yet engaging tone.' },
    { value: 'meme_lord', label: 'Meme Lord', prompt: 'Write with humor, sarcasm, and internet culture references. Use meme formats or styles where appropriate, but keep it relevant to the content. Be witty and slightly absurd. 🤪' },
    { value: 'formal_pro', label: 'Formal Pro', prompt: 'Write in a strictly professional and formal tone. Avoid contractions, slang, and emojis. Focus on clarity, precision, and objective language.' },
    { value: 'fun_vibes', label: 'Fun Vibes', prompt: 'Write with an upbeat, enthusiastic, and friendly tone. Use exclamation points and positive language. Make it sound exciting and approachable! 🎉' },
];

// Define badge thresholds and details
const BADGES = [
  { xp: 50, name: 'Vibe Starter ✨', description: 'Generated 5 posts!', icon: Star },
  { xp: 100, name: 'Content Ninja 🥷', description: 'Generated 10 posts!', icon: Trophy },
  { xp: 200, name: 'Social Samurai ⚔️', description: 'Generated 20 posts!', icon: Zap },
  { xp: 500, name: 'AI Maestro 🧑‍🔬', description: 'Mastered 50 generations!', icon: BrainCircuit },
  { xp: 0, name: 'onboarded', description: 'Completed the onboarding tour!', hidden: true }, // Hidden badge for onboarding
];

// Onboarding steps definition
const ONBOARDING_STEPS: Step[] = [
  {
    target: '#content-input-section',
    content: 'Welcome to VibeFlow! Start by pasting your content or a URL here.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '#persona-selector',
    content: 'Choose an AI persona to set the tone for your generated posts.',
    placement: 'bottom',
  },
  {
    target: '#generate-posts-button',
    content: 'Click here to let the AI summarize your content and generate posts!',
    placement: 'bottom',
  },
  {
    target: '#output-tabs',
    content: 'Your generated posts for LinkedIn, Twitter, and YouTube will appear here.',
    placement: 'top',
  },
  {
    target: '#tune-buttons-linkedin', // Target a specific platform's tune buttons initially
    content: 'Use these buttons to tune the post with AI suggestions.',
    placement: 'top',
  },
   {
    target: '#ai-advisor-button-linkedin', // Target a specific platform's advisor button
    content: 'Click the ✨ icon to get AI feedback on your draft.',
    placement: 'top',
  },
  {
    target: '#quota-display',
    content: 'Keep an eye on your monthly usage quota and XP here.',
    placement: 'bottom',
  },
  {
    target: '#profile-button',
    content: 'Manage your profile, API keys, and settings here.',
    placement: 'bottom',
  },
];


export default function Dashboard({
  user,
  initialProfile,
  initialQuota,
  initialXp,
  initialBadges,
  dbSetupError,
  serverErrorMessage,
}: DashboardProps) {
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [generatedPosts, setGeneratedPosts] = useState<Record<SocialPlatform, string>>({
    linkedin: '',
    twitter: '',
    youtube: '',
  });
  const [profile, setProfile] = useState<UserProfileFunctionReturn | null>(initialProfile);
  const [quota, setQuota] = useState<Quota | null>(initialQuota);
  const [xp, setXp] = useState<number>(initialXp);
  const [badges, setBadges] = useState<string[]>(initialBadges);
  const [selectedPersona, setSelectedPersona] = useState<string>('default');
  const [loadingState, setLoadingState] = useState<LoadingState>({
    summarizing: false,
    generating: null,
    tuning: {},
    analyzing: null,
  });
  const [rateLimitState, setRateLimitState] = useState<RateLimitState>({});
  const rateLimitTimers = useRef<{ [key in RateLimitOperation]?: NodeJS.Timeout }>({});
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(serverErrorMessage);
  const [isAiAdvisorOpen, setIsAiAdvisorOpen] = useState(false);
  const [advisorAnalysis, setAdvisorAnalysis] = useState<AnalyzePostOutput | null>(null);
  const [analyzingPlatform, setAnalyzingPlatform] = useState<SocialPlatform | null>(null);
  const [isToneTunerOpen, setIsToneTunerOpen] = useState(false);
  const [tuningPlatform, setTuningPlatform] = useState<SocialPlatform | null>(null);
  const [isBoostPanelOpen, setIsBoostPanelOpen] = useState(false);
  const [activeOutputTab, setActiveOutputTab] = useState<SocialPlatform>('linkedin');
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState(200);

  const [runTour, setRunTour] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const outputTextareaRefs = {
    linkedin: useRef<HTMLTextAreaElement>(null),
    twitter: useRef<HTMLTextAreaElement>(null),
    youtube: useRef<HTMLTextAreaElement>(null),
  };

  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();


 // --- Badge Awarding ---
  const checkAndAwardBadges = useCallback(async (currentXp: number, achievedBadges: string[]) => {
    const newlyAwardedBadges: typeof BADGES[number][] = [];
    BADGES.forEach(badge => {
      if (!badge.hidden && currentXp >= badge.xp && !achievedBadges.includes(badge.name)) {
        newlyAwardedBadges.push(badge);
      }
    });

    if (newlyAwardedBadges.length > 0) {
      const newBadgeNames = newlyAwardedBadges.map(b => b.name);
      const updatedBadges = [...achievedBadges, ...newBadgeNames];

      try {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ badges: updatedBadges })
          .eq('id', user.id);

        if (updateError) throw updateError;

        setBadges(updatedBadges);

        newlyAwardedBadges.forEach((badge, index) => {
          setTimeout(() => {
            setShowConfetti(true);
            setConfettiPieces(200 + index * 50);
            sonnerToast.success(`🏆 Badge Unlocked: ${badge.name}`, {
              description: badge.description,
              duration: 5000,
            });
            setTimeout(() => setShowConfetti(false), 4000);
          }, index * 500);
        });

      } catch (error: any) {
        console.error("Failed to update badges:", error.message);
        toast({
          title: "Badge Award Error",
          description: "Could not save newly awarded badges.",
          variant: "destructive",
        });
      }
    }
  }, [supabase, user.id, toast]); // Dependencies


  // --- Joyride & Client-Side Check ---
  useEffect(() => {
    setIsClient(true);
    if (profile && !badges.includes('onboarded') && !dbSetupError && !errorMessage) {
      const timer = setTimeout(() => setRunTour(true), 500);
      return () => clearTimeout(timer);
    }
  }, [profile, badges, dbSetupError, errorMessage]);

  const handleJoyrideCallback = useCallback(async (data: CallBackProps) => {
    const { status } = data;
    const FINISHED_STATUSES: string[] = ['finished', 'skipped'];

    if (FINISHED_STATUSES.includes(status)) {
      setRunTour(false);
      if (status === 'finished' && profile && !badges.includes('onboarded')) {
        try {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ badges: [...badges, 'onboarded'] })
            .eq('id', user.id);

          if (updateError) throw updateError;
          setBadges(prev => [...prev, 'onboarded']);
          console.log("Onboarding badge awarded.");
        } catch (error: any) {
          console.error("Failed to save onboarding completion:", error.message);
        }
      }
    }
  }, [supabase, user.id, profile, badges]);


  // --- Rate Limit Countdown Effect ---
  useEffect(() => {
    const timers = Object.keys(rateLimitState).map(key => {
      const operationKey = key as RateLimitOperation;
      const state = rateLimitState[operationKey];
      if (state?.active) {
        const updateTimer = () => {
          const now = Date.now();
          if (now >= state.retryAfter) {
            setRateLimitState(prev => {
              const newState = { ...prev };
              delete newState[operationKey];
              return newState;
            });
          } else {
            setRateLimitState(prev => ({ ...prev })); // Force re-render
            return setTimeout(updateTimer, 1000);
          }
        };
        return updateTimer();
      }
      return undefined;
    }).filter((timer): timer is NodeJS.Timeout => timer !== undefined);

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [rateLimitState]);


  // --- Data Fetching and Initialization ---
  useEffect(() => {
    const ensureData = async () => {
      let currentProfile = profile;
      let currentQuota = quota;
      let currentBadges = badges;
      let profileErrorOccurred = false;
      let quotaErrorOccurred = false;

      if (!currentProfile) {
        console.log("Profile missing, attempting to fetch/create...");
        try {
          const { data: profileDataArray, error: profileError } = await supabase
            .rpc('get_user_profile', { p_user_id: user.id });

          if (profileError) throw profileError;

          if (!profileDataArray || profileDataArray.length === 0) {
            throw new Error("Profile function failed to return or create a profile.");
          }

          currentProfile = profileDataArray[0];
          setProfile(currentProfile);
          currentBadges = currentProfile?.badges ?? [];
          setBadges(currentBadges);
          setXp(currentProfile?.xp ?? 0);
          console.log("Profile fetched/created successfully:", currentProfile?.username);

        } catch (error: any) {
          console.error("Error fetching/creating profile on client:", error.message);
          setErrorMessage(prev => prev ? `${prev}\nProfile Error: ${error.message}` : `Profile Error: ${error.message}`);
          profileErrorOccurred = true;
        }
      } else {
         if (!initialBadges || badges !== initialBadges) setBadges(initialBadges ?? []);
         if (xp !== initialXp) setXp(initialXp ?? 0);
      }

      if (!currentQuota && !profileErrorOccurred) {
        console.log("Quota missing, attempting to fetch/create...");
        try {
          const { data: remainingQuota, error: remainingQuotaError } = await supabase.rpc('get_remaining_quota', { p_user_id: user.id });

          if (remainingQuotaError) {
              console.error("Error calling get_remaining_quota:", remainingQuotaError);
               const { data: quotaData, error: quotaFetchError } = await supabase
                    .from('quotas')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (quotaFetchError) throw quotaFetchError;
                currentQuota = quotaData;

          } else {
             const { data: quotaData, error: quotaFetchError } = await supabase
                 .from('quotas')
                 .select('*')
                 .eq('user_id', user.id)
                 .single();

             if (quotaFetchError) {
                console.error("Error fetching full quota object after RPC call:", quotaFetchError);
                currentQuota = {
                   user_id: user.id,
                   request_count: 100 - (remainingQuota ?? 0),
                   quota_limit: 100,
                   last_reset_at: new Date().toISOString(),
                   created_at: new Date().toISOString(),
                   ip_address: null
                };
             } else {
                currentQuota = quotaData;
             }
          }

           if (!currentQuota) {
               console.warn("Quota record still missing after fetch attempts. Attempting to insert default.");
               const { data: insertedQuota, error: insertError } = await supabase
                   .from('quotas')
                   .insert({ user_id: user.id })
                   .select()
                   .single();

               if (insertError) {
                   console.error("Error inserting default quota:", insertError.message);
                   if (insertError.message.includes("violates row-level security policy")) {
                       setErrorMessage(prev => prev ? `${prev}\nQuota Error: Database permissions error (RLS). Check Supabase policies.` : `Quota Error: Database permissions error (RLS). Check Supabase policies.`);
                   } else {
                       throw insertError;
                   }
                   currentQuota = null;
               } else {
                   currentQuota = insertedQuota;
               }
           }

          setQuota(currentQuota);
          if (currentQuota) {
            console.log("Quota fetched/created successfully:", currentQuota.request_count, "/", currentQuota.quota_limit);
          }

        } catch (error: any) {
          console.error("Error fetching/creating quota on client:", error.message);
          setErrorMessage(prev => prev ? `${prev}\nQuota Error: ${error.message}` : `Quota Error: ${error.message}`);
          quotaErrorOccurred = true;
        }
      } else if (currentQuota && !quotaErrorOccurred) {
          try {
               const { data: remainingQuota, error: refreshError } = await supabase.rpc('get_remaining_quota', { p_user_id: user.id });
               if (refreshError) {
                  console.error("Error refreshing quota via RPC:", refreshError.message);
               } else {
                    const newCount = currentQuota.quota_limit - (remainingQuota ?? 0);
                    if (newCount !== currentQuota.request_count) {
                       console.log("Quota count refreshed via RPC.");
                       setQuota(prev => prev ? { ...prev, request_count: newCount } : null);
                    }
               }
          } catch (rpcError: any) {
               console.error("Exception during quota refresh RPC:", rpcError.message);
          }
      }

      if (currentProfile && !profileErrorOccurred) {
        checkAndAwardBadges(currentProfile.xp ?? 0, currentBadges);
      }

    };

    if (!dbSetupError) {
      ensureData();
    } else {
      setProfile(null);
      setQuota(null);
    }

  }, [user.id, supabase, dbSetupError, checkAndAwardBadges, profile, quota, badges, xp, initialBadges, initialXp, initialProfile, initialQuota, errorMessage]);


  // --- Profile Update Handling ---
  const handleProfileUpdate = (updatedProfile: UserProfileFunctionReturn) => {
    setProfile(updatedProfile);
    if (updatedProfile.gemini_api_key && errorMessage?.includes('Gemini API Key is missing')) {
      setErrorMessage(null);
    }
    checkAndAwardBadges(updatedProfile.xp ?? 0, updatedProfile.badges ?? []);
  };


  // --- Sign Out ---
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };


  // --- Helper for AI Calls with Quota Check, Error Handling, and Retry ---
  const callAiWithRetry = async <T>(
    aiFunction: () => Promise<T>,
    cost: number,
    operationKey: RateLimitOperation
  ): Promise<{ data: T | null; error: Error | null; rateLimited?: boolean; retryAfter?: number }> => {
    let currentAttempt = 0;
    let backoff = INITIAL_BACKOFF_MS;

    while (currentAttempt < MAX_AI_RETRIES) {
      const currentLimitState = rateLimitState[operationKey];
      if (currentLimitState?.active && Date.now() < currentLimitState.retryAfter) {
        const retryTime = new Date(currentLimitState.retryAfter).toLocaleTimeString();
        const remainingSeconds = Math.ceil((currentLimitState.retryAfter - Date.now()) / 1000);
        console.warn(`Operation ${operationKey} is rate-limited. Try again after ${retryTime} (${remainingSeconds}s)`);
        setErrorMessage(`Rate limit active for ${operationKey}. Please wait ${remainingSeconds} seconds.`);
        return { data: null, error: new Error("Rate limit active"), rateLimited: true, retryAfter: currentLimitState.retryAfter };
      }

      // Clear expired rate limit state before proceeding
      if (rateLimitState[operationKey]?.active && Date.now() >= rateLimitState[operationKey]!.retryAfter) {
        setRateLimitState(prev => {
          const newState = { ...prev };
          delete newState[operationKey];
          return newState;
        });
      }

      const currentQuotaCount = quota?.request_count ?? 0;
      const currentQuotaLimit = quota?.quota_limit ?? 100;
      if (currentQuotaCount + cost > currentQuotaLimit) {
        console.warn("Quota exceeded (local check). Required:", cost, "Used:", currentQuotaCount, "Limit:", currentQuotaLimit);
        setErrorMessage("Quota exceeded. Upgrade your plan or wait for reset.");
        return { data: null, error: new Error("Quota exceeded.") };
      }

      if (!profile?.gemini_api_key) {
        setErrorMessage("Google Gemini API Key is missing. Please add it in your profile settings.");
        setIsProfileDialogOpen(true);
        return { data: null, error: new Error("Missing Gemini API Key") };
      }

      let result: T | null = null;
      let error: Error | null = null;
      let shouldRefund = false;
      let isRateLimitError = false;
      let apiRetryAfter = 0;

      try {
        console.log(`Attempting to increment quota by ${cost} for user ${user.id}`);
        const { data: remainingQuotaAfterIncrement, error: incrementError } = await supabase.rpc('increment_quota', {
          p_user_id: user.id,
          p_increment_amount: cost,
        });

        if (incrementError) {
          if (incrementError.message.includes('quota_exceeded')) {
            console.warn("Quota exceeded (checked during increment RPC).");
            setErrorMessage("Quota exceeded. Upgrade your plan or wait for reset.");
            setQuota(prev => prev ? { ...prev, request_count: prev.quota_limit } : null);
            return { data: null, error: new Error("Quota exceeded.") };
          } else {
            console.error("Error incrementing quota via RPC:", incrementError);
            throw new Error(`Failed to update quota: ${incrementError.message}`);
          }
        }
        console.log("Quota increment RPC successful, refetching data...");
        shouldRefund = true; // Mark that increment succeeded, refund may be needed if AI call fails

        // ---- Refetch Profile and Quota AFTER successful increment ----
         try {
             const { data: postIncrementQuota, error: qError } = await supabase
               .from('quotas')
               .select('*')
               .eq('user_id', user.id)
               .single();

             if (qError) throw qError;
             setQuota(postIncrementQuota);
             console.log("Refetched quota data:", postIncrementQuota);

             const { data: postIncrementProfileData, error: pError } = await supabase
               .rpc('get_user_profile', { p_user_id: user.id });

             if (pError) throw pError;
              if (!postIncrementProfileData || postIncrementProfileData.length === 0) {
                  throw new Error("Profile function failed to return data after increment.");
              }
             const postIncrementProfile = postIncrementProfileData[0];
             setProfile(postIncrementProfile);
             setXp(postIncrementProfile.xp ?? 0);
             const updatedBadges = postIncrementProfile.badges ?? [];
             setBadges(updatedBadges);
             console.log("Refetched profile data:", postIncrementProfile);
             checkAndAwardBadges(postIncrementProfile.xp ?? 0, updatedBadges);

         } catch (refetchError: any) {
             console.error("Error refetching profile/quota post-increment:", refetchError.message);
             toast({
                 title: "Data Sync Issue",
                 description: "Could not refresh profile/quota after usage update.",
                 variant: "destructive"
             });
         }
         // ---- End Refetch ----

        // ---- Execute AI Function ----
        result = await aiFunction();
        // SUCCESS - Exit the loop
        return { data: result, error: null };
        // ---- End Execute AI Function ----

      } catch (err: any) {
        error = err instanceof Error ? err : new Error(String(err));
        console.error(`Error during AI operation (${operationKey}) attempt ${currentAttempt + 1}/${MAX_AI_RETRIES}:`, error.message);

        const messageLower = error.message?.toLowerCase() || '';
        const status = (err instanceof Error && 'status' in err) ? (err as any).status : null;

        // Check for RETRIABLE errors
        if (status === 'UNAVAILABLE' || messageLower.includes('503') || messageLower.includes('unavailable') || messageLower.includes('overloaded')) {
          isRateLimitError = true; // Treat as temporary rate limit/unavailability
          apiRetryAfter = Date.now() + backoff;
          console.warn(`AI Service unavailable for ${operationKey}. Retrying in ${backoff}ms...`);
          setRateLimitState(prev => ({
              ...prev,
              [operationKey]: { active: true, retryAfter: apiRetryAfter, retryCount: (prev[operationKey]?.retryCount ?? 0) + 1 }
          }));
          setErrorMessage(`AI service for ${operationKey} is temporarily unavailable. Retrying...`); // Inform user about retry

          // Wait for backoff period before next attempt
          await new Promise(resolve => setTimeout(resolve, backoff));
          currentAttempt++;
          backoff *= 2; // Exponential backoff
          continue; // Go to next iteration of the while loop
        }

        // Handle NON-RETRIABLE errors below
        if (status === 'RESOURCE_EXHAUSTED' || messageLower.includes('rate limit') || messageLower.includes('429')) {
           isRateLimitError = true;
           const retryDelaySeconds = err.details?.retryDelay?.seconds ?? 60;
           apiRetryAfter = Date.now() + (retryDelaySeconds * 1000);
           setRateLimitState(prev => ({
             ...prev,
             [operationKey]: { active: true, retryAfter: apiRetryAfter, retryCount: MAX_AI_RETRIES } // Set count to max to prevent further retries
           }));
           const remainingSeconds = Math.ceil((apiRetryAfter - Date.now()) / 1000);
           console.warn(`API Rate limit hit for ${operationKey}. Wait ${remainingSeconds}s.`);
           setErrorMessage(`Rate limit active for ${operationKey}. Please wait ${remainingSeconds} seconds.`);
        } else if (status === 'INVALID_ARGUMENT') {
          console.error(`Invalid argument for ${operationKey}:`, error.message);
          setErrorMessage(`Error: Invalid input or configuration for ${operationKey}. Please check your input and API key.`);
        } else if (status === 'UNAUTHENTICATED' || messageLower.includes('api key not valid')) {
          console.error(`Authentication error for ${operationKey}: Invalid API Key.`);
          setErrorMessage("Invalid Gemini API Key. Please check your profile settings.");
          setIsProfileDialogOpen(true);
        } else {
          console.error(`Internal error during ${operationKey}:`, error.message);
          setErrorMessage(`An internal error occurred during ${operationKey}: ${error.message}`);
        }

        // Break the loop for non-retriable errors
        break;

      } finally {
         // Refund only if a non-retriable error occurred *after* a successful increment
         // and we are breaking the loop
         if (error && !isRateLimitError && shouldRefund && cost > 0 && currentAttempt >= MAX_AI_RETRIES -1) {
             console.log(`Refunding ${cost} quota point(s) due to non-retriable error.`);
             try {
                 const { error: decrementError } = await supabase.rpc('increment_quota', {
                     p_user_id: user.id,
                     p_increment_amount: -cost,
                 });
                 if (decrementError) {
                     console.error("Error refunding quota via RPC:", decrementError);
                     toast({ title: "Quota Refund Failed", description: "Could not automatically refund quota.", variant: "destructive"});
                 } else {
                      console.log("Quota refunded successfully via RPC.");
                     const { data: refundedQuotaData, error: fetchError } = await supabase
                         .from('quotas')
                         .select('*')
                         .eq('user_id', user.id)
                         .single();
                     if (!fetchError && refundedQuotaData) {
                         setQuota(refundedQuotaData);
                         console.log("Quota state updated after refund:", refundedQuotaData);
                     } else {
                          console.warn("Failed to refetch quota state after refund.");
                     }
                 }
             } catch (refundError: any) {
                 console.error("Exception during quota refund RPC call:", refundError.message);
                 toast({ title: "Quota Refund Exception", description: "An unexpected error occurred during quota refund.", variant: "destructive"});
             }
         }
      }
    } // End while loop

    // If loop finishes due to reaching max retries for a retriable error
    if (currentAttempt >= MAX_AI_RETRIES && isRateLimitError) {
      const finalMessage = `AI service for ${operationKey} remained unavailable after ${MAX_AI_RETRIES} attempts. Please try again later.`;
      console.error(finalMessage);
      setErrorMessage(finalMessage);
      // Consider setting a longer rate limit here if needed
      return { data: null, error: new Error(finalMessage), rateLimited: true, retryAfter: apiRetryAfter };
    }

    // If loop finished due to a non-retriable error
    return {
        data: null,
        error, // The non-retriable error that broke the loop
        rateLimited: isRateLimitError,
        retryAfter: isRateLimitError ? apiRetryAfter : undefined
    };
  };


  // --- Summarization and Generation ---
  const handleGeneratePosts = async () => {
    if (!content.trim() || loadingState.summarizing || loadingState.generating) return;

    setLoadingState(prev => ({ ...prev, summarizing: true, generating: 'linkedin' }));
    setSummary('');
    setGeneratedPosts({ linkedin: '', twitter: '', youtube: '' });
    setErrorMessage(null); // Clear previous errors
    setAdvisorAnalysis(null);

    const summaryCost = 1;
    const generationCostPerPlatform = 1;
    const totalCost = summaryCost + (PLATFORMS.length * generationCostPerPlatform);

    const summaryResult = await callAiWithRetry(
      async () => {
        if (!profile?.gemini_api_key) throw new Error("Missing Gemini API Key");
        return await summarizeContent({ content }, { apiKey: profile.gemini_api_key });
      },
      totalCost,
      'summarize'
    );

    if (summaryResult.error || !summaryResult.data) {
      setLoadingState(prev => ({ ...prev, summarizing: false, generating: null }));
      if (!summaryResult.rateLimited) {
         toast({ title: "Summarization Failed", description: summaryResult.error?.message || "Unknown error during summarization.", variant: "destructive" });
         // Error message already set by callAiWithRetry
      } else {
          toast({ title: "Rate Limit Active", description: `Summarization is temporarily unavailable. Please wait.`, variant: "default"});
          // Error message already set by callAiWithRetry
      }
      return; // Stop execution if summarization fails
    }

    const currentSummary = summaryResult.data.summary;
    setSummary(currentSummary);
    setLoadingState(prev => ({ ...prev, summarizing: false }));
    console.log("Summarization successful:", summaryResult.data);
    toast({ title: "Summarization Complete", description: "Now generating posts..." });

    let generationError: string | null = null;
    let anyRateLimited = false;

    const generationPromises = PLATFORMS.map(async (platform) => {
      setLoadingState(prev => ({ ...prev, generating: platform }));
      const personaPrompt = PERSONAS.find(p => p.value === selectedPersona)?.prompt || '';

      const result = await callAiWithRetry(
        async () => {
          if (!profile?.gemini_api_key) throw new Error("Missing Gemini API Key");
          return await generateSocialPosts(
            { summary: currentSummary, platform, personaPrompt },
            { apiKey: profile.gemini_api_key }
          );
        },
        0, // Cost is 0 as it was charged during summarization
        'generate'
      );

      setLoadingState(prev => ({ ...prev, generating: null })); // Indicate generation finished for this platform
      return { platform, result };
    });

    const generationResults = await Promise.allSettled(generationPromises);

    generationResults.forEach(promiseResult => {
      if (promiseResult.status === 'fulfilled') {
        const { platform, result } = promiseResult.value;
        if (result.error || !result.data) {
          if (result.rateLimited) {
            anyRateLimited = true;
             // Error message already set by callAiWithRetry
          } else {
            const errorMsg = result.error?.message || `Unknown error generating ${platform} post.`;
            console.error(`Error generating ${platform} post:`, errorMsg);
            generationError = (generationError ? generationError + "\n" : "") + `Failed to generate post for ${platform}: ${errorMsg}`;
            setGeneratedPosts(prev => ({ ...prev, [platform]: `Error: ${errorMsg}` }));
            // Error message set within callAiWithRetry
          }
        } else {
          console.log(`${platform} post generated:`, result.data.post);
          setGeneratedPosts(prev => ({ ...prev, [platform]: result.data.post }));
        }
      } else {
        const errorMsg = promiseResult.reason?.message || 'Unexpected generation error';
        console.error("Unexpected error during post generation promise:", errorMsg);
        generationError = (generationError ? generationError + "\n" : "") + `Unexpected error: ${errorMsg}`;
        setErrorMessage(prev => prev ? `${prev}\nUnexpected error: ${errorMsg}` : `Unexpected error: ${errorMsg}`);
      }
    });


    setLoadingState(prev => ({ ...prev, generating: null })); // Ensure final generating state is null

    if (generationError) {
      toast({
        title: "Post Generation Issues",
        description: "Some posts could not be generated. See individual posts or error messages for details.",
        variant: "destructive",
      });
       // Error messages are set by callAiWithRetry
    } else if (!anyRateLimited) {
      toast({ title: "Posts Generated Successfully", description: "Review and tune your new drafts." });
    } else {
        toast({ title: "Rate Limit Active", description: "Some post generations are rate-limited. Please wait.", variant: "default" });
         // Error messages are set by callAiWithRetry
    }
  };


  // --- Tuning ---
  const handleTunePost = async (platform: SocialPlatform, instruction: string) => {
    const currentPost = generatedPosts[platform];
    if (!currentPost || currentPost.startsWith("Error:") || loadingState.tuning[platform]) return;

    setLoadingState(prev => ({ ...prev, tuning: { ...prev.tuning, [platform]: instruction } }));
    setErrorMessage(null); // Clear previous errors
    setAdvisorAnalysis(null);

    const personaPrompt = PERSONAS.find(p => p.value === selectedPersona)?.prompt || '';
    const tuningCost = 1;

    const tuneResult = await callAiWithRetry(
      async () => {
        if (!profile?.gemini_api_key) throw new Error("Missing Gemini API Key");
        return await tuneSocialPosts(
          { postContent: currentPost, platform, instruction, personaPrompt },
          { apiKey: profile.gemini_api_key }
        );
      },
      tuningCost,
      'tune'
    );

    setLoadingState(prev => ({ ...prev, tuning: { ...prev.tuning, [platform]: null } }));

    if (tuneResult.error || !tuneResult.data) {
      if (!tuneResult.rateLimited) {
        const errorMsg = tuneResult.error?.message || `Unknown error tuning ${platform} post.`;
        console.error(`Tuning ${platform} post failed:`, errorMsg);
        toast({ title: `Tuning Failed (${platform})`, description: errorMsg, variant: "destructive" });
         // Error message set by callAiWithRetry
      } else {
        console.warn(`Tuning for ${platform} rate-limited. Wait.`);
         toast({ title: "Rate Limit Active", description: `Tuning for ${platform} is temporarily unavailable. Please wait.`, variant: "default"});
         // Error message set by callAiWithRetry
      }
    } else {
      console.log(`Tuning ${platform} post successful:`, tuneResult.data.tunedPost);
      setGeneratedPosts(prev => ({ ...prev, [platform]: tuneResult.data.tunedPost }));
      toast({ title: `Post Tuned (${platform})`, description: `Applied instruction: "${instruction}"` });
    }
  };


  // --- AI Advisor Analysis ---
  const handleAnalyzePost = async (platform: SocialPlatform) => {
    const postContent = generatedPosts[platform];
    if (!postContent || postContent.startsWith("Error:") || loadingState.analyzing === platform) return;

    setLoadingState(prev => ({ ...prev, analyzing: platform }));
    setIsAiAdvisorOpen(true);
    setAdvisorAnalysis(null);
    setAnalyzingPlatform(platform);
    setErrorMessage(null); // Clear previous errors

    const analysisCost = 1;

    const analysisResult = await callAiWithRetry(
      async () => {
        if (!profile?.gemini_api_key) throw new Error("Missing Gemini API Key");
        return await analyzePost({ postContent, platform }, { apiKey: profile.gemini_api_key });
      },
      analysisCost,
      'analyze'
    );

    setLoadingState(prev => ({ ...prev, analyzing: null }));

    if (analysisResult.error || !analysisResult.data) {
      if (!analysisResult.rateLimited) {
        const errorMsg = analysisResult.error?.message || `Unknown error analyzing ${platform} post.`;
        console.error(`Analysis for ${platform} post failed:`, errorMsg);
        toast({ title: `Analysis Failed (${platform})`, description: errorMsg, variant: "destructive" });
        setAdvisorAnalysis({ analysis: `Error: ${errorMsg}`, flags: [] });
        // Error message set by callAiWithRetry
      } else {
        console.warn(`Analysis for ${platform} rate-limited. Wait.`);
        setAdvisorAnalysis({ analysis: `Analysis is temporarily rate-limited. Please wait.`, flags: [] });
         toast({ title: "Rate Limit Active", description: `Analysis for ${platform} is temporarily unavailable. Please wait.`, variant: "default"});
         // Error message set by callAiWithRetry
      }
    } else {
      console.log(`Analysis for ${platform} post successful:`, analysisResult.data);
      setAdvisorAnalysis(analysisResult.data);
      toast({ title: `Analysis Complete (${platform})`, description: "Review the suggestions." });
    }
  };

  // --- Apply AI Advisor Suggestion ---
  const handleApplySuggestion = (start: number, end: number, suggestion: string) => {
    if (!analyzingPlatform) return;
    const currentContent = generatedPosts[analyzingPlatform];
    const newContent = currentContent.substring(0, start) + suggestion + currentContent.substring(end);
    setGeneratedPosts(prev => ({ ...prev, [analyzingPlatform!]: newContent }));
    toast({ title: "Suggestion Applied", description: "Post updated with AI suggestion." });
    setAdvisorAnalysis(prev => prev ? { ...prev, flags: prev.flags.filter(f => !(f.start === start && f.end === end)) } : null);
  };

  // --- Tone Tuner ---
  const openToneTuner = (platform: SocialPlatform) => {
    setTuningPlatform(platform);
    setIsToneTunerOpen(true);
  };

  const handleApplyTone = (newToneValue: string) => {
    if (!tuningPlatform) return;
    const newPersona = PERSONAS.find(p => p.value === newToneValue);
    if (!newPersona) return;

    setSelectedPersona(newToneValue); // Update global persona state

    const instruction = `Rewrite this post in the style of: ${newPersona.label || 'Default'}`;
    handleTunePost(tuningPlatform, instruction); // Call the main tuning function

    setIsToneTunerOpen(false);
    setTuningPlatform(null);
  };


  // --- Boost Panel ---
  const handleToggleBoostPanel = () => {
    setIsBoostPanelOpen(prev => !prev);
  };

  const handleInsertText = (textToInsert: string) => {
    const textarea = outputTextareaRefs[activeOutputTab]?.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = generatedPosts[activeOutputTab];
    const newText = currentText.substring(0, start) + textToInsert + currentText.substring(end);

    setGeneratedPosts(prev => ({ ...prev, [activeOutputTab]: newText }));

    requestAnimationFrame(() => {
        if (outputTextareaRefs[activeOutputTab]?.current) {
            outputTextareaRefs[activeOutputTab].current!.focus();
            outputTextareaRefs[activeOutputTab].current!.selectionStart = start + textToInsert.length;
            outputTextareaRefs[activeOutputTab].current!.selectionEnd = start + textToInsert.length;
        }
    });
  };


  // --- Copy to Clipboard ---
  const handleCopyToClipboard = async (platform: SocialPlatform) => {
    try {
      await navigator.clipboard.writeText(generatedPosts[platform]);
      toast({ title: "Copied to Clipboard!", description: `${platform.charAt(0).toUpperCase() + platform.slice(1)} post copied.` });
    } catch (err) {
      console.error("Failed to copy text: ", err);
      toast({ title: "Copy Failed", description: "Could not copy text to clipboard.", variant: "destructive" });
    }
  };


  // --- Handle Input Change ---
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  // --- Handle Output Textarea Change ---
  const handleOutputChange = (platform: SocialPlatform, value: string) => {
    setGeneratedPosts(prev => ({ ...prev, [platform]: value }));
    if (platform === analyzingPlatform) {
      setAdvisorAnalysis(null);
    }
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
        event.preventDefault();
        setIsHelpModalOpen(prev => !prev);
      }
      if (event.key === 'Escape') {
        if (isProfileDialogOpen) setIsProfileDialogOpen(false);
        if (isAiAdvisorOpen) setIsAiAdvisorOpen(false);
        if (isToneTunerOpen) setIsToneTunerOpen(false);
        if (isBoostPanelOpen) setIsBoostPanelOpen(false);
        if (isHelpModalOpen) setIsHelpModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileDialogOpen, isAiAdvisorOpen, isToneTunerOpen, isBoostPanelOpen, isHelpModalOpen]);


  // --- Calculate Quota Percentage ---
  const quotaPercentage = (quota?.request_count && quota?.quota_limit && quota.quota_limit > 0)
    ? (quota.request_count / quota.quota_limit) * 100
    : 0;

  const quotaTooltipContent = quota
    ? `${quota.request_count ?? 0} / ${quota.quota_limit ?? 100} requests used this cycle.`
    : "Loading quota...";


  // --- Calculate XP Percentage for next level ---
  const getCurrentLevelInfo = (currentXp: number) => {
    let currentLevel = 0;
    let nextLevelXp = BADGES.find(b => !b.hidden)?.xp || 50;
    let currentLevelXpThreshold = 0;
    const sortedVisibleBadges = BADGES.filter(b => !b.hidden).sort((a, b) => a.xp - b.xp);

    for (let i = 0; i < sortedVisibleBadges.length; i++) {
      if (currentXp >= sortedVisibleBadges[i].xp) {
        currentLevel = i + 1;
        currentLevelXpThreshold = sortedVisibleBadges[i].xp;
        if (i + 1 < sortedVisibleBadges.length) {
          nextLevelXp = sortedVisibleBadges[i + 1].xp;
        } else {
          nextLevelXp = currentLevelXpThreshold * 2;
        }
      } else {
        nextLevelXp = sortedVisibleBadges[i].xp;
        break;
      }
    }

    const xpTowardsNext = Math.max(0, currentXp - currentLevelXpThreshold);
    const xpNeededForNext = Math.max(1, nextLevelXp - currentLevelXpThreshold);
    const percentage = Math.min(100, (xpTowardsNext / xpNeededForNext) * 100);
    return {
      level: currentLevel,
      xpForNextLevel: nextLevelXp,
      percentage: isNaN(percentage) ? 0 : percentage,
      xpTowardsNext: xpTowardsNext,
      xpNeededForNext: xpNeededForNext
    };
  };

  const xpInfo = getCurrentLevelInfo(xp);
  const xpTooltipContent = `Level ${xpInfo.level} | ${xp} XP (${xpInfo.xpTowardsNext}/${xpInfo.xpNeededForNext} towards Lvl ${xpInfo.level + 1} @ ${xpInfo.xpForNextLevel} XP)`;

  const isApiKeyMissing = !profile?.gemini_api_key;
  const isQuotaExceeded = quota ? (quota.request_count ?? 0) >= (quota.quota_limit ?? 100) : false;

  const getRateLimitRemainingTime = (operationKey: RateLimitOperation): number => {
    const state = rateLimitState[operationKey];
    if (state?.active && state.retryAfter > Date.now()) {
      return Math.ceil((state.retryAfter - Date.now()) / 1000);
    }
    return 0;
  };

  const getRateLimitTooltip = (operationKey: RateLimitOperation): React.ReactNode | undefined => {
    const remainingTime = getRateLimitRemainingTime(operationKey);
    if (remainingTime > 0) {
      return `Rate limit active. Wait ${remainingTime}s.`;
    }
    return undefined;
  };


  if (profile === undefined || quota === undefined) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    );
  }

  if (dbSetupError) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Database Setup Required</AlertTitle>
          <AlertDescription>
            <p className="mb-4">{errorMessage || "Database setup is incomplete. Please follow the README instructions."}</p>
            <p className="text-sm text-muted-foreground">
              Go to the Supabase SQL Editor in your project and run the script from <code>supabase/schema.sql</code>. See README Step 3.
            </p>
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={handleSignOut}>Go to Login</Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Main Dashboard Structure
  return (
    <TooltipProvider>
      {isClient && (
        <Joyride
          steps={ONBOARDING_STEPS}
          run={runTour}
          continuous={true}
          showProgress={true}
          showSkipButton={true}
          callback={handleJoyrideCallback}
          styles={{
            options: {
              zIndex: 10000,
              primaryColor: '#6D28D9',
              arrowColor: '#0A0A0A',
              backgroundColor: '#0A0A0A',
              textColor: '#F1F5F9',
            },
            tooltip: {
              borderRadius: '0.5rem',
              padding: '1rem',
            },
            buttonNext: {
              backgroundColor: '#6D28D9',
              borderRadius: '0.375rem',
            },
            buttonBack: {
              color: '#A0AEC0',
            },
            buttonSkip: {
              color: '#A0AEC0',
            },
          }}
        />
      )}
      {isClient && showConfetti && (
        <Confetti
          width={typeof window !== 'undefined' ? window.innerWidth : 0}
          height={typeof window !== 'undefined' ? window.innerHeight : 0}
          numberOfPieces={confettiPieces}
          recycle={false}
          onConfettiComplete={() => setShowConfetti(false)}
          className="!fixed !top-0 !left-0 !w-full !h-full !z-[10001]"
        />
      )}
       {/* Adjusted main container for dynamic columns based on side panel visibility */}
        <div className={cn(
         "flex flex-col min-h-screen bg-background text-foreground p-4 md:p-8 relative",
         runTour && "joyride-active-step-fix"
       )}>
         <header className="flex justify-between items-center mb-6 md:mb-8">
            <Link href="/" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
              <Zap className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-gradient">VibeFlow</h1>
            </Link>
           <div className="flex items-center gap-4 md:gap-6">
             {/* Quota and XP Display */}
                <Tooltip>
                  <TooltipTrigger asChild>
                      <div id="quota-display" className="flex flex-col items-end w-32 md:w-48 cursor-default">
                          <div className="w-full flex justify-between items-center mb-1">
                            <span className="text-xs font-medium text-muted-foreground">Usage</span>
                            {quota ? (
                              <span className="text-xs font-semibold">{quota.request_count ?? 0}/{quota.quota_limit ?? 100}</span>
                            ) : (
                              <Skeleton className="h-3 w-10" />
                            )}
                          </div>
                          <Progress
                            value={quotaPercentage}
                            className="h-1.5 w-full"
                            aria-label="Monthly Usage Quota"
                            indicatorClassName={isQuotaExceeded ? "bg-destructive" : "bg-primary"}
                          />
                          <div className="w-full flex justify-between items-center mt-1.5 mb-1">
                            <span className="text-xs font-medium text-muted-foreground">XP</span>
                            <span className="text-xs font-semibold">{xp}</span>
                          </div>
                          <Progress
                            value={xpInfo.percentage}
                            className="h-1.5 w-full"
                            aria-label={xpTooltipContent}
                            indicatorClassName="bg-gradient-to-r from-purple-500 to-cyan-400"
                          />
                        </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end">
                    <p>{quotaTooltipContent}</p>
                    <p>{xpTooltipContent}</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setIsProfileDialogOpen(true)} id="profile-button">
                      <UserIcon className="h-5 w-5" />
                      <span className="sr-only">Profile & Settings</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Profile & Settings</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setIsHelpModalOpen(true)} aria-label="Help & Shortcuts">
                      <BookOpen className="h-5 w-5" />
                      <span className="sr-only">Help & Shortcuts</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Help & Shortcuts (Ctrl+H)</TooltipContent>
                </Tooltip>

             <Button onClick={handleSignOut} variant="outline" size="sm">
               <LogOut className="mr-1 h-4 w-4" /> Sign Out
             </Button>
           </div>
         </header>

         {/* Alerts Container */}
          <div className="space-y-4 mb-6 md:mb-8">
              {/* General Error Display */}
             {errorMessage && !dbSetupError && (
               <Alert variant="destructive">
                 <AlertCircle className="h-4 w-4" />
                 <AlertTitle>Error</AlertTitle>
                 <AlertDescription>
                   <div className="flex justify-between items-start">
                     <span style={{ whiteSpace: 'pre-wrap' }}>{errorMessage}</span>
                     <Button variant="ghost" size="icon" onClick={() => setErrorMessage(null)} className="h-6 w-6 ml-2 flex-shrink-0">
                       <X className="h-4 w-4" />
                     </Button>
                   </div>
                   {errorMessage.includes("Quota exceeded") && (
                     <Button size="sm" className="mt-2" onClick={() => setIsProfileDialogOpen(true)}>Upgrade Plan</Button>
                   )}
                 </AlertDescription>
               </Alert>
             )}
             {/* Rate Limit Alerts */}
             {Object.entries(rateLimitState).map(([key, state]) => {
               const operationKey = key as RateLimitOperation;
               const remainingTime = getRateLimitRemainingTime(operationKey);
               return state?.active && remainingTime > 0 && (
                 <Alert variant="default" className="bg-yellow-900/20 border-yellow-700/50" key={key}>
                   <Info className="h-4 w-4 text-yellow-500" />
                   <AlertTitle className="text-yellow-300">Rate Limit Active for {key}</AlertTitle>
                   <AlertDescription className="text-yellow-400">
                     Please wait {remainingTime} seconds to perform this action again.
                   </AlertDescription>
                 </Alert>
               );
             })}
         </div>


        {/* Main content grid */}
         <main className={cn(
            "flex-grow grid grid-cols-1 gap-6 md:gap-8",
            // Dynamically adjust columns based on side panels
            (isAiAdvisorOpen || isBoostPanelOpen) ? "lg:grid-cols-[1fr_auto]" : "lg:grid-cols-1"
        )}>
            {/* Left Column (Input & Output) */}
            <div className="flex flex-col gap-6 md:gap-8">
                <Card id="content-input-section" className="shadow-md border-border/30">
                    <CardHeader>
                        <CardTitle>1. Input Your Content</CardTitle>
                        <CardDescription>Paste your text, article URL, or video link below.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea
                            placeholder="Paste your content or URL here..."
                            value={content}
                            onChange={handleContentChange}
                            rows={6}
                            className="text-base md:text-sm"
                            disabled={loadingState.summarizing || !!loadingState.generating}
                            aria-label="Content Input"
                            spellCheck={false}
                        />
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div id="persona-selector" className="w-full sm:w-auto flex-grow sm:flex-grow-0">
                                <Label htmlFor="persona" className="text-xs font-medium text-muted-foreground mb-1 block">AI Persona</Label>
                                <Select
                                    value={selectedPersona}
                                    onValueChange={setSelectedPersona}
                                    disabled={loadingState.summarizing || !!loadingState.generating}
                                >
                                    <SelectTrigger className="w-full sm:w-[200px] h-9 text-xs" id="persona" aria-label="Select AI Persona">
                                        <SelectValue placeholder="Select Persona" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PERSONAS.map(persona => (
                                            <SelectItem key={persona.value} value={persona.value} textValue={persona.label}>
                                                {persona.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="w-full sm:w-auto">
                                        <Button
                                            id="generate-posts-button"
                                            onClick={handleGeneratePosts}
                                            disabled={!content.trim() || loadingState.summarizing || !!loadingState.generating || isApiKeyMissing || isQuotaExceeded || !!rateLimitState.summarize?.active || !!rateLimitState.generate?.active}
                                            loading={loadingState.summarizing || !!loadingState.generating}
                                            className="w-full sm:w-auto"
                                        >
                                            <Sparkles className="mr-2 h-4 w-4" />
                                            {loadingState.summarizing ? 'Summarizing...' : (loadingState.generating ? `Generating ${loadingState.generating}...` : 'Generate Posts')}
                                        </Button>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {getRateLimitTooltip('summarize') ?? getRateLimitTooltip('generate') ?? (isApiKeyMissing ? 'Please add your Gemini API Key in Profile Settings.' : (isQuotaExceeded ? 'Quota exceeded for this month.' : (!content.trim() ? 'Enter content or URL to generate posts.' : undefined)))}
                                </TooltipContent>
                            </Tooltip>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-md border-border/30 flex-grow flex flex-col">
                    <CardHeader>
                        <CardTitle>2. Generated Drafts</CardTitle>
                        <CardDescription>Review, tune, and copy the AI-generated posts for each platform.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow flex flex-col">
                        {summary || Object.values(generatedPosts).some(p => p) ? (
                            <Tabs defaultValue="linkedin" className="flex-grow flex flex-col" onValueChange={(value) => setActiveOutputTab(value as SocialPlatform)} id="output-tabs">
                                <div className="flex justify-between items-center mb-4">
                                    <TabsList className="grid w-full grid-cols-3 sm:w-auto">
                                        {PLATFORMS.map(platform => (
                                            <TabsTrigger key={platform} value={platform} className="capitalize text-xs sm:text-sm tabs-trigger-underline">
                                                {platform}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={handleToggleBoostPanel} className={cn("transition-colors", isBoostPanelOpen && "bg-accent")}>
                                                <Settings2 className="h-5 w-5" />
                                                <span className="sr-only">Toggle Boost Panel</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Hashtags & Emojis</TooltipContent>
                                    </Tooltip>
                                </div>
                                {PLATFORMS.map(platform => (
                                    <TabsContent key={platform} value={platform} className="flex-grow mt-0">
                                        <div className="flex flex-col h-full gap-4">
                                            <div className="relative flex-grow">
                                                <Textarea
                                                    ref={outputTextareaRefs[platform]}
                                                    value={generatedPosts[platform]}
                                                    onChange={(e) => handleOutputChange(platform, e.target.value)}
                                                    rows={8}
                                                    className="text-base md:text-sm h-full resize-none pr-12"
                                                    disabled={!!loadingState.tuning[platform]}
                                                    placeholder={`Generated ${platform} post will appear here...`}
                                                    aria-label={`${platform} Post Output`}
                                                />
                                                <div className="absolute top-2 right-2 flex flex-col gap-1.5">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button
                                                                id={`ai-advisor-button-${platform}`}
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7"
                                                                onClick={() => handleAnalyzePost(platform)}
                                                                disabled={loadingState.analyzing === platform || !generatedPosts[platform] || generatedPosts[platform].startsWith("Error:") || !!rateLimitState.analyze?.active}
                                                                aria-label="Analyze post with AI Advisor"
                                                            >
                                                                {loadingState.analyzing === platform ? <Loader2 className="animate-spin h-4 w-4" /> : <Sparkles className="h-4 w-4 text-purple-400" />}
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>{getRateLimitTooltip('analyze') ?? "AI Advisor"}</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openToneTuner(platform)} disabled={!generatedPosts[platform] || generatedPosts[platform].startsWith("Error:") || !!loadingState.tuning[platform]}>
                                                                <Palette className="h-4 w-4 text-cyan-400" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Tune Tone & Style</TooltipContent>
                                                    </Tooltip>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyToClipboard(platform)} disabled={!generatedPosts[platform] || generatedPosts[platform].startsWith("Error:")}>
                                                                <Copy className="h-4 w-4" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Copy to Clipboard</TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            </div>
                                            <div id={`tune-buttons-${platform}`} className="flex flex-wrap gap-2">
                                                {['Make Wittier', 'More Concise', 'Add Emojis', 'More Formal', 'Add Hashtags'].map(instr => (
                                                    <Tooltip key={instr}>
                                                        <TooltipTrigger asChild>
                                                            <div className="inline-block">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleTunePost(platform, instr)}
                                                                    disabled={!!loadingState.tuning[platform] || !generatedPosts[platform] || generatedPosts[platform].startsWith("Error:") || !!rateLimitState.tune?.active}
                                                                    loading={loadingState.tuning[platform] === instr}
                                                                    className="text-xs"
                                                                >
                                                                    {instr}
                                                                </Button>
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>{getRateLimitTooltip('tune')}</TooltipContent>
                                                    </Tooltip>
                                                ))}
                                            </div>
                                            <PreviewMockup platform={platform} content={generatedPosts[platform]} />
                                        </div>
                                    </TabsContent>
                                ))}
                            </Tabs>
                        ) : (
                            <div className="text-center text-muted-foreground py-10">
                                {loadingState.summarizing || loadingState.generating ? (
                                    <div className="flex items-center justify-center">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        <span>{loadingState.summarizing ? 'Summarizing...' : `Generating ${loadingState.generating}...`}</span>
                                    </div>
                                ) : (
                                    'Enter content above and click "Generate Posts" to see your drafts.'
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

             {/* Right Column (Side Panels) - Conditionally rendered */}
            {(isAiAdvisorOpen || isBoostPanelOpen) && (
                <div className="relative flex flex-col gap-6 md:gap-8 h-full"> {/* Container for side panels */}
                     {/* AI Advisor Panel */}
                    {isAiAdvisorOpen && (
                        <div className="relative z-10"> {/* Added relative and z-index */}
                            <AiAdvisorPanel
                                isOpen={isAiAdvisorOpen}
                                isLoading={!!loadingState.analyzing}
                                analysis={advisorAnalysis}
                                onApplySuggestion={handleApplySuggestion}
                                onClose={() => setIsAiAdvisorOpen(false)}
                            />
                        </div>
                    )}

                    {/* Boost Panel */}
                    {isBoostPanelOpen && (
                         <div className="relative z-20"> {/* Added relative and higher z-index */}
                            <BoostPanel
                                isOpen={isBoostPanelOpen}
                                onToggle={handleToggleBoostPanel}
                                onInsertText={handleInsertText}
                            />
                        </div>
                    )}
                </div>
            )}

         </main>

         <footer className="text-center mt-8 text-xs text-muted-foreground">
           Built with Next.js, Supabase, Genkit & ShadCN UI for the Gemini Hackathon.
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
         <ToneTunerSheet
           isOpen={isToneTunerOpen}
           onOpenChange={setIsToneTunerOpen}
           currentTone={selectedPersona}
           onApplyTone={handleApplyTone}
         />
         <HelpModal isOpen={isHelpModalOpen} onOpenChange={setIsHelpModalOpen} />
       </div>
    </TooltipProvider>
  );
}
