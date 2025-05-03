'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Quota, UserProfileFunctionReturn } from '@/types/supabase';
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Loader2, User as UserIcon, Save, X } from 'lucide-react';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';
import BadgeCollection from './badge-collection'; // Import the badge collection
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
// import { authenticateComposioApp } from '@/services/composio-service'; // Removed Composio-related imports
// import { startComposioLogin } from '@/actions/composio-actions'; // Removed Composio-related imports
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
// import { App as ComposioAppEnum } from "composio-core"; // Removed Composio-related imports
import { toast as sonnerToast } from 'sonner'; // Import sonner toast for confetti effect
import Confetti from 'react-confetti';


interface ProfileDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  user: User;
  initialProfile: UserProfileFunctionReturn | null;
  initialQuota: Quota | null;
  onProfileUpdate: (updatedProfile: UserProfileFunctionReturn) => void;
  initialXp: number;
  initialBadges: string[];
  dbSetupError: boolean; // Pass DB setup error status
}

// Define Zod schema for profile validation
const profileSchema = z.object({
  full_name: z.string().max(100, 'Full name must be 100 characters or less').nullable().optional().or(z.literal('')),
  username: z.string().max(50, 'Username must be 50 characters or less').nullable().optional().or(z.literal('')),
  phone_number: z.string().max(20, 'Phone number must be 20 characters or less').nullable().optional().or(z.literal('')),
  // Removed Composio-related fields: composio_mcp_url, linkedin_url, twitter_url, youtube_url
  gemini_api_key: z.string().max(255, 'API Key must be 255 characters or less').nullable().optional().or(z.literal('')),
  // Removed Composio-related fields: composio_api_key
});

type ProfileFormData = z.infer<typeof profileSchema>;

