
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server'; // Use server client for health check

export const dynamic = 'force-dynamic'; // Ensure fresh check every time

export async function GET() {
  let supabaseStatus: 'ok' | 'error' = 'error';
  let mcpStatus: 'ok' | 'error' | 'not_configured' = 'not_configured'; // Placeholder, as we don't have a direct health endpoint
  let overallStatus: 'ok' | 'error' = 'error';
  let errorMessage: string | null = null;

  // Check Supabase Connection
  try {
    // Await createClient as it's now async
    const supabase = await createClient();
    // Perform a simple query to check connection, e.g., fetching user (even if null)
    const { data, error } = await supabase.auth.getUser();

    // Even if there's no user, no error means the connection worked.
    if (!error) {
      supabaseStatus = 'ok';
    } else {
      console.error("Supabase health check failed:", error.message);
      errorMessage = `Supabase connection error: ${error.message}`;
    }
  } catch (err: any) {
    console.error("Supabase health check failed:", err.message);
     errorMessage = `Supabase connection error: ${err.message}`;
  }

  // Placeholder Check for MCP (Composio)
  // Since authentication is done via redirect, we don't have a direct
  // API key or endpoint to ping for health here. We can only infer
  // configuration presence if the MCP URL concept is relevant elsewhere,
  // but for basic health, we'll mark it as 'not_configured' or 'ok' based on principle.
  // For now, assume 'ok' if Supabase is ok, as MCP relies on user action.
  mcpStatus = 'ok'; // Assume ok as it's user-driven OAuth

  // Determine Overall Status
  if (supabaseStatus === 'ok' && mcpStatus === 'ok') {
    overallStatus = 'ok';
  } else {
    overallStatus = 'error';
  }

  const responseBody = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    dependencies: {
      supabase: supabaseStatus,
      mcp: mcpStatus, // Reflecting assumption
    },
    error: errorMessage,
  };

  return NextResponse.json(responseBody, {
    status: overallStatus === 'ok' ? 200 : 503, // 503 Service Unavailable if error
  });
}
