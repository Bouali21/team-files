// Helpers shared by the suites: requests through the runtime's perimeter.
export async function emailOf(runtime, role) {
  const res = await runtime.fetch("/health", { role });
  if (res.status !== 200) throw new Error(`/health for ${role}: ${res.status}`);
  return (await res.json()).user;
}

export async function createFolder(runtime, role, name, parentId = null) {
  const res = await runtime.fetch("/api/folders", {
    role,
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, parentId }),
  });
  return {
    status: res.status,
    body: res.status < 300 ? await res.json() : await res.text(),
  };
}

export async function uploadFiles(runtime, role, files, parentId = null) {
  const form = new FormData();
  if (parentId) form.set("parentId", parentId);
  for (const f of files)
    form.append("file", new Blob([f.body], { type: f.type }), f.name);
  const res = await runtime.fetch("/api/files", {
    role,
    method: "POST",
    body: form,
  });
  return {
    status: res.status,
    body: res.status < 300 ? await res.json() : await res.text(),
  };
}

// A 1x1 PNG.
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
