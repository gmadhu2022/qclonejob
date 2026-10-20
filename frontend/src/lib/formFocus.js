/**
 * Scroll to the first thing on screen that is showing an error, and focus it.
 *
 * WHY THIS IS NEEDED
 * ------------------
 * Long forms — institute registration is nine sections — fail silently from
 * the user's point of view. The validation message appears next to a field
 * that may be three screens away, or in a toast in the bottom corner. The
 * person sees "nothing happened" when they press Submit and presses it again.
 *
 * WHY IT DETECTS BY STYLING RATHER THAN A FIELD REGISTRY
 * -----------------------------------------------------
 * The alternative is every form declaring which field each message belongs
 * to, which means touching every form in the app and keeping two lists in
 * sync forever. The error STATE is already in the DOM the moment React
 * renders it — a red border, a red message, aria-invalid. Reading that works
 * for forms nobody has thought about yet, including ones written later.
 *
 * It is deliberately a no-op when nothing on the page is marked invalid: a
 * network failure or a server message with no related field should not scroll
 * the page somewhere arbitrary.
 */

/* Ordered by confidence. aria-invalid is an explicit declaration; the colour
   classes are this codebase's existing convention for an invalid control. */
const INVALID_SELECTORS = [
  '[aria-invalid="true"]',
  "[data-invalid='true']",
  ".is-invalid",
  "input.\\!border-red-400",
  "textarea.\\!border-red-400",
  "select.\\!border-red-400",
  "[class*='border-red-400']",
  "[class*='border-red-500']",
];

/** The control a person should be put into, given any element in its area. */
function focusableWithin(el) {
  if (!el) return null;
  const tag = el.tagName?.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return el;
  return el.querySelector("input, textarea, select, [contenteditable='true']")
      || el.closest("label, div")?.querySelector("input, textarea, select")
      || null;
}

function isVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  // A field inside a collapsed section has no box. Scrolling to it would
  // park the page on something the person cannot see or fix.
  return r.width > 0 || r.height > 0;
}

/**
 * @param {HTMLElement} [root] limit the search (defaults to the document)
 * @returns {boolean} true when something was found and scrolled to
 */
export function focusFirstError(root) {
  if (typeof document === "undefined") return false;
  const scope = root || document;

  let target = null;
  for (const sel of INVALID_SELECTORS) {
    let found;
    try {
      found = Array.from(scope.querySelectorAll(sel)).find(isVisible);
    } catch {
      continue;        // a selector the browser rejects must not break submit
    }
    if (found) { target = found; break; }
  }
  if (!target) return false;

  const field = focusableWithin(target) || target;

  /* "center", not "start": a sticky header would otherwise cover the field
     it just scrolled to, which is worse than not scrolling at all. */
  try {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch {
    target.scrollIntoView();          // older browsers ignore the options object
  }

  /* Focus AFTER the scroll starts. Focusing first makes the browser jump
     instantly to the field and the smooth scroll then animates from there,
     which reads as the page flickering. preventScroll keeps the two apart. */
  window.setTimeout(() => {
    try {
      field.focus({ preventScroll: true });
      if (typeof field.select === "function" && field.value) field.select();
    } catch { /* not focusable — the scroll alone still did the useful part */ }
  }, 180);

  return true;
}

export default focusFirstError;
