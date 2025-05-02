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

  // 3. Get Developer COMPOSIO_API_KEY from environment
  const composioApiKey = process.env.COMPOSIO_API_KEY;
  if (!composioApiKey) {
    console.error('API Composio Connect: Missing COMPOSIO_API_KEY environment variable on the server.');
    return NextResponse.json({ error: 'Server configuration error: Missing Composio API Key.' }, { status: 500 });
  }

  // 4. Initialize Composio ToolSet and Initiate Connection
  try {
    const toolset = new OpenAIToolSet({ apiKey: composioApiKey }); // Use developer key
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
      // Handle cases where redirectUrl isn't needed (e.g., API key auth, though less common for these apps)
      // Or if connection failed without throwing an error but didn't provide a URL
       console.warn(`API Composio Connect: No redirect URL received for ${appName}. Connection ID: ${connectionRequest.connectedAccountId}`);
       // If it's instantly active (rare for OAuth), you might update DB here, but callback is safer
      return NextResponse.json({ error: 'Connection initiated, but no redirect URL provided. Check Composio setup or app type.' }, { status: 500 });
    }

  } catch (error: any) {
    console.error(`API Composio Connect: Error initiating ${appName} connection for user ${user.id}:`, error);
    // Provide more specific feedback if possible
    let errorMessage = `Failed to initiate ${appName} connection.`;
    if (error.message?.includes('entity')) {
        errorMessage = `Could not find or create Composio entity for user: ${error.message}`;
    } else if (error.message?.includes('integration')) {
         errorMessage = `Composio integration for ${appName} not found or configured incorrectly.`;
    } else {
        errorMessage = error.message || errorMessage;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
