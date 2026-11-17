// Turns a stored file_url into a link someone can download from.
// - "https://…"                 → used as is (fine for free indicators, or members-only files on an unguessable URL)
// - "storage:<bucket>/<path>"   → a private Supabase Storage object, signed for a few minutes per download,
//                                 so a members-only file can't be shared or hot-linked.

export type SignFile = (fileUrl: string) => Promise<string>;

export function supabaseStorageSigner(opts: { supabaseUrl: string; serviceRoleKey: string; expiresIn?: number }): SignFile {
  const base = opts.supabaseUrl.replace(/\/+$/, "");
  return async (fileUrl) => {
    if (!fileUrl.startsWith("storage:")) return fileUrl;
    const objectPath = fileUrl.slice("storage:".length).replace(/^\/+/, "");
    const res = await fetch(`${base}/storage/v1/object/sign/${objectPath.split("/").map(encodeURIComponent).join("/")}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${opts.serviceRoleKey}`,
        apikey: opts.serviceRoleKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({ expiresIn: opts.expiresIn ?? 300 }),
    });
    if (!res.ok) throw new Error(`Could not sign ${objectPath}: ${res.status}`);
    const { signedURL } = (await res.json()) as { signedURL: string };
    // Supabase returns a path relative to /storage/v1. Add download= so browsers save it with its own name.
    const url = new URL(`${base}/storage/v1${signedURL}`);
    url.searchParams.set("download", objectPath.split("/").pop() ?? "");
    return url.toString();
  };
}

/** For hosts without Supabase Storage: "storage:" links are refused, everything else passes through. */
export const passthroughSigner: SignFile = async (fileUrl) => {
  if (fileUrl.startsWith("storage:")) throw new Error("storage: links need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return fileUrl;
};
