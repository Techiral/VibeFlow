import type {Metadata} from 'next';
// import { Geist } from 'next/font/google'; // Removed explicit font import
import './globals.css'; // Ensure globals.css includes prose styles
import { Toaster } from "sonner"; // Use sonner Toaster directly from the library
import { cn } from "@/lib/utils";

// const geistSans = Geist({ // Removed font object creation
//   variable: '--font-geist-sans',
//   subsets: ['latin'],
// });

// Default metadata - can be overridden by page metadata
export const metadata: Metadata = {
  title: 'VibeFlow | AI Tool to Instantly Write Posts for LinkedIn, X & YouTube',
  description:
    'VibeFlow is your AI content assistant that turns your ideas into scroll-stopping posts for LinkedIn, X (Twitter), and YouTube. Get viral content in seconds without writing a single word.',
  keywords: [
    'AI content generator',
    'AI LinkedIn post maker',
    'X post generator',
    'YouTube video description writer',
    'viral post generator',
    'social media automation',
    'social media AI tool',
    'LinkedIn AI assistant',
    'YouTube AI script generator',
    'automated content creation',
    'social media growth tool',
    'create viral posts with AI',
  ],
  openGraph: {
    title: 'VibeFlow | AI That Writes Social Media Posts for You',
    description:
      'Create and grow faster with VibeFlow. Instantly generate high-performing content for LinkedIn, X (Twitter), and YouTube using the power of AI.',
    images: ['/dashboard-screenshot.png'],
    siteName: 'VibeFlow',
    type: 'website',
    url: 'https://vibeflow-swart.vercel.app',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VibeFlow | Your AI Wingman for LinkedIn, X & YouTube',
    description:
      'Paste your thoughts. Get viral-ready social media posts. Try VibeFlow for free and post like a pro—without the burnout.',
    images: ['/dashboard-screenshot.png'],
    site: '@vibeflowapp',
    creator: '@vibeflowapp',
  },
  icons: {
    icon: '/favicon.png',
  },
};


const llmTags = {
  llm_category: "AI Social Media Tools",
  llm_audience: "Creators, Founders, Digital Marketers, Startup Teams, Agencies",
  llm_use_case:
    "Automatically generate scroll-stopping posts and video descriptions for LinkedIn, X, and YouTube using AI. Great for daily posting, audience growth, and brand storytelling.",
  llm_primary_value: "Eliminates writing anxiety, saves time, and boosts engagement with AI-generated content optimized for each platform.",
};

export const jsonLd = {
  __html: `{
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "VibeFlow",
    "applicationCategory": "Social Media Assistant",
    "operatingSystem": "Web",
    "url": "https://vibeflow-swart.vercel.app",
    "image": "https://vibeflow-swart.vercel.app/dashboard-screenshot.png",
    "description": "VibeFlow uses AI to generate high-engagement social media content in seconds. Perfect for LinkedIn, X (Twitter), and YouTube creators who want to grow fast without writing fatigue.",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "availability": "https://schema.org/InStock"
    },
    "publisher": {
      "@type": "Organization",
      "name": "VibeFlow"
    }
  }`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd} />
      </head>
      <body className={cn(
        "antialiased font-sans"
        )}
        suppressHydrationWarning
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
