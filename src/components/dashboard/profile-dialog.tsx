'use client';

import type { User } from '@supabase/supabase-js';
import type { ComposioApp, Database, Profile, Quota } from '@/types/supabase';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Loader2, Save, ExternalLink, CreditCard, Database, Settings2, Wifi, WifiOff, CheckCircle, XCircle, Link as LinkIcon, Fuel, BadgeCheck, Star, Trophy, Zap, BrainCircuit, Key } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { handleDeauthenticateApp } from '@/services/composio-service';
import { startComposioLogin } from '@/actions/composio-actions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { OpenAIToolSet, App as ComposioAppEnum } from "composio-core";
import { OpenAI } from "openai";
import { toast as sonnerToast } from 'sonner';
import Confetti from 'react-confetti';


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

const profileSchema = z.object({
  full_name: z.string().max(100, 'Full name must be 100 characters or less').nullable().optional().or(z.literal('')),
  username: z.string().max(50, 'Username must be 50 characters or less').nullable().optional().or(z.literal('')),
  phone_number: z.string().max(20, 'Phone number must be 20 characters or less').nullable().optional().or(z.literal('')),
  composio_mcp_url: z.string().url('Invalid MCP URL format (e.g., https://...)').max(255, 'URL too long').nullable().optional().or(z.literal('')),
  linkedin_url: z.string().url('Invalid LinkedIn URL format (e.g., https://...)').max(255, 'URL too long').nullable().optional().or(z.literal('')),
  twitter_url: z.string().url('Invalid Twitter URL format (e.g., https://...)').max(255, 'URL too long').nullable().optional().or(z.literal('')),
  youtube_url: z.string().url('Invalid YouTube URL format (e.g., https://...)').max(255, 'URL too long').nullable().optional().or(z.literal('')),
  gemini_api_key: z.string().max(255, 'API Key must be 255 characters or less').nullable().optional().or(z.literal('')),
  composio_api_key: z.string().max(255, 'Composio API Key must be 255 characters or less').nullable().optional().or(z.literal('')),
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

// Rest of the ProfileDialog component
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
  const [xp, setXp] = useState<number>(initialXp);
  const [badges, setBadges] = useState<string[]>(initialBadges ?? []);
  const [localDbSetupError, setLocalDbSetupError] = useState<string | null>(dbSetupError);
  const [isComposioAuthenticating, setIsComposioAuthenticating] = useState<Partial<Record<ComposioApp, boolean>>>({});
  const [composioStatus, setComposioStatus] = useState<{ loading: boolean; success: boolean; errorMessage: string | null; apiKey: string | null | undefined }>({
        loading: false,
        success: !!initialProfile?.composio_api_key, // Set initial success based on key presence
        errorMessage: null,
        apiKey: initialProfile?.composio_api_key ?? null, // Initialize with profile key if exists
  });


  useEffect(() => {
    setProfile(initialProfile);
    setQuota(initialQuota);
    setXp(initialXp);
    setBadges(initialBadges ?? []);
    setLocalDbSetupError(dbSetupError);
     // Update status based on initial profile
    setComposioStatus(prev => ({
        ...prev,
        success: !!initialProfile?.composio_api_key,
        apiKey: initialProfile?.composio_api_key ?? null
    }));
  }, [initialProfile, initialQuota, dbSetupError, initialXp, initialBadges]);

   const {
    register,
    handleSubmit,
    reset,
    setValue, // Add setValue from useForm
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      username: profile?.username ?? '',
      phone_number: profile?.phone_number ?? '',
      composio_mcp_url: profile?.composio_mcp_url ?? '',
      linkedin_url: profile?.linkedin_url ?? '',
      twitter_url: profile?.twitter_url ?? '',
      youtube_url: profile?.youtube_url ?? '',
      gemini_api_key: profile?.gemini_api_key ?? '',
      composio_api_key: composioStatus.apiKey ?? '', // Use state value here
    },
  });

   // Effect to update form when profile state changes externally or internally
  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name ?? '',
        username: profile.username ?? '',
        phone_number: profile.phone_number ?? '',
        composio_mcp_url: profile.composio_mcp_url ?? '',
        linkedin_url: profile.linkedin_url ?? '',
        twitter_url: profile.twitter_url ?? '',
        youtube_url: profile.youtube_url ?? '',
        gemini_api_key: profile.gemini_api_key ?? '',
        composio_api_key: composioStatus.apiKey ?? '', // Use state value here
      });
    }
     // Ensure composio_api_key field is updated when composioStatus.apiKey changes
     setValue('composio_api_key', composioStatus.apiKey ?? '');

  }, [profile, reset, composioStatus.apiKey, setValue]); // Add composioStatus.apiKey and setValue as dependencies

  // Effect to fetch quota if needed
  useEffect(() => {
    if (isOpen && !quota && !localDbSetupError) {
      const fetchQuota = async () => {
         try {
           // Use RPC function to get remaining quota (handles reset logic)
           const { data: remainingQuota, error: rpcError } = await supabase
              .rpc('get_remaining_quota', { p_user_id: user.id });

            if (rpcError) {
              console.error('Error calling get_remaining_quota RPC in dialog:', rpcError.message);
              let errorMsg = `Failed to load usage data: ${rpcError.message}`;
              if (rpcError.message.includes("function public.get_remaining_quota") && rpcError.message.includes("does not exist")) {
                  errorMsg = "Database setup incomplete: Missing 'get_remaining_quota' function. Run setup script.";
              } else if (rpcError.message.includes("relation \"public.quotas\" does not exist")) {
                  errorMsg = "Database setup incomplete: Missing 'quotas' table. Run setup script.";
              } else if (rpcError.message.includes("permission denied")) {
                  errorMsg = "Database access error: Permission denied for 'get_remaining_quota'. Check RLS/function security.";
              }
              setLocalDbSetupError(errorMsg);
              toast({ title: 'Quota Error', description: errorMsg, variant: 'destructive' });
            } else {
                const { data, error: selectError } = await supabase
                  .from('quotas')
                  .select('user_id, request_count, quota_limit, last_reset_at')
                  .eq('user_id', user.id)
                  .maybeSingle();

                if (selectError && selectError.code !== 'PGRST116') { // Handle errors other than "No rows found"
                    console.error('Error fetching quota details after RPC in dialog:', selectError.message);
                    let errorMsg = `Failed to load full usage details: ${selectError.message}`;
                     if (selectError.message.includes("relation \"public.quotas\" does not exist")) {
                      errorMsg = "Database setup incomplete: Missing 'quotas' table. Run setup script.";
                    } else if (selectError.message.includes("permission denied")) {
                      errorMsg = "Database access error: Permission denied for 'quotas' table. Check RLS.";
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


  const onSubmit = async (data: ProfileFormData) => {
    if (localDbSetupError) {
      toast({ title: "Database Error", description: "Cannot save profile due to a database setup issue.", variant: "destructive" });
      return;
    }
    // Directly use the form data, which now includes composio_api_key
    const updateData = {
        ...Object.fromEntries(
            Object.entries(data).filter(([key, value]) => value !== null && value !== '')
        ),
        updated_at: new Date().toISOString(),
    };

    // Handle case where API key might be explicitly removed (set to null or empty string)
    if (!data.composio_api_key && profile?.composio_api_key) {
        updateData.composio_api_key = null; // Ensure DB gets null if removed
    } else if (!data.composio_api_key && !profile?.composio_api_key) {
        delete updateData.composio_api_key; // Don't send null if it was already null/empty
    }


    startSavingTransition(async () => {
      try {
        const { data: updatedProfileData, error } = await supabase
          .from('profiles')
          .update(updateData) // Use the prepared updateData
          .eq('id', user.id)
          .select('*, xp, badges, composio_api_key') // Re-select all fields including the key
          .single();

        if (error) {
          console.error('Error updating profile:', error.message);
          let errorMessage = `Could not save profile: ${error.message}`;
           if (error.message.includes("column") && error.message.includes("does not exist")) {
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
           } else if (error.message.includes("composio_api_key")) { // Specific check for Composio key
              errorMessage = `Could not save Composio API Key: ${error.message}`;
           }
          toast({ title: 'Save Failed', description: errorMessage, variant: 'destructive', duration: 7000 });
        } else if (updatedProfileData) {
          const completeProfile = updatedProfileData as Profile;
          setProfile(completeProfile); // Update local state
          // Update composioStatus to match the saved key
          setComposioStatus(prev => ({ ...prev, apiKey: completeProfile.composio_api_key ?? null, success: !!completeProfile.composio_api_key, errorMessage: null, loading: false }));
          // Update local XP/Badge state immediately after save
          setXp(completeProfile.xp ?? initialXp);
          setBadges(completeProfile.badges ?? initialBadges);
          onProfileUpdate(completeProfile); // Notify parent component
          toast({ title: 'Profile Saved', description: 'Your changes have been saved.' });
          reset(completeProfile); // Reset form dirtiness state with latest data
          setLocalDbSetupError(null); // Clear local error if save succeeds
        }
      } catch (error: any) {
        console.error('Unexpected error updating profile:', error);
        toast({ title: 'Save Failed', description: `Could not save profile: ${error.message}`, variant: 'destructive' });
      }
    });
  };

 const handleAuthenticateApp = useCallback(async (appName: ComposioApp) => {
    console.log(`Starting authentication for ${appName}...`);

    if (localDbSetupError) {
       toast({ title: "Database Error", description: "Cannot authenticate app due to a database setup issue.", variant: "destructive" });
       return;
    }
    // Use composio_mcp_url from profile state
    if (!profile?.composio_mcp_url) {
        toast({ title: "Composio URL Missing", description: "Please enter your Composio MCP URL in profile first.", variant: "destructive" });
        return;
    }

    setIsComposioAuthenticating(prev => ({...prev, [appName]: true}));

    try {
        // Call the API route
        console.log(`Calling API /api/auth/composio/connect for ${appName} with MCP: ${profile.composio_mcp_url}`);
        // Call the API route to get the redirect URL
        const response = await fetch('/api/auth/composio/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appName }), // Pass appName in the body
        });

        const result = await response.json();

        if (response.ok && result.redirectUrl) {
            console.log(`Redirecting user to Composio OAuth URL: ${result.redirectUrl}`);
            window.location.href = result.redirectUrl; // Redirect the user
        } else {
            console.error(`Authentication initiation failed for ${appName}:`, result.error || `HTTP Status: ${response.status}`);
            toast({ title: `${appName} Auth Failed`, description: result.error || `Could not initiate authentication for ${appName}. Status: ${response.status}`, variant: "destructive" });
            setIsComposioAuthenticating(prev => ({...prev, [appName]: false}));
        }
    } catch (error: any) {
        console.error(`Error in handleAuthenticateApp for ${appName}:`, error);
        toast({ title: `${appName} Auth Error`, description: error.message || 'Unknown error during authentication.', variant: 'destructive' });
        setIsComposioAuthenticating(prev => ({...prev, [appName]: false}));
    }
 }, [user.id, toast, localDbSetupError, profile?.composio_mcp_url]);


  const handleDeauthenticateAppAction = async (appName: ComposioApp) => {
      try {
          const result = await handleDeauthenticateApp(appName, user.id);
          if (result.success) {
              toast({ title: `${appName} Disconnected`, description: `Successfully disconnected from ${appName}.`, variant: "success" });
              // Update the profile locally
              setProfile(prev => {
                  if (!prev) return prev;
                  const updatedProfile = { ...prev };
                  const authField = `is_${appName}_authed` as keyof Profile;
                  updatedProfile[authField] = false;
                  return updatedProfile;
              });
          } else {
              toast({ title: `Failed to Disconnect ${appName}`, description: result.error || "Could not deauthenticate. Please try again.", variant: "destructive" });
          }
      } catch (error: any) {
          console.error(`Error deauthenticating ${appName}:`, error);
          toast({ title: `Failed to Disconnect ${appName}`, description: error.message || "An unexpected error occurred.", variant: "destructive" });
      }
  };


  const handleUpgrade = () => {
    toast({ title: "Upgrade Feature", description: "Billing/Upgrade functionality is not yet implemented.", variant: "default" });
  };

  // Function to get authentication status for an app
   const getAuthStatus = (appName: ComposioApp): boolean => {
     const key = `is_${appName}_authed` as keyof Profile;
     return !!profile?.[key];
   };

    // New function to handle Composio API Key retrieval
   const handleGetComposioKey = async () => {
       setComposioStatus({ loading: true, success: false, errorMessage: null, apiKey: null });
       try {
           // Call the server action
           const result = await startComposioLogin();

           if (result.success && result.key) {
               setComposioStatus({loading: false, success: true, errorMessage: null, apiKey: result.key});
                // Update the form field value directly
                setValue('composio_api_key', result.key);
               toast({ title: "Composio Connected", description: "Retrieved Composio API Key successfully." });
               // Optionally trigger form save here if desired
               // handleSubmit(onSubmit)();
           } else {
               setComposioStatus({loading: false, success: false, errorMessage: result.error || "Failed to get Composio API key.", apiKey: null});
               toast({ title: "Composio Connection Error", description: result.error || "Could not get Composio API key.", variant: "destructive" });
           }

       } catch (error: any) {
           console.error("Composio Login Error:", error);
           setComposioStatus({ loading: false, success: false, errorMessage: error.message || 'Unknown error', apiKey: null });
           toast({ title: "Composio Connection Error", description: error.message || "Could not get Composio API key.", variant: "destructive" });
       }
   };


   const quotaUsed = quota?.request_count ?? 0;
   const quotaLimit = quota?.quota_limit ?? DEFAULT_QUOTA_LIMIT;
   const quotaPercentage = quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0; // Avoid division by zero
   const quotaExceeded = quotaPercentage > 100;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] max-h-[90vh]">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Profile &amp; Settings</DialogTitle>
          <DialogDescription>
            Manage your profile, API keys, app connections, and usage.
          </DialogDescription>
        </DialogHeader>

        {localDbSetupError && (
          <Alert variant="destructive" className="mx-6">
            <Database className="h-4 w-4" />
            <AlertTitle>Database Setup/Configuration Issue</AlertTitle>
            <AlertDescription>{localDbSetupError}</AlertDescription>
          </Alert>
        )}

        <ScrollArea className="px-6 overflow-y-auto">
          <form id="profile-form" onSubmit={handleSubmit(onSubmit)} className="space-y-8 py-4">
            {/* Profile Form */}
            <section>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Settings2 className="h-5 w-5"/> User Information</h3>
              <div className="space-y-4">
                 <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-2">
                   <Label htmlFor="email" className="sm:text-right sm:col-span-1">Email</Label>
                   <Input id="email" value={user?.email || 'N/A'} readOnly disabled className="col-span-1 sm:col-span-2 bg-muted/50"/>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-2">
                   <Label htmlFor="full_name" className="sm:text-right sm:col-span-1">Full Name</Label>
                   <div className="col-span-1 sm:col-span-2">
                      <Input id="full_name" {...register('full_name')} className={`${errors.full_name ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} />
                      {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name.message}</p>}
                   </div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-2">
                    <Label htmlFor="username" className="sm:text-right sm:col-span-1">Username</Label>
                    <div className="col-span-1 sm:col-span-2">
                       <Input id="username" {...register('username')} className={`${errors.username ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} />
                       {errors.username && <p className="text-xs text-destructive mt-1">{errors.username.message}</p>}
                    </div>
                 </div>
                 <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-2">
                    <Label htmlFor="phone_number" className="sm:text-right sm:col-span-1">Phone</Label>
                    <div className="col-span-1 sm:col-span-2">
                       <Input id="phone_number" {...register('phone_number')} className={`${errors.phone_number ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} />
                       {errors.phone_number && <p className="text-xs text-destructive mt-1">{errors.phone_number.message}</p>}
                    </div>
                 </div>
              </div>
            </section>

            <Separator />
            {/* Integrations Section */}
            <section>
               <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Key className="h-5 w-5"/> Integrations</h3>
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
                        Get key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary-hover">Google AI Studio <ExternalLink className="inline h-3 w-3"/></a>. Required for generation.
                      </p>
                    </div>
                  </div>

                   {/* Composio API Key - Updated */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                      <Label htmlFor="composio_api_key" className="sm:text-right sm:col-span-1 mt-1">
                        Composio API Key
                      </Label>
                      <div className="col-span-1 sm:col-span-2">
                        <Input
                          id="composio_api_key"
                          type="password" // Keep as password for security
                          {...register('composio_api_key')} // Register with react-hook-form
                          placeholder="Click 'Get Composio Key' if needed"
                          className={`${errors.composio_api_key ? 'border-destructive' : ''}`}
                           // Make editable, but handle update via button/state
                           // disabled={true} // Removed disabled=true
                           readOnly={true} // Make it read-only, updated by state/button
                           value={composioStatus.apiKey ?? ''} // Controlled by state
                        />
                        {errors.composio_api_key && <p className="text-xs text-destructive mt-1">{errors.composio_api_key.message}</p>}
                         <Button
                            size="sm"
                            type="button" // Prevent form submission
                            variant="outline"
                            onClick={handleGetComposioKey} // Use the new handler
                            disabled={composioStatus.loading || !!localDbSetupError}
                            loading={composioStatus.loading}
                            className="mt-2"
                        >
                            <LinkIcon className="mr-2 h-4 w-4" />
                            {composioStatus.loading ? "Connecting..." : (composioStatus.success ? "Key Loaded" : "Get/Refresh Composio Key")}
                        </Button>
                       {composioStatus.errorMessage && <p className="text-xs text-destructive mt-1">{composioStatus.errorMessage}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                         Connects to your Composio account. Needed for app authentication. Click to generate/refresh your API key.
                        </p>
                      </div>
                    </div>

                   {/* Composio MCP URL */}
                   <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                       <Label htmlFor="composio_mcp_url" className="sm:text-right sm:col-span-1 mt-1">
                         Composio MCP URL
                       </Label>
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
                           Find in your <a href="https://mcp.composio.dev" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary-hover">Composio MCP dashboard <ExternalLink className="inline h-3 w-3"/></a>. Needed for app authentication redirects.
                         </p>
                       </div>
                   </div>

                   {/* Social Media Specific URLs (Used for Authentication Redirect) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                        <Label htmlFor="linkedin_url" className="sm:text-right sm:col-span-1 mt-1">
                         LinkedIn URL (Optional)
                       </Label>
                       <div className="col-span-1 sm:col-span-2">
                         <Input
                           id="linkedin_url"
                           {...register('linkedin_url')}
                           placeholder="e.g., https://linkedin.com/in/your-profile"
                           className={`${errors.linkedin_url ? 'border-destructive' : ''}`}
                           disabled={!!localDbSetupError}
                         />
                         {errors.linkedin_url && <p className="text-xs text-destructive mt-1">{errors.linkedin_url.message}</p>}
                       </div>
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                        <Label htmlFor="twitter_url" className="sm:text-right sm:col-span-1 mt-1">
                         Twitter/X URL (Optional)
                       </Label>
                       <div className="col-span-1 sm:col-span-2">
                         <Input
                           id="twitter_url"
                           {...register('twitter_url')}
                           placeholder="e.g., https://twitter.com/your_handle"
                           className={`${errors.twitter_url ? 'border-destructive' : ''}`}
                           disabled={!!localDbSetupError}
                         />
                         {errors.twitter_url && <p className="text-xs text-destructive mt-1">{errors.twitter_url.message}</p>}
                       </div>
                     </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                       <Label htmlFor="youtube_url" className="sm:text-right sm:col-span-1 mt-1">
                         YouTube URL (Optional)
                       </Label>
                       <div className="col-span-1 sm:col-span-2">
                         <Input
                           id="youtube_url"
                           {...register('youtube_url')}
                           placeholder="e.g., https://youtube.com/channel/your-id"
                           className={`${errors.youtube_url ? 'border-destructive' : ''}`}
                           disabled={!!localDbSetupError}
                         />
                         {errors.youtube_url && <p className="text-xs text-destructive mt-1">{errors.youtube_url.message}</p>}
                       </div>
                     </div>

                    {/* App Authentication Section */}
                     <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2 pt-2">
                        <Label className="sm:text-right sm:col-span-1 mt-1">App Connections</Label>
                        <div className="col-span-1 sm:col-span-2 space-y-3">
                           {(['linkedin', 'twitter', 'youtube'] as ComposioApp[]).map((appName) => {
                              const isAuthenticated = getAuthStatus(appName);
                              const isAuthenticating = isComposioAuthenticating[appName];
                              const Icon = isAuthenticated ? CheckCircle : (isAuthenticating ? Loader2 : XCircle);
                              const iconColor = isAuthenticated ? 'text-green-500' : (isAuthenticating ? 'animate-spin' : 'text-destructive');

                              return (
                                 <div key={appName} className="flex items-center justify-between bg-muted/30 p-3 rounded-md border border-border/50">
                                    <div className="flex items-center gap-2">
                                        <Icon className={`h-5 w-5 ${iconColor}`} />
                                        <span className="capitalize font-medium">{appName}</span>
                                    </div>
                                    <Button
                                       type="button"
                                       size="sm"
                                       variant={isAuthenticated ? "outline" : "default"}
                                       onClick={() => handleAuthenticateApp(appName)}
                                       disabled={isAuthenticating || !!localDbSetupError || !profile?.composio_mcp_url}
                                       loading={isAuthenticating}
                                       title={!profile?.composio_mcp_url ? "Enter Composio MCP URL first" : ""}
                                     >
                                       {isAuthenticated ? "Connected" : "Authenticate"}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleDeauthenticateAppAction(appName)}
                                        disabled={!isAuthenticated || isComposioAuthenticating[appName] || !!localDbSetupError}
                                        loading={isComposioAuthenticating[appName]}
                                      >
                                        Disconnect
                                      </Button>
                                 </div>
                              );
                           })}
                           {!profile?.composio_mcp_url && (
                               <p className="text-xs text-destructive mt-1">Enter Composio MCP URL above to enable authentication.</p>
                           )}
                        </div>
                    </div>
               </div>
            </section>

            <Separator />
            {/* Gamification Section */}
            <section>
               <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Fuel className="h-5 w-5"/> AI Fuel &amp; Badges</h3>
               <div className="space-y-3">
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-medium">Experience Points (XP):</span>
                     <span className="font-bold text-primary">{xp?.toLocaleString() ?? 0} XP</span>
                  </div>
                   {/* Example XP Bar - replace with your styled component if needed */}
                   <Progress value={xp % 100} className="h-2"/>

                  <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">Unlocked Badges:</h4>
                      {(badges ?? []).length > 0 ? ( // Check if badges array exists and has items
                         <div className="flex flex-wrap gap-3">
                           {(badges || []).map((badgeName) => { // Add fallback for badges
                             const badgeInfo = BADGES.find(b => b.name === badgeName);
                             const Icon = badgeInfo?.icon || BadgeCheck;
                             return (
                               <TooltipProvider key={badgeName}>
                                <Tooltip>
                                   <TooltipTrigger asChild>
                                       <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary text-xs font-medium px-2 py-1 rounded-full cursor-default">
                                         <Icon className="h-3.5 w-3.5" />
                                         <span>{badgeName}</span>
                                       </div>
                                   </TooltipTrigger>
                                   {badgeInfo && (
                                     <TooltipContent side="bottom">
                                       <p className="text-xs">{badgeInfo.description}</p>
                                     </TooltipContent>
                                   )}
                                </Tooltip>
                               </TooltipProvider>
                             );
                           })}
                         </div>
                       ) : (
                         <p className="text-sm text-muted-foreground italic">Keep generating posts to unlock badges!</p>
                       )}
                    </div>
               </div>
            </section>

            <Separator />
            {/* Billing/Quota Section */}
            <section>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><CreditCard className="h-5 w-5"/> Usage &amp; Billing</h3>
              {localDbSetupError && !localDbSetupError.includes('quota') ? (
                <Alert variant="destructive">
                  <Database className="h-4 w-4" />
                  <AlertTitle>Usage Data Issue</AlertTitle>
                  <AlertDescription>Cannot load usage data due to a profile or database setup issue.</AlertDescription>
                </Alert>
              ) : quota !== null ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-medium">Monthly Requests Used:</span>
                     <span className="font-semibold">{quotaUsed} / {quotaLimit}</span>
                  </div>
                   <Progress value={quotaPercentage > 100 ? 100 : quotaPercentage} className={`h-2 ${quotaExceeded ? ' [&>*]:bg-destructive' : ''}`} />
                  {quotaExceeded && (
                    <Alert variant="destructive" className="mt-2">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Quota Limit Reached</AlertTitle>
                      <AlertDescription>Upgrade to continue generating posts.</AlertDescription>
                    </Alert>
                  )}
                  <div className="flex justify-between items-center">
                    <Button type="button" size="sm" variant="outline" onClick={handleUpgrade} disabled={!!localDbSetupError}>
                       Upgrade Plan (Placeholder)
                    </Button>
                  {quota.last_reset_at && (
                    <p className="text-xs text-muted-foreground">
                      Quota resets on: {new Date(new Date(quota.last_reset_at).setMonth(new Date(quota.last_reset_at).getMonth() + 1)).toLocaleDateString()}
                    </p>
                  )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center text-muted-foreground">
                  {localDbSetupError && localDbSetupError.includes('quota') ? (
                    <>
                     <Database className="h-4 w-4 mr-2 text-destructive"/>
                     <span className="text-sm text-destructive">Error loading quota.</span>
                    </>
                  ) : (
                    <>
                     <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
                     <span className="text-sm">Loading usage data...</span>
                    </>
                  )}
                </div>
              )}
            </section>
          </form>
        </ScrollArea>

        <DialogFooter className="px-6 pb-6 pt-4 border-t">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" form="profile-form" disabled={isSaving || !!localDbSetupError || !isDirty} loading={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
