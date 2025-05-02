// src/app/auth/composio-callback/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { ComposioApp } from '@/types/supabase';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code'); // Composio might return a code
  const state = searchParams.get('state'); // Check for state parameter if Composio uses it
  const userId = searchParams.get('user_id'); // Retrieve user_id if passed in state or query
  const app = searchParams.get('app') as ComposioApp | null; // Determine which app was authenticated (might be in state or inferred)

  console.log('Composio Callback Received:', { code, state, userId, app });

  if (!userId) {
      console.error("Composio callback missing user_id.");
      return NextResponse.redirect(`${origin}/dashboard?error=composio_auth_failed&message=User+identification+missing+during+authentication.`);
  }

  if (!app || !['linkedin', 'twitter', 'youtube'].includes(app)) {
       console.error("Composio callback missing or invalid app identifier.");
      return NextResponse.redirect(`${origin}/dashboard?error=composio_auth_failed&message=Application+identifier+missing+or+invalid.`);
  }

  // Placeholder: Verify the 'code' or 'state' with Composio if necessary
  // This step depends heavily on Composio's specific OAuth flow.
  // You might need to exchange the 'code' for an access token or validate the 'state'.
  // For this example, we'll assume the callback indicates success if it reaches here.

  try {
    const supabase = await createClient();

    // Check if the user making the callback matches the userId passed
    // This is a crucial security step if state validation isn't sufficient
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser || currentUser.id !== userId) {
        console.error(`Composio callback user mismatch: Callback for ${userId}, current user is ${currentUser?.id}`);
         return NextResponse.redirect(`${origin}/dashboard?error=composio_auth_failed&message=Authentication+session+mismatch.`);
    }


    const updateField = `is_${app}_authed` as const; // e.g., 'is_linkedin_authed'
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ [updateField]: true, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) {
      console.error(`Error updating profile after ${app} Composio auth:`, updateError.message);
       return NextResponse.redirect(`${origin}/dashboard?error=composio_db_update_failed&message=Failed+to+save+authentication+status.`);
    }

    console.log(`Successfully marked ${app} as authenticated for user ${userId}`);
    // Redirect back to the dashboard, possibly with a success message
    return NextResponse.redirect(`${origin}/dashboard?success=composio_auth&app=${app}`);

  } catch (error: any) {
    console.error("Error during Composio callback processing:", error.message);
    return NextResponse.redirect(`${origin}/dashboard?error=composio_auth_failed&message=An+unexpected+error+occurred.`);
  }
}