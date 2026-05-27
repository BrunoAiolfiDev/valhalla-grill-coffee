"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { markOrderPaid, getOrderById } from "@/lib/orders";
import type { Order } from "@/lib/types";
import { formatEuroFromCents } from "@/lib/catalog";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [status, setStatus] = useState("Processing your payment...");
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    let mounted = true;

    async function process() {
      if (!orderId) {
        if (mounted) setStatus("Order not found in URL.");
        return;
      }

      try {
        const o = await getOrderById(orderId);
        // Only mark as paid if it came from Stripe (paymentMethod === "stripe")
        // Cash/card on delivery payments stay as "on_delivery" until driver collects
        if (o && o.paymentMethod === "stripe") {
          await markOrderPaid(orderId);
        }
        const updated =
          o?.paymentMethod === "stripe" ? await getOrderById(orderId) : o;
        if (mounted) {
          setOrder(updated);
          setStatus("Order confirmed successfully!");
        }
      } catch (err) {
        console.error(err);
        if (mounted) setStatus("There was an error confirming your payment.");
      }
    }

    process();
    return () => {
      mounted = false;
    };
  }, [orderId]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl border border-zinc-100">
        <h1 className="display-font text-3xl font-black text-zinc-900 mb-2">
          Order Confirmed!
        </h1>
        <p className="text-sm font-semibold text-zinc-500 mb-6">{status}</p>

        {order && (
          <div className="mt-4 rounded-xl bg-zinc-50 p-4 border border-zinc-200">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-zinc-500">
              Order Summary
            </h2>
            <p className="text-zinc-800 font-medium">
              Order Number:{" "}
              <strong className="text-zinc-900">{order.id.slice(0, 5)}</strong>
            </p>
            <p className="text-zinc-800 font-medium">
              Total:{" "}
              <strong className="text-zinc-900">
                {formatEuroFromCents(order.totalCents)}
              </strong>
            </p>
          </div>
        )}

        <Link
          href="/"
          className="mt-8 inline-block w-full rounded-xl bg-zinc-900 px-6 py-4 font-bold text-white transition hover:bg-zinc-800"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

export default function SucessoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}
