/**
 * Internationalization helper – Single source for i18n message retrieval.
 * All modules import `msg` from here instead of defining their own.
 */

/** Get i18n message with fallback to the key itself */
export function msg(key: string, ...substitutions: string[]): string {
  // WXT/webextension types expect locale keys; we accept dynamic keys
  return browser.i18n.getMessage(key as Parameters<typeof browser.i18n.getMessage>[0], substitutions) || key;
}
