"use client";

"use client";

"use client";

import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { cn } from '../lib/utils';
import { Zap, Edit, TrendingUp, Clock, Users, Check, Lock } from 'lucide-react'; // Added Check, Lock
import { useEffect } from 'react';
import { motion } from "framer-motion";


export default function LandingPage() {
  useEffect(() => {
    const handleScroll = () => {
      const scrollProgress = document.getElementById('scroll-progress') as HTMLProgressElement;
      if (scrollProgress) {
        const totalHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrollPosition = (document.documentElement.scrollTop / totalHeight) * 100;
        scrollProgress.value = scrollPosition;
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground dark overflow-x-hidden">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 max-w-screen-xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
            <Image src="/logo.png" alt="VibeFlow Logo" width={168} height={168} className="object-contain" />
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/login">
              <Button size="sm" className="transition-transform duration-200 hover:scale-105 shadow-md hover:shadow-primary/50">
                Unlock VibeFlow Now
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative py-16 sm:py-24 md:py-40 lg:py-48 overflow-hidden" aria-label="Hero section with main value proposition and call to action">
        <div className="absolute inset-0 z-0 gradient-glow opacity-40 blur-3xl animate-pulse-slow"></div>
        <div aria-hidden="true" className="absolute inset-x-0 top-0 z-0 transform-gpu overflow-hidden blur-3xl" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}></div>
       <div className="container relative z-10 text-center px-4 max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 text-gradient leading-tight drop-shadow-lg fade-in-up" style={{ animationDelay: '0.1s' }}>
            Unlock Your Social Media Potential with AI
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-muted-foreground mb-12 max-w-3xl mx-auto fade-in-up" style={{ animationDelay: '0.2s' }}>
            VibeFlow uses AI to transform your ideas into engaging social media posts. Stop wasting time and start growing your audience today!
          </p>
          <div className="flex justify-center gap-6 fade-in-up" style={{ animationDelay: '0.3s' }}>
            <Link href="/login" aria-label="Start generating free posts">
              <Button size="lg" className="text-lg py-4 px-10 shadow-xl bg-gradient-to-r from-primary to-purple-600 hover:from-purple-600 hover:to-primary hover:scale-110 transition-all duration-300 transform text-primary-foreground font-bold">
                Get Started Now <Zap className="ml-2 h-6 w-6" />
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-4 italic fade-in-up max-w-md mx-auto" style={{ animationDelay: '0.4s' }}>
            Limited spots available during beta.
          </p>
          <progress className="w-full h-2 bg-gray-200 rounded-full mt-4" value="0" max="100" id="scroll-progress" style={{ appearance: 'none' }}/>
        </div>
      </section>

      <motion.section
        id="social-proof"
        className="py-16 md:py-24 bg-gradient-to-b from-primary/10 to-transparent"
        aria-label="Social proof and testimonials"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
      >
        <div className="container max-w-5xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-extrabold mb-8 fade-in-up">Trusted by Early Adopters & Influencers</h2>
          <p className="text-lg text-muted-foreground mb-12 fade-in-up max-w-3xl mx-auto">
            Join thousands of users who have transformed their social media presence with VibeFlow.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="fade-in-up" style={{ animationDelay: '0.1s' }}>
              <CardHeader>
                <CardTitle>Jane D.</CardTitle>
                <CardDescription>Marketing Manager at Tech Solutions Inc.</CardDescription>
              </CardHeader>
              <CardContent>
                "VibeFlow has completely transformed our social media strategy. We're saving at least 10 hours a week and seeing a 30% increase in engagement!"
              </CardContent>
            </Card>
            <Card className="fade-in-up" style={{ animationDelay: '0.2s' }}>
              <CardHeader>
                <CardTitle>Mark S.</CardTitle>
                <CardDescription>Content Creator and Influencer</CardDescription>
              </CardHeader>
              <CardContent>
                "As a content creator, time is money. VibeFlow helps me create high-quality content in minutes, freeing me up to focus on engaging with my audience."
              </CardContent>
            </Card>
            <Card className="fade-in-up" style={{ animationDelay: '0.3s' }}>
              <CardHeader>
                <CardTitle>Lisa K.</CardTitle>
                <CardDescription>Social Media Strategist at Global Marketing Group</CardDescription>
              </CardHeader>
              <CardContent>
                "VibeFlow's AI-powered insights have been invaluable in helping us fine-tune our social media campaigns and achieve better results for our clients."
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.section>

      <section id="dashboard-preview" className="py-20 md:py-28 bg-background" aria-label="Dashboard preview showcasing app features">
        <div className="container max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-extrabold mb-12 fade-in-up">See VibeFlow in Action</h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-3xl mx-auto fade-in-up">
            Experience the power of AI-driven social media post generation with our intuitive dashboard.
          </p>
          <div className="rounded-xl overflow-hidden shadow-2xl border-2 border-primary/20 transform transition-transform duration-500 hover:scale-[1.03] fade-in-up"  style={{ transform: 'translateY(calc(var(--scroll-y) * 0.02px))' }}>
            <Image
              src="/dashboard-screenshot.png"
              alt="VibeFlow Dashboard Screenshot showing content input, generated drafts, and AI advisor"
              width={1200}
              height={800}
              className="w-full h-auto object-cover"
              priority
            />
          </div>
        </div>
      </section>

      <section id="features" className="py-20 md:py-28" aria-label="Key features and benefits">
        <div className="container px-4 max-w-5xl mx-auto">
          <h2 className="text-4xl font-extrabold text-center mb-16 fade-in-up">Unlock Your Social Superpowers</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <motion.div className="flex flex-col items-center text-center p-8 border border-transparent rounded-lg transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:bg-muted/20 fade-in-up hover:scale-105" style={{ animationDelay: '0.1s' }} whileHover={{ y: -5 }}>
              <div className="mb-6 p-5 bg-primary/10 rounded-full transition-colors duration-300 group-hover:bg-primary/20">
                <Zap className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Instant AI Drafts</h3>
              <p className="text-base text-muted-foreground max-w-xs">
                Paste your text. VibeFlow summarizes and crafts tailored posts for LinkedIn, Twitter & YouTube in seconds.
              </p>
            </motion.div>
            <motion.div className="flex flex-col items-center text-center p-8 border border-transparent rounded-lg transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:bg-muted/20 fade-in-up hover:scale-105" style={{ animationDelay: '0.2s' }} whileHover={{ y: -5 }}>
              <div className="mb-6 p-5 bg-primary/10 rounded-full transition-colors duration-300 group-hover:bg-primary/20">
                <Edit className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Tune to Perfection</h3>
              <p className="text-base text-muted-foreground max-w-xs">
                Refine your message effortlessly. Use AI suggestions or choose a persona for the perfect voice.
              </p>
            </motion.div>
            <motion.div className="flex flex-col items-center text-center p-8 border border-transparent rounded-lg transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:bg-muted/20 fade-in-up hover:scale-105" style={{ animationDelay: '0.3s' }} whileHover={{ y: -5 }}>
              <div className="mb-6 p-5 bg-primary/10 rounded-full transition-colors duration-300 group-hover:bg-primary/20">
                <Clock className="h-12 w-12 text-primary" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Reclaim Your Time</h3>
              <p className="text-base text-muted-foreground max-w-xs">
                Slash content creation time by 90%. Focus on strategy and engagement, not endless drafting.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative py-24 md:py-40 overflow-hidden bg-gradient-to-r from-purple-700 via-pink-600 to-red-600 text-white" aria-label="Urgency and exclusivity call to action">
        <div className="absolute inset-0 z-0 gradient-glow opacity-60 blur-3xl animate-pulse-slow"></div>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 z-0 transform-gpu overflow-hidden blur-3xl">
          <div className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-[#6D28D9] to-[#A855F7] opacity-20 motion-safe:animate-pulse-slow" style={{ clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' }}></div>
        </div>
        <div className="container relative z-10 text-center px-4 fade-in-up max-w-3xl mx-auto">
          <h2 className="text-4xl font-extrabold mb-6">Don't Miss Out! Get VibeFlow Today</h2>
          <p className="text-lg mb-10 max-w-xl mx-auto">
            Limited spots are available for our beta program. Get early access to VibeFlow and start creating viral content before your competitors do!
          </p>
          <Link href="/login" aria-label="Claim your free access now">
            <Button size="lg" className="text-lg py-4 px-10 shadow-xl bg-white text-primary font-bold hover:scale-105 transition-transform duration-300">
              Claim Your Free Access Now
            </Button>
          </Link>
          <p className="text-xs italic mt-4 max-w-md mx-auto">Hurry, offer ends soon!</p>
        </div>
      </section>

      <footer className="py-8 md:py-10 border-t border-border/40">
        <div className="container px-4 flex flex-col md:flex-row justify-between items-center text-center md:text-left">
          <div className="text-sm text-muted-foreground mb-4 md:mb-0">
            &copy; {new Date().getFullYear()} VibeFlow. Stop Dreaming, Start Generating. | Built with Next.js & AI
          </div>
        </div>
      </footer>
    </div>
  );
}
