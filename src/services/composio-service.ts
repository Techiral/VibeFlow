'use server';

/**
 * @fileOverview Service for interacting with Composio, specifically for app authentication.
 */

import { createClient } from '@/lib/supabase/server'; // Use server client for secure operations
import type { ComposioApp } from '@/types/supabase';

interface AuthenticateAppInput {
    app: ComposioApp;
    mcpUrl: string; // The user's specific MCP URL
}

/**
 * Placeholder function to simulate Composio app authentication.
 * In a real scenario, this would involve:
 * 1. Constructing the specific OAuth URL for the given app using the MCP URL base.
 * 2. Potentially redirecting the user to that URL (if called from client).
 * 3. Or, more likely for backend processing: Making a server-to-server call to Composio
 *    to check connection status or trigger a process based on the MCP URL.
 * 4. Updating the user's profile in the database upon successful authentication.
 *
 * This current implementation is a placeholder and simply returns true after a delay.
 * It also updates the user's profile directly, assuming success.
 *
 * @param input - Contains the app name and the user's MCP URL.
 * @returns A promise that resolves to true if authentication is simulated successfully, false otherwise.
 */
export async function authenticateComposioApp(input: AuthenticateAppInput): Promise<boolean> {
    console.log(`Simulating authentication for ${input.app} using MCP URL: ${input.mcpUrl}`);

    // Input validation
    if (!input.mcpUrl || !input.app) {
        console.error("Composio MCP URL and App name are required.");
        throw new Error("Composio MCP URL and App name are required.");
    }

    try {
        // --- Placeholder for actual Composio Interaction ---
        // Example: Construct OAuth URL (though typically handled client-side via redirect)
        // const authUrl = `${input.mcpUrl}/connect?app=${input.app}&redirect_uri=${encodeURIComponent(process.env.COMPOSIO_REDIRECT_URI || '')}`;
        // console.log("Constructed Auth URL (for info):", authUrl);

        // Example: Make a server-side call to Composio to check connection status (fictional endpoint)
        // const statusCheckUrl = `${input.mcpUrl}/api/status?app=${input.app}`;
        // const response = await fetch(statusCheckUrl, { headers: { /* Add auth if needed */ } });
        // if (!response.ok) {
        //   throw new Error(`Failed to check ${input.app} connection status: ${response.statusText}`);
        // }
        // const statusData = await response.json();
        // if (!statusData.connected) {
        //     throw new Error(`${input.app} is not connected in Composio.`);
        // }

        // Simulate successful interaction after a delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        console.log(`Simulated successful authentication/status check for ${input.app}`);

        // --- Update Supabase Profile ---
        // This part should ideally happen *after* confirming success from Composio.
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            console.error("User not authenticated.");
            throw new Error("User not authenticated.");
        }

        const updateField = `is_${input.app}_authed` as const; // e.g., 'is_linkedin_authed'
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ [updateField]: true, updated_at: new Date().toISOString() }) // Set the specific flag to true
            .eq('id', user.id);

        if (updateError) {
            console.error(`Error updating profile for ${input.app} auth:`, updateError.message);
            // Don't throw here, maybe the Composio part succeeded but DB failed? Log and return false.
            // Consider more nuanced error handling based on the updateError code.
             throw new Error(`Database error updating auth status: ${updateError.message}`); // Throw to indicate failure
        }

        console.log(`Successfully updated profile: ${updateField} = true for user ${user.id}`);
        return true; // Indicate success

    } catch (error: any) {
        console.error(`Authentication process for ${input.app} failed:`, error.message);
        // Optionally, ensure the flag is false in the database on failure
         try {
             const supabase = await createClient();
             const { data: { user } } = await supabase.auth.getUser();
             if (user) {
                 const updateField = `is_${input.app}_authed` as const;
                 await supabase.from('profiles').update({ [updateField]: false }).eq('id', user.id);
             }
         } catch (dbError: any) {
             console.error(`Failed to reset auth status on error for ${input.app}:`, dbError.message);
         }
        // Re-throw the original error to be caught by the calling function
        throw error;
    }
}
