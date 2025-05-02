// src/app/auth/composio-callback/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { ComposioApp } from '@/types/supabase';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code'); // Composio might return a code
  const stateParam = searchParams.get('state'); // Retrieve the state parameter

  console.log('Composio Callback Received:', { code, state: stateParam });

  let userId: string | null = null;
  let app: ComposioApp | null = null;
  let parsedState: any = null;

  // Parse the state parameter
  if (stateParam) {
      try {
          parsedState = JSON.parse(decodeURIComponent(stateParam));
          userId = parsedState?.userId;
          app = parsedState?.app;
      } catch (e) {
          console.error("Composio callback: Failed to parse state parameter:", e);
          return NextResponse.redirect(`${origin}/dashboard?error=composio_auth_failed&message=Invalid+state+parameter+received.`);
      }
  }

  if (!userId) {
      console.error("Composio callback missing user_id in state.");
      return NextResponse.redirect(`${origin}/dashboard?error=composio_auth_failed&message=User+identification+missing+in+authentication+state.`);
  }

  if (!app || !['linkedin', 'twitter', 'youtube'].includes(app)) {
       console.error("Composio callback missing or invalid app identifier in state.");
      return NextResponse.redirect(`${origin}/dashboard?error=composio_auth_failed&message=Application+identifier+missing+or+invalid+in+state.`);
  }

  // Placeholder: Verify the 'code' or 'state' with Composio if necessary
  // This step depends heavily on Composio's specific OAuth flow and security requirements.
  // You might need to exchange the 'code' for an access token using a server-side call to Composio's API.
  // For simplicity, we'll assume the presence of 'code' (or just reaching the callback) indicates potential success.

  if (!code) {
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      console.error(`Composio callback error: ${error || 'No code received.'} Description: ${errorDescription || 'N/A'}`);
      return NextResponse.redirect(`${origin}/dashboard?error=composio_auth_failed&message=${encodeURIComponent(errorDescription || 'Authentication denied or failed.')}`);
  }


  try {
    const supabase = await createClient();

    // Check if the user making the callback matches the userId from the state
    // This adds a layer of security, though Supabase RLS should also handle this.
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser || currentUser.id !== userId) {
        console.error(`Composio callback user mismatch: State for ${userId}, current user is ${currentUser?.id}`);
         return NextResponse.redirect(`${origin}/dashboard?error=composio_auth_failed&message=Authentication+session+mismatch.`);
    }


    const updateField = `is_${app}_authed` as const; // e.g., 'is_linkedin_authed'
    console.log(`Updating profile for user ${userId}, setting ${updateField} to true.`);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ [updateField]: true, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) {
      console.error(`Error updating profile after ${app} Composio auth:`, updateError.message);
       return NextResponse.redirect(`${origin}/dashboard?error=composio_db_update_failed&message=Failed+to+save+authentication+status.`);
    }

    console.log(`Successfully marked ${app} as authenticated for user ${userId}`);
    // Redirect back to the dashboard with success parameters
    return NextResponse.redirect(`${origin}/dashboard?success=composio_auth&app=${app}`);

  } catch (error: any) {
    console.error("Error during Composio callback processing:", error.message);
    return NextResponse.redirect(`${origin}/dashboard?error=composio_auth_failed&message=An+unexpected+error+occurred.`);
  }
}
