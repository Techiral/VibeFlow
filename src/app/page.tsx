
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, Zap, BarChartHorizontal, Edit, Share2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'VibeFlow | AI Social Media Post Generator',
  description: 'Effortlessly generate engaging social media posts from any content using AI. Summarize URLs or text, get tailored drafts for LinkedIn, Twitter, & YouTube, and tune them to perfection.',
  // Add more SEO metadata as needed (keywords, open graph, etc.)
};

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground dark">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-gradient">VibeFlow</h1>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        {/* Animated Gradient Glow */}
        <div className="absolute inset-0 z-0 gradient-glow opacity-50"></div>
        <div className="container relative z-10 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gradient">
            Transform Content into Social Buzz Instantly
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto">
            VibeFlow uses AI to summarize articles, videos, or any text and crafts engaging posts tailored for LinkedIn, Twitter, and YouTube. Save time, boost engagement.
          </p>
          <Link href="/login">
            <Button size="lg" className="shadow-lg">
              Start Generating Posts <Zap className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 bg-muted/20">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">How VibeFlow Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-card/80 border-border/30 shadow-lg text-center">
              <CardHeader>
                 <div className="flex justify-center items-center mb-4">
                    <BarChartHorizontal className="h-10 w-10 text-primary"/>
                 </div>
                <CardTitle>1. Input Content</CardTitle>
                <CardDescription>Paste a URL (article, video) or raw text.</CardDescription>
              </CardHeader>
              <CardContent>
                <p>VibeFlow intelligently parses the content to understand its core message.</p>
              </CardContent>
            </Card>
            <Card className="bg-card/80 border-border/30 shadow-lg text-center">
              <CardHeader>
                 <div className="flex justify-center items-center mb-4">
                    <Zap className="h-10 w-10 text-primary"/>
                 </div>
                <CardTitle>2. AI Generation</CardTitle>
                <CardDescription>Get an AI-powered summary and tailored drafts for LinkedIn, Twitter & YouTube.</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Our AI crafts posts optimized for length, tone, and style for each platform.</p>
              </CardContent>
            </Card>
            <Card className="bg-card/80 border-border/30 shadow-lg text-center">
              <CardHeader>
                <div className="flex justify-center items-center mb-4">
                    <Edit className="h-10 w-10 text-primary"/>
                 </div>
                <CardTitle>3. Tune & Publish</CardTitle>
                <CardDescription>Refine posts with AI suggestions (witty, concise, etc.) and publish.</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Easily tweak posts to match your voice before sharing (publishing coming soon!).</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

       {/* Screenshot Section */}
      <section id="screenshots" className="py-16 md:py-24">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">See VibeFlow in Action</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="rounded-lg overflow-hidden shadow-xl border border-border/30">
               <Image
                 src="https://picsum.photos/seed/dashboard1/800/600"
                 alt="VibeFlow Dashboard Input"
                 width={800}
                 height={600}
                 className="w-full h-auto"
                 data-ai-hint="dashboard interface content input"
               />
            </div>
             <div className="rounded-lg overflow-hidden shadow-xl border border-border/30">
               <Image
                 src="https://picsum.photos/seed/dashboard2/800/600"
                 alt="VibeFlow Dashboard Output"
                 width={800}
                 height={600}
                 className="w-full h-auto"
                 data-ai-hint="dashboard interface generated posts"
               />
            </div>
          </div>
          <p className="text-center text-muted-foreground mt-4 italic">Actual dashboard may vary.</p>
        </div>
      </section>

      {/* Why VibeFlow Section */}
      <section id="why-us" className="py-16 md:py-24 bg-muted/20">
        <div className="container">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Why Choose VibeFlow?</h2>
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex items-start gap-4">
              <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-2">AI-Powered Tuning</h3>
                <p className="text-muted-foreground">Go beyond simple generation. Refine posts instantly with AI suggestions like "Make it wittier" or "Add emojis".</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-2">Multi-Platform Focus</h3>
                <p className="text-muted-foreground">Get drafts specifically tailored for LinkedIn, Twitter, and YouTube, respecting character limits and platform conventions.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-2">Streamlined Workflow</h3>
                <p className="text-muted-foreground">From content input to tuned drafts in seconds. VibeFlow simplifies your social media content creation process.</p>
              </div>
            </div>
             <div className="flex items-start gap-4">
              <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-semibold mb-2">Effortless Summarization</h3>
                <p className="text-muted-foreground">Instantly grasp the essence of any article or video with concise AI summaries as the foundation for your posts.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

       {/* CTA Section */}
      <section className="py-20 md:py-32 text-center">
        <div className="container">
           <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Amplify Your Social Presence?</h2>
           <p className="text-lg text-muted-foreground mb-10 max-w-xl mx-auto">
             Stop staring at a blank canvas. Start generating engaging social posts with VibeFlow today.
           </p>
           <Link href="/login">
             <Button size="lg" className="shadow-lg">
               Try VibeFlow Now
             </Button>
           </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/40">
        <div className="container text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} VibeFlow. All rights reserved. | Built with Next.js & AI
        </div>
      </footer>
    </div>
  );
}
