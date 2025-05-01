
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'; // Assuming you have types generated

// Helper function to safely get cookies - No need to be async here
function getCookie(name: string) {
  const cookieStore = cookies(); // This can be called synchronously inside Route Handlers or Server Actions
  return cookieStore.get(name)?.value;
}

// Helper function to safely set cookies - No need to be async here
function setCookie(name: string, value: string, options: CookieOptions) {
  try {
    const cookieStore = cookies(); // This can be called synchronously
    cookieStore.set({ name, value, ...options });
  } catch (error) {
    // Usually happens when called from Server Components where `cookies` is read-only
    console.warn(`Failed to set cookie '${name}' from a Server Component. This is often intended if used for reading cookies. Error: ${error}`);
  }
}

// Helper function to safely remove cookies - No need to be async here
function removeCookie(name: string, options: CookieOptions) {
  try {
    const cookieStore = cookies(); // This can be called synchronously
    cookieStore.set({ name, value: '', ...options });
  } catch (error) {
     // Usually happens when called from Server Components where `cookies` is read-only
    console.warn(`Failed to remove cookie '${name}' from a Server Component. This is often intended if used for reading cookies. Error: ${error}`);
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
        // `get` is called by Supabase client, it expects a sync return or Promise
        // Since `cookies().get()` is sync, we can directly return the value
        get: (name: string) => {
          return getCookie(name);
        },
        // `set` and `remove` are called by Supabase client during auth actions (Server Actions)
        // where `cookies().set()` is available and sync.
        set: (name: string, value: string, options: CookieOptions) => {
           setCookie(name, value, options);
        },
        remove: (name: string, options: CookieOptions) => {
           removeCookie(name, options);
        },
      },
    }
  )
}
