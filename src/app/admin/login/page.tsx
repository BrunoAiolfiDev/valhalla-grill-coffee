"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      if (adminEmail && cred.user.email !== adminEmail) {
        await auth.signOut();
        setError("Access denied. This account has no admin permissions.");
        return;
      }
      router.replace("/admin");
    } catch {
      setError("Incorrect email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-500">
            Admin Panel
          </p>
          <h1 className="mt-1 text-3xl font-black text-white">
            Valhalla Grill
          </h1>
        </div>

        <form
          onSubmit={(e) => void handleLogin(e)}
          className="flex flex-col gap-4 rounded-3xl bg-zinc-900 p-6"
        >
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-zinc-400">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-zinc-400">
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-900/40 px-4 py-2 text-xs font-semibold text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-2xl bg-amber-500 py-4 text-sm font-black text-zinc-900 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
