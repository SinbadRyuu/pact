"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Note {
  id: string;
  authorEmail: string;
  body: string;
  createdAt: string;
}

export function NotesPanel({ sessionId, notes }: { sessionId: string; notes: Note[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    try {
      const res = await fetch(`/api/admin/users/${sessionId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        setBody("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 14, marginBottom: 8 }}>Admin notes</h3>
      <form onSubmit={addNote} style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note (only admins see this)"
          style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #d4d4d8" }}
        />
        <button
          type="submit"
          disabled={pending || !body.trim()}
          style={{ background: "#18181b", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", cursor: "pointer" }}
        >
          Add
        </button>
      </form>
      {notes.length === 0 ? (
        <p style={{ color: "#a1a1aa", fontSize: 13 }}>No notes yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.map((n) => (
            <li key={n.id} style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}>
              <div style={{ color: "#71717a", fontSize: 11, marginBottom: 4 }}>
                {n.authorEmail} · {new Date(n.createdAt).toLocaleString()}
              </div>
              {n.body}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
