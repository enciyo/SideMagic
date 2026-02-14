/**
 * Frame Embedding – Ortak sabitler
 *
 * DNR kural yapılandırması ve auth redirect tespiti için tek kaynak.
 * Kullanım: wxt.config.ts (Chrome), header-removal.ts (Firefox), auth-redirect.ts (her iki tarayıcı).
 */

// --- DNR (Declarative Net Request) ---

/** DNR ruleset identifier used in manifest declarative_net_request.rule_resources */
export const FRAME_EMBEDDING_DNR_RULE_ID = "remove_frame_headers";

/** Path to the DNR rules JSON file (relative to public/) */
export const FRAME_EMBEDDING_DNR_RULE_PATH = "rules/remove-frame-headers.json";

/** Response headers removed to allow iframe embedding */
export const FRAME_EMBEDDING_HEADERS_TO_REMOVE = [
  "x-frame-options",
  "permissions-policy",
] as const;

// --- Auth redirect: domain & path patterns ---

/** Host + pathPrefix for pattern matching (auth exclude / auth path). */
export type HostPathPattern = { host: string; pathPrefix: string };

/** Google accounts subdomains (Gemini auth). */
const GOOGLE_ACCOUNTS_DOMAINS = [
  "accounts.google.com",
  "accounts.google.co.uk",
  "accounts.google.co.jp",
  "accounts.google.com.br",
  "accounts.google.com.tr",
] as const;

/**
 * Auth domains that block iframe embedding on the server side (403).
 * When iframe navigates to these domains, we open a new tab instead.
 */
export const AUTH_REDIRECT_DOMAINS = [
  ...GOOGLE_ACCOUNTS_DOMAINS,
  "accounts.x.ai",
  "api.x.com",
] as const;

/**
 * Paths on auth domains that should NOT trigger auth redirect (e.g. internal
 * cookie/session pages). Iframe can load these without opening login popup.
 */
export const AUTH_REDIRECT_EXCLUDE_PATTERNS: HostPathPattern[] =
  GOOGLE_ACCOUNTS_DOMAINS.map((host) => ({
    host,
    pathPrefix: "/RotateCookiesPage",
  }));

/** x.com paths that indicate login/OAuth flow (auth redirect only for these). */
const X_COM_AUTH_PATH_PREFIXES = [
  "/i/flow/login",
  "/i/flow/sign",
  "/i/oauth",
  "/login",
  "/account",
  "/oauth",
] as const;

/**
 * Auth path patterns – Some domains are both chatbot AND auth domains (e.g. x.com).
 * For these, we only trigger auth redirect when the path matches a login/auth flow.
 * SameSite cookie restrictions prevent these from working in iframes.
 */
export const AUTH_REDIRECT_PATH_PATTERNS: HostPathPattern[] =
  X_COM_AUTH_PATH_PREFIXES.map((pathPrefix) => ({
    host: "x.com",
    pathPrefix,
  }));

// --- Grok SSO ---

/**
 * Grok SSO cookie-chain domains.
 * Participate in the Grok auth flow's multi-domain set-cookie chain.
 * Cookies set here (sso, sso-rw) are critical for session recognition.
 * They need origin spoofing + cookie injection when accessed from iframe.
 */
export const GROK_SSO_DOMAINS = [
  "auth.x.ai",
  "auth.grok.com",
  "auth.grokipedia.com",
  "auth.grokusercontent.com",
] as const;
