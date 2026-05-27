"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import {
  listenCustomerProfile,
  setCustomerProfile,
  type CustomerProfile,
  type SavedAddress,
} from "@/lib/customerProfile";
import { listenOrdersByUserId } from "@/lib/orders";
import type { Order, KitchenStatus, OrderItem } from "@/lib/types";

// ─── Status helpers ────────────────────────────────────────────────────────────
const STATUS_STEPS: KitchenStatus[] = [
  "pago",
  "em_preparo",
  "pronto",
  "entregue",
];

const STATUS_LABELS: Record<KitchenStatus, string> = {
  aguardando_pagamento: "Awaiting payment",
  pago: "Order received",
  em_preparo: "Preparing",
  pronto: "On its way",
  entregue: "Delivered",
};

const STATUS_ICONS: Record<KitchenStatus, string> = {
  aguardando_pagamento: "⏳",
  pago: "✅",
  em_preparo: "👨‍🍳",
  pronto: "�",
  entregue: "🎉",
};

const STATUS_COLORS: Record<KitchenStatus, string> = {
  aguardando_pagamento: "bg-zinc-400",
  pago: "bg-blue-500",
  em_preparo: "bg-amber-500",
  pronto: "bg-emerald-500",
  entregue: "bg-zinc-300",
};

function StatusBadge({ status }: { status: KitchenStatus }) {
  const colors: Record<KitchenStatus, string> = {
    aguardando_pagamento: "bg-zinc-100 text-zinc-500",
    pago: "bg-blue-50 text-blue-700",
    em_preparo: "bg-amber-50 text-amber-700",
    pronto: "bg-emerald-50 text-emerald-700",
    entregue: "bg-zinc-100 text-zinc-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${colors[status]}`}
    >
      {STATUS_ICONS[status]} {STATUS_LABELS[status]}
    </span>
  );
}

