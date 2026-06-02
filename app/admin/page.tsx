"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/admin/dashboard");
    } else {
      setError("Ongeldig wachtwoord");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 1rem",
        backgroundColor: "#001337",
      }}
    >
      <div
        className="w-full max-w-sm p-10"
        style={{
          width: "100%",
          maxWidth: "380px",
          padding: "2.5rem",
          backgroundColor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="text-center mb-10">
          <p
            className="text-[10px] tracking-widest uppercase mb-3"
            style={{ color: "rgba(255,255,255,0.35)", fontFamily: "var(--font-inter)" }}
          >
            Beheer
          </p>
          <h1
            className="text-3xl font-bold text-white"
            style={{ fontFamily: "var(--font-playfair)" }}
          >
            JG Mobility
          </h1>
        </div>

        <form onSubmit={login} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Wachtwoord"
            autoFocus
            className="w-full px-4 py-3 text-sm outline-none"
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#ffffff",
              fontFamily: "var(--font-inter)",
            }}
          />

          {error && (
            <p
              className="text-xs text-center"
              style={{ color: "#ff6b6b", fontFamily: "var(--font-inter)" }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 text-sm font-semibold tracking-widest uppercase transition-all hover:opacity-90 disabled:opacity-40"
            style={{
              backgroundColor: "#ffffff",
              color: "#001337",
              fontFamily: "var(--font-inter)",
            }}
          >
            {loading ? "Bezig..." : "Inloggen"}
          </button>
        </form>
      </div>
    </div>
  );
}
