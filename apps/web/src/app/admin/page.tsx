import Link from "next/link";
import { listSessionsForAdmin } from "@/lib/adminQueries";

const STATUS_LABELS: Record<string, string> = {
  STARTED: "Started",
  AWAITING_BROKER_SIGNUP: "Awaiting broker signup",
  ACCOUNT_CREATED: "Account created",
  KYC_PENDING: "KYC pending",
  KYC_COMPLETE: "KYC complete",
  DEPOSIT_PENDING: "Deposit pending",
  DEPOSIT_SUBMITTED: "Needs review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
};

const STATUS_COLORS: Record<string, string> = {
  DEPOSIT_SUBMITTED: "#7c3aed",
  REJECTED: "#dc2626",
  APPROVED: "#16a34a",
  COMPLETED: "#15803d",
};

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const sessions = await listSessionsForAdmin();
  const needsReview = sessions.filter((s) => s.status === "DEPOSIT_SUBMITTED").length;

  return (
    <div>
      <h1 style={{ fontSize: 20 }}>Onboarding users</h1>
      <p style={{ color: "#52525b", fontSize: 14 }}>
        {needsReview > 0 ? `${needsReview} awaiting review` : "Nothing awaiting review right now"}
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #e4e4e7", fontSize: 12, color: "#71717a" }}>
            <th style={{ padding: "10px 12px" }}>User</th>
            <th style={{ padding: "10px 12px" }}>Broker</th>
            <th style={{ padding: "10px 12px" }}>Status</th>
            <th style={{ padding: "10px 12px" }}>Deposit claimed</th>
            <th style={{ padding: "10px 12px" }}>Screenshot</th>
            <th style={{ padding: "10px 12px" }}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #f4f4f5", fontSize: 13 }}>
              <td style={{ padding: "10px 12px" }}>
                <Link href={`/admin/users/${s.id}`} style={{ color: "#6d28d9", textDecoration: "none" }}>
                  {s.displayName || s.contactHandle || s.id.slice(0, 8)}
                </Link>
              </td>
              <td style={{ padding: "10px 12px" }}>{s.brokerName ?? "—"}</td>
              <td style={{ padding: "10px 12px" }}>
                <span style={{ color: STATUS_COLORS[s.status] ?? "#3f3f46", fontWeight: 600 }}>
                  {STATUS_LABELS[s.status] ?? s.status}
                </span>
              </td>
              <td style={{ padding: "10px 12px" }}>{s.depositAmountClaimed ?? "—"}</td>
              <td style={{ padding: "10px 12px" }}>{s.hasScreenshot ? "Yes" : "—"}</td>
              <td style={{ padding: "10px 12px" }}>{new Date(s.updatedAt).toLocaleString()}</td>
            </tr>
          ))}
          {sessions.length === 0 && (
            <tr>
              <td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#a1a1aa" }}>
                No one has started onboarding yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
