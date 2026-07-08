// Round-up engine. All money is handled as INTEGER CENTS to avoid floating-point
// drift — never store dollars as floats in a financial app.

/**
 * Spare change needed to round a purchase up to the next `roundTo` boundary.
 * @param {number} amountCents  purchase amount in whole cents (e.g. $3.60 -> 360)
 * @param {number} roundTo      boundary in cents (default 100 = nearest dollar)
 * @returns {number} spare-change cents (0 when the amount is already on a boundary)
 *
 *   computeRoundUp(360)  -> 40      // $3.60 -> $4.00
 *   computeRoundUp(450)  -> 50      // $4.50 -> $5.00
 *   computeRoundUp(400)  -> 0       // already a whole dollar
 *   computeRoundUp(1299) -> 1       // $12.99 -> $13.00
 */
export function computeRoundUp(amountCents, roundTo = 100) {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new TypeError(`amountCents must be a non-negative integer, got ${amountCents}`);
  }
  if (!Number.isInteger(roundTo) || roundTo <= 0) {
    throw new TypeError(`roundTo must be a positive integer, got ${roundTo}`);
  }
  const remainder = amountCents % roundTo;
  return remainder === 0 ? 0 : roundTo - remainder;
}

/** Convert a dollars string/number to integer cents safely. "$3.60" -> 360 */
export function toCents(dollars) {
  const n = typeof dollars === "string" ? Number(dollars.replace(/[^0-9.-]/g, "")) : dollars;
  if (!Number.isFinite(n)) throw new TypeError(`Cannot parse dollars: ${dollars}`);
  return Math.round(n * 100);
}

/** Format integer cents as a dollar string. 360 -> "$3.60" */
export function fromCents(cents) {
  return "$" + (cents / 100).toFixed(2);
}
