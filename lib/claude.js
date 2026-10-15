// Server-only helper: one Claude call that must return JSON matching `schema`.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";

// Shared personality and rules, editable without touching code (prompts/agente.md).
const PERSONA = readFileSync(new URL("../prompts/agente.md", import.meta.url), "utf8");

export async function askJson({ system, content, schema, maxTokens = 16000 }) {
  const client = new Anthropic({ timeout: 50_000, maxRetries: 0 }); // the page falls back at 45 s
  const msg = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system: `${PERSONA}\n\n# Tu tarea ahora\n\n${system}`,
    messages: [{ role: "user", content }],
  });
  if (msg.stop_reason !== "end_turn") throw new Error(`stop_reason ${msg.stop_reason}`);
  return JSON.parse(msg.content.find((b) => b.type === "text")?.text);
}
