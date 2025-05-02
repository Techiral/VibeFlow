// src/services/composio-service.ts
'use server';

import { createClient } from '@/lib/supabase/server'; // Use server client for profile updates
import type { ComposioApp } from '@/types/supabase';

// Removed startComposioLogin function as it was simplified into a server action

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

// Removed the authenticateComposioApp function as authentication is handled by
// redirecting to the API route '/api/auth/composio/connect'
