import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readZipTexts } from "../lib/zip.js";
import { parseChat } from "../lib/chats.js";

test("zip: returns only the chat text, ignores photos (RF-3)", async () => {
  const texts = await readZipTexts(readFileSync(new URL("./fixtures/chat.zip", import.meta.url)));
  assert.deepEqual(texts.map((t) => t.name), ["_chat.txt"]);
  assert.match(texts[0].text, /Vestido Midi Azahar/);
});

test("zip: corrupt file throws (RF-4)", async () => {
  await assert.rejects(readZipTexts(new TextEncoder().encode("not a zip at all, nope")));
});

test("parse: Android format with system lines (RF-2)", () => {
  const chat = parseChat(readFileSync(new URL("../muestras/chats/Chat de WhatsApp con +52 55 1234 0001.txt", import.meta.url), "utf8"));
  assert.equal(chat.messages.length, 6); // encryption notice dropped
  assert.equal(chat.messages[0].sender, "+52 55 1234 0001");
  assert.equal(chat.messages[2].sender, "Utel Equipo3");
});

test("parse: iPhone format, 24 h, multi-line and media notices (RF-2)", () => {
  const ios = [
    "‎[14/10/26, 18:02:11] Ana: Hola",
    "¿tienen talla M?",
    "[14/10/26, 18:03:40] Tienda: Sí",
    "[14/10/26, 18:04:00] Ana: ‎<Multimedia omitido>",
  ].join("\n");
  const chat = parseChat(ios);
  assert.equal(chat.messages.length, 2);
  assert.equal(chat.messages[0].text, "Hola\n¿tienen talla M?");
});

test("parse: a file that is not a chat returns null (RF-4)", () => {
  assert.equal(parseChat("lista del súper\nhuevo\nleche"), null);
});
