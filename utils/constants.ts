/**
 * Shared constants – Chatbot domains, URL patterns, and timeout values.
 * Single source of truth; all modules import from here.
 */

export const CHATBOT_DOMAINS = [
  "gemini.google.com",
  "claude.ai",
  "x.com",
  "grok.com",
  "kimi.com",
  "www.kimi.com",
];

export const CHATBOT_URL_PATTERNS = [
  "*://gemini.google.com/*",
  "*://claude.ai/*",
  "*://x.com/*",
  "*://grok.com/*",
  "*://kimi.com/*",
  "*://www.kimi.com/*",
  "*://accounts.x.ai/*",
];

/** Timeout constants (ms) */
export const TIMEOUTS = {
  /** Main world interception timeout */
  INTERCEPT: 6000,
  /** Menu open wait duration */
  MENU_WAIT: 500,
  /** Wait after upload button click */
  BUTTON_CLICK_WAIT: 600,
  /** Event dispatch delay */
  EVENT_DISPATCH: 200,
  /** Chrome interception result wait */
  CHROME_INTERCEPT_RESULT: 5000,
  /** Chrome interception post-wait */
  CHROME_INTERCEPT_WAIT: 1000,
  /** Command palette flag delay */
  PALETTE_FLAG_DELAY: 250,
  /** Wait after Firefox menu item click */
  FIREFOX_MENU_ITEM_WAIT: 500,
  /** Wait after Firefox button click for interception */
  FIREFOX_INTERCEPT_EXTRA_WAIT: 500,
  /** Chrome fallback DOM search wait */
  CHROME_FALLBACK_WAIT: 800,
  /** Chrome fallback menu item wait */
  CHROME_FALLBACK_MENU_WAIT: 500,
  /** Chrome fallback extra wait */
  CHROME_FALLBACK_EXTRA_WAIT: 500,
  /** Drop event wait */
  DROP_WAIT: 300,
  /** Paste focus wait */
  PASTE_FOCUS_WAIT: 100,
  /** Unhide menu delay – must exceed the framework's close animation (~300ms for Naive UI) */
  UNHIDE_MENU_DELAY: 400,
} as const;
