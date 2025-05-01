
// components/dashboard/profile-dialog.tsx
'use client';

import type { User } from '@supabase/supabase-js';
import type { Profile, Quota } from '@/types/supabase';
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
import { Info, Loader2, Save, ExternalLink, CreditCard, Database } from 'lucide-react'; // Added Database icon
import { Separator } from '@/components/ui/separator'; // Import Separator
import { ScrollArea } from '@/components/ui/scroll-area'; // Import ScrollArea

interface ProfileDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user: User;
  initialProfile: Profile | null;
  initialQuota: Quota | null;
  onProfileUpdate: (profile: Profile) => void; // Callback to update parent state
  dbSetupError: string | null; // Receive DB setup error status
}

const profileSchema = z.object({
  full_name: z.string().max(100, 'Full name too long').nullable().optional().or(z.literal('')),
  username: z.string().max(50, 'Username too long').nullable().optional().or(z.literal('')),
  phone_number: z.string().max(20, 'Phone number too long').nullable().optional().or(z.literal('')),
  composio_url: z.string().url('Invalid URL format').max(255, 'URL too long').nullable().optional().or(z.literal('')),
  gemini_api_key: z.string().max(255, 'API Key too long').nullable().optional().or(z.literal('')), // Basic validation
});

type ProfileFormData = z.infer<typeof profileSchema>;

// Define default quota limit
const DEFAULT_QUOTA_LIMIT = 100;

