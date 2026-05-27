import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { MenuItem, MenuExtra, MenuCategory } from "@/lib/types";

export type ProductPayload = {
  name: string;
  description: string;
  category: MenuCategory;
  priceCents: number;
  imageUrl: string;
  active: boolean;
  ingredients: string[];
  extras: MenuExtra[];
};

export async function getAllProductsAdmin(): Promise<MenuItem[]> {
  const snap = await getDocs(collection(db, "cardapio"));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: String(data.name ?? ""),
      description: String(data.description ?? ""),
      category: (data.category ?? "burgers") as MenuCategory,
      priceCents: Number(data.priceCents ?? 0),
      imageUrl: String(data.imageUrl ?? ""),
      active: data.active !== false,
      ingredients: (data.ingredients ?? []) as string[],
      extras: (data.extras ?? []) as MenuExtra[],
    };
  });
}

export async function addProduct(payload: ProductPayload): Promise<string> {
  const ref = await addDoc(collection(db, "cardapio"), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(
  id: string,
  payload: Partial<ProductPayload>,
): Promise<void> {
  await updateDoc(doc(db, "cardapio", id), { ...payload });
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, "cardapio", id));
}
