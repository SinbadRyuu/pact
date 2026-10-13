"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setSubmitting(false);

    if (signInError) {
      setError("Couldn't sign in. Check your email and password and try again.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form
        onSubmit={handleSubmit}
        style={{ width: 320, padding: 24, border: "1px solid #e4e4e7", borderRadius: 12 }}
      >
        <h1 style={{ fontSize: 18, marginTop: 0 }}>PACT Admin</h1>
        {error && (
          <p style={{ background: "#fef2f2", color: "#991b1b", padding: "8px 10px", borderRadius: 8, fontSize: 13 }}>
            {error}
          </p>
        )}
        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ width: "100%", padding: 8, marginBottom: 12, borderRadius: 6, border: "1px solid #d4d4d8" }}
        />
        <label style={{ display: "block", fontSize: 13, marginBottom: 4 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: "100%", padding: 8, marginBottom: 16, borderRadius: 6, border: "1px solid #d4d4d8" }}
        />
        <button
          type="submit"
          disabled={submitting}
          style={{
            width: "100%",
            padding: 10,
            background: "#6d28d9",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
        <p style={{ fontSize: 12, color: "#71717a", marginBottom: 0 }}>
          Accounts are created by invite only. If you don&apos;t have one yet, ask whoever set up Supabase.
        </p>
      </form>
    </div>
  );
}
