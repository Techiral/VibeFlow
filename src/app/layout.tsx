
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
  title: 'VibeFlow',
  description: 'Generate Social Posts with AI',
  // Add favicon reference
  icons: {
    icon: '/favicon.png', // Reference the PNG file in the public folder
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>{/* Force dark theme and suppress hydration warning */}
      <head />{/* Add explicit head tag */}
      {/* No whitespace allowed here */}
      <body className={cn(
        // geistSans.variable, // Removed variable class application
        "antialiased font-sans" // Rely on Tailwind 'font-sans'
        )}
        suppressHydrationWarning // Suppress hydration warning on body for browser extensions
      >
        {children}
        <Toaster /> {/* Use sonner Toaster */}
      </body>
    </html>
  );
}
