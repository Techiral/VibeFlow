// src/app/api/auth/composio/connect/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server'; // Use server client for security
import { OpenAIToolSet, App as ComposioAppEnum } from 'composio-core'; // Import Composio SDK
import type { ComposioApp } from '@/types/supabase'; // Your app type

export async function POST(request: Request) {
  console.log('API Composio Connect: Received POST request.');
  const supabase = await createClient();

  // 1. Check user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    console.error('API Composio Connect: Auth error:', authError?.message || 'User not found.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  console.log(`API Composio Connect: User authenticated: ${user.id}`);

  // 2. Parse request body
  let appName: ComposioApp;
  try {
    const body = await request.json();
    if (!body.appName || !['linkedin', 'twitter', 'youtube'].includes(body.appName)) {
      throw new Error('Invalid or missing appName in request body');
    }
    appName = body.appName as ComposioApp;
    console.log(`API Composio Connect: Parsed appName from body: ${appName}`);
  } catch (error: any) {
    console.error('API Composio Connect: Invalid request body:', error.message);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // 3. Get User's Composio API Key from Request Header
  const userComposioApiKey = request.headers.get('X-Composio-Key');
  if (!userComposioApiKey) {
    console.error('API Composio Connect: Missing X-Composio-Key header in request.');
    return NextResponse.json({ error: 'Composio API Key missing in request header.' }, { status: 401 });
  }
  console.log('API Composio Connect: Received X-Composio-Key header.'); // Don't log the key itself

  // 4. Initialize Composio ToolSet using the User's Key and Initiate Connection
  let toolset;
  try {
    console.log("API Composio Connect: Initializing OpenAIToolSet...");
    // **Use the user's API key from the header**
    toolset = new OpenAIToolSet({ apiKey: userComposioApiKey });
    if (!toolset || typeof toolset !== 'object') { // Add check if toolset creation failed
        console.error("API Composio Connect: Failed to initialize OpenAIToolSet. Result:", toolset);
        throw new Error("Failed to initialize Composio ToolSet instance.");
    }
    console.log("API Composio Connect: OpenAIToolSet instance created.");

    // Verify getEntity exists before calling
    if (typeof toolset.getEntity !== 'function') {
        console.error("API Composio Connect: CRITICAL - toolset.getEntity is NOT a function. Available methods:", Object.keys(toolset));
        throw new Error("Composio SDK method 'getEntity' not found. Check SDK version or usage.");
    }
    console.log("API Composio Connect: toolset.getEntity IS a function.");


    console.log(`API Composio Connect: Calling getEntity for user ID: ${user.id}`);
    // Explicitly await getEntity and log the result or error
    let entity;
    try {
      entity = await toolset.getEntity(user.id); // Use VibeFlow user ID as entity ID
       if (!entity || typeof entity !== 'object' || !entity.id) { // Add check for valid entity object
         console.error(`API Composio Connect: toolset.getEntity(${user.id}) returned invalid entity object:`, entity);
         throw new Error("Failed to retrieve a valid Composio entity for the user.");
       }
       console.log(`API Composio Connect: Successfully got entity object for ID: ${entity.id}`);
    } catch (getEntityError: any) {
        console.error(`API Composio Connect: Error calling toolset.getEntity(${user.id}):`, getEntityError.message);
        // Re-throw to be caught by the outer catch block with a more specific message
        throw new Error(`Failed to get Composio entity: ${getEntityError.message}`);
    }


    // Verify initiateConnection exists on the entity object
     if (typeof entity.initiateConnection !== 'function') {
         console.error("API Composio Connect: CRITICAL - entity.initiateConnection is NOT a function. Entity methods:", Object.keys(entity));
         throw new Error("Composio SDK method 'initiateConnection' not found on entity object.");
     }
     console.log("API Composio Connect: entity.initiateConnection IS a function.");

    console.log(`API Composio Connect: Initiating ${appName} connection for entity: ${entity.id}`);

    // Map your appName string to Composio's App Enum
    let composioAppEnumValue: ComposioAppEnum;
    switch (appName) {
      case 'linkedin': composioAppEnumValue = ComposioAppEnum.LINKEDIN; break;
      case 'twitter': composioAppEnumValue = ComposioAppEnum.TWITTER; break;
      case 'youtube': composioAppEnumValue = ComposioAppEnum.YOUTUBE; break;
      default:
        // This case should theoretically not be reached due to earlier validation
        console.error(`API Composio Connect: Unexpected invalid appName: ${appName}`);
        throw new Error(`Invalid appName: ${appName}`);
    }
    console.log(`API Composio Connect: Mapped appName '${appName}' to ComposioAppEnum '${composioAppEnumValue}'`);

    const callbackUrl = `${process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin}/auth/composio-callback`;
    console.log(`API Composio Connect: Using callback URL: ${callbackUrl}`);

    const connectionRequest = await entity.initiateConnection({
        appName: composioAppEnumValue,
        // Pass user ID in state to identify user during callback
        state: JSON.stringify({ userId: user.id, app: appName }),
        // redirectUri is crucial for OAuth callback
        redirectUri: callbackUrl // Construct callback URL
    });

    // 5. Return redirectUrl if available
    if (connectionRequest?.redirectUrl) {
      console.log(`API Composio Connect: Redirect URL generated: ${connectionRequest.redirectUrl}`);
      return NextResponse.json({ redirectUrl: connectionRequest.redirectUrl });
    } else {
       console.warn(`API Composio Connect: No redirect URL received for ${appName}. Connection ID: ${connectionRequest?.connectedAccountId || 'N/A'}`);
      // Even if no redirect URL, it might mean connection is already active or uses a different flow.
      // Let's try to update Supabase assuming success if no redirect URL but also no error.
      // Check if the profile needs updating based on the potentially pre-existing connection
      const updateField = `is_${appName}_authed` as const;
       const { data: existingProfile, error: profileError } = await supabase
         .from('profiles')
         .select(updateField)
         .eq('id', user.id)
         .maybeSingle();

        if (!profileError && existingProfile && !existingProfile[updateField]) {
             // If profile exists and isn't marked as authed, update it
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ [updateField]: true, updated_at: new Date().toISOString() })
              .eq('id', user.id);
            if (updateError) {
                 console.error(`API Composio Connect: Failed to update profile for existing connection (${appName}):`, updateError.message);
                 // Still return success to client, but log error
            } else {
                 console.log(`API Composio Connect: Updated profile for potentially existing connection (${appName}).`);
            }
        } else if (profileError) {
            console.error(`API Composio Connect: Error checking profile before update (${appName}):`, profileError.message);
        }

      return NextResponse.json({ message: 'Connection may already be active or uses a non-redirect flow.' });
      // Previous return:
      // return NextResponse.json({ error: 'Connection initiated, but no redirect URL provided. Check Composio setup or app type.' }, { status: 500 });
    }

  } catch (error: any) {
    console.error(`API Composio Connect: Error initiating ${appName} connection for user ${user.id}:`, error);
    // Provide more specific feedback if possible
    let errorMessage = `Failed to initiate ${appName} connection.`;
    let errorStatus = 500;
    const errorMsgLower = error.message?.toLowerCase() || '';

    // Check for specific error messages related to SDK issues
    if (errorMsgLower.includes("'getentity' not found") || errorMsgLower.includes("toolset.getentity is not a function")) {
         errorMessage = `Composio SDK issue: 'getEntity' method not found. Please check the 'composio-core' library version or initialization.`;
         errorStatus = 500; // Internal server error due to SDK issue
    } else if (errorMsgLower.includes("api key") || errorMsgLower.includes("unauthorized") || error.status === 401) {
         errorMessage = `Invalid Composio API Key provided. Please check the key in your profile.`;
         errorStatus = 401;
    } else if (errorMsgLower.includes('failed to retrieve a valid composio entity') || errorMsgLower.includes('failed to get composio entity')) { // Handle specific error from entity retrieval
        errorMessage = `Could not find or create Composio entity for user: ${error.message}`;
        errorStatus = 500;
    } else if (errorMsgLower.includes("'initiateconnection' not found")) { // Check for initiateConnection error
         errorMessage = `Composio SDK issue: 'initiateConnection' method not found on entity. Please check the 'composio-core' library version or initialization.`;
         errorStatus = 500; // Internal server error due to SDK issue
    } else if (errorMsgLower.includes('integration')) { // Check for integration issues
         errorMessage = `Composio integration for ${appName} not found or configured incorrectly.`;
         errorStatus = 400; // Bad request likely due to config
    } else {
        errorMessage = error.message || errorMessage; // Default to the error message
    }
    console.error(`API Composio Connect: Final error response: Status=${errorStatus}, Message='${errorMessage}'`);
    return NextResponse.json({ error: errorMessage }, { status: errorStatus });
  }
}
