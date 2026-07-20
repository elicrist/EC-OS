// Deletes the CALLING user's own account — all data rows across the app's
// four owner-scoped tables, then the auth user itself. Never trusts a
// client-passed user id: the only identity this function acts on is
// whatever the caller's own JWT resolves to via supabaseAdmin.auth.getUser().
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected into every
// Edge Function's environment by the Supabase platform — nothing to
// configure for those two specifically. See the repo's deploy notes for
// what Eli still needs to do by hand (this key is never pasted into any
// file that gets committed, and never passed from the client).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, '');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  // Verify the caller's identity server-side, from their own JWT — this is
  // the ONLY source of truth for which account gets deleted. The request
  // body is never trusted for a user id, and there is no such field to send.
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
  if (userError || !userData?.user) return json({ error: 'Invalid or expired session' }, 401);
  const ownerId = userData.user.id;

  try {
    // Delete this owner's rows across all four tables before the auth user
    // itself, in dependency order (widgets/tabs reference pages, though
    // there's no DB-level cascade set up — anon-key-only project, no DDL
    // access — so this function does the ordering by hand).
    const tables = ['ec_widget_data', 'ec_page_widgets', 'ec_page_tabs', 'ec_pages'];
    for (const table of tables) {
      const { error } = await supabaseAdmin.from(table).delete().eq('owner_id', ownerId);
      if (error) throw new Error(`Failed deleting from ${table}: ${error.message}`);
    }

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(ownerId);
    if (deleteUserError) throw new Error(`Failed deleting user: ${deleteUserError.message}`);

    return json({ success: true });
  } catch (e) {
    console.error('delete-account failed', e);
    return json({ error: e instanceof Error ? e.message : 'Deletion failed' }, 500);
  }
});
