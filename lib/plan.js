// Change plans: the only things the agent may do to the store (spec 002, RF-4/RF-14).

export const MAX_OPS = 10;
export const MAX_TEXT = 400;
export const MAX_PRODUCTS = 25;
export const MAX_ABSOLUTE = 500; // pesos
export const MAX_MIN_PRICE = 100000;
export const MAX_STOCK = 999;
// Published text must not carry links, emails, phone/account numbers, HTML or fill-in placeholders.
const UNSAFE_TEXT = /https?:|www\.|\.(com|mx|net|org|ly)\b|@|\d{7,}|[<>\[\]]/i;
const KINDS = ["percentage", "absolute", "shipping"];

const names = (p) => Array.isArray(p) && p.length <= MAX_PRODUCTS && p.every((n) => typeof n === "string" && n.length > 0 && n.length <= 80 && !/[<>{}]/.test(n));

export function validOp(op) {
  if (!op || typeof op !== "object") return false;
  if (op.type === "append_description") {
    return names(op.products) && typeof op.text === "string" && op.text.trim().length > 0 && op.text.length <= MAX_TEXT && !UNSAFE_TEXT.test(op.text);
  }
  if (op.type === "free_shipping") return names(op.products);
  // New size on one product; the owner sets the pieces before confirming (never infinite stock).
  if (op.type === "add_size") {
    return names([op.product]) && typeof op.size === "string" && /^[A-Z0-9]{1,5}$/.test(op.size) &&
      (op.stock === null || (Number.isInteger(op.stock) && op.stock >= 1 && op.stock <= MAX_STOCK));
  }
  if (op.type === "create_coupon") {
    return (
      typeof op.code === "string" && /^[A-Z0-9]{4,15}$/.test(op.code) &&
      KINDS.includes(op.kind) &&
      (op.kind === "shipping" || (typeof op.value === "number" && op.value > 0 && op.value <= (op.kind === "percentage" ? 50 : MAX_ABSOLUTE))) &&
      (op.min_price == null || (typeof op.min_price === "number" && op.min_price >= 0 && op.min_price <= MAX_MIN_PRICE))
    );
  }
  return false;
}

export function validPlan(ops) {
  return Array.isArray(ops) && ops.length > 0 && ops.length <= MAX_OPS && ops.every(validOp);
}

// A plan can reach the store only when every new size has its pieces.
export const readyToApply = (ops) => validPlan(ops) && ops.every((op) => op.type !== "add_size" || op.stock !== null);

// Plain-language line for the preview and the results.
export function describe(op) {
  const who = (p) => (p.length ? p.join(", ") : "todos los productos");
  if (op.type === "append_description") return `Agregar a la descripción de ${who(op.products)}`;
  if (op.type === "free_shipping") return `Activar envío gratis en ${who(op.products)}`;
  if (op.type === "add_size") return `Agregar la talla ${op.size} a ${op.product}${op.stock ? ` con ${op.stock} piezas` : ""}`;
  const what = op.kind === "shipping" ? "envío gratis" : op.kind === "percentage" ? `${op.value}% de descuento` : `$${op.value} de descuento`;
  return `Crear el cupón ${op.code}: ${what}${op.min_price ? ` en compras desde $${op.min_price}` : ""}`;
}
