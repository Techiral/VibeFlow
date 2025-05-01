
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'; // Assuming you have types generated

// Helper function to safely get cookies
async function getCookie(name: string) {
  const cookieStore = cookies(); // This can be called synchronously
  return cookieStore.get(name)?.value;
}

// Helper function to safely set cookies
async function setCookie(name: string, value: string, options: CookieOptions) {
  try {
    const cookieStore = cookies(); // This can be called synchronously
    cookieStore.set({ name, value, ...options });
  } catch (error) {
    // Ignore errors when called from Server Components
  }
}

// Helper function to safely remove cookies
async function removeCookie(name: string, options: CookieOptions) {
  try {
    const cookieStore = cookies(); // This can be called synchronously
    cookieStore.set({ name, value: '', ...options });
  } catch (error) {
    // Ignore errors when called from Server Components
  }
}


export function createClient() {
  // const cookieStore = cookies() // Moved inside helper functions

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


  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        // Make get async and await the helper
        get: async (name: string) => {
          return await getCookie(name);
        },
        // Make set async and await the helper
        set: async (name: string, value: string, options: CookieOptions) => {
           await setCookie(name, value, options);
        },
        // Make remove async and await the helper
        remove: async (name: string, options: CookieOptions) => {
           await removeCookie(name, options);
        },
      },
    }
  )
}