export function ProfileDialog({
  isOpen,
  onOpenChange,
  user,
  initialProfile,
  initialQuota,
  onProfileUpdate,
  dbSetupError, // Use the prop
}: ProfileDialogProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [quota, setQuota] = useState<Quota | null>(initialQuota);
  const [localDbSetupError, setLocalDbSetupError] = useState<string | null>(dbSetupError); // Local state for DB error

   // Ensure local state updates if initial props change (e.g., after initial load)
   useEffect(() => {
      setProfile(initialProfile);
      setQuota(initialQuota);
      setLocalDbSetupError(dbSetupError); // Update local error state from prop
    }, [initialProfile, initialQuota, dbSetupError]);


   // Fetch Quota inside dialog if initialQuota is null and no DB error
  useEffect(() => {
      if (isOpen && !quota && !localDbSetupError) {
         const fetchQuota = async () => {
            try {
                // Select specific columns
                const { data, error } = await supabase
                 .from('quotas')
                 .select('user_id, request_count, quota_limit, last_reset_at')
                 .eq('user_id', user.id)
                 .single();

               if (error && error.code === 'PGRST116') {
                  // Quota record doesn't exist yet, which is fine initially.
                  // No need to set error, the UI will show loading or default state.
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
                   setLocalDbSetupError(errorMsg); // Set local error state
               } else if (data && 'user_id' in data && 'request_count' in data && 'quota_limit' in data && 'last_reset_at' in data) {
                  setQuota(data as Quota); // Update quota state if successful
                  setLocalDbSetupError(null); // Clear error on success
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
      composio_url: initialProfile?.composio_url ?? '',
      gemini_api_key: initialProfile?.gemini_api_key ?? '',
    },
  });

  // Reset form when profile changes or dialog opens/closes
  useEffect(() => {
    reset({
      full_name: profile?.full_name ?? '',
      username: profile?.username ?? '',
      phone_number: profile?.phone_number ?? '',
      composio_url: profile?.composio_url ?? '',
      gemini_api_key: profile?.gemini_api_key ?? '',
    });
  }, [profile, reset, isOpen]);

  const quotaUsed = quota?.request_count ?? 0;
  const quotaLimit = quota?.quota_limit ?? DEFAULT_QUOTA_LIMIT;
  const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
  const quotaPercentage = quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0;
  const quotaExceeded = quotaRemaining <= 0 && !!quota; // Only exceeded if quota loaded

  const onSubmit = async (data: ProfileFormData) => {
     if (localDbSetupError) { // Check local error state
       toast({
         title: "Database Error",
         description: "Cannot save profile due to a database setup issue. Please resolve the setup errors first.",
         variant: "destructive",
       });
       return;
     }
    // Ensure empty strings are treated as null for the database update
    const updateData = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, value === '' ? null : value])
    );

    startTransition(async () => {
      try {
        // Use select() to specify columns, potentially avoiding 406 if '*' causes issues
        const { data: updatedProfile, error } = await supabase
          .from('profiles')
          .update({
            ...updateData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
          .select('id, updated_at, username, full_name, phone_number, composio_url, gemini_api_key') // Specify columns
          .single();

        if (error) {
             console.error('Error updating profile:', error.message); // Log error
             // Check for specific DB errors during update
             if (error.message.includes("violates row-level security policy")) {
                 toast({
                   title: 'Save Failed',
                   description: 'Could not save profile due to database security policy. Check RLS for updates on the `profiles` table.',
                   variant: 'destructive',
                 });
             } else if (error.message.includes("relation \"public.profiles\" does not exist")) {
                  toast({
                     title: 'Save Failed',
                     description: 'The `profiles` table is missing. Please run the database setup script.',
                     variant: 'destructive',
                   });
                   setLocalDbSetupError('The `profiles` table is missing.'); // Update local error
             } else if (error.message.includes("406")) {
                 toast({
                     title: 'Save Failed',
                     description: `Could not save profile due to a configuration issue (Error 406). Check table/column access. Details: ${error.message}`,
                     variant: 'destructive',
                   });
             } else {
                 toast({ title: 'Save Failed', description: `Could not save profile: ${error.message}`, variant: 'destructive' });
             }
        } else if (updatedProfile) {
            setProfile(updatedProfile as Profile); // Update local state
            onProfileUpdate(updatedProfile as Profile); // Notify parent component
            toast({ title: 'Profile Saved', description: 'Your changes have been saved.' });
            onOpenChange(false); // Close dialog on success
        }
      } catch (error: any) {
        console.error('Unexpected error updating profile:', error);
        toast({
          title: 'Save Failed',
          description: `Could not save profile: ${error.message}`,
          variant: 'destructive',
        });
      }
    });
  };

  // Placeholder for upgrade action
  const handleUpgrade = () => {
     toast({
       title: "Upgrade Feature",
       description: "Billing/Upgrade functionality is not yet implemented.",
       variant: "default",
     });
     // TODO: Implement redirect or modal for Stripe/LemonSqueezy checkout
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] max-h-[90vh]"> {/* Adjusted width & height */}
        <DialogHeader>
          <DialogTitle>Profile & Settings</DialogTitle>
          <DialogDescription>
            Manage your profile details, API keys, and usage quota.
          </DialogDescription>
        </DialogHeader>

         {/* DB Setup Error Alert within Dialog */}
         {localDbSetupError && (
          <Alert variant="destructive" className="mx-6 mt-[-10px] mb-4"> {/* Position alert */}
             <Database className="h-4 w-4" />
            <AlertTitle>Database Setup/Configuration Issue</AlertTitle> {/* Adjusted title */}
            <AlertDescription>
              {localDbSetupError} Saving profile changes and viewing quota might be affected until this is resolved. Please ensure the database schema (`supabase/schema.sql`) is correctly applied and RLS policies grant necessary permissions.
            </AlertDescription>
          </Alert>
        )}


        {/* Scrollable Content Area */}
        <ScrollArea className="overflow-y-auto px-6 -mx-6"> {/* Added padding to ScrollArea itself */}
          <div className="grid gap-8 py-4"> {/* Increased gap */}

            {/* Profile Form */}
            <form id="profile-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6"> {/* Increased spacing */}
              <div>
                <h3 className="text-lg font-semibold mb-3">User Information</h3> {/* Added margin */}
                 <div className="space-y-4"> {/* Vertical stack for user info */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-x-4 gap-y-1">
                      <Label htmlFor="email" className="sm:text-right sm:col-span-1">
                        Email
                      </Label>
                      <Input id="email" value={user.email ?? 'N/A'} readOnly disabled className="col-span-1 sm:col-span-2 bg-muted/50" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-1">
                      <Label htmlFor="full_name" className="sm:text-right sm:col-span-1 mt-2">
                        Full Name
                      </Label>
                       <div className="col-span-1 sm:col-span-2">
                         <Input
                           id="full_name"
                           {...register('full_name')}
                           className={`${errors.full_name ? 'border-destructive' : ''}`}
                           disabled={!!localDbSetupError} // Disable if DB error
                         />
                         {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name.message}</p>}
                       </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-1">
                      <Label htmlFor="username" className="sm:text-right sm:col-span-1 mt-2">
                        Username
                      </Label>
                      <div className="col-span-1 sm:col-span-2">
                         <Input
                           id="username"
                           {...register('username')}
                           className={`${errors.username ? 'border-destructive' : ''}`}
                            disabled={!!localDbSetupError} // Disable if DB error
                         />
                         {errors.username && <p className="text-xs text-destructive mt-1">{errors.username.message}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-1">
                      <Label htmlFor="phone_number" className="sm:text-right sm:col-span-1 mt-2">
                        Phone
                      </Label>
                      <div className="col-span-1 sm:col-span-2">
                          <Input
                            id="phone_number"
                            {...register('phone_number')}
                             className={`${errors.phone_number ? 'border-destructive' : ''}`}
                              disabled={!!localDbSetupError} // Disable if DB error
                          />
                         {errors.phone_number && <p className="text-xs text-destructive mt-1">{errors.phone_number.message}</p>}
                      </div>
                    </div>
                 </div>
              </div>

             <Separator className="my-2" /> {/* Reduced margin */}

              {/* API Keys & URLs */}
               <div>
                  <h3 className="text-lg font-semibold mb-3">Integrations</h3>
                  <div className="space-y-4">
                     <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-1">
                        <Label htmlFor="gemini_api_key" className="sm:text-right sm:col-span-1 mt-2">
                          Gemini Key
                        </Label>
                         <div className="col-span-1 sm:col-span-2">
                           <Input
                             id="gemini_api_key"
                             type="password" // Use password type to obscure key
                             {...register('gemini_api_key')}
                             placeholder="Enter your Google Gemini API Key"
                             className={`${errors.gemini_api_key ? 'border-destructive' : ''}`}
                              disabled={!!localDbSetupError} // Disable if DB error
                           />
                           {errors.gemini_api_key && <p className="text-xs text-destructive mt-1">{errors.gemini_api_key.message}</p>}
                           <p className="text-xs text-muted-foreground mt-1">
                              Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Google AI Studio <ExternalLink className="inline h-3 w-3 ml-0.5"/></a>.
                           </p>
                         </div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-1">
                        <Label htmlFor="composio_url" className="sm:text-right sm:col-span-1 mt-2">
                          Composio URL
                        </Label>
                        <div className="col-span-1 sm:col-span-2">
                           <Input
                             id="composio_url"
                             {...register('composio_url')}
                             placeholder="Enter your Composio MCP URL (optional)"
                             className={`${errors.composio_url ? 'border-destructive' : ''}`}
                              disabled={!!localDbSetupError} // Disable if DB error
                           />
                           {errors.composio_url && <p className="text-xs text-destructive mt-1">{errors.composio_url.message}</p>}
                            <p className="text-xs text-muted-foreground mt-1">
                             Needed for publishing posts directly (feature coming soon).
                           </p>
                         </div>
                     </div>
                  </div>
               </div>
            </form>

           <Separator className="my-2" /> {/* Reduced margin */}

            {/* Billing/Quota Section */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Usage & Billing</h3>
              {localDbSetupError && !localDbSetupError.includes('quota') ? ( // Show error only if not quota-specific
                  <Alert variant="destructive">
                    <Database className="h-4 w-4" />
                    <AlertTitle>Profile Data Issue</AlertTitle>
                    <AlertDescription>
                       Cannot load usage data due to a profile or database setup issue.
                    </AlertDescription>
                  </Alert>
              ) : quota !== null ? (
                <div className="space-y-4"> {/* Increased spacing */}
                  <div className="flex justify-between items-center text-sm">
                    <span>Monthly Requests Used:</span>
                    <span className="font-medium">{quotaUsed} / {quotaLimit}</span>
                  </div>
                  <Progress value={quotaPercentage} className="w-full h-2" />
                  {quotaExceeded && (
                     <Alert variant="destructive" className="mt-4">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Quota Limit Reached</AlertTitle>
                      <AlertDescription>
                        You've used all your requests. Upgrade to continue generating posts.
                      </AlertDescription>
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
                          {/* Basic reset date calculation, refine as needed */}
                      </p>
                   )}
                </div>
              ) : ( // Loading state or specific quota error state
                <div className="flex items-center justify-center text-muted-foreground py-4"> {/* Added padding */}
                   {localDbSetupError && localDbSetupError.includes('quota') ? (
                      <span className='text-destructive text-sm flex items-center gap-2'><Database className="h-4 w-4"/> Error loading quota.</span>
                   ) : (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2"/> Loading usage data...
                      </>
                   )}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t border-border/50 px-6 pb-4"> {/* Added padding */}
           <DialogClose asChild>
               <Button type="button" variant="outline">
                  Cancel
               </Button>
            </DialogClose>
          <Button
             type="submit"
             form="profile-form"
             disabled={isPending || !isDirty || !!localDbSetupError} // Disable if pending, not dirty, or DB error
             loading={isPending}
           >
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
