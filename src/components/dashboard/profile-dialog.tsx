
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
import { Info, Loader2, Save, ExternalLink, CreditCard } from 'lucide-react';

interface ProfileDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user: User;
  initialProfile: Profile | null;
  initialQuota: Quota | null;
  onProfileUpdate: (profile: Profile) => void; // Callback to update parent state
}

const profileSchema = z.object({
  full_name: z.string().max(100, 'Full name too long').nullable(),
  username: z.string().max(50, 'Username too long').nullable(),
  phone_number: z.string().max(20, 'Phone number too long').nullable(),
  composio_url: z.string().url('Invalid URL format').max(255, 'URL too long').nullable(),
  gemini_api_key: z.string().max(255, 'API Key too long').nullable(), // Basic validation
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
}: ProfileDialogProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [quota, setQuota] = useState<Quota | null>(initialQuota);

   // Ensure local state updates if initial props change (e.g., after initial load)
   useEffect(() => {
      setProfile(initialProfile);
      setQuota(initialQuota);
    }, [initialProfile, initialQuota]);

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

  // Reset form when initialProfile changes or dialog opens/closes
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
  const quotaExceeded = quotaRemaining <= 0;

  const onSubmit = async (data: ProfileFormData) => {
    startTransition(async () => {
      try {
        const { data: updatedProfile, error } = await supabase
          .from('profiles')
          .update({
            ...data,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
          .select()
          .single();

        if (error) throw error;

        if (updatedProfile) {
          setProfile(updatedProfile); // Update local state
          onProfileUpdate(updatedProfile); // Notify parent component
        }
        toast({ title: 'Profile Saved', description: 'Your changes have been saved.' });
        onOpenChange(false); // Close dialog on success
      } catch (error: any) {
        console.error('Error updating profile:', error);
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
      <DialogContent className="sm:max-w-[600px] grid-rows-[auto_1fr_auto]">
        <DialogHeader>
          <DialogTitle>Profile & Settings</DialogTitle>
          <DialogDescription>
            Manage your profile details, API keys, and usage quota.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div className="grid gap-6 py-4 overflow-y-auto pr-6 max-h-[60vh]">
          {/* Profile Form */}
          <form id="profile-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <h3 className="text-lg font-semibold mb-2">User Information</h3>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input id="email" value={user.email ?? 'N/A'} readOnly disabled className="col-span-3" />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="full_name" className="text-right">
                Full Name
              </Label>
              <Input
                id="full_name"
                {...register('full_name')}
                className={`col-span-3 ${errors.full_name ? 'border-destructive' : ''}`}
              />
              {errors.full_name && <p className="col-start-2 col-span-3 text-xs text-destructive">{errors.full_name.message}</p>}
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">
                Username
              </Label>
              <Input
                id="username"
                {...register('username')}
                className={`col-span-3 ${errors.username ? 'border-destructive' : ''}`}
              />
               {errors.username && <p className="col-start-2 col-span-3 text-xs text-destructive">{errors.username.message}</p>}
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone_number" className="text-right">
                Phone
              </Label>
              <Input
                id="phone_number"
                {...register('phone_number')}
                 className={`col-span-3 ${errors.phone_number ? 'border-destructive' : ''}`}
              />
              {errors.phone_number && <p className="col-start-2 col-span-3 text-xs text-destructive">{errors.phone_number.message}</p>}
            </div>

           <hr className="my-4 border-border/50"/>

            {/* API Keys & URLs */}
             <h3 className="text-lg font-semibold mb-2">Integrations</h3>
             <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="gemini_api_key" className="text-right">
                  Gemini Key
                </Label>
                <Input
                  id="gemini_api_key"
                  type="password" // Use password type to obscure key
                  {...register('gemini_api_key')}
                  placeholder="Enter your Google Gemini API Key"
                  className={`col-span-3 ${errors.gemini_api_key ? 'border-destructive' : ''}`}
                />
                 {errors.gemini_api_key && <p className="col-start-2 col-span-3 text-xs text-destructive">{errors.gemini_api_key.message}</p>}
             </div>
             <p className="col-start-2 col-span-3 text-xs text-muted-foreground">
                Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">Google AI Studio <ExternalLink className="inline h-3 w-3 ml-0.5"/></a>.
             </p>

             <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="composio_url" className="text-right">
                  Composio URL
                </Label>
                <Input
                  id="composio_url"
                  {...register('composio_url')}
                  placeholder="Enter your Composio MCP URL (optional)"
                  className={`col-span-3 ${errors.composio_url ? 'border-destructive' : ''}`}
                />
                {errors.composio_url && <p className="col-start-2 col-span-3 text-xs text-destructive">{errors.composio_url.message}</p>}
             </div>
             <p className="col-start-2 col-span-3 text-xs text-muted-foreground">
               Needed for publishing posts directly (feature coming soon).
             </p>
             {/* Input fields hidden for brevity, implement similarly */}
          </form>

           <hr className="my-4 border-border/50"/>

          {/* Billing/Quota Section */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Usage & Billing</h3>
            {quota ? (
              <div className="space-y-3">
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
            ) : (
              <div className="flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2"/> Loading usage data...
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-4 border-t border-border/50">
           <DialogClose asChild>
               <Button type="button" variant="outline">
                  Cancel
               </Button>
            </DialogClose>
          <Button type="submit" form="profile-form" disabled={isPending || !isDirty} loading={isPending}>
            <Save className="mr-2 h-4 w-4" /> Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
