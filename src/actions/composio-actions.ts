// src/actions/composio-actions.ts
'use server';

// REMOVED startComposioLogin function.
// The Composio API key is now retrieved from the user's profile
// and passed in the request header to the /api/auth/composio/connect route.
// This action is no longer needed for initiating the connection process.

// Keeping this file in case other Composio-related server actions are added later.
console.log("composio-actions.ts loaded (startComposioLogin removed).");

// You might add other Composio-related server actions here if needed,
// for example, actions that use the Composio SDK with the user's stored API key
// for operations that don't require direct user interaction via OAuth redirect.
