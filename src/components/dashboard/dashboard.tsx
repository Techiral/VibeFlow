
// dashboard.tsx
'use client';

import type { User } from '@supabase/supabase-js';
import type { Profile, Quota } from '@/types/supabase'; // Import specific types
import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { LogOut, Loader2, Bot, Twitter, Linkedin, Youtube, Copy, Send, Wand2, Info, BarChart, Zap, User as UserIcon } from 'lucide-react'; // Added UserIcon
import { summarizeContent, type SummarizeContentOutput } from '@/ai/flows/summarize-content';
import { generateSocialPosts, type GenerateSocialPostsOutput } from '@/ai/flows/generate-social-posts';
import { tuneSocialPosts, type TuneSocialPostsOutput } from '@/ai/flows/tune-social-posts';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from 'next/link';
import { ProfileDialog } from './profile-dialog'; // Import the new dialog
import { Progress } from "@/components/ui/progress"; // Import Progress component

interface DashboardProps {
  user: User;
  initialProfile: Profile | null;
  initialQuota: Quota | null;
}

type SocialPlatform = 'linkedin' | 'twitter' | 'youtube';
type PostDrafts = {
  [key in SocialPlatform]?: string;
};
type TuningStates = {
  [key in SocialPlatform]?: boolean;
};
type PublishStates = {
  [key in SocialPlatform]?: boolean;
};

// Define default quota limit
const DEFAULT_QUOTA_LIMIT = 100;

