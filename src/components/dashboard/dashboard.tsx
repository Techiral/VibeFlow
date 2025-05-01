'use client';

import type { User } from '@supabase/supabase-js';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { LogOut, Loader2, Bot, Twitter, Linkedin, Youtube, Copy, Send, Wand2, Info, BarChart, Zap } from 'lucide-react'; // Import Zap
import { summarizeContent, type SummarizeContentOutput } from '@/ai/flows/summarize-content';
import { generateSocialPosts, type GenerateSocialPostsOutput } from '@/ai/flows/generate-social-posts';
import { tuneSocialPosts, type TuneSocialPostsOutput } from '@/ai/flows/tune-social-posts';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface DashboardProps {
  user: User;
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

export default function Dashboard({ user }: DashboardProps) {
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
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null); // Placeholder for quota
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Placeholder: Fetch initial quota on component mount
  // React.useEffect(() => {
  //   fetchQuota();
  // }, []);

  // const fetchQuota = async () => {
  //   try {
  //     const remaining = await checkQuota(); // Call API route
  //     setQuotaRemaining(remaining);
  //     if (remaining <= 0) {
  //        setQuotaExceeded(true);
  //     }
  //   } catch (error) {
  //     console.error("Failed to fetch quota:", error);
  //     toast({ title: "Error", description: "Could not fetch usage quota.", variant: "destructive" });
  //   }
  // };

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
    if (quotaExceeded) {
      toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
      return;
    }
    if (!contentInput.trim()) {
      toast({ title: "Input Required", description: "Please enter content or a URL.", variant: "destructive" });
      return;
    }

    setIsGeneratingSummary(true);
    setIsGeneratingPosts(true);
    setSummary(null);
    setPostDrafts({});

    try {
       // Placeholder for quota check/increment
       // const remaining = await incrementQuota();
       // setQuotaRemaining(remaining);
       // if (remaining < 0) { // Should be handled by increment error ideally
       //    setQuotaExceeded(true);
       //    throw new Error("Quota exceeded");
       // }


      // 1. Summarize Content
      const summaryResult = await summarizeContent({ content: contentInput });
      setSummary(summaryResult.summary);
      setIsGeneratingSummary(false);

      // 2. Generate Posts for all platforms concurrently
      const platforms: SocialPlatform[] = ['linkedin', 'twitter', 'youtube'];
      const postPromises = platforms.map(platform =>
        generateSocialPosts({ summary: summaryResult.summary, platform })
          .then(result => ({ platform, post: result.post }))
          .catch(err => {
             console.error(`Error generating ${platform} post:`, err);
             // Optionally show a toast per platform failure
             return { platform, post: `Error generating post. Please try again.` };
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
      let description = "An error occurred during generation.";
      if (error.message.includes("Quota exceeded")) {
         description = "You have reached your monthly usage limit.";
         setQuotaExceeded(true);
      } else if (error.message.includes("parsing")) {
         description = "Could not parse content from the URL. Please check the URL or paste text directly.";
      } else if (error.message.includes("API key not valid")) {
         description = "AI service configuration error. Please check the GOOGLE_GENAI_API_KEY."
      }
      toast({ title: "Generation Failed", description: description, variant: "destructive" });
       setSummary(null); // Clear summary on error
       setPostDrafts({}); // Clear drafts on error
    } finally {
      setIsGeneratingSummary(false);
      setIsGeneratingPosts(false);
    }
  };

 const handleTunePost = async (platform: SocialPlatform, feedback: string) => {
    if (quotaExceeded) {
      toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
      return;
    }
    const originalPost = postDrafts[platform];
    if (!originalPost) return;

    setIsTuning(prev => ({ ...prev, [platform]: true }));

    try {
      // Placeholder for quota check/increment
      // await incrementQuota();

      const tunedResult = await tuneSocialPosts({ originalPost, feedback });
      setPostDrafts(prev => ({ ...prev, [platform]: tunedResult.tunedPost }));
       toast({ title: "Post Tuned!", description: `Applied feedback: "${feedback}"`, variant: "default" });
    } catch (error: any) {
      console.error(`Tuning ${platform} post failed:`, error);
       let description = "An error occurred while tuning the post.";
        if (error.message.includes("Quota exceeded")) {
           description = "You have reached your monthly usage limit.";
           setQuotaExceeded(true);
        } else if (error.message.includes("API key not valid")) {
           description = "AI service configuration error. Please check the GOOGLE_GENAI_API_KEY."
        }
      toast({ title: "Tuning Failed", description: description, variant: "destructive" });
    } finally {
      setIsTuning(prev => ({ ...prev, [platform]: false }));
    }
  };

  const handlePublishPost = async (platform: SocialPlatform) => {
     if (quotaExceeded) {
      toast({ title: "Quota Exceeded", description: "You have reached your monthly usage limit.", variant: "destructive" });
      return;
    }
    const postContent = postDrafts[platform];
    if (!postContent) return;

    setIsPublishing(prev => ({ ...prev, [platform]: true }));

    try {
        // Placeholder for quota check/increment
        // await incrementQuota();

      // Placeholder for actual Composio MCP publishing call
      console.log(`Publishing to ${platform}:`, postContent);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call

      // TODO: Replace with actual API call:
      // await publishPost({ platform, content: postContent });

      toast({ title: "Post Published!", description: `Successfully published to ${platform}.`, variant: "default" });

    } catch (error: any) {
       console.error(`Publishing to ${platform} failed:`, error);
       let description = "An error occurred while publishing the post.";
        if (error.message.includes("Quota exceeded")) {
           description = "You have reached your monthly usage limit.";
           setQuotaExceeded(true);
        } else if (error.message.includes("authentication")) { // Example error check
            description = `Please connect your ${platform} account first.`
            // TODO: Add link/button to connect account via Composio OAuth flow
        }
      toast({ title: "Publishing Failed", description: description, variant: "destructive" });
    } finally {
      setIsPublishing(prev => ({ ...prev, [platform]: false }));
    }
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
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
           <Zap className="h-6 w-6 text-primary" />
           <h1 className="text-2xl font-bold text-gradient">VibeFlow</h1>
        </div>
        <div className="flex items-center gap-4">
           {quotaRemaining !== null && (
             <Tooltip>
               <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground cursor-help">
                     <BarChart className="h-4 w-4" />
                     <span>{quotaRemaining} left</span>
                  </div>
               </TooltipTrigger>
               <TooltipContent>
                 <p>Requests remaining this month.</p>
               </TooltipContent>
             </Tooltip>
           )}
           <span className="text-sm text-muted-foreground hidden md:inline">{user.email}</span>
          <Tooltip>
             <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={handleSignOut}>
                  <LogOut className="h-5 w-5" />
                </Button>
             </TooltipTrigger>
             <TooltipContent>
               <p>Sign Out</p>
             </TooltipContent>
          </Tooltip>
        </div>
      </header>

       {/* Quota Exceeded Alert */}
       {quotaExceeded && (
          <Alert variant="destructive" className="mb-6">
             <Info className="h-4 w-4" />
            <AlertTitle>Quota Limit Reached</AlertTitle>
            <AlertDescription>
              You've used all your requests for this month. Please wait until next month or contact support.
            </AlertDescription>
          </Alert>
        )}

      {/* Main Content Area */}
      <main className="flex-grow grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Input Section */}
        <Card className="bg-card/80 border-border/30 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot className="text-primary" /> Content Input</CardTitle>
            <CardDescription>Enter a URL (article, video) or paste raw text below.</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Paste your content or URL here..."
              value={contentInput}
              onChange={(e) => setContentInput(e.target.value)}
              className="min-h-[200px] bg-input/50 border-border/50 text-base resize-none"
              disabled={isGeneratingSummary || isGeneratingPosts || quotaExceeded}
            />
          </CardContent>
          <CardFooter>
            <Button
              onClick={handleGenerate}
              disabled={isGeneratingSummary || isGeneratingPosts || !contentInput.trim() || quotaExceeded}
              loading={isGeneratingSummary || isGeneratingPosts}
              className="w-full md:w-auto ml-auto"
            >
              <Wand2 className="mr-2" /> Generate Posts
            </Button>
          </CardFooter>
        </Card>

        {/* Output Section */}
        <Card className="bg-card/80 border-border/30 shadow-lg">
          <CardHeader>
            <CardTitle>Generated Drafts</CardTitle>
            <CardDescription>Review, tune, and publish your social media posts.</CardDescription>
          </CardHeader>
          <CardContent>
             {(isGeneratingSummary || isGeneratingPosts) && (
                <div className="flex items-center justify-center p-10 text-muted-foreground">
                   <Loader2 className="h-8 w-8 animate-spin mr-3" />
                   <span>Generating content...</span>
                </div>
             )}

            {!(isGeneratingSummary || isGeneratingPosts) && !summary && Object.keys(postDrafts).length === 0 && (
                <div className="flex items-center justify-center p-10 text-muted-foreground">
                   <p>Your generated posts will appear here.</p>
                </div>
             )}

            {summary && Object.keys(postDrafts).length > 0 && (
              <Tabs defaultValue="linkedin" className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-muted/50 mb-4">
                  <TabsTrigger value="linkedin"><Linkedin className="h-4 w-4 mr-1 inline"/> LinkedIn</TabsTrigger>
                  <TabsTrigger value="twitter"><Twitter className="h-4 w-4 mr-1 inline"/> Twitter</TabsTrigger>
                  <TabsTrigger value="youtube"><Youtube className="h-4 w-4 mr-1 inline"/> YouTube</TabsTrigger>
                </TabsList>

                {(['linkedin', 'twitter', 'youtube'] as SocialPlatform[]).map((platform) => (
                  <TabsContent key={platform} value={platform}>
                    <Card className="bg-background border-border/50">
                      <CardContent className="p-4 space-y-4 relative">
                        {isTuning[platform] && (
                           <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-md">
                              <Loader2 className="h-6 w-6 animate-spin text-primary-foreground"/>
                           </div>
                         )}
                        <Textarea
                          value={postDrafts[platform] || ''}
                          readOnly // Make textarea read-only, tuning happens via buttons
                          className="min-h-[150px] bg-input/30 border-border/30 resize-none text-sm"
                        />
                        {/* Tuning Buttons */}
                         <div className="flex flex-wrap gap-2">
                          <span className="text-xs text-muted-foreground mr-2 mt-1.5">Tune:</span>
                           <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'Make wittier')} disabled={isTuning[platform] || isPublishing[platform] || quotaExceeded}>Witty</Button>
                           <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'More concise')} disabled={isTuning[platform] || isPublishing[platform] || quotaExceeded}>Concise</Button>
                           <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'More professional')} disabled={isTuning[platform] || isPublishing[platform] || quotaExceeded}>Professional</Button>
                           <Button size="sm" variant="outline" onClick={() => handleTunePost(platform, 'Add emojis')} disabled={isTuning[platform] || isPublishing[platform] || quotaExceeded}>Add Emojis ✨</Button>
                         </div>
                      </CardContent>
                      <CardFooter className="flex justify-end gap-2">
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
                              disabled={!postDrafts[platform] || isPublishing[platform] || isTuning[platform] || quotaExceeded}
                              loading={isPublishing[platform]}
                              size="sm"
                            >
                              <Send className="mr-1.5 h-4 w-4" /> Publish to {platform.charAt(0).toUpperCase() + platform.slice(1)}
                            </Button>
                          </TooltipTrigger>
                           <TooltipContent><p>Publish this post</p></TooltipContent>
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
    </div>
    </TooltipProvider>
  );
}

// Placeholder API interaction functions (to be moved to API routes/server actions)

// async function checkQuota(): Promise<number> {
//   // Replace with actual API call to GET /api/quota-check
//   console.log("Checking quota...");
//   await new Promise(resolve => setTimeout(resolve, 300)); // Simulate API latency
//   // Mock response
//   const mockRemaining = 95;
//   if (mockRemaining <= 0) throw new Error("Quota exceeded");
//   return mockRemaining;
// }

// async function incrementQuota(): Promise<number> {
//    // Replace with actual API call to POST /api/quota-increment (or similar)
//    // This should ideally happen server-side within the AI call routes
//    console.log("Incrementing quota...");
//    await new Promise(resolve => setTimeout(resolve, 100));
//    // Mock response (should return *new* remaining)
//    const mockRemainingAfterIncrement = 94;
//    if (mockRemainingAfterIncrement < 0) throw new Error("Quota exceeded");
//    return mockRemainingAfterIncrement;
// }

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
