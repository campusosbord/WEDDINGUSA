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

  // ─────────────────────────────────────────────────────────────────────────
  // checkout.session.completed — programar cancelación automática
  //
  // TÉCNICA: Subscription Schedules con duration + end_behavior: 'cancel'
  // (Alineado con el proyecto PAGOS de Instituto Osbord)
  //
  // Esta técnica es superior a cancel_at porque:
  //   1. No hay riesgo de proration (cobro parcial)
  //   2. Stripe maneja nativamente el fin de la suscripción
  //   3. Compatible con Smart Retries de Stripe
  //
  // Estructura de Wedding USA:
  //   - financiamiento-2: Precio recurrente mensual × 2 cuotas
  //   - financiamiento-3: Precio recurrente mensual × 3 cuotas
  //
  // Ejemplo plan 2 cuotas ($235/mes):
  //   Cuota 1: Día 0 (al pagar) → Cuota 2: +1 mes (última)
  //   duration = 2 meses → Stripe cancela al final del mes 2. ✅
  //
  // Ejemplo plan 3 cuotas ($165/mes):
  //   Cuota 1: Día 0 → Cuota 2: +1 mes → Cuota 3: +2 meses (última)
  //   duration = 3 meses → Stripe cancela al final del mes 3. ✅
  // ─────────────────────────────────────────────────────────────────────────
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

        if (planName !== 'financiamiento-2' && planName !== 'financiamiento-3') {
          console.warn(`[Webhook] plan_type no reconocido o ausente: "${planName}". Se omite la programación.`);
          return new Response(JSON.stringify({ received: true }), { status: 200 });
        }

        // 1. Crear el Subscription Schedule a partir de la suscripción existente
        const schedule = await stripe.subscriptionSchedules.create({
          from_subscription: subscriptionId,
        });

        console.log(`[Webhook] Subscription Schedule creado: ${schedule.id}`);

        if (!schedule.phases || schedule.phases.length === 0) {
          throw new Error('El schedule creado no tiene fases.');
        }

        // 2. Mapear la primera fase (la fase actual de la suscripción)
        const firstPhase = schedule.phases[0];
        const formattedFirstPhase = {
          start_date: firstPhase.start_date,
          end_date: firstPhase.end_date,
          items: firstPhase.items.map(item => ({
            price: typeof item.price === 'string' ? item.price : item.price.id,
            quantity: item.quantity,
          })),
          proration_behavior: 'none' as const,
        };

        // 3. Determinar cuántas cuotas RESTANTES quedan después de la primera
        //    financiamiento-2: total 2 cuotas, la 1ra ya se cobró → quedan 1
        //    financiamiento-3: total 3 cuotas, la 1ra ya se cobró → quedan 2
        const remainingPayments = planName === 'financiamiento-2' ? 1 : 2;

        // Obtener el price ID recurrente de la suscripción activa
        const recurringPriceId = typeof firstPhase.items[0].price === 'string'
          ? firstPhase.items[0].price
          : firstPhase.items[0].price.id;

        // 4. Crear la segunda fase para los cobros recurrentes restantes
        const secondPhase = {
          items: [
            {
              price: recurringPriceId,
              quantity: 1,
            }
          ],
          duration: {
            interval: 'month' as const,
            interval_count: remainingPayments,
          },
          proration_behavior: 'none' as const,
        };

        // 5. Actualizar el schedule con las dos fases y end_behavior: 'cancel'
        await stripe.subscriptionSchedules.update(schedule.id, {
          end_behavior: 'cancel',
          phases: [formattedFirstPhase, secondPhase],
        });

        const totalPayments = planName === 'financiamiento-2' ? 2 : 3;

        console.log(
          `[Webhook] ✅ Subscription Schedule configurado con éxito.\n` +
          `  Suscripción : ${subscriptionId}\n` +
          `  Schedule    : ${schedule.id}\n` +
          `  Plan        : ${planName} (${totalPayments} cuotas totales: 1 cobrada + ${remainingPayments} programadas)\n` +
          `  Fin del Plan: Cancelación automática nativa al terminar las cuotas. Sin proration.`
        );
      } catch (err: any) {
        console.error(`[Webhook] ❌ Error al programar schedule:`, err.message);
        return new Response('Error al actualizar suscripción', { status: 500 });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
};
