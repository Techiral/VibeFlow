// src/app/api/auth/composio/connect/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server'; // Use server client for security
import { OpenAIToolSet, App as ComposioAppEnum } from 'composio-core'; // Import Composio SDK
import type { ComposioApp } from '@/types/supabase'; // Your app type

export async function POST(request: Request) {
  const supabase = await createClient();

  // 1. Check user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('API Composio Connect: Auth error:', authError?.message);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse request body
  let appName: ComposioApp;
  try {
    const body = await request.json();
    if (!body.appName || !['linkedin', 'twitter', 'youtube'].includes(body.appName)) {
      throw new Error('Invalid or missing appName in request body');
    }
    appName = body.appName as ComposioApp;
  } catch (error: any) {
    console.error('API Composio Connect: Invalid request body:', error.message);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // 3. Get User's Composio API Key from Request Header
  const userComposioApiKey = request.headers.get('X-Composio-Key');
  if (!userComposioApiKey) {
    console.error('API Composio Connect: Missing X-Composio-Key header in request.');
    // Return a specific error indicating the user needs to provide their key
    return NextResponse.json({ error: 'Composio API Key missing in request. Please ensure it is set in your profile and included in the request.' }, { status: 401 }); // Use 401 or 400
  }

  // 4. Initialize Composio ToolSet using the User's Key and Initiate Connection
  try {
    // **Use the user's API key from the header**
    const toolset = new OpenAIToolSet({ apiKey: userComposioApiKey });
    const entity = await toolset.getEntity(user.id); // Use VibeFlow user ID as entity ID

    console.log(`API Composio Connect: Initiating ${appName} connection for entity: ${entity.id}`);

    // Map your appName string to Composio's App Enum if necessary
    let composioAppEnumValue: ComposioAppEnum;
    switch (appName) {
      case 'linkedin': composioAppEnumValue = ComposioAppEnum.LINKEDIN; break;
      case 'twitter': composioAppEnumValue = ComposioAppEnum.TWITTER; break; // Adjust if Enum name differs
      case 'youtube': composioAppEnumValue = ComposioAppEnum.YOUTUBE; break; // Adjust if Enum name differs
      default: throw new Error(`Invalid appName: ${appName}`);
    }

    const connectionRequest = await entity.initiateConnection({
        appName: composioAppEnumValue,
        // Pass user ID in state to identify user during callback
        state: JSON.stringify({ userId: user.id, app: appName }),
        // redirectUri is crucial for OAuth callback
        redirectUri: `${process.env.NEXT_PUBLIC_BASE_URL || request.headers.get('origin')}/auth/composio-callback` // Construct callback URL
    });

    // 5. Return redirectUrl if available
    if (connectionRequest.redirectUrl) {
      console.log(`API Composio Connect: Redirect URL generated: ${connectionRequest.redirectUrl}`);
      return NextResponse.json({ redirectUrl: connectionRequest.redirectUrl });
    } else {
       console.warn(`API Composio Connect: No redirect URL received for ${appName}. Connection ID: ${connectionRequest.connectedAccountId}`);
      return NextResponse.json({ error: 'Connection initiated, but no redirect URL provided. Check Composio setup or app type.' }, { status: 500 });
    }

  } catch (error: any) {
    console.error(`API Composio Connect: Error initiating ${appName} connection for user ${user.id}:`, error);
    // Provide more specific feedback if possible
    let errorMessage = `Failed to initiate ${appName} connection.`;
    if (error.message?.includes('API key') || error.status === 401) {
         errorMessage = `Invalid Composio API Key provided. Please check the key in your profile.`;
         return NextResponse.json({ error: errorMessage }, { status: 401 });
    } else if (error.message?.includes('entity')) {
        errorMessage = `Could not find or create Composio entity for user: ${error.message}`;
    } else if (error.message?.includes('integration')) {
         errorMessage = `Composio integration for ${appName} not found or configured incorrectly.`;
    } else {
        errorMessage = error.message || errorMessage;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
