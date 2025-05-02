
// components/dashboard/profile-dialog.tsx
'use client';

import type { User } from '@supabase/supabase-js';
import type { Profile, Quota, ComposioApp } from '@/types/supabase';
import { useState, useEffect, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Loader2, Save, ExternalLink, CreditCard, Database, Settings2, Wifi, WifiOff, CheckCircle, XCircle, Link as LinkIcon, Fuel, BadgeCheck } from 'lucide-react'; // Added Fuel and BadgeCheck
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { authenticateComposioApp } from '@/services/composio-service'; // Import the new service
import { toast as sonnerToast } from 'sonner'; // Import sonner toast for confetti effect
import Confetti from 'react-confetti';

interface ProfileDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user: User;
  initialProfile: Profile | null;
  initialQuota: Quota | null;
  initialXp: number; // Added initialXp
  initialBadges: string[]; // Added initialBadges
  onProfileUpdate: (profile: Profile) => void; // Callback to update parent state
  onXpUpdate: (xp: number, newBadge?: string) => void; // Callback for XP/Badge updates
  dbSetupError: string | null;
}

// Updated schema to use composio_mcp_url
const profileSchema = z.object({
  full_name: z.string().max(100, 'Full name too long').nullable().optional().or(z.literal('')),
  username: z.string().max(50, 'Username too long').nullable().optional().or(z.literal('')),
  phone_number: z.string().max(20, 'Phone number too long').nullable().optional().or(z.literal('')),
  composio_mcp_url: z.string().url('Invalid URL format').max(255, 'URL too long').nullable().optional().or(z.literal('')), // Use composio_mcp_url
  gemini_api_key: z.string().max(255, 'API Key too long').nullable().optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const DEFAULT_QUOTA_LIMIT = 100;
const XP_PER_REQUEST = 10; // XP awarded per successful request

// Badge thresholds and names
const BADGES = [
  { xp: 50, name: 'Vibe Starter ✨', description: 'Generated 5 posts!' },
  { xp: 100, name: 'Content Ninja 🥷', description: 'Generated 10 posts!' },
  { xp: 200, name: 'Social Samurai ⚔️', description: 'Generated 20 posts!' },
  { xp: 500, name: 'AI Maestro 🧑‍🔬', description: 'Mastered 50 generations!' },
];

export function ProfileDialog({
  isOpen,
  onOpenChange,
  user,
  initialProfile,
  initialQuota,
  initialXp, // Receive initial XP
  initialBadges, // Receive initial badges
  onProfileUpdate,
  onXpUpdate, // Receive XP update callback
  dbSetupError,
}: ProfileDialogProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [isSaving, startSavingTransition] = useTransition();
  const [isAuthenticating, setIsAuthenticating] = useState<Partial<Record<ComposioApp, boolean>>>({});
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [quota, setQuota] = useState<Quota | null>(initialQuota);
  const [xp, setXp] = useState(initialXp); // State for XP
  const [badges, setBadges] = useState<string[]>(initialBadges); // State for badges
  const [showConfetti, setShowConfetti] = useState(false);
  const [localDbSetupError, setLocalDbSetupError] = useState<string | null>(dbSetupError);

  // Ensure local state updates if initial props change
  useEffect(() => {
    setProfile(initialProfile);
    setQuota(initialQuota);
    setXp(initialXp);
    setBadges(initialBadges);
    setLocalDbSetupError(dbSetupError);
  }, [initialProfile, initialQuota, initialXp, initialBadges, dbSetupError]);

  // Fetch Quota inside dialog if initialQuota is null and no DB error
   useEffect(() => {
    if (isOpen && !quota && !localDbSetupError) {
      const fetchQuota = async () => {
        try {
          // Use RPC function first for consistency and potentially handle reset logic if needed
          const { data: remainingQuota, error: rpcError } = await supabase
             .rpc('get_remaining_quota', { p_user_id: user.id });

           if (rpcError) {
             console.error('Error calling get_remaining_quota RPC in dialog:', rpcError.message);
             let errorMsg = `Failed to load usage data: ${rpcError.message}`;
             if (rpcError.message.includes("function public.get_remaining_quota") && rpcError.message.includes("does not exist")) {
                 errorMsg = "Database setup incomplete: Missing 'get_remaining_quota' function. Please run the SQL script from `supabase/schema.sql`. See README Step 3.";
             } else if (rpcError.message.includes("permission denied")) {
                 errorMsg = "Database access error: Permission denied for 'get_remaining_quota'. Check RLS policies. See README Step 3.";
             }
             setLocalDbSetupError(errorMsg);
             toast({ title: 'Quota Error', description: errorMsg, variant: 'destructive' });
           } else {
              // RPC succeeded, now fetch the full quota details to display total used/limit
               const { data, error: selectError } = await supabase
                 .from('quotas')
                 .select('user_id, request_count, quota_limit, last_reset_at')
                 .eq('user_id', user.id)
                 .single();

               if (selectError && selectError.code === 'PGRST116') {
                 console.log("Quota record not found yet for user (dialog):", user.id);
                  // If RPC returned a remaining quota, but select found nothing, initialize a temporary local state
                   if (typeof remainingQuota === 'number') {
                       const limit = DEFAULT_QUOTA_LIMIT; // Assume default limit
                       const used = Math.max(0, limit - remainingQuota);
                       const nowISO = new Date().toISOString();
                       setQuota({
                           user_id: user.id,
                           request_count: used,
                           quota_limit: limit,
                           last_reset_at: nowISO, // Use current time as placeholder reset
                           created_at: nowISO, // Placeholder
                           ip_address: null // Placeholder
                       });
                       setLocalDbSetupError(null); // Clear error if RPC worked
                   } else {
                       // Both RPC failed/returned null and select failed
                       setLocalDbSetupError("Could not determine initial quota state.");
                       toast({ title: 'Quota Error', description: "Could not determine initial quota state.", variant: 'destructive' });
                   }
               } else if (selectError) {
                   console.error('Error fetching quota details after RPC in dialog:', selectError.message);
                   let errorMsg = `Failed to load full usage details: ${selectError.message}`;
                    if (selectError.message.includes("relation \"public.quotas\" does not exist")) {
                     errorMsg = "Database setup incomplete: Missing 'quotas' table. Please run the SQL script from `supabase/schema.sql`. See README Step 3.";
                   } else if (selectError.message.includes("permission denied")) {
                     errorMsg = "Database access error: Permission denied for 'quotas' table. Check RLS policies. See README Step 3.";
                   } else if (selectError.message.includes("406")) {
                       errorMsg = `Database configuration issue: Could not fetch quota details (Error 406). Check RLS/table access. Details: ${selectError.message}`;
                       toast({ title: "Quota Load Error", description: "Could not retrieve usage details (406).", variant: "destructive" });
                   }
                   setLocalDbSetupError(errorMsg);
                   toast({ title: 'Quota Error', description: errorMsg, variant: 'destructive' });
               } else if (data && 'user_id' in data && 'request_count' in data && 'quota_limit' in data && 'last_reset_at' in data) {
                   setQuota(data as Quota);
                   setLocalDbSetupError(null); // Clear error on successful fetch
               } else {
                   console.warn("Fetched quota data inside dialog is missing fields:", data);
                   const errorMsg = `Incomplete quota data received.`;
                   setLocalDbSetupError(errorMsg);
                   toast({ title: 'Quota Error', description: errorMsg, variant: 'destructive' });
               }
           }
        } catch (err: any) {
          console.error('Unexpected error fetching quota inside dialog:', err.message);
          const errorMsg = `Unexpected error loading usage data: ${err.message}`;
          setLocalDbSetupError(errorMsg);
          toast({ title: 'Quota Error', description: errorMsg, variant: 'destructive' });
        }
      };
      fetchQuota();
    }
  }, [isOpen, quota, localDbSetupError, supabase, user.id, toast]);


  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    // Use composio_mcp_url for default value
    defaultValues: {
      full_name: initialProfile?.full_name ?? '',
      username: initialProfile?.username ?? '',
      phone_number: initialProfile?.phone_number ?? '',
      composio_mcp_url: initialProfile?.composio_mcp_url ?? '',
      gemini_api_key: initialProfile?.gemini_api_key ?? '',
    },
  });

  // Reset form when profile changes or dialog opens/closes
  useEffect(() => {
    // Use composio_mcp_url for reset
    reset({
      full_name: profile?.full_name ?? '',
      username: profile?.username ?? '',
      phone_number: profile?.phone_number ?? '',
      composio_mcp_url: profile?.composio_mcp_url ?? '',
      gemini_api_key: profile?.gemini_api_key ?? '',
    });
  }, [profile, reset, isOpen]);

  const quotaUsed = quota?.request_count ?? 0;
  const quotaLimit = quota?.quota_limit ?? DEFAULT_QUOTA_LIMIT;
  const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
  const quotaPercentage = quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0;
  const quotaExceeded = quotaRemaining <= 0 && !!quota;

  const onSubmit = async (data: ProfileFormData) => {
    if (localDbSetupError) {
      toast({ title: "Database Error", description: "Cannot save profile due to a database setup issue.", variant: "destructive" });
      return;
    }
    const updateData = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, value === '' ? null : value])
    );

    startSavingTransition(async () => {
      try {
        const { data: updatedProfileData, error } = await supabase
          .from('profiles')
          .update({
            ...updateData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
          .select('id, updated_at, username, full_name, phone_number, composio_mcp_url, gemini_api_key, is_linkedin_authed, is_twitter_authed, is_youtube_authed') // Ensure all columns selected
          .single();

        if (error) {
          console.error('Error updating profile:', error.message);
          let errorMessage = `Could not save profile: ${error.message}`;
           // Check for specific schema cache error related to columns
          if (error.message.includes("Could not find the") && error.message.includes("column") && error.message.includes("in the schema cache")) {
              const missingColumnMatch = error.message.match(/'(.*?)'/);
              const missingColumn = missingColumnMatch ? missingColumnMatch[1] : 'unknown';
              errorMessage = `Database schema mismatch: Column '${missingColumn}' not found in 'profiles' table schema cache. Please run the full 'supabase/schema.sql' script again. See README Step 3.`;
              setLocalDbSetupError(errorMessage); // Set the DB error state
          } else if (error.message.includes("violates row-level security policy")) {
            errorMessage = 'Could not save profile due to database security policy.';
          } else if (error.message.includes("relation \"public.profiles\" does not exist")) {
            errorMessage = 'The `profiles` table is missing.';
            setLocalDbSetupError(errorMessage);
          } else if (error.message.includes("406")) {
            errorMessage = `Could not save profile due to a configuration issue (Error 406). Check table/column access. Details: ${error.message}`;
          }
          toast({ title: 'Save Failed', description: errorMessage, variant: 'destructive', duration: 7000 });
        } else if (updatedProfileData) {
          const completeProfile = updatedProfileData as Profile;
          setProfile(completeProfile);
          onProfileUpdate(completeProfile);
          toast({ title: 'Profile Saved', description: 'Your changes have been saved.' });
          reset(data); // Reset form to make isDirty false
          setLocalDbSetupError(null); // Clear DB error on successful save
        }
      } catch (error: any) {
        console.error('Unexpected error updating profile:', error);
        toast({ title: 'Save Failed', description: `Could not save profile: ${error.message}`, variant: 'destructive' });
      }
    });
  };

  const handleAuthenticateApp = async (appName: ComposioApp) => {
     if (!profile?.composio_mcp_url) {
      toast({ title: "MCP URL Required", description: "Please enter your Composio MCP URL first.", variant: "destructive" });
      return;
     }
      if (localDbSetupError) {
       toast({ title: "Database Error", description: "Cannot authenticate app due to a database setup issue.", variant: "destructive" });
       return;
     }

     setIsAuthenticating(prev => ({ ...prev, [appName]: true }));

     try {
        // Call the server action/API route to handle authentication
        const success = await authenticateComposioApp({ app: appName, mcpUrl: profile.composio_mcp_url });

        if (success) {
           // Update the profile state locally and in the database
           const updatedAuthStatus = { [`is_${appName}_authed`]: true };
           const { data: updatedProfileData, error: updateError } = await supabase
             .from('profiles')
             .update(updatedAuthStatus)
             .eq('id', user.id)
             .select('id, updated_at, username, full_name, phone_number, composio_mcp_url, gemini_api_key, is_linkedin_authed, is_twitter_authed, is_youtube_authed')
             .single();

           if (updateError) {
              // Check for schema cache error related to auth columns
              if (updateError.message.includes("Could not find the") && updateError.message.includes("column") && updateError.message.includes("in the schema cache")) {
                 const missingColumnMatch = updateError.message.match(/'(.*?)'/);
                 const missingColumn = missingColumnMatch ? missingColumnMatch[1] : 'unknown';
                 const authErrorMsg = `Database schema mismatch: Authentication column '${missingColumn}' not found for '${appName}'. Please run the full 'supabase/schema.sql' script again. See README Step 3.`;
                 setLocalDbSetupError(authErrorMsg);
                 throw new Error(authErrorMsg); // Throw to be caught below
              }
              throw updateError; // Throw other update errors
           }

           if(updatedProfileData){
              const completeProfile = updatedProfileData as Profile;
              setProfile(completeProfile); // Update local state
              onProfileUpdate(completeProfile); // Notify parent
              toast({ title: `${appName.charAt(0).toUpperCase() + appName.slice(1)} Authenticated`, description: `Successfully authenticated ${appName}.`, variant: "default" });
              setLocalDbSetupError(null); // Clear DB error on success
           }

        } else {
          // Service function likely threw an error handled below, or returned false
           toast({ title: "Authentication Failed", description: `Could not authenticate ${appName}. Check MCP URL and console logs.`, variant: "destructive" });
        }
     } catch (error: any) {
        console.error(`Error authenticating ${appName}:`, error);
         let errorMsg = `Failed to authenticate ${appName}: ${error.message}`;
         // Check if it's the specific DB setup error we set above
         if (localDbSetupError && error.message.includes('Authentication column')) {
             errorMsg = localDbSetupError; // Use the specific error message
         }
        toast({ title: "Authentication Error", description: errorMsg, variant: "destructive" });
        // Optionally update DB state to false if needed, though it should already be false
     } finally {
        setIsAuthenticating(prev => ({ ...prev, [appName]: false }));
     }
  };


  const handleUpgrade = () => {
    toast({ title: "Upgrade Feature", description: "Billing/Upgrade functionality is not yet implemented.", variant: "default" });
  };

  // Helper to get auth status based on app name
  const getAuthStatus = (appName: ComposioApp): boolean => {
     const key = `is_${appName}_authed` as keyof Profile;
     return profile?.[key] ?? false;
  }

   // Badge awarding logic
  useEffect(() => {
    if (!onXpUpdate) return; // Guard if callback not provided

    const currentRequests = quota?.request_count ?? 0;
    const currentXp = currentRequests * XP_PER_REQUEST;
    setXp(currentXp); // Update local XP state

    const newlyAwardedBadges: string[] = [];
    BADGES.forEach(badge => {
      if (currentXp >= badge.xp && !badges.includes(badge.name)) {
        newlyAwardedBadges.push(badge.name);
      }
    });

    if (newlyAwardedBadges.length > 0) {
      const newBadges = [...badges, ...newlyAwardedBadges];
      setBadges(newBadges);

      // Show confetti and toast for the *first* new badge awarded in this update
      const firstNewBadge = BADGES.find(b => b.name === newlyAwardedBadges[0]);
      if (firstNewBadge) {
         setShowConfetti(true);
         sonnerToast.success(`Badge Unlocked: ${firstNewBadge.name}!`, {
           description: firstNewBadge.description,
           duration: 5000,
           icon: <BadgeCheck className="text-green-500" />,
         });
         onXpUpdate(currentXp, firstNewBadge.name); // Notify parent of XP and the new badge
         setTimeout(() => setShowConfetti(false), 5000); // Confetti duration
      } else {
           onXpUpdate(currentXp); // Notify parent of XP change only
      }
    } else {
       onXpUpdate(currentXp); // Notify parent of XP change only
    }
  }, [quota?.request_count, badges, onXpUpdate]); // Depend on request_count


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
       {showConfetti && <Confetti recycle={false} numberOfPieces={200} />}
      <DialogContent className="sm:max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Profile & Settings</DialogTitle>
          <DialogDescription>
            Manage your profile details, API keys, app authentications, and usage quota.
          </DialogDescription>
        </DialogHeader>

        {localDbSetupError && (
          <Alert variant="destructive" className="mx-6 mt-[-10px] mb-4">
            <Database className="h-4 w-4" />
            <AlertTitle>Database Setup/Configuration Issue</AlertTitle>
            <AlertDescription>{localDbSetupError}</AlertDescription>
          </Alert>
        )}

        <ScrollArea className="overflow-y-auto px-6 -mx-6">
          <div className="grid gap-8 py-4">

            {/* Profile Form */}
            <form id="profile-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Settings2 className="h-5 w-5"/> User Information</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-1">
                    <Label htmlFor="email" className="sm:text-right sm:col-span-1">Email</Label>
                    <Input id="email" value={user.email ?? 'N/A'} readOnly disabled className="col-span-1 sm:col-span-2 bg-muted/50" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-1">
                    <Label htmlFor="full_name" className="sm:text-right sm:col-span-1 mt-2">Full Name</Label>
                    <div className="col-span-1 sm:col-span-2">
                      <Input id="full_name" {...register('full_name')} className={`${errors.full_name ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} />
                      {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name.message}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-1">
                    <Label htmlFor="username" className="sm:text-right sm:col-span-1 mt-2">Username</Label>
                    <div className="col-span-1 sm:col-span-2">
                      <Input id="username" {...register('username')} className={`${errors.username ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} />
                      {errors.username && <p className="text-xs text-destructive mt-1">{errors.username.message}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-1">
                    <Label htmlFor="phone_number" className="sm:text-right sm:col-span-1 mt-2">Phone</Label>
                    <div className="col-span-1 sm:col-span-2">
                      <Input id="phone_number" {...register('phone_number')} className={`${errors.phone_number ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} />
                      {errors.phone_number && <p className="text-xs text-destructive mt-1">{errors.phone_number.message}</p>}
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-2" />

              {/* Integrations Section */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><LinkIcon className="h-5 w-5"/> Integrations</h3>
                <div className="space-y-4">
                   {/* Gemini API Key */}
                   <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-1">
                     <Label htmlFor="gemini_api_key" className="sm:text-right sm:col-span-1 mt-2">
                       Gemini Key
                     </Label>
                     <div className="col-span-1 sm:col-span-2">
                       <Input
                         id="gemini_api_key"
                         type="password"
                         {...register('gemini_api_key')}
                         placeholder="Enter your Google Gemini API Key"
                         className={`${errors.gemini_api_key ? 'border-destructive' : ''}`}
                         disabled={!!localDbSetupError}
                       />
                       {errors.gemini_api_key && <p className="text-xs text-destructive mt-1">{errors.gemini_api_key.message}</p>}
                       <p className="text-xs text-muted-foreground mt-1">
                         Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Google AI Studio <ExternalLink className="inline h-3 w-3 ml-0.5"/></a>.
                       </p>
                     </div>
                   </div>

                   {/* Composio MCP URL */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-1">
                    {/* Use composio_mcp_url for htmlFor and register */}
                    <Label htmlFor="composio_mcp_url" className="sm:text-right sm:col-span-1 mt-2">Composio MCP URL</Label>
                    <div className="col-span-1 sm:col-span-2">
                      <Input
                        id="composio_mcp_url"
                        {...register('composio_mcp_url')}
                        placeholder="e.g., https://mcp.composio.dev/u/your-unique-id"
                        className={`${errors.composio_mcp_url ? 'border-destructive' : ''}`}
                        disabled={!!localDbSetupError}
                      />
                      {errors.composio_mcp_url && <p className="text-xs text-destructive mt-1">{errors.composio_mcp_url.message}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        Find this URL in your <a href="https://mcp.composio.dev" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Composio MCP dashboard <ExternalLink className="inline h-3 w-3 ml-0.5"/></a>. Needed for app authentication.
                      </p>
                    </div>
                  </div>

                   {/* App Authentication Buttons */}
                   <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-1">
                       <Label className="sm:text-right sm:col-span-1 mt-2">App Authentication</Label>
                       <div className="col-span-1 sm:col-span-2 space-y-3">
                          {(['linkedin', 'twitter', 'youtube'] as ComposioApp[]).map((app) => {
                             const isAuthenticated = getAuthStatus(app);
                             const isLoading = isAuthenticating[app] ?? false;
                             return (
                               <div key={app} className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-border/50">
                                 <div className="flex items-center gap-2">
                                    {isAuthenticated ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-destructive"/>}
                                    <span className="capitalize font-medium">{app}</span>
                                    <span className="text-xs text-muted-foreground">({isAuthenticated ? 'Authenticated' : 'Not Authenticated'})</span>
                                 </div>
                                 <Button
                                    type="button"
                                    variant={isAuthenticated ? "outline" : "default"}
                                    size="sm"
                                    onClick={() => handleAuthenticateApp(app)}
                                    disabled={isLoading || !profile?.composio_mcp_url || !!localDbSetupError}
                                    loading={isLoading}
                                  >
                                    {isAuthenticated ? <WifiOff className="mr-2 h-4 w-4" /> : <Wifi className="mr-2 h-4 w-4" />}
                                    {isAuthenticated ? 'Re-authenticate' : 'Authenticate'}
                                  </Button>
                               </div>
                             );
                          })}
                          <p className="text-xs text-muted-foreground mt-1">
                             Connect your social accounts via Composio to enable direct publishing.
                          </p>
                       </div>
                    </div>

                </div>
              </div>
            </form>

            <Separator className="my-2" />

            {/* Gamification Section */}
            <div>
               <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Fuel className="h-5 w-5"/> AI Fuel & Badges</h3>
               <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm mb-1">
                     <span>Experience Points (XP):</span>
                     <span className="font-medium">{xp.toLocaleString()} XP</span>
                  </div>
                   {/* Replace Progress with a stylized Fuel Tank */}
                   <div className="w-full h-4 bg-muted rounded-full overflow-hidden border border-border/50 relative">
                     <div
                       className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out"
                       style={{ width: `${Math.min(xp / (BADGES[BADGES.length-1]?.xp || 1000) * 100, 100)}%` }} // Width based on XP towards next/last badge
                     ></div>
                      <Fuel className="absolute left-1 top-1/2 transform -translate-y-1/2 h-3 w-3 text-white mix-blend-difference" />
                   </div>

                  <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">Unlocked Badges:</h4>
                      {badges.length > 0 ? (
                         <div className="flex flex-wrap gap-3">
                           {badges.map((badgeName) => {
                             const badgeInfo = BADGES.find(b => b.name === badgeName);
                             return (
                               <div key={badgeName} className="flex items-center gap-2 p-2 border border-green-500/30 bg-green-500/10 rounded-md text-xs">
                                 <BadgeCheck className="h-4 w-4 text-green-500" />
                                  <div>
                                    <span className="font-medium text-green-400">{badgeName}</span>
                                    {badgeInfo && <p className="text-muted-foreground text-[10px]">{badgeInfo.description}</p>}
                                  </div>
                               </div>
                             );
                           })}
                         </div>
                       ) : (
                         <p className="text-xs text-muted-foreground italic">Keep generating posts to unlock badges!</p>
                       )}
                    </div>

               </div>
            </div>

            <Separator className="my-2" />

            {/* Billing/Quota Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><CreditCard className="h-5 w-5"/> Usage & Billing</h3>
              {localDbSetupError && !localDbSetupError.includes('quota') ? (
                <Alert variant="destructive">
                  <Database className="h-4 w-4" />
                  <AlertTitle>Profile Data Issue</AlertTitle>
                  <AlertDescription>Cannot load usage data due to a profile or database setup issue.</AlertDescription>
                </Alert>
              ) : quota !== null ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span>Monthly Requests Used:</span>
                    <span className="font-medium">{quotaUsed} / {quotaLimit}</span>
                  </div>
                  <Progress value={quotaPercentage} className="w-full h-2" />
                  {quotaExceeded && (
                    <Alert variant="destructive" className="mt-4">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Quota Limit Reached</AlertTitle>
                      <AlertDescription>Upgrade to continue generating posts.</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleUpgrade} size="sm">
                      <CreditCard className="mr-2 h-4 w-4" /> Upgrade Plan (Coming Soon)
                    </Button>
                  </div>
                  {quota.last_reset_at && (
                    <p className="text-xs text-muted-foreground text-center pt-2">
                      Quota resets on: {new Date(new Date(quota.last_reset_at).setMonth(new Date(quota.last_reset_at).getMonth() + 1)).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center text-muted-foreground py-4">
                  {localDbSetupError && localDbSetupError.includes('quota') ? (
                    <span className='text-destructive text-sm flex items-center gap-2'><Database className="h-4 w-4" /> Error loading quota.</span>
                  ) : (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading usage data...
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t border-border/50 px-6 pb-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            type="submit"
            form="profile-form"
            disabled={isSaving || !isDirty || !!localDbSetupError}
            loading={isSaving}
          >
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
