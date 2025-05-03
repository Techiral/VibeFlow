
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Zap, Edit, TrendingUp, Clock, Users, Check, Lock } from 'lucide-react'; // Added Check, Lock

export const metadata: Metadata = {
  title: 'VibeFlow | AI Social Media Post Generator - Go Viral Faster',
  description: 'Stop wasting hours on social media! VibeFlow uses AI to instantly transform any content (articles, videos, text) into captivating posts for LinkedIn, Twitter & YouTube. Tune perfection, schedule effortlessly (soon!). Unlock your social potential.',
  keywords: ['ai social media generator', 'linkedin post ai', 'twitter post ai', 'youtube description ai', 'content marketing automation', 'social media scheduling', 'ai content creation', 'save time social media'],
  openGraph: {
      title: 'VibeFlow | Instantly Generate Viral Social Media Posts with AI',
      description: 'Transform links or text into perfect LinkedIn, Twitter, and YouTube posts in seconds. Summarize, generate, tune, and dominate social media effortlessly.',
      // Replace with actual OG image URL
      images: ['/og-image-vibeflow.png'],
  }
};

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground dark overflow-x-hidden"> {/* Prevent horizontal scroll */}
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-screen-xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
            <Zap className="h-7 w-7 text-primary animate-pulse" />
            <h1 className="text-2xl font-bold text-gradient">VibeFlow</h1>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link href="/login">
              <Button size="sm" className="transition-transform duration-200 hover:scale-105 shadow-md hover:shadow-primary/50">Unlock VibeFlow Now</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 md:py-40 lg:py-48 overflow-hidden">
        {/* Subtle Animated Gradient Glow */}
        <div className="absolute inset-0 z-0 gradient-glow opacity-40 blur-3xl"></div>
         {/* Background shapes/elements for depth (optional) */}
         <div aria-hidden="true" className="absolute inset-x-0 top-0 z-0 transform-gpu overflow-hidden blur-3xl">
           <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#A855F7] to-[#6D28D9] opacity-10" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}></div>
         </div>

        <div className="container relative z-10 text-center px-4">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 text-gradient leading-tight drop-shadow-lg fade-in-up" style={{ animationDelay: '0.1s' }}>
            Stop Guessing, Start <span className="underline decoration-primary/50">Growing.</span>
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-10 max-w-md md:max-w-2xl mx-auto fade-in-up" style={{ animationDelay: '0.2s' }}>
            Tired of the content grind? VibeFlow's AI instantly crafts magnetic posts from any link or text for LinkedIn, Twitter & YouTube. Save hours, go viral faster.
          </p>
          <div className="fade-in-up" style={{ animationDelay: '0.3s' }}>
            <Link href="/login">
              <Button size="lg" className="text-lg py-3 px-8 shadow-xl bg-gradient-to-r from-primary to-purple-600 hover:from-purple-600 hover:to-primary hover:scale-105 transition-all duration-300 transform text-primary-foreground font-bold">
                Start Generating Free Posts <Zap className="ml-2 h-5 w-5" />
              </Button>
            </Link>
             <p className="text-xs text-muted-foreground mt-3 italic fade-in-up" style={{ animationDelay: '0.4s' }}>Limited spots available during beta. Secure yours now.</p>
          </div>
        </div>
         {/* Optional: Add subtle downward scroll indicator */}
      </section>

       {/* Screenshot Section */}
      <section id="how-it-works" className="py-20 md:py-28 bg-gradient-to-b from-background to-muted/10">
        <div className="container px-4">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-16 md:mb-20 fade-in-up">See the Magic Happen</h2>
          <div className="max-w-5xl mx-auto rounded-xl overflow-hidden shadow-2xl border-2 border-primary/20 transform transition-transform duration-500 hover:scale-[1.02] fade-in-up" style={{ animationDelay: '0.2s' }}>
             {/* Replace with the actual screenshot URL */}
             <Image
               src="https://picsum.photos/seed/dashboard-screenshot/1200/800" // Placeholder URL
               alt="VibeFlow Dashboard Screenshot showing content input, generated drafts, and AI advisor"
               width={1200}
               height={800}
               className="w-full h-auto object-cover"
               priority // Load the main image faster
               data-ai-hint="dashboard interface screenshot dark theme" // Keep AI hint
             />
          </div>
           <p className="text-center text-muted-foreground mt-8 text-base fade-in-up" style={{ animationDelay: '0.3s' }}>
             Turn any content into polished social posts in <span className="font-bold text-gradient">3 simple steps</span>.
           </p>
        </div>
      </section>


      {/* Features Section (Simplified & Benefit-Focused) */}
      <section id="features" className="py-20 md:py-28">
        <div className="container px-4">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-16 md:mb-20 fade-in-up">Unlock Your Social Superpowers</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {/* Feature Card 1 */}
            <div className="flex flex-col items-center text-center p-6 border border-transparent rounded-lg transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:bg-muted/20 fade-in-up" style={{ animationDelay: '0.1s' }}>
               <div className="mb-5 p-4 bg-primary/10 rounded-full transition-colors duration-300 group-hover:bg-primary/20">
                  <Zap className="h-10 w-10 text-primary"/>
               </div>
              <h3 className="text-xl md:text-2xl font-semibold mb-3">Instant AI Drafts</h3>
              <p className="text-base text-muted-foreground">Paste a link or text. VibeFlow summarizes and crafts tailored posts for LinkedIn, Twitter & YouTube in seconds. Stop staring at a blank screen.</p>
            </div>
            {/* Feature Card 2 */}
            <div className="flex flex-col items-center text-center p-6 border border-transparent rounded-lg transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:bg-muted/20 fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="mb-5 p-4 bg-primary/10 rounded-full transition-colors duration-300 group-hover:bg-primary/20">
                  <Edit className="h-10 w-10 text-primary"/>
               </div>
              <h3 className="text-xl md:text-2xl font-semibold mb-3">Tune to Perfection</h3>
              <p className="text-base text-muted-foreground">Refine your message effortlessly. Use AI suggestions ("Make it wittier," "Add emojis") or choose a persona ("Tech CEO," "Gen Z") for the perfect voice.</p>
            </div>
            {/* Feature Card 3 */}
            <div className="flex flex-col items-center text-center p-6 border border-transparent rounded-lg transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:bg-muted/20 fade-in-up" style={{ animationDelay: '0.3s' }}>
               <div className="mb-5 p-4 bg-primary/10 rounded-full transition-colors duration-300 group-hover:bg-primary/20">
                  <Clock className="h-10 w-10 text-primary"/>
               </div>
              <h3 className="text-xl md:text-2xl font-semibold mb-3">Reclaim Your Time</h3>
              <p className="text-base text-muted-foreground">Slash content creation time by 90%. Focus on strategy and engagement, not endless drafting. Get weeks of content ready in minutes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Why VibeFlow Section (vs. Competitors - Implied) */}
      <section id="why-us" className="py-20 md:py-28 bg-muted/20">
        <div className="container px-4">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-center mb-16 md:mb-20 fade-in-up">More Than Just a Generator...</h2>
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-x-12 md:gap-x-16 gap-y-10 md:gap-y-12">
            {/* Advantage 1 */}
            <div className="flex items-start gap-4 fade-in-up group" style={{ animationDelay: '0.1s' }}>
              <div className="flex-shrink-0 p-2.5 bg-primary/10 rounded-full mt-1 transition-transform duration-300 group-hover:scale-110">
                 <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-semibold mb-2">AI-Powered Tuning & Feedback</h3>
                <p className="text-base text-muted-foreground">Don't just generate – elevate. Get instant AI advice on tone, clarity, and engagement, then refine with one click. (Competitors just spit out text).</p>
              </div>
            </div>
            {/* Advantage 2 */}
            <div className="flex items-start gap-4 fade-in-up group" style={{ animationDelay: '0.2s' }}>
               <div className="flex-shrink-0 p-2.5 bg-primary/10 rounded-full mt-1 transition-transform duration-300 group-hover:scale-110">
                 <Users className="h-6 w-6 text-primary" />
               </div>
              <div>
                <h3 className="text-xl md:text-2xl font-semibold mb-2">Platform-Specific Intelligence</h3>
                <p className="text-base text-muted-foreground">VibeFlow understands LinkedIn isn't Twitter. Get drafts optimized for each platform's audience, length, and style conventions.</p>
              </div>
            </div>
             {/* Advantage 3 */}
            <div className="flex items-start gap-4 fade-in-up group" style={{ animationDelay: '0.3s' }}>
               <div className="flex-shrink-0 p-2.5 bg-primary/10 rounded-full mt-1 transition-transform duration-300 group-hover:scale-110">
                  <Lock className="h-6 w-6 text-primary" />
               </div>
              <div>
                <h3 className="text-xl md:text-2xl font-semibold mb-2">Your Keys, Your Control</h3>
                <p className="text-base text-muted-foreground">VibeFlow uses *your* Gemini API key, stored securely in your profile. You're always in control of your AI usage and costs.</p>
              </div>
            </div>
             {/* Advantage 4 */}
             <div className="flex items-start gap-4 fade-in-up group" style={{ animationDelay: '0.4s' }}>
               <div className="flex-shrink-0 p-2.5 bg-primary/10 rounded-full mt-1 transition-transform duration-300 group-hover:scale-110">
                 <Check className="h-6 w-6 text-primary" />
               </div>
              <div>
                <h3 className="text-xl md:text-2xl font-semibold mb-2">Simple, Intuitive Workflow</h3>
                <p className="text-base text-muted-foreground">No complex setups or jargon. Paste, generate, tune, copy. It's designed to get you results, fast. Stop fighting clunky tools.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

       {/* Final CTA Section (Urgency & Exclusivity) */}
      <section className="relative py-24 md:py-40 overflow-hidden">
         {/* Animated Gradient Glow */}
         <div className="absolute inset-0 z-0 gradient-glow opacity-50 blur-3xl"></div>
         <div aria-hidden="true" className="absolute inset-x-0 bottom-0 z-0 transform-gpu overflow-hidden blur-3xl">
           <div className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#6D28D9] to-[#A855F7] opacity-10 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}></div>
         </div>
        <div className="container relative z-10 text-center px-4 fade-in-up">
           <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-6 text-gradient">Ready to Dominate Your Feed?</h2>
           <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-lg md:max-w-2xl mx-auto">
             Stop letting your best content die. VibeFlow is your unfair advantage. Get early access and start creating posts that <span className="font-bold text-primary">demand attention.</span>
           </p>
           <Link href="/login">
             <Button size="lg" className="text-lg py-3 px-8 shadow-xl bg-gradient-to-r from-primary to-purple-600 hover:from-purple-600 hover:to-primary hover:scale-105 transition-all duration-300 transform text-primary-foreground font-bold">
               Claim Your Free Access Now
             </Button>
           </Link>
           <p className="text-xs text-muted-foreground mt-4 italic">Join the beta users already saving hours and boosting engagement.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 md:py-10 border-t border-border/40">
        <div className="container text-center text-sm text-muted-foreground px-4">
          &copy; {new Date().getFullYear()} VibeFlow. Stop Dreaming, Start Generating. | Built with Next.js & AI
        </div>
      </footer>
    </div>
  );
}

