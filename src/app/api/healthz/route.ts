import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server'; // Use server client for health check

export const dynamic = 'force-dynamic'; // Ensure fresh check every time

export async function GET() {
  let supabaseStatus: 'ok' | 'error' = 'error';
  let mcpStatus: 'ok' | 'error' | 'not_configured' = 'not_configured'; // Placeholder
  let overallStatus: 'ok' | 'error' = 'error';
  let errorMessage: string | null = null;

  // Check Supabase Connection
  try {
    const supabase = createClient();
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

  // Placeholder Check for MCP (Composio) - Replace with actual check if possible
  // This might involve checking if env vars are set or making a test API call
  if (process.env.NEXT_PUBLIC_COMPOSIO_API_URL && process.env.COMPOSIO_CLIENT_ID) {
     // Simulate a check - replace with actual check if an MCP health endpoint exists
     // For now, just checking config presence
     mcpStatus = 'ok'; // Assume ok if configured
     // try {
     //   const response = await fetch(`${process.env.NEXT_PUBLIC_COMPOSIO_API_URL}/health`); // Fictional endpoint
     //   if (response.ok) {
     //      mcpStatus = 'ok';
     //   } else {
     //      mcpStatus = 'error';
     //      errorMessage = errorMessage ? `${errorMessage}; MCP connection error: Status ${response.status}` : `MCP connection error: Status ${response.status}`;
     //   }
     // } catch (err: any) {
     //    mcpStatus = 'error';
     //    errorMessage = errorMessage ? `${errorMessage}; MCP connection error: ${err.message}` : `MCP connection error: ${err.message}`;
     // }
  } else {
     mcpStatus = 'not_configured';
     // Consider if this should make the overall status 'error' or just be informational
     // For now, let's allow 'ok' if Supabase is ok and MCP isn't configured.
  }


  // Determine Overall Status
  if (supabaseStatus === 'ok' && (mcpStatus === 'ok' || mcpStatus === 'not_configured')) {
    overallStatus = 'ok';
  } else {
    overallStatus = 'error';
  }

  const responseBody = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    dependencies: {
      supabase: supabaseStatus,
      mcp: mcpStatus,
    },
    error: errorMessage,
  };

  return NextResponse.json(responseBody, {
    status: overallStatus === 'ok' ? 200 : 503, // 503 Service Unavailable if error
  });
}
