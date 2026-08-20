export const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001/api";
export function token() {
  return typeof window === "undefined"
    ? ""
    : localStorage.getItem("token") || "";
}
export async function api(path: string, options: RequestInit = {}) {
  const r = await fetch(API + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
      ...options.headers,
    },
  });
  if (r.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem("token");
    const next = location.pathname + location.search;
    location.href = "/login?next=" + encodeURIComponent(next);
  }
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    const error: any = new Error(body.message || "Request failed");
    Object.assign(error, body);
    throw error;
  }
  return r.status === 204 ? null : r.json();
}
export async function upload(path: string, body: FormData) {
  const r = await fetch(API + path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}` },
    body,
  });
  if (!r.ok)
    throw new Error(
      (await r.json().catch(() => ({}))).message || "Upload failed",
    );
  return r.json();
}
export async function download(path: string, name: string) {
  const r = await fetch(API + path.replace("/api", ""), {
    headers: { Authorization: `Bearer ${token()}` },
  });
  if (!r.ok) throw new Error("Download failed");
  const url = URL.createObjectURL(await r.blob()),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