// Define badge thresholds and details (duplicate from dashboard for now)
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
  onProfileUpdate,
  initialXp,
  initialBadges,
  dbSetupError,
}: ProfileDialogProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfileFunctionReturn | null>(initialProfile);
  const [quota, setQuota] = useState<Quota | null>(initialQuota);
  const [xp, setXp] = useState<number>(initialXp);
  const [badges, setBadges] = useState<string[]>(initialBadges);
  const [error, setError] = useState<string | null>(null);
  // Removed Composio-related states
  // const [authLoading, setAuthLoading] = useState<Record<ComposioAppEnum, boolean>>({ linkedin: false, twitter: false, youtube: false });
  // const [authError, setAuthError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false); // State for confetti effect

   useEffect(() => {
     setIsClient(true);
   }, []);

  // Update local state when initial props change
  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  useEffect(() => {
    setQuota(initialQuota);
  }, [initialQuota]);

  useEffect(() => {
    setXp(initialXp);
  }, [initialXp]);

   useEffect(() => {
     setBadges(initialBadges || []); // Ensure badges is always an array
   }, [initialBadges]);


  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      username: profile?.username ?? '',
      phone_number: profile?.phone_number ?? '',
      gemini_api_key: profile?.gemini_api_key ?? '',
      // Removed Composio-related fields
    },
  });

  // Reset form when initialProfile changes
   useEffect(() => {
      form.reset({
        full_name: profile?.full_name ?? '',
        username: profile?.username ?? '',
        phone_number: profile?.phone_number ?? '',
        gemini_api_key: profile?.gemini_api_key ?? '',
        // Removed Composio-related fields
      });
      setError(null); // Clear errors when profile reloads
    }, [profile, form]);


  async function onSubmit(data: ProfileFormData) {
    setLoading(true);
    setError(null); // Clear previous errors

    if (dbSetupError) {
       setError("Cannot save profile, database setup is incomplete.");
       setLoading(false);
       return;
    }

    if (!profile) {
       setError("Profile not loaded. Cannot save.");
       setLoading(false);
       return;
    }

    try {
       const updates = {
           id: user.id,
           full_name: data.full_name,
           username: data.username,
           phone_number: data.phone_number,
           gemini_api_key: data.gemini_api_key,
           // Removed Composio-related fields
           updated_at: new Date().toISOString(),
       };

      const { error: updateError, data: updatedDataArray } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select() // Select the updated row
        .returns<UserProfileFunctionReturn[]>(); // Specify the return type as an array

      if (updateError) {
        throw updateError;
      }

       if (!updatedDataArray || updatedDataArray.length === 0) {
           throw new Error("Failed to retrieve updated profile data.");
       }

       const updatedProfile = updatedDataArray[0];

      setProfile(updatedProfile); // Update local profile state
      onProfileUpdate(updatedProfile); // Notify parent component
      toast({ title: 'Profile Updated', description: 'Your profile has been saved successfully.' });
      onOpenChange(false); // Close dialog on success
    } catch (error: any) {
       console.error("Error updating profile:", error.message);
       setError(`Error updating profile: "${error.message}"`); // Display the specific error
       toast({
         title: 'Update Failed',
         description: `Could not update profile: ${error.message}`,
         variant: 'destructive',
       });
    } finally {
      setLoading(false);
    }
  }

  // Removed Composio-related functions: handleAuthenticateApp, handleDeauthenticateApp

  // Calculate quota percentage
  const quotaPercentage = quota ? (quota.request_count / quota.quota_limit) * 100 : 0;
  const quotaTooltipContent = quota
    ? `${quota.request_count} / ${quota.quota_limit} requests used this cycle.`
    : "Loading quota...";
  const isQuotaExceeded = quota ? quota.request_count >= quota.quota_limit : false;

  // Calculate XP Percentage for next level
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
                     nextLevelXp = sortedVisibleBadges[i+1].xp;
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
        return { level: currentLevel, percentage: isNaN(percentage) ? 0 : percentage, xpTowardsNext, xpNeededForNext, nextLevelXp };
    };

    const xpInfo = getCurrentLevelInfo(xp);
    const xpTooltipContent = `Level ${xpInfo.level} | ${xp} XP (${xpInfo.xpTowardsNext}/${xpInfo.xpNeededForNext} towards Lvl ${xpInfo.level + 1} @ ${xpInfo.nextLevelXp} XP)`;

    // Calculate reset date
   const getResetDate = () => {
     if (!quota?.last_reset_at) return 'N/A';
     try {
       const resetDate = new Date(quota.last_reset_at);
       resetDate.setMonth(resetDate.getMonth() + 1);
       return resetDate.toLocaleDateString(); // Format based on user's locale
     } catch (e) {
       return 'Invalid Date';
     }
   };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] max-h-[90vh]">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Profile & Settings</DialogTitle>
          <DialogDescription>
            Manage your profile details, API keys, and usage.
          </DialogDescription>
        </DialogHeader>

        {dbSetupError && (
           <div className="px-6 py-4 border-t border-border">
                <div className="bg-destructive/10 border border-destructive/50 text-destructive p-3 rounded-md text-sm flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0"/>
                    <div>
                        <span className="font-semibold">Database Error:</span> Cannot load or save profile/quota due to a database setup issue. Please run the SQL script from <code>supabase/schema.sql</code> in your Supabase project.
                    </div>
                </div>
            </div>
         )}

         {error && (
             <div className="px-6 py-4 border-t border-border">
                 <div className="bg-destructive/10 border border-destructive/50 text-destructive p-3 rounded-md text-sm flex items-start gap-2">
                     <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                     <div>
                         <span className="font-semibold">Error:</span> {error}
                     </div>
                 </div>
             </div>
         )}

        <ScrollArea className="overflow-y-auto border-t border-b border-border">
            <div className="px-6 py-6">
                 <Form {...form}>
                     <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                       <Tabs defaultValue="profile">
                         <TabsList className="grid w-full grid-cols-3 mb-6">
                           <TabsTrigger value="profile">Profile</TabsTrigger>
                           <TabsTrigger value="keys">API Keys</TabsTrigger>
                           <TabsTrigger value="usage">Usage & Billing</TabsTrigger>
                           {/* Removed Integrations Tab */}
                         </TabsList>

                         {/* Profile Tab */}
                         <TabsContent value="profile" className="space-y-6 mt-0">
                           <FormField
                             control={form.control}
                             name="full_name"
                             render={({ field }) => (
                               <FormItem className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                                 <FormLabel className="sm:text-right sm:col-span-1 mt-1">Full Name</FormLabel>
                                 <FormControl className="col-span-1 sm:col-span-2">
                                   <Input placeholder="Your Full Name" {...field} value={field.value ?? ''}/>
                                 </FormControl>
                                 <FormMessage className="sm:col-start-2 sm:col-span-2" />
                               </FormItem>
                             )}
                           />
                           <FormField
                             control={form.control}
                             name="username"
                             render={({ field }) => (
                               <FormItem className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                                 <FormLabel className="sm:text-right sm:col-span-1 mt-1">Username</FormLabel>
                                 <FormControl className="col-span-1 sm:col-span-2">
                                    <Input placeholder="Your Username" {...field} value={field.value ?? ''} />
                                 </FormControl>
                                 <FormMessage className="sm:col-start-2 sm:col-span-2" />
                               </FormItem>
                             )}
                           />
                            <FormField
                             control={form.control}
                             name="phone_number"
                             render={({ field }) => (
                               <FormItem className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                                 <FormLabel className="sm:text-right sm:col-span-1 mt-1">Phone</FormLabel>
                                 <FormControl className="col-span-1 sm:col-span-2">
                                   <Input type="tel" placeholder="Your Phone Number" {...field} value={field.value ?? ''}/>
                                 </FormControl>
                                 <FormMessage className="sm:col-start-2 sm:col-span-2" />
                               </FormItem>
                             )}
                           />
                           <div className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                                <Label className="sm:text-right sm:col-span-1 mt-1">Email</Label>
                                <div className="col-span-1 sm:col-span-2">
                                    <Input type="email" value={user?.email ?? ''} disabled className="text-muted-foreground" />
                                    <p className="text-xs text-muted-foreground mt-1">Email cannot be changed.</p>
                                </div>
                            </div>
                         </TabsContent>

                         {/* API Keys Tab */}
                         <TabsContent value="keys" className="space-y-6 mt-0">
                             <FormField
                                 control={form.control}
                                 name="gemini_api_key"
                                 render={({ field }) => (
                                     <FormItem className="grid grid-cols-1 sm:grid-cols-3 items-start gap-x-4 gap-y-2">
                                         <FormLabel className="sm:text-right sm:col-span-1 mt-1">
                                             Google Gemini API Key
                                             <Tooltip content="Get your key from Google AI Studio. VibeFlow uses your key for generation.">
                                               <Button variant="ghost" size="icon" type="button" className="h-5 w-5 ml-1 inline-flex items-center justify-center" asChild>
                                                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
                                                     <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                                  </a>
                                               </Button>
                                            </Tooltip>
                                         </FormLabel>
                                         <FormControl className="col-span-1 sm:col-span-2">
                                             <Input
                                                 type="password"
                                                 placeholder="Enter your Gemini API Key"
                                                 {...field}
                                                 value={field.value ?? ''}
                                             />
                                         </FormControl>
                                         <FormMessage className="sm:col-start-2 sm:col-span-2" />
                                         <FormDescription className="sm:col-start-2 sm:col-span-2">
                                             Required for AI summarization, generation, and tuning features.
                                         </FormDescription>
                                     </FormItem>
                                 )}
                             />
                             {/* Removed Composio API Key Input */}
                         </TabsContent>

                         {/* Usage & Billing Tab */}
                         <TabsContent value="usage" className="space-y-6 mt-0">
                           <div className="space-y-4 rounded-lg border bg-card text-card-foreground p-4 shadow-sm">
                              <h4 className="text-base font-semibold">Monthly Usage</h4>
                               <TooltipProvider>
                                  <Tooltip content={quotaTooltipContent}>
                                     <div className="space-y-1">
                                        <div className="flex justify-between text-sm font-medium">
                                           <span>Requests Used</span>
                                           <span>{quota ? `${quota.request_count} / ${quota.quota_limit}` : <Loader2 className="h-4 w-4 animate-spin inline"/>}</span>
                                        </div>
                                        <Progress
                                            value={quotaPercentage}
                                            className="h-2"
                                            aria-label="Monthly Usage Quota"
                                            indicatorClassName={isQuotaExceeded ? "bg-destructive" : "bg-primary"}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                           Resets on: {getResetDate()}
                                         </p>
                                     </div>
                                  </Tooltip>

                                   <Tooltip content={xpTooltipContent}>
                                      <div className="space-y-1">
                                         <div className="flex justify-between text-sm font-medium">
                                            <span>Experience Points (XP)</span>
                                            <span>{xp} XP</span>
                                         </div>
                                         <Progress
                                             value={xpInfo.percentage}
                                             className="h-2"
                                             aria-label={xpTooltipContent}
                                             indicatorClassName="bg-gradient-to-r from-purple-500 to-cyan-400"
                                         />
                                          <p className="text-xs text-muted-foreground">
                                             Next Level: {xpInfo.nextLevelXp} XP
                                          </p>
                                      </div>
                                   </Tooltip>
                               </TooltipProvider>

                              <Separator />
                              <div>
                                  <p className="text-sm mb-2">You are currently on the <span className="font-semibold text-primary">Free Plan</span>.</p>
                                  <Button disabled>Upgrade Plan (Coming Soon)</Button>
                              </div>
                           </div>

                            {/* Badge Collection */}
                           <div className="mt-6">
                               <h4 className="text-base font-semibold mb-3">Achievements</h4>
                               {badges && badges.length > 0 ? (
                                  <BadgeCollection userBadges={badges} />
                               ) : (
                                  <p className="text-sm text-muted-foreground">Generate more posts to unlock badges!</p>
                               )}
                           </div>
                           {/* Confetti effect trigger */}
                             {isClient && showConfetti && (
                                 <Confetti
                                     recycle={false}
                                     numberOfPieces={200}
                                     width={typeof window !== 'undefined' ? window.innerWidth : 0}
                                     height={typeof window !== 'undefined' ? window.innerHeight : 0}
                                     className="!fixed !top-0 !left-0 !w-full !h-full !z-[10002]" // Ensure higher z-index than dialog
                                     onConfettiComplete={() => setShowConfetti(false)}
                                 />
                             )}

                         </TabsContent>

                          {/* Removed Integrations Tab */}

                       </Tabs>
                     </form>
                 </Form>
            </div>
        </ScrollArea>
        <DialogFooter className="px-6 pb-6 pt-4 border-t">
             <DialogClose asChild>
                 <Button type="button" variant="outline">
                     Cancel
                 </Button>
             </DialogClose>
             {/* Trigger form submission via react-hook-form */}
             <Button type="submit" form="profile-form-id" onClick={form.handleSubmit(onSubmit)} disabled={loading || dbSetupError || !form.formState.isDirty}>
                 {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                 Save Changes
             </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
