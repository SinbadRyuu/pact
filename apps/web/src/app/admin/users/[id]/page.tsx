import { notFound } from "next/navigation";
import { getSessionDetailForAdmin } from "@/lib/adminQueries";
import { ReviewActions } from "./ReviewActions";
import { NotesPanel } from "./NotesPanel";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({ params }: { params: { id: string } }) {
  const detail = await getSessionDetailForAdmin(params.id);
  if (!detail) notFound();

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, maxWidth: 1000 }}>
      <div>
        <h1 style={{ fontSize: 20 }}>{detail.displayName || detail.contactHandle || detail.id}</h1>
        <dl style={{ fontSize: 14, color: "#3f3f46" }}>
          <Row label="Status" value={detail.status} />
          <Row label="Broker" value={detail.broker?.name ?? "—"} />
          <Row
            label="Minimum deposit"
            value={detail.broker ? `${detail.broker.minDepositCurrency}${detail.broker.minDepositAmount}` : "—"}
          />
          <Row label="Deposit claimed" value={detail.depositAmountClaimed != null ? String(detail.depositAmountClaimed) : "—"} />
          <Row label="Referral code" value={detail.referralCode ?? "—"} />
          <Row label="Joined" value={new Date(detail.createdAt).toLocaleString()} />
          <Row label="Last updated" value={new Date(detail.updatedAt).toLocaleString()} />
        </dl>

        {detail.rejectionReason && (
          <p style={{ background: "#fef2f2", color: "#991b1b", padding: "8px 10px", borderRadius: 8, fontSize: 13 }}>
            Last rejection reason: {detail.rejectionReason}
          </p>
        )}

        <h3 style={{ fontSize: 14, marginTop: 20 }}>Deposit screenshot</h3>
        {detail.screenshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={detail.screenshotUrl}
            alt="Deposit screenshot"
            style={{ maxWidth: "100%", border: "1px solid #e4e4e7", borderRadius: 8 }}
          />
        ) : (
          <p style={{ color: "#a1a1aa", fontSize: 13 }}>No screenshot submitted yet.</p>
        )}

        <h3 style={{ fontSize: 14, marginTop: 20 }}>Review</h3>
        <ReviewActions sessionId={detail.id} status={detail.status} />

        <h3 style={{ fontSize: 14, marginTop: 20 }}>Status history</h3>
        <ul style={{ fontSize: 12, color: "#52525b", paddingLeft: 16 }}>
          {detail.history.map((h) => (
            <li key={h.id}>
              {new Date(h.createdAt).toLocaleString()} — {h.fromStatus ?? "(new)"} → {h.toStatus} ({h.actor})
            </li>
          ))}
        </ul>
      </div>

      <div>
        <NotesPanel sessionId={detail.id} notes={detail.notes} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #f4f4f5" }}>
      <dt style={{ color: "#71717a" }}>{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </div>
  );
}
