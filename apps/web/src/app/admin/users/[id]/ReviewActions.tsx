"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ReviewActions({ sessionId, status }: { sessionId: string; status: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: action === "reject" ? reason : undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed.");
      }
      router.refresh();
      setShowRejectForm(false);
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setPending(false);
    }
  }

  if (status !== "DEPOSIT_SUBMITTED") {
    return <p style={{ color: "#71717a", fontSize: 13 }}>No review action available at this status.</p>;
  }

  return (
    <div>
      {error && <p style={{ color: "#991b1b", fontSize: 13 }}>{error}</p>}
      {!showRejectForm ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            disabled={pending}
            onClick={() => act("approve")}
            style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}
          >
            Approve
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowRejectForm(true)}
            style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}
          >
            Reject
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}>
          <label style={{ fontSize: 13 }}>Reason (shown to the user)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            style={{ padding: 8, borderRadius: 6, border: "1px solid #d4d4d8" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              disabled={pending || !reason.trim()}
              onClick={() => act("reject")}
              style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}
            >
              Confirm reject
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm(false)}
              style={{ background: "none", border: "1px solid #d4d4d8", borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
