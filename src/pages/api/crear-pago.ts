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

    // =========================================================================
    // CONFIGURACIÓN DE COBRO DE CUOTAS
    // 'manual' (ACTIVO): Cobro de la 1ra cuota como pago único (mode: 'payment').
    //   Elimina la fricción de suscripción para el cliente y desbloquea todos los
    //   métodos de pago en Stripe (Apple Pay, Link, Tarjetas, etc.).
    //   Las cuotas restantes se cobran manualmente con soporte.
    // 'automatico': Cobro automático mensual recurrente con Stripe Subscriptions.
    // =========================================================================
    const MODO_CUOTAS: 'manual' | 'automatico' = 'manual';

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
        cancel_url: `${origin}/inscripcion`,
      };
    } else if (plan === 'finance1') {
      // 2 cuotas de $148.50
      if (MODO_CUOTAS === 'manual') {
        // [ACTIVO] Pago único de la 1ra cuota (Sin suscripción automática)
        sessionConfig = {
          ...(email ? { customer_email: email } : {}),
          line_items: [
            {
              price_data: {
                currency: 'usd',
                unit_amount: 14850, // $148.50 USD
                product_data: {
                  name: 'Diplomado Wedding Planner - Cuota Inicial 1 de 2',
                  description: '1ra Cuota de Matrícula (2da cuota coordinada directamente con soporte sin cobros automáticos)',
                },
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          metadata: {
            plan_type: 'financiamiento-2-manual',
            total_cuotas: '2',
            cuota_actual: '1',
            monto_cuota: '148.50',
            cobro_siguientes_cuotas: 'manual_soporte',
          },
          success_url: `${origin}/registro?session_id={CHECKOUT_SESSION_ID}&plan=finance1`,
          cancel_url: `${origin}/inscripcion`,
        };
      } else {
        // [GUARDADO] Cobro recurrente automático vía suscripción
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
          cancel_url: `${origin}/inscripcion`,
        };
      }
    } else if (plan === 'finance2') {
      // 3 cuotas de $99
      if (MODO_CUOTAS === 'manual') {
        // [ACTIVO] Pago único de la 1ra cuota (Sin suscripción automática)
        sessionConfig = {
          ...(email ? { customer_email: email } : {}),
          line_items: [
            {
              price_data: {
                currency: 'usd',
                unit_amount: 9900, // $99.00 USD
                product_data: {
                  name: 'Diplomado Wedding Planner - Cuota Inicial 1 de 3',
                  description: '1ra Cuota de Matrícula (cuotas restantes coordinadas directamente con soporte sin cobros automáticos)',
                },
              },
              quantity: 1,
            },
          ],
          mode: 'payment',
          metadata: {
            plan_type: 'financiamiento-3-manual',
            total_cuotas: '3',
            cuota_actual: '1',
            monto_cuota: '99.00',
            cobro_siguientes_cuotas: 'manual_soporte',
          },
          success_url: `${origin}/registro?session_id={CHECKOUT_SESSION_ID}&plan=finance2`,
          cancel_url: `${origin}/inscripcion`,
        };
      } else {
        // [GUARDADO] Cobro recurrente automático vía suscripción
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
          cancel_url: `${origin}/inscripcion`,
        };
      }
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
