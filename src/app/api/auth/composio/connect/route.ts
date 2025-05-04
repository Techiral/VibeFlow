'use server';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { App as ComposioAppEnum } from "composio-core";
import { z } from 'zod';

// Zod schema for request body validation
const connectSchema = z.object({
  appName: z.enum(['linkedin', 'twitter', 'youtube']),
  user_id: z.string().uuid(),
  redirect_uri: z.string().url().optional(), // Optional, might be configured globally
});

// Function to check if composio-core is installed
async function isComposioCoreInstalled(): Promise<boolean> {
  try {
    await import('composio-core');
    return true;
  } catch (e) {
    console.warn("composio-core package not found. Skipping Composio operations.");
    return false;
  }
}


export async function POST(request: Request) {
  const supabase = await createClient();

  // Check user authentication
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let requestBody;
  try {
    requestBody = await request.json();
    const validationResult = connectSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.flatten() }, { status: 400 });
    }
    requestBody = validationResult.data; // Use validated data
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { appName, user_id: entityId } = requestBody;
  const redirectUri = requestBody.redirect_uri || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002'}/auth/composio-callback`; // Default callback URL

  // Fetch user's Composio API key from their profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('composio_api_key')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    console.error("Error fetching profile or profile not found:", profileError?.message);
    return NextResponse.json({ error: 'User profile not found or error fetching profile' }, { status: 500 });
  }

  const composioApiKey = profile.composio_api_key;

  if (!composioApiKey) {
    return NextResponse.json({ error: "User's Composio API Key is missing. Please add it in profile settings." }, { status: 400 });
  }

  // Check if composio-core is installed before trying to use it
  if (!await isComposioCoreInstalled()) {
    return NextResponse.json({ error: 'Composio integration is not fully configured on the server.' }, { status: 501 });
  }

  // Dynamically import composio-core only if installed
  const { OpenAIToolSet } = await import('composio-core');

  try {
    // Initialize ComposioToolSet with the user's API key
    const toolset = new OpenAIToolSet({ apiKey: composioApiKey });

    // Try to get the entity
    let entity;
    try {
        entity = await toolset.getEntity(entityId);
        if (!entity) {
           throw new Error(`Entity with ID ${entityId} not found or could not be created.`);
        }
    } catch (entityError: any) {
        // Handle cases where getEntity might fail (e.g., API key invalid, network issue)
        console.error(`Failed to get or create Composio entity for ${entityId}:`, entityError.message);
        // Check if the error message indicates the method doesn't exist (library issue)
        if (entityError.message?.includes("getEntity is not a function") || entityError.message?.includes("method not found")) {
             return NextResponse.json({ error: "Composio SDK issue: 'getEntity' method not found. Please check the 'composio-core' library version or initialization." }, { status: 500 });
        }
        return NextResponse.json({ error: `Failed to get or create Composio entity: ${entityError.message}` }, { status: 500 });
    }


    console.log(`Initiating ${appName} connection for entity: ${entity.id}`);

    // Map appName string to ComposioAppEnum if necessary, assuming direct string usage is okay
    const appToConnect = appName as ComposioAppEnum; // Cast or map based on library requirements

    // Initiate connection using the app's name and the entity object
    const connectionRequest = await entity.initiateConnection({
      appName: appToConnect,
      redirectUri: redirectUri, // Pass the redirect URI
      // entityId is implicitly handled by calling initiateConnection on the entity object
    });

    if (connectionRequest.redirectUrl) {
      console.log(`Redirecting user to Composio for ${appName} auth: ${connectionRequest.redirectUrl}`);
      // Return the redirect URL for the frontend to handle
      return NextResponse.json({ redirectUrl: connectionRequest.redirectUrl });
    } else {
      console.error("Composio did not return a redirect URL for OAuth flow.");
      // Handle non-OAuth or error cases if applicable
      // If connection is immediate (e.g., API key), handle differently
      return NextResponse.json({ error: 'Could not initiate OAuth flow. No redirect URL received.' }, { status: 500 });
    }

  } catch (error: any) {
    console.error(`Error initiating Composio connection for ${appName}:`, error);

    // Check for specific SDK errors if possible
    if (error.message?.includes("getEntity is not a function")) {
       return NextResponse.json({ error: "Composio SDK issue: 'getEntity' method not found. Please check the 'composio-core' library version or initialization." }, { status: 500 });
    }
    // Check for authentication errors (e.g., invalid API key)
     if (error.message?.includes("authentication failed") || error.message?.includes("Invalid API Key")) {
         return NextResponse.json({ error: 'Composio authentication failed. Please check your API Key.' }, { status: 401 });
     }

    return NextResponse.json({ error: `Failed to initiate connection: ${error.message}` }, { status: 500 });
  }
}

// Optional: Add GET handler if needed, otherwise it defaults to 405 Method Not Allowed
// export async function GET(request: Request) {
//   return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
// }
