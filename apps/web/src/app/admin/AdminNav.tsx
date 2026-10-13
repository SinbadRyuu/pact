"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function AdminNav({ email }: { email: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 24px",
        borderBottom: "1px solid #e4e4e7",
      }}
    >
      <Link href="/admin" style={{ fontWeight: 600, textDecoration: "none", color: "#18181b" }}>
        PACT Admin
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "#52525b" }}>
        <span>{email}</span>
        <button
          type="button"
          onClick={signOut}
          style={{ background: "none", border: "1px solid #d4d4d8", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
