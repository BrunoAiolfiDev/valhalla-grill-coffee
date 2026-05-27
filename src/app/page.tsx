"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { BrandLogo } from "@/components/BrandLogo";
import { formatEuroFromCents, getMenuItems } from "@/lib/catalog";
import {
  createOrder,
  markOrderOnDelivery,
  listenOrdersOpen,
  listenDeliveryFee,
  listenCategories,
  listenOrdersByUserId,
  DEFAULT_CATEGORIES,
} from "@/lib/orders";
import type {
  MenuItem,
  MenuExtra,
  Order,
  OrderItem,
  PaymentMethod,
} from "@/lib/types";
import {
  listenCustomerProfile,
  setCustomerProfile,
  type SavedAddress,
} from "@/lib/customerProfile";

// ─── Cart types ──────────────────────────────────────────────────────────────
type CartEntry = {
  item: MenuItem;
  quantity: number;
  removedIngredients: string[];
  addedExtras: MenuExtra[];
};
type CartMap = Record<string, CartEntry>;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  burgers: "🍔 Burgers",
  coffee: "☕ Coffee",
  combos: "🎯 Combos",
  sides: "🍟 Sides",
};

function entryTotal(entry: CartEntry) {
  const extrasTotal = entry.addedExtras.reduce(
    (sum, e) => sum + e.priceCents,
    0,
  );
  return (entry.item.priceCents + extrasTotal) * entry.quantity;
}

