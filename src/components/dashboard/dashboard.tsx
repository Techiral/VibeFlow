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
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import {
    Zap, User as UserIcon, LogOut, Copy, Bot, Palette, Lightbulb, AlertCircle, X, Loader2,
    Check, Sparkles, Settings2, BookOpen, Info, Hash, Smile, BrainCircuit, Trophy, Star, ChevronRight
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ProfileDialog } from './profile-dialog'; // Import the profile dialog
import { Progress } from "@/components/ui/progress"; // Import Progress component
import AiAdvisorPanel from './ai-advisor-panel'; // Import AI Advisor Panel
import { toast as sonnerToast } from 'sonner'; // Import sonner toast for confetti effect
import Confetti from 'react-confetti';
// import Joyride, { Step, CallBackProps } from 'react-joyride'; // Remove react-joyride import
import ToneTunerSheet from './tone-tuner-sheet'; // Import ToneTunerSheet
import BoostPanel from './boost-panel'; // Import BoostPanel
import PreviewMockup from './preview-mockup'; // Import PreviewMockup
import HelpModal from './help-modal'; // Import HelpModal
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';


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
  // { xp: 0, name: 'onboarded', description: 'Completed the onboarding tour!', hidden: true }, // Remove onboarding badge
];

// Remove Onboarding steps definition
// const ONBOARDING_STEPS: Step[] = [
//   // ... removed steps
// ];


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
  const [badges, setBadges] = useState<string[]>(initialBadges ?? []); // Initialize properly
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

  // const [runTour, setRunTour] = useState(false); // Remove Joyride state
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
    // if (!badge.hidden && currentXp >= badge.xp && !achievedBadges.includes(badge.name)) { // Remove hidden check
    if (currentXp >= badge.xp && !achievedBadges.includes(badge.name)) {
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

      setBadges(updatedBadges); // Update local state immediately

      newlyAwardedBadges.forEach((badge, index) => {
        setTimeout(() => {
          setShowConfetti(true);
          setConfettiPieces(200 + index * 50);
          sonnerToast.success(`🏆 Badge Unlocked: ${badge.name}`, {
            description: badge.description,
            duration: 5000,
          });
          setTimeout(() => setShowConfetti(false), 4000);
        }, index * 500); // Stagger confetti and toasts
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
}, [supabase, user.id, toast]); // Added setBadges to dependencies


  // --- Joyride & Client-Side Check ---
  useEffect(() => {
    setIsClient(true);
    // Remove Joyride tour logic
    // if (profile && !badges.includes('onboarded') && !dbSetupError && !errorMessage) {
    //   const timer = setTimeout(() => setRunTour(true), 500);
    //   return () => clearTimeout(timer);
    // }
  }, []); // Removed dependencies related to Joyride

  // Remove handleJoyrideCallback
  // const handleJoyrideCallback = useCallback(async (data: CallBackProps) => {
  //   // ... removed Joyride logic
  // }, [supabase, user.id, profile, badges]);


  // --- Rate Limit Countdown Effect ---
  useEffect(() => {
    const activeTimers: NodeJS.Timeout[] = [];

    Object.keys(rateLimitState).forEach(key => {
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
            // Force re-render to update countdown display if needed
            setRateLimitState(prev => ({ ...prev }));
            const timerId = setTimeout(updateTimer, 1000);
            activeTimers.push(timerId); // Keep track of active timers
          }
        };
        // Initial call to start the timer loop
        const timerId = setTimeout(updateTimer, 1000);
        activeTimers.push(timerId);
      }
    });

    // Cleanup function to clear all active timers when component unmounts or rateLimitState changes
    return () => {
      activeTimers.forEach(clearTimeout);
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

      // 1. Fetch/Create Profile
      if (!currentProfile) {
        console.log("Profile missing, attempting to fetch/create...");
        try {
          const { data: profileDataArray, error: profileError } = await supabase
            .rpc('get_user_profile', { p_user_id: user.id });

          if (profileError) throw profileError;

          if (!profileDataArray || profileDataArray.length === 0) {
             // This case indicates get_user_profile didn't create the profile as expected
             console.error("CRITICAL: Profile function failed to return or create a profile for user:", user.id);
             throw new Error("Profile function failed to return or create a profile.");
          }

          currentProfile = profileDataArray[0];
          setProfile(currentProfile); // Update local state
          currentBadges = currentProfile?.badges ?? [];
          setBadges(currentBadges); // Update local state
          setXp(currentProfile?.xp ?? 0); // Update local state
          console.log("Profile fetched/created successfully:", currentProfile?.username);

          // Check for missing key after fetching/creating
          if (!currentProfile?.gemini_api_key) {
            setErrorMessage(prev => prev ? `${prev}\nGemini API Key is missing. Add it in Profile Settings.` : `Gemini API Key is missing. Add it in Profile Settings.`);
            setIsProfileDialogOpen(true);
          }

        } catch (error: any) {
          console.error("Error fetching/creating profile on client:", error.message);
          // Handle specific DB setup errors vs. other errors
           if (error.message.includes("relation \"public.profiles\" does not exist") || error.code === '42P01' || error.message.includes("function public.get_user_profile does not exist")) {
               setErrorMessage("Database setup incomplete. Please run the SQL script (README Step 3).");
               // Don't mark as dbSetupError here, let the server-side prop handle the full page block
           } else {
               setErrorMessage(prev => prev ? `${prev}\nProfile Error: ${error.message}` : `Profile Error: ${error.message}`);
           }
          profileErrorOccurred = true;
        }
      } else {
          // Ensure local state matches initial props if profile already exists
          if (!initialBadges || badges !== initialBadges) setBadges(initialBadges ?? []);
          if (xp !== initialXp) setXp(initialXp ?? 0);
          // Check for missing key if profile exists but key is null/empty
          if (!currentProfile.gemini_api_key) {
               setErrorMessage(prev => prev ? `${prev}\nGemini API Key is missing. Add it in Profile Settings.` : `Gemini API Key is missing. Add it in Profile Settings.`);
               setIsProfileDialogOpen(true);
           }
      }

      // 2. Fetch/Create Quota (only if profile fetch didn't fail critically)
      if (!currentQuota && !profileErrorOccurred) {
        console.log("Quota missing, attempting to fetch/create...");
        try {
           // Use get_remaining_quota which handles upsert logic internally now
           const { data: remainingQuota, error: quotaRpcError } = await supabase
              .rpc('get_remaining_quota', { p_user_id: user.id });

           if (quotaRpcError) {
              console.error("Error calling get_remaining_quota RPC:", quotaRpcError);
              // If RPC fails, try a direct select as a fallback (might indicate RLS issue on function)
               const { data: quotaData, error: quotaSelectError } = await supabase
                    .from('quotas')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle(); // Use maybeSingle to handle 0 or 1 row

                if (quotaSelectError) {
                    // If direct select also fails, re-throw the select error
                    throw quotaSelectError;
                }
                 currentQuota = quotaData; // Might be null if no row exists and insert failed

           } else {
               // If RPC succeeds, fetch the full quota object to get all details
               const { data: fullQuotaData, error: quotaFetchError } = await supabase
                   .from('quotas')
                   .select('*')
                   .eq('user_id', user.id)
                   .single(); // Should exist now due to upsert in RPC

               if (quotaFetchError) {
                   console.error("Error fetching full quota object after RPC:", quotaFetchError.message);
                   // Construct a temporary quota object based on RPC result if fetch fails
                   currentQuota = {
                       user_id: user.id,
                       request_count: 100 - (remainingQuota ?? 0), // Calculate count from remaining
                       quota_limit: 100, // Assume default limit
                       last_reset_at: new Date().toISOString(), // Use current time as placeholder
                       created_at: new Date().toISOString(), // Use current time as placeholder
                       ip_address: null
                   };
               } else {
                   currentQuota = fullQuotaData;
               }
           }

          // Final check if quota is still null after attempts
           if (!currentQuota) {
               console.error("CRITICAL: Failed to fetch or create quota record for user:", user.id);
               throw new Error("Failed to fetch or create quota record.");
           }

          setQuota(currentQuota); // Update local state
          console.log("Quota fetched/created successfully:", currentQuota.request_count, "/", currentQuota.quota_limit);

        } catch (error: any) {
          console.error("Error fetching/creating quota on client:", error.message);
           // Handle specific DB setup errors vs. other errors
           if (error.message.includes("relation \"public.quotas\" does not exist") || error.code === '42P01') {
               setErrorMessage("Database setup incomplete (quotas table missing). Please run the SQL script (README Step 3).");
               // Don't mark as dbSetupError here
           } else if (error.message.includes("function public.get_remaining_quota does not exist")) {
                setErrorMessage("Database setup incomplete (get_remaining_quota function missing). Please run the SQL script (README Step 3).");
           } else if (error.message.includes("violates row-level security policy")) {
               setErrorMessage(prev => prev ? `${prev}\nQuota Error: Database permissions error (RLS). Check policies.` : `Quota Error: Database permissions error (RLS). Check policies.`);
           } else {
               setErrorMessage(prev => prev ? `${prev}\nQuota Error: ${error.message}` : `Quota Error: ${error.message}`);
           }
          quotaErrorOccurred = true;
        }
      } else if (currentQuota && !quotaErrorOccurred) {
           // Periodically refresh quota state using get_remaining_quota if it already exists
           try {
               const { data: refreshedRemaining, error: refreshError } = await supabase.rpc('get_remaining_quota', { p_user_id: user.id });
               if (refreshError) {
                  console.warn("Could not refresh quota via RPC:", refreshError.message);
               } else if (refreshedRemaining !== null) {
                    const newCount = currentQuota.quota_limit - refreshedRemaining;
                    if (newCount !== currentQuota.request_count) {
                       console.log("Quota count refreshed via RPC.");
                       setQuota(prev => prev ? { ...prev, request_count: newCount } : null);
                    }
               }
           } catch (rpcError: any) {
               console.warn("Exception during quota refresh RPC:", rpcError.message);
           }
      }

      // 3. Check Badges (only if profile exists)
      if (currentProfile && !profileErrorOccurred) {
        checkAndAwardBadges(currentProfile.xp ?? 0, currentBadges);
      }

    };

    // Run ensureData only if dbSetupError from server is false
    if (!dbSetupError) {
      ensureData();
    } else {
      // If there's a DB setup error from the server, ensure local state is nullified
      setProfile(null);
      setQuota(null);
      setXp(0);
      setBadges([]);
    }

    // Dependencies for the effect
  }, [user.id, supabase, dbSetupError, checkAndAwardBadges, initialBadges, initialXp, initialProfile, initialQuota]); // Removed profile, quota, badges, xp from deps


  // --- Profile Update Handling ---
  const handleProfileUpdate = (updatedProfile: UserProfileFunctionReturn) => {
    setProfile(updatedProfile); // Update local state
    setXp(updatedProfile.xp ?? 0); // Update local XP state
    setBadges(updatedProfile.badges ?? []); // Update local badges state
    // Clear API key missing error if the key is now present
    if (updatedProfile.gemini_api_key && errorMessage?.includes('Gemini API Key is missing')) {
      setErrorMessage(null);
    }
    checkAndAwardBadges(updatedProfile.xp ?? 0, updatedProfile.badges ?? []); // Check for new badges
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
    let shouldRefund = false; // Track if quota increment succeeded
    let isRateLimitError = false; // Specific flag for rate limit / unavailable errors
    let apiRetryAfter = 0; // Timestamp when API might be available again

    while (currentAttempt < MAX_AI_RETRIES) {
      const currentLimitState = rateLimitState[operationKey];
      // Check local rate limit state first
      if (currentLimitState?.active && Date.now() < currentLimitState.retryAfter) {
        const remainingSeconds = Math.ceil((currentLimitState.retryAfter - Date.now()) / 1000);
        console.warn(`Operation ${operationKey} rate-limited locally. Try again in ${remainingSeconds}s.`);
        // Update error message to show countdown
        setErrorMessage(`Rate limit active for ${operationKey}. Please wait ${remainingSeconds} seconds.`);
        return { data: null, error: new Error("Rate limit active"), rateLimited: true, retryAfter: currentLimitState.retryAfter };
      }

      // Clear expired local rate limit state if necessary
      if (rateLimitState[operationKey]?.active && Date.now() >= rateLimitState[operationKey]!.retryAfter) {
        setRateLimitState(prev => {
          const newState = { ...prev };
          delete newState[operationKey];
          return newState;
        });
      }

      // Check Gemini API Key
      if (!profile?.gemini_api_key) {
        setErrorMessage("Google Gemini API Key is missing. Please add it in your profile settings.");
        setIsProfileDialogOpen(true);
        return { data: null, error: new Error("Missing Gemini API Key") };
      }

       // Check Quota *before* incrementing (more efficient)
       // Refetch quota state just before the check for accuracy
        let currentQuotaCount = 0;
        let currentQuotaLimit = 100;
        try {
             const { data: currentQuotaData, error: fetchQuotaError } = await supabase
                 .from('quotas')
                 .select('request_count, quota_limit')
                 .eq('user_id', user.id)
                 .single(); // Fetch current state
             if (fetchQuotaError) {
                 console.error("Failed to fetch current quota before check:", fetchQuotaError.message);
                 // Decide how to handle - maybe proceed cautiously or throw error?
                 // For now, let's use the potentially stale local state or defaults
                 currentQuotaCount = quota?.request_count ?? 0;
                 currentQuotaLimit = quota?.quota_limit ?? 100;
             } else {
                 currentQuotaCount = currentQuotaData.request_count;
                 currentQuotaLimit = currentQuotaData.quota_limit;
             }
         } catch (e) {
             console.error("Exception fetching quota before check:", e);
             currentQuotaCount = quota?.request_count ?? 0;
             currentQuotaLimit = quota?.quota_limit ?? 100;
         }


        if (currentQuotaCount + cost > currentQuotaLimit) {
            console.warn("Quota exceeded (local check before increment). Required:", cost, "Used:", currentQuotaCount, "Limit:", currentQuotaLimit);
            setErrorMessage("Quota exceeded. Upgrade your plan or wait for reset.");
            // Optionally update local state to reflect limit being hit
            setQuota(prev => prev ? { ...prev, request_count: currentQuotaLimit } : null);
            return { data: null, error: new Error("Quota exceeded.") };
        }


      // ----- Attempt Quota Increment and AI Call -----
      let result: T | null = null;
      let error: Error | null = null;
      shouldRefund = false; // Reset refund flag for this attempt
      isRateLimitError = false; // Reset rate limit flag
      apiRetryAfter = 0; // Reset retry timestamp


      try {
        // 1. Increment Quota via RPC
        if (cost > 0) { // Only increment if there's a cost
             console.log(`Attempting to increment quota by ${cost} for user ${user.id}`);
             const { data: remainingQuotaAfterIncrement, error: incrementError } = await supabase.rpc('increment_quota', {
               p_user_id: user.id,
               p_increment_amount: cost,
             });

             if (incrementError) {
               if (incrementError.message.includes('quota_exceeded')) {
                 console.warn("Quota exceeded (checked during increment RPC).");
                 setErrorMessage("Quota exceeded. Upgrade your plan or wait for reset.");
                 setQuota(prev => prev ? { ...prev, request_count: prev.quota_limit } : null); // Update local state
                 return { data: null, error: new Error("Quota exceeded.") };
               } else {
                 console.error("Error incrementing quota via RPC:", incrementError);
                 // Don't immediately fail, maybe log and try AI call anyway? Or throw?
                 // For now, throw to indicate a DB interaction issue.
                 throw new Error(`Failed to update quota: ${incrementError.message}`);
               }
             }
             console.log("Quota increment RPC successful, refetching data...");
             shouldRefund = true; // Mark that increment succeeded, refund may be needed if AI call fails

             // ---- Refetch Profile and Quota AFTER successful increment ----
             // This ensures XP and badge awarding happens correctly
             try {
                 const { data: postIncrementQuota, error: qError } = await supabase
                   .from('quotas')
                   .select('*')
                   .eq('user_id', user.id)
                   .single();

                 if (qError) throw qError;
                 setQuota(postIncrementQuota); // Update local state
                 console.log("Refetched quota data:", postIncrementQuota);

                 const { data: postIncrementProfileData, error: pError } = await supabase
                   .rpc('get_user_profile', { p_user_id: user.id });

                 if (pError) throw pError;
                 if (!postIncrementProfileData || postIncrementProfileData.length === 0) {
                   throw new Error("Profile function failed to return data after increment.");
                 }
                 const postIncrementProfile = postIncrementProfileData[0];
                 handleProfileUpdate(postIncrementProfile); // Use handler to update profile, xp, badges & check awards
                 console.log("Refetched profile data:", postIncrementProfile);

             } catch (refetchError: any) {
                 console.error("Error refetching profile/quota post-increment:", refetchError.message);
                 toast({
                     title: "Data Sync Issue",
                     description: "Could not refresh profile/quota after usage update.",
                     variant: "destructive"
                 });
                 // Don't necessarily stop the AI call, but log the sync issue
             }
             // ---- End Refetch ----
        } else {
             console.log(`Operation ${operationKey} has zero cost, skipping quota increment.`);
             shouldRefund = false; // No increment, so no refund needed
        }


        // 2. Execute AI Function
        console.log(`Calling AI function for ${operationKey} (Attempt ${currentAttempt + 1})`);
        result = await aiFunction();
        console.log(`AI function for ${operationKey} successful.`);

        // SUCCESS - Exit the loop and return data
        return { data: result, error: null };

      } catch (err: any) {
        error = err instanceof Error ? err : new Error(String(err));
        console.error(`Error during AI operation (${operationKey}) attempt ${currentAttempt + 1}/${MAX_AI_RETRIES}:`, error.message);

        const messageLower = error.message?.toLowerCase() || '';
        const status = (err instanceof Error && 'status' in err) ? (err as any).status : null; // GenkitError status or similar

        // --- Error Handling Logic ---

        // A. Check for RETRIABLE Errors (Rate limit, temporary unavailability)
        if (status === 'UNAVAILABLE' || status === 'RESOURCE_EXHAUSTED' || messageLower.includes('503') || messageLower.includes('unavailable') || messageLower.includes('overloaded') || messageLower.includes('rate limit') || messageLower.includes('429')) {
          isRateLimitError = true; // Mark as a potentially temporary issue
          // Calculate when the next retry should happen based on backoff
          apiRetryAfter = Date.now() + backoff;

          // Update local rate limit state to prevent immediate client-side retries
          setRateLimitState(prev => ({
            ...prev,
            [operationKey]: { active: true, retryAfter: apiRetryAfter, retryCount: currentAttempt + 1 }
          }));

          // Check if retries are exhausted
          if (currentAttempt >= MAX_AI_RETRIES - 1) {
             // Retries exhausted for a retriable error
             let finalMessage = `AI service for ${operationKey} remained unavailable after ${MAX_AI_RETRIES} attempts. Please try again later.`;
              if (status === 'RESOURCE_EXHAUSTED' || messageLower.includes('rate limit')) {
                 finalMessage = `AI service rate limit hit for ${operationKey}. Please wait or check your API quota. Retried ${MAX_AI_RETRIES} times.`;
                 // Keep rate limit active for a longer period if needed, e.g., 60 seconds
                 apiRetryAfter = Date.now() + 60000;
                  setRateLimitState(prev => ({
                     ...prev,
                     [operationKey]: { active: true, retryAfter: apiRetryAfter, retryCount: MAX_AI_RETRIES }
                  }));
             }
             console.error(finalMessage);
             setErrorMessage(finalMessage);
             // Break the loop, error will be handled outside
             break;
          } else {
             // It's a retriable error, and we have retries left
             console.warn(`AI Service issue for ${operationKey}. Retrying in ${backoff}ms...`);
             setErrorMessage(`AI service for ${operationKey} temporarily unavailable. Retrying...`); // Inform user

             // Wait for backoff period before next attempt
             await new Promise(resolve => setTimeout(resolve, backoff));
             currentAttempt++;
             backoff *= 2; // Exponential backoff
             continue; // Continue to the next iteration of the while loop
          }
        }

        // B. Check for NON-RETRIABLE Errors (Invalid API Key, Bad Input, etc.)
        // These errors should break the loop immediately.
        if (status === 'UNAUTHENTICATED' || messageLower.includes('api key not valid')) {
          console.error(`Authentication error for ${operationKey}: Invalid API Key.`);
          setErrorMessage("Invalid Gemini API Key. Please check your profile settings.");
          setIsProfileDialogOpen(true);
        } else if (status === 'INVALID_ARGUMENT') {
          console.error(`Invalid argument for ${operationKey}:`, error.message);
          setErrorMessage(`Error: Invalid input or configuration for ${operationKey}. ${error.message}`);
        } else {
          // Handle other unexpected internal errors
          console.error(`Internal error during ${operationKey}:`, error.message);
          setErrorMessage(`An internal error occurred during ${operationKey}: ${error.message}`);
        }

        // Break the loop for non-retriable errors or after exhausting retries for retriable ones
        break;

      } finally {
        // --- Quota Refund Logic ---
        // Refund ONLY IF:
        // 1. Quota increment succeeded in this attempt (shouldRefund is true)
        // 2. An error occurred (error is not null)
        // 3. The error was NOT a rate limit/temporary issue OR retries are exhausted for a rate limit issue
        // 4. The operation had a cost > 0
        const shouldIssueRefund = shouldRefund && error && (!isRateLimitError || currentAttempt >= MAX_AI_RETRIES -1) && cost > 0;

        if (shouldIssueRefund) {
          console.log(`Refunding ${cost} quota point(s) for ${operationKey} due to error: ${error.message}`);
          try {
            // Use negative increment to refund
            const { error: decrementError } = await supabase.rpc('increment_quota', {
              p_user_id: user.id,
              p_increment_amount: -cost,
            });
            if (decrementError) {
              console.error("CRITICAL: Error refunding quota via RPC:", decrementError);
              toast({ title: "Quota Refund Failed", description: "Could not automatically refund quota. Please contact support if issue persists.", variant: "destructive" });
            } else {
              console.log("Quota refunded successfully via RPC.");
              // Refetch quota state after refund to update UI
              const { data: refundedQuotaData, error: fetchError } = await supabase
                .from('quotas')
                .select('*')
                .eq('user_id', user.id)
                .single();
              if (!fetchError && refundedQuotaData) {
                setQuota(refundedQuotaData); // Update local state
                console.log("Quota state updated after refund:", refundedQuotaData);
              } else {
                console.warn("Failed to refetch quota state after refund.");
              }
            }
          } catch (refundError: any) {
            console.error("CRITICAL: Exception during quota refund RPC call:", refundError.message);
            toast({ title: "Quota Refund Exception", description: "An unexpected error occurred during quota refund.", variant: "destructive" });
          }
        }
      } // End finally block
    } // End while loop

    // --- After the Loop ---
    // If the loop finished because max retries were reached for a *retriable* error:
    if (currentAttempt >= MAX_AI_RETRIES && isRateLimitError) {
       // The error message and rate limit state were already set inside the loop
       return { data: null, error: error ?? new Error(`Max retries reached for ${operationKey}`), rateLimited: true, retryAfter: apiRetryAfter };
    }

    // If the loop finished due to a *non-retriable* error (error is not null):
    if (error) {
       // Error message was already set inside the loop
       return { data: null, error: error, rateLimited: isRateLimitError, retryAfter: isRateLimitError ? apiRetryAfter : undefined };
    }

     // Should theoretically not be reached if loop logic is correct, but as a fallback:
     console.error(`callAiWithRetry loop for ${operationKey} finished unexpectedly without success or error.`);
     return { data: null, error: new Error(`Operation ${operationKey} failed unexpectedly after retries.`) };
  };


  // --- Summarization and Generation ---
  const handleGeneratePosts = async () => {
    if (!content.trim() || loadingState.summarizing || loadingState.generating) return;

    setLoadingState(prev => ({ ...prev, summarizing: true, generating: 'linkedin' }));
    setSummary('');
    setGeneratedPosts({ linkedin: '', twitter: '', youtube: '' });
    setErrorMessage(null); // Clear previous errors
    setAdvisorAnalysis(null);

    const summaryCost = 1; // Cost for summarization
    const generationCostPerPlatform = 1; // Cost per platform generation
    const totalInitialCost = summaryCost + (PLATFORMS.length * generationCostPerPlatform); // Total cost upfront

    const summaryResult = await callAiWithRetry(
      async () => {
        if (!profile?.gemini_api_key) throw new Error("Missing Gemini API Key");
        return await summarizeContent({ content }, { apiKey: profile.gemini_api_key });
      },
      totalInitialCost, // Charge total cost upfront for summary + all generations
      'summarize' // Operation key for rate limiting/error handling
    );

    if (summaryResult.error || !summaryResult.data) {
      setLoadingState(prev => ({ ...prev, summarizing: false, generating: null }));
      // Error message/toast is handled within callAiWithRetry
      return; // Stop execution if summarization fails
    }

    const currentSummary = summaryResult.data.summary;
    setSummary(currentSummary);
    setLoadingState(prev => ({ ...prev, summarizing: false })); // Summary done
    console.log("Summarization successful:", summaryResult.data);
    toast({ title: "Summarization Complete", description: "Now generating posts..." });

    let generationErrorOccurred = false;
    let anyRateLimited = false;

    // Generate posts for each platform sequentially or in parallel
    // For simplicity and potentially clearer rate limiting, let's do sequentially
    for (const platform of PLATFORMS) {
      setLoadingState(prev => ({ ...prev, generating: platform }));
      const personaPrompt = PERSONAS.find(p => p.value === selectedPersona)?.prompt || '';

      // Call AI for generation - cost is 0 here as it was charged upfront
      const result = await callAiWithRetry(
        async () => {
          if (!profile?.gemini_api_key) throw new Error("Missing Gemini API Key");
          return await generateSocialPosts(
            { summary: currentSummary, platform, personaPrompt },
            { apiKey: profile.gemini_api_key }
          );
        },
        0, // Cost is 0 for generation step
        'generate' // Use 'generate' key for rate limiting this specific step
      );

      if (result.error || !result.data) {
        generationErrorOccurred = true;
        if (result.rateLimited) {
          anyRateLimited = true;
        }
        // Set specific error for this platform's post
        setGeneratedPosts(prev => ({ ...prev, [platform]: `Error generating post: ${result.error?.message || 'Unknown error'}` }));
        // Error message/toast handled by callAiWithRetry
      } else {
        console.log(`${platform} post generated:`, result.data.post);
        setGeneratedPosts(prev => ({ ...prev, [platform]: result.data.post }));
      }
      setLoadingState(prev => ({ ...prev, generating: null })); // Indicate generation finished for this platform
    }

    // Final feedback toast after all generations attempted
    if (generationErrorOccurred) {
      if (!anyRateLimited) {
        toast({
          title: "Post Generation Issues",
          description: "Some posts could not be generated. See individual posts for details.",
          variant: "destructive",
        });
      } else {
         toast({ title: "Rate Limit Active", description: "Some post generations were rate-limited. Please wait.", variant: "default" });
      }
    } else {
      toast({ title: "Posts Generated Successfully", description: "Review and tune your new drafts." });
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
    const tuningCost = 1; // Define cost for tuning

    const tuneResult = await callAiWithRetry(
      async () => {
        if (!profile?.gemini_api_key) throw new Error("Missing Gemini API Key");
        console.log(`Tuning ${platform} with persona: "${selectedPersona}" and instruction: "${instruction}"`);
        return await tuneSocialPosts(
          { postContent: currentPost, platform, instruction, personaPrompt },
          { apiKey: profile.gemini_api_key }
        );
      },
      tuningCost,
      'tune' // Operation key for rate limiting/error handling
    );

    setLoadingState(prev => ({ ...prev, tuning: { ...prev.tuning, [platform]: null } }));

    if (tuneResult.error || !tuneResult.data) {
       console.error(`Tuning ${platform} post failed:`, tuneResult.error);
       if (!tuneResult.rateLimited) {
           toast({ title: `Tuning Failed (${platform})`, description: tuneResult.error?.message || 'Unknown tuning error.', variant: "destructive" });
       }
       // Optionally refund quota if needed (handled in callAiWithRetry)
       console.log(`Refunding 1 quota point for failed tuning.`);
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

    const analysisCost = 1; // Define cost for analysis

    const analysisResult = await callAiWithRetry(
      async () => {
        if (!profile?.gemini_api_key) throw new Error("Missing Gemini API Key");
        return await analyzePost({ postContent, platform }, { apiKey: profile.gemini_api_key });
      },
      analysisCost,
      'analyze' // Operation key for rate limiting/error handling
    );

    setLoadingState(prev => ({ ...prev, analyzing: null }));

    if (analysisResult.error || !analysisResult.data) {
       // Error message/toast handled by callAiWithRetry
       // Set advisor panel to show error state
       setAdvisorAnalysis({ analysis: `Error during analysis: ${analysisResult.error?.message || 'Unknown error'}`, flags: [] });
       if (!analysisResult.rateLimited) {
           toast({ title: `Analysis Failed (${platform})`, description: analysisResult.error?.message || 'Unknown analysis error.', variant: "destructive" });
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
    if (currentContent.startsWith("Error:")) return; // Don't apply to error messages

    const newContent = currentContent.substring(0, start) + suggestion + currentContent.substring(end);
    setGeneratedPosts(prev => ({ ...prev, [analyzingPlatform!]: newContent }));
    toast({ title: "Suggestion Applied", description: "Post updated with AI suggestion." });
    // Remove the applied flag from the analysis display
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

    // Construct a descriptive instruction for the tuning AI
    const instruction = `Rewrite this post in the style of: ${newPersona.label || 'Default'}. ${newPersona.prompt || ''}`;
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

    // Avoid inserting into error messages
    if (currentText.startsWith("Error:")) return;

    const newText = currentText.substring(0, start) + textToInsert + currentText.substring(end);

    setGeneratedPosts(prev => ({ ...prev, [activeOutputTab]: newText }));

    // Ensure focus and cursor position update after state change
    requestAnimationFrame(() => {
        if (outputTextareaRefs[activeOutputTab]?.current) {
            outputTextareaRefs[activeOutputTab].current!.focus();
            // Set cursor position after the inserted text
            const newCursorPos = start + textToInsert.length;
            outputTextareaRefs[activeOutputTab].current!.setSelectionRange(newCursorPos, newCursorPos);
        }
    });
  };


  // --- Copy to Clipboard ---
  const handleCopyToClipboard = async (platform: SocialPlatform) => {
    const postContent = generatedPosts[platform];
    if (!postContent || postContent.startsWith("Error:")) {
         toast({ title: "Cannot Copy", description: "No valid content to copy.", variant: "destructive" });
         return;
    }
    try {
      await navigator.clipboard.writeText(postContent);
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
    // Prevent editing if it's currently showing an error message
    if (generatedPosts[platform].startsWith("Error:")) {
        // Maybe clear the error and allow typing? Or keep disabled?
        // For now, let's allow clearing the error by typing
        if (value !== generatedPosts[platform]) {
             setGeneratedPosts(prev => ({ ...prev, [platform]: value }));
        } else {
             return; // Don't update if value hasn't changed from error message
        }
    } else {
        setGeneratedPosts(prev => ({ ...prev, [platform]: value }));
    }

    // Clear AI advisor analysis if the user manually edits the post
    if (platform === analyzingPlatform) {
      setAdvisorAnalysis(null);
    }
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Toggle Help Modal: Ctrl/Cmd + H
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        setIsHelpModalOpen(prev => !prev);
      }
      // Close any open modal/panel with Escape key
      if (event.key === 'Escape') {
        if (isProfileDialogOpen) setIsProfileDialogOpen(false);
        if (isAiAdvisorOpen) setIsAiAdvisorOpen(false);
        if (isToneTunerOpen) setIsToneTunerOpen(false);
        if (isBoostPanelOpen) setIsBoostPanelOpen(false);
        if (isHelpModalOpen) setIsHelpModalOpen(false);
        // Remove Joyride close logic
        // if (runTour) setRunTour(false);
      }
       // Optionally: Add shortcut for Generate Posts (e.g., Ctrl/Cmd + Enter in input)
        // Be careful not to conflict with default browser/textarea behavior
        // Example (needs refinement):
        // const target = event.target as HTMLElement;
        // if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && target.tagName === 'TEXTAREA' && target.id === 'content-input-textarea-id') { // Need to add an id to the input textarea
        //   event.preventDefault();
        //   handleGeneratePosts();
        // }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileDialogOpen, isAiAdvisorOpen, isToneTunerOpen, isBoostPanelOpen, isHelpModalOpen]); // Add any state dependencies that modals depend on


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
    let nextLevelXp = BADGES.find(b => !b.hidden)?.xp || 50; // Default to first badge XP
    let currentLevelXpThreshold = 0;
    const sortedVisibleBadges = BADGES.filter(b => !b.hidden).sort((a, b) => a.xp - b.xp);

    for (let i = 0; i < sortedVisibleBadges.length; i++) {
      if (currentXp >= sortedVisibleBadges[i].xp) {
        currentLevel = i + 1;
        currentLevelXpThreshold = sortedVisibleBadges[i].xp;
        // Determine XP for the *next* level
        if (i + 1 < sortedVisibleBadges.length) {
          nextLevelXp = sortedVisibleBadges[i + 1].xp;
        } else {
          // If it's the last defined badge, set a hypothetical next level threshold
          nextLevelXp = currentLevelXpThreshold * 2; // Example: double the last threshold
        }
      } else {
        // If current XP is less than the first badge threshold
        nextLevelXp = sortedVisibleBadges[i].xp; // XP needed is for the first badge
        break; // Stop searching
      }
    }

    const xpTowardsNext = Math.max(0, currentXp - currentLevelXpThreshold);
    const xpNeededForNext = Math.max(1, nextLevelXp - currentLevelXpThreshold); // Avoid division by zero
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

  // Helper function to get remaining rate limit time
  const getRateLimitRemainingTime = (operationKey: RateLimitOperation): number => {
    const state = rateLimitState[operationKey];
    if (state?.active && state.retryAfter > Date.now()) {
      return Math.ceil((state.retryAfter - Date.now()) / 1000);
    }
    return 0;
  };

  // Helper function to generate tooltip content for rate-limited buttons
  const getRateLimitTooltip = (operationKey: RateLimitOperation): React.ReactNode | undefined => {
    const remainingTime = getRateLimitRemainingTime(operationKey);
    if (remainingTime > 0) {
      return `Rate limit active. Wait ${remainingTime}s.`;
    }
    return undefined;
  };


  // --- Loading State for Initial Data ---
  // Display loading skeleton or message if profile/quota are not yet available (and no setup error)
  if (!dbSetupError && (profile === undefined || quota === undefined)) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading dashboard data...</span>
      </div>
    );
  }

  // --- DB Setup Error Display ---
  // If there's a DB setup error detected on the server, show a blocking error message
  if (dbSetupError) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-2xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Database Setup Required</AlertTitle>
          <AlertDescription>
            <p className="mb-4">{serverErrorMessage || "Database setup is incomplete. Please follow the README instructions."}</p>
            <p className="text-sm text-muted-foreground">
              Go to the Supabase SQL Editor in your project and run the entire script from <code>supabase/schema.sql</code>. See README Step 3.
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
    <TooltipProvider> {/* Wrap everything in TooltipProvider */}
      {/* Remove Joyride component */}
      {/* {isClient && (
        <Joyride
          steps={ONBOARDING_STEPS}
          run={runTour}
          continuous={true}
          showProgress={true}
          showSkipButton={true}
          callback={handleJoyrideCallback}
          styles={{
            options: {
              zIndex: 10000, // Ensure Joyride is above other elements
              primaryColor: '#6D28D9', // Match primary color
              arrowColor: '#1E1E24', // Match card background
              backgroundColor: '#1E1E24', // Match card background
              textColor: '#F1F5F9', // Match foreground color
            },
            tooltip: {
              borderRadius: '0.5rem',
              padding: '1rem',
            },
            buttonNext: {
              backgroundColor: '#6D28D9',
              borderRadius: '0.375rem',
              color: '#F1F5F9',
            },
            buttonBack: {
              color: '#A0AEC0', // Muted foreground
            },
            buttonSkip: {
              color: '#A0AEC0', // Muted foreground
            },
          }}
        />
      )} */}
       {isClient && showConfetti && (
        <Confetti
          width={typeof window !== 'undefined' ? window.innerWidth : 0}
          height={typeof window !== 'undefined' ? window.innerHeight : 0}
          numberOfPieces={confettiPieces}
          recycle={false}
          onConfettiComplete={() => setShowConfetti(false)}
          className="!fixed !top-0 !left-0 !w-full !h-full !z-[10001]" // Ensure confetti is above Joyride
        />
      )}
       <div className={cn(
         "flex flex-col min-h-screen bg-background text-foreground p-4 md:p-6 lg:p-8",
         // Remove joyride-active class logic
         // runTour && "joyride-active"
       )}>
         <header className="flex flex-wrap justify-between items-center mb-6 md:mb-8 gap-4">
           <Link href="/" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
             <Zap className="h-6 w-6 text-primary" />
             <h1 className="text-2xl font-bold text-gradient">VibeFlow</h1>
           </Link>
           <div className="flex items-center gap-3 md:gap-4">
             {/* Quota and XP Display */}
             <Tooltip>
               <TooltipTrigger asChild>
                  <div id="quota-display" className="flex flex-col items-end w-32 md:w-48">
                      {/* Usage */}
                      <div className="w-full flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-muted-foreground">Usage</span>
                        {quota ? (
                          <span className="text-xs font-semibold">{quota.request_count ?? 0}/{quota.quota_limit ?? 100}</span>
                        ) : (
                          <Skeleton className="h-4 w-12" />
                        )}
                      </div>
                      <Progress
                        value={quotaPercentage}
                        className="h-2 w-full mb-2"
                        aria-label="Monthly Usage Quota"
                        indicatorClassName={isQuotaExceeded ? "bg-destructive" : "bg-primary"}
                      />
                       {/* XP */}
                      <div className="w-full flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-muted-foreground">XP</span>
                        <span className="text-xs font-semibold">{xp}</span>
                      </div>
                      <Progress
                        value={xpInfo.percentage}
                        className="h-2 w-full"
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

             {/* Action Buttons */}
             <Tooltip>
               <TooltipTrigger asChild>
                 <Button variant="ghost" size="icon" onClick={() => setIsProfileDialogOpen(true)} id="profile-button" className="h-8 w-8 md:h-9 md:w-9">
                   <UserIcon className="h-4 w-4 md:h-5 md:w-5" />
                   <span className="sr-only">Profile & Settings</span>
                 </Button>
               </TooltipTrigger>
               <TooltipContent>Profile & Settings</TooltipContent>
             </Tooltip>

             <Tooltip>
               <TooltipTrigger asChild>
                 <Button variant="ghost" size="icon" onClick={() => setIsHelpModalOpen(true)} aria-label="Help & Shortcuts" className="h-8 w-8 md:h-9 md:w-9">
                   <BookOpen className="h-4 w-4 md:h-5 md:w-5" />
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
             {errorMessage && !dbSetupError && ( // Show general errors if not a DB setup error
               <Alert variant="destructive">
                 <AlertCircle className="h-4 w-4" />
                 <AlertTitle>Error</AlertTitle>
                 <AlertDescription>
                   <div className="flex justify-between items-start gap-2">
                     <span className="whitespace-pre-wrap">{errorMessage}</span>
                     <Button variant="ghost" size="icon" onClick={() => setErrorMessage(null)} className="-mt-1 -mr-1 h-6 w-6 flex-shrink-0">
                       <X className="h-4 w-4" />
                       <span className="sr-only">Dismiss error</span>
                     </Button>
                   </div>
                   {errorMessage.includes("Quota exceeded") && (
                     <Button size="sm" className="mt-2" onClick={() => setIsProfileDialogOpen(true)}>Upgrade Plan</Button>
                   )}
                   {errorMessage.includes("API Key is missing") && (
                      <Button size="sm" className="mt-2" onClick={() => setIsProfileDialogOpen(true)}>Add API Key</Button>
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
                   <AlertTitle className="text-yellow-300">Rate Limit Active: {key.charAt(0).toUpperCase() + key.slice(1)}</AlertTitle>
                   <AlertDescription className="text-yellow-400">
                     Please wait {remainingTime} seconds to perform this action again.
                   </AlertDescription>
                 </Alert>
               );
             })}
         </div>


        {/* Main content area with dynamic layout */}
        {/* Use grid for overall layout, ensure main area takes available space */}
        <main className="flex-grow grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 md:gap-8 overflow-hidden">

            {/* Left Column (Input & Output) - Ensure it grows */}
            <div className="flex flex-col gap-6 md:gap-8 lg:min-w-0"> {/* min-w-0 prevents overflow */}
                <Card id="content-input-section" className="shadow-md border-border/30">
                    <CardHeader>
                        <CardTitle className="text-lg md:text-xl">1. Input Content</CardTitle>
                        <CardDescription>Paste text, article URL, or video link.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea
                            placeholder="Paste your content or URL here..."
                            value={content}
                            onChange={handleContentChange}
                            rows={5} // Slightly reduced rows
                            className="text-sm"
                            disabled={loadingState.summarizing || !!loadingState.generating}
                            aria-label="Content Input"
                            spellCheck={false}
                        />
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4">
                           <div id="persona-selector" className="w-full sm:w-auto">
                              <Label htmlFor="persona" className="text-xs font-medium text-muted-foreground mb-1 block">AI Persona</Label>
                              <Select
                                  value={selectedPersona}
                                  onValueChange={setSelectedPersona}
                                  disabled={loadingState.summarizing || !!loadingState.generating}
                              >
                                   <Tooltip>
                                     <TooltipTrigger asChild>
                                        <SelectTrigger className="w-full sm:w-[180px] h-9 text-xs" id="persona" aria-label="Select AI Persona">
                                            <SelectValue placeholder="Select Persona" />
                                        </SelectTrigger>
                                     </TooltipTrigger>
                                     <TooltipContent>Select a writing style for the AI.</TooltipContent>
                                   </Tooltip>
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
                                {/* Wrap button in a div for tooltip positioning when disabled */}
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
                            <TooltipContent side="bottom">
                                {getRateLimitTooltip('summarize') ?? getRateLimitTooltip('generate') ?? (isApiKeyMissing ? 'Add Gemini API Key in Profile Settings.' : (isQuotaExceeded ? 'Quota exceeded.' : (!content.trim() ? 'Enter content or URL first.' : 'Summarize & Generate Posts')))}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                    </CardContent>
                </Card>

                {/* Output Section takes remaining vertical space */}
                <Card className="shadow-md border-border/30 flex-grow flex flex-col min-h-0"> {/* min-h-0 prevents Card from growing indefinitely */}
                    <CardHeader>
                        <CardTitle className="text-lg md:text-xl">2. Generated Drafts</CardTitle>
                        <CardDescription>Review, tune, and copy the generated posts.</CardDescription>
                    </CardHeader>
                    {/* Make CardContent scrollable and take remaining space */}
                    <CardContent className="flex-grow flex flex-col min-h-0 p-0 md:p-0"> {/* Remove padding here if Tabs handle it */}
                       {summary || Object.values(generatedPosts).some(p => p) ? (
                            <Tabs defaultValue="linkedin" className="flex-grow flex flex-col min-h-0" onValueChange={(value) => setActiveOutputTab(value as SocialPlatform)} id="output-tabs">
                                <div className="flex justify-between items-center px-4 md:px-6 pt-4 pb-2 md:pb-4 border-b">
                                    <TabsList className="grid w-full grid-cols-3 max-w-xs sm:max-w-sm">
                                        {PLATFORMS.map(platform => (
                                            <TabsTrigger key={platform} value={platform} className="capitalize text-xs sm:text-sm tabs-trigger-underline px-2 py-1 sm:px-3 sm:py-1.5">
                                                {platform}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                       <Tooltip>
                                          <TooltipTrigger asChild>
                                              <Button variant="ghost" size="icon" onClick={handleToggleBoostPanel} className={cn("transition-colors h-8 w-8 md:h-9 md:w-9", isBoostPanelOpen && "bg-accent")}>
                                                  <Settings2 className="h-4 w-4 md:h-5 md:w-5" />
                                                  <span className="sr-only">Toggle Boost Panel</span>
                                              </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>Hashtags & Emojis</TooltipContent>
                                       </Tooltip>
                                </div>
                                {/* TabsContent should handle internal scrolling */}
                                {PLATFORMS.map(platform => (
                                    <TabsContent key={platform} value={platform} className="flex-grow mt-0 overflow-y-auto p-4 md:p-6">
                                        <div className="flex flex-col h-full gap-4">
                                            <div className="relative flex-grow">
                                                <Textarea
                                                    ref={outputTextareaRefs[platform]}
                                                    value={generatedPosts[platform]}
                                                    onChange={(e) => handleOutputChange(platform, e.target.value)}
                                                    rows={10} // Adjust rows as needed
                                                    className="text-sm h-full resize-none pr-10 md:pr-12" // Ensure padding for buttons
                                                    disabled={!!loadingState.tuning[platform]}
                                                    placeholder={`Generated ${platform} post will appear here...`}
                                                    aria-label={`${platform} Post Output`}
                                                />
                                                {/* Absolute positioned buttons */}
                                                <div className="absolute top-2 right-2 flex flex-col gap-1">
                                                   {/* AI Advisor Button */}
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
                                                    {/* Tone Tuner Button */}
                                                   <Tooltip>
                                                      <TooltipTrigger asChild>
                                                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openToneTuner(platform)} disabled={!generatedPosts[platform] || generatedPosts[platform].startsWith("Error:") || !!loadingState.tuning[platform]}>
                                                            <Palette className="h-4 w-4 text-cyan-400" />
                                                         </Button>
                                                      </TooltipTrigger>
                                                      <TooltipContent>Tune Tone & Style</TooltipContent>
                                                   </Tooltip>
                                                    {/* Copy Button */}
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
                                            {/* Tuning Buttons */}
                                            <div id={`tune-buttons-${platform}`} className="flex flex-wrap gap-2">
                                                {['Make Wittier', 'More Concise', 'Add Emojis', 'More Formal', 'Add Hashtags'].map(instr => (
                                                   <Tooltip key={instr}>
                                                      <TooltipTrigger asChild>
                                                          {/* Wrap button for tooltip when disabled */}
                                                          <div className="inline-block">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleTunePost(platform, instr)}
                                                                disabled={!!loadingState.tuning[platform] || !generatedPosts[platform] || generatedPosts[platform].startsWith("Error:") || !!rateLimitState.tune?.active}
                                                                loading={loadingState.tuning[platform] === instr}
                                                                className="text-xs px-2 py-1 h-auto" // Smaller padding/height
                                                            >
                                                                {instr}
                                                            </Button>
                                                          </div>
                                                      </TooltipTrigger>
                                                      <TooltipContent>{getRateLimitTooltip('tune') ?? `Apply: ${instr}`}</TooltipContent>
                                                   </Tooltip>
                                                ))}
                                            </div>
                                            {/* Preview Mockup */}
                                            <PreviewMockup platform={platform} content={generatedPosts[platform]} />
                                        </div>
                                    </TabsContent>
                                ))}
                            </Tabs>
                        ) : (
                             <div className="flex items-center justify-center text-center text-muted-foreground p-10 flex-grow">
                                {loadingState.summarizing || loadingState.generating ? (
                                    <div className="flex items-center justify-center">
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        <span>{loadingState.summarizing ? 'Summarizing...' : `Generating ${loadingState.generating}...`}</span>
                                    </div>
                                ) : (
                                    'Enter content above and click "Generate Posts".'
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Right Column (Side Panels) - Conditionally render */}
             {(isAiAdvisorOpen || isBoostPanelOpen) && (
                <div className="lg:w-[340px] xl:w-[380px] flex-shrink-0 flex flex-col gap-6 md:gap-8"> {/* Fixed width for side panels */}
                    {isAiAdvisorOpen && (
                        <AiAdvisorPanel
                            isOpen={isAiAdvisorOpen}
                            isLoading={!!loadingState.analyzing}
                            analysis={advisorAnalysis}
                            onApplySuggestion={handleApplySuggestion}
                            onClose={() => setIsAiAdvisorOpen(false)}
                        />
                    )}
                    {isBoostPanelOpen && (
                        <BoostPanel
                            isOpen={isBoostPanelOpen}
                            onToggle={handleToggleBoostPanel}
                            onInsertText={handleInsertText}
                        />
                    )}
                </div>
             )}
         </main>

         <footer className="text-center mt-8 text-xs text-muted-foreground">
           Built with Next.js, Supabase, Genkit & ShadCN UI for the Gemini Hackathon.
         </footer>

         {/* Dialogs and Sheets */}
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
