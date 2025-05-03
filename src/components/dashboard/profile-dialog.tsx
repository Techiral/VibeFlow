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
import { AlertCircle, Loader2, User as UserIcon, Save, X, Lock, BrainCircuit, Trophy, Star, HelpCircle, Zap } from 'lucide-react';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Progress } from '@/components/ui/progress';
import BadgeCollection from './badge-collection'; // Import the badge collection
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
// Removed import { handleDeauthenticateApp } from '@/services/composio-service'; // Corrected import
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
// import { App as ComposioAppEnum } from "composio-core"; // Import Composio App enum - Removed as Composio is removed
import { toast as sonnerToast } from 'sonner'; // Import sonner toast for confetti effect
import Confetti from 'react-confetti';
import { cn } from '@/lib/utils'; // Import cn

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

// Define Zod schema for profile validation - Removed Composio fields
const profileSchema = z.object({
  full_name: z.string().max(100, 'Full name must be 100 characters or less').nullable().optional().or(z.literal('')),
  username: z.string().max(50, 'Username must be 50 characters or less').nullable().optional().or(z.literal('')),
  phone_number: z.string().max(20, 'Phone number must be 20 characters or less').nullable().optional().or(z.literal('')),
  gemini_api_key: z.string().max(255, 'API Key must be 255 characters or less').nullable().optional().or(z.literal('')),
  // Removed composio_mcp_url, linkedin_url, twitter_url, youtube_url
  // Removed composio_api_key
});

type ProfileFormData = z.infer<typeof profileSchema>;

