"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, storage } from "@/lib/firebase";
import {
  getAllProductsAdmin,
  addProduct,
  updateProduct,
  deleteProduct,
  type ProductPayload,
} from "@/lib/adminProducts";
import {
  listenOrdersOpen,
  setOrdersOpen,
  listenDeliveryFee,
  setDeliveryFee,
  getKitchenPin,
  setKitchenPin,
  listenCategories,
  setCategories,
  DEFAULT_CATEGORIES,
  listenDrivers,
  setDrivers,
  type Category,
  type Driver,
} from "@/lib/orders";
import type { MenuItem, MenuExtra } from "@/lib/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function labelToValue(label: string): string {
  return (
    label
      .replace(/[^\w\s-]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/^-|-$/g, "") || `cat-${Date.now()}`
  );
}

const EMPTY_FORM: ProductPayload = {
  name: "",
  description: "",
  category: "",
  priceCents: 0,
  imageUrl: "",
  active: true,
  ingredients: [],
  extras: [],
};

// ─── ProductModal ─────────────────────────────────────────────────────────────
function ProductModal({
  initial,
  onSave,
  onCancel,
  saving,
  categories,
  onAddCategory,
}: {
  initial: ProductPayload;
  onSave: (data: ProductPayload) => void;
  onCancel: () => void;
  saving: boolean;
  categories: Category[];
  onAddCategory: (label: string) => void;
}) {
  const [form, setForm] = useState<ProductPayload>(initial);
  const [ingredientsInput, setIngredientsInput] = useState(
    initial.ingredients.join(", "),
  );
  const [extraRows, setExtraRows] = useState<MenuExtra[]>(initial.extras);
  const [priceInput, setPriceInput] = useState(
    (initial.priceCents / 100).toFixed(2),
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(file: File) {
    setUploadError("");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const storageRef = ref(storage, `produtos/${crypto.randomUUID()}.${ext}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch {
      setUploadError(
        "Could not upload image. Check Firebase Storage setup and permissions.",
      );
    } finally {
      setUploading(false);
    }
  }

  function addExtraRow() {
    setExtraRows((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", priceCents: 0 },
    ]);
  }

  function updateExtraRow(idx: number, field: keyof MenuExtra, val: string) {
    setExtraRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              [field]:
                field === "priceCents"
                  ? Math.round(parseFloat(val || "0") * 100)
                  : val,
            }
          : r,
      ),
    );
  }

  function removeExtraRow(idx: number) {
    setExtraRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ingredients = ingredientsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const cents = Math.round(parseFloat(priceInput || "0") * 100);
    onSave({
      ...form,
      priceCents: cents,
      ingredients,
      extras: extraRows.filter((r) => r.name.trim()),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm md:items-center"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="flex max-h-[96vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white md:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 px-6 py-4">
          <h2 className="text-xl font-black text-zinc-900">
            {initial.name ? "Edit Product" : "New Product"}
          </h2>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
          >
            ✕
          </button>
        </div>

        <form
          id="product-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5"
        >
          <div className="grid gap-5 md:grid-cols-2">
            {/* Name */}
            <div className="md:col-span-2">
              <label className="field-label">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                className="field-input"
                placeholder="e.g. Classic Burger"
              />
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="field-label">Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="field-input resize-none"
                placeholder="Brief product description..."
              />
            </div>

            {/* Category */}
            <div>
              <label className="field-label">Category</label>
              {!showNewCat ? (
                <select
                  value={form.category}
                  onChange={(e) => {
                    if (e.target.value === "__new__") {
                      setShowNewCat(true);
                    } else {
                      setForm((f) => ({ ...f, category: e.target.value }));
                    }
                  }}
                  className="field-input"
                >
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                  <option value="__new__">✏️ Add new category…</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    value={newCatLabel}
                    onChange={(e) => setNewCatLabel(e.target.value)}
                    placeholder="🍟 New Category"
                    className="field-input flex-1"
                  />
                  <button
                    type="button"
                    disabled={!newCatLabel.trim()}
                    onClick={() => {
                      const label = newCatLabel.trim();
                      const value = labelToValue(label);
                      onAddCategory(label);
                      setForm((f) => ({ ...f, category: value }));
                      setShowNewCat(false);
                      setNewCatLabel("");
                    }}
                    className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewCat(false)}
                    className="rounded-xl border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 hover:border-zinc-400"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Price */}
            <div>
              <label className="field-label">Price (€)</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                className="field-input"
                placeholder="0.00"
              />
            </div>

            {/* Product Image */}
            <div className="md:col-span-2">
              <label className="field-label">Product Image</label>

              {/* Upload area */}
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 py-5 transition hover:border-amber-400 hover:bg-amber-50"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) void handleFileUpload(file);
                }}
              >
                {uploading ? (
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                ) : (
                  <>
                    <span className="text-2xl">📷</span>
                    <p className="text-xs font-semibold text-zinc-500">
                      Click or drag an image
                    </p>
                    <p className="text-[10px] text-zinc-400">PNG, JPG, WEBP</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />

              {uploadError && (
                <p className="mt-2 text-xs font-semibold text-red-500">
                  {uploadError}
                </p>
              )}

              {/* Or URL */}
              <div className="mt-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-zinc-200" />
                <span className="text-[10px] font-bold uppercase text-zinc-400">
                  or paste a URL
                </span>
                <div className="h-px flex-1 bg-zinc-200" />
              </div>
              <input
                value={form.imageUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, imageUrl: e.target.value }))
                }
                className="field-input mt-2"
                placeholder="https://images.unsplash.com/..."
              />

              {form.imageUrl && (
                <div className="relative mt-3 h-28 w-28 overflow-hidden rounded-xl border border-zinc-200">
                  <Image
                    src={form.imageUrl}
                    alt="preview"
                    fill
                    unoptimized
                    className="object-cover"
                    sizes="112px"
                    onError={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                  />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-[10px] text-white hover:bg-black/70"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            {/* Ativo */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                className={`relative h-6 w-11 rounded-full transition ${
                  form.active ? "bg-amber-500" : "bg-zinc-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    form.active ? "left-5.5" : "left-0.5"
                  }`}
                />
              </button>
              <span className="text-sm font-semibold text-zinc-700">
                {form.active ? "Active on menu" : "Hidden from menu"}
              </span>
            </div>

            {/* Ingredients */}
            <div className="md:col-span-2">
              <label className="field-label">
                Ingredients (comma-separated)
              </label>
              <input
                value={ingredientsInput}
                onChange={(e) => setIngredientsInput(e.target.value)}
                className="field-input"
                placeholder="Brioche bun, 180g beef, cheese, lettuce..."
              />
            </div>

            {/* Add-ons */}
            <div className="md:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <label className="field-label mb-0">Add-ons</label>
                <button
                  type="button"
                  onClick={addExtraRow}
                  className="text-xs font-bold text-amber-600 hover:text-amber-700"
                >
                  + Add
                </button>
              </div>
              <div className="flex flex-col gap-2">
                {extraRows.map((row, idx) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <input
                      value={row.name}
                      onChange={(e) =>
                        updateExtraRow(idx, "name", e.target.value)
                      }
                      placeholder="Extra name"
                      className="field-input flex-1"
                    />
                    <div className="relative w-28 shrink-0">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                        €
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={(row.priceCents / 100).toFixed(2)}
                        onChange={(e) =>
                          updateExtraRow(idx, "priceCents", e.target.value)
                        }
                        className="field-input pl-7"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExtraRow(idx)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>

        <div className="shrink-0 border-t border-zinc-100 bg-white px-6 py-4">
          <button
            type="submit"
            form="product-form"
            disabled={saving}
            className="w-full rounded-2xl bg-amber-500 py-4 text-sm font-black text-zinc-900 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const [adminReady, setAdminReady] = useState(false);
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [modalProduct, setModalProduct] = useState<MenuItem | null | "new">(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [ordersOpen, setOrdersOpenState] = useState<boolean | null>(null);
  const [togglingOrders, setTogglingOrders] = useState(false);
  const [deliveryFeeCents, setDeliveryFeeCentsState] = useState<number>(0);
  const [feeInput, setFeeInput] = useState("0.00");
  const [savingFee, setSavingFee] = useState(false);
  const [kitchenPinInput, setKitchenPinInput] = useState("");
  const [savingKitchenPin, setSavingKitchenPin] = useState(false);
  const [kitchenPinSaved, setKitchenPinSaved] = useState(false);
  const [categories, setCategories_] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [editingCatIdx, setEditingCatIdx] = useState<number | null>(null);
  const [catEditInput, setCatEditInput] = useState("");
  const [addingNewCat, setAddingNewCat] = useState(false);
  const [newCatInput, setNewCatInput] = useState("");
  const dragCatIdx = useRef<number | null>(null);
  const dragOverCatIdx = useRef<number | null>(null);
  const [drivers, setDrivers_] = useState<Driver[]>([]);
  const [editingDriverIdx, setEditingDriverIdx] = useState<number | null>(null);
  const [driverEditName, setDriverEditName] = useState("");
  const [driverEditPin, setDriverEditPin] = useState("");
  const [addingNewDriver, setAddingNewDriver] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverPin, setNewDriverPin] = useState("");

  // ── Auth guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/admin/login");
        return;
      }
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      if (adminEmail && user.email !== adminEmail) {
        router.replace("/admin/login");
        return;
      }
      setAdminReady(true);
    });
    return () => unsub();
  }, [router]);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const items = await getAllProductsAdmin();
      setProducts(items.sort((a, b) => a.name.localeCompare(b.name)));
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    if (adminReady) void loadProducts();
  }, [adminReady, loadProducts]);

  useEffect(() => {
    if (!adminReady) return;
    const unsub = listenOrdersOpen((open) => setOrdersOpenState(open));
    return () => unsub();
  }, [adminReady]);

  useEffect(() => {
    if (!adminReady) return;
    const unsub = listenDeliveryFee((cents) => {
      setDeliveryFeeCentsState(cents);
      setFeeInput((cents / 100).toFixed(2));
    });
    return () => unsub();
  }, [adminReady]);

  useEffect(() => {
    if (!adminReady) return;
    const unsub = listenDrivers((d) => setDrivers_(d));
    return () => unsub();
  }, [adminReady]);

  useEffect(() => {
    if (!adminReady) return;
    getKitchenPin().then((pin) => {
      if (pin) setKitchenPinInput(pin);
    });
  }, [adminReady]);

  useEffect(() => {
    if (!adminReady) return;
    const unsub = listenCategories((cats) => setCategories_(cats));
    return () => unsub();
  }, [adminReady]);

  async function handleAddCategory(label: string) {
    const value = labelToValue(label);
    const updated = [...categories, { value, label }];
    await setCategories(updated);
  }

  // ── Save (add or update) ────────────────────────────────────────────────────
  async function handleSave(payload: ProductPayload) {
    setSaving(true);
    try {
      if (modalProduct === "new") {
        await addProduct(payload);
      } else if (modalProduct) {
        await updateProduct(modalProduct.id, payload);
      }
      setModalProduct(null);
      await loadProducts();
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    await deleteProduct(id);
    setDeleteConfirm(null);
    await loadProducts();
  }

  // ── Toggle active ───────────────────────────────────────────────────────────
  async function handleToggleActive(product: MenuItem) {
    await updateProduct(product.id, { active: !product.active });
    await loadProducts();
  }

  if (!adminReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </main>
    );
  }

  const initialForModal: ProductPayload =
    modalProduct === "new"
      ? { ...EMPTY_FORM, category: categories[0]?.value ?? "" }
      : modalProduct
        ? {
            name: modalProduct.name,
            description: modalProduct.description,
            category: modalProduct.category,
            priceCents: modalProduct.priceCents,
            imageUrl: modalProduct.imageUrl ?? "",
            active: modalProduct.active,
            ingredients: modalProduct.ingredients ?? [],
            extras: modalProduct.extras ?? [],
          }
        : { ...EMPTY_FORM, category: categories[0]?.value ?? "" };

  return (
    <>
      <main className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-white border-b border-zinc-200 px-6 py-4 shadow-sm">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
                Admin Panel
              </p>
              <h1 className="display-font text-2xl font-black text-zinc-900">
                Menu
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {/* Orders toggle switch */}
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                <span className="text-xs font-bold text-zinc-500">Orders</span>
                <button
                  type="button"
                  disabled={ordersOpen === null || togglingOrders}
                  onClick={async () => {
                    if (ordersOpen === null || togglingOrders) return;
                    setTogglingOrders(true);
                    try {
                      await setOrdersOpen(!ordersOpen);
                    } finally {
                      setTogglingOrders(false);
                    }
                  }}
                  className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
                    ordersOpen ? "bg-emerald-500" : "bg-zinc-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      ordersOpen ? "left-5.5" : "left-0.5"
                    }`}
                  />
                </button>
                <span
                  className={`text-xs font-bold ${
                    ordersOpen ? "text-emerald-600" : "text-zinc-400"
                  }`}
                >
                  {ordersOpen === null ? "..." : ordersOpen ? "Open" : "Closed"}
                </span>
              </div>
              <button
                onClick={() => setModalProduct("new")}
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-black text-zinc-900 transition hover:bg-amber-400"
              >
                + New Product
              </button>
              <Link
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-600 transition hover:bg-zinc-200"
              >
                🛍 Menu
              </Link>
              <Link
                href="/cozinha"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-zinc-700"
              >
                🍳 Cozinha
              </Link>
              <Link
                href="/entregador"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-zinc-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-zinc-600"
              >
                🚗 Driver
              </Link>
              <Link
                href="/admin/relatorios"
                className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-900 transition hover:bg-amber-400"
              >
                📊 Relatórios
              </Link>
              <button
                onClick={() =>
                  void signOut(auth).then(() => router.replace("/admin/login"))
                }
                className="rounded-xl bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-600 transition hover:bg-zinc-200"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        <section className="mx-auto max-w-5xl px-6 py-8">
          {/* Delivery fee settings */}
          <div className="mb-6 flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Delivery Fee
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">
                Added to all delivery orders (€
                {(deliveryFeeCents / 100).toFixed(2)} currently)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
                  €
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  value={feeInput}
                  onChange={(e) => setFeeInput(e.target.value)}
                  className="w-28 rounded-xl border border-zinc-200 bg-zinc-50 py-2 pl-7 pr-3 text-sm font-bold text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
              <button
                disabled={savingFee}
                onClick={async () => {
                  setSavingFee(true);
                  try {
                    const cents = Math.round(parseFloat(feeInput || "0") * 100);
                    await setDeliveryFee(cents);
                  } finally {
                    setSavingFee(false);
                  }
                }}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-black text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {savingFee ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          {/* Drivers management */}
          <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  Drivers
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Each driver has a name and PIN to access their delivery view
                </p>
              </div>
              <button
                disabled={addingNewDriver}
                onClick={() => {
                  setAddingNewDriver(true);
                  setNewDriverName("");
                  setNewDriverPin("");
                }}
                className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-black text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                + Add
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {drivers.map((drv, idx) => (
                <div key={drv.id} className="flex items-center gap-2">
                  {editingDriverIdx === idx ? (
                    <>
                      <input
                        autoFocus
                        value={driverEditName}
                        onChange={(e) => setDriverEditName(e.target.value)}
                        placeholder="Driver name"
                        className="field-input flex-1 text-sm"
                      />
                      <input
                        type="password"
                        inputMode="numeric"
                        value={driverEditPin}
                        onChange={(e) => setDriverEditPin(e.target.value)}
                        placeholder="PIN"
                        className="w-24 rounded-xl border border-zinc-200 bg-zinc-50 py-2 px-3 text-sm font-bold text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                      <button
                        type="button"
                        disabled={
                          !driverEditName.trim() || !driverEditPin.trim()
                        }
                        onClick={async () => {
                          const updated = drivers.map((d, i) =>
                            i === idx
                              ? {
                                  ...d,
                                  name: driverEditName.trim(),
                                  pin: driverEditPin.trim(),
                                }
                              : d,
                          );
                          await setDrivers(updated);
                          setEditingDriverIdx(null);
                        }}
                        className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingDriverIdx(null)}
                        className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 hover:border-zinc-400"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-semibold text-zinc-800">
                        {drv.name}
                      </span>
                      <span className="text-xs text-zinc-400">PIN: ••••</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDriverIdx(idx);
                          setDriverEditName(drv.name);
                          setDriverEditPin(drv.pin);
                        }}
                        className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 hover:border-zinc-400"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = drivers.filter((_, i) => i !== idx);
                          await setDrivers(updated);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100"
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              ))}
              {drivers.length === 0 && !addingNewDriver && (
                <p className="text-xs text-zinc-400 italic">
                  No drivers yet. Add one above.
                </p>
              )}
              {addingNewDriver && (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    autoFocus
                    value={newDriverName}
                    onChange={(e) => setNewDriverName(e.target.value)}
                    placeholder="Driver name"
                    className="field-input flex-1 text-sm"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    value={newDriverPin}
                    onChange={(e) => setNewDriverPin(e.target.value)}
                    placeholder="PIN"
                    className="w-24 rounded-xl border border-zinc-200 bg-zinc-50 py-2 px-3 text-sm font-bold text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                  <button
                    type="button"
                    disabled={!newDriverName.trim() || !newDriverPin.trim()}
                    onClick={async () => {
                      const newDriver: Driver = {
                        id: crypto.randomUUID(),
                        name: newDriverName.trim(),
                        pin: newDriverPin.trim(),
                      };
                      await setDrivers([...drivers, newDriver]);
                      setAddingNewDriver(false);
                      setNewDriverName("");
                      setNewDriverPin("");
                    }}
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingNewDriver(false)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 hover:border-zinc-400"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Kitchen PIN settings */}
          <div className="mb-6 flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Kitchen PIN
              </p>
              <p className="mt-0.5 text-xs text-zinc-400">
                PIN used by kitchen staff to access the production board
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="password"
                inputMode="numeric"
                placeholder="New PIN"
                value={kitchenPinInput}
                onChange={(e) => {
                  setKitchenPinInput(e.target.value);
                  setKitchenPinSaved(false);
                }}
                className="w-28 rounded-xl border border-zinc-200 bg-zinc-50 py-2 px-3 text-sm font-bold text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
              <button
                disabled={savingKitchenPin || !kitchenPinInput}
                onClick={async () => {
                  setSavingKitchenPin(true);
                  try {
                    await setKitchenPin(kitchenPinInput);
                    setKitchenPinSaved(true);
                  } finally {
                    setSavingKitchenPin(false);
                  }
                }}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-black text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                {savingKitchenPin
                  ? "Saving..."
                  : kitchenPinSaved
                    ? "Saved ✓"
                    : "Save"}
              </button>
            </div>
          </div>

          {/* Categories settings */}
          <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  Categories
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Menu categories — emoji + name (e.g. 🍔 Burgers)
                </p>
              </div>
              <button
                disabled={addingNewCat}
                onClick={() => {
                  setAddingNewCat(true);
                  setNewCatInput("");
                }}
                className="rounded-xl bg-zinc-900 px-3 py-2 text-xs font-black text-white transition hover:bg-zinc-800 disabled:opacity-50"
              >
                + Add
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {categories.map((cat, idx) => (
                <div
                  key={cat.value}
                  className="flex items-center gap-2"
                  draggable
                  onDragStart={() => {
                    dragCatIdx.current = idx;
                  }}
                  onDragEnter={() => {
                    dragOverCatIdx.current = idx;
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async () => {
                    const from = dragCatIdx.current;
                    const to = dragOverCatIdx.current;
                    if (from === null || to === null || from === to) return;
                    const reordered = [...categories];
                    const [moved] = reordered.splice(from, 1);
                    reordered.splice(to, 0, moved);
                    dragCatIdx.current = null;
                    dragOverCatIdx.current = null;
                    await setCategories(reordered);
                  }}
                  onDragEnd={() => {
                    dragCatIdx.current = null;
                    dragOverCatIdx.current = null;
                  }}
                >
                  {editingCatIdx === idx ? (
                    <>
                      <input
                        autoFocus
                        value={catEditInput}
                        onChange={(e) => setCatEditInput(e.target.value)}
                        className="field-input flex-1 text-sm"
                        placeholder="🍟 Category Name"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = categories.map((c, i) =>
                            i === idx ? { ...c, label: catEditInput } : c,
                          );
                          await setCategories(updated);
                          setEditingCatIdx(null);
                        }}
                        className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-black text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCatIdx(null)}
                        className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 hover:border-zinc-400"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className="cursor-grab touch-none select-none pr-1 text-zinc-300 hover:text-zinc-500"
                        title="Drag to reorder"
                      >
                        ⠿
                      </span>
                      <span className="flex-1 text-sm font-semibold text-zinc-800">
                        {cat.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCatIdx(idx);
                          setCatEditInput(cat.label);
                        }}
                        className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 hover:border-zinc-400"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = categories.filter(
                            (_, i) => i !== idx,
                          );
                          await setCategories(updated);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-400 hover:bg-red-100"
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              ))}
              {addingNewCat && (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    autoFocus
                    value={newCatInput}
                    onChange={(e) => setNewCatInput(e.target.value)}
                    placeholder="🍟 New Category"
                    className="field-input flex-1 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!newCatInput.trim()}
                    onClick={async () => {
                      const label = newCatInput.trim();
                      const value = labelToValue(label);
                      await setCategories([...categories, { value, label }]);
                      setAddingNewCat(false);
                      setNewCatInput("");
                    }}
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingNewCat(false)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-bold text-zinc-600 hover:border-zinc-400"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {loadingProducts ? (
            <div className="flex justify-center py-32">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            </div>
          ) : products.length === 0 ? (
            <div className="py-32 text-center">
              <p className="text-4xl">🍔</p>
              <p className="mt-4 text-sm font-semibold text-zinc-400">
                No products found.
              </p>
              <button
                onClick={() => setModalProduct("new")}
                className="mt-4 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-black text-zinc-900 hover:bg-amber-400"
              >
                Create first product
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
                >
                  <div className="relative h-40 w-full bg-zinc-100">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        unoptimized
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-4xl">
                        🍔
                      </div>
                    )}
                    <div className="absolute left-3 top-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          product.active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-zinc-200 text-zinc-500"
                        }`}
                      >
                        {product.active ? "Active" : "Hidden"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h3 className="font-black text-zinc-900">
                          {product.name}
                        </h3>
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {categories.find((c) => c.value === product.category)
                            ?.label ?? product.category}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-black text-amber-600">
                        €{(product.priceCents / 100).toFixed(2)}
                      </p>
                    </div>
                    {product.description && (
                      <p className="mt-2 line-clamp-2 text-xs text-zinc-500">
                        {product.description}
                      </p>
                    )}

                    <div className="mt-3 flex gap-2 pt-3 border-t border-zinc-100">
                      <button
                        onClick={() => void handleToggleActive(product)}
                        className="flex-1 rounded-lg border border-zinc-200 py-1.5 text-xs font-bold text-zinc-600 transition hover:bg-zinc-50"
                      >
                        {product.active ? "Hide" : "Activate"}
                      </button>
                      <button
                        onClick={() => setModalProduct(product)}
                        className="flex-1 rounded-lg bg-zinc-100 py-1.5 text-xs font-bold text-zinc-700 transition hover:bg-zinc-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(product.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-400 transition hover:bg-red-100"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Product modal */}
      {modalProduct !== null && (
        <ProductModal
          initial={initialForModal}
          onSave={(data) => void handleSave(data)}
          onCancel={() => setModalProduct(null)}
          saving={saving}
          categories={categories}
          onAddCategory={(label) => void handleAddCategory(label)}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={(e) =>
            e.target === e.currentTarget && setDeleteConfirm(null)
          }
        >
          {" "}
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-black text-zinc-900">
              Delete product?
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              This action cannot be undone.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-2xl border border-zinc-200 py-3 text-sm font-bold text-zinc-600 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleDelete(deleteConfirm)}
                className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-bold text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
