import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function POST(request: Request) {
  const body = (await request.json()) as { pin?: string };

  if (!body.pin) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Read PIN from Firestore; fall back to env var for backwards compatibility
  const snap = await getDoc(doc(db, "config", "settings"));
  const firestorePin =
    snap.exists() && snap.data()?.kitchenPin
      ? String(snap.data()!.kitchenPin)
      : null;
  const correctPin = firestorePin ?? process.env.KITCHEN_PIN ?? null;

  if (!correctPin) {
    return NextResponse.json(
      { ok: false, error: "Kitchen PIN not configured" },
      { status: 500 },
    );
  }

  if (body.pin !== correctPin) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
