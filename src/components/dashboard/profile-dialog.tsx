
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
import { Info, Loader2, Save, ExternalLink, CreditCard, Database, Settings2, Wifi, WifiOff, CheckCircle, XCircle, Link as LinkIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { authenticateComposioApp } from '@/services/composio-service'; // Import the new service

interface ProfileDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user: User;
  initialProfile: Profile | null;
  initialQuota: Quota | null;
  onProfileUpdate: (profile: Profile) => void; // Callback to update parent state
  dbSetupError: string | null;
}

// Updated schema to include new Composio status fields (read-only from profile state)
// and rename composio_url to composio_mcp_url
const profileSchema = z.object({
  full_name: z.string().max(100, 'Full name too long').nullable().optional().or(z.literal('')),
  username: z.string().max(50, 'Username too long').nullable().optional().or(z.literal('')),
  phone_number: z.string().max(20, 'Phone number too long').nullable().optional().or(z.literal('')),
  composio_mcp_url: z.string().url('Invalid URL format').max(255, 'URL too long').nullable().optional().or(z.literal('')), // Renamed
  gemini_api_key: z.string().max(255, 'API Key too long').nullable().optional().or(z.literal('')),
  // Auth status fields are not directly editable in the form, they are managed by auth buttons
});

type ProfileFormData = z.infer<typeof profileSchema>;

const DEFAULT_QUOTA_LIMIT = 100;

