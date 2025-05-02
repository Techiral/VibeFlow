// src/services/composio-service.ts
'use server';

import { createClient } from '@/lib/supabase/server'; // Use server client for profile updates
import type { ComposioApp } from '@/types/supabase';
// Potentially import Composio SDK if needed for deauth API call
// import { OpenAIToolSet } from 'composio-core';

// Modify function to accept optional user's Composio Key
export async function handleDeauthenticateApp(appName: ComposioApp, userId: string, userComposioKey?: string | null): Promise<{ success: boolean; error?: string }> {
     console.log(`Attempting to deauthenticate ${appName} for user ${userId}`);

     // 1. Placeholder: Call Composio API to revoke connection (if applicable)
     // This is the ideal place to interact with Composio's API if they offer
     // a programmatic way to disconnect an account using the user's API key or connection ID.
     // Example structure (replace with actual Composio SDK/API call):
     /*
     if (userComposioKey) {
         try {
             // const toolset = new OpenAIToolSet({ apiKey: userComposioKey }); // Use user's key
             // const entity = await toolset.getEntity(userId);
             // await entity.disconnectApp(appName); // Hypothetical disconnect method
             console.log(`Successfully initiated disconnection via Composio API for ${appName}`);
         } catch (composioError: any) {
             console.error(`Composio API error during deauthentication for ${appName}:`, composioError.message);
             // Decide if this should be a fatal error or just a warning
             // return { success: false, error: `Composio API error: ${composioError.message}` };
             console.warn("Proceeding with Supabase profile update despite potential Composio API issue.");
         }
     } else {
         console.warn(`No Composio API key provided for user ${userId}, cannot call Composio disconnect API for ${appName}. Updating only Supabase.`);
     }
     */
     // Since there's no direct API call example, we proceed to update Supabase.

     // 2. Update Supabase Profile
     try {
        const supabase = await createClient();
        const updateField = `is_${appName}_authed` as const;
        const { error } = await supabase
             .from('profiles')
             .update({ [updateField]: false })
             .eq('id', userId);

        if (error) {
            console.error(`Supabase error updating profile for ${appName} deauthentication:`, error.message);
            throw error; // Throw to be caught by the outer catch block
        }

        console.log(`Successfully updated Supabase profile to mark ${appName} as deauthenticated for user ${userId}`);
        return { success: true };

     } catch (error: any) {
        console.error(`Failed to deauthenticate ${appName} in Supabase for user ${userId}:`, error.message);
        return { success: false, error: `Failed to update authentication status in profile: ${error.message}` };
     }
}
