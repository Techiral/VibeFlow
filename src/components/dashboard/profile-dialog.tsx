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
import { startComposioLogin } from '@/actions/composio-actions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { OpenAIToolSet, App as ComposioAppEnum } from "composio-core"; // Updated import
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

// Schema includes composio_api_key now
const profileSchema = z.object({
  full_name: z.string().max(100, 'Full name must be 100 characters or less').nullable().optional().or(z.literal('')),
  username: z.string().max(50, 'Username must be 50 characters or less').nullable().optional().or(z.literal('')),
  phone_number: z.string().max(20, 'Phone number must be 20 characters or less').nullable().optional().or(z.literal('')),
  composio_mcp_url: z.string().url('Invalid MCP URL format (e.g., https://...)').max(255, 'URL too long').nullable().optional().or(z.literal('')),
  linkedin_url: z.string().url('Invalid LinkedIn URL format (e.g., https://...)').max(255, 'URL too long').nullable().optional().or(z.literal('')),
  twitter_url: z.string().url('Invalid Twitter URL format (e.g., https://...)').max(255, 'URL too long').nullable().optional().or(z.literal('')),
  youtube_url: z.string().url('Invalid YouTube URL format (e.g., https://...)').max(255, 'URL too long').nullable().optional().or(z.literal('')),
  gemini_api_key: z.string().max(255, 'API Key must be 255 characters or less').nullable().optional().or(z.literal('')),
  composio_api_key: z.string().max(255, 'Composio API Key must be 255 characters or less').nullable().optional().or(z.literal('')), // Added Composio API key
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

// Authenticate App Function - Calls the backend API
async function authenticateComposioApp(
    appName: ComposioApp,
    userId: string
): Promise<{ success: boolean; authUrl?: string; error?: string }> {
    console.log(`Initiating app authentication for ${appName}...`);

    try {
        // Call the backend API route
        const response = await fetch('/api/auth/composio/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appName: appName, userId: userId }) // Send appName and userId
        });

        const result = await response.json();

        if (response.ok && result.redirectUrl) {
             console.log(`API call successful, redirect URL: ${result.redirectUrl}`);
             // The redirection will be handled by the calling function (handleAuthenticateApp)
             return { success: true, authUrl: result.redirectUrl };
        } else {
             // Handle errors from the API route
             const errorMsg = result.error || `Could not initiate authentication for ${appName}. Server responded with status ${response.status}.`;
             console.error(`API Composio Connect Error for ${appName}:`, errorMsg);
             return { success: false, error: errorMsg };
        }
    } catch (error: any) {
        console.error(`Error calling authentication API for ${appName}:`, error);
        return { success: false, error: error.message || 'Unknown error during authentication API call.' };
    }
}

// Function to handle the composio login process via server action
async function getComposioKeyViaServerAction(): Promise<{ success: boolean; key?: string | null; error?: string }> {
    console.log("Attempting Composio key retrieval via server action...");
    try {
       const result = await startComposioLogin(); // Call the server action
       if (result.success && result.key) {
           console.log("Composio key retrieved successfully via server action.");
           return { success: true, key: result.key };
       } else {
           const errorMsg = result.error || "Failed to get Composio API key via server action.";
           console.error(errorMsg);
           return { success: false, error: errorMsg };
       }
    } catch (error: any) {
        console.error("Error calling startComposioLogin server action:", error);
        return { success: false, error: error.message || 'Unknown error calling server action.' };
    }
}

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
    // Include composio_api_key from composioStatus state, not just form data
    const updateData = {
        ...Object.fromEntries(
            Object.entries(data).filter(([key, value]) => value !== null && value !== '' && key !== 'composio_api_key') // Exclude key from form data
        ),
        composio_api_key: composioStatus.apiKey, // Explicitly use the state value
        updated_at: new Date().toISOString(),
    };

    // Handle case where API key might be explicitly removed (set to null)
    if (composioStatus.apiKey === null && profile?.composio_api_key !== null) {
        updateData.composio_api_key = null; // Ensure DB gets null if removed
    } else if (composioStatus.apiKey === null && profile?.composio_api_key === null) {
        delete updateData.composio_api_key; // Don't send null if it was already null
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
           }
          toast({ title: 'Save Failed', description: errorMessage, variant: 'destructive', duration: 7000 });
        } else if (updatedProfileData) {
          const completeProfile = updatedProfileData as Profile;
          setProfile(completeProfile); // Update local state
          setComposioStatus(prev => ({ ...prev, apiKey: completeProfile.composio_api_key ?? null })); // Ensure status matches saved state
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
    if (!profile?.composio_mcp_url) {
        toast({ title: "Composio URL Missing", description: "Please enter your Composio MCP URL in profile first.", variant: "destructive" });
        return;
    }

    setIsComposioAuthenticating(prev => ({...prev, [appName]: true}));

    try {
        // Call the API route
        console.log(`Calling API /api/auth/composio/connect for ${appName} with MCP: ${profile.composio_mcp_url}`);
        const result = await authenticateComposioApp(appName, user.id);
        console.log(`authenticateComposioApp API for ${appName} returned:`, result.success);

        if (result.success && result.authUrl) {
            console.log(`Redirecting user to Composio OAuth URL: ${result.authUrl}`);
            window.location.href = result.authUrl; // Redirect the user
        } else {
            console.error(`Authentication initiation failed for ${appName}:`, result.error);
            toast({ title: `${appName} Auth Failed`, description: result.error || `Could not initiate authentication for ${appName}.`, variant: "destructive" });
            setIsComposioAuthenticating(prev => ({...prev, [appName]: false}));
        }
    } catch (error: any) {
        console.error(`Error in handleAuthenticateApp for ${appName}:`, error);
        toast({ title: `${appName} Auth Error`, description: error.message || 'Unknown error during authentication.', variant: 'destructive' });
        setIsComposioAuthenticating(prev => ({...prev, [appName]: false}));
    }
 }, [user.id, toast, localDbSetupError, profile?.composio_mcp_url]);


  const handleUpgrade = () => {
    toast({ title: "Upgrade Feature", description: "Billing/Upgrade functionality is not yet implemented.", variant: "default" });
  };

  const getAuthStatus = (appName: ComposioApp): boolean => {
     const key = `is_${appName}_authed` as keyof Profile;
     return !!profile?.[key];
  }

   const quotaUsed = quota?.request_count ?? 0;
   const quotaLimit = quota?.quota_limit ?? DEFAULT_QUOTA_LIMIT;
   const quotaPercentage = (quotaUsed / quotaLimit) * 100;
   const quotaExceeded = quotaPercentage > 100;

  return (
    
       
        
          
            Profile &amp; Settings
          
          
            Manage your profile, API keys, app connections, and usage.
          
        
        {localDbSetupError &amp;&amp; (
          
            
              
              Database Setup/Configuration Issue
            
            {localDbSetupError}
          
        )}

        
          
            
              {/* Profile Form */}
              
                
                  
                    User Information
                  
                  
                    
                      Email
                      
                      N/A
                    
                    
                      Full Name
                      
                      
                        
                         {...register('full_name')} className={`${errors.full_name ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} /&gt;
                        {errors.full_name &amp;&amp; {errors.full_name.message}}
                      
                    
                    
                      Username
                      
                      
                         {...register('username')} className={`${errors.username ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} /&gt;
                        {errors.username &amp;&amp; {errors.username.message}}
                      
                    
                    
                      Phone
                      
                      
                         {...register('phone_number')} className={`${errors.phone_number ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} /&gt;
                        {errors.phone_number &amp;&amp; {errors.phone_number.message}}
                      
                    
                  
                

                
                {/* Integrations Section */}
                
                  
                     Integrations
                  
                  
                     {/* Gemini API Key */}
                     
                       
                         Gemini Key
                       
                       
                         
                           
                             {...register('gemini_api_key')}
                             placeholder="Enter your Google Gemini API Key"
                             className={`${errors.gemini_api_key ? 'border-destructive' : ''}`}
                             disabled={!!localDbSetupError}
                           /&gt;
                           {errors.gemini_api_key &amp;&amp; {errors.gemini_api_key.message}}
                           
                             Get key from Google AI Studio . Required for generation.
                           
                         
                       
                     

                      {/* Composio MCP URL */}
                      
                          Composio MCP URL
                          
                          
                            
                              {...register('composio_mcp_url')}
                              placeholder="e.g., https://mcp.composio.dev/u/your-id"
                              className={`${errors.composio_mcp_url ? 'border-destructive' : ''}`}
                              disabled={!!localDbSetupError}
                            /&gt;
                            {errors.composio_mcp_url &amp;&amp; {errors.composio_mcp_url.message}}
                            
                              Find in your Composio MCP dashboard . Needed for app authentication redirects.
                            
                          
                      

                      {/* LinkedIn/Twitter/YouTube URLs - Kept for reference if needed */}
                      
                          LinkedIn URL (Ref)
                           
                           
                              {...register('linkedin_url')} placeholder="Optional: Your LinkedIn profile URL" className={`${errors.linkedin_url ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} /&gt;
                              {errors.linkedin_url &amp;&amp; {errors.linkedin_url.message}}
                           
                      
                      
                          Twitter URL (Ref)
                           
                           
                              {...register('twitter_url')} placeholder="Optional: Your Twitter profile URL" className={`${errors.twitter_url ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} /&gt;
                              {errors.twitter_url &amp;&amp; {errors.twitter_url.message}}
                           
                      
                      
                          YouTube URL (Ref)
                           
                           
                             {...register('youtube_url')} placeholder="Optional: Your YouTube channel URL" className={`${errors.youtube_url ? 'border-destructive' : ''}`} disabled={!!localDbSetupError} /&gt;
                             {errors.youtube_url &amp;&amp; {errors.youtube_url.message}}
                           
                      
                   
                 
               
             {/* Quota Adjustment for Tuning ---*/}
             
           

           

           {/* Gamification Section */}
           
              
                 AI Fuel &amp; Badges
              
              
                 
                    Experience Points (XP):
                    {xp?.toLocaleString() ?? 0} XP
                 
                  
                   

                 
                     
                     {(badges ?? []).length > 0 ? ( // Check if badges array exists and has items
                        
                          {(badges || []).map((badgeName) =&gt; { // Add fallback for badges
                            const badgeInfo = BADGES.find(b =&gt; b.name === badgeName);
                            const Icon = badgeInfo?.icon || BadgeCheck;
                            return (
                              
                               
                                   
                                       
                                        {badgeName}
                                   
                                   {badgeInfo &amp;&amp; (
                                     
                                       
                                         
                                           
                                         
                                       
                                       {badgeInfo.description}
                                     
                                   )}
                                
                              
                            );
                          })}
                        
                      ) : (
                        Keep generating posts to unlock badges!
                      )}
                   
              
           

           

           {/* Billing/Quota Section */}
           
             
                Usage &amp; Billing
             
             {localDbSetupError &amp;&amp; !localDbSetupError.includes('quota') ? (
               
                 
                   Usage Data Issue
                 
                 Cannot load usage data due to a profile or database setup issue.
               
             ) : quota !== null ? (
               
                 
                    Monthly Requests Used:
                    {quotaUsed} / {quotaLimit}
                 
                  
                 {quotaExceeded &amp;&amp; (
                   
                     
                       Quota Limit Reached
                     
                     Upgrade to continue generating posts.
                   
                 )}
                 
                   
                     Upgrade
                   
                 
                 {quota.last_reset_at &amp;&amp; (
                   
                     Quota resets on: {new Date(new Date(quota.last_reset_at).setMonth(new Date(quota.last_reset_at).getMonth() + 1)).toLocaleDateString()}
                   
                 )}
               
             ) : (
               
                 {localDbSetupError &amp;&amp; localDbSetupError.includes('quota') ? (
                   
                     Error loading quota.
                   
                 ) : (
                   
                     Loading usage data...
                   
                 )}
               
             )}
           
         
       

       
         
           
             Cancel
           
           
             Save Changes
           
         
       
     
  );
}
