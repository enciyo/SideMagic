/**
 * Frame Embedding – Auth Redirect
 * Iframe auth domain’a gidince tespit eder, launchWebAuthFlow popup açar;
 * AUTH_REDIRECT_DETECTED / AUTH_TAB_CLOSED yayınlar, cooldown sonrası iframe’e izin verir.
 * Strateji: webRequest.onBeforeRequest + blocking.
 */

import { launchAuthFlow } from "../identity-auth";
import {
  AUTH_REDIRECT_DOMAINS,
  AUTH_REDIRECT_EXCLUDE_PATTERNS,
  AUTH_REDIRECT_PATH_PATTERNS,
} from "./constants";

const AUTH_COOLDOWN_MS = 30_000;

type WebRequestDetails = { url: string; type: string; tabId: number };
type WebRequestApi = {
  onBeforeRequest: {
    addListener: (
      callback: (details: WebRequestDetails) => { cancel: boolean } | void,
      filter: { urls: string[]; types: string[] },
      extraInfoSpec: string[],
    ) => void;
  };
};

const authRedirectState = {
  isFlowActive: false,
  cooldownEndTime: 0,
  lastBlockedAuthUrl: "",
};

function getWebRequest(): WebRequestApi | undefined {
  if (!import.meta.env.FIREFOX) return undefined;
  return browser.webRequest as WebRequestApi | undefined;
}

function isInCooldown(): boolean {
  return Date.now() < authRedirectState.cooldownEndTime;
}

function startCooldown(): void {
  authRedirectState.cooldownEndTime = Date.now() + AUTH_COOLDOWN_MS;
}

function isAuthRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    const isExcluded = AUTH_REDIRECT_EXCLUDE_PATTERNS.some(
      (pattern) =>
        hostname === pattern.host &&
        parsed.pathname.startsWith(pattern.pathPrefix),
    );
    if (isExcluded) return false;

    const isAuthDomain = AUTH_REDIRECT_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
    if (isAuthDomain) return true;

    return AUTH_REDIRECT_PATH_PATTERNS.some(
      (pattern) =>
        hostname === pattern.host &&
        parsed.pathname.startsWith(pattern.pathPrefix),
    );
  } catch {
    return false;
  }
}

function notifySidepanel(
  messageType: "AUTH_REDIRECT_DETECTED" | "AUTH_TAB_CLOSED",
  url: string,
): void {
  browser.runtime.sendMessage({ type: messageType, url }).catch(() => {});
}

export function openAuth(authUrl: string): void {
  if (authRedirectState.isFlowActive) return;

  authRedirectState.isFlowActive = true;
  authRedirectState.lastBlockedAuthUrl = authUrl;
  notifySidepanel("AUTH_REDIRECT_DETECTED", authUrl);

  launchAuthFlow(authUrl, true)
    .then(() => {
      startCooldown();
      notifySidepanel("AUTH_TAB_CLOSED", authRedirectState.lastBlockedAuthUrl);
    })
    .catch(() => {
      startCooldown();
      notifySidepanel("AUTH_TAB_CLOSED", authRedirectState.lastBlockedAuthUrl);
    })
    .finally(() => {
      authRedirectState.isFlowActive = false;
    });
}

export function setupAuthRedirect(): void {
  const webRequest = getWebRequest();
  if (!webRequest?.onBeforeRequest) return;

  try {
    webRequest.onBeforeRequest.addListener(
      (details: WebRequestDetails) => {
        const isSidepanelFrame =
          details.type === "sub_frame" && details.tabId === -1;
        if (!isSidepanelFrame || !isAuthRedirectUrl(details.url)) return;
        if (isInCooldown()) return;

        authRedirectState.lastBlockedAuthUrl = details.url;
        openAuth(details.url);
        return { cancel: true };
      },
      { urls: ["<all_urls>"], types: ["sub_frame"] },
      ["blocking"],
    );
  } catch {
    // webRequest blocking not available (e.g. Chrome MV3)
  }
}
