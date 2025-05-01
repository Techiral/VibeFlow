
import type {Metadata} from 'next';
import { Geist } from 'next/font/google'; // Only Geist Sans needed
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

// Default metadata - can be overridden by page metadata
export const metadata: Metadata = {
  title: 'VibeFlow',
  description: 'Generate Social Posts with AI',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>{/* Force dark theme via class, suppress warning */}
      <head />{/* Explicit head tag */}
      {/* No whitespace allowed between html and head or head and body */}
      <body
        className={cn(
          geistSans.variable,
          "antialiased font-sans" // Use sans-serif font
        )}
        suppressHydrationWarning // Suppress hydration warning on body for browser extensions
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