// Define badge thresholds and details (duplicate from dashboard for now)
const BADGES = [
  { xp: 50, name: 'Vibe Starter ✨', description: 'Generated 5 posts!', icon: Star },
  { xp: 100, name: 'Content Ninja 🥷', description: 'Generated 10 posts!', icon: Trophy },
  { xp: 200, name: 'Social Samurai ⚔️', description: 'Generated 20 posts!', icon: Zap }, // Assuming Zap is defined elsewhere or replaced
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
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfileFunctionReturn | null>(initialProfile);
  const [quota, setQuota] = useState<Quota | null>(initialQuota);
  const [xp, setXp] = useState<number>(initialXp);
  const [badges, setBadges] = useState<string[]>([]); // Initialize as empty array
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false); // State for confetti effect
  // Removed authLoading state

  useEffect(() => {
    setIsClient(true);
    // Ensure initialBadges is treated as an array, even if null/undefined initially
    setBadges(initialBadges ?? []);
  }, [initialBadges]);


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


  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: '',
      username: '',
      phone_number: '',
      gemini_api_key: '',
      // Removed Composio fields
    },
  });

  // Reset form when initialProfile changes and hydrate default values
  useEffect(() => {
    if (initialProfile) {
      form.reset({
        full_name: initialProfile.full_name ?? '',
        username: initialProfile.username ?? '',
        phone_number: initialProfile.phone_number ?? '',
        gemini_api_key: initialProfile.gemini_api_key ?? '',
        // Removed Composio fields
      });
    } else {
      // Optionally reset to empty if profile is null
       form.reset({
         full_name: '',
         username: '',
         phone_number: '',
         gemini_api_key: '',
         // Removed Composio fields
       });
    }
    setError(null); // Clear errors when profile reloads
  }, [initialProfile, form]);


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
        // Removed Composio fields from update
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

  // Removed Composio Authentication Handler

  // Calculate quota percentage
  const quotaPercentage = quota && quota.quota_limit > 0
    ? ((quota.request_count ?? 0) / quota.quota_limit) * 100 // Handle null request_count
    : 0;
  const quotaTooltipContent = quota
    ? `${quota.request_count ?? 0} / ${quota.quota_limit ?? 100} requests used this cycle.`
    : "Loading quota...";
  const isQuotaExceeded = quota ? (quota.request_count ?? 0) >= (quota.quota_limit ?? 100) : false;


  // Calculate XP Percentage for next level
   const getCurrentLevelInfo = (currentXp: number) => {
     let currentLevel = 0;
     let nextLevelXp = BADGES.find(b => !b.hidden)?.xp || 50; // Use hidden property if defined
     let currentLevelXpThreshold = 0;
     const sortedVisibleBadges = BADGES.filter(b => !b.hidden).sort((a, b) => a.xp - b.xp);

     for (let i = 0; i < sortedVisibleBadges.length; i++) {
       if (currentXp >= sortedVisibleBadges[i].xp) {
         currentLevel = i + 1;
         currentLevelXpThreshold = sortedVisibleBadges[i].xp;
         if (i + 1 < sortedVisibleBadges.length) {
           nextLevelXp = sortedVisibleBadges[i + 1].xp;
         } else {
           // If it's the last badge, set a hypothetical next level
           nextLevelXp = currentLevelXpThreshold * 2; // Example: double the last threshold
         }
       } else {
         // If current XP is less than the first badge threshold
         if (i === 0) {
           nextLevelXp = sortedVisibleBadges[0].xp;
         }
         break; // Stop once the current XP level is found
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
       // Use toLocaleDateString for better formatting, check if 'date' is valid
       return !isNaN(resetDate.getTime()) ? resetDate.toLocaleDateString() : 'Invalid Date';
     } catch (e) {
       console.error("Error formatting reset date:", e);
       return 'Invalid Date';
     }
   };

   const { formState: { isDirty } } = form;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-xl grid-rows-[auto_minmax(0,1fr)_auto] max-h-[90vh]">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Profile & Settings</DialogTitle>
          <DialogDescription>
            Manage your profile details, API keys, and usage.
          </DialogDescription>
        </DialogHeader>

        {dbSetupError && (
          <div className="px-6 py-4 border-t border-border">
            <div className="bg-destructive/10 border border-destructive/50 text-destructive p-3 rounded-md text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold">Database Error:</span> Cannot load or save profile/quota due to a database setup issue. Please run the SQL script from <code>supabase/schema.sql</code> in your Supabase project.
              </div>
            </div>
          </div>
        )}

        {error && !dbSetupError && ( // Only show generic error if not DB setup error
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
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" id="profile-form">
                <Tabs defaultValue="profile">
                   <TabsList className="grid w-full grid-cols-3 mb-6"> {/* Changed to 3 columns */}
                    <TabsTrigger value="profile">Profile</TabsTrigger>
                    <TabsTrigger value="keys">API Keys</TabsTrigger>
                    {/* Removed Integrations Tab */}
                    <TabsTrigger value="usage">Usage & Billing</TabsTrigger>
                  </TabsList>

                  {/* Profile Tab */}
                  <TabsContent value="profile" className="space-y-4 mt-0"> {/* Reduced top margin */}
                   <FormField
                     control={form.control}
                     name="full_name"
                     render={({ field }) => (
                       <FormItem>
                         <FormLabel>Full Name</FormLabel>
                         <FormControl>
                           <Input placeholder="Your Full Name" {...field} value={field.value ?? ''} />
                         </FormControl>
                         <FormMessage />
                       </FormItem>
                     )}
                   />
                    <FormField
                      control={form.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                             <Input placeholder="Your Username" {...field} value={field.value ?? ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="phone_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                             <Input type="tel" placeholder="Your Phone Number" {...field} value={field.value ?? ''}/>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={user?.email ?? ''} disabled className="text-muted-foreground bg-muted/50" />
                      <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
                    </div>
                  </TabsContent>

                  {/* API Keys Tab */}
                  <TabsContent value="keys" className="space-y-4 mt-0">
                    <FormField
                      control={form.control}
                      name="gemini_api_key"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="gemini_api_key" className="flex items-center gap-1">
                            <span>Google Gemini API Key</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="focus:outline-none">
                                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>Get your key from Google AI Studio. Required for all AI features.</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </FormLabel>
                          <FormControl>
                             <Input
                                id="gemini_api_key"
                                type="password"
                                placeholder="Enter your Gemini API Key"
                                {...field}
                                value={field.value ?? ''}
                             />
                          </FormControl>
                          <FormMessage />
                          <FormDescription>
                            Your key is stored securely and used only for AI generation on your behalf.
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                     {/* Removed Composio API Key section */}
                  </TabsContent>

                  {/* Integrations Tab - Removed */}


                  {/* Usage & Billing Tab */}
                  <TabsContent value="usage" className="space-y-6 mt-0">
                    <div className="space-y-4 rounded-lg border bg-card text-card-foreground p-4 shadow-sm">
                      <h4 className="text-base font-semibold">Monthly Usage</h4>
                      <TooltipProvider>
                        <Tooltip>
                           <TooltipTrigger asChild>
                               <div className="cursor-default space-y-1">
                                 <div className="flex justify-between text-sm font-medium">
                                   <span>Requests Used</span>
                                   <span>{quota ? `${quota.request_count ?? 0} / ${quota.quota_limit ?? 100}` : <Loader2 className="h-4 w-4 animate-spin inline" />}</span>
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
                           </TooltipTrigger>
                           <TooltipContent side="bottom" align="start">
                              {quotaTooltipContent}
                           </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                           <div className="cursor-default space-y-1 mt-4">
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
                           </TooltipTrigger>
                           <TooltipContent side="bottom" align="start">
                               {xpTooltipContent}
                           </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <Separator className="my-4" />
                      <div>
                        <p className="text-sm mb-2">You are currently on the <span className="font-semibold text-primary">Free Plan</span>.</p>
                        <Button disabled>Upgrade Plan (Coming Soon)</Button>
                      </div>
                    </div>

                    {/* Badge Collection */}
                   <div className="mt-6">
                      <h4 className="text-base font-semibold mb-3">Achievements</h4>
                      {badges && badges.length > 0 ? ( // Check if badges is not null/undefined and has items
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
          <Button type="submit" form="profile-form" disabled={loading || dbSetupError || !isDirty}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
   </Dialog>
  );
}
