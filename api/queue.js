// Queue of approved change plans (spec 002). Upstash Redis over REST, no dependency.
import { validPlan } from "../lib/plan.js";

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEEP = 50; // ponytail: last 50 plans only, demo scale

async function upstash(...cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).result;
}

const validResults = (results, n) =>
  Array.isArray(results) && results.length === n &&
  results.every((x) => typeof x?.ok === "boolean" && typeof x.detail === "string" && x.detail.length <= 300);

export function makeHandler(redis) {
  const get = async (id) => JSON.parse((await redis("GET", `plan:${id}`)) || "null");
  const put = (plan) => redis("SET", `plan:${plan.id}`, JSON.stringify(plan));

  return async function handler(req, res) {
    if (!redis) return res.status(503).json({ error: "queue" });
    const { id, status, action } = req.query || {};
    try {
      if (req.method === "GET" && id) {
        const plan = await get(id);
        return plan ? res.status(200).json(plan) : res.status(404).json({ error: "not found" });
      }
      if (req.method === "GET" && status === "pending") {
        const ids = await redis("LRANGE", "plans", 0, KEEP - 1);
        const plans = ids.length ? (await redis("MGET", ...ids.map((i) => `plan:${i}`))).map((p) => JSON.parse(p || "null")) : [];
        return res.status(200).json(plans.filter((p) => p?.status === "pending").reverse()); // oldest first
      }
      if (req.method === "POST" && id && action === "applied") {
        const plan = await get(id);
        if (!plan) return res.status(404).json({ error: "not found" });
        if (plan.status !== "pending") return res.status(409).json({ error: "already applied" });
        const results = req.body?.results;
        if (!validResults(results, plan.ops.length)) return res.status(400).json({ error: "invalid" });
        await put({ ...plan, status: "applied", applied: new Date().toISOString(), results });
        return res.status(200).json({ ok: true });
      }
      if (req.method === "POST" && !id) {
        const ops = req.body?.ops;
        if (!validPlan(ops)) return res.status(400).json({ error: "invalid" });
        const plan = { id: crypto.randomUUID(), status: "pending", created: new Date().toISOString(), ops };
        await put(plan);
        await redis("LPUSH", "plans", plan.id);
        await redis("LTRIM", "plans", 0, KEEP - 1);
        return res.status(201).json({ id: plan.id });
      }
      return res.status(400).json({ error: "invalid" });
    } catch (err) {
      console.error("queue failed:", err?.message);
      return res.status(503).json({ error: "queue" });
    }
  };
}

export default makeHandler(URL_ && TOKEN ? upstash : null);
