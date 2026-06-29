import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import Stripe from "npm:stripe@^13.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.1";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-08-16",
});

const cryptoProvider = Stripe.createCryptoProvider();

serve(async (req) => {
  try {
    const signature = req.headers.get("Stripe-Signature");
    
    // First, check if it's a valid POST request
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const body = await req.text();
    let event;

    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature!,
        Deno.env.get("STRIPE_WEBHOOK_SECRET")!,
        undefined,
        cryptoProvider
      );
    } catch (err) {
      console.error(`Webhook signature verification failed.`, err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    // Handle the checkout.session.completed event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id;

      if (!userId) {
        throw new Error('No client_reference_id found in the session');
      }

      // Initialize Supabase admin client
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      console.log(`Payment successful for user ${userId}. Upgrading to Premium...`);

      const { error } = await supabaseAdmin
        .from('user_profiles')
        .update({ is_premium: true })
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      console.log('Successfully upgraded user to premium');
    }

    return new Response(JSON.stringify({ received: true }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }
});
