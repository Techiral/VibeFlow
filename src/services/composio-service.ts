// src/services/composio-service.ts
'use server';

import { OpenAIToolSet } from "composio-core";
import { OpenAI } from "openai";
import { createClient } from '@/lib/supabase/server'; // Use server client for profile updates
import type { ComposioApp } from '@/types/supabase';

// This function likely needs to be executed in an environment where the Composio CLI
// or equivalent library can interact with the user's system/browser for login.
// Directly calling `composio login` from here is not feasible.
// This function should ideally trigger the process and perhaps return a status or instructions.
// For now, we assume it interacts with environment variables.
export async function startComposioLogin(): Promise<{ success: boolean; key?: string | null; error?: string }> {
    console.log("Attempting Composio login (server-side)...");
    // In a real scenario, this would need a way to securely get the API key
    // associated with the logged-in user. This might involve a separate
    // secure backend process or reading it from a pre-configured, secure source.
    // Directly running `composio login` here won't work as it requires user interaction.

    // For this example, we'll assume the API key is set as an environment variable
    // **Important:** This is generally NOT secure for multi-user apps.
    // The key should ideally be fetched from the user's profile or a secure store.
    const apiKey = process.env.COMPOSIO_API_KEY;

    if (!apiKey) {
        const errorMsg = "COMPOSIO_API_KEY environment variable not found. Composio login likely failed or is not configured on the server.";
        console.error(errorMsg);
        return { success: false, error: errorMsg };
    }

    console.log("Composio API Key found in environment variables.");
    // Simulating success - in reality, you'd verify the key or login status
    return { success: true, key: apiKey };
}

export async function handleAuthenticateApp(
    appName: ComposioApp,
    userId: string,
    composioApiKey: string
): Promise<{ success: boolean; authUrl?: string; error?: string }> {
    console.log(`Handling authentication for ${appName} for user ${userId}`);

    try {
        // Initialize Composio ToolSet with the user-specific API key
        const toolset = new OpenAIToolSet({ apiKey: composioApiKey });
        // OpenAI client might not be needed just for getting tools/auth URL
        // const client = new OpenAI();

        // Define the action based on the app
        let action: string;
        switch (appName) {
            case 'linkedin':
                action = "LINKEDIN_GET_THE_AUTHENTICATED_USER"; // Example action
                break;
            case 'twitter':
                action = "TWITTER_GET_THE_AUTHENTICATED_USER"; // Example action
                break;
            case 'youtube':
                action = "YOUTUBE_GET_THE_AUTHENTICATED_USER"; // Example action
                break;
            default:
                throw new Error(`Unsupported app: ${appName}`);
        }

        console.log(`Getting tools for action: ${action}`);
        // Get tools - this might trigger authentication if not connected
        // Note: The exact behavior of getTools regarding authentication prompts isn't fully documented for direct API key use.
        // It might implicitly handle the connection or require a separate connection step.
        // For OAuth flows, Composio typically provides a connection URL.
        // Let's assume `getTools` might return an auth URL if needed, or we might need a different method.

        // --- Potential Issue: `getTools` might not be the correct method ---
        // The `getTools` method is primarily for listing available actions for an LLM.
        // For initiating authentication, Composio usually uses an OAuth flow triggered by a specific URL.
        // Let's construct the likely OAuth URL pattern instead.

        const supabase = await createClient();
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('composio_mcp_url')
            .eq('id', userId)
            .single();

        if (profileError || !profileData?.composio_mcp_url) {
             throw new Error(`Could not retrieve Composio MCP URL for user: ${profileError?.message || 'URL not found'}`);
        }

        const mcpUrl = profileData.composio_mcp_url;
        const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || ''}/auth/composio-callback`; // Use env var for base URL
        const authUrl = `${mcpUrl}/connect?app=${appName}&redirect_uri=${encodeURIComponent(redirectUri)}&user_id=${encodeURIComponent(userId)}`;

        console.log(`Constructed auth URL: ${authUrl}`);

        // Instead of calling getTools, return the constructed auth URL
        // const tools = await toolset.getTools({ actions: [action] });
        // console.log(`Tools received:`, tools);
        // Check if tools array is empty or indicates required authentication action?

        // Return the auth URL for the frontend to redirect to
        return { success: true, authUrl: authUrl };

    } catch (error: any) {
        console.error(`Error during ${appName} authentication process:`, error.message);
        return { success: false, error: error.message || `Failed to initiate ${appName} authentication.` };
    }
}

// Placeholder for removing authentication (if needed)
export async function handleDeauthenticateApp(appName: ComposioApp, userId: string): Promise<{ success: boolean; error?: string }> {
     console.log(`Deauthenticating ${appName} for user ${userId}`);
     // Implementation depends on Composio's API for removing connections.
     // This might involve calling a specific Composio API endpoint.
     // For now, just update the Supabase profile.
     try {
        const supabase = await createClient();
        const updateField = `is_${appName}_authed` as const;
        const { error } = await supabase
             .from('profiles')
             .update({ [updateField]: false })
             .eq('id', userId);
        if (error) throw error;
        return { success: true };
     } catch (error: any) {
        return { success: false, error: `Failed to deauthenticate ${appName}: ${error.message}` };
     }
}
