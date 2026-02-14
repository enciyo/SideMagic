/**
 * Shared DOM helper utilities.
 * Common functions used across content scripts and file-attach strategies.
 */

/** Promise-based setTimeout wrapper */
export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Deep query selector that also searches inside shadow DOMs.
 * Returns all matching elements from the regular DOM and any shadow roots.
 */
export function deepQueryAll<T extends Element>(
  selector: string,
  root: ParentNode = document,
): T[] {
  const results: T[] = Array.from(root.querySelectorAll<T>(selector));
  const all = root.querySelectorAll("*");
  for (const el of all) {
    if (el.shadowRoot) {
      results.push(...deepQueryAll<T>(selector, el.shadowRoot));
    }
  }
  return results;
}

/** Detect Firefox at build-time. WXT sets import.meta.env.FIREFOX per target. */
export const isFirefox = import.meta.env.FIREFOX;
