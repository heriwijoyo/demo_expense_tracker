// NEW FILE: supabase/functions/topup-webhook/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

serve(async (req) => {
  try {
    // 1. Parse the incoming webhook payload
    const { webhook_id, org_id, amount } = await req.json()

    if (!webhook_id || !org_id || !amount) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
    }

    // 2. Initialize the Supabase Admin Client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', // This is auto-injected by Supabase!
      Deno.env.get('SERVICE_ROLE_KEY') ?? '' // CHANGED: Removed the SUPABASE_ prefix
    )

    // 3. Attempt to log the webhook. 
    // If this webhook_id already exists, Postgres will throw a unique constraint violation!
    const { error: insertError } = await supabaseAdmin
      .from('processed_webhooks')
      .insert({ idempotency_key: webhook_id, org_id: org_id, amount: amount })

    if (insertError) {
      // 23505 is the Postgres error code for unique_violation
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ message: 'Webhook already processed. Ignoring duplicate.' }), 
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }
      throw insertError
    }

    // 4. If we reach here, it's a fresh webhook. We can safely add funds.
    // We'll call a secure Postgres function to handle the addition atomically.
    const { error: rpcError } = await supabaseAdmin.rpc('add_funds_to_wallet', {
      target_org_id: org_id,
      fund_amount: amount
    })

    if (rpcError) throw rpcError

    return new Response(
      JSON.stringify({ message: 'Funds added successfully' }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})