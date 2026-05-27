"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { getAllOrdersForReports } from "@/lib/orders";
import { getAllProductsAdmin } from "@/lib/adminProducts";
import type { Order, MenuItem } from "@/lib/types";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Period =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "last30"
  | "all"
  | "custom";
type ReportTab =
  | "overview"
  | "products"
  | "stock"
  | "payments"
  | "hourly"
  | "daily"
  | "categories"
  | "fulfillment"
  | "drivers";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function fmtCurrency(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function filterByPeriod(
  orders: Order[],
  period: Period,
  customFrom?: Date,
  customTo?: Date,
): Order[] {
  if (period === "all") return orders;
  if (period === "custom") {
    if (!customFrom && !customTo) return orders;
    return orders.filter((o) => {
      if (!o.createdAtDate) return false;
      if (customFrom && o.createdAtDate < customFrom) return false;
      if (customTo) {
        // include the full end day
        const endOfDay = new Date(customTo.getTime() + 24 * 60 * 60 * 1000);
        if (o.createdAtDate >= endOfDay) return false;
      }
      return true;
    });
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const ms = (days: number) => days * 24 * 60 * 60 * 1000;

  let cutoff: Date;
  let endCutoff: Date | null = null;

  switch (period) {
    case "today":
      cutoff = todayStart;
      break;
    case "yesterday":
      cutoff = new Date(todayStart.getTime() - ms(1));
      endCutoff = todayStart;
      break;
    case "week":
      cutoff = new Date(todayStart.getTime() - ms(6));
      break;
    case "month":
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last30":
      cutoff = new Date(todayStart.getTime() - ms(29));
      break;
    default:
      return orders;
  }

  return orders.filter((o) => {
    if (!o.createdAtDate) return false;
    if (o.createdAtDate < cutoff) return false;
    if (endCutoff && o.createdAtDate >= endCutoff) return false;
    return true;
  });
}

function exportCsv(filename: string, rows: string[][], headers: string[]) {
  const csvContent = [headers, ...rows]
    .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseBrDate(dateStr: string): Date {
  const [d, m, y] = dateStr.split("/").map(Number);
  return new Date(y, m - 1, d);
}

// ─── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  icon,
  color = "amber",
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  color?: "amber" | "emerald" | "blue" | "purple" | "rose";
}) {
  const colors: Record<string, string> = {
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
            {label}
          </p>
          <p className="mt-1 text-2xl font-black text-zinc-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
        </div>
        <span
          className={`ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${colors[color] ?? colors.amber}`}
        >
          {icon}
        </span>
      </div>
    </div>
  );
}

// ─── Horizontal Bar ────────────────────────────────────────────────────────────
function HBar({
  label,
  value,
  max,
  formattedValue,
  sub,
  rank,
  color = "amber",
}: {
  label: string;
  value: number;
  max: number;
  formattedValue: string;
  sub?: string;
  rank?: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const barColors: Record<string, string> = {
    amber: "bg-amber-400",
    emerald: "bg-emerald-400",
    blue: "bg-blue-400",
    purple: "bg-purple-400",
    rose: "bg-rose-400",
  };
  return (
    <div className="flex items-center gap-3 py-2">
      {rank !== undefined && (
        <span className="w-5 shrink-0 text-right text-xs font-bold text-zinc-400">
          {rank}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="max-w-[55%] truncate text-sm font-semibold text-zinc-800">
            {label}
          </span>
          <div className="shrink-0 text-right">
            <span className="text-sm font-black text-zinc-900">
              {formattedValue}
            </span>
            {sub && <span className="ml-2 text-xs text-zinc-400">{sub}</span>}
          </div>
        </div>
        <div className="h-2 w-full rounded-full bg-zinc-100">
          <div
            className={`h-2 rounded-full transition-all ${barColors[color] ?? "bg-amber-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ orders }: { orders: Order[] }) {
  const totalRevenue = orders.reduce((s, o) => s + o.totalCents, 0);
  const deliveryOrders = orders.filter((o) => o.fulfillmentType !== "pickup");
  const pickupOrders = orders.filter((o) => o.fulfillmentType === "pickup");
  const deliveryRevenue = deliveryOrders.reduce((s, o) => s + o.totalCents, 0);
  const pickupRevenue = pickupOrders.reduce((s, o) => s + o.totalCents, 0);
  const avgTicket = orders.length > 0 ? totalRevenue / orders.length : 0;

  const uniqueCustomers = new Set(
    orders.map((o) => o.customerName.toLowerCase().trim()),
  ).size;

  const itemCounts: Record<string, { name: string; qty: number }> = {};
  for (const order of orders) {
    for (const item of order.items) {
      if (!itemCounts[item.name])
        itemCounts[item.name] = { name: item.name, qty: 0 };
      itemCounts[item.name].qty += item.quantity;
    }
  }
  const topItem = Object.values(itemCounts).sort((a, b) => b.qty - a.qty)[0];

  const hourCounts: Record<number, number> = {};
  for (const order of orders) {
    if (!order.createdAtDate) continue;
    const h = order.createdAtDate.getHours();
    hourCounts[h] = (hourCounts[h] ?? 0) + 1;
  }
  const peakEntry = Object.entries(hourCounts).sort(([, a], [, b]) => b - a)[0];

  const onlineOrders = orders.filter((o) => o.paymentMethod === "stripe");
  const cashOrders = orders.filter((o) =>
    ["cash_on_delivery", "card_on_delivery"].includes(o.paymentMethod),
  );
  const onlineRevenue = onlineOrders.reduce((s, o) => s + o.totalCents, 0);
  const cashRevenue = cashOrders.reduce((s, o) => s + o.totalCents, 0);

  const totalItems = Object.values(itemCounts).reduce((s, i) => s + i.qty, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Receita Total"
          value={fmtCurrency(totalRevenue)}
          sub={`${orders.length} pedido${orders.length !== 1 ? "s" : ""}`}
          icon="💰"
          color="amber"
        />
        <KpiCard
          label="Ticket Médio"
          value={fmtCurrency(avgTicket)}
          sub="por pedido"
          icon="🎟️"
          color="blue"
        />
        <KpiCard
          label="Total de Pedidos"
          value={String(orders.length)}
          sub={`${totalItems} itens vendidos`}
          icon="📦"
          color="purple"
        />
        <KpiCard
          label="Clientes Únicos"
          value={String(uniqueCustomers)}
          sub="identificados por nome"
          icon="👤"
          color="emerald"
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Receita Delivery"
          value={fmtCurrency(deliveryRevenue)}
          sub={`${deliveryOrders.length} pedidos`}
          icon="🚗"
          color="rose"
        />
        <KpiCard
          label="Receita Retirada"
          value={fmtCurrency(pickupRevenue)}
          sub={`${pickupOrders.length} pedidos`}
          icon="🛍️"
          color="emerald"
        />
        <KpiCard
          label="Pagamentos Online"
          value={fmtCurrency(onlineRevenue)}
          sub={`${onlineOrders.length} via Stripe`}
          icon="💳"
          color="blue"
        />
        <KpiCard
          label="Pago na Entrega"
          value={fmtCurrency(cashRevenue)}
          sub={`${cashOrders.length} pedidos`}
          icon="💵"
          color="purple"
        />
      </div>

      {(topItem ?? peakEntry) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {topItem && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Item Mais Vendido
              </p>
              <p className="mt-2 truncate text-2xl font-black text-zinc-900">
                {topItem.name}
              </p>
              <p className="text-sm text-zinc-400">
                {topItem.qty} unidade{topItem.qty !== 1 ? "s" : ""} vendida
                {topItem.qty !== 1 ? "s" : ""}
              </p>
            </div>
          )}
          {peakEntry && (
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                Horário de Pico
              </p>
              <p className="mt-2 text-2xl font-black text-zinc-900">
                {String(peakEntry[0]).padStart(2, "0")}:00 –{" "}
                {String(Number(peakEntry[0]) + 1).padStart(2, "0")}:00
              </p>
              <p className="text-sm text-zinc-400">
                {peakEntry[1]} pedido{Number(peakEntry[1]) !== 1 ? "s" : ""}{" "}
                nessa hora
              </p>
            </div>
          )}
        </div>
      )}

      {orders.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-5xl">📊</span>
          <p className="mt-4 text-sm font-semibold text-zinc-400">
            Nenhum pedido no período selecionado.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Best Sellers Tab ─────────────────────────────────────────────────────────
function ProductsTab({ orders }: { orders: Order[] }) {
  type ProductStat = { name: string; qty: number; revenueCents: number };
  const [sortBy, setSortBy] = useState<"qty" | "revenue">("qty");

  const stats: ProductStat[] = useMemo(() => {
    const map: Record<string, ProductStat> = {};
    for (const order of orders) {
      for (const item of order.items) {
        if (!map[item.name])
          map[item.name] = { name: item.name, qty: 0, revenueCents: 0 };
        map[item.name].qty += item.quantity;
        map[item.name].revenueCents += item.quantity * item.unitPriceCents;
      }
    }
    return Object.values(map).sort((a, b) =>
      sortBy === "qty" ? b.qty - a.qty : b.revenueCents - a.revenueCents,
    );
  }, [orders, sortBy]);

  const maxVal =
    sortBy === "qty" ? (stats[0]?.qty ?? 1) : (stats[0]?.revenueCents ?? 1);
  const totalQty = stats.reduce((s, r) => s + r.qty, 0);
  const totalRevenue = stats.reduce((s, r) => s + r.revenueCents, 0);

  function handleExport() {
    exportCsv(
      "best-sellers.csv",
      stats.map((r, i) => [
        String(i + 1),
        r.name,
        String(r.qty),
        (r.revenueCents / 100).toFixed(2),
        ((r.revenueCents / (totalRevenue || 1)) * 100).toFixed(1) + "%",
      ]),
      ["Rank", "Produto", "Qtd Vendida", "Receita (€)", "% Receita"],
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Produtos Mais Vendidos
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {totalQty} itens · {fmtCurrency(totalRevenue)} em produtos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-xl border border-zinc-200 text-xs font-bold">
            <button
              onClick={() => setSortBy("qty")}
              className={`px-3 py-1.5 transition ${sortBy === "qty" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"}`}
            >
              Qtd
            </button>
            <button
              onClick={() => setSortBy("revenue")}
              className={`px-3 py-1.5 transition ${sortBy === "revenue" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"}`}
            >
              Receita
            </button>
          </div>
          <button
            onClick={handleExport}
            className="rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-200"
          >
            ⬇ CSV
          </button>
        </div>
      </div>
      {stats.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">
          Nenhum dado no período.
        </p>
      ) : (
        <div className="divide-y divide-zinc-50">
          {stats.map((item, idx) => (
            <HBar
              key={item.name}
              rank={idx + 1}
              label={item.name}
              value={sortBy === "qty" ? item.qty : item.revenueCents}
              max={maxVal}
              formattedValue={
                sortBy === "qty"
                  ? `${item.qty}×`
                  : fmtCurrency(item.revenueCents)
              }
              sub={
                sortBy === "qty"
                  ? fmtCurrency(item.revenueCents)
                  : `${item.qty}×`
              }
              color="amber"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stock Control Tab ────────────────────────────────────────────────────────
function StockTab({ orders }: { orders: Order[] }) {
  type StockItem = {
    name: string;
    qtySold: number;
    revenueCents: number;
    extras: Record<string, number>;
    removed: Record<string, number>;
  };

  const stats: StockItem[] = useMemo(() => {
    const map: Record<string, StockItem> = {};
    for (const order of orders) {
      for (const item of order.items) {
        if (!map[item.name])
          map[item.name] = {
            name: item.name,
            qtySold: 0,
            revenueCents: 0,
            extras: {},
            removed: {},
          };
        map[item.name].qtySold += item.quantity;
        map[item.name].revenueCents += item.quantity * item.unitPriceCents;
        for (const extra of item.addedExtras ?? []) {
          map[item.name].extras[extra.name] =
            (map[item.name].extras[extra.name] ?? 0) + item.quantity;
        }
        for (const ing of item.removedIngredients ?? []) {
          map[item.name].removed[ing] =
            (map[item.name].removed[ing] ?? 0) + item.quantity;
        }
      }
    }
    return Object.values(map).sort((a, b) => b.qtySold - a.qtySold);
  }, [orders]);

  function handleExport() {
    exportCsv(
      "controle-estoque.csv",
      stats.map((s) => [
        s.name,
        String(s.qtySold),
        (s.revenueCents / 100).toFixed(2),
        Object.entries(s.extras)
          .sort(([, a], [, b]) => b - a)
          .map(([n, q]) => `${n}×${q}`)
          .join("; "),
        Object.entries(s.removed)
          .sort(([, a], [, b]) => b - a)
          .map(([n, q]) => `${n}×${q}`)
          .join("; "),
      ]),
      [
        "Produto",
        "Qtd Vendida",
        "Receita (€)",
        "Extras Adicionados",
        "Ingredientes Removidos",
      ],
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Controle de Estoque
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Itens consumidos no período — com extras e remoções
          </p>
        </div>
        <button
          onClick={handleExport}
          className="rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-200"
        >
          ⬇ CSV
        </button>
      </div>

      {stats.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">
          Nenhum dado no período.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="pb-2 text-left text-xs font-bold text-zinc-400">
                  #
                </th>
                <th className="pb-2 text-left text-xs font-bold text-zinc-400">
                  Produto
                </th>
                <th className="pb-2 text-right text-xs font-bold text-zinc-400">
                  Qtd
                </th>
                <th className="pb-2 text-right text-xs font-bold text-zinc-400">
                  Receita
                </th>
                <th className="pb-2 text-left text-xs font-bold text-zinc-400">
                  Extras
                </th>
                <th className="pb-2 text-left text-xs font-bold text-zinc-400">
                  Removidos
                </th>
              </tr>
            </thead>
            <tbody>
              {stats.map((item, idx) => (
                <tr key={item.name} className="border-b border-zinc-50">
                  <td className="py-2 text-xs text-zinc-400">{idx + 1}</td>
                  <td className="py-2 font-semibold text-zinc-800">
                    {item.name}
                  </td>
                  <td className="py-2 text-right font-black text-zinc-900">
                    {item.qtySold}
                  </td>
                  <td className="py-2 text-right font-bold text-zinc-700">
                    {fmtCurrency(item.revenueCents)}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(item.extras)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 4)
                        .map(([name, qty]) => (
                          <span
                            key={name}
                            className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700"
                          >
                            {name} ×{qty}
                          </span>
                        ))}
                    </div>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(item.removed)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 4)
                        .map(([name, qty]) => (
                          <span
                            key={name}
                            className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-600"
                          >
                            -{name} ×{qty}
                          </span>
                        ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td />
                <td className="pt-3 text-xs font-bold text-zinc-400">Total</td>
                <td className="pt-3 text-right text-xs font-black text-zinc-900">
                  {stats.reduce((s, r) => s + r.qtySold, 0)}
                </td>
                <td className="pt-3 text-right text-xs font-black text-amber-600">
                  {fmtCurrency(stats.reduce((s, r) => s + r.revenueCents, 0))}
                </td>
                <td />
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────
function PaymentsTab({ orders }: { orders: Order[] }) {
  const methods = [
    { key: "stripe", label: "Online (Stripe)", icon: "💳", color: "blue" },
    {
      key: "cash_on_delivery",
      label: "Dinheiro na Entrega",
      icon: "💵",
      color: "emerald",
    },
    {
      key: "card_on_delivery",
      label: "Cartão na Entrega",
      icon: "🏦",
      color: "purple",
    },
  ] as const;

  const byMethod = methods.map((m) => {
    const filtered = orders.filter((o) => o.paymentMethod === m.key);
    return {
      ...m,
      count: filtered.length,
      total: filtered.reduce((s, o) => s + o.totalCents, 0),
    };
  });

  const maxTotal = Math.max(...byMethod.map((m) => m.total), 1);
  const totalRevenue = orders.reduce((s, o) => s + o.totalCents, 0);
  const totalOrders = orders.length;

  // Entries by day
  const dayMap: Record<string, Record<string, number>> = {};
  for (const order of orders) {
    if (!order.createdAtDate) continue;
    const day = order.createdAtDate.toLocaleDateString("pt-BR");
    if (!dayMap[day]) dayMap[day] = {};
    dayMap[day][order.paymentMethod] =
      (dayMap[day][order.paymentMethod] ?? 0) + order.totalCents;
  }
  const days = Object.keys(dayMap).sort(
    (a, b) => parseBrDate(a).getTime() - parseBrDate(b).getTime(),
  );

  function handleExport() {
    exportCsv(
      "pagamentos.csv",
      orders.map((o) => [
        o.id,
        o.customerName,
        o.createdAtDate?.toLocaleDateString("pt-BR") ?? "",
        o.createdAtDate?.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }) ?? "",
        o.paymentMethod,
        o.paymentStatus,
        (o.totalCents / 100).toFixed(2),
        o.fulfillmentType ?? "",
      ]),
      [
        "ID",
        "Cliente",
        "Data",
        "Hora",
        "Método",
        "Status",
        "Total (€)",
        "Tipo",
      ],
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Por Método de Pagamento
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {totalOrders} pedidos · {fmtCurrency(totalRevenue)} total
            </p>
          </div>
          <button
            onClick={handleExport}
            className="rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-200"
          >
            ⬇ CSV
          </button>
        </div>
        <div className="space-y-1">
          {byMethod.map((m) => (
            <HBar
              key={m.key}
              label={`${m.icon} ${m.label}`}
              value={m.total}
              max={maxTotal}
              formattedValue={fmtCurrency(m.total)}
              sub={`${m.count} pedido${m.count !== 1 ? "s" : ""} · ${totalRevenue > 0 ? ((m.total / totalRevenue) * 100).toFixed(1) : "0"}%`}
              color={m.color}
            />
          ))}
        </div>
      </div>

      {days.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
            Entradas por Dia
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="pb-2 text-left text-xs font-bold text-zinc-400">
                    Data
                  </th>
                  <th className="pb-2 text-right text-xs font-bold text-zinc-400">
                    Online
                  </th>
                  <th className="pb-2 text-right text-xs font-bold text-zinc-400">
                    Dinheiro
                  </th>
                  <th className="pb-2 text-right text-xs font-bold text-zinc-400">
                    Cartão
                  </th>
                  <th className="pb-2 text-right text-xs font-bold text-zinc-400">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...days].reverse().map((day) => {
                  const totals = dayMap[day];
                  const dayTotal = Object.values(totals).reduce(
                    (s, v) => s + v,
                    0,
                  );
                  return (
                    <tr key={day} className="border-b border-zinc-50">
                      <td className="py-2 font-semibold text-zinc-700">
                        {day}
                      </td>
                      <td className="py-2 text-right text-zinc-600">
                        {fmtCurrency(totals["stripe"] ?? 0)}
                      </td>
                      <td className="py-2 text-right text-zinc-600">
                        {fmtCurrency(totals["cash_on_delivery"] ?? 0)}
                      </td>
                      <td className="py-2 text-right text-zinc-600">
                        {fmtCurrency(totals["card_on_delivery"] ?? 0)}
                      </td>
                      <td className="py-2 text-right font-black text-zinc-900">
                        {fmtCurrency(dayTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-3 text-xs font-bold text-zinc-400">
                    Total
                  </td>
                  {(
                    ["stripe", "cash_on_delivery", "card_on_delivery"] as const
                  ).map((key) => (
                    <td
                      key={key}
                      className="pt-3 text-right text-xs font-bold text-zinc-600"
                    >
                      {fmtCurrency(
                        orders
                          .filter((o) => o.paymentMethod === key)
                          .reduce((s, o) => s + o.totalCents, 0),
                      )}
                    </td>
                  ))}
                  <td className="pt-3 text-right text-xs font-black text-amber-600">
                    {fmtCurrency(totalRevenue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Peak Hours Tab ───────────────────────────────────────────────────────────
function HourlyTab({ orders }: { orders: Order[] }) {
  const hourData = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      count: 0,
      revenue: 0,
    }));
    for (const order of orders) {
      if (!order.createdAtDate) continue;
      const h = order.createdAtDate.getHours();
      counts[h].count += 1;
      counts[h].revenue += order.totalCents;
    }
    return counts;
  }, [orders]);

  const maxCount = Math.max(...hourData.map((h) => h.count), 1);
  const peakHour = hourData.reduce(
    (max, h) => (h.count > max.count ? h : max),
    hourData[0],
  );
  const hasEarlyData = hourData.slice(0, 6).some((h) => h.count > 0);
  const displayHours = hasEarlyData ? hourData : hourData.slice(6);

  function handleExport() {
    exportCsv(
      "pedidos-por-hora.csv",
      hourData.map((h) => [
        `${String(h.hour).padStart(2, "0")}:00`,
        String(h.count),
        (h.revenue / 100).toFixed(2),
      ]),
      ["Hora", "Pedidos", "Receita (€)"],
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Pedidos por Hora do Dia
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Pico: {String(peakHour.hour).padStart(2, "0")}:00 com{" "}
            {peakHour.count} pedido{peakHour.count !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={handleExport}
          className="rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-200"
        >
          ⬇ CSV
        </button>
      </div>
      <div className="flex h-44 items-end gap-0.5 overflow-x-auto">
        {displayHours.map((h) => {
          const pct = maxCount > 0 ? (h.count / maxCount) * 100 : 0;
          const isPeak = h.hour === peakHour.hour && h.count > 0;
          return (
            <div
              key={h.hour}
              className="flex min-w-6 flex-1 flex-col items-center gap-1"
              title={`${String(h.hour).padStart(2, "0")}:00 — ${h.count} pedidos · ${fmtCurrency(h.revenue)}`}
            >
              {h.count > 0 && (
                <span className="text-[9px] font-bold text-zinc-400">
                  {h.count}
                </span>
              )}
              <div className="flex w-full flex-1 flex-col justify-end">
                <div
                  className={`w-full rounded-t transition-all ${isPeak ? "bg-amber-400" : "bg-zinc-200"}`}
                  style={{
                    height: `${Math.max(pct, h.count > 0 ? 4 : 0)}%`,
                  }}
                />
              </div>
              <span className="text-[9px] text-zinc-400">
                {String(h.hour).padStart(2, "0")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Daily Trend Tab ──────────────────────────────────────────────────────────
function DailyTab({ orders }: { orders: Order[] }) {
  type DayStat = { date: string; count: number; revenue: number };

  const dayStats: DayStat[] = useMemo(() => {
    const map: Record<string, DayStat> = {};
    for (const order of orders) {
      if (!order.createdAtDate) continue;
      const date = order.createdAtDate.toLocaleDateString("pt-BR");
      if (!map[date]) map[date] = { date, count: 0, revenue: 0 };
      map[date].count += 1;
      map[date].revenue += order.totalCents;
    }
    return Object.values(map).sort(
      (a, b) => parseBrDate(a.date).getTime() - parseBrDate(b.date).getTime(),
    );
  }, [orders]);

  const maxRevenue = Math.max(...dayStats.map((d) => d.revenue), 1);
  const totalRevenue = dayStats.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = dayStats.reduce((s, d) => s + d.count, 0);

  function handleExport() {
    exportCsv(
      "receita-diaria.csv",
      dayStats.map((d) => [
        d.date,
        String(d.count),
        (d.revenue / 100).toFixed(2),
        (d.count > 0 ? d.revenue / d.count / 100 : 0).toFixed(2),
      ]),
      ["Data", "Pedidos", "Receita (€)", "Ticket Médio (€)"],
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Receita por Dia
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">
              {dayStats.length} dia{dayStats.length !== 1 ? "s" : ""} ·{" "}
              {fmtCurrency(totalRevenue)} total
            </p>
          </div>
          <button
            onClick={handleExport}
            className="rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-200"
          >
            ⬇ CSV
          </button>
        </div>
        {dayStats.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-400">
            Nenhum dado no período.
          </p>
        ) : (
          <div className="flex h-44 items-end gap-1 overflow-x-auto pb-1">
            {dayStats.map((d) => {
              const pct = (d.revenue / maxRevenue) * 100;
              return (
                <div
                  key={d.date}
                  className="flex min-w-10 flex-1 flex-col items-center gap-1"
                  title={`${d.date}: ${d.count} pedidos · ${fmtCurrency(d.revenue)}`}
                >
                  <span className="whitespace-nowrap text-[9px] font-bold text-zinc-400">
                    {fmtCurrency(d.revenue)}
                  </span>
                  <div className="flex w-full flex-1 flex-col justify-end">
                    <div
                      className="w-full rounded-t bg-amber-400 transition-all"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-zinc-400">
                    {d.date.substring(0, 5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {dayStats.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">
            Detalhes por Dia
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100">
                <th className="pb-2 text-left text-xs font-bold text-zinc-400">
                  Data
                </th>
                <th className="pb-2 text-right text-xs font-bold text-zinc-400">
                  Pedidos
                </th>
                <th className="pb-2 text-right text-xs font-bold text-zinc-400">
                  Receita
                </th>
                <th className="pb-2 text-right text-xs font-bold text-zinc-400">
                  Ticket Médio
                </th>
              </tr>
            </thead>
            <tbody>
              {[...dayStats].reverse().map((d) => (
                <tr key={d.date} className="border-b border-zinc-50">
                  <td className="py-2 font-semibold text-zinc-700">{d.date}</td>
                  <td className="py-2 text-right text-zinc-600">{d.count}</td>
                  <td className="py-2 text-right font-bold text-zinc-900">
                    {fmtCurrency(d.revenue)}
                  </td>
                  <td className="py-2 text-right text-zinc-500">
                    {fmtCurrency(d.count > 0 ? d.revenue / d.count : 0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 text-xs font-bold text-zinc-400">Total</td>
                <td className="pt-3 text-right text-xs font-bold text-zinc-600">
                  {totalOrders}
                </td>
                <td className="pt-3 text-right text-xs font-black text-amber-600">
                  {fmtCurrency(totalRevenue)}
                </td>
                <td className="pt-3 text-right text-xs font-bold text-zinc-500">
                  {fmtCurrency(
                    totalOrders > 0 ? totalRevenue / totalOrders : 0,
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Categories Tab ────────────────────────────────────────────────────────────
function CategoriesTab({
  orders,
  products,
}: {
  orders: Order[];
  products: MenuItem[];
}) {
  type CatStat = { category: string; qty: number; revenueCents: number };
  const [sortBy, setSortBy] = useState<"qty" | "revenue">("revenue");

  const stats: CatStat[] = useMemo(() => {
    const prodToCategory: Record<string, string> = {};
    for (const p of products) prodToCategory[p.id] = p.category;

    const map: Record<string, CatStat> = {};
    for (const order of orders) {
      for (const item of order.items) {
        const cat = prodToCategory[item.id] ?? "Outros";
        if (!map[cat]) map[cat] = { category: cat, qty: 0, revenueCents: 0 };
        map[cat].qty += item.quantity;
        map[cat].revenueCents += item.quantity * item.unitPriceCents;
      }
    }
    return Object.values(map).sort((a, b) =>
      sortBy === "qty" ? b.qty - a.qty : b.revenueCents - a.revenueCents,
    );
  }, [orders, products, sortBy]);

  const maxVal =
    sortBy === "qty" ? (stats[0]?.qty ?? 1) : (stats[0]?.revenueCents ?? 1);
  const totalRevenue = stats.reduce((s, r) => s + r.revenueCents, 0);
  const totalQty = stats.reduce((s, r) => s + r.qty, 0);

  function handleExport() {
    exportCsv(
      "por-categoria.csv",
      stats.map((s) => [
        s.category,
        String(s.qty),
        (s.revenueCents / 100).toFixed(2),
        ((s.revenueCents / (totalRevenue || 1)) * 100).toFixed(1) + "%",
      ]),
      ["Categoria", "Qtd Itens", "Receita (€)", "% Receita"],
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Receita por Categoria
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {totalQty} itens · {fmtCurrency(totalRevenue)} em produtos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-xl border border-zinc-200 text-xs font-bold">
            <button
              onClick={() => setSortBy("qty")}
              className={`px-3 py-1.5 transition ${sortBy === "qty" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"}`}
            >
              Qtd
            </button>
            <button
              onClick={() => setSortBy("revenue")}
              className={`px-3 py-1.5 transition ${sortBy === "revenue" ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"}`}
            >
              Receita
            </button>
          </div>
          <button
            onClick={handleExport}
            className="rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-200"
          >
            ⬇ CSV
          </button>
        </div>
      </div>
      {stats.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">
          Nenhum dado no período.
        </p>
      ) : (
        <div className="divide-y divide-zinc-50">
          {stats.map((item, idx) => (
            <HBar
              key={item.category}
              rank={idx + 1}
              label={item.category}
              value={sortBy === "qty" ? item.qty : item.revenueCents}
              max={maxVal}
              formattedValue={
                sortBy === "qty"
                  ? `${item.qty}×`
                  : fmtCurrency(item.revenueCents)
              }
              sub={
                sortBy === "qty"
                  ? fmtCurrency(item.revenueCents)
                  : `${item.qty}× · ${((item.revenueCents / (totalRevenue || 1)) * 100).toFixed(1)}%`
              }
              color="purple"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Fulfillment Tab ──────────────────────────────────────────────────────────
function FulfillmentTab({ orders }: { orders: Order[] }) {
  const delivery = orders.filter((o) => o.fulfillmentType !== "pickup");
  const pickup = orders.filter((o) => o.fulfillmentType === "pickup");
  const deliveryRevenue = delivery.reduce((s, o) => s + o.totalCents, 0);
  const pickupRevenue = pickup.reduce((s, o) => s + o.totalCents, 0);
  const totalRevenue = deliveryRevenue + pickupRevenue;
  const maxRevenue = Math.max(deliveryRevenue, pickupRevenue, 1);
  const totalDeliveryFee = delivery.reduce(
    (s, o) => s + (o.deliveryFeeCents ?? 0),
    0,
  );
  const avgDelivery =
    delivery.length > 0 ? deliveryRevenue / delivery.length : 0;
  const avgPickup = pickup.length > 0 ? pickupRevenue / pickup.length : 0;

  function handleExport() {
    exportCsv(
      "modalidade-entrega.csv",
      [
        ...delivery.map((o) => [
          "delivery",
          o.id,
          o.customerName,
          o.createdAtDate?.toLocaleDateString("pt-BR") ?? "",
          (o.totalCents / 100).toFixed(2),
          ((o.deliveryFeeCents ?? 0) / 100).toFixed(2),
        ]),
        ...pickup.map((o) => [
          "pickup",
          o.id,
          o.customerName,
          o.createdAtDate?.toLocaleDateString("pt-BR") ?? "",
          (o.totalCents / 100).toFixed(2),
          "0.00",
        ]),
      ],
      ["Tipo", "ID", "Cliente", "Data", "Total (€)", "Taxa Entrega (€)"],
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Pedidos Delivery"
          value={String(delivery.length)}
          sub={fmtCurrency(deliveryRevenue)}
          icon="🚗"
          color="rose"
        />
        <KpiCard
          label="Pedidos Retirada"
          value={String(pickup.length)}
          sub={fmtCurrency(pickupRevenue)}
          icon="🛍️"
          color="emerald"
        />
        <KpiCard
          label="Ticket Médio Delivery"
          value={fmtCurrency(avgDelivery)}
          sub={`vs ${fmtCurrency(avgPickup)} retirada`}
          icon="📊"
          color="blue"
        />
        <KpiCard
          label="Taxa de Entrega Total"
          value={fmtCurrency(totalDeliveryFee)}
          sub={`de ${delivery.length} entregas`}
          icon="🏷️"
          color="amber"
        />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Receita por Modalidade
          </p>
          <button
            onClick={handleExport}
            className="rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-200"
          >
            ⬇ CSV
          </button>
        </div>
        <div className="space-y-1">
          <HBar
            label="🚗 Delivery"
            value={deliveryRevenue}
            max={maxRevenue}
            formattedValue={fmtCurrency(deliveryRevenue)}
            sub={`${delivery.length} pedidos · ${totalRevenue > 0 ? ((deliveryRevenue / totalRevenue) * 100).toFixed(1) : "0"}%`}
            color="rose"
          />
          <HBar
            label="🛍️ Retirada (Pickup)"
            value={pickupRevenue}
            max={maxRevenue}
            formattedValue={fmtCurrency(pickupRevenue)}
            sub={`${pickup.length} pedidos · ${totalRevenue > 0 ? ((pickupRevenue / totalRevenue) * 100).toFixed(1) : "0"}%`}
            color="emerald"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Drivers Tab ──────────────────────────────────────────────────────────────
function DriversTab({ orders }: { orders: Order[] }) {
  type DriverStat = {
    id: string;
    name: string;
    count: number;
    revenue: number;
    delivered: number;
  };

  const stats: DriverStat[] = useMemo(() => {
    const map: Record<string, DriverStat> = {};
    for (const order of orders) {
      if (!order.driverId) continue;
      if (!map[order.driverId])
        map[order.driverId] = {
          id: order.driverId,
          name: order.driverId,
          count: 0,
          revenue: 0,
          delivered: 0,
        };
      map[order.driverId].count += 1;
      map[order.driverId].revenue += order.totalCents;
      if (order.kitchenStatus === "entregue")
        map[order.driverId].delivered += 1;
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const maxRevenue = Math.max(...stats.map((s) => s.revenue), 1);
  const totalRevenue = stats.reduce((s, r) => s + r.revenue, 0);

  function handleExport() {
    exportCsv(
      "drivers.csv",
      stats.map((s) => [
        s.name,
        String(s.count),
        String(s.delivered),
        (s.revenue / 100).toFixed(2),
        (s.count > 0 ? s.revenue / s.count / 100 : 0).toFixed(2),
      ]),
      [
        "Driver",
        "Total Pedidos",
        "Entregues",
        "Receita (€)",
        "Ticket Médio (€)",
      ],
    );
  }

  if (stats.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <p className="py-12 text-center text-sm text-zinc-400">
          Nenhum pedido atribuído a drivers no período.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Drivers ativos"
          value={String(stats.length)}
          sub="no período"
          icon="🚗"
          color="amber"
        />
        <KpiCard
          label="Total Entregues"
          value={String(stats.reduce((s, d) => s + d.delivered, 0))}
          sub={`de ${stats.reduce((s, d) => s + d.count, 0)} atribuídos`}
          icon="✅"
          color="emerald"
        />
        <KpiCard
          label="Receita Entregue"
          value={fmtCurrency(totalRevenue)}
          sub="via drivers"
          icon="💰"
          color="blue"
        />
        <KpiCard
          label="Ticket Médio"
          value={fmtCurrency(
            stats.reduce((s, d) => s + d.count, 0) > 0
              ? totalRevenue / stats.reduce((s, d) => s + d.count, 0)
              : 0,
          )}
          sub="por pedido"
          icon="🎟️"
          color="purple"
        />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Desempenho por Driver
          </p>
          <button
            onClick={handleExport}
            className="rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600 hover:bg-zinc-200"
          >
            ⬇ CSV
          </button>
        </div>
        <div className="divide-y divide-zinc-50">
          {stats.map((drv, idx) => (
            <HBar
              key={drv.id}
              rank={idx + 1}
              label={`🚗 ${drv.name}`}
              value={drv.revenue}
              max={maxRevenue}
              formattedValue={fmtCurrency(drv.revenue)}
              sub={`${drv.count} pedidos · ${drv.delivered} entregues`}
              color="amber"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function RelatoriosPage() {
  const router = useRouter();
  const [adminReady, setAdminReady] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [activeTab, setActiveTab] = useState<ReportTab>("overview");

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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersData, productsData] = await Promise.all([
        getAllOrdersForReports(),
        getAllProductsAdmin(),
      ]);
      setOrders(ordersData);
      setProducts(productsData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminReady) void loadData();
  }, [adminReady, loadData]);

  const customFromDate = useMemo(
    () =>
      customFrom ? startOfDay(new Date(customFrom + "T00:00:00")) : undefined,
    [customFrom],
  );
  const customToDate = useMemo(
    () => (customTo ? startOfDay(new Date(customTo + "T00:00:00")) : undefined),
    [customTo],
  );

  const filteredOrders = useMemo(
    () => filterByPeriod(orders, period, customFromDate, customToDate),
    [orders, period, customFromDate, customToDate],
  );

  const PERIODS: { key: Period; label: string }[] = [
    { key: "today", label: "Hoje" },
    { key: "yesterday", label: "Ontem" },
    { key: "week", label: "7 dias" },
    { key: "month", label: "Este mês" },
    { key: "last30", label: "30 dias" },
    { key: "all", label: "Tudo" },
    { key: "custom", label: "Personalizado" },
  ];

  const TABS: { key: ReportTab; label: string; icon: string }[] = [
    { key: "overview", label: "Visão Geral", icon: "📊" },
    { key: "products", label: "Best Sellers", icon: "🏆" },
    { key: "stock", label: "Estoque", icon: "📦" },
    { key: "payments", label: "Pagamentos", icon: "💳" },
    { key: "hourly", label: "Por Hora", icon: "⏰" },
    { key: "daily", label: "Diário", icon: "📅" },
    { key: "categories", label: "Categorias", icon: "🏷️" },
    { key: "fulfillment", label: "Modalidade", icon: "🚗" },
    { key: "drivers", label: "Drivers", icon: "👤" },
  ];

  return (
    <main className="min-h-screen bg-zinc-50 font-sans text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
              Admin Panel
            </p>
            <h1 className="text-2xl font-black text-zinc-900">Relatórios</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadData()}
              disabled={loading}
              className="rounded-xl bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-600 transition hover:bg-zinc-200 disabled:opacity-50"
              title="Recarregar dados"
            >
              {loading ? "⏳" : "🔄"}
            </button>
            <Link
              href="/admin"
              className="rounded-xl bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-600 transition hover:bg-zinc-200"
            >
              ← Admin
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        {/* Period selector */}
        <div className="mb-5 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-zinc-400">Período:</span>
            <div className="flex flex-wrap gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    period === p.key
                      ? "bg-zinc-900 text-white"
                      : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {!loading && (
              <span className="ml-auto text-xs text-zinc-400">
                {filteredOrders.length} pedido
                {filteredOrders.length !== 1 ? "s" : ""} no período
              </span>
            )}
          </div>

          {/* Custom date range */}
          {period === "custom" && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <span className="text-xs font-bold text-amber-700">De:</span>
              <input
                type="date"
                value={customFrom}
                max={customTo || undefined}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
              <span className="text-xs font-bold text-amber-700">Até:</span>
              <input
                type="date"
                value={customTo}
                min={customFrom || undefined}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              />
              {(customFrom || customTo) && (
                <button
                  onClick={() => {
                    setCustomFrom("");
                    setCustomTo("");
                  }}
                  className="ml-1 rounded-lg border border-amber-300 px-2 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100"
                >
                  Limpar
                </button>
              )}
              {customFrom && customTo && (
                <span className="ml-auto text-xs text-amber-700">
                  {new Date(customFrom + "T00:00:00").toLocaleDateString(
                    "pt-BR",
                  )}{" "}
                  →{" "}
                  {new Date(customTo + "T00:00:00").toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <div className="mb-6 flex gap-1 overflow-x-auto pb-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                activeTab === tab.key
                  ? "bg-amber-500 text-zinc-900"
                  : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-400"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            <p className="mt-4 text-sm font-semibold text-zinc-400">
              Carregando dados...
            </p>
          </div>
        ) : (
          <>
            {activeTab === "overview" && (
              <OverviewTab orders={filteredOrders} />
            )}
            {activeTab === "products" && (
              <ProductsTab orders={filteredOrders} />
            )}
            {activeTab === "stock" && <StockTab orders={filteredOrders} />}
            {activeTab === "payments" && (
              <PaymentsTab orders={filteredOrders} />
            )}
            {activeTab === "hourly" && <HourlyTab orders={filteredOrders} />}
            {activeTab === "daily" && <DailyTab orders={filteredOrders} />}
            {activeTab === "categories" && (
              <CategoriesTab orders={filteredOrders} products={products} />
            )}
            {activeTab === "fulfillment" && (
              <FulfillmentTab orders={filteredOrders} />
            )}
            {activeTab === "drivers" && <DriversTab orders={filteredOrders} />}
          </>
        )}
      </div>
    </main>
  );
}
