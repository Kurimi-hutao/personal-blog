import { createDeliveryHandler } from './core.mjs';
const base = Deno.env.get('SUPABASE_URL')!;
const role = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
async function rpc(name: string, args: Record<string, unknown>) {
  const response = await fetch(`${base}/rest/v1/rpc/${name}`, {
    method: 'POST', signal: AbortSignal.timeout(10000),
    headers: { apikey: role, Authorization: `Bearer ${role}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!response.ok) throw new Error('delivery_rpc_failed');
}
Deno.serve(createDeliveryHandler({ rpc, env: (name: string) => Deno.env.get(name) }));
