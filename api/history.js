// Per-store history of analysis results: only date, chat count and % per topic.
// No chat text, quotes or names; the store is a SHA-256 of its name, computed in the browser.
import { redis } from "../lib/redis.js";
import { TOPICS } from "../lib/chats.js";

const KEEP = 10; // last 10 analyses per store
const KEY = /^[0-9a-f]{64}$/;

export function validEntry(e) {
  return (
    e && typeof e === "object" &&
    typeof e.date === "string" && e.date.length <= 20 &&
    Number.isInteger(e.total) && e.total >= 3 && e.total <= 50 &&
    e.topics && typeof e.topics === "object" &&
    Object.entries(e.topics).every(([t, pct]) => TOPICS[t] && Number.isInteger(pct) && pct >= 0 && pct <= 100)
  );
}

export function makeHandler(redis) {
  return async function handler(req, res) {
    if (!redis) return res.status(503).json({ error: "history" });
    const store = req.query?.store;
    if (!KEY.test(store || "")) return res.status(400).json({ error: "invalid" });
    const key = `history:${store}`;
    try {
      if (req.method === "GET") {
        const items = await redis("LRANGE", key, 0, KEEP - 1);
        return res.status(200).json(items.map((i) => JSON.parse(i))); // newest first
      }
      if (req.method === "POST") {
        const { date, total, topics } = req.body || {};
        const entry = { date, total, topics };
        if (!validEntry(entry)) return res.status(400).json({ error: "invalid" });
        await redis("LPUSH", key, JSON.stringify(entry));
        await redis("LTRIM", key, 0, KEEP - 1);
        await redis("EXPIRE", key, 90 * 24 * 3600);
        return res.status(201).json({ ok: true });
      }
      return res.status(405).json({ error: "method" });
    } catch (err) {
      console.error("history failed:", err?.message);
      return res.status(503).json({ error: "history" });
    }
  };
}

export default makeHandler(redis);
