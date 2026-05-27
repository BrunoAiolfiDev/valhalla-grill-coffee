import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Order, OrderItem, PaymentMethod } from "@/lib/types";

type CreateOrderInput = {
  customerName: string;
  userId?: string;
  items: OrderItem[];
  totalCents: number;
  deliveryAddress?: string;
  paymentMethod?: PaymentMethod;
  fulfillmentType?: "delivery" | "pickup";
  changeFor?: number;
  deliveryFeeCents?: number;
};

export async function createOrder(input: CreateOrderInput): Promise<string> {
  const ref = await addDoc(collection(db, "pedidos"), {
    customerName: input.customerName,
    userId: input.userId ?? null,
    items: input.items,
    totalCents: input.totalCents,
    paymentStatus: "pending",
    kitchenStatus: "aguardando_pagamento",
    paymentMethod: input.paymentMethod ?? "stripe",
    deliveryAddress: input.deliveryAddress ?? null,
    fulfillmentType: input.fulfillmentType ?? "delivery",
    changeFor: input.changeFor ?? null,
    deliveryFeeCents: input.deliveryFeeCents ?? 0,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

export async function markOrderPaid(orderId: string) {
  await updateDoc(doc(db, "pedidos", orderId), {
    paymentStatus: "paid",
    kitchenStatus: "pago",
  });
}

// Used when customer chooses cash/card on delivery — goes to kitchen but NOT yet paid
export async function markOrderOnDelivery(orderId: string) {
  await updateDoc(doc(db, "pedidos", orderId), {
    paymentStatus: "on_delivery",
    kitchenStatus: "pago",
  });
}

// Called by the delivery person when they actually collect the payment
export async function markPaymentCollected(orderId: string) {
  await updateDoc(doc(db, "pedidos", orderId), {
    paymentStatus: "paid",
  });
}

export async function markKitchenStatus(
  orderId: string,
  kitchenStatus: string,
) {
  await updateDoc(doc(db, "pedidos", orderId), {
    kitchenStatus,
  });
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const snapshot = await getDoc(doc(db, "pedidos", orderId));

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  const createdAt = data.createdAt?.toDate?.();

  return {
    id: snapshot.id,
    customerName: String(data.customerName ?? "Cliente"),
    items: (data.items ?? []) as OrderItem[],
    totalCents: Number(data.totalCents ?? 0),
    paymentStatus: data.paymentStatus ?? "pending",
    paymentMethod: (data.paymentMethod ?? "stripe") as PaymentMethod,
    kitchenStatus: data.kitchenStatus ?? "aguardando_pagamento",
    createdAtLabel: createdAt
      ? createdAt.toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "agora",
  };
}

export function listenPaidOrders(callback: (orders: Order[]) => void) {
  const q = query(collection(db, "pedidos"), orderBy("createdAt", "desc"));

  return onSnapshot(q, (snapshot) => {
    const orders: Order[] = snapshot.docs
      .map((document) => {
        const data = document.data();
        const createdAt = data.createdAt?.toDate?.();

        return {
          id: document.id,
          customerName: String(data.customerName ?? "Cliente"),
          userId: data.userId ?? undefined,
          items: (data.items ?? []) as OrderItem[],
          totalCents: Number(data.totalCents ?? 0),
          paymentStatus: data.paymentStatus ?? "pending",
          paymentMethod: (data.paymentMethod ?? "stripe") as PaymentMethod,
          kitchenStatus: data.kitchenStatus ?? "aguardando_pagamento",
          deliveryAddress: data.deliveryAddress ?? undefined,
          fulfillmentType: (data.fulfillmentType ?? "delivery") as
            | "delivery"
            | "pickup",
          changeFor: data.changeFor ?? undefined,
          deliveryFeeCents: data.deliveryFeeCents ?? 0,
          driverId: data.driverId ?? undefined,
          createdAtLabel: createdAt
            ? createdAt.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "agora",
          createdAtDate: createdAt ?? undefined,
        };
      })
      .filter(
        (order) =>
          order.paymentStatus === "paid" ||
          order.paymentStatus === "on_delivery",
      );

    callback(orders);
  });
}

const SETTINGS_DOC = doc(db, "config", "settings");

export async function getOrdersOpen(): Promise<boolean> {
  const snap = await getDoc(SETTINGS_DOC);
  if (!snap.exists()) return true;
  return snap.data()?.ordersOpen !== false;
}

export async function setOrdersOpen(open: boolean): Promise<void> {
  await setDoc(SETTINGS_DOC, { ordersOpen: open }, { merge: true });
}

export function listenOrdersOpen(callback: (open: boolean) => void) {
  return onSnapshot(SETTINGS_DOC, (snap) => {
    if (!snap.exists()) {
      callback(true);
      return;
    }
    callback(snap.data()?.ordersOpen !== false);
  });
}

export async function setDeliveryFee(cents: number): Promise<void> {
  await setDoc(SETTINGS_DOC, { deliveryFeeCents: cents }, { merge: true });
}

export function listenDeliveryFee(callback: (cents: number) => void) {
  return onSnapshot(SETTINGS_DOC, (snap) => {
    if (!snap.exists()) {
      callback(0);
      return;
    }
    callback(Number(snap.data()?.deliveryFeeCents ?? 0));
  });
}

export async function getDriverPin(): Promise<string | null> {
  const snap = await getDoc(SETTINGS_DOC);
  if (!snap.exists()) return null;
  return snap.data()?.driverPin ? String(snap.data()!.driverPin) : null;
}

export async function setDriverPin(pin: string): Promise<void> {
  await setDoc(SETTINGS_DOC, { driverPin: pin }, { merge: true });
}

export async function getKitchenPin(): Promise<string | null> {
  const snap = await getDoc(SETTINGS_DOC);
  if (!snap.exists()) return null;
  return snap.data()?.kitchenPin ? String(snap.data()!.kitchenPin) : null;
}

export async function setKitchenPin(pin: string): Promise<void> {
  await setDoc(SETTINGS_DOC, { kitchenPin: pin }, { merge: true });
}

// ─── Drivers ─────────────────────────────────────────────────────────────────
export type Driver = { id: string; name: string; pin: string };

export async function getDrivers(): Promise<Driver[]> {
  const snap = await getDoc(SETTINGS_DOC);
  if (!snap.exists() || !snap.data()?.drivers?.length) return [];
  return snap.data()!.drivers as Driver[];
}

export async function setDrivers(drivers: Driver[]): Promise<void> {
  await setDoc(SETTINGS_DOC, { drivers }, { merge: true });
}

export function listenDrivers(callback: (drivers: Driver[]) => void) {
  return onSnapshot(SETTINGS_DOC, (snap) => {
    if (!snap.exists() || !snap.data()?.drivers?.length) {
      callback([]);
      return;
    }
    callback(snap.data()!.drivers as Driver[]);
  });
}

export async function assignOrderToDriver(
  orderId: string,
  driverId: string,
): Promise<void> {
  await updateDoc(doc(db, "pedidos", orderId), { driverId });
}

// ─── Categories ───────────────────────────────────────────────────────────────
export type Category = { value: string; label: string };

export const DEFAULT_CATEGORIES: Category[] = [
  { value: "burgers", label: "🍔 Burgers" },
  { value: "coffee", label: "☕ Coffee" },
  { value: "combos", label: "🎯 Combos" },
  { value: "sides", label: "🍟 Sides" },
];

export async function setCategories(cats: Category[]): Promise<void> {
  await setDoc(SETTINGS_DOC, { categories: cats }, { merge: true });
}

export function listenCategories(callback: (cats: Category[]) => void) {
  return onSnapshot(SETTINGS_DOC, (snap) => {
    if (!snap.exists() || !snap.data()?.categories?.length) {
      callback(DEFAULT_CATEGORIES);
      return;
    }
    callback(snap.data()!.categories as Category[]);
  });
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export async function getAllOrdersForReports(): Promise<Order[]> {
  const q = query(collection(db, "pedidos"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((document) => {
      const data = document.data();
      const createdAt = data.createdAt?.toDate?.();

      return {
        id: document.id,
        customerName: String(data.customerName ?? "Cliente"),
        items: (data.items ?? []) as OrderItem[],
        totalCents: Number(data.totalCents ?? 0),
        paymentStatus: data.paymentStatus ?? "pending",
        paymentMethod: (data.paymentMethod ?? "stripe") as PaymentMethod,
        kitchenStatus: data.kitchenStatus ?? "aguardando_pagamento",
        deliveryAddress: data.deliveryAddress ?? undefined,
        fulfillmentType: (data.fulfillmentType ?? "delivery") as
          | "delivery"
          | "pickup",
        changeFor: data.changeFor ?? undefined,
        deliveryFeeCents: data.deliveryFeeCents ?? 0,
        driverId: data.driverId ?? undefined,
        userId: data.userId ?? undefined,
        createdAtLabel: createdAt
          ? createdAt.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "agora",
        createdAtDate: createdAt ?? undefined,
      } as Order;
    })
    .filter(
      (order) =>
        order.paymentStatus === "paid" || order.paymentStatus === "on_delivery",
    );
}

export function listenOrdersByUserId(
  uid: string,
  callback: (orders: Order[]) => void,
) {
  const q = query(collection(db, "pedidos"), where("userId", "==", uid));

  return onSnapshot(q, (snapshot) => {
    const orders: Order[] = snapshot.docs
      .map((document) => {
        const data = document.data();
        const createdAt = data.createdAt?.toDate?.();
        return {
          id: document.id,
          customerName: String(data.customerName ?? "Cliente"),
          userId: data.userId ?? undefined,
          items: (data.items ?? []) as OrderItem[],
          totalCents: Number(data.totalCents ?? 0),
          paymentStatus: data.paymentStatus ?? "pending",
          paymentMethod: (data.paymentMethod ?? "stripe") as PaymentMethod,
          kitchenStatus: data.kitchenStatus ?? "aguardando_pagamento",
          deliveryAddress: data.deliveryAddress ?? undefined,
          fulfillmentType: (data.fulfillmentType ?? "delivery") as
            | "delivery"
            | "pickup",
          changeFor: data.changeFor ?? undefined,
          deliveryFeeCents: data.deliveryFeeCents ?? 0,
          driverId: data.driverId ?? undefined,
          createdAtLabel: createdAt
            ? createdAt.toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "agora",
          createdAtDate: createdAt ?? undefined,
        } as Order;
      })
      .filter(
        (o) => o.paymentStatus === "paid" || o.paymentStatus === "on_delivery",
      )
      .sort(
        (a, b) =>
          (b.createdAtDate?.getTime() ?? 0) - (a.createdAtDate?.getTime() ?? 0),
      );
    callback(orders);
  });
}
