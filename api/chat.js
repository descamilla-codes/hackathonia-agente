import { askJson } from "../lib/claude.js";

const SYSTEM = `El dueño te pregunta sobre un problema que encontraste en sus chats, para decidir qué hacer.
El problema llega dentro de <problema> y la pregunta dentro de <pregunta>. Responde solo con lo que está en <problema>, en máximo 3 oraciones.`;

const SCHEMA = {
  type: "object",
  properties: { answer: { type: "string" } },
  required: ["answer"],
  additionalProperties: false,
};

const str = (s, max) => typeof s === "string" && s.length <= max;

export function validChat(body) {
  const p = body?.problem;
  return (
    str(body?.question, 300) && body.question.trim().length > 0 &&
    p && typeof p === "object" && JSON.stringify(p).length <= 6000
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  if (!validChat(req.body)) return res.status(400).json({ error: "invalid" });
  try {
    const { answer } = await askJson({
      system: SYSTEM,
      content: `<problema>${JSON.stringify(req.body.problem)}</problema>\n<pregunta>${req.body.question.replace(/[<>]/g, "")}</pregunta>`,
      schema: SCHEMA,
      maxTokens: 600,
      res,
    });
    return res.status(200).json({ answer });
  } catch (err) {
    console.error("chat failed:", err?.status ?? "", err?.message);
    return res.status(502).json({ error: "ai" });
  }
}