function StatusStepper({ status }: { status: KitchenStatus }) {
  if (status === "aguardando_pagamento") return null;
  const currentIdx = STATUS_STEPS.indexOf(status);

  return (
    <div className="mt-3 flex items-center gap-0">
      {STATUS_STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={step} className="flex flex-1 items-center">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black transition-all ${
                done
                  ? `${STATUS_COLORS[step]} text-white`
                  : "bg-zinc-100 text-zinc-400"
              } ${isCurrent ? "ring-2 ring-offset-1 ring-amber-400" : ""}`}
              title={STATUS_LABELS[step]}
            >
              {done ? STATUS_ICONS[step] : idx + 1}
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div
                className={`h-1 flex-1 transition-all ${
                  idx < currentIdx ? "bg-amber-400" : "bg-zinc-100"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Order Card ────────────────────────────────────────────────────────────────
const REORDER_KEY = "valhalla_reorder";

function OrderCard({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);
  const isActive = !["entregue"].includes(order.kitchenStatus);

  return (
    <div
      className={`rounded-2xl border bg-white shadow-sm transition ${
        isActive ? "border-amber-300" : "border-zinc-200"
      }`}
    >
      {/* Header row */}
      <button
        className="w-full px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-zinc-400">
              {order.createdAtLabel}
              {order.fulfillmentType === "pickup" ? " · Pickup" : " · Delivery"}
            </p>
            <p className="mt-0.5 truncate text-sm font-bold text-zinc-900">
              {order.items.length} item{order.items.length !== 1 ? "s" : ""} · €
              {(order.totalCents / 100).toFixed(2)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusBadge status={order.kitchenStatus} />
            <span className="text-[10px] text-zinc-400">
              {expanded ? "▲ close" : "▼ details"}
            </span>
          </div>
        </div>

        {/* Live status stepper for active orders */}
        {isActive && order.kitchenStatus !== "aguardando_pagamento" && (
          <StatusStepper status={order.kitchenStatus} />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-zinc-100 px-4 py-3">
          <div className="mb-2 flex flex-col gap-1">
            {order.items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between text-sm"
              >
                <span className="text-zinc-700">
                  {item.quantity}× {item.name}
                  {item.removedIngredients &&
                    item.removedIngredients.length > 0 && (
                      <span className="ml-1 text-xs text-red-500">
                        (no {item.removedIngredients.join(", ")})
                      </span>
                    )}
                  {item.addedExtras && item.addedExtras.length > 0 && (
                    <span className="ml-1 text-xs text-amber-600">
                      +{item.addedExtras.map((e) => e.name).join(", ")}
                    </span>
                  )}
                </span>
                <span className="ml-2 shrink-0 font-bold text-zinc-900">
                  €{((item.unitPriceCents * item.quantity) / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-2">
            <div className="text-xs text-zinc-400">
              {order.paymentMethod === "stripe"
                ? "💳 Online"
                : order.paymentMethod === "cash_on_delivery"
                  ? "💵 Cash"
                  : "🏦 Card on delivery"}
              {order.deliveryAddress && (
                <span className="ml-2 text-zinc-400">
                  · {order.deliveryAddress}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {order.kitchenStatus === "entregue" && (
                <button
                  onClick={() => {
                    localStorage.setItem(
                      REORDER_KEY,
                      JSON.stringify(order.items as OrderItem[]),
                    );
                    window.location.href = "/";
                  }}
                  className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-black text-zinc-900 hover:bg-amber-400"
                >
                  🔄 Reorder
                </button>
              )}
              <span className="text-sm font-black text-zinc-900">
                Total: €{(order.totalCents / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Address Editor ────────────────────────────────────────────────────────────
function AddressEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: SavedAddress;
  onSave: (addr: SavedAddress) => void;
  onCancel: () => void;
}) {
  const [line1, setLine1] = useState(initial?.line1 ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [eircode, setEircode] = useState(initial?.eircode ?? "");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!line1.trim()) {
      setError("Enter your street.");
      return;
    }
    if (!city.trim()) {
      setError("Enter your city.");
      return;
    }
    onSave({ line1: line1.trim(), city: city.trim(), eircode: eircode.trim() });
  }

  const ic =
    "w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20";

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <input
        value={line1}
        onChange={(e) => setLine1(e.target.value)}
        placeholder="Street & number"
        className={ic}
      />
      <div className="flex gap-2">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City"
          className={ic}
        />
        <input
          value={eircode}
          onChange={(e) => setEircode(e.target.value)}
          placeholder="Eircode"
          className={`${ic} max-w-35`}
        />
      </div>
      {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-black text-white hover:bg-zinc-800"
        >
          Save Address
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-600 hover:border-zinc-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function PerfilPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<"perfil" | "pedidos">("perfil");
  const [editingAddress, setEditingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Auth guard
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/");
        return;
      }
      setUid(user.uid);
      setDisplayName(user.displayName ?? user.email ?? "");
    });
    return () => unsub();
  }, [router]);

  // Profile listener
  useEffect(() => {
    if (!uid) return;
    const unsub = listenCustomerProfile(uid, (p) => setProfile(p));
    return () => unsub();
  }, [uid]);

  // Orders listener
  useEffect(() => {
    if (!uid) return;
    const unsub = listenOrdersByUserId(uid, (o) => setOrders(o));
    return () => unsub();
  }, [uid]);

  const handleSaveAddress = useCallback(
    async (addr: SavedAddress) => {
      if (!uid) return;
      setSavingAddress(true);
      try {
        await setCustomerProfile(uid, { savedAddress: addr });
        setEditingAddress(false);
      } finally {
        setSavingAddress(false);
      }
    },
    [uid],
  );

  function normalizeIrishPhone(raw: string): string | null {
    const cleaned = raw.replace(/[^\d+]/g, "").trim();
    if (/^\+353\d{9}$/.test(cleaned)) return cleaned;
    if (/^353\d{9}$/.test(cleaned)) return `+${cleaned}`;
    if (/^0\d{9}$/.test(cleaned)) return `+353${cleaned.slice(1)}`;
    return null;
  }

  async function handleSavePhone() {
    if (!uid) return;
    const normalized = normalizeIrishPhone(phoneInput);
    if (!normalized) {
      setPhoneError(
        "Enter a valid Irish number (e.g. 0871234567 or +353871234567).",
      );
      return;
    }
    setSavingPhone(true);
    try {
      await setCustomerProfile(uid, { phone: normalized });
      setEditingPhone(false);
      setPhoneError("");
    } finally {
      setSavingPhone(false);
    }
  }

  const activeOrders = orders.filter((o) => o.kitchenStatus !== "entregue");
  const pastOrders = orders.filter((o) => o.kitchenStatus === "entregue");

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (!uid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white px-4 py-4 shadow-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-sm font-black text-zinc-900">
              {initials || "U"}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
                My Account
              </p>
              <p className="text-base font-black text-zinc-900">
                {displayName}
              </p>
            </div>
          </div>
          <Link
            href="/"
            className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-50"
          >
            ← Menu
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6">
        {/* Tab navigation */}
        <div className="mb-5 flex gap-1">
          <button
            onClick={() => setActiveTab("perfil")}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
              activeTab === "perfil"
                ? "bg-zinc-900 text-white"
                : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400"
            }`}
          >
            👤 Profile
          </button>
          <button
            onClick={() => setActiveTab("pedidos")}
            className={`flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
              activeTab === "pedidos"
                ? "bg-zinc-900 text-white"
                : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400"
            }`}
          >
            📦 My Orders
            {activeOrders.length > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-zinc-900">
                {activeOrders.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Orders tab ── */}
        {activeTab === "pedidos" && (
          <div className="space-y-4">
            {/* Active orders */}
            {activeOrders.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                  In progress
                </p>
                <div className="space-y-3">
                  {activeOrders.map((o) => (
                    <OrderCard key={o.id} order={o} />
                  ))}
                </div>
              </div>
            )}

            {/* Past orders */}
            {pastOrders.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                  History
                </p>
                <div className="space-y-3">
                  {pastOrders.map((o) => (
                    <OrderCard key={o.id} order={o} />
                  ))}
                </div>
              </div>
            )}

            {orders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <span className="text-5xl">🛍️</span>
                <p className="mt-4 text-sm font-semibold text-zinc-400">
                  You haven&apos;t placed any orders yet.
                </p>
                <Link
                  href="/"
                  className="mt-4 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-black text-zinc-900 hover:bg-amber-400"
                >
                  View Menu
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── Profile tab ── */}
        {activeTab === "perfil" && (
          <div className="space-y-4">
            {/* Account info card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
                Account
              </p>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-base font-black text-amber-700">
                  {initials || "U"}
                </div>
                <div>
                  <p className="font-bold text-zinc-900">{displayName}</p>
                  <p className="text-xs text-zinc-400">
                    {orders.length} order{orders.length !== 1 ? "s" : ""} placed
                  </p>
                </div>
              </div>
            </div>

            {/* Phone card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  Phone Number
                </p>
                {!editingPhone && (
                  <button
                    onClick={() => {
                      setPhoneInput(profile?.phone ?? "");
                      setPhoneError("");
                      setEditingPhone(true);
                    }}
                    className="text-xs font-bold text-amber-600 hover:text-amber-700"
                  >
                    {profile?.phone ? "Edit" : "+ Add"}
                  </button>
                )}
              </div>
              {!editingPhone ? (
                profile?.phone ? (
                  <div className="mt-3 rounded-xl bg-zinc-50 px-4 py-3 text-sm">
                    <p className="font-semibold text-zinc-800">
                      {profile.phone}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-400">
                    No phone number saved.
                  </p>
                )
              ) : (
                <div className="mt-3 flex flex-col gap-2">
                  <input
                    autoFocus
                    type="tel"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="e.g. 0871234567 or +353871234567"
                    className="field-input w-full text-sm"
                  />
                  {phoneError && (
                    <p className="text-xs text-red-500">{phoneError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      disabled={savingPhone}
                      onClick={() => void handleSavePhone()}
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                    >
                      {savingPhone ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => setEditingPhone(false)}
                      className="rounded-lg border border-zinc-200 px-4 py-2 text-xs font-bold text-zinc-600 hover:border-zinc-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Saved address card */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  Delivery Address
                </p>
                {!editingAddress && (
                  <button
                    onClick={() => setEditingAddress(true)}
                    className="text-xs font-bold text-amber-600 hover:text-amber-700"
                  >
                    {profile?.savedAddress ? "Edit" : "+ Add"}
                  </button>
                )}
              </div>

              {!editingAddress ? (
                profile?.savedAddress ? (
                  <div className="mt-3 rounded-xl bg-zinc-50 px-4 py-3 text-sm">
                    <p className="font-semibold text-zinc-800">
                      {profile.savedAddress.line1}
                    </p>
                    <p className="text-zinc-500">
                      {profile.savedAddress.city}
                      {profile.savedAddress.eircode
                        ? `, ${profile.savedAddress.eircode}`
                        : ""}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-zinc-400">
                    No saved address.
                  </p>
                )
              ) : (
                <AddressEditor
                  initial={profile?.savedAddress}
                  onSave={(addr) => void handleSaveAddress(addr)}
                  onCancel={() => setEditingAddress(false)}
                />
              )}
              {savingAddress && (
                <p className="mt-2 text-xs text-zinc-400">Saving...</p>
              )}
            </div>

            {/* Stats card */}
            {orders.length > 0 && (
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-zinc-500">
                  Summary
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-2xl font-black text-zinc-900">
                      {orders.length}
                    </p>
                    <p className="text-[10px] text-zinc-400">Orders</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-zinc-900">
                      €
                      {(
                        orders.reduce((s, o) => s + o.totalCents, 0) / 100
                      ).toFixed(0)}
                    </p>
                    <p className="text-[10px] text-zinc-400">Total spent</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-black text-zinc-900">
                      {orders.reduce(
                        (s, o) =>
                          s + o.items.reduce((si, i) => si + i.quantity, 0),
                        0,
                      )}
                    </p>
                    <p className="text-[10px] text-zinc-400">Items</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
