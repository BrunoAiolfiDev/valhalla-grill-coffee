"use client";

import { useEffect, useState } from "react";
import {
  listenPaidOrders,
  markKitchenStatus,
  markPaymentCollected,
  listenDrivers,
  assignOrderToDriver,
} from "@/lib/orders";
import type { KitchenStatus, Order } from "@/lib/types";
import type { Driver } from "@/lib/orders";
import { BrandLogo } from "@/components/BrandLogo";

const nextStatusMap: Record<KitchenStatus, KitchenStatus | null> = {
  aguardando_pagamento: "pago",
  pago: "em_preparo",
  em_preparo: "pronto",
  pronto: "entregue",
  entregue: null,
};

const prevStatusMap: Record<KitchenStatus, KitchenStatus | null> = {
  aguardando_pagamento: null,
  pago: null,
  em_preparo: "pago",
  pronto: "em_preparo",
  entregue: "pronto",
};

function statusLabel(status: KitchenStatus) {
  if (status === "aguardando_pagamento") return "Awaiting payment";
  if (status === "pago") return "Received (Paid)";
  if (status === "em_preparo") return "Preparing";
  if (status === "pronto") return "Ready";
  return "Delivered";
}

const statusColor: Record<KitchenStatus, string> = {
  aguardando_pagamento: "bg-zinc-100 text-zinc-600 border-zinc-200",
  pago: "bg-blue-50 text-blue-700 border-blue-200",
  em_preparo: "bg-amber-50 text-amber-700 border-amber-200",
  pronto: "bg-emerald-50 text-emerald-700 border-emerald-200",
  entregue: "bg-zinc-100 text-zinc-400 border-zinc-200",
};

