// src/services/composio-service.ts
'use server';

// Removed OpenAIToolSet import as it's not used here anymore
// import { OpenAIToolSet } from "composio-core";
// Removed OpenAI import as it's not used here anymore
// import { OpenAI } from "openai";
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

// Removed the handleAuthenticateApp function as authentication is handled by
// redirecting to the API route '/api/auth/composio/connect'

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
