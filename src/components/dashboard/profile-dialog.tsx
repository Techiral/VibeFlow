// components/dashboard/profile-dialog.tsx
'use client';

import type { User } from '@supabase/supabase-js';
import type { Profile, Quota, ComposioApp } from '@/types/supabase';
import { useState, useEffect, useTransition, useCallback } from 'react'; // Added useCallback
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
import { Info, Loader2, Save, ExternalLink, CreditCard, Database, Settings2, Wifi, WifiOff, CheckCircle, XCircle, Link as LinkIcon, Fuel, BadgeCheck, Star, Trophy, Zap, BrainCircuit } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast as sonnerToast } from 'sonner';
import Confetti from 'react-confetti';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { startComposioLogin, handleAuthenticateApp } from '@/services/composio-service'; // Import the service functions


interface ProfileDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user: User;
  initialProfile: Profile | null;
  initialQuota: Quota | null;
  onProfileUpdate: (profile: Profile) => void;
  initialXp: number;
  initialBadges: string[];
  dbSetupError: string | null;
}

// Schema updated to include composio_api_key
const profileSchema = z.object({
  full_name: z.string().max(100, 'Full name must be 100 characters or less').nullable().optional().or(z.literal('')),
  username: z.string().max(50, 'Username must be 50 characters or less').nullable().optional().or(z.literal('')),
  phone_number: z.string().max(20, 'Phone number must be 20 characters or less').nullable().optional().or(z.literal('')),
  composio_mcp_url: z.string().url('Invalid MCP URL format (e.g., https://...)').max(255, 'URL too long').nullable().optional().or(z.literal('')),
  linkedin_url: z.string().url('Invalid LinkedIn URL format (e.g., https://...)').max(255, 'URL too long').nullable().optional().or(z.literal('')),
  twitter_url: z.string().url('Invalid Twitter URL format (e.g., https://...)').max(255, 'URL too long').nullable().optional().or(z.literal('')),
  youtube_url: z.string().url('Invalid YouTube URL format (e.g., https://...)').max(255, 'URL too long').nullable().optional().or(z.literal('')),
  gemini_api_key: z.string().max(255, 'API Key must be 255 characters or less').nullable().optional().or(z.literal('')),
  composio_api_key: z.string().max(255, 'Composio API Key must be 255 characters or less').nullable().optional().or(z.literal('')) // Added
});


type ProfileFormData = z.infer<typeof profileSchema>;

const DEFAULT_QUOTA_LIMIT = 100;
const XP_PER_REQUEST = 10;

const BADGES = [
  { xp: 50, name: 'Vibe Starter ✨', description: 'Generated 5 posts!', icon: Star },
  { xp: 100, name: 'Content Ninja 🥷', description: 'Generated 10 posts!', icon: Trophy },
  { xp: 200, name: 'Social Samurai ⚔️', description: 'Generated 20 posts!', icon: Zap },
  { xp: 500, name: 'AI Maestro 🧑‍🔬', description: 'Mastered 50 generations!', icon: BrainCircuit },
];

