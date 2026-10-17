// Queue of approved change plans. Upstash Redis over REST, no dependency.
import { readyToApply } from "../lib/plan.js";
import { redis } from "../lib/redis.js";
import { accessToken, connect, applyPlan } from "../lib/tienda.js";

const KEEP = 50; // ponytail: last 50 plans only, demo scale
const MAX_APPLIES_PER_HOUR = 10; // the page is public: cap what anyone can change in the store

const validResults = (results, n) =>
  Array.isArray(results) && results.length === n &&
  results.every((x) => typeof x?.ok === "boolean" && typeof x.detail === "string" && x.detail.length <= 300);

// Applies the plan right away when the store is connected. Otherwise it stays
// pending for the laptop applier (AGENTE.md).
async function applyNow(redis, plan, put, apply) {
  const token = await accessToken(redis).catch(() => null);
  if (!token) return;
  const hour = `tn:applies:${new Date().toISOString().slice(0, 13)}`;
  if ((await redis("INCR", hour)) === 1) await redis("EXPIRE", hour, 3600);
  if ((await redis("GET", hour)) > MAX_APPLIES_PER_HOUR) return;
  await put({ ...plan, status: "applying" }); // hidden from the laptop applier while it runs
  let results;
  try {
    results = await apply(plan.ops, token);
  } catch (err) {
    console.error("apply failed:", err?.message);
    return put(plan); // back to pending, the laptop applier can still take it
  }
  await put({ ...plan, status: "applied", applied: new Date().toISOString(), results });
}

const liveApply = async (ops, token) => applyPlan(ops, await connect(token));

export function makeHandler(redis, apply = liveApply) {
  const get = async (id) => JSON.parse((await redis("GET", `plan:${id}`)) || "null");
  const put = (plan) => redis("SET", `plan:${plan.id}`, JSON.stringify(plan), "EX", 7 * 24 * 3600); // plans expire after a week

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
        if (!readyToApply(ops)) return res.status(400).json({ error: "invalid" });
        const plan = { id: crypto.randomUUID(), status: "pending", created: new Date().toISOString(), ops };
        await put(plan);
        await redis("LPUSH", "plans", plan.id);
        await redis("LTRIM", "plans", 0, KEEP - 1);
        await applyNow(redis, plan, put, apply);
        return res.status(201).json({ id: plan.id });
      }
      return res.status(400).json({ error: "invalid" });
    } catch (err) {
      console.error("queue failed:", err?.message);
      return res.status(503).json({ error: "queue" });
    }
  };
}

export default makeHandler(redis);
