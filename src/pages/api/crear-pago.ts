import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const POST: APIRoute = async ({ request }) => {
  const stripeKey = import.meta.env.STRIPE_SECRET_KEY;

  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'Stripe API key no configurada.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stripe = new Stripe(stripeKey);

  try {
    const { email, plan } = await request.json();

    if (!plan) {
      return new Response(JSON.stringify({ error: 'El plan es requerido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const origin = new URL(request.url).origin;
    let sessionConfig: Stripe.Checkout.SessionCreateParams;

    if (plan === 'full') {
      sessionConfig = {
        ...(email ? { customer_email: email } : {}),
        line_items: [
          {
            price: import.meta.env.PRICE_ID_PAGO_UNICO,
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${origin}/registro?session_id={CHECKOUT_SESSION_ID}&plan=full`,
        cancel_url: `${origin}/checkout`,
      };
    } else if (plan === 'finance1') {
      // 2 cuotas de $159
      sessionConfig = {
        payment_method_types: ['card'],
        ...(email ? { customer_email: email } : {}),
        line_items: [
          {
            price: import.meta.env.PRICE_ID_F2_CUOTA,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        subscription_data: {
          metadata: {
            plan_type: 'financiamiento-2',
          },
        },
        success_url: `${origin}/registro?session_id={CHECKOUT_SESSION_ID}&plan=finance1`,
        cancel_url: `${origin}/checkout`,
      };
    } else if (plan === 'finance2') {
      // 3 cuotas de $115
      sessionConfig = {
        payment_method_types: ['card'],
        ...(email ? { customer_email: email } : {}),
        line_items: [
          {
            price: import.meta.env.PRICE_ID_F3_CUOTA,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        subscription_data: {
          metadata: {
            plan_type: 'financiamiento-3',
          },
        },
        success_url: `${origin}/registro?session_id={CHECKOUT_SESSION_ID}&plan=finance2`,
        cancel_url: `${origin}/checkout`,
      };
    } else {
      return new Response(JSON.stringify({ error: 'Plan inválido.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error al crear sesión de checkout:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
