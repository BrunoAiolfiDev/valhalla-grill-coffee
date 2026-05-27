import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { MenuItem } from "@/lib/types";

export const fallbackMenu: MenuItem[] = [
  {
    id: "classic-burger",
    name: "Valhalla Classic Burger",
    description: "Pão brioche, hambúrguer 180g, cheddar e molho da casa.",
    category: "burgers",
    priceCents: 1190,
    active: true,
    imageUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
    ingredients: ["Pão brioche", "Hambúrguer 180g", "Cheddar", "Molho da casa"],
    extras: [
      { id: "extra-bacon", name: "Bacon crocante", priceCents: 150 },
      { id: "extra-queijo", name: "Queijo extra", priceCents: 100 },
      { id: "extra-ovo", name: "Ovo frito", priceCents: 120 },
    ],
  },
  {
    id: "smoke-burger",
    name: "Ragnar Smoke Burger",
    description: "Hambúrguer 180g, bacon crocante, cebola caramelizada e BBQ.",
    category: "burgers",
    priceCents: 1390,
    active: true,
    imageUrl:
      "https://images.unsplash.com/photo-1553979459-d2229ba7433b?w=600&q=80",
    ingredients: [
      "Pão brioche",
      "Hambúrguer 180g",
      "Bacon crocante",
      "Cebola caramelizada",
      "Molho BBQ",
    ],
    extras: [
      { id: "extra-queijo", name: "Queijo extra", priceCents: 100 },
      { id: "extra-ovo", name: "Ovo frito", priceCents: 120 },
    ],
  },
  {
    id: "latte",
    name: "Freya Latte",
    description: "Café especial com leite vaporizado.",
    category: "coffee",
    priceCents: 520,
    active: true,
    imageUrl:
      "https://images.unsplash.com/photo-1561047029-3000c68339ca?w=600&q=80",
    extras: [
      { id: "extra-shot", name: "Shot extra de café", priceCents: 80 },
      { id: "extra-baunilha", name: "Calda de baunilha", priceCents: 50 },
      { id: "extra-oat", name: "Leite de aveia", priceCents: 60 },
    ],
  },
  {
    id: "americano",
    name: "Odin Americano",
    description: "Café preto forte e aromático.",
    category: "coffee",
    priceCents: 390,
    active: true,
    imageUrl:
      "https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=600&q=80",
    extras: [{ id: "extra-shot", name: "Shot extra de café", priceCents: 80 }],
  },
  {
    id: "batata-frita",
    name: "Batata Frita Nórdica",
    description: "Batata crocante com sal temperado e molho viking.",
    category: "sides",
    priceCents: 490,
    active: true,
    imageUrl:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&q=80",
    extras: [{ id: "extra-molho", name: "Molho extra", priceCents: 50 }],
  },
  {
    id: "combo-warrior",
    name: "Combo Guerreiro",
    description: "Classic Burger + Batata Nórdica + Americano.",
    category: "combos",
    priceCents: 1790,
    active: true,
    imageUrl:
      "https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=600&q=80",
    ingredients: [
      "Pão brioche",
      "Hambúrguer 180g",
      "Cheddar",
      "Molho da casa",
      "Batata frita",
      "Americano",
    ],
    extras: [{ id: "extra-bacon", name: "Bacon no burger", priceCents: 150 }],
  },
];

export async function getMenuItems(): Promise<MenuItem[]> {
  try {
    const q = query(collection(db, "cardapio"), where("active", "==", true));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return fallbackMenu;
    }

    return snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        name: String(data.name ?? "Item sem nome"),
        description: String(data.description ?? ""),
        category: (data.category ?? "sides") as MenuItem["category"],
        priceCents: Number(data.priceCents ?? 0),
        active: Boolean(data.active ?? false),
        imageUrl: data.imageUrl ? String(data.imageUrl) : undefined,
        ingredients: Array.isArray(data.ingredients)
          ? (data.ingredients as string[])
          : undefined,
        extras: Array.isArray(data.extras)
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (data.extras as any[]).map((e) => ({
              id: String(e.id),
              name: String(e.name),
              priceCents: Number(e.priceCents ?? 0),
            }))
          : undefined,
      };
    });
  } catch {
    return fallbackMenu;
  }
}

export function formatEuroFromCents(value: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
  }).format(value / 100);
}
