
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'; // Assuming you have types generated

// Helper function to safely get cookies - Make it async
async function getCookie(name: string): Promise<string | undefined> {
  // cookies() can be called synchronously, but the API it interacts with might be async in nature.
  // Using await ensures compatibility and adheres to Next.js recommendations for RSC.
  const cookieStore = cookies();
  return cookieStore.get(name)?.value;
}

// Helper function to safely set cookies - Make it async
async function setCookie(name: string, value: string, options: CookieOptions): Promise<void> {
  try {
    // cookies() can be called synchronously in Server Actions
    const cookieStore = cookies();
    cookieStore.set({ name, value, ...options });
  } catch (error) {
    // Log error if setting fails (e.g., called from RSC render path)
    console.warn(`[Supabase Server Client] Failed to set cookie '${name}'. This might be expected if called during RSC rendering. Error: ${error}`);
  }
}

// Helper function to safely remove cookies - Make it async
async function removeCookie(name: string, options: CookieOptions): Promise<void> {
  try {
    // cookies() can be called synchronously in Server Actions
    const cookieStore = cookies();
    cookieStore.set({ name, value: '', ...options });
  } catch (error) {
     // Log error if removal fails
    console.warn(`[Supabase Server Client] Failed to remove cookie '${name}'. This might be expected if called during RSC rendering. Error: ${error}`);
  }
}


export function createClient() {
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
        // Pass the async helper functions to Supabase client options
        get: async (name: string) => {
          return await getCookie(name);
        },
        set: async (name: string, value: string, options: CookieOptions) => {
           await setCookie(name, value, options);
        },
        remove: async (name: string, options: CookieOptions) => {
           await removeCookie(name, options);
        },
      },
    }
  )
}

