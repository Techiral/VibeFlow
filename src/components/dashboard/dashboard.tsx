'use client';

import type { User } from '@supabase/supabase-js';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile, Quota, UserProfileFunctionReturn } from '@/types/supabase';
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
import { Zap, User as UserIcon, LogOut, Copy, Bot, Palette, Lightbulb, AlertCircle, X, Loader2, Check, Sparkles, ChevronRight, Hash, Smile, Info, Settings2, BookOpen } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link'; // Added missing import
import { redirect, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { ProfileDialog } from './profile-dialog'; // Import the profile dialog
import { Progress } from "@/components/ui/progress"; // Import Progress component
import AiAdvisorPanel from './ai-advisor-panel'; // Import AI Advisor Panel
import { toast as sonnerToast } from 'sonner'; // Import sonner toast for confetti effect
import Confetti from 'react-confetti';
import Joyride, { Step, CallBackProps } from 'react-joyride'; // Import react-joyride
import ToneTunerSheet from './tone-tuner-sheet';
import BoostPanel from './boost-panel';
import PreviewMockup from './preview-mockup';
import HelpModal from './help-modal';
import { Separator } from '../ui/separator'; // Import Separator
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
  };
};

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
  { xp: 50, name: 'Vibe Starter ✨', description: 'Generated 5 posts!' },
  { xp: 100, name: 'Content Ninja 🥷', description: 'Generated 10 posts!' },
  { xp: 200, name: 'Social Samurai ⚔️', description: 'Generated 20 posts!' },
  { xp: 500, name: 'AI Maestro 🧑‍🔬', description: 'Mastered 50 generations!' },
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
    tuning: {}, // Initialize as empty object
    analyzing: null,
  });
   const [rateLimitState, setRateLimitState] = useState<RateLimitState>({});
   const rateLimitTimers = useRef<{[key in RateLimitOperation]?: NodeJS.Timeout}>({});
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(serverErrorMessage);
  const [isAiAdvisorOpen, setIsAiAdvisorOpen] = useState(false);
  const [advisorAnalysis, setAdvisorAnalysis] = useState<AnalyzePostOutput | null>(null);
  const [analyzingPlatform, setAnalyzingPlatform] = useState<SocialPlatform | null>(null);
  const [isToneTunerOpen, setIsToneTunerOpen] = useState(false);
  const [tuningPlatform, setTuningPlatform] = useState<SocialPlatform | null>(null); // Track which platform's tone is being tuned
  const [isBoostPanelOpen, setIsBoostPanelOpen] = useState(false);
  const [activeOutputTab, setActiveOutputTab] = useState<SocialPlatform>('linkedin'); // Track active output tab
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  // State for confetti effect
  const [showConfetti, setShowConfetti] = useState(false);
  const [confettiPieces, setConfettiPieces] = useState(200);

  // State and refs for Joyride
  const [runTour, setRunTour] = useState(false);
  const [isClient, setIsClient] = useState(false); // Ensure Joyride only runs client-side
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
    const newlyAwardedBadges: typeof BADGES[number][] = []; // Correct type for array elements
    BADGES.forEach(badge => {
      if (!badge.hidden && currentXp >= badge.xp && !achievedBadges.includes(badge.name)) {
        newlyAwardedBadges.push(badge);
      }
    });

    if (newlyAwardedBadges.length > 0) {
      const newBadgeNames = newlyAwardedBadges.map(b => b.name);
      const updatedBadges = [...achievedBadges, ...newBadgeNames];

      try {
        // Update Supabase
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ badges: updatedBadges })
          .eq('id', user.id);

        if (updateError) throw updateError;

        // Update local state
        setBadges(updatedBadges);

        // Show confetti and toast for each new badge
        newlyAwardedBadges.forEach((badge, index) => {
           setTimeout(() => {
             setShowConfetti(true);
             setConfettiPieces(200 + index * 50); // Vary confetti slightly
             sonnerToast.success(`🏆 Badge Unlocked: ${badge.name}`, {
                 description: badge.description,
                 duration: 5000,
             });
             // Hide confetti after a delay
             setTimeout(() => setShowConfetti(false), 4000);
          }, index * 500); // Stagger notifications slightly
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
  }, [supabase, user.id, toast]); // Dependencies for badge awarding


  // --- Joyride & Client-Side Check ---
  useEffect(() => {
    setIsClient(true); // Mark as client-side rendered
    // Start tour if user hasn't completed it and profile exists
    if (profile && !badges.includes('onboarded') && !dbSetupError && !errorMessage) {
       // Small delay to ensure UI elements are likely rendered
       const timer = setTimeout(() => setRunTour(true), 500);
       return () => clearTimeout(timer);
    }
  }, [profile, badges, dbSetupError, errorMessage]); // Dependencies for starting the tour

  const handleJoyrideCallback = useCallback(async (data: CallBackProps) => {
    const { status } = data; // Destructure only status
    const FINISHED_STATUSES: string[] = ['finished', 'skipped'];

    if (FINISHED_STATUSES.includes(status)) {
      setRunTour(false);
      if (status === 'finished' && profile && !badges.includes('onboarded')) {
        // Mark onboarding as completed in DB and update local state
         try {
           const { error: updateError } = await supabase
             .from('profiles')
             .update({ badges: [...badges, 'onboarded'] })
             .eq('id', user.id);

           if (updateError) {
             throw updateError;
           }
           setBadges(prev => [...prev, 'onboarded']);
           console.log("Onboarding badge awarded.");
         } catch (error: any) {
           console.error("Failed to save onboarding completion:", error.message);
           // Optionally show a toast error to the user
         }
      }
    }

    // console.log('Joyride callback data:', data);
  }, [supabase, user.id, profile, badges]);


  // --- Rate Limit Countdown Effect ---
  useEffect(() => {
    const timers: NodeJS.Timeout[] = []; // Store timers for cleanup

    Object.entries(rateLimitState).forEach(([key, state]) => {
      const operationKey = key as RateLimitOperation;
      if (state?.active) {
        const updateTimer = () => {
          const now = Date.now();
          if (now >= state.retryAfter) {
            setRateLimitState(prev => {
              const newState = { ...prev };
              delete newState[operationKey]; // Clear rate limit
              return newState;
            });
          } else {
            // Optionally update remaining time in state for display
             const remainingSeconds = Math.ceil((state.retryAfter - now) / 1000);
            // console.log(`Rate limit ${operationKey}: ${remainingSeconds}s remaining`); // Debug log
             // Re-schedule timer
            const timer = setTimeout(updateTimer, 1000);
            timers.push(timer); // Add timer to cleanup list
          }
        };
        updateTimer(); // Start the timer
      }
    });

    // Cleanup function to clear all active timers when component unmounts or rateLimitState changes
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [rateLimitState]); // Rerun effect when rateLimitState changes


 // --- Data Fetching and Initialization ---
  useEffect(() => {
    const ensureData = async () => {
       let currentProfile = profile;
       let currentQuota = quota;
       let currentBadges = badges; // Use state badges
       let profileErrorOccurred = false;
       let quotaErrorOccurred = false;

      // 1. Ensure Profile Exists
      if (!currentProfile) {
        console.log("Profile missing, attempting to fetch/create...");
        try {
          const { data: profileDataArray, error: profileError } = await supabase
            .rpc('get_user_profile', { p_user_id: user.id });

          if (profileError) throw profileError;

          if (!profileDataArray || profileDataArray.length === 0) {
            // This case indicates get_user_profile failed to upsert, which is a problem.
            throw new Error("Profile function failed to return or create a profile.");
          }

          currentProfile = profileDataArray[0];
          setProfile(currentProfile);
          // Update badges from fetched profile if it exists
          currentBadges = currentProfile?.badges ?? [];
          setBadges(currentBadges);
          setXp(currentProfile?.xp ?? 0); // Also update XP
          console.log("Profile fetched/created successfully:", currentProfile?.username);

        } catch (error: any) {
          console.error("Error fetching/creating profile on client:", error.message);
           setErrorMessage(prev => prev ? `${prev}\nProfile Error: ${error.message}` : `Profile Error: ${error.message}`);
           profileErrorOccurred = true;
           // If get_user_profile doesn't exist, flag as DB setup error
            if (error.message.includes("function public.get_user_profile does not exist")) {
                 // This state is already handled by the server-side check, but good redundancy
            }
        }
      } else {
         // If profile exists from initial props, ensure local state matches
         if (badges !== currentProfile.badges) setBadges(currentProfile.badges ?? []);
         if (xp !== currentProfile.xp) setXp(currentProfile.xp ?? 0);
      }

      // 2. Ensure Quota Exists (only if profile is ok)
      if (!currentQuota && !profileErrorOccurred) {
        console.log("Quota missing, attempting to fetch/create...");
        try {
           // Use get_remaining_quota which handles upsert and reset logic
           const { data: remainingQuota, error: quotaRpcError } = await supabase
             .rpc('get_remaining_quota', { p_user_id: user.id });

           if (quotaRpcError) throw quotaRpcError;

           // Now fetch the full quota record since get_remaining_quota only returns the remaining count
            const { data: quotaData, error: quotaFetchError } = await supabase
             .from('quotas')
             .select('*')
             .eq('user_id', user.id)
             .maybeSingle(); // Use maybeSingle to handle 0 or 1 row

           if (quotaFetchError) throw quotaFetchError;

           if (!quotaData) {
               // This shouldn't happen if the RPC worked, but handle defensively
               console.warn("Quota record still missing after RPC call. Attempting direct insert.");
               // Attempt direct insert if maybeSingle returned null
                const { data: insertedQuota, error: insertError } = await supabase
                    .from('quotas')
                    .insert({ user_id: user.id }) // Insert with defaults
                    .select()
                    .single(); // Expect the newly inserted row

                if (insertError) {
                   console.error("Error inserting default quota:", insertError.message);
                   throw insertError; // Propagate insert error
                }
                currentQuota = insertedQuota;

           } else {
             currentQuota = quotaData;
           }

           setQuota(currentQuota);
           console.log("Quota fetched/created successfully:", currentQuota.request_count, "/", currentQuota.quota_limit);

        } catch (error: any) {
           console.error("Error fetching/creating quota on client:", error.message);
           setErrorMessage(prev => prev ? `${prev}\nQuota Error: ${error.message}` : `Quota Error: ${error.message}`);
           quotaErrorOccurred = true;
             if (error.message.includes("function public.get_remaining_quota does not exist")) {
                // Again, likely handled server-side, but good check
             } else if (error.message.includes("relation \"public.quotas\" does not exist")) {
                // Likely handled server-side
             }
        }
      }

       // 3. Check for badges after ensuring profile exists
        if (currentProfile && !profileErrorOccurred) {
             checkAndAwardBadges(currentProfile.xp ?? 0, currentBadges);
        }

    };

    // Run checks only if not a DB setup error from the server
    if (!dbSetupError) {
      ensureData();
    } else {
        // If it IS a db setup error, ensure profile/quota are null locally
        setProfile(null);
        setQuota(null);
    }

  }, [user.id, supabase, dbSetupError, checkAndAwardBadges, profile, quota, badges, xp]); // Added profile, quota, badges, xp back


  // --- Profile Update Handling ---
  const handleProfileUpdate = (updatedProfile: UserProfileFunctionReturn) => {
    setProfile(updatedProfile);
    // Check if Gemini key was added/updated
    if (updatedProfile.gemini_api_key && errorMessage?.includes('Gemini API Key is missing')) {
      setErrorMessage(null); // Clear specific error message if key is now present
    }
     // Check badges again in case XP updated indirectly
     checkAndAwardBadges(updatedProfile.xp ?? 0, updatedProfile.badges ?? []);
  };


  // --- Sign Out ---
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login'); // Use router for navigation
  };


  // --- Helper for AI Calls with Quota Check, Error Handling, and Retry ---
   const callAiWithRetry = async <T>(
     aiFunction: () => Promise<T>,
     cost: number,
     operationKey: RateLimitOperation // Use the specific type
    ): Promise<{ data: T | null; error: Error | null; rateLimited?: boolean; retryAfter?: number }> => {
        const currentLimitState = rateLimitState[operationKey];
        if (currentLimitState?.active && Date.now() < currentLimitState.retryAfter) {
            const retryTime = new Date(currentLimitState.retryAfter).toLocaleTimeString();
            console.warn(`Operation ${operationKey} is rate-limited. Try again after ${retryTime}`);
            // No toast here, rely on the Alert component
            return { data: null, error: new Error("Rate limit active"), rateLimited: true, retryAfter: currentLimitState.retryAfter };
        }

        // Clear specific rate limit alert if it exists and is no longer active
         if (rateLimitState[operationKey]?.active && Date.now() >= rateLimitState[operationKey]!.retryAfter) {
            setRateLimitState(prev => {
                const newState = { ...prev };
                delete newState[operationKey];
                return newState;
            });
        }


        // Check Quota
        const remainingQuotaResult = await supabase.rpc('get_remaining_quota', { p_user_id: user.id });
        if (remainingQuotaResult.error || typeof remainingQuotaResult.data !== 'number') {
          console.error("Error fetching remaining quota:", remainingQuotaResult.error);
           toast({ title: "Quota Check Failed", description: "Could not verify remaining quota.", variant: "destructive" });
          return { data: null, error: new Error("Could not verify quota.") };
        }
        if (remainingQuotaResult.data < cost) {
          console.warn("Quota exceeded. Required:", cost, "Remaining:", remainingQuotaResult.data);
          setErrorMessage("Quota exceeded. Upgrade your plan or wait for reset."); // Set specific error
           setQuota(prev => prev ? { ...prev, request_count: prev.quota_limit } : null); // Visually max out bar
          return { data: null, error: new Error("Quota exceeded.") };
        }

        // Check API Key
         if (!profile?.gemini_api_key) {
             setErrorMessage("Google Gemini API Key is missing. Please add it in your profile settings.");
             setIsProfileDialogOpen(true); // Prompt user to add key
             return { data: null, error: new Error("Missing Gemini API Key") };
         }

         let result: T | null = null;
         let error: Error | null = null;
         let shouldRefund = false;
         let isRateLimitError = false;
         let apiRetryAfter = 0; // Timestamp for API-level rate limit


        try {
            console.log(`Attempting to increment quota by ${cost} for user ${user.id}`);
            const { data: newRemainingQuota, error: incrementError } = await supabase.rpc('increment_quota', {
              p_user_id: user.id,
              p_increment_amount: cost,
            });

             if (incrementError) {
                if (incrementError.message.includes('quota_exceeded')) {
                   console.warn("Quota exceeded (checked during increment).");
                   setErrorMessage("Quota exceeded. Upgrade your plan or wait for reset.");
                   setQuota(prev => prev ? { ...prev, request_count: prev.quota_limit } : null); // Max out bar
                   return { data: null, error: new Error("Quota exceeded.") };
                } else {
                    console.error("Error incrementing quota:", incrementError);
                    throw new Error(`Failed to update quota: ${incrementError.message}`); // Throw to prevent AI call
                }
             }
            console.log("Quota increment RPC successful, refetching data...");

             // Immediately refetch quota and profile after successful increment
             await Promise.all([
                 supabase.from('quotas').select('*').eq('user_id', user.id).single().then(({ data, error: qError }) => {
                     if (qError) console.error("Error refetching quota post-increment:", qError);
                     else {
                         setQuota(data);
                         console.log("Refetched quota data:", data);
                     }
                 }),
                 supabase.rpc('get_user_profile', { p_user_id: user.id }).then(({ data, error: pError }) => {
                      if (pError) console.error("Error refetching profile post-increment:", pError);
                      else if (data && data.length > 0) {
                          const fetchedProfile = data[0];
                          setProfile(fetchedProfile);
                          setXp(fetchedProfile.xp ?? 0); // Update XP state
                           // Update badges directly from fetched profile
                           setBadges(fetchedProfile.badges ?? []);
                           console.log("Refetched profile data:", fetchedProfile);
                           // Check for badges immediately after XP update
                           checkAndAwardBadges(fetchedProfile.xp ?? 0, fetchedProfile.badges ?? []);
                     } else {
                          console.warn("Profile refetch post-increment returned no data.");
                      }
                 })
             ]);


             // Proceed with AI function call
             result = await aiFunction();

        } catch (err: any) {
            error = err instanceof Error ? err : new Error(String(err));
            shouldRefund = true; // Mark for refund on any error during/after increment
             console.error(`Error during AI operation (${operationKey}) or quota handling:`, error.message);

            // Check for specific rate limit error patterns (adjust based on actual API errors)
            const messageLower = error.message?.toLowerCase() || '';
            // Use status codes from GenkitError if available
             const status = (err as any).status; // Assuming GenkitError might have a status property

            if (status === 'RESOURCE_EXHAUSTED' || messageLower.includes('rate limit') || messageLower.includes('429')) {
                 isRateLimitError = true;
                 // Attempt to parse Retry-After header if available (hypothetical example)
                 const retryAfterSeconds = parseInt((err as any).headers?.['retry-after'] || '60', 10); // Default to 60s
                 apiRetryAfter = Date.now() + retryAfterSeconds * 1000;

                setRateLimitState(prev => ({
                    ...prev,
                    [operationKey]: { active: true, retryAfter: apiRetryAfter }
                }));
                 console.warn(`API Rate limit hit for ${operationKey}. Retrying after ${new Date(apiRetryAfter).toLocaleTimeString()}`);
                 // No explicit toast here, handled by the Alert
            } else if (status === 'UNAVAILABLE' || messageLower.includes('503') || messageLower.includes('unavailable') || messageLower.includes('overloaded')) {
                 // Handle 503/UNAVAILABLE as temporary unavailability, potentially shorter retry
                 isRateLimitError = true; // Treat as a temporary rate limit for UI purposes
                 apiRetryAfter = Date.now() + 30 * 1000; // Shorter retry for 503? (e.g., 30s)
                 setRateLimitState(prev => ({
                    ...prev,
                    [operationKey]: { active: true, retryAfter: apiRetryAfter }
                 }));
                console.warn(`API Service unavailable (503/UNAVAILABLE) for ${operationKey}. Retrying after ${new Date(apiRetryAfter).toLocaleTimeString()}`);
                // No explicit toast here, handled by the Alert
            } else if (status === 'INVALID_ARGUMENT') {
                 // Handle bad requests (e.g., invalid API key format, bad prompt structure) - Not rate limiting
                 console.error(`Invalid argument for ${operationKey}:`, error.message);
                 setErrorMessage(`Error: Invalid input or configuration for ${operationKey}. Please check your input and API key.`);
                 // Do not set rate limit state for invalid arguments
            } else if (status === 'UNAUTHENTICATED' || messageLower.includes('api key not valid')) {
                console.error(`Authentication error for ${operationKey}: Invalid API Key.`);
                 setErrorMessage("Invalid Gemini API Key. Please check your profile settings.");
                 setIsProfileDialogOpen(true); // Prompt user to fix key
            } else {
                 // Generic internal errors
                 console.error(`Internal error during ${operationKey}:`, error.message);
                 setErrorMessage(`An internal error occurred during ${operationKey}. Please try again later.`);
            }


        } finally {
            if (shouldRefund && cost > 0) {
                console.log(`Refunding ${cost} quota points due to errors.`);
                try {
                    // Decrement quota by the cost
                     const { error: decrementError } = await supabase.rpc('increment_quota', {
                         p_user_id: user.id,
                         p_increment_amount: -cost, // Negative value to decrement
                     });
                     if (decrementError) {
                         console.error("Error refunding quota:", decrementError);
                         // Consider how to handle refund failure - maybe log persistently?
                     } else {
                         // Refetch quota after refund
                         const { data: refundedQuotaData, error: fetchError } = await supabase
                             .from('quotas')
                             .select('*')
                             .eq('user_id', user.id)
                             .single();
                         if (!fetchError && refundedQuotaData) {
                             setQuota(refundedQuotaData);
                             console.log("Quota refunded and updated:", refundedQuotaData);
                         }
                     }
                } catch (refundError: any) {
                    console.error("Exception during quota refund:", refundError.message);
                }
            }
        }

       // Return structure including rate limit info
       return {
         data: result,
         error,
         rateLimited: isRateLimitError,
         retryAfter: isRateLimitError ? apiRetryAfter : undefined,
       };
    };


  // --- Summarization and Generation ---
  const handleGeneratePosts = async () => {
    if (!content.trim() || loadingState.summarizing || loadingState.generating) return;

    setLoadingState(prev => ({ ...prev, summarizing: true, generating: 'linkedin' })); // Start generating for first platform
    setSummary('');
    setGeneratedPosts({ linkedin: '', twitter: '', youtube: '' });
    setErrorMessage(null); // Clear previous errors
    setAdvisorAnalysis(null); // Clear previous analysis

     // 1. Summarization (Cost: 1 point) - Reduced cost assumption
    const summaryResult = await callAiWithRetry(
      async () => {
        if (!profile?.gemini_api_key) throw new Error("Missing Gemini API Key");
        return await summarizeContent({ content }, { apiKey: profile.gemini_api_key });
      },
      1, // Assume cost of 1 for summarization
       'summarize' // Operation key
    );

     if (summaryResult.error || !summaryResult.data) {
       setLoadingState(prev => ({ ...prev, summarizing: false, generating: null }));
        if (!summaryResult.rateLimited) { // Only show toast if not rate limited (rate limit has its own alert)
             toast({ title: "Summarization Failed", description: summaryResult.error?.message || "Unknown error during summarization.", variant: "destructive" });
        }
       return;
     }

    const currentSummary = summaryResult.data.summary;
    setSummary(currentSummary);
    setLoadingState(prev => ({ ...prev, summarizing: false }));
    console.log("Summarization successful:", summaryResult.data);
    toast({ title: "Summarization Complete", description: "Now generating posts..." });


    // 2. Post Generation (Cost: 1 point per platform = 3 total)
    let generationError: string | null = null;
    let anyRateLimited = false; // Track if any generation was rate limited

     // Use Promise.allSettled to run generations concurrently and capture all results/errors
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
            1, // Cost per platform
            'generate' // Operation key
         );

       setLoadingState(prev => ({ ...prev, generating: null })); // Clear generating state for this platform
        return { platform, result };
    });

     const generationResults = await Promise.allSettled(generationPromises);

     generationResults.forEach(promiseResult => {
        if (promiseResult.status === 'fulfilled') {
            const { platform, result } = promiseResult.value;
            if (result.error || !result.data) {
                 if (result.rateLimited) {
                    anyRateLimited = true; // Mark that at least one was rate limited
                 } else {
                    const errorMsg = result.error?.message || `Unknown error generating ${platform} post.`;
                    console.error(`Error generating ${platform} post:`, errorMsg);
                    generationError = (generationError ? generationError + "\n" : "") + `Failed to generate post for ${platform}: ${errorMsg}`;
                    setGeneratedPosts(prev => ({ ...prev, [platform]: `Error: ${errorMsg}` }));
                 }
            } else {
                console.log(`${platform} post generated:`, result.data.post);
                setGeneratedPosts(prev => ({ ...prev, [platform]: result.data.post }));
            }
        } else {
            // Handle unexpected promise rejection (should ideally be caught by callAiWithRetry)
            const errorMsg = promiseResult.reason?.message || 'Unexpected generation error';
            console.error("Unexpected error during post generation promise:", errorMsg);
            generationError = (generationError ? generationError + "\n" : "") + `Unexpected error: ${errorMsg}`;
        }
     });


    setLoadingState(prev => ({ ...prev, generating: null })); // Ensure generating is fully cleared

    if (generationError) {
      toast({
        title: "Post Generation Issues",
        description: "Some posts could not be generated. See individual posts for details.",
        variant: "destructive",
      });
    } else if (!anyRateLimited) { // Only show success if no errors AND no rate limits occurred
      toast({ title: "Posts Generated Successfully", description: "Review and tune your new drafts." });
    }
  };


  // --- Tuning ---
   const handleTunePost = async (platform: SocialPlatform, instruction: string) => {
     const currentPost = generatedPosts[platform];
     if (!currentPost || currentPost.startsWith("Error:") || loadingState.tuning[platform]) return; // Check specific platform tuning state

     setLoadingState(prev => ({ ...prev, tuning: { ...prev.tuning, [platform]: instruction } })); // Set instruction being tuned
     setErrorMessage(null);
     setAdvisorAnalysis(null); // Clear analysis when tuning

     const personaPrompt = PERSONAS.find(p => p.value === selectedPersona)?.prompt || '';

     const tuneResult = await callAiWithRetry(
       async () => {
         if (!profile?.gemini_api_key) throw new Error("Missing Gemini API Key");
         return await tuneSocialPosts(
             { postContent: currentPost, platform, instruction, personaPrompt },
             { apiKey: profile.gemini_api_key }
          );
       },
        1, // Cost for tuning
        'tune' // Operation key
     );


     setLoadingState(prev => ({ ...prev, tuning: { ...prev.tuning, [platform]: null } })); // Clear tuning state for platform

     if (tuneResult.error || !tuneResult.data) {
        if (!tuneResult.rateLimited) {
            const errorMsg = tuneResult.error?.message || `Unknown error tuning ${platform} post.`;
            console.error(`Tuning ${platform} post failed:`, errorMsg);
            toast({ title: `Tuning Failed (${platform})`, description: errorMsg, variant: "destructive" });
        } else {
            // Handle rate limit specifically if needed (e.g., prevent further tuning buttons)
            console.warn(`Tuning for ${platform} rate-limited. Try again later.`);
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
      setIsAiAdvisorOpen(true); // Open the panel
      setAdvisorAnalysis(null); // Clear previous analysis
      setAnalyzingPlatform(platform); // Set the platform being analyzed
      setErrorMessage(null);

       const analysisResult = await callAiWithRetry(
           async () => {
               if (!profile?.gemini_api_key) throw new Error("Missing Gemini API Key");
               return await analyzePost({ postContent, platform }, { apiKey: profile.gemini_api_key });
           },
           1, // Cost for analysis
           'analyze' // Operation key
       );

       setLoadingState(prev => ({ ...prev, analyzing: null }));

       if (analysisResult.error || !analysisResult.data) {
           if (!analysisResult.rateLimited) {
                const errorMsg = analysisResult.error?.message || `Unknown error analyzing ${platform} post.`;
                console.error(`Analysis for ${platform} post failed:`, errorMsg);
                toast({ title: `Analysis Failed (${platform})`, description: errorMsg, variant: "destructive" });
                setAdvisorAnalysis({ analysis: `Error: ${errorMsg}`, flags: [] }); // Show error in panel
            } else {
                 console.warn(`Analysis for ${platform} rate-limited. Try again later.`);
                 // Optionally show a specific message in the advisor panel about rate limiting
                 setAdvisorAnalysis({ analysis: `Analysis is temporarily rate-limited. Please wait.`, flags: [] });
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
     // Optionally, re-analyze after applying or clear analysis
     setAdvisorAnalysis(null);
     setIsAiAdvisorOpen(false);
     setAnalyzingPlatform(null);
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

        // Update the main persona selector
        setSelectedPersona(newToneValue);

        // Re-generate the post for the specific platform with the new persona
        // Use a descriptive instruction for tuning based on persona change
        handleTunePost(tuningPlatform, `Rewrite this post in the style of: ${newPersona.label}`);
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

      // Focus the textarea and move cursor after inserted text
      textarea.focus();
       // Use requestAnimationFrame to ensure focus happens before setting selection
        requestAnimationFrame(() => {
          textarea.selectionStart = start + textToInsert.length;
          textarea.selectionEnd = start + textToInsert.length;
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
     // Reset outputs if input changes significantly? Maybe not, allow minor edits.
     // setSummary('');
     // setGeneratedPosts({ linkedin: '', twitter: '', youtube: '' });
   };

    // --- Handle Output Textarea Change ---
    const handleOutputChange = (platform: SocialPlatform, value: string) => {
        setGeneratedPosts(prev => ({ ...prev, [platform]: value }));
        // If user manually edits, clear AI advisor analysis?
        if (platform === analyzingPlatform) {
            setAdvisorAnalysis(null);
        }
    };

     // --- Keyboard Shortcuts ---
     useEffect(() => {
       const handleKeyDown = (event: KeyboardEvent) => {
         // Ctrl+H or Cmd+H to toggle Help Modal
         if ((event.ctrlKey || event.metaKey) && event.key === 'h') {
           event.preventDefault();
           setIsHelpModalOpen(prev => !prev);
         }
         // Esc to close modals
         if (event.key === 'Escape') {
             if (isProfileDialogOpen) setIsProfileDialogOpen(false);
             if (isAiAdvisorOpen) setIsAiAdvisorOpen(false);
             if (isToneTunerOpen) setIsToneTunerOpen(false);
             if (isBoostPanelOpen) setIsBoostPanelOpen(false); // Assuming boost panel can be closed with Esc
             if (isHelpModalOpen) setIsHelpModalOpen(false);
         }
       };

       window.addEventListener('keydown', handleKeyDown);
       return () => {
         window.removeEventListener('keydown', handleKeyDown);
       };
     }, [isProfileDialogOpen, isAiAdvisorOpen, isToneTunerOpen, isBoostPanelOpen, isHelpModalOpen]); // Add modal states to dependency array


  // --- Calculate Quota Percentage ---
  const quotaPercentage = quota ? (quota.request_count / quota.quota_limit) * 100 : 0;
  const quotaTooltipContent = quota
    ? `${quota.request_count} / ${quota.quota_limit} requests used this cycle.`
    : "Loading quota...";

  // --- Calculate XP Percentage for next level (simplified) ---
   const getCurrentLevelInfo = (currentXp: number) => {
        let currentLevel = 0;
        let nextLevelXp = BADGES.find(b => !b.hidden)?.xp || 50; // XP needed for first non-hidden badge
        let currentLevelXpThreshold = 0;

        // Find the highest badge threshold the user has met
        const sortedVisibleBadges = BADGES.filter(b => !b.hidden).sort((a, b) => a.xp - b.xp);

        for (let i = 0; i < sortedVisibleBadges.length; i++) {
            if (currentXp >= sortedVisibleBadges[i].xp) {
                currentLevel = i + 1;
                currentLevelXpThreshold = sortedVisibleBadges[i].xp;
                // Set nextLevelXp to the *next* badge's threshold
                if (i + 1 < sortedVisibleBadges.length) {
                     nextLevelXp = sortedVisibleBadges[i+1].xp;
                 } else {
                      // If they have the last badge, maybe double the last threshold for the next goal?
                     nextLevelXp = currentLevelXpThreshold * 2; // Or set to Infinity, or handle differently
                 }
            } else {
                 // If current XP is less than this badge's threshold, this is the next level
                nextLevelXp = sortedVisibleBadges[i].xp;
                break; // Stop once we find the next level threshold
            }
        }


         // Avoid division by zero if thresholds are the same or nextLevelXp is 0
         const xpTowardsNext = Math.max(0, currentXp - currentLevelXpThreshold);
         const xpNeededForNext = Math.max(1, nextLevelXp - currentLevelXpThreshold); // Ensure it's at least 1

         const percentage = Math.min(100, (xpTowardsNext / xpNeededForNext) * 100);


        return {
            level: currentLevel,
            xpForNextLevel: nextLevelXp,
            percentage: isNaN(percentage) ? 0 : percentage, // Handle NaN case
            xpTowardsNext: xpTowardsNext,
             xpNeededForNext: xpNeededForNext
        };
    };

    const xpInfo = getCurrentLevelInfo(xp);
    const xpTooltipContent = `Level ${xpInfo.level} | ${xp} XP (${xpInfo.xpTowardsNext}/${xpInfo.xpNeededForNext} towards Lvl ${xpInfo.level + 1})`;

 // --- Check if API key is missing ---
  const isApiKeyMissing = !profile?.gemini_api_key;
   // --- Check Quota Status ---
  const isQuotaExceeded = quota ? quota.request_count >= quota.quota_limit : false;

   // --- Get Remaining Time for Rate Limit ---
   const getRateLimitRemainingTime = (operationKey: RateLimitOperation): number => {
        const state = rateLimitState[operationKey];
        if (state?.active && state.retryAfter > Date.now()) {
            return Math.ceil((state.retryAfter - Date.now()) / 1000);
        }
        return 0;
    };


  // --- Loading UI ---
  if (profile === undefined || quota === undefined) {
     // Initial loading state before useEffect finishes checks
     return (
       <div className="flex min-h-screen w-full items-center justify-center p-4">
         <Loader2 className="h-8 w-8 animate-spin text-primary" />
         <span className="ml-2">Loading dashboard...</span>
       </div>
     );
  }

   // --- DB Setup Error UI ---
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

   // --- Helper to get Rate Limit Tooltip Content ---
   const getRateLimitTooltip = (operationKey: RateLimitOperation): React.ReactNode | undefined => {
        const remainingTime = getRateLimitRemainingTime(operationKey);
        if (remainingTime > 0) {
            return `Rate limit active. Wait ${remainingTime}s.`;
        }
        return undefined;
    };


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
                zIndex: 10000, // Ensure it's above other elements
                primaryColor: '#6D28D9', // Use primary color
                arrowColor: '#0A0A0A', // Background color for arrow
                backgroundColor: '#0A0A0A', // Background for tooltip
                textColor: '#F1F5F9', // Text color
              },
               tooltip: {
                   borderRadius: '0.5rem', // Match app's border radius
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
     {/* Confetti Effect */}
     {isClient && showConfetti && (
         <Confetti
             width={typeof window !== 'undefined' ? window.innerWidth : 0}
             height={typeof window !== 'undefined' ? window.innerHeight : 0}
             numberOfPieces={confettiPieces}
             recycle={false}
             onConfettiComplete={() => setShowConfetti(false)}
             className="!fixed !top-0 !left-0 !w-full !h-full !z-[10001]" // Ensure high z-index
           />
      )}
    <div className={cn(
      "flex flex-col min-h-screen bg-background text-foreground p-4 md:p-8 relative",
      // Add class for Joyride step highlighting issue
      runTour && "joyride-active-step-fix"
      )}> {/* Added relative positioning */}
      {/* Header */}
      <header className="flex justify-between items-center mb-6 md:mb-8">
        <Link href="/" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
          <Zap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-gradient">VibeFlow</h1>
        </Link>
        <div className="flex items-center gap-4 md:gap-6">
           {/* Quota and XP Display */}
            <Tooltip>
              <TooltipTrigger asChild>
                 <div id="quota-display" className="flex flex-col items-end w-32 md:w-48">
                     <div className="w-full flex justify-between items-center mb-1">
                        <span className="text-xs font-medium text-muted-foreground">Usage</span>
                        {quota ? (
                           <span className="text-xs font-semibold">{quota.request_count}/{quota.quota_limit}</span>
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
                     {/* XP Bar */}
                    <div className="w-full flex justify-between items-center mt-1.5 mb-1">
                        <span className="text-xs font-medium text-muted-foreground">XP</span>
                        <span className="text-xs font-semibold">{xp}</span>
                     </div>
                     <Progress
                         value={xpInfo.percentage}
                         className="h-1.5 w-full"
                         aria-label={xpTooltipContent} // Add aria-label for accessibility
                         indicatorClassName="bg-gradient-to-r from-purple-500 to-cyan-400" // Example gradient
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

      {/* General Error Display */}
      {errorMessage && !dbSetupError && (
        <Alert variant="destructive" className="mb-6">
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
          <Alert variant="default" className="mb-4 bg-yellow-900/20 border-yellow-700/50" key={key}>
            <Info className="h-4 w-4 text-yellow-500" />
            <AlertTitle className="text-yellow-300">Rate Limit Active for {key}</AlertTitle>
            <AlertDescription className="text-yellow-400">
              Please wait {remainingTime} seconds to perform this action again.
            </AlertDescription>
          </Alert>
        );
      })}


      {/* Main Content */}
      <main className="flex-grow grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 md:gap-8"> {/* Auto width for advisor */}

          {/* Left Column: Input and Output */}
          <div className="flex flex-col gap-6 md:gap-8">
              {/* Content Input */}
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
                        />
                       <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                           {/* Persona Selector */}
                          <div id="persona-selector" className="w-full sm:w-auto flex-grow sm:flex-grow-0">
                               <Label htmlFor="persona" className="text-xs font-medium text-muted-foreground mb-1 block">AI Persona</Label>
                               <Select
                                   value={selectedPersona}
                                   onValueChange={setSelectedPersona}
                                   disabled={loadingState.summarizing || !!loadingState.generating}
                                   aria-label="Select AI Persona"
                               >
                                  <SelectTrigger className="w-full sm:w-[200px] h-9 text-xs" id="persona">
                                     <SelectValue placeholder="Select Persona" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PERSONAS.map(persona => (
                                       <SelectItem key={persona.value} value={persona.value} textValue={persona.label} className="text-xs">
                                           {persona.label}
                                       </SelectItem>
                                    ))}
                                  </SelectContent>
                               </Select>
                          </div>
                           {/* Generate Button */}
                            <Tooltip content={getRateLimitTooltip('summarize') ?? getRateLimitTooltip('generate') ?? (isApiKeyMissing ? 'Please add your Gemini API Key in Profile Settings.' : (isQuotaExceeded ? 'Quota exceeded for this month.' : (!content.trim() ? 'Enter content or URL to generate posts.' : undefined)))}>
                              <TooltipTrigger asChild>
                                 <div className="w-full sm:w-auto"> {/* Wrapper div for tooltip on disabled button */}
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
                               {/* Tooltip content is now handled by the Tooltip component */}
                           </Tooltip>
                       </div>
                 </CardContent>
              </Card>

               {/* Output Section */}
              <Card className="shadow-md border-border/30 flex-grow flex flex-col"> {/* Use flex-grow and flex-col */}
                 <CardHeader>
                    <CardTitle>2. Generated Drafts</CardTitle>
                    <CardDescription>Review, tune, and copy the AI-generated posts for each platform.</CardDescription>
                 </CardHeader>
                  <CardContent className="flex-grow flex flex-col"> {/* Use flex-grow and flex-col */}
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
                               {/* Boost Panel Toggle */}
                               <Tooltip content="Hashtags & Emojis">
                                   <TooltipTrigger asChild>
                                       <Button variant="ghost" size="icon" onClick={handleToggleBoostPanel} className={cn("transition-colors", isBoostPanelOpen && "bg-accent")}>
                                           <Settings2 className="h-5 w-5"/>
                                           <span className="sr-only">Toggle Boost Panel</span>
                                       </Button>
                                   </TooltipTrigger>
                                   {/* Tooltip content is now handled by the Tooltip component */}
                               </Tooltip>
                            </div>
                            {PLATFORMS.map(platform => (
                              <TabsContent key={platform} value={platform} className="flex-grow mt-0"> {/* Remove mt-2, add flex-grow */}
                                  <div className="flex flex-col h-full gap-4">
                                     <div className="relative flex-grow"> {/* Wrapper for textarea and buttons */}
                                         <Textarea
                                             ref={outputTextareaRefs[platform]}
                                             value={generatedPosts[platform]}
                                             onChange={(e) => handleOutputChange(platform, e.target.value)}
                                             rows={8}
                                             className="text-base md:text-sm h-full resize-none pr-12" // Adjust padding for buttons, ensure full height
                                             disabled={!!loadingState.tuning[platform]} // Use platform-specific loading state
                                             placeholder={`Generated ${platform} post will appear here...`}
                                             aria-label={`${platform} Post Output`}
                                            />
                                         {/* Buttons inside the textarea wrapper */}
                                         <div className="absolute top-2 right-2 flex flex-col gap-1.5">
                                            {/* AI Advisor Button */}
                                              <Tooltip content={getRateLimitTooltip('analyze') ?? "AI Advisor"}>
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
                                                            {loadingState.analyzing === platform ? <Loader2 className="animate-spin h-4 w-4"/> : <Sparkles className="h-4 w-4 text-purple-400"/>}
                                                         </Button>
                                                 </TooltipTrigger>
                                                  {/* Tooltip content handled by Tooltip component */}
                                               </Tooltip>
                                            {/* Tone Tuner Button */}
                                             <Tooltip content="Tune Tone & Style">
                                                <TooltipTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openToneTuner(platform)} disabled={!generatedPosts[platform] || generatedPosts[platform].startsWith("Error:")}>
                                                        <Palette className="h-4 w-4 text-cyan-400" />
                                                    </Button>
                                                </TooltipTrigger>
                                                {/* Tooltip content handled by Tooltip component */}
                                             </Tooltip>
                                             {/* Copy Button */}
                                              <Tooltip content="Copy to Clipboard">
                                                 <TooltipTrigger asChild>
                                                     <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyToClipboard(platform)} disabled={!generatedPosts[platform] || generatedPosts[platform].startsWith("Error:")}>
                                                        <Copy className="h-4 w-4"/>
                                                     </Button>
                                                 </TooltipTrigger>
                                                  {/* Tooltip content handled by Tooltip component */}
                                               </Tooltip>
                                           </div>
                                       </div>
                                     {/* Tuning Buttons */}
                                     <div id={`tune-buttons-${platform}`} className="flex flex-wrap gap-2">
                                       {['Make Wittier', 'More Concise', 'Add Emojis', 'More Formal', 'Add Hashtags'].map(instr => (
                                           <Tooltip key={instr} content={getRateLimitTooltip('tune')}>
                                              <TooltipTrigger asChild>
                                               <div className="inline-block"> {/* Wrapper div */}
                                                  <Button
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() => handleTunePost(platform, instr)}
                                                      disabled={!!loadingState.tuning[platform] || !generatedPosts[platform] || generatedPosts[platform].startsWith("Error:") || !!rateLimitState.tune?.active}
                                                      loading={loadingState.tuning[platform] === instr} // Indicate loading for specific instruction
                                                       className="text-xs"
                                                   >
                                                       {/* Loading text is handled by the Button component's loading prop */}
                                                       {instr}
                                                   </Button>
                                                </div>
                                              </TooltipTrigger>
                                               {/* Tooltip content handled by Tooltip component */}
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
           </div> {/* End Left Column */}


           {/* Right Column: AI Advisor & Boost Panel */}
           <div className="relative flex flex-col gap-6 md:gap-8 lg:w-80 xl:w-96"> {/* Fixed width for side panels */}

               {/* Boost Panel */}
                <div className={cn("absolute top-0 right-0 h-full w-full transition-transform duration-300 ease-in-out", isBoostPanelOpen ? "translate-x-0" : "translate-x-full pointer-events-none")}>
                    <BoostPanel
                        isOpen={isBoostPanelOpen}
                        onToggle={handleToggleBoostPanel}
                        onInsertText={handleInsertText}
                       />
                </div>

              {/* AI Advisor Panel */}
              <div className={cn(
                  "absolute top-0 right-0 h-full w-full transition-transform duration-300 ease-in-out",
                  // Show Advisor if open AND Boost is closed
                  (isAiAdvisorOpen && !isBoostPanelOpen) ? "translate-x-0 z-10" : "translate-x-full pointer-events-none",
                  // Hide Advisor if Boost is open (even if advisor should be open)
                  isBoostPanelOpen && "translate-x-full pointer-events-none"
              )}>
                 <AiAdvisorPanel
                     isOpen={isAiAdvisorOpen}
                     isLoading={!!loadingState.analyzing}
                     analysis={advisorAnalysis}
                     onApplySuggestion={handleApplySuggestion}
                     onClose={() => setIsAiAdvisorOpen(false)}
                   />
              </div>

              {/* Placeholder/Background for the right column when panels are closed */}
               <div className={cn(
                 "w-full h-full bg-muted/20 rounded-lg border border-dashed border-border/30 flex items-center justify-center text-muted-foreground text-sm",
                  (isAiAdvisorOpen || isBoostPanelOpen) && "opacity-0 pointer-events-none" // Hide if any panel is open
              )}>
                 AI Advisor & Boost Tools appear here
               </div>

           </div>

      </main>

      {/* Footer */}
      <footer className="text-center mt-8 text-xs text-muted-foreground">
         Built with Next.js, Supabase, Genkit & ShadCN UI for the Gemini Hackathon.
      </footer>

      {/* Modals & Sheets */}
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
