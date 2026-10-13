import { getCurrentAdmin } from "@/lib/admin";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();

  // Middleware already redirects non-admins before this renders, except on
  // /admin/login itself (which doesn't use this layout's nav at all since it
  // has no admin yet) — this null check just keeps TypeScript honest.
  return (
    <div style={{ minHeight: "100vh", background: "#fafafa" }}>
      {admin && <AdminNav email={admin.email} />}
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  );
}
