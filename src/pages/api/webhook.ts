import type { APIRoute } from 'astro';
import Stripe from 'stripe';

export const POST: APIRoute = async ({ request }) => {
  const stripeKey = import.meta.env.STRIPE_SECRET_KEY;
  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return new Response('Configuración de Stripe incompleta (falta STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET)', { status: 500 });
  }

  const stripe = new Stripe(stripeKey);
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return new Response('Missing stripe-signature header', { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error(`[Webhook] Error de verificación: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    console.log(`[Webhook] checkout.session.completed recibido. Mode: ${session.mode}`);

    if (session.mode === 'subscription' && session.subscription) {
      const subscriptionId = session.subscription as string;
      console.log(`[Webhook] Procesando suscripción: ${subscriptionId}`);

      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const planName = subscription.metadata?.plan_type;

        console.log(`[Webhook] plan_type detectado: "${planName}"`);

        if (planName === 'financiamiento-2' || planName === 'financiamiento-3') {
          const totalPayments = planName === 'financiamiento-2' ? 2 : 3;
          
          // Calculamos cancel_at basándonos en la fecha de inicio de este periodo
          const startDate = new Date(subscription.current_period_start * 1000);
          startDate.setMonth(startDate.getMonth() + totalPayments);
          const cancelAtTimestamp = Math.floor(startDate.getTime() / 1000);

          await stripe.subscriptions.update(subscriptionId, {
            cancel_at: cancelAtTimestamp,
          });

          console.log(
            `[Webhook] ✅ Suscripción configurada para cancelarse automáticamente tras ${totalPayments} cuotas.\n` +
            `  Suscripción : ${subscriptionId}\n` +
            `  Plan        : ${planName}\n` +
            `  Cancelación : ${startDate.toISOString()}`
          );
        } else {
          console.warn(`[Webhook] plan_type no reconocido o ausente: "${planName}". Se omite.`);
        }
      } catch (err: any) {
        console.error(`[Webhook] ❌ Error al programar cancelación:`, err.message);
        return new Response('Error al actualizar suscripción', { status: 500 });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
};
