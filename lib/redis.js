// Upstash Redis over REST, no dependency. Null when the store is not configured.
// Vercel may add a custom prefix (e.g. STORAGE_KV_REST_API_URL), so match by suffix.
const env = (re) => Object.entries(process.env).find(([k, v]) => re.test(k) && v)?.[1];
const URL_ = env(/(KV_REST_API|REDIS_REST)_URL$/);
const TOKEN = env(/(KV_REST_API|REDIS_REST)_TOKEN$/);

async function upstash(...cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

export const redis = URL_ && TOKEN ? upstash : null;