export function ProfileDialog({
  isOpen,
  onOpenChange,
  user,
  initialProfile,
  initialQuota,
  onProfileUpdate,
  dbSetupError,
}: ProfileDialogProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [isSaving, startSavingTransition] = useTransition();
  const [isAuthenticating, setIsAuthenticating] = useState<Partial<Record<ComposioApp, boolean>>>({}); // Track auth state per app
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [quota, setQuota] = useState<Quota | null>(initialQuota);
  const [localDbSetupError, setLocalDbSetupError] = useState<string | null>(dbSetupError);

  // Ensure local state updates if initial props change
  useEffect(() => {
    setProfile(initialProfile);
    setQuota(initialQuota);
    setLocalDbSetupError(dbSetupError);
  }, [initialProfile, initialQuota, dbSetupError]);

  // Fetch Quota inside dialog if initialQuota is null and no DB error
  useEffect(() => {
    if (isOpen && !quota && !localDbSetupError) {
      const fetchQuota = async () => {
        try {
          const { data, error } = await supabase
            .from('quotas')
            .select('user_id, request_count, quota_limit, last_reset_at')
            .eq('user_id', user.id)
            .single();

          if (error && error.code === 'PGRST116') {
            console.log("Quota record not found for user:", user.id);
          } else if (error) {
            console.error('Error fetching quota inside dialog:', error.message);
            let errorMsg = `Failed to load usage data: ${error.message}`;
            if (error.message.includes("relation \"public.quotas\" does not exist")) {
              errorMsg = "Database setup incomplete: Missing 'quotas' table. Please run the SQL script from `supabase/schema.sql`. See README Step 3.";
            } else if (error.message.includes("permission denied")) {
              errorMsg = "Database access error: Permission denied for 'quotas' table. Check RLS policies. See README Step 3.";
            } else if (error.message.includes("406")) {
              errorMsg = `Database configuration issue: Could not fetch quota (Error 406). Check RLS/table access. Details: ${error.message}`;
              toast({ title: "Quota Load Error", description: "Could not retrieve usage data (406).", variant: "destructive" });
            } else {
              toast({ title: 'Quota Error', description: errorMsg, variant: 'destructive' });
            }
            setLocalDbSetupError(errorMsg);
          } else if (data && 'user_id' in data && 'request_count' in data && 'quota_limit' in data && 'last_reset_at' in data) {
            setQuota(data as Quota);
            setLocalDbSetupError(null);
          } else {
            console.warn("Fetched quota data inside dialog is missing fields:", data);
            const errorMsg = `Incomplete quota data received.`;
            setLocalDbSetupError(errorMsg);
            toast({ title: 'Quota Error', description: errorMsg, variant: 'destructive' });
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
    defaultValues: {
      full_name: initialProfile?.full_name ?? '',
      username: initialProfile?.username ?? '',
      phone_number: initialProfile?.phone_number ?? '',
      composio_mcp_url: initialProfile?.composio_mcp_url ?? '', // Renamed
      gemini_api_key: initialProfile?.gemini_api_key ?? '',
    },
  });

  // Reset form when profile changes or dialog opens/closes
  useEffect(() => {
    reset({
      full_name: profile?.full_name ?? '',
      username: profile?.username ?? '',
      phone_number: profile?.phone_number ?? '',
      composio_mcp_url: profile?.composio_mcp_url ?? '', // Renamed
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
          // Select all columns including the new auth status ones
          .select('id, updated_at, username, full_name, phone_number, composio_mcp_url, gemini_api_key, is_linkedin_authed, is_twitter_authed, is_youtube_authed')
          .single();

        if (error) {
          console.error('Error updating profile:', error.message);
          // More specific error handling
           if (error.message.includes("Could not find the") && error.message.includes("column")) {
              toast({
                  title: 'Database Schema Mismatch',
                  description: `Column mentioned in the error might be missing. Please ensure the SQL schema is up-to-date: ${error.message}`,
                  variant: 'destructive',
                  duration: 10000, // Show longer
              });
          } else if (error.message.includes("violates row-level security policy")) {
            toast({ title: 'Save Failed', description: 'Could not save profile due to database security policy.', variant: 'destructive' });
          } else if (error.message.includes("relation \"public.profiles\" does not exist")) {
            toast({ title: 'Save Failed', description: 'The `profiles` table is missing.', variant: 'destructive' });
            setLocalDbSetupError('The `profiles` table is missing.');
          } else if (error.message.includes("406")) {
            toast({ title: 'Save Failed', description: `Could not save profile due to a configuration issue (Error 406). Check table/column access. Details: ${error.message}`, variant: 'destructive' });
          } else {
            toast({ title: 'Save Failed', description: `Could not save profile: ${error.message}`, variant: 'destructive' });
          }
        } else if (updatedProfileData) {
          const completeProfile = updatedProfileData as Profile; // Cast to Profile type
          setProfile(completeProfile); // Update local state
          onProfileUpdate(completeProfile); // Notify parent component
          toast({ title: 'Profile Saved', description: 'Your changes have been saved.' });
          reset(data); // Reset form to saved values to make isDirty false
          // onOpenChange(false); // Keep dialog open after save
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
              throw updateError; // Throw to be caught by the outer catch block
           }

           if(updatedProfileData){
              const completeProfile = updatedProfileData as Profile;
              setProfile(completeProfile); // Update local state
              onProfileUpdate(completeProfile); // Notify parent
              toast({ title: `${appName.charAt(0).toUpperCase() + appName.slice(1)} Authenticated`, description: `Successfully authenticated ${appName}.`, variant: "default" });
           }

        } else {
          // Service function likely threw an error handled below, or returned false
           toast({ title: "Authentication Failed", description: `Could not authenticate ${appName}. Check MCP URL and console logs.`, variant: "destructive" });
        }
     } catch (error: any) {
        console.error(`Error authenticating ${appName}:`, error);
        toast({ title: "Authentication Error", description: `Failed to authenticate ${appName}: ${error.message}`, variant: "destructive" });
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

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
                <h3 className="text-lg font-semibold mb-3">User Information</h3>
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
                <h3 className="text-lg font-semibold mb-3">Integrations</h3>
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
                    <Label htmlFor="composio_mcp_url" className="sm:text-right sm:col-span-1 mt-2">Composio MCP URL</Label>
                    <div className="col-span-1 sm:col-span-2">
                      <Input
                        id="composio_mcp_url"
                        {...register('composio_mcp_url')} // Renamed register
                        placeholder="e.g., https://mcp.composio.dev/u/your-unique-id"
                        className={`${errors.composio_mcp_url ? 'border-destructive' : ''}`} // Renamed error check
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

            {/* Billing/Quota Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Usage & Billing</h3>
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