export default function Dashboard({ user, initialProfile, initialQuota }: DashboardProps) {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [contentInput, setContentInput] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [postDrafts, setPostDrafts] = useState<PostDrafts>({});
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingPosts, setIsGeneratingPosts] = useState(false);
  const [isTuning, setIsTuning] = useState<TuningStates>({});
  const [isPublishing, setIsPublishing] = useState<PublishStates>({});
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [quota, setQuota] = useState<Quota | null>(initialQuota);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

  const quotaUsed = quota?.request_count ?? 0;
  const quotaLimit = quota?.quota_limit ?? DEFAULT_QUOTA_LIMIT;
  const quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
  const quotaExceeded = quotaRemaining <= 0;

  // Fetch or create profile/quota if they weren't passed initially (e.g., first login after creation)
  useEffect(() => {
    const ensureData = async () => {
      let currentProfile = profile;
      let currentQuota = quota;

      if (!currentProfile) {
         try {
            const { data, error } = await supabase
              .rpc('get_user_profile', { p_user_id: user.id }); // Use RPC function

             if (error) throw error;
             if (data) {
                 currentProfile = data as Profile;
                 setProfile(currentProfile);
             } else {
                // This case should ideally be handled by the RPC creating the profile
                 console.warn("Profile still null after calling get_user_profile");
             }
         } catch (error: any) {
             console.error("Error fetching/creating profile on client:", error.message);
             toast({ title: "Profile Error", description: "Could not load your profile data.", variant: "destructive" });
         }
      }

      if (!currentQuota) {
        try {
          const { data, error } = await supabase
            .from('quotas')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (error && error.code === 'PGRST116') { // Not found, create it
             const { data: newQuota, error: createError } = await supabase
                .from('quotas')
                .insert({ user_id: user.id }) // Rely on DB defaults
                .select()
                .single();
             if (createError) throw createError;
             currentQuota = newQuota;
             setQuota(currentQuota);
          } else if (error) {
              throw error; // Other error
          } else {
              currentQuota = data;
              setQuota(currentQuota);
          }
        } catch (error: any) {
          console.error("Error fetching/creating quota on client:", error.message);
          toast({ title: "Quota Error", description: "Could not load your usage data.", variant: "destructive" });
        }
      }
    };

    ensureData();
  }, [user.id, supabase, toast, profile, quota]); // Rerun if profile/quota state changes


  // Function to handle profile updates from the dialog
  const handleProfileUpdate = (updatedProfile: Profile) => {
    setProfile(updatedProfile);
    // Potentially update quota state as well if limit changes
    // setQuota(prev => ({ ...prev, quota_limit: updatedProfile.some_new_limit_field ?? DEFAULT_QUOTA_LIMIT }));
    toast({ title: "Profile Updated", description: "Your profile information has been saved." });
  };

   // Function to check quota and increment if allowed
  const checkAndIncrementQuota = async (incrementAmount: number = 1): Promise<boolean> => {
     if (!quota) {
         toast({ title: "Quota Error", description: "Usage data not loaded. Please refresh.", variant: "destructive" });
         return false;
     }

    if (quotaExceeded) {
      toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
      return false;
    }

     // Optimistic UI update (optional but improves UX)
     const optimisticQuota = { ...quota, request_count: quota.request_count + incrementAmount };
     setQuota(optimisticQuota);

    try {
        const { data: newRemaining, error } = await supabase.rpc('increment_quota', {
           p_user_id: user.id,
           p_increment_amount: incrementAmount
        });

       if (error) {
          // Revert optimistic update on error
          setQuota(quota); // Revert to original quota
          console.error("Error incrementing quota:", error.message);
          if (error.message.includes("quota_exceeded")) {
             toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
          } else {
             toast({ title: "Quota Error", description: "Failed to update usage count.", variant: "destructive" });
          }
          return false;
       }

       // Update state with actual remaining count if RPC returns it (modify RPC if needed)
       // Assuming increment_quota returns the *new remaining* quota
        const actualQuota = { ...quota, request_count: quotaLimit - newRemaining };
        setQuota(actualQuota);

       if (newRemaining < 0) { // Should be caught by DB check, but belt-and-suspenders
           toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
           return false;
       }

      return true; // Increment successful
    } catch (rpcError: any) {
        // Revert optimistic update on RPC error
        setQuota(quota);
      console.error("RPC Error incrementing quota:", rpcError.message);
      toast({ title: "Quota Error", description: "An unexpected error occurred updating usage.", variant: "destructive" });
      return false;
    }
  };


  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: "Error Signing Out", description: error.message, variant: "destructive" });
    } else {
      router.push('/login'); // Redirect to login page after sign out
      router.refresh(); // Refresh server components
    }
  };

 const handleGenerate = async () => {
     // 1. Check Gemini API Key
    if (!profile?.gemini_api_key) {
       toast({
          title: "API Key Missing",
          description: "Please add your Google Gemini API key in your profile.",
          variant: "destructive",
       });
       setIsProfileDialogOpen(true); // Open profile dialog
       return;
    }

    // 2. Check Quota
    if (!await checkAndIncrementQuota(3)) { // Check and increment by 3 (1 summary + 2 posts initially shown)
       return;
    }

    if (!contentInput.trim()) {
      toast({ title: "Input Required", description: "Please enter content or a URL.", variant: "destructive" });
       // No quota used yet, so no need to revert
      return;
    }

    setIsGeneratingSummary(true);
    setIsGeneratingPosts(true);
    setSummary(null);
    setPostDrafts({});

    // Pass API key to the AI flows
    const apiKey = profile.gemini_api_key;

    startTransition(async () => {
        try {
        // --- Quota already checked and incremented ---

        // 1. Summarize Content
        const summaryResult = await summarizeContent({ content: contentInput }, { apiKey });
        setSummary(summaryResult.summary);
        setIsGeneratingSummary(false); // Summary done

        // 2. Generate Posts for all platforms concurrently
        const platforms: SocialPlatform[] = ['linkedin', 'twitter', 'youtube'];
        const postPromises = platforms.map(platform =>
          generateSocialPosts({ summary: summaryResult.summary, platform }, { apiKey })
            .then(result => ({ platform, post: result.post }))
            .catch(async (err) => { // Make catch async
               console.error(`Error generating ${platform} post:`, err);
               // Decrement quota if generation failed for this specific post
               await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -1 });
               setQuota(prev => prev ? { ...prev, request_count: prev.request_count - 1 } : null);

                let description = `Error generating ${platform} post.`;
                if (err.message.includes("API key not valid")) {
                   description = "AI service configuration error (API key). Please check your profile."
                } else if (err.message.includes("503") || err.message.toLowerCase().includes("overloaded")) {
                    description = `AI service is temporarily overloaded generating ${platform} post. Please try again later.`;
                }
                toast({ title: "Generation Failed", description: description, variant: "destructive" });
               return { platform, post: `Error generating post for ${platform}.` };
            })
        );

        const results = await Promise.all(postPromises);
        const newDrafts = results.reduce((acc, { platform, post }) => {
          acc[platform] = post;
          return acc;
        }, {} as PostDrafts);

        setPostDrafts(newDrafts);

      } catch (error: any) {
        console.error("Generation failed:", error);
        // Revert the initial quota increment if the whole process fails (e.g., summarization)
        await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -3 });
        setQuota(prev => prev ? { ...prev, request_count: prev.request_count - 3 } : null);

        let description = "An error occurred during generation.";
        // No longer check quota exceeded here, as checkAndIncrement handles it
        if (error.message.includes("parsing")) {
           description = "Could not parse content from the URL. Please check the URL or paste text directly.";
        } else if (error.message.includes("API key not valid")) {
           description = "AI service configuration error (API key). Please check your profile."
        } else if (error.message.includes("503") || error.message.toLowerCase().includes("overloaded")) {
            description = "AI service is temporarily overloaded during summarization. Please try again later.";
        }
        toast({ title: "Generation Failed", description: description, variant: "destructive" });
         setSummary(null); // Clear summary on error
         setPostDrafts({}); // Clear drafts on error
      } finally {
        setIsGeneratingSummary(false); // Ensure both are false at the end
        setIsGeneratingPosts(false);
      }
    });
  };

 const handleTunePost = async (platform: SocialPlatform, feedback: string) => {
    // 1. Check API Key
    if (!profile?.gemini_api_key) {
       toast({ title: "API Key Missing", description: "Please add your Google Gemini API key in your profile.", variant: "destructive" });
       setIsProfileDialogOpen(true);
       return;
    }

    // 2. Check and Increment Quota
    if (!await checkAndIncrementQuota(1)) {
        return;
    }

    const originalPost = postDrafts[platform];
    if (!originalPost) return; // Should not happen if button is enabled

    setIsTuning(prev => ({ ...prev, [platform]: true }));
    const apiKey = profile.gemini_api_key;

    startTransition(async () => {
      try {
        // --- Quota already checked ---
        const tunedResult = await tuneSocialPosts({ originalPost, feedback }, { apiKey });
        setPostDrafts(prev => ({ ...prev, [platform]: tunedResult.tunedPost }));
         toast({ title: "Post Tuned!", description: `Applied feedback: "${feedback}"`, variant: "default" });
      } catch (error: any) {
        console.error(`Tuning ${platform} post failed:`, error);
        // Revert quota increment on failure
        await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -1 });
        setQuota(prev => prev ? { ...prev, request_count: prev.request_count - 1 } : null);

         let description = "An error occurred while tuning the post.";
          // No longer check quota exceeded here
          if (error.message.includes("API key not valid")) {
             description = "AI service configuration error (API key). Please check your profile."
          } else if (error.message.includes("503") || error.message.toLowerCase().includes("overloaded")) {
              description = "AI service is temporarily overloaded. Please try tuning again later.";
          }
        toast({ title: "Tuning Failed", description: description, variant: "destructive" });
      } finally {
        setIsTuning(prev => ({ ...prev, [platform]: false }));
      }
    });
  };

  const handlePublishPost = async (platform: SocialPlatform) => {
    // 1. Check Composio URL (if applicable for publishing)
    if (!profile?.composio_url) {
        toast({ title: "Composio URL Missing", description: "Please add your Composio URL in your profile to enable publishing.", variant: "destructive" });
        setIsProfileDialogOpen(true);
        return;
    }

     // 2. Check and Increment Quota (assuming publishing costs 1 credit)
     if (!await checkAndIncrementQuota(1)) {
         return;
     }

    const postContent = postDrafts[platform];
    if (!postContent) return;

    setIsPublishing(prev => ({ ...prev, [platform]: true }));

    startTransition(async () => {
      try {
        // --- Quota already checked ---

        // Placeholder for actual Composio MCP publishing call using profile.composio_url
        console.log(`Publishing to ${platform} via ${profile.composio_url}:`, postContent);
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call

        // TODO: Replace with actual API call:
        // await publishPost({ platform, content: postContent, composioUrl: profile.composio_url });

        toast({ title: "Post Published!", description: `Successfully published to ${platform}.`, variant: "default" });

      } catch (error: any) {
         console.error(`Publishing to ${platform} failed:`, error);
         // Revert quota increment on failure
         await supabase.rpc('increment_quota', { p_user_id: user.id, p_increment_amount: -1 });
         setQuota(prev => prev ? { ...prev, request_count: prev.request_count - 1 } : null);

         let description = "An error occurred while publishing the post.";
          // No longer check quota exceeded here
          if (error.message.includes("authentication") || error.message.includes("connect")) { // Example error check
              description = `Please connect your ${platform} account via Composio first.`
              // TODO: Add link/button to connect account via Composio OAuth flow (using profile.composio_url?)
          } else if (error.message.includes("invalid Composio URL")) {
               description = "Invalid Composio URL in profile. Please check and update.";
               setIsProfileDialogOpen(true);
          }
        toast({ title: "Publishing Failed", description: description, variant: "destructive" });
      } finally {
        setIsPublishing(prev => ({ ...prev, [platform]: false }));
      }
   });
  };

  const copyToClipboard = (text: string | undefined) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: "Copied!", description: "Post content copied to clipboard." }))
      .catch(err => toast({ title: "Copy Failed", description: "Could not copy text.", variant: "destructive" }));
  };


  return (
    <TooltipProvider>
    <div className="flex flex-col min-h-screen bg-background text-foreground p-4 md:p-8">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 md:mb-8">
         <Link href="/" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
           <Zap className="h-6 w-6 text-primary" />
           <h1 className="text-2xl font-bold text-gradient">VibeFlow</h1>
         </Link>
        <div className="flex items-center gap-3 md:gap-4">
           {/* Quota Display */}
           {quota !== null ? (
             <Tooltip>
               <TooltipTrigger asChild>
                  <div className="flex flex-col items-end cursor-help">
                     <div className="flex items-center gap-1 text-sm text-muted-foreground">
                       <BarChart className="h-4 w-4" />
                       <span>{quotaUsed} / {quotaLimit} used</span>
                     </div>
                      <Progress value={(quotaUsed / quotaLimit) * 100} className="w-20 h-1 mt-0.5" />
                  </div>
               </TooltipTrigger>
               <TooltipContent>
                 <p>Requests used this month.</p>
                  {/* Add billing info/link here later */}
               </TooltipContent>
             </Tooltip>
           ) : (
               <div className="flex items-center gap-1 text-sm text-muted-foreground">
                   <Loader2 className="h-4 w-4 animate-spin"/>
                   <span>Loading quota...</span>
               </div>
           )}

          {/* Profile Button/Dialog Trigger */}
          <Tooltip>
             <TooltipTrigger asChild>
                 <Button variant="ghost" size="icon" onClick={() => setIsProfileDialogOpen(true)}>
                   <UserIcon className="h-5 w-5" />
                 </Button>
             </TooltipTrigger>
             <TooltipContent><p>Profile & Settings</p></TooltipContent>
           </Tooltip>

           {/* Sign Out Button */}
          <Tooltip>
             <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleSignOut}>
                  <LogOut className="h-5 w-5" />
                </Button>
             </TooltipTrigger>
             <TooltipContent><p>Sign Out</p></TooltipContent>
          </Tooltip>
        </div>
      </header>

       {/* Quota Exceeded Alert */}
       {quotaExceeded && (
          <Alert variant="destructive" className="mb-6">
             <Info className="h-4 w-4" />
            <AlertTitle>Quota Limit Reached</AlertTitle>
            <AlertDescription>
              You've used all your requests for this month. Please{' '}
                {/* Add link to upgrade/billing page here */}
                <Button variant="link" className="p-0 h-auto text-destructive-foreground underline" onClick={() => setIsProfileDialogOpen(true)}>upgrade your plan</Button>
                {' '}or wait until next month.
            </AlertDescription>
          </Alert>
        )}

      {/* Main Content Area */}
      <main className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">

        {/* Input Section */}
        <Card className="bg-card/80 border-border/30 shadow-lg flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot className="text-primary" /> Content Input</CardTitle>
            <CardDescription>Enter a URL (article, video) or paste raw text below.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <Textarea
              placeholder="Paste your content or URL here..."
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              className="min-h-[200px] md:min-h-[300px] lg:min-h-[400px] bg-input/50 border-border/50 text-base resize-none h-full" // Make textarea take available height
              disabled={isPending || quotaExceeded} // Disable during any transition
            />
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleGenerate}
              disabled={isPending || !contentInput.trim() || quotaExceeded || !profile?.gemini_api_key} // Also disable if key is missing
              loading={isGeneratingSummary || isGeneratingPosts} // Show loading only for generation
              className="w-full md:w-auto ml-auto"
            >
              <Wand2 className="mr-2" /> Generate Posts
            </Button>
          </CardFooter>
        </Card>

        {/* Output Section */}
        <Card className="bg-card/80 border-border/30 shadow-lg flex flex-col">
          <CardHeader>
            <CardTitle>Generated Drafts</CardTitle>
            <CardDescription>Review, tune, and publish your social media posts.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow"> {/* Make content area grow */}
             {(isGeneratingSummary || isGeneratingPosts) && (
                <div className="flex h-full items-center justify-center p-10 text-muted-foreground">
                   <Loader2 className="h-8 w-8 animate-spin mr-3" />
                   <span>Generating content...</span>
                </div>
             )}

            {!(isGeneratingSummary || isGeneratingPosts) && !summary && Object.keys(postDrafts).length === 0 && (
                <div className="flex h-full items-center justify-center p-10 text-muted-foreground">
                   <p>Your generated posts will appear here.</p>
                </div>
             )}

            {summary && Object.keys(postDrafts).length > 0 && (
              <Tabs defaultValue="linkedin" className="w-full flex flex-col h-full"> {/* Flex column for tabs */}
                <TabsList className="grid w-full grid-cols-3 bg-muted/50 mb-4 shrink-0"> {/* Prevent list from growing */}
                  <TabsTrigger value="linkedin"><Linkedin className="h-4 w-4 mr-1 inline"/> LinkedIn</TabsTrigger>
                  <TabsTrigger value="twitter"><Twitter className="h-4 w-4 mr-1 inline"/> Twitter</TabsTrigger>
                  <TabsTrigger value="youtube"><Youtube className="h-4 w-4 mr-1 inline"/> YouTube</TabsTrigger>
                </TabsList>

                {/* Make TabsContent grow */}
                {(['linkedin', 'twitter', 'youtube'] as SocialPlatform[]).map((platform) => (
                  <TabsContent key={platform} value={platform} className="flex-grow mt-0">
                    <Card className="bg-background border-border/50 h-full flex flex-col"> {/* Full height card */}
                      <CardContent className="p-4 space-y-4 relative flex-grow"> {/* Content grows */}
                        {isTuning[platform] && (
                           <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-md">
                              <Loader2 className="h-6 w-6 animate-spin text-primary-foreground"/>
                           </div>
                         )}
                        <Textarea
                          value={postDrafts[platform] || ''}
                          readOnly // Make textarea read-only, tuning happens via buttons
                          className="min-h-[150px] bg-input/30 border-border/30 resize-none text-sm h-full" // Full height textarea
                        />
                        {/* Tuning Buttons */}
                         <div className="flex flex-wrap gap-2 shrink-0"> {/* Prevent tuning buttons from growing */}
                          <span className="text-xs text-muted-foreground mr-2 mt-1.5">Tune:</span>
                           <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'Make wittier')} disabled={isPending || quotaExceeded || !postDrafts[platform]}>Witty</Button>
                           <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'More concise')} disabled={isPending || quotaExceeded || !postDrafts[platform]}>Concise</Button>
                           <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'More professional')} disabled={isPending || quotaExceeded || !postDrafts[platform]}>Professional</Button>
                           <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'Add emojis')} disabled={isPending || quotaExceeded || !postDrafts[platform]}>Add Emojis ✨</Button>
                         </div>
                      </CardContent>
                      <CardFooter className="flex justify-end gap-2 shrink-0"> {/* Prevent footer from growing */}
                        <Tooltip>
                           <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => copyToClipboard(postDrafts[platform])} disabled={!postDrafts[platform] || isPublishing[platform]}>
                                 <Copy className="h-4 w-4" />
                              </Button>
                           </TooltipTrigger>
                           <TooltipContent><p>Copy Post</p></TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              onClick={() => handlePublishPost(platform)}
                              disabled={!postDrafts[platform] || isPending || quotaExceeded || !profile?.composio_url} // Disable if no composio URL
                              loading={isPublishing[platform]}
                              size="sm"
                            >
                              <Send className="mr-1.5 h-4 w-4" /> Publish to {platform.charAt(0).toUpperCase() + platform.slice(1)}
                            </Button>
                          </TooltipTrigger>
                           <TooltipContent>
                             {!profile?.composio_url
                                ? <p>Add Composio URL in profile to publish</p>
                                : <p>Publish this post (placeholder)</p>
                             }
                           </TooltipContent>
                        </Tooltip>

                      </CardFooter>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>

      </main>

      {/* Footer (optional) */}
      <footer className="text-center mt-8 text-xs text-muted-foreground">
        Powered by Gemini & Composio | Built for the Hackathon
      </footer>

       {/* Profile Dialog */}
       <ProfileDialog
          isOpen={isProfileDialogOpen}
          onOpenChange={setIsProfileDialogOpen}
          user={user}
          initialProfile={profile}
          initialQuota={quota}
          onProfileUpdate={handleProfileUpdate}
        />
    </div>
    </TooltipProvider>
  );
}

// Placeholder API interaction functions (to be moved to API routes/server actions)

// async function publishPost(data: { platform: SocialPlatform; content: string }): Promise<void> {
//   // Replace with actual API call to POST /api/publish
//   console.log(`Calling API to publish to ${data.platform}...`);
//   await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API latency
//   // Simulate potential API error (e.g., 10% chance of failure)
//    if (Math.random() < 0.1) {
//       throw new Error("Failed to publish post via API.");
//    }
//   console.log("Publish API call successful.");
// }
