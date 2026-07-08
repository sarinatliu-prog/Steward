// Simulated purchase feed. Stands in for a real card/bank transaction stream
// (Plaid etc.) so the round-up engine has something to consume during dev.

const MERCHANTS = [
  { name: "Blue Bottle Coffee", category: "Coffee",    min: 3.5,  max: 6.5 },
  { name: "Metro Transit",      category: "Transit",   min: 2.5,  max: 3.5 },
  { name: "City Bookshop",      category: "Books",     min: 8,    max: 32 },
  { name: "Whole Foods",        category: "Groceries", min: 18,   max: 78 },
  { name: "Corner Pharmacy",    category: "Pharmacy",  min: 5,    max: 24 },
  { name: "Noodle Bar",         category: "Lunch",     min: 9,    max: 19 },
  { name: "Farmers Market",     category: "Groceries", min: 12,   max: 40 },
  { name: "Sweetgreen",         category: "Lunch",     min: 11,   max: 17 },
  { name: "Ace Hardware",       category: "Home",      min: 4,    max: 45 },
  { name: "Rise Bakery",        category: "Coffee",    min: 3,    max: 9 },
];

const rand = (min, max) => min + Math.random() * (max - min);

/** One random purchase with an amount in integer cents. */
export function randomPurchase(when = Date.now()) {
  const m = MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)];
  const amountCents = Math.round(rand(m.min, m.max) * 100);
  return { name: m.name, category: m.category, amountCents, ts: when };
}

/** A month of purchases (default ~3/day), oldest first, timestamped realistically. */
export function generateMonth(perDay = 3, days = 30) {
  const out = [];
  const now = Date.now();
  const dayMs = 86_400_000;
  for (let d = days; d >= 1; d--) {
    const count = Math.max(1, Math.round(perDay + rand(-1, 1)));
    for (let i = 0; i < count; i++) {
      const ts = now - d * dayMs + Math.floor(rand(8, 21) * 3_600_000);
      out.push(randomPurchase(ts));
    }
  }
  return out.sort((a, b) => a.ts - b.ts);
}
