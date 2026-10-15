// Change plans: the only things the agent may do to the store (spec 002, RF-4/RF-14).

export const MAX_OPS = 10;
export const MAX_TEXT = 400;
const KINDS = ["percentage", "absolute", "shipping"];

const names = (p) => Array.isArray(p) && p.every((n) => typeof n === "string" && n.length > 0 && n.length <= 120);

export function validOp(op) {
  if (!op || typeof op !== "object") return false;
  if (op.type === "append_description") {
    // No fill-in placeholders: the text is published as is.
    return names(op.products) && typeof op.text === "string" && op.text.trim().length > 0 && op.text.length <= MAX_TEXT && !/[\[\]]/.test(op.text);
  }
  if (op.type === "free_shipping") return names(op.products);
  if (op.type === "create_coupon") {
    return (
      typeof op.code === "string" && /^[A-Z0-9]{4,15}$/.test(op.code) &&
      KINDS.includes(op.kind) &&
      (op.kind === "shipping" || (typeof op.value === "number" && op.value > 0 && (op.kind !== "percentage" || op.value <= 50))) &&
      (op.min_price == null || (typeof op.min_price === "number" && op.min_price >= 0))
    );
  }
  return false;
}

export function validPlan(ops) {
  return Array.isArray(ops) && ops.length > 0 && ops.length <= MAX_OPS && ops.every(validOp);
}

// Plain-language line for the preview and the results.
export function describe(op) {
  const who = (p) => (p.length ? p.join(", ") : "todos los productos");
  if (op.type === "append_description") return `Agregar a la descripción de ${who(op.products)}`;
  if (op.type === "free_shipping") return `Activar envío gratis en ${who(op.products)}`;
  const what = op.kind === "shipping" ? "envío gratis" : op.kind === "percentage" ? `${op.value}% de descuento` : `$${op.value} de descuento`;
  return `Crear el cupón ${op.code}: ${what}${op.min_price ? ` en compras desde $${op.min_price}` : ""}`;
}