export function ProfileDialog({
  isOpen,
  onOpenChange,
  user,
  initialProfile,
  initialQuota,
  onProfileUpdate,
  initialXp,
  initialBadges,
  dbSetupError,
}: ProfileDialogProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [isSaving, startSavingTransition] = useTransition();
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [quota, setQuota] = useState<Quota | null>(initialQuota);
  const xp = initialXp ?? 0;
  const badges = initialBadges ?? [];
  const [localDbSetupError, setLocalDbSetupError] = useState<string | null>(dbSetupError);
  const [isComposioAuthenticating, setIsComposioAuthenticating] = useState<Partial<Record<ComposioApp, boolean>>>({});

  // State for Composio API key handling
  const [composioStatus, setComposioStatus] = useState({
    loading: false,
    success: !!initialProfile?.composio_api_key, // Assume success if key exists initially
    errorMessage: null as string | null,
    apiKey: initialProfile?.composio_api_key || null as string | null,
  });


  useEffect(() => {
    setProfile(initialProfile);
    setQuota(initialQuota);
    setLocalDbSetupError(dbSetupError);
    setComposioStatus(prev => ({
        ...prev,
        success: !!initialProfile?.composio_api_key,
        apiKey: initialProfile?.composio_api_key || null
    }));
  }, [initialProfile, initialQuota, dbSetupError]);


  useEffect(() => {
    if (isOpen && !quota && !localDbSetupError) {
      const fetchQuota = async () => {
        try {
          const { data: remainingQuota, error: rpcError } = await supabase
             .rpc('get_remaining_quota', { p_user_id: user.id });

           if (rpcError) {
             console.error('Error calling get_remaining_quota RPC in dialog:', rpcError.message);
             let errorMsg = `Failed to load usage data: ${rpcError.message}`;
             if (rpcError.message.includes("function public.get_remaining_quota") && rpcError.message.includes("does not exist")) {
                 errorMsg = "Database setup incomplete: Missing 'get_remaining_quota' function. Please run the SQL script from `supabase/schema.sql`. See README Step 3.";
             } else if (rpcError.message.includes("permission denied")) {
                 errorMsg = "Database access error: Permission denied for 'get_remaining_quota'. Check RLS policies. See README Step 3.";
             } else if (rpcError.message.includes("relation \"public.quotas\" does not exist")) {
                 errorMsg = "Database setup incomplete: Missing 'quotas' table. Run setup script.";
             }
             setLocalDbSetupError(errorMsg);
             toast({ title: 'Quota Error', description: errorMsg, variant: 'destructive' });
           } else {
               const { data, error: selectError } = await supabase
                 .from('quotas')
                 .select('user_id, request_count, quota_limit, last_reset_at')
                 .eq('user_id', user.id)
                 .maybeSingle();

               if (selectError && selectError.code !== 'PGRST116') {
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
                   setLocalDbSetupError(null);
               } else if (!data && typeof remainingQuota === 'number') {
                  console.log("Quota record not found yet for user (dialog):", user.id);
                  const limit = DEFAULT_QUOTA_LIMIT;
                  const used = Math.max(0, limit - remainingQuota);
                  const nowISO = new Date().toISOString();
                  setQuota({
                      user_id: user.id,
                      request_count: used,
                      quota_limit: limit,
                      last_reset_at: nowISO,
                      created_at: nowISO, // Placeholder
                      ip_address: null // Placeholder
                  });
                  setLocalDbSetupError(null);
               } else if (!data && typeof remainingQuota !== 'number'){
                   const errorMsg = "Could not determine initial quota state.";
                   setLocalDbSetupError(errorMsg);
                   toast({ title: 'Quota Error', description: errorMsg, variant: 'destructive' });
               } else if (data && !('request_count' in data)) {
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
    setValue, // Added setValue from react-hook-form
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: initialProfile?.full_name ?? '',
      username: initialProfile?.username ?? '',
      phone_number: initialProfile?.phone_number ?? '',
      composio_mcp_url: initialProfile?.composio_mcp_url ?? '',
      linkedin_url: initialProfile?.linkedin_url ?? '',
      twitter_url: initialProfile?.twitter_url ?? '',
      youtube_url: initialProfile?.youtube_url ?? '', // Corrected reference
      gemini_api_key: initialProfile?.gemini_api_key ?? '',
      composio_api_key: initialProfile?.composio_api_key ?? '', // Added default
    },
  });

  // Update form values when profile or composioStatus.apiKey changes
  useEffect(() => {
    reset({
      full_name: profile?.full_name ?? '',
      username: profile?.username ?? '',
      phone_number: profile?.phone_number ?? '',
      composio_mcp_url: profile?.composio_mcp_url ?? '',
      linkedin_url: profile?.linkedin_url ?? '',
      twitter_url: profile?.twitter_url ?? '',
      youtube_url: profile?.youtube_url ?? '',
      gemini_api_key: profile?.gemini_api_key ?? '',
      composio_api_key: composioStatus.apiKey ?? profile?.composio_api_key ?? '', // Use composioStatus first
    });
  }, [profile, composioStatus.apiKey, reset, isOpen]);

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
    // Include composio_api_key from state if it exists
    const updateData = {
      ...Object.fromEntries(
        Object.entries(data).filter(([key, value]) => value !== null && value !== '' && key !== 'composio_api_key') // Exclude key from form data initially
      ),
      ...(composioStatus.apiKey ? { composio_api_key: composioStatus.apiKey } : {}), // Add key from state
    };


    startSavingTransition(async () => {
      try {
        const { data: updatedProfileData, error } = await supabase
          .from('profiles')
          .update({
            ...updateData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
          .select('*, xp, badges')
          .single();

        if (error) {
          console.error('Error updating profile:', error.message);
          let errorMessage = `Could not save profile: ${error.message}`;
          if (error.message.includes("Could not find the") && error.message.includes("column") && error.message.includes("in the schema cache")) {
              const missingColumnMatch = error.message.match(/'(.*?)'/);
              const missingColumn = missingColumnMatch ? missingColumnMatch[1] : 'unknown';
              errorMessage = `Database schema mismatch: Column '${missingColumn}' not found. Run the latest 'supabase/schema.sql'. See README Step 3.`;
              setLocalDbSetupError(errorMessage);
          } else if (error.message.includes("violates row-level security policy")) {
            errorMessage = 'Could not save profile due to database security policy.';
          } else if (error.message.includes("relation \"public.profiles\" does not exist")) {
            errorMessage = 'The `profiles` table is missing. Run the setup script.';
            setLocalDbSetupError(errorMessage);
          } else if (error.message.includes("406")) {
            errorMessage = `Could not save profile (Error 406). Check table/column access. Details: ${error.message}`;
          }
          toast({ title: 'Save Failed', description: errorMessage, variant: 'destructive', duration: 7000 });
        } else if (updatedProfileData) {
          const completeProfile = updatedProfileData as Profile;
          setProfile(completeProfile);
          onProfileUpdate(completeProfile);
          toast({ title: 'Profile Saved', description: 'Your changes have been saved.' });
          // Reset form with updated data including the API key from state
          reset({...data, composio_api_key: composioStatus.apiKey ?? ''});
          setLocalDbSetupError(null);
        }
      } catch (error: any) {
        console.error('Unexpected error updating profile:', error);
        toast({ title: 'Save Failed', description: `Could not save profile: ${error.message}`, variant: 'destructive' });
      }
    });
  };


  // New function to handle Composio API key generation
  const handleGetComposioKey = useCallback(async () => {
    setComposioStatus({ loading: true, success: false, errorMessage: null, apiKey: null });
    try {
       const result = await startComposioLogin(); // Call the service function

       if (result.success && result.key) {
           setComposioStatus({loading: false, success: true, errorMessage: null, apiKey: result.key});
           setValue('composio_api_key', result.key, { shouldDirty: true }); // Update form value
           toast({ title: "Composio API Key Retrieved", description: "API Key retrieved successfully. Remember to save changes." });
       } else {
           setComposioStatus({loading: false, success: false, errorMessage: result.error || "Failed to retrieve Composio API Key.", apiKey: null});
           toast({ title: "Composio Key Error", description: result.error || "Could not retrieve Composio API Key.", variant: "destructive" });
       }

    } catch (error:any) {
      console.error("Composio Login Error:", error);
      setComposioStatus({ loading: false, success: false, errorMessage: error.message || 'Unknown error', apiKey: null });
      toast({ title: "Composio Connection Error", description: error.message || "Could not connect to Composio.", variant: "destructive" });
    }
  }, [toast, setValue]);

  const handleAuthenticateComposio = useCallback(async (appName: ComposioApp) => {
    console.log(`Initiating app authentication for ${appName}...`);
    if (!profile?.composio_api_key) {
       toast({ title: "Composio Key Required", description: "Please generate and save your Composio API Key first.", variant: "destructive" });
       return;
    }
    if (localDbSetupError) {
       toast({ title: "Database Error", description: "Cannot authenticate app due to a database setup issue.", variant: "destructive" });
       return;
    }

    setIsComposioAuthenticating(prev => ({...prev, [appName]: true}));

    try {
        const result = await handleAuthenticateApp(appName, user.id, profile.composio_api_key);

        if (result.success && result.authUrl) {
             // Redirect user to the auth URL returned by the service
             window.location.href = result.authUrl;
        } else {
             toast({ title: `${appName} Auth Failed`, description: result.error || `Could not initiate authentication for ${appName}.`, variant: "destructive" });
        }
    } catch (error: any) {
        console.error(`Error authenticating ${appName}:`, error);
        toast({ title: `${appName} Auth Error`, description: error.message || 'Unknown error during authentication.', variant: 'destructive' });
    } finally {
         setIsComposioAuthenticating(prev => ({...prev, [appName]: false}));
    }
  }, [profile?.composio_api_key, user.id, toast, localDbSetupError]);


  const handleUpgrade = () => {
    toast({ title: "Upgrade Feature", description: "Billing/Upgrade functionality is not yet implemented.", variant: "default" });
  };

  const getAuthStatus = (appName: ComposioApp): boolean => {
     const key = `is_${appName}_authed` as keyof Profile;
     return !!profile?.[key];
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] max-h-[90vh]">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Profile & Settings</DialogTitle>
          <DialogDescription>
            Manage your profile, API keys, app connections, and usage.
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
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Settings2 className="h-5 w-5"/> User Information</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-2">
                    <Label htmlFor="email" className="sm:text-right sm:col-span-1">Email</Label>
                    <Input id="email" value={user.email ?? 'N/A'} readOnly disabled className="col-span-1 sm:col-span-2 bg-muted/50" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                    <Label htmlFor="full_name" className="sm:text-right sm:col-span-1 mt-1">Full Name</Label>
                    <div className="col-span-1 sm:col-span-2">
                      <Input id="full_name" {...register('full_name')} className={`${errors.full_name ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} />
                      {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name.message}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                    <Label htmlFor="username" className="sm:text-right sm:col-span-1 mt-1">Username</Label>
                    <div className="col-span-1 sm:col-span-2">
                      <Input id="username" {...register('username')} className={`${errors.username ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} />
                      {errors.username && <p className="text-xs text-destructive mt-1">{errors.username.message}</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                    <Label htmlFor="phone_number" className="sm:text-right sm:col-span-1 mt-1">Phone</Label>
                    <div className="col-span-1 sm:col-span-2">
                      <Input id="phone_number" {...register('phone_number')} className={`${errors.phone_number ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} />
                      {errors.phone_number && <p className="text-xs text-destructive mt-1">{errors.phone_number.message}</p>}
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Integrations Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><LinkIcon className="h-5 w-5"/> Integrations</h3>
                <div className="space-y-4">
                   {/* Gemini API Key */}
                   <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                     <Label htmlFor="gemini_api_key" className="sm:text-right sm:col-span-1 mt-1">
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
                         Get key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Google AI Studio <ExternalLink className="inline h-3 w-3 ml-0.5"/></a>. Required for generation.
                       </p>
                     </div>
                   </div>

                   {/* Composio API Key - New Field */}
                   <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                     <Label htmlFor="composio_api_key_display" className="sm:text-right sm:col-span-1 mt-1">
                       Composio API Key
                     </Label>
                     <div className="col-span-1 sm:col-span-2">
                       <Input
                         id="composio_api_key_display"
                         type="password"
                         placeholder={composioStatus.loading ? "Generating key..." : "Click 'Get Composio Key'"}
                         className={`${errors.composio_api_key ? 'border-destructive' : ''}`}
                         disabled={true} // Always disabled, value comes from state
                         value={composioStatus.apiKey || ''}
                       />
                       {/* Hidden input registered with react-hook-form */}
                       <input type="hidden" {...register('composio_api_key')} value={composioStatus.apiKey || ''} />
                       {errors.composio_api_key && <p className="text-xs text-destructive mt-1">{errors.composio_api_key.message}</p>}
                        <Button
                           type="button" // Ensure it doesn't submit the form
                           size="sm"
                           variant="outline"
                           onClick={handleGetComposioKey}
                           disabled={composioStatus.loading || !!localDbSetupError}
                           loading={composioStatus.loading}
                           className="mt-2"
                       >
                           {composioStatus.loading ? "Connecting..." : composioStatus.apiKey ? "Regenerate Key" : "Get Composio Key"}
                       </Button>
                      {composioStatus.errorMessage && <p className="text-xs text-destructive mt-1">{composioStatus.errorMessage}</p>}
                       <p className="text-xs text-muted-foreground mt-1">
                        Connect to Composio to generate an API Key. Required for app authentication.
                       </p>
                     </div>
                   </div>

                   {/* Composio MCP URL - No longer strictly needed for API key method */}
                   {/*
                    <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                        <Label htmlFor="composio_mcp_url" className="sm:text-right sm:col-span-1 mt-1">Composio MCP URL</Label>
                        <div className="col-span-1 sm:col-span-2">
                        <Input
                            id="composio_mcp_url"
                            {...register('composio_mcp_url')}
                            placeholder="e.g., https://mcp.composio.dev/u/your-id"
                            className={`${errors.composio_mcp_url ? 'border-destructive' : ''}`}
                            disabled={!!localDbSetupError}
                        />
                        {errors.composio_mcp_url && <p className="text-xs text-destructive mt-1">{errors.composio_mcp_url.message}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                            Find in your <a href="https://mcp.composio.dev" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Composio MCP dashboard <ExternalLink className="inline h-3 w-3 ml-0.5"/></a>. (Optional if using API Key)
                        </p>
                        </div>
                    </div>
                   */}


                   {/* App Authentication Buttons */}
                   <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                       <Label className="sm:text-right sm:col-span-1 mt-2">App Authentication</Label>
                       <div className="col-span-1 sm:col-span-2 space-y-3">
                          {(['linkedin', 'twitter', 'youtube'] as ComposioApp[]).map((app) => {
                             const isAuthenticated = getAuthStatus(app);
                             // Disable if Composio API key is missing or DB error
                             const isDisabled = !profile?.composio_api_key || !!localDbSetupError || isComposioAuthenticating[app];
                             const tooltipText = !profile?.composio_api_key ? "Generate Composio API Key first" :
                                                localDbSetupError ? "Cannot authenticate due to DB error" :
                                                isAuthenticated ? `Re-authenticate ${app}` : `Authenticate ${app}`;

                             return (
                               <div key={app} className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-border/50">
                                 <div className="flex items-center gap-2">
                                    {isAuthenticated ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-muted-foreground"/>}
                                    <span className="capitalize font-medium">{app}</span>
                                    <span className="text-xs text-muted-foreground">({isAuthenticated ? 'Authenticated' : 'Not Authenticated'})</span>
                                 </div>
                                 <TooltipProvider>
                                   <Tooltip>
                                     <TooltipTrigger asChild>
                                        <Button
                                          type="button"
                                          variant={isAuthenticated ? "outline" : "default"}
                                          size="sm"
                                          onClick={() => handleAuthenticateComposio(app)}
                                          disabled={isDisabled}
                                          loading={isComposioAuthenticating[app]}
                                        >
                                          {isComposioAuthenticating[app] ? "Processing..." : isAuthenticated ? <WifiOff className="mr-2 h-4 w-4" /> : <Wifi className="mr-2 h-4 w-4 />}
                                          {isComposioAuthenticating[app] ? "" : isAuthenticated ? 'Re-authenticate' : 'Authenticate'}
                                        </Button>
                                     </TooltipTrigger>
                                     <TooltipContent side="top">
                                       <p>{tooltipText}</p>
                                     </TooltipContent>
                                   </Tooltip>
                                 </TooltipProvider>
                               </div>
                             );
                          })}
                          <p className="text-xs text-muted-foreground mt-1">
                             Connect accounts via Composio to enable direct publishing. You will be redirected.
                          </p>
                       </div>
                    </div>

                    {/* LinkedIn/Twitter/YouTube URLs - Keep these as they might be useful */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                        <Label htmlFor="linkedin_url" className="sm:text-right sm:col-span-1 mt-1">LinkedIn URL</Label>
                         <div className="col-span-1 sm:col-span-2">
                            <Input id="linkedin_url" {...register('linkedin_url')} className={`${errors.linkedin_url ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} />
                            {errors.linkedin_url && <p className="text-xs text-destructive mt-1">{errors.linkedin_url.message}</p>}
                         </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                        <Label htmlFor="twitter_url" className="sm:text-right sm:col-span-1 mt-1">Twitter URL</Label>
                         <div className="col-span-1 sm:col-span-2">
                            <Input id="twitter_url" {...register('twitter_url')} className={`${errors.twitter_url ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} />
                            {errors.twitter_url && <p className="text-xs text-destructive mt-1">{errors.twitter_url.message}</p>}
                         </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                        <Label htmlFor="youtube_url" className="sm:text-right sm:col-span-1 mt-1">YouTube URL</Label>
                         <div className="col-span-1 sm:col-span-2">
                           <Input id="youtube_url" {...register('youtube_url')} className={`${errors.youtube_url ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} />
                           {errors.youtube_url && <p className="text-xs text-destructive mt-1">{errors.youtube_url.message}</p>}
                         </div>
                    </div>

                </div>
              </div>
            </form>

            <Separator />

            {/* Gamification Section */}
            <div>
               <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Fuel className="h-5 w-5"/> AI Fuel & Badges</h3>
               <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm mb-1">
                     <span>Experience Points (XP):</span>
                     <span className="font-medium">{xp?.toLocaleString() ?? 0} XP</span>
                  </div>
                   <TooltipProvider>
                    <Tooltip>
                       <TooltipTrigger asChild>
                           <div className="w-full h-4 bg-muted rounded-full overflow-hidden border border-border/50 relative cursor-help">
                             <div
                               className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500 ease-out"
                               style={{ width: `${Math.min((xp ?? 0) / (BADGES[BADGES.length - 1]?.xp || 1000) * 100, 100)}%` }}
                             ></div>
                             <Fuel className="absolute left-1 top-1/2 transform -translate-y-1/2 h-3 w-3 text-white mix-blend-difference" />
                           </div>
                       </TooltipTrigger>
                       <TooltipContent>
                         <p>Earn {XP_PER_REQUEST} XP for each successful AI generation or tuning!</p>
                       </TooltipContent>
                    </Tooltip>
                   </TooltipProvider>

                  <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">Unlocked Badges:</h4>
                      {badges && badges.length > 0 ? (
                         <div className="flex flex-wrap gap-3">
                           {badges.map((badgeName) => {
                             const badgeInfo = BADGES.find(b => b.name === badgeName);
                             const Icon = badgeInfo?.icon || BadgeCheck;
                             return (
                               <TooltipProvider key={badgeName}>
                                <Tooltip>
                                   <TooltipTrigger asChild>
                                        <div className="flex items-center gap-2 p-2 border border-green-500/30 bg-green-500/10 rounded-md text-xs cursor-default">
                                           <Icon className="h-4 w-4 text-green-500" />
                                            <span className="font-medium text-green-400">{badgeName}</span>
                                        </div>
                                   </TooltipTrigger>
                                    {badgeInfo && (
                                       <TooltipContent>
                                         <p>{badgeInfo.description}</p>
                                       </TooltipContent>
                                    )}
                                </Tooltip>
                               </TooltipProvider>
                             );
                           })}
                         </div>
                       ) : (
                         <p className="text-xs text-muted-foreground italic">Keep generating posts to unlock badges!</p>
                       )}
                    </div>
               </div>
            </div>

            <Separator />

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
                      <CreditCard className="mr-2 h-4 w-4" /> Upgrade Plan (Soon)
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
