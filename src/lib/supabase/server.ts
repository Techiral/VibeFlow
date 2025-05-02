
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'; // Assuming you have types generated

// Helper function to safely get cookies - Make it async
async function getCookie(name: string): Promise<string | undefined> {
  // cookies() can be called synchronously, but ensure compatibility and adhere to Next.js recommendations.
  // Await potentially helps if Next.js internals expect an async boundary here.
  const cookieStore = cookies(); // Await cookies() call
  return cookieStore.get(name)?.value;
}

// Helper function to safely set cookies - Make it async
async function setCookie(name: string, value: string, options: CookieOptions): Promise<void> {
  try {
    // cookies() can be called synchronously in Server Actions/Route Handlers
    const cookieStore = cookies(); // Await cookies() call
    cookieStore.set({ name, value, ...options });
  } catch (error) {
    // Log error if setting fails (e.g., called from RSC render path where cookies() might not be writable)
    // This warning is expected during RSC rendering paths and is handled gracefully.
    // Supabase SSR tries to manage session cookies, but Next.js prevents direct cookie setting outside Server Actions/Route Handlers.
    // The middleware handles the session update on subsequent requests.
    console.warn(`[Supabase Server Client] Failed to set cookie '${name}'. This might be expected if called during RSC rendering. Error: ${error}`);
  }
}

// Helper function to safely remove cookies - Make it async
async function removeCookie(name: string, options: CookieOptions): Promise<void> {
  try {
    // cookies() can be called synchronously in Server Actions/Route Handlers
    const cookieStore = cookies(); // Await cookies() call
    cookieStore.set({ name, value: '', ...options });
  } catch (error) {
     // Log error if removal fails
     // This warning is expected during RSC rendering paths and is handled gracefully.
    console.warn(`[Supabase Server Client] Failed to remove cookie '${name}'. This might be expected if called during RSC rendering. Error: ${error}`);
  }
}


// Make createClient itself async
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

   // Explicitly check for environment variables and throw if missing
   if (!supabaseUrl || !supabaseAnonKey) {
    // This error should be caught by the calling code (e.g., in page.tsx)
    // to display a user-friendly message.
    throw new Error(
      "Supabase URL or Key is missing. Please check your environment variables (.env.local)."
    );
  }


  // The createServerClient function itself doesn't need to be awaited here.
  // It's the functions passed into the `cookies` object that need to handle async operations correctly.
  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        // Pass the async helper functions to Supabase client options
        get: async (name: string) => {
          // Await the helper function call
          return await getCookie(name);
        },
        set: async (name: string, value: string, options: CookieOptions) => {
           // Await the helper function call
           await setCookie(name, value, options);
        },
        remove: async (name: string, options: CookieOptions) => {
           // Await the helper function call
           await removeCookie(name, options);
        },
      },
    }
  )
}
