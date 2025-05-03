
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL, otherwise default to dashboard
  const next = searchParams.get('next') ?? '/dashboard' // Default to dashboard

  if (code) {
    // Await createClient as it's now async
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Ensure the redirect URL is relative to the origin
      const redirectUrl = new URL(next, origin);
      return NextResponse.redirect(redirectUrl.toString())
    }
     // Log the error if code exchange fails
     console.error("Auth Callback Error:", error.message);
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?message=Could not log in with provider. Please try again.`)
}
