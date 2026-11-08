/* =====================================================================
   Currencies + salary ladders for job posts.

   The full ISO-4217 list comes from the browser (Intl), so every currency
   is available without shipping a table; the common ones for this portal's
   users are listed first.
   ===================================================================== */
const POPULAR = ["INR", "USD", "EUR", "GBP", "AED", "SAR", "QAR", "KWD", "OMR", "BHD",
                 "SGD", "MYR", "AUD", "CAD", "NZD", "JPY", "CNY", "NPR", "BDT", "LKR"];

const FALLBACK = POPULAR.concat(["CHF", "ZAR", "HKD", "THB", "IDR", "PHP", "KRW", "SEK", "NOK", "DKK",
  "PKR", "EGP", "NGN", "KES", "TRY", "BRL", "MXN", "RUB", "PLN"]);

function allCodes() {
  try {
    if (typeof Intl.supportedValuesOf === "function") return Intl.supportedValuesOf("currency");
  } catch { /* older browsers */ }
  return FALLBACK;
}

function symbolOf(code) {
  try {
    const parts = new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value || code;
  } catch { return code; }
}

let names;
try { names = new Intl.DisplayNames(["en"], { type: "currency" }); } catch { names = null; }

const codes = [...new Set([...POPULAR, ...allCodes()])];
export const CURRENCIES = codes.map((code) => ({
  code,
  symbol: symbolOf(code),
  name: (names && names.of(code)) || code,
  popular: POPULAR.includes(code),
}));
export const currencyOf = (code) => CURRENCIES.find((c) => c.code === code) || { code, symbol: code, name: code };

/* Country -> its usual currency, for a sensible default when the job's
   country changes. Anything not listed keeps the current choice. */
export const COUNTRY_CURRENCY = {
  IN: "INR", US: "USD", GB: "GBP", AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", OM: "OMR", BH: "BHD",
  SG: "SGD", MY: "MYR", AU: "AUD", CA: "CAD", NZ: "NZD", JP: "JPY", CN: "CNY", NP: "NPR", BD: "BDT",
  LK: "LKR", PK: "PKR", ZA: "ZAR", HK: "HKD", TH: "THB", ID: "IDR", PH: "PHP", KR: "KRW", CH: "CHF",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", IE: "EUR", BE: "EUR", AT: "EUR", PT: "EUR",
  FI: "EUR", GR: "EUR", SE: "SEK", NO: "NOK", DK: "DKK", PL: "PLN", TR: "TRY", BR: "BRL", MX: "MXN",
  EG: "EGP", NG: "NGN", KE: "KES", RU: "RUB",
};

/* ---- Salary ladders (Naukri-style dropdown steps) ----
   INR: 0 to ₹20 Crore. Everything else: 0 to 1,000,000. Steps get wider as
   amounts grow so the list stays short enough to scroll. */
export function salarySteps(code) {
  const out = [0];
  const add = (from, to, step) => { for (let v = from; v <= to; v += step) if (v > out[out.length - 1]) out.push(v); };
  if (code === "INR") {
    add(5000, 50000, 5000);            // ₹5K … ₹50K
    add(60000, 100000, 10000);         // … ₹1 Lakh
    add(150000, 1000000, 50000);       // ₹1.5 L … ₹10 L
    add(1100000, 5000000, 100000);     // ₹11 L … ₹50 L
    add(5500000, 10000000, 500000);    // ₹55 L … ₹1 Cr
    add(15000000, 50000000, 5000000);  // ₹1.5 Cr … ₹5 Cr
    add(60000000, 200000000, 10000000);// ₹6 Cr … ₹20 Cr
  } else {
    add(500, 5000, 500);
    add(6000, 20000, 1000);
    add(25000, 100000, 5000);
    add(110000, 300000, 10000);
    add(325000, 1000000, 25000);
  }
  return out;
}

/** Human label: ₹1.5 Lakh, ₹2 Cr, $50K, €1.2M … */
export function formatMoney(value, code = "INR") {
  const v = Number(value) || 0;
  const sym = currencyOf(code).symbol;
  if (v === 0) return `${sym}0`;
  if (code === "INR") {
    const trim = (n) => String(Number(n.toFixed(2)));
    if (v >= 10000000) return `₹${trim(v / 10000000)} Cr`;
    if (v >= 100000) return `₹${trim(v / 100000)} Lakh`;
    if (v >= 1000) return `₹${trim(v / 1000)}K`;
    return `₹${v}`;
  }
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol",
      notation: "compact", maximumFractionDigits: 2 }).format(v);
  } catch { return `${sym}${v.toLocaleString("en")}`; }
}
