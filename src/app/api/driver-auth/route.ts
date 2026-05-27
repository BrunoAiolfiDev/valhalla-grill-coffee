import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function POST(request: Request) {
  const body = (await request.json()) as { pin?: string };

  if (!body.pin) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const snap = await getDoc(doc(db, "config", "settings"));
  const data = snap.exists() ? snap.data() : null;

  // ── Multi-driver: check drivers array first ──
  const drivers = (data?.drivers ?? []) as {
    id: string;
    name: string;
    pin: string;
  }[];
  const matched = drivers.find((d) => d.pin === body.pin);
  if (matched) {
    return NextResponse.json({
      ok: true,
      driverId: matched.id,
      driverName: matched.name,
    });
  }

  // ── Legacy fallback: single driverPin / DRIVER_PIN env ──
  const legacyPin = data?.driverPin
    ? String(data.driverPin)
    : (process.env.DRIVER_PIN ?? null);
  if (legacyPin && body.pin === legacyPin) {
    return NextResponse.json({
      ok: true,
      driverId: "default",
      driverName: "Driver",
    });
  }

  if (!drivers.length && !legacyPin) {
    return NextResponse.json(
      { ok: false, error: "No drivers configured" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
