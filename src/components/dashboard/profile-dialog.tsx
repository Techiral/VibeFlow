// src/components/dashboard/profile-dialog.tsx
'use client';

import type { User } from '@supabase/supabase-js';
import type { Database, Profile, Quota } from '@/types/supabase'; // Removed ComposioApp type
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
import { Info, Loader2, Save, ExternalLink, CreditCard, Database, Settings2, Wifi, WifiOff, CheckCircle, XCircle, Link as LinkIcon, Fuel, BadgeCheck, Star, Trophy, Zap, BrainCircuit, Key } from 'lucide-react'; // Removed Wifi, WifiOff, LinkIcon, Check/XCircle
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
// Removed Composio service imports
// import { handleDeauthenticateApp } from '@/services/composio-service';
// import { authenticateComposioApp } from '@/services/composio-service';
// import { startComposioLogin } from '@/actions/composio-actions'; // Removed
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
// Removed Composio core imports
// import { App as ComposioAppEnum } from "composio-core";
import { toast as sonnerToast } from 'sonner';
import Confetti from 'react-confetti';
// Removed OpenAPI import if it was only for Composio
// import { OpenAPI } from 'openai';

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

// Updated profile schema to remove Composio fields
const profileSchema = z.object({
  full_name: z.string().max(100, 'Full name must be 100 characters or less').nullable().optional().or(z.literal('')),
  username: z.string().max(50, 'Username must be 50 characters or less').nullable().optional().or(z.literal('')),
  phone_number: z.string().max(20, 'Phone number must be 20 characters or less').nullable().optional().or(z.literal('')),
  gemini_api_key: z.string().max(255, 'API Key must be 255 characters or less').nullable().optional().or(z.literal('')),
  // Removed: composio_mcp_url, linkedin_url, twitter_url, youtube_url, composio_api_key
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
  const [xp, setXp] = useState<number>(initialXp);
  const [badges, setBadges] = useState<string[]>(initialBadges ?? []);
  const [localDbSetupError, setLocalDbSetupError] = useState<string | null>(dbSetupError);
  // Removed Composio state
  // const [isComposioAuthenticating, setIsComposioAuthenticating] = useState<Partial<Record<ComposioApp, boolean>>>({});
  // const [composioStatus, setComposioStatus] = useState({ loading: false, success: false, errorMessage: null, apiKey: null });

   useEffect(() => {
    setProfile(initialProfile);
    setQuota(initialQuota);
    setXp(initialXp);
    setBadges(initialBadges ?? []);
    setLocalDbSetupError(dbSetupError);
  }, [initialProfile, initialQuota, dbSetupError, initialXp, initialBadges]);

   const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: initialProfile?.full_name ?? '',
      username: initialProfile?.username ?? '',
      phone_number: initialProfile?.phone_number ?? '',
      gemini_api_key: initialProfile?.gemini_api_key ?? '',
      // Removed Composio fields from defaultValues
    },
  });

   // Effect to update form when profile state changes externally or internally
  useEffect(() => {
    if (profile) {
      reset({
        full_name: profile.full_name ?? '',
        username: profile.username ?? '',
        phone_number: profile.phone_number ?? '',
        gemini_api_key: profile.gemini_api_key ?? '',
        // Removed Composio fields from reset
      });
    }
  }, [profile, reset]); // Depend on profile, reset


  // Effect to fetch quota if needed (remains the same)
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

    // Filter out null or empty string values before updating
    const updateData: Partial<Profile> = { // Use Partial<Profile>
        ...Object.fromEntries(
            Object.entries(data).filter(([key, value]) => value !== null && value !== '')
        ) as Partial<Profile>, // Cast the result
        updated_at: new Date().toISOString(),
    };

    // Remove id from updateData if present, as it's the primary key
    delete updateData.id;

    startSavingTransition(async () => {
      try {
        const { data: updatedProfileData, error } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', user.id)
          .select('*, xp, badges') // Re-select all fields (excluding Composio fields)
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
           }
          toast({ title: 'Save Failed', description: errorMessage, variant: 'destructive', duration: 7000 });
        } else if (updatedProfileData) {
          const completeProfile = updatedProfileData as Profile;
          setProfile(completeProfile); // Update local state
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

  // Removed handleAuthenticateApp and handleGetComposioKey

  // Removed handleDeauthenticateAppAction

  const handleUpgrade = () => {
    toast({ title: "Upgrade Feature", description: "Billing/Upgrade functionality is not yet implemented.", variant: "default" });
  };

  // Removed getAuthStatus

   const quotaUsed = quota?.request_count ?? 0;
   const quotaLimit = quota?.quota_limit ?? DEFAULT_QUOTA_LIMIT;
   const quotaPercentage = quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0; // Avoid division by zero
   const quotaExceeded = quotaPercentage >= 100; // Use >= to include exactly 100%


    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
         <DialogContent className="sm:max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] max-h-[90vh]">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Profile & Settings</DialogTitle>
            <DialogDescription>
              Manage your profile, API keys, and usage.
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
                     <Label htmlFor="email-profile" className="sm:text-right sm:col-span-1">Email</Label>
                     <Input id="email-profile" value={user?.email || 'N/A'} readOnly disabled className="col-span-1 sm:col-span-2 bg-muted/50"/>
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
              {/* API Keys Section */}
              <section>
                 <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Key className="h-5 w-5"/> API Keys</h3>
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

                    {/* Removed Composio API Key section */}
                    {/* Removed Social Media Specific URLs section */}
                    {/* Removed App Authentication Section */}

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
                     <Progress value={xp % 100} className="h-2" aria-label={`Experience points progress: ${xp % 100}% towards next level`} /> {/* Added aria-label */}

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
                     <Progress value={quotaPercentage > 100 ? 100 : quotaPercentage} className={`h-2 ${quotaExceeded ? ' [&>*]:bg-destructive' : ''}`} aria-label={`Quota usage: ${quotaUsed} of ${quotaLimit} requests used (${quotaPercentage.toFixed(0)}%)`} /> {/* Added aria-label */}
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
