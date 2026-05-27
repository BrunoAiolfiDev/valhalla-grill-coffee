export type MenuCategory = string;

export type MenuExtra = {
  id: string;
  name: string;
  priceCents: number;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: MenuCategory;
  priceCents: number;
  active: boolean;
  imageUrl?: string;
  ingredients?: string[];
  extras?: MenuExtra[];
};

export type OrderItem = {
  id: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  removedIngredients?: string[];
  addedExtras?: MenuExtra[];
};

export type PaymentStatus = "pending" | "paid" | "on_delivery" | "failed";

export type PaymentMethod = "stripe" | "cash_on_delivery" | "card_on_delivery";

export type KitchenStatus =
  | "aguardando_pagamento"
  | "pago"
  | "em_preparo"
  | "pronto"
  | "entregue";

export type Order = {
  id: string;
  customerName: string;
  userId?: string;
  items: OrderItem[];
  totalCents: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  kitchenStatus: KitchenStatus;
  createdAtLabel: string;
  createdAtDate?: Date;
  deliveryAddress?: string;
  fulfillmentType?: "delivery" | "pickup";
  changeFor?: number;
  deliveryFeeCents?: number;
  driverId?: string;
};