function ElapsedTimer({ since }: { since: Date | undefined }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!since) return;
    const tick = () =>
      setElapsed(Math.floor((Date.now() - since.getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since]);

  if (!since) return null;

  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  const label = m > 0 ? `${m}m ${s < 10 ? "0" : ""}${s}s` : `${s}s`;

  const color =
    m >= 20
      ? "bg-red-100 text-red-700"
      : m >= 10
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-100 text-emerald-700";

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums ${color}`}
    >
      ⏱ {label}
    </span>
  );
}

const KITCHEN_SESSION_KEY = "kitchen_authed";

// ─── PIN Screen ───────────────────────────────────────────────────────────────
function KitchenPinScreen({ onAuth }: { onAuth: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/kitchen-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        sessionStorage.setItem(KITCHEN_SESSION_KEY, "1");
        onAuth();
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
          <BrandLogo
            variant="yellow"
            width={220}
            height={64}
            className="mx-auto"
            priority
          />
          <h1 className="mt-2 text-3xl font-black text-white">🍳 Kitchen</h1>
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
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-4 text-center text-base font-black tracking-widest text-white placeholder-zinc-600 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
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

export default function KitchenPage() {
  const [authed, setAuthed] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [savingOrderId, setSavingOrderId] = useState("");
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  // ── Check existing session ────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStorage.getItem(KITCHEN_SESSION_KEY) === "1") {
      setAuthed(true);
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    const unsub = listenPaidOrders((loadedOrders) => {
      setOrders(loadedOrders);
    });
    return () => unsub();
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    const unsub = listenDrivers((d) => setDrivers(d));
    return () => unsub();
  }, [authed]);

  if (!authChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </main>
    );
  }

  if (!authed) {
    return <KitchenPinScreen onAuth={() => setAuthed(true)} />;
  }

  async function moveStatus(order: Order) {
    const next = nextStatusMap[order.kitchenStatus as KitchenStatus];
    if (!next) return;
    try {
      setSavingOrderId(order.id);
      await markKitchenStatus(order.id, next);
    } finally {
      setSavingOrderId("");
    }
  }

  async function stepBack(order: Order) {
    const prev = prevStatusMap[order.kitchenStatus as KitchenStatus];
    if (!prev) return;
    try {
      setSavingOrderId(order.id);
      await markKitchenStatus(order.id, prev);
    } finally {
      setSavingOrderId("");
    }
  }

  async function onDrop(e: React.DragEvent, newStatus: KitchenStatus) {
    e.preventDefault();
    const orderId = e.dataTransfer.getData("orderId");
    if (!orderId) return;
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.kitchenStatus === newStatus) return;
    try {
      setSavingOrderId(orderId);
      await markKitchenStatus(orderId, newStatus);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingOrderId("");
      setDraggedOrderId(null);
    }
  }

  // Grouping by status for Kanban layout
  const todayStr = new Date().toDateString();

  const columns: { key: KitchenStatus; title: string; todayOnly?: boolean }[] =
    [
      { key: "pago", title: "New Orders" },
      { key: "em_preparo", title: "On the Grill" },
      { key: "pronto", title: "Ready for Delivery" },
      { key: "entregue", title: "Completed Today", todayOnly: true },
    ];

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 font-sans flex flex-col">
      <header className="sticky top-0 z-20 bg-white border-b border-zinc-200 px-6 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              Kitchen Terminal
            </p>
            <h1 className="display-font text-2xl font-black text-zinc-900">
              Production Board
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm font-semibold text-zinc-500 md:inline-block">
              {orders.filter((o) => o.kitchenStatus !== "entregue").length}{" "}
              active order(s)
            </span>
            <button
              onClick={() => {
                sessionStorage.removeItem(KITCHEN_SESSION_KEY);
                setAuthed(false);
              }}
              className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-700"
            >
              Lock
            </button>
          </div>
        </div>
      </header>

      <section className="flex-1 overflow-x-auto p-6 flex align-top">
        <div className="mx-auto flex h-full w-full max-w-7xl items-start gap-6">
          {orders.length === 0 ? (
            <div className="flex w-full flex-col items-center justify-center py-32 opacity-60">
              <span className="text-4xl">☕️</span>
              <p className="mt-4 text-sm font-semibold text-zinc-500">
                No orders in the queue. All clear!
              </p>
            </div>
          ) : (
            columns.map((col) => {
              const colOrders = orders.filter((o) => {
                if (o.kitchenStatus !== col.key) return false;
                if (col.todayOnly && o.createdAtDate) {
                  return o.createdAtDate.toDateString() === todayStr;
                }
                return true;
              });

              return (
                <div
                  key={col.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => onDrop(e, col.key)}
                  className={`flex w-80 min-w-[320px] flex-col rounded-2xl p-4 border transition-colors ${
                    draggedOrderId
                      ? "bg-zinc-100 border-zinc-300 ring-2 ring-zinc-200 ring-dashed"
                      : "bg-zinc-100/50 border-zinc-200/50"
                  }`}
                >
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-zinc-700">
                      {col.title}
                    </h2>
                    <span className="flex h-5 items-center justify-center rounded-full bg-zinc-200 px-2 text-[10px] font-bold text-zinc-600">
                      {colOrders.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {colOrders.map((order) => {
                      const next =
                        nextStatusMap[order.kitchenStatus as KitchenStatus];
                      const prev =
                        prevStatusMap[order.kitchenStatus as KitchenStatus];
                      const isSaving = savingOrderId === order.id;

                      return (
                        <article
                          key={order.id}
                          draggable={!isSaving}
                          onDragStart={(e) => {
                            setDraggedOrderId(order.id);
                            e.dataTransfer.setData("orderId", order.id);
                          }}
                          onDragEnd={() => setDraggedOrderId(null)}
                          className={`flex flex-col rounded-xl border bg-white p-4 shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing ${
                            draggedOrderId === order.id
                              ? "opacity-30 border-dashed border-zinc-400"
                              : "border-zinc-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                statusColor[
                                  order.kitchenStatus as KitchenStatus
                                ]
                              }`}
                            >
                              {statusLabel(
                                order.kitchenStatus as KitchenStatus,
                              )}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {order.kitchenStatus !== "entregue" && (
                                <ElapsedTimer since={order.createdAtDate} />
                              )}
                              <span className="text-xs font-semibold text-zinc-400">
                                {order.createdAtLabel}
                              </span>
                            </div>
                          </div>

                          <h3 className="mt-3 text-lg font-black leading-tight text-zinc-900">
                            {order.customerName}
                          </h3>
                          <div className="mt-1 flex items-center gap-2">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                              #{order.id.slice(0, 5)}
                            </p>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                order.paymentStatus === "on_delivery"
                                  ? order.paymentMethod === "cash_on_delivery"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-orange-100 text-orange-700"
                                  : order.paymentMethod === "cash_on_delivery"
                                    ? "bg-green-100 text-green-700"
                                    : order.paymentMethod === "card_on_delivery"
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-violet-100 text-violet-700"
                              }`}
                            >
                              {order.paymentStatus === "on_delivery"
                                ? order.paymentMethod === "cash_on_delivery"
                                  ? "⏳ Cash (pending)"
                                  : "⏳ Card (pending)"
                                : order.paymentMethod === "cash_on_delivery"
                                  ? "✅ Cash"
                                  : order.paymentMethod === "card_on_delivery"
                                    ? "✅ Card"
                                    : "🔒 Online"}
                            </span>
                          </div>

                          <ul className="mt-3 space-y-2 border-y border-zinc-100 py-3">
                            {order.items.map((item, idx) => (
                              <li key={`${item.id}-${idx}`} className="text-sm">
                                <span className="font-semibold text-zinc-700">
                                  <span className="mr-1 text-zinc-400">
                                    {item.quantity}x
                                  </span>
                                  {item.name}
                                </span>
                                {item.removedIngredients &&
                                  item.removedIngredients.length > 0 && (
                                    <p className="mt-0.5 text-xs font-semibold text-red-500">
                                      ❌ No:{" "}
                                      {item.removedIngredients.join(", ")}
                                    </p>
                                  )}
                                {item.addedExtras &&
                                  item.addedExtras.length > 0 && (
                                    <p className="mt-0.5 text-xs font-semibold text-amber-600">
                                      ➕{" "}
                                      {item.addedExtras
                                        .map((e) => e.name)
                                        .join(", ")}
                                    </p>
                                  )}
                              </li>
                            ))}
                          </ul>

                          <div className="mt-3 flex flex-col gap-2">
                            {/* Driver selector for pronto delivery orders */}
                            {order.kitchenStatus === "pronto" &&
                              order.fulfillmentType !== "pickup" &&
                              drivers.length > 0 && (
                                <select
                                  value={order.driverId ?? ""}
                                  onChange={async (e) => {
                                    if (!e.target.value) return;
                                    setSavingOrderId(order.id);
                                    try {
                                      await assignOrderToDriver(
                                        order.id,
                                        e.target.value,
                                      );
                                    } finally {
                                      setSavingOrderId("");
                                    }
                                  }}
                                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-700 outline-none focus:border-amber-400"
                                >
                                  <option value="">🚗 Assign driver…</option>
                                  {drivers.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                            {order.kitchenStatus === "pronto" &&
                              order.fulfillmentType !== "pickup" &&
                              order.driverId && (
                                <p className="text-[10px] font-bold text-emerald-600">
                                  ✅ Assigned:{" "}
                                  {drivers.find((d) => d.id === order.driverId)
                                    ?.name ?? order.driverId}
                                </p>
                              )}
                            {/* Collect payment button for on_delivery orders */}
                            {order.paymentStatus === "on_delivery" && (
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={async () => {
                                  setSavingOrderId(order.id);
                                  try {
                                    await markPaymentCollected(order.id);
                                  } finally {
                                    setSavingOrderId("");
                                  }
                                }}
                                className="w-full rounded-lg bg-orange-500 px-3 py-2 text-xs font-black text-white transition hover:bg-orange-600 disabled:opacity-50"
                              >
                                {isSaving
                                  ? "..."
                                  : order.paymentMethod === "cash_on_delivery"
                                    ? "💵 Collect Cash"
                                    : "💳 Collect Card Payment"}
                              </button>
                            )}

                            <div className="flex gap-2">
                              {prev && (
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => stepBack(order)}
                                  className="flex items-center justify-center rounded-lg bg-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 transition hover:bg-zinc-300 disabled:opacity-50"
                                  title="Go back"
                                >
                                  &lt;
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={!next || isSaving}
                                onClick={() => moveStatus(order)}
                                className="flex flex-1 items-center justify-center rounded-lg bg-zinc-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                              >
                                {!next
                                  ? "Delivered!"
                                  : isSaving
                                    ? "..."
                                    : "Next >"}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}

                    {colOrders.length === 0 && (
                      <div className="py-6 text-center text-xs font-semibold text-zinc-400">
                        Drag orders here
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
