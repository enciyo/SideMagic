/**
 * OAuth / auth flow via browser.identity.launchWebAuthFlow.
 *
 * Use when the provider redirects to identity.getRedirectURL() with tokens.
 * For providers that don't (e.g. Grok), we still use launchWebAuthFlow to open
 * the auth URL in a popup; when the user closes the popup the promise rejects
 * and we treat that as "flow ended".
 */

const id = browser.identity;

/**
 * Extension redirect URL for OAuth2 (must be registered with the provider).
 */
export function getRedirectURL(): string | null {
  try {
    return id?.getRedirectURL?.() ?? null;
  } catch {
    return null;
  }
}

/**
 * Launch auth in a popup via identity API.
 * - If the provider redirects to getRedirectURL(), the promise resolves with that URL.
 * - Otherwise (e.g. Grok redirects to grok.com), the promise rejects when the user closes the popup.
 */
export function launchAuthFlow(authUrl: string, interactive = true): Promise<string | null> {
  if (!id?.launchWebAuthFlow) {
    return Promise.reject(new Error("identity.launchWebAuthFlow not available"));
  }
  return id
    .launchWebAuthFlow({ url: authUrl, interactive })
    .then((redirectUrl) => redirectUrl ?? null)
    .catch((err: unknown) => {
      // User closed popup or provider didn't redirect to us – treat as flow ended
      throw err;
    });
}

/**
 * True if identity.launchWebAuthFlow is available (permission + API).
 */
export function isIdentityAuthAvailable(): boolean {
  return typeof id?.launchWebAuthFlow === "function";
}