// ─── Auth Screen ─────────────────────────────────────────────────────────────
function AuthScreen() {
  const {
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    continueAsGuest,
  } = useAuth();
  type Step = "main" | "email-login" | "email-register" | "guest" | "forgot";
  const [step, setStep] = useState<Step>("main");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  function reset() {
    setError("");
    setInfo("");
  }

  async function handleGoogle() {
    try {
      setLoading(true);
      reset();
      await signInWithGoogle();
    } catch {
      setError("Google sign-in failed. Try another method.");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Fill in all fields.");
      return;
    }
    try {
      setLoading(true);
      reset();
      await signInWithEmail(email.trim(), password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (
        msg.includes("user-not-found") ||
        msg.includes("wrong-password") ||
        msg.includes("invalid-credential")
      )
        setError("Incorrect email or password.");
      else setError("Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    try {
      setLoading(true);
      reset();
      await signUpWithEmail(name.trim(), email.trim(), password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("email-already-in-use"))
        setError("This email is already registered. Try logging in.");
      else setError("Registration failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email.");
      return;
    }
    try {
      setLoading(true);
      reset();
      await sendPasswordReset(email.trim());
      setInfo("Recovery email sent! Check your inbox.");
    } catch {
      setError("Could not send recovery email.");
    } finally {
      setLoading(false);
    }
  }

  function handleGuest() {
    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    continueAsGuest(name.trim());
  }

  const ic =
    "w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-4 text-base font-medium text-white placeholder-zinc-500 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <BrandLogo
            variant="yellow"
            width={280}
            height={80}
            className="mx-auto mt-2"
            priority
          />
        </div>

        {step === "main" && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => void handleGoogle()}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-bold text-zinc-900 shadow-lg transition hover:bg-zinc-100 disabled:opacity-60"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {loading ? "Signing in..." : "Continue with Google"}
            </button>
            <button
              onClick={() => {
                reset();
                setStep("email-login");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-transparent px-5 py-4 text-sm font-bold text-white transition hover:bg-zinc-800"
            >
              📧 Sign in with Email
            </button>
            <button
              onClick={() => {
                reset();
                setStep("email-register");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-transparent px-5 py-4 text-sm font-bold text-white transition hover:bg-zinc-800"
            >
              📝 Create Account
            </button>
            <button
              onClick={() => {
                reset();
                setStep("guest");
              }}
              className="w-full rounded-2xl border border-zinc-800 bg-transparent px-5 py-3 text-sm font-medium text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300"
            >
              Continue without account
            </button>
            {error && (
              <p className="text-center text-xs font-semibold text-red-400">
                {error}
              </p>
            )}
          </div>
        )}

        {step === "email-login" && (
          <form
            onSubmit={(e) => void handleEmailLogin(e)}
            className="flex flex-col gap-3"
          >
            <button
              type="button"
              onClick={() => {
                reset();
                setStep("main");
              }}
              className="mb-1 self-start text-xs font-semibold text-zinc-400 hover:text-white"
            >
              ← Back
            </button>
            <h2 className="text-lg font-black text-white">Sign In</h2>
            <input
              autoFocus
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={ic}
            />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={ic}
            />
            {error && (
              <p className="text-center text-xs font-semibold text-red-400">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-amber-500 px-5 py-4 text-sm font-black text-zinc-900 transition hover:bg-amber-400 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setStep("forgot");
              }}
              className="text-center text-xs text-zinc-500 hover:text-zinc-300"
            >
              Forgot password?
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setStep("email-register");
              }}
              className="text-center text-xs text-zinc-500 hover:text-zinc-300"
            >
              No account? Create one
            </button>
          </form>
        )}

        {step === "email-register" && (
          <form
            onSubmit={(e) => void handleRegister(e)}
            className="flex flex-col gap-3"
          >
            <button
              type="button"
              onClick={() => {
                reset();
                setStep("main");
              }}
              className="mb-1 self-start text-xs font-semibold text-zinc-400 hover:text-white"
            >
              ← Back
            </button>
            <h2 className="text-lg font-black text-white">Create Account</h2>
            <input
              autoFocus
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className={ic}
            />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={ic}
            />
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)"
              className={ic}
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className={ic}
            />
            {error && (
              <p className="text-center text-xs font-semibold text-red-400">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-amber-500 px-5 py-4 text-sm font-black text-zinc-900 transition hover:bg-amber-400 disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setStep("email-login");
              }}
              className="text-center text-xs text-zinc-500 hover:text-zinc-300"
            >
              Already have an account? Sign in
            </button>
          </form>
        )}

        {step === "forgot" && (
          <form
            onSubmit={(e) => void handleForgot(e)}
            className="flex flex-col gap-3"
          >
            <button
              type="button"
              onClick={() => {
                reset();
                setStep("email-login");
              }}
              className="mb-1 self-start text-xs font-semibold text-zinc-400 hover:text-white"
            >
              ← Back
            </button>
            <h2 className="text-lg font-black text-white">Recover Password</h2>
            <p className="text-xs text-zinc-400">
              We&apos;ll send a reset link to your email.
            </p>
            <input
              autoFocus
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={ic}
            />
            {error && (
              <p className="text-center text-xs font-semibold text-red-400">
                {error}
              </p>
            )}
            {info && (
              <p className="text-center text-xs font-semibold text-emerald-400">
                {info}
              </p>
            )}
            {!info && (
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-amber-500 px-5 py-4 text-sm font-black text-zinc-900 transition hover:bg-amber-400 disabled:opacity-60"
              >
                {loading ? "Sending..." : "Send Recovery Email"}
              </button>
            )}
          </form>
        )}

        {step === "guest" && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                reset();
                setStep("main");
              }}
              className="mb-1 self-start text-xs font-semibold text-zinc-400 hover:text-white"
            >
              ← Back
            </button>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGuest()}
              placeholder="Your full name"
              className={ic}
            />
            <button
              onClick={handleGuest}
              className="w-full rounded-2xl bg-amber-500 px-5 py-4 text-sm font-black text-zinc-900 transition hover:bg-amber-400"
            >
              Start Ordering
            </button>
            {error && (
              <p className="text-center text-xs font-semibold text-red-400">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Item Modal ───────────────────────────────────────────────────────────────
function ItemModal({
  item,
  existing,
  onClose,
  onConfirm,
}: {
  item: MenuItem;
  existing?: CartEntry;
  onClose: () => void;
  onConfirm: (entry: Omit<CartEntry, "item">) => void;
}) {
  const [qty, setQty] = useState(existing?.quantity ?? 1);
  const [removed, setRemoved] = useState<string[]>(
    existing?.removedIngredients ?? [],
  );
  const [extras, setExtras] = useState<MenuExtra[]>(
    existing?.addedExtras ?? [],
  );

  const extrasTotal = extras.reduce((s, e) => s + e.priceCents, 0);
  const totalPrice = (item.priceCents + extrasTotal) * qty;

  function toggleIngredient(ing: string) {
    setRemoved((prev) =>
      prev.includes(ing) ? prev.filter((i) => i !== ing) : [...prev, ing],
    );
  }

  function toggleExtra(extra: MenuExtra) {
    setExtras((prev) =>
      prev.find((e) => e.id === extra.id)
        ? prev.filter((e) => e.id !== extra.id)
        : [...prev, extra],
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white md:rounded-3xl">
        <div className="relative h-52 w-full shrink-0 overflow-hidden bg-zinc-200">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 512px"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl">
              🍔
            </div>
          )}
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition hover:bg-black/60"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h2 className="text-2xl font-black text-zinc-900">{item.name}</h2>
          <p className="mt-1 text-sm text-zinc-500">{item.description}</p>
          <p className="mt-2 text-lg font-bold text-amber-600">
            {formatEuroFromCents(item.priceCents)}
          </p>

          {item.ingredients && item.ingredients.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-400">
                Ingredients — tap to remove
              </p>
              <div className="flex flex-wrap gap-2">
                {item.ingredients.map((ing) => (
                  <button
                    key={ing}
                    onClick={() => toggleIngredient(ing)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      removed.includes(ing)
                        ? "border-red-300 bg-red-50 text-red-500 line-through"
                        : "border-zinc-200 bg-zinc-100 text-zinc-700 hover:border-zinc-300"
                    }`}
                  >
                    {removed.includes(ing) ? "✕ " : ""}
                    {ing}
                  </button>
                ))}
              </div>
            </div>
          )}

          {item.extras && item.extras.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-400">
                Adicionais
              </p>
              <div className="flex flex-col gap-2">
                {item.extras.map((extra) => {
                  const selected = extras.find((e) => e.id === extra.id);
                  return (
                    <button
                      key={extra.id}
                      onClick={() => toggleExtra(extra)}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${
                        selected
                          ? "border-amber-400 bg-amber-50 text-amber-800"
                          : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300"
                      }`}
                    >
                      <span className="font-semibold">
                        {selected ? "✓ " : "+ "}
                        {extra.name}
                      </span>
                      <span className="font-bold">
                        +{formatEuroFromCents(extra.priceCents)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-100 bg-white px-5 py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-xl bg-zinc-100 px-2">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="flex h-10 w-10 items-center justify-center text-xl font-bold text-zinc-500 hover:text-zinc-900"
              >
                −
              </button>
              <span className="min-w-[24px] text-center text-base font-black text-zinc-900">
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => q + 1)}
                className="flex h-10 w-10 items-center justify-center text-xl font-bold text-zinc-500 hover:text-zinc-900"
              >
                +
              </button>
            </div>
            <button
              onClick={() =>
                onConfirm({
                  quantity: qty,
                  removedIngredients: removed,
                  addedExtras: extras,
                })
              }
              className="flex flex-1 items-center justify-between rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-black text-white transition hover:bg-zinc-800"
            >
              <span>{existing ? "Update item" : "Add to cart"}</span>
              <span>{formatEuroFromCents(totalPrice)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delivery zone ───────────────────────────────────────────────────────────
const ALLOWED_CITIES = ["Donabate", "Portrane"];

type CheckoutParams = {
  address: string;
  paymentMethod: PaymentMethod;
  fulfillmentType: "delivery" | "pickup";
  changeFor?: number;
  rawAddress?: { line1: string; city: string; eircode: string };
};

// ─── Cart Drawer ──────────────────────────────────────────────────────────────
function CartDrawer({
  cart,
  onClose,
  onUpdateQty,
  onRemove,
  onEdit,
  onCheckout,
  deliveryFeeCents,
  savedAddress,
}: {
  cart: CartMap;
  onClose: () => void;
  onUpdateQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onEdit: (key: string) => void;
  onCheckout: (p: CheckoutParams) => void;
  deliveryFeeCents: number;
  savedAddress?: SavedAddress | null;
}) {
  const [line1, setLine1] = useState(() => savedAddress?.line1 ?? "");
  const [city, setCity] = useState(() => savedAddress?.city ?? "");
  const [eircode, setEircode] = useState(() => savedAddress?.eircode ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">(
    "delivery",
  );
  const [needsChange, setNeedsChange] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const entries = Object.entries(cart);
  const itemsTotal = entries.reduce((sum, [, e]) => sum + entryTotal(e), 0);
  const fee = fulfillmentType === "delivery" ? deliveryFeeCents : 0;
  const total = itemsTotal + fee;

  function validate() {
    const next: Record<string, string> = {};
    if (fulfillmentType === "delivery") {
      if (!line1.trim()) next.line1 = "Please enter your street and number.";
      if (!city) next.city = "Please select a city.";
      else if (!ALLOWED_CITIES.includes(city))
        next.city = "We only deliver to Donabate and Portrane.";
    }
    if (paymentMethod === "cash_on_delivery" && needsChange) {
      const val = parseFloat(changeFor);
      if (isNaN(val) || Math.round(val * 100) <= total)
        next.changeFor = "Must be greater than the order total.";
    }
    return next;
  }

  function handleCheckout() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    const fullAddress =
      fulfillmentType === "delivery"
        ? [line1.trim(), city, eircode.trim()].filter(Boolean).join(", ")
        : "Pickup at location";
    const changeForCents =
      paymentMethod === "cash_on_delivery" && needsChange
        ? Math.round(parseFloat(changeFor) * 100)
        : undefined;
    onCheckout({
      address: fullAddress,
      paymentMethod,
      fulfillmentType,
      changeFor: changeForCents,
      rawAddress:
        fulfillmentType === "delivery"
          ? { line1: line1.trim(), city, eircode: eircode.trim() }
          : undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white md:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-xl font-black text-zinc-900">My Cart</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-3">
            {entries.map(([key, entry]) => {
              const extrasTotal = entry.addedExtras.reduce(
                (s, e) => s + e.priceCents,
                0,
              );
              const linePrice =
                (entry.item.priceCents + extrasTotal) * entry.quantity;
              return (
                <div
                  key={key}
                  className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3"
                >
                  {entry.item.imageUrl && (
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={entry.item.imageUrl}
                        alt={entry.item.name}
                        fill
                        className="object-cover"
                        sizes="64px"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-bold text-zinc-900">{entry.item.name}</p>
                    {entry.removedIngredients.length > 0 && (
                      <p className="mt-0.5 text-xs text-red-500">
                        No: {entry.removedIngredients.join(", ")}
                      </p>
                    )}
                    {entry.addedExtras.length > 0 && (
                      <p className="mt-0.5 text-xs text-amber-700">
                        + {entry.addedExtras.map((e) => e.name).join(", ")}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-1">
                        <button
                          onClick={() => onUpdateQty(key, entry.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center text-base font-bold text-zinc-500 hover:text-red-500"
                        >
                          −
                        </button>
                        <span className="text-sm font-black text-zinc-900">
                          {entry.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQty(key, entry.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center text-base font-bold text-zinc-500 hover:text-zinc-900"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          onEdit(key);
                          onClose();
                        }}
                        className="text-xs font-semibold text-amber-500 hover:text-amber-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onRemove(key)}
                        className="text-xs font-semibold text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-black text-zinc-900">
                    {formatEuroFromCents(linePrice)}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            {/* Fulfillment type */}
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-400">
              How do you want it?
            </p>
            <div className="mb-4 flex gap-2">
              {(
                [
                  {
                    key: "delivery",
                    label: "🚗 Delivery",
                    sub: "To your door",
                  },
                  { key: "pickup", label: "🏪 Pickup", sub: "At the trailer" },
                ] as {
                  key: "delivery" | "pickup";
                  label: string;
                  sub: string;
                }[]
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setFulfillmentType(opt.key);
                    setErrors({});
                  }}
                  className={`flex flex-1 flex-col items-center rounded-2xl border py-3 px-2 text-center transition ${
                    fulfillmentType === opt.key
                      ? "border-amber-400 bg-amber-50 text-amber-800"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  <span className="text-xs font-black">{opt.label}</span>
                  <span className="mt-0.5 text-[10px] text-zinc-400">
                    {opt.sub}
                  </span>
                </button>
              ))}
            </div>

            {/* Payment method */}
            <p className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-400">
              Payment method
            </p>
            <div className="flex gap-2">
              {(
                [
                  { key: "stripe", label: "💳 Online", sub: "Secure card" },
                  {
                    key: "cash_on_delivery",
                    label: "💵 Cash",
                    sub:
                      fulfillmentType === "pickup"
                        ? "At pickup"
                        : "On delivery",
                  },
                  {
                    key: "card_on_delivery",
                    label: "💳 Card",
                    sub:
                      fulfillmentType === "pickup"
                        ? "At pickup"
                        : "On delivery",
                  },
                ] as { key: PaymentMethod; label: string; sub: string }[]
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => {
                    setPaymentMethod(opt.key);
                    setNeedsChange(false);
                    setChangeFor("");
                  }}
                  className={`flex flex-1 flex-col items-center rounded-2xl border py-3 px-2 text-center transition ${
                    paymentMethod === opt.key
                      ? "border-amber-400 bg-amber-50 text-amber-800"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  <span className="text-xs font-black">{opt.label}</span>
                  <span className="mt-0.5 text-[10px] text-zinc-400">
                    {opt.sub}
                  </span>
                </button>
              ))}
            </div>

            {/* Cash change section */}
            {paymentMethod === "cash_on_delivery" && (
              <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-zinc-700">
                    Do you need change?
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setNeedsChange((v) => !v);
                      setChangeFor("");
                      setErrors((p) => ({ ...p, changeFor: "" }));
                    }}
                    className={`relative h-6 w-11 rounded-full transition-colors ${needsChange ? "bg-amber-500" : "bg-zinc-300"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${needsChange ? "left-5.5" : "left-0.5"}`}
                    />
                  </button>
                </div>
                {needsChange && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-semibold text-zinc-500">
                      I&apos;m paying with (€)
                    </p>
                    <div className="mb-2 flex gap-2">
                      {["10", "20", "50", "100"].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => {
                            setChangeFor(v);
                            setErrors((p) => ({ ...p, changeFor: "" }));
                          }}
                          className={`flex-1 rounded-xl border py-2 text-sm font-black transition ${changeFor === v ? "border-amber-400 bg-amber-50 text-amber-800" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"}`}
                        >
                          €{v}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Or enter amount..."
                      value={changeFor}
                      onChange={(e) => {
                        setChangeFor(e.target.value);
                        setErrors((p) => ({ ...p, changeFor: "" }));
                      }}
                      className={`w-full rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 outline-none transition focus:ring-2 focus:ring-amber-500/20 ${errors.changeFor ? "border-red-400" : "border-zinc-200 focus:border-amber-500"}`}
                    />
                    {errors.changeFor && (
                      <p className="mt-1 text-xs font-semibold text-red-500">
                        {errors.changeFor}
                      </p>
                    )}
                    {changeFor &&
                      !isNaN(parseFloat(changeFor)) &&
                      Math.round(parseFloat(changeFor) * 100) > total && (
                        <p className="mt-2 text-center text-sm font-black text-emerald-600">
                          Change to bring:{" "}
                          {formatEuroFromCents(
                            Math.round(parseFloat(changeFor) * 100) - total,
                          )}
                        </p>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delivery address (only for delivery) */}
          {fulfillmentType === "delivery" && (
            <div className="mt-5">
              {/* Delivery zone notice */}
              <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                <span className="mt-px text-sm">📍</span>
                <p className="text-xs text-amber-800">
                  <span className="font-black">Delivery zone:</span> only{" "}
                  <strong>Donabate</strong> and <strong>Portrane</strong>.
                </p>
              </div>

              <p className="mb-2 text-xs font-black uppercase tracking-widest text-zinc-400">
                Delivery address
              </p>

              {/* Street + number */}
              <input
                value={line1}
                onChange={(e) => {
                  setLine1(e.target.value);
                  setErrors((prev) => ({ ...prev, line1: "" }));
                }}
                placeholder="Street & number (e.g. 14 Chapel Road)"
                className={`w-full rounded-2xl border bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:ring-2 focus:ring-amber-500/20 ${
                  errors.line1
                    ? "border-red-400 focus:border-red-400"
                    : "border-zinc-200 focus:border-amber-500"
                }`}
              />
              {errors.line1 && (
                <p className="mt-1 text-xs font-semibold text-red-500">
                  {errors.line1}
                </p>
              )}

              {/* City select */}
              <div className="mt-2 flex gap-2">
                {ALLOWED_CITIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setCity(c);
                      setErrors((prev) => ({ ...prev, city: "" }));
                    }}
                    className={`flex flex-1 items-center justify-center rounded-2xl border py-3 text-sm font-bold transition ${
                      city === c
                        ? "border-amber-400 bg-amber-50 text-amber-800"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {errors.city && (
                <p className="mt-1 text-xs font-semibold text-red-500">
                  {errors.city}
                </p>
              )}

              {/* Eircode (optional) */}
              <input
                value={eircode}
                onChange={(e) => setEircode(e.target.value)}
                placeholder="Eircode (optional, e.g. K36 XY12)"
                className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-100 bg-white px-5 py-4">
          {/* Totals breakdown */}
          <div className="mb-3 flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">Items</span>
              <span className="text-sm font-semibold text-zinc-700">
                {formatEuroFromCents(itemsTotal)}
              </span>
            </div>
            {fulfillmentType === "delivery" && fee > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Delivery fee</span>
                <span className="text-sm font-semibold text-zinc-700">
                  {formatEuroFromCents(fee)}
                </span>
              </div>
            )}
            {fulfillmentType === "delivery" && fee === 0 && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-500">Delivery fee</span>
                <span className="text-sm font-semibold text-emerald-600">
                  Free
                </span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-zinc-100 pt-1">
              <span className="text-sm font-bold text-zinc-700">Total</span>
              <span className="text-2xl font-black text-zinc-900">
                {formatEuroFromCents(total)}
              </span>
            </div>
          </div>
          <button
            onClick={handleCheckout}
            className="w-full rounded-2xl bg-amber-500 py-4 text-sm font-black text-zinc-900 transition hover:bg-amber-400 active:scale-95"
          >
            {paymentMethod === "stripe" ? "Pay Online" : "Confirm Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Home() {
  const { displayName, user, loading: authLoading, logout } = useAuth();
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartMap>({});
  const [savedAddress, setSavedAddress] = useState<SavedAddress | null>(null);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("burgers");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [editingEntryKey, setEditingEntryKey] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [ordersOpen, setOrdersOpenState] = useState<boolean | null>(null);
  const [deliveryFeeCents, setDeliveryFeeCentsState] = useState(0);
  const [categoryLabels, setCategoryLabels] = useState<Record<string, string>>(
    Object.fromEntries(DEFAULT_CATEGORIES.map((c) => [c.value, c.label])),
  );
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    void getMenuItems().then((items) => {
      setMenu(items);
      const raw = localStorage.getItem("valhalla_reorder");
      if (!raw) return;
      localStorage.removeItem("valhalla_reorder");
      try {
        const orderItems = JSON.parse(raw) as Array<{
          id: string;
          quantity: number;
          removedIngredients?: string[];
          addedExtras?: { id: string; name: string; priceCents: number }[];
        }>;
        const newCart: CartMap = {};
        for (const oi of orderItems) {
          const menuItem = items.find((m) => m.id === oi.id);
          if (!menuItem) continue;
          newCart[crypto.randomUUID()] = {
            item: menuItem,
            quantity: oi.quantity,
            removedIngredients: oi.removedIngredients ?? [],
            addedExtras: oi.addedExtras ?? [],
          };
        }
        if (Object.keys(newCart).length > 0) {
          setCart(newCart);
          setShowCart(true);
        }
      } catch {
        // ignore malformed data
      }
    });
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenCustomerProfile(user.uid, (p) =>
      setSavedAddress(p?.savedAddress ?? null),
    );
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenOrdersByUserId(user.uid, (orders) =>
      setActiveOrders(orders.filter((o) => o.kitchenStatus !== "entregue")),
    );
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    const unsub = listenOrdersOpen((open) => setOrdersOpenState(open));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = listenDeliveryFee((cents) => setDeliveryFeeCentsState(cents));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = listenCategories((cats) =>
      setCategoryLabels(
        Object.fromEntries(cats.map((c) => [c.value, c.label])),
      ),
    );
    return () => unsub();
  }, []);

  const categories = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};
    for (const item of menu) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }, [menu]);

  const cartEntries = useMemo(() => Object.values(cart), [cart]);
  const cartCount = useMemo(
    () => cartEntries.reduce((n, e) => n + e.quantity, 0),
    [cartEntries],
  );
  const cartTotal = useMemo(
    () => cartEntries.reduce((sum, e) => sum + entryTotal(e), 0),
    [cartEntries],
  );

  function scrollToCategory(cat: string) {
    setActiveCategory(cat);
    categoryRefs.current[cat]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function handleConfirmItem(entry: Omit<CartEntry, "item">) {
    if (!selectedItem) return;
    if (editingEntryKey) {
      setCart((prev) => ({
        ...prev,
        [editingEntryKey]: { ...entry, item: selectedItem },
      }));
      setEditingEntryKey(null);
    } else {
      const key = crypto.randomUUID();
      setCart((prev) => ({
        ...prev,
        [key]: { ...entry, item: selectedItem },
      }));
    }
    setSelectedItem(null);
  }

  function handleEditEntry(key: string) {
    const entry = cart[key];
    if (!entry) return;
    setEditingEntryKey(key);
    setSelectedItem(entry.item);
  }

  function handleUpdateQty(id: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } else {
      setCart((prev) => ({ ...prev, [id]: { ...prev[id], quantity: qty } }));
    }
  }

  function handleRemove(id: string) {
    setCart((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function handleCheckout({
    address,
    paymentMethod,
    fulfillmentType,
    changeFor,
    rawAddress,
  }: CheckoutParams) {
    if (!displayName) return;
    setCheckoutLoading(true);
    setFeedback("");
    setShowCart(false);

    const fee = fulfillmentType === "delivery" ? deliveryFeeCents : 0;
    const orderItems: OrderItem[] = cartEntries.map((e) => ({
      id: e.item.id,
      name: e.item.name,
      unitPriceCents: e.item.priceCents,
      quantity: e.quantity,
      removedIngredients: e.removedIngredients,
      addedExtras: e.addedExtras,
    }));

    try {
      const orderId = await createOrder({
        customerName: displayName,
        userId: user?.uid,
        items: orderItems,
        totalCents: cartTotal + fee,
        deliveryAddress: address,
        paymentMethod,
        fulfillmentType,
        changeFor,
        deliveryFeeCents: fee,
      });

      // Auto-save delivery address to customer profile
      if (fulfillmentType === "delivery" && user?.uid && rawAddress) {
        void setCustomerProfile(user.uid, { savedAddress: rawAddress });
      }

      if (
        paymentMethod === "cash_on_delivery" ||
        paymentMethod === "card_on_delivery"
      ) {
        // Entrega: pula Stripe, marca como pago direto e vai para confirmação
        await markOrderOnDelivery(orderId);
        window.location.href = `/sucesso?orderId=${orderId}`;
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          customerName: displayName,
          items: orderItems,
        }),
      });

      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url)
        throw new Error(data.error ?? "Error opening checkout.");
      window.location.href = data.url;
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Checkout error.");
      setShowCart(true);
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </main>
    );
  }

  if (!displayName) return <AuthScreen />;

  const firstName = displayName.trim().split(/\s+/)[0] ?? displayName;

  return (
    <>
      <main className="min-h-screen bg-zinc-100 pb-32 font-sans text-zinc-900">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white shadow-sm">
          <div className="mx-auto max-w-2xl px-4">
            <div className="flex items-start justify-between py-2">
              <div>
                <p className="text-base font-bold uppercase tracking-wider text-amber-500">
                  Hey, {firstName} 👋
                </p>
              </div>
              <div className="flex items-center gap-2">
                {user && (
                  <Link
                    href="/perfil"
                    className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-zinc-900">
                      {(user.displayName ?? "U")[0]?.toUpperCase()}
                    </span>
                    Profile
                  </Link>
                )}
                <button
                  onClick={() => void logout()}
                  className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-500 transition hover:bg-zinc-50"
                >
                  Sign out
                </button>
              </div>
            </div>

            {/* Category tabs */}
            <div className="no-scrollbar flex gap-1 overflow-x-auto py-2">
              {Object.keys(categories).map((cat) => (
                <button
                  key={cat}
                  onClick={() => scrollToCategory(cat)}
                  className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                    activeCategory === cat
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {categoryLabels[cat] ?? cat}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Hero banner */}
        <div className="relative mx-auto max-w-2xl overflow-hidden">
          <div
            className="relative w-full overflow-hidden bg-black"
            style={{ aspectRatio: "1200 / 384" }}
          >
            <img
              src="/bg-menu.jpg"
              alt="Valhalla Grill & Coffee background"
              className="h-full w-full object-contain object-center"
            />
          </div>
        </div>

        {/* Active order tracker */}
        {activeOrders.length > 0 && (
          <div className="mx-auto max-w-2xl space-y-2 px-4 pt-4">
            {activeOrders.map((order) => {
              const STATUS_LABELS: Record<string, string> = {
                pago: "Order received",
                em_preparo: "Preparing your order",
                pronto: "On its way!",
              };
              const STATUS_ICONS: Record<string, string> = {
                pago: "✅",
                em_preparo: "👨‍🍳",
                pronto: "🛵",
              };
              const STEPS = ["pago", "em_preparo", "pronto"];
              const currentIdx = STEPS.indexOf(order.kitchenStatus);
              const label = STATUS_LABELS[order.kitchenStatus] ?? "Processing";
              const icon = STATUS_ICONS[order.kitchenStatus] ?? "⏳";
              return (
                <Link
                  key={order.id}
                  href="/perfil"
                  className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 transition hover:bg-amber-100"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
                        Your order
                      </p>
                      <p className="text-sm font-black text-zinc-900">
                        {icon} {label}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">
                        {order.items.length} item
                        {order.items.length !== 1 ? "s" : ""}
                      </p>
                      <p className="text-sm font-black text-zinc-900">
                        €{(order.totalCents / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {/* Mini stepper */}
                  <div className="flex items-center">
                    {STEPS.map((step, idx) => {
                      const done = idx <= currentIdx;
                      const isCurrent = idx === currentIdx;
                      return (
                        <div key={step} className="flex flex-1 items-center">
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black transition-all ${
                              done
                                ? isCurrent
                                  ? "bg-amber-500 text-white ring-2 ring-amber-300 ring-offset-1"
                                  : "bg-zinc-700 text-white"
                                : "bg-zinc-200 text-zinc-400"
                            }`}
                          >
                            {done ? STATUS_ICONS[step] : idx + 1}
                          </div>
                          {idx < STEPS.length - 1 && (
                            <div
                              className={`h-1 flex-1 ${
                                idx < currentIdx
                                  ? "bg-amber-400"
                                  : "bg-zinc-200"
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[10px] font-semibold text-amber-700">
                    Tap to view details →
                  </p>
                </Link>
              );
            })}
          </div>
        )}

        {/* Kitchen closed banner */}
        {ordersOpen === false && (
          <div className="mx-auto max-w-2xl px-4 pt-4">
            <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
              <span className="text-2xl">🔒</span>
              <div>
                <p className="text-sm font-black text-red-700">
                  Kitchen is currently closed
                </p>
                <p className="text-xs text-red-500">
                  We are not accepting orders right now. Come back soon!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Menu sections */}
        <div className="mx-auto max-w-2xl px-4 py-6">
          {Object.entries(categories).map(([cat, items]) => (
            <div
              key={cat}
              ref={(el) => {
                categoryRefs.current[cat] = el;
              }}
              className="mb-8 scroll-mt-28"
            >
              <h2 className="mb-4 text-lg font-black text-zinc-900">
                {categoryLabels[cat] ?? cat}
              </h2>
              <div className="flex flex-col gap-3">
                {items.map((item) => {
                  const inCartCount = Object.values(cart)
                    .filter((e) => e.item.id === item.id)
                    .reduce((n, e) => n + e.quantity, 0);
                  return (
                    <button
                      key={item.id}
                      onClick={() =>
                        ordersOpen !== false && setSelectedItem(item)
                      }
                      disabled={ordersOpen === false}
                      className={`flex w-full items-center gap-4 rounded-2xl bg-white p-3 text-left shadow-sm transition hover:shadow-md active:scale-[0.99] ${ordersOpen === false ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex-1 pr-1">
                        <p className="font-bold leading-tight text-zinc-900">
                          {item.name}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">
                          {item.description}
                        </p>
                        <p className="mt-2 font-black text-amber-600">
                          {formatEuroFromCents(item.priceCents)}
                        </p>
                      </div>
                      <div className="relative shrink-0">
                        <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-zinc-100">
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={item.name}
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-3xl">
                              🍔
                            </div>
                          )}
                        </div>
                        {inCartCount > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-zinc-900 shadow">
                            {inCartCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {feedback && (
          <div className="fixed bottom-28 left-4 right-4 z-40 mx-auto max-w-sm rounded-2xl bg-red-500 px-4 py-3 text-center text-sm font-bold text-white shadow-xl">
            {feedback}
          </div>
        )}
      </main>

      {/* Fixed cart button */}
      {cartCount > 0 && ordersOpen !== false && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-6 pt-2">
          <div className="mx-auto max-w-2xl">
            <button
              onClick={() => setShowCart(true)}
              disabled={checkoutLoading}
              className="flex w-full items-center justify-between rounded-2xl bg-zinc-900 px-5 py-4 shadow-2xl transition hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-70"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-zinc-900">
                {cartCount}
              </span>
              <span className="text-sm font-black text-white">
                {checkoutLoading ? "Processing..." : "View cart"}
              </span>
              <span className="text-sm font-black text-amber-400">
                {formatEuroFromCents(cartTotal)}
              </span>
            </button>
          </div>
        </div>
      )}

      {selectedItem && (
        <ItemModal
          item={selectedItem}
          existing={editingEntryKey ? cart[editingEntryKey] : undefined}
          onClose={() => {
            setSelectedItem(null);
            setEditingEntryKey(null);
          }}
          onConfirm={handleConfirmItem}
        />
      )}

      {showCart && (
        <CartDrawer
          cart={cart}
          onClose={() => setShowCart(false)}
          onUpdateQty={handleUpdateQty}
          onRemove={handleRemove}
          onEdit={handleEditEntry}
          onCheckout={handleCheckout}
          deliveryFeeCents={deliveryFeeCents}
          savedAddress={savedAddress}
        />
      )}
    </>
  );
}
