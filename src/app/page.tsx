
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, Zap, BarChartHorizontal, Edit, Share2, TrendingUp, Clock, Users } from 'lucide-react'; // Added more icons

export const metadata: Metadata = {
  title: 'VibeFlow | AI Social Media Post Generator',
  description: 'Effortlessly generate engaging social media posts from any content using AI. Summarize URLs or text, get tailored drafts for LinkedIn, Twitter, & YouTube, and tune them to perfection.',
  keywords: ['ai social media', 'content generation', 'linkedin post generator', 'twitter post generator', 'youtube description generator', 'content summarization', 'social media marketing'],
  openGraph: {
      title: 'VibeFlow | AI Social Media Post Generator',
      description: 'Transform content into social buzz instantly. AI-powered summarization and post generation for LinkedIn, Twitter, and YouTube.',
      // Add image URL once available
      // images: ['/og-image.png'],
  }
};

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground dark overflow-x-hidden"> {/* Prevent horizontal scroll */}
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-gradient">VibeFlow</h1>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link href="/login">
              <Button size="sm" className="transition-transform duration-200 hover:scale-105">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-16 md:py-32 lg:py-40 overflow-hidden">
        {/* Animated Gradient Glow */}
        <div className="absolute inset-0 z-0 gradient-glow opacity-50"></div>
        <div className="container relative z-10 text-center px-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6 text-gradient leading-tight fade-in-up" style={{ animationDelay: '0.1s' }}>
            Transform Content into Social Buzz Instantly
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 md:mb-10 max-w-xl md:max-w-3xl mx-auto fade-in-up" style={{ animationDelay: '0.2s' }}>
            VibeFlow uses AI to summarize articles, videos, or any text and crafts engaging posts tailored for LinkedIn, Twitter, and YouTube. Save time, boost engagement.
          </p>
          <div className="fade-in-up" style={{ animationDelay: '0.3s' }}>
            <Link href="/login">
              <Button size="lg" className="shadow-lg hover:scale-105 transition-transform duration-200">
                Start Generating Posts <Zap className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 md:py-24 bg-muted/20">
        <div className="container px-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-12 md:mb-16 fade-in-up">How VibeFlow Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {/* Feature Card 1 */}
            <Card className="bg-card/80 border-border/30 shadow-lg text-center transform transition-transform duration-300 hover:scale-105 hover:shadow-xl fade-in-up" style={{ animationDelay: '0.1s' }}>
              <CardHeader className="items-center px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-3">
                 <div className="flex justify-center items-center mb-3 md:mb-4 p-3 bg-primary/10 rounded-full transition-colors duration-300 group-hover:bg-primary/20">
                    <BarChartHorizontal className="h-6 w-6 md:h-8 md:w-8 text-primary"/>
                 </div>
                <CardTitle className="text-lg md:text-xl">1. Input Content</CardTitle>
                <CardDescription className="text-xs md:text-sm">Paste a URL (article, video) or raw text.</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
                <p className="text-sm text-muted-foreground">VibeFlow intelligently parses the content to understand its core message.</p>
              </CardContent>
            </Card>
            {/* Feature Card 2 */}
            <Card className="bg-card/80 border-border/30 shadow-lg text-center transform transition-transform duration-300 hover:scale-105 hover:shadow-xl fade-in-up" style={{ animationDelay: '0.2s' }}>
              <CardHeader className="items-center px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-3">
                 <div className="flex justify-center items-center mb-3 md:mb-4 p-3 bg-primary/10 rounded-full transition-colors duration-300 group-hover:bg-primary/20">
                    <Zap className="h-6 w-6 md:h-8 md:w-8 text-primary"/>
                 </div>
                <CardTitle className="text-lg md:text-xl">2. AI Generation</CardTitle>
                <CardDescription className="text-xs md:text-sm">Get an AI summary & tailored drafts for LinkedIn, Twitter & YouTube.</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
                <p className="text-sm text-muted-foreground">Our AI crafts posts optimized for length, tone, and style for each platform.</p>
              </CardContent>
            </Card>
            {/* Feature Card 3 */}
            <Card className="bg-card/80 border-border/30 shadow-lg text-center transform transition-transform duration-300 hover:scale-105 hover:shadow-xl fade-in-up" style={{ animationDelay: '0.3s' }}>
              <CardHeader className="items-center px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-3">
                <div className="flex justify-center items-center mb-3 md:mb-4 p-3 bg-primary/10 rounded-full transition-colors duration-300 group-hover:bg-primary/20">
                    <Edit className="h-6 w-6 md:h-8 md:w-8 text-primary"/>
                 </div>
                <CardTitle className="text-lg md:text-xl">3. Tune & Publish</CardTitle>
                <CardDescription className="text-xs md:text-sm">Refine posts with AI suggestions and publish (soon!).</CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
                <p className="text-sm text-muted-foreground">Easily tweak posts to match your voice before sharing.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

       {/* Screenshot Section */}
      <section id="screenshots" className="py-16 md:py-28">
        <div className="container px-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-12 md:mb-16 fade-in-up">See VibeFlow in Action</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-center">
            <div className="rounded-lg overflow-hidden shadow-xl border border-border/30 transform transition-transform duration-300 hover:scale-105 fade-in-up" style={{ animationDelay: '0.1s' }}>
               <Image
                 src="https://picsum.photos/seed/dashboard1/800/600"
                 alt="VibeFlow Dashboard Input Screen"
                 width={800}
                 height={600}
                 className="w-full h-auto object-cover"
                 data-ai-hint="dashboard interface content input dark theme"
               />
            </div>
             <div className="rounded-lg overflow-hidden shadow-xl border border-border/30 transform transition-transform duration-300 hover:scale-105 fade-in-up" style={{ animationDelay: '0.2s' }}>
               <Image
                 src="https://picsum.photos/seed/dashboard2/800/600"
                 alt="VibeFlow Dashboard Output Screen with generated posts"
                 width={800}
                 height={600}
                 className="w-full h-auto object-cover"
                 data-ai-hint="dashboard interface generated social media posts dark theme"
               />
            </div>
          </div>
          <p className="text-center text-muted-foreground mt-6 italic text-sm fade-in-up" style={{ animationDelay: '0.3s' }}>Actual dashboard design may vary slightly.</p>
        </div>
      </section>

      {/* Why VibeFlow Section */}
      <section id="why-us" className="py-16 md:py-28 bg-muted/20">
        <div className="container px-4">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-12 md:mb-16 fade-in-up">Why Choose VibeFlow?</h2>
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-x-8 md:gap-x-12 gap-y-8 md:gap-y-10">
            {/* Advantage 1 */}
            <div className="flex items-start gap-3 md:gap-4 fade-in-up group" style={{ animationDelay: '0.1s' }}>
              <div className="flex-shrink-0 p-2 bg-primary/10 rounded-full mt-1 transition-transform duration-300 group-hover:scale-110">
                 <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-semibold mb-1 md:mb-2">AI-Powered Tuning</h3>
                <p className="text-sm text-muted-foreground">Go beyond simple generation. Refine posts instantly with AI suggestions like "Make it wittier" or "Add emojis".</p>
              </div>
            </div>
            {/* Advantage 2 */}
            <div className="flex items-start gap-3 md:gap-4 fade-in-up group" style={{ animationDelay: '0.2s' }}>
               <div className="flex-shrink-0 p-2 bg-primary/10 rounded-full mt-1 transition-transform duration-300 group-hover:scale-110">
                 <Share2 className="h-4 w-4 md:h-5 md:w-5 text-primary" />
               </div>
              <div>
                <h3 className="text-lg md:text-xl font-semibold mb-1 md:mb-2">Multi-Platform Focus</h3>
                <p className="text-sm text-muted-foreground">Get drafts specifically tailored for LinkedIn, Twitter, and YouTube, respecting character limits and platform conventions.</p>
              </div>
            </div>
             {/* Advantage 3 */}
            <div className="flex items-start gap-3 md:gap-4 fade-in-up group" style={{ animationDelay: '0.3s' }}>
               <div className="flex-shrink-0 p-2 bg-primary/10 rounded-full mt-1 transition-transform duration-300 group-hover:scale-110">
                  <Clock className="h-4 w-4 md:h-5 md:w-5 text-primary" />
               </div>
              <div>
                <h3 className="text-lg md:text-xl font-semibold mb-1 md:mb-2">Streamlined Workflow</h3>
                <p className="text-sm text-muted-foreground">From content input to tuned drafts in seconds. VibeFlow simplifies your social media content creation process, saving hours.</p>
              </div>
            </div>
             {/* Advantage 4 */}
             <div className="flex items-start gap-3 md:gap-4 fade-in-up group" style={{ animationDelay: '0.4s' }}>
               <div className="flex-shrink-0 p-2 bg-primary/10 rounded-full mt-1 transition-transform duration-300 group-hover:scale-110">
                 <Users className="h-4 w-4 md:h-5 md:w-5 text-primary" />
               </div>
              <div>
                <h3 className="text-lg md:text-xl font-semibold mb-1 md:mb-2">Audience-Centric Content</h3>
                <p className="text-sm text-muted-foreground">AI helps tailor tone and style, making your posts resonate better with each platform's unique audience.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

       {/* CTA Section */}
      <section className="py-20 md:py-32 text-center">
        <div className="container px-4 fade-in-up">
           <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 md:mb-6 text-gradient">Ready to Amplify Your Social Presence?</h2>
           <p className="text-base md:text-lg text-muted-foreground mb-8 md:mb-10 max-w-lg md:max-w-xl mx-auto">
             Stop staring at a blank canvas. Start generating engaging social posts with VibeFlow today.
           </p>
           <Link href="/login">
             <Button size="lg" className="shadow-lg hover:scale-105 transition-transform duration-200">
               Try VibeFlow Now - It's Free!
             </Button>
           </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 md:py-8 border-t border-border/40">
        <div className="container text-center text-xs md:text-sm text-muted-foreground px-4">
          &copy; {new Date().getFullYear()} VibeFlow. All rights reserved. | Built with Next.js & AI
        </div>
      </footer>
    </div>
  );
}
