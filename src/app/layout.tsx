import type {Metadata} from 'next';
import { Geist } from 'next/font/google'; // Only Geist Sans needed
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

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
    <html lang="en" className="dark" suppressHydrationWarning>{/* Force dark theme and suppress hydration warning */}
      {/* No whitespace allowed here */}
      <head /> {/* Add explicit head tag */}
      {/* No whitespace allowed here */}
      <body className={cn(
        geistSans.variable,
        "antialiased font-sans" // Use sans-serif font
        )}
        suppressHydrationWarning={true} // Add this to ignore browser extension attributes
        >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
