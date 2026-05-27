import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";

type CheckoutItem = {
  name: string;
  quantity: number;
  unitPriceCents: number;
};

type CheckoutPayload = {
  orderId: string;
  customerName: string;
  items: CheckoutItem[];
};

export async function POST(request: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY nao configurada no .env.local" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as CheckoutPayload;

    if (!body.orderId || !body.customerName || !body.items?.length) {
      return NextResponse.json(
        { error: "Dados invalidos para checkout." },
        { status: 400 },
      );
    }

    const origin = request.headers.get("origin") ?? "http://localhost:3000";

    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: body.items.map((item) => ({
        quantity: item.quantity,
        price_data: {
          currency: "eur",
          product_data: { name: item.name },
          unit_amount: item.unitPriceCents,
        },
      })),
      metadata: {
        orderId: body.orderId,
        customerName: body.customerName,
      },
      success_url: `${origin}/sucesso?orderId=${body.orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?cancelled=1`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe nao retornou URL de checkout." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro inesperado no checkout.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
