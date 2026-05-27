"use client";

import { useState, useEffect, useCallback } from "react";
import {
  listenPaidOrders,
  markKitchenStatus,
  markPaymentCollected,
} from "@/lib/orders";
import type { Order } from "@/lib/types";

const SESSION_KEY = "driver_authed";
const SESSION_DRIVER_ID = "driver_id";
const SESSION_DRIVER_NAME = "driver_name";

// ─── PIN Screen ───────────────────────────────────────────────────────────────
function PinScreen({ onAuth }: { onAuth: (id: string, name: string) => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/driver-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          ok: boolean;
          driverId?: string;
          driverName?: string;
        };
        sessionStorage.setItem(SESSION_KEY, "1");
        sessionStorage.setItem(SESSION_DRIVER_ID, data.driverId ?? "default");
        sessionStorage.setItem(
          SESSION_DRIVER_NAME,
          data.driverName ?? "Driver",
        );
        onAuth(data.driverId ?? "default", data.driverName ?? "Driver");
      } else {
        setError("Wrong PIN. Try again.");
        setPin("");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-xs">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-500">
            Valhalla Grill &amp; Coffee
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">
            🚗 Driver View
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Enter your PIN to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-4 text-center text-2xl font-black tracking-widest text-white placeholder-zinc-600 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
          />
          {error && (
            <p className="text-center text-xs font-semibold text-red-400">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={!pin || loading}
            className="w-full rounded-2xl bg-amber-500 py-4 text-sm font-black text-zinc-900 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? "Checking..." : "Enter"}
          </button>
        </form>
      </div>
    </main>
  );
}

// ─── Order Card ───────────────────────────────────────────────────────────────
function OrderCard({
  order,
  onDelivered,
  onCollect,
  saving,
}: {
  order: Order;
  onDelivered: () => void;
  onCollect: () => void;
  saving: boolean;
}) {
  const totalEur = (order.totalCents / 100).toFixed(2);
  const isPendingPayment = order.paymentStatus === "on_delivery";
  const isPickup = order.fulfillmentType === "pickup";
  const changeCents = order.changeFor ?? null;
  const changeDue =
    changeCents !== null ? changeCents - order.totalCents : null;

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            #{order.id.slice(0, 6).toUpperCase()}
          </p>
          <h2 className="text-xl font-black text-zinc-900">
            {order.customerName}
          </h2>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isPickup
                ? "bg-zinc-100 text-zinc-600"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {isPickup ? "🏪 Pickup" : "🚗 Delivery"}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-lg font-black text-amber-600">€{totalEur}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isPendingPayment
                ? order.paymentMethod === "cash_on_delivery"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-orange-100 text-orange-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {isPendingPayment
              ? order.paymentMethod === "cash_on_delivery"
                ? "⏳ Collect Cash"
                : "⏳ Collect Card"
              : order.paymentMethod === "cash_on_delivery"
                ? "✅ Cash (paid)"
                : order.paymentMethod === "card_on_delivery"
                  ? "✅ Card (paid)"
                  : "✅ Paid Online"}
          </span>
        </div>
      </div>

      {/* Delivery address */}
      {order.deliveryAddress && !isPickup && (
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(order.deliveryAddress)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2 rounded-xl bg-zinc-50 px-4 py-3 transition hover:bg-zinc-100"
        >
          <span className="mt-0.5 text-base">📍</span>
          <div>
            <p className="text-xs font-bold text-zinc-500">Delivery address</p>
            <p className="text-sm font-semibold text-zinc-800">
              {order.deliveryAddress}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold text-amber-600">
              Tap to open in Maps →
            </p>
          </div>
        </a>
      )}

      {/* Cash change info */}
      {isPendingPayment &&
        order.paymentMethod === "cash_on_delivery" &&
        changeCents !== null &&
        changeDue !== null &&
        changeDue > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <span className="text-base">💵</span>
            <div>
              <p className="text-xs font-bold text-amber-800">Change needed</p>
              <p className="text-sm font-black text-amber-900">
                Customer pays €{(changeCents / 100).toFixed(2)} — bring €
                {(changeDue / 100).toFixed(2)} in change
              </p>
            </div>
          </div>
        )}

      {/* Items */}
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          Items
        </p>
        <ul className="flex flex-col gap-2">
          {order.items.map((item, idx) => (
            <li key={`${item.id}-${idx}`} className="text-sm">
              <span className="font-semibold text-zinc-800">
                <span className="mr-1 font-black text-zinc-400">
                  {item.quantity}×
                </span>
                {item.name}
              </span>
              {item.removedIngredients &&
                item.removedIngredients.length > 0 && (
                  <p className="mt-0.5 text-xs font-semibold text-red-500">
                    ❌ No: {item.removedIngredients.join(", ")}
                  </p>
                )}
              {item.addedExtras && item.addedExtras.length > 0 && (
                <p className="mt-0.5 text-xs font-semibold text-amber-600">
                  ➕ {item.addedExtras.map((e) => e.name).join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3">
        {isPendingPayment && (
          <button
            disabled={saving}
            onClick={onCollect}
            className="w-full rounded-xl bg-orange-500 py-3 text-sm font-black text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            {saving
              ? "..."
              : order.paymentMethod === "cash_on_delivery"
                ? "💵 Collect Cash Payment"
                : "💳 Collect Card Payment"}
          </button>
        )}
        <button
          disabled={saving}
          onClick={onDelivered}
          className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-black text-white transition hover:bg-zinc-800 disabled:opacity-50"
        >
          {saving ? "..." : "✅ Mark as Delivered"}
        </button>
      </div>
    </article>
  );
}

// ─── Driver Dashboard ─────────────────────────────────────────────────────────
function Dashboard({
  onLogout,
  driverId,
  driverName,
}: {
  onLogout: () => void;
  driverId: string;
  driverName: string;
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [saving, setSaving] = useState("");

  useEffect(() => {
    const unsub = listenPaidOrders((all) =>
      setOrders(
        all.filter(
          (o) =>
            o.kitchenStatus === "pronto" &&
            o.fulfillmentType !== "pickup" &&
            (driverId === "default" || o.driverId === driverId),
        ),
      ),
    );
    return () => unsub();
  }, [driverId]);

  const handleDelivered = useCallback(async (orderId: string) => {
    setSaving(orderId);
    try {
      await markKitchenStatus(orderId, "entregue");
    } finally {
      setSaving("");
    }
  }, []);

  const handleCollect = useCallback(async (orderId: string) => {
    setSaving(orderId);
    try {
      await markPaymentCollected(orderId);
    } finally {
      setSaving("");
    }
  }, []);

  return (
    <main className="min-h-screen bg-zinc-100 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white px-5 py-4 shadow-sm">
        <div className="mx-auto flex max-w-xl items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
              Driver View
            </p>
            <h1 className="text-xl font-black text-zinc-900">{driverName}</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-zinc-200 px-2.5 py-1 text-xs font-bold text-zinc-600">
              {orders.length} order{orders.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={onLogout}
              className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-50"
            >
              Lock
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-xl px-4 py-6">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 opacity-60">
            <span className="text-5xl">🏍️</span>
            <p className="mt-4 text-sm font-semibold text-zinc-500">
              No orders ready for delivery yet.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                saving={saving === order.id}
                onDelivered={() => handleDelivered(order.id)}
                onCollect={() => handleCollect(order.id)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DriverPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [driverId, setDriverId] = useState("default");
  const [driverName, setDriverName] = useState("Driver");

  useEffect(() => {
    const ok = sessionStorage.getItem(SESSION_KEY) === "1";
    if (ok) {
      setDriverId(sessionStorage.getItem(SESSION_DRIVER_ID) ?? "default");
      setDriverName(sessionStorage.getItem(SESSION_DRIVER_NAME) ?? "Driver");
    }
    setAuthed(ok);
  }, []);

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_DRIVER_ID);
    sessionStorage.removeItem(SESSION_DRIVER_NAME);
    setAuthed(false);
  }

  function handleAuth(id: string, name: string) {
    setDriverId(id);
    setDriverName(name);
    setAuthed(true);
  }

  if (authed === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </main>
    );
  }

  if (!authed) {
    return <PinScreen onAuth={handleAuth} />;
  }

  return (
    <Dashboard
      onLogout={handleLogout}
      driverId={driverId}
      driverName={driverName}
    />
  );
}
