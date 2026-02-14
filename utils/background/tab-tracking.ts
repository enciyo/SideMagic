/**
 * Active tab tracking – Keeps track of the last non-chatbot tab
 * so we can fetch its content when a command is executed.
 */

import { CHATBOT_DOMAINS } from "../constants";
import { msg } from "../i18n";

export function isChatbotTab(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const hostname = new URL(url).hostname;
    return CHATBOT_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`),
    );
  } catch {
    return false;
  }
}

/** Creates tab tracking listeners and returns getter/setter for lastSourceTabId */
export function setupTabTracking(): {
  getLastSourceTabId: () => number | undefined;
} {
  let lastSourceTabId: number | undefined;

  browser.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await browser.tabs.get(activeInfo.tabId);
      if (!isChatbotTab(tab.url)) {
        lastSourceTabId = activeInfo.tabId;
      }
    } catch {
      // Tab may have been closed
    }
  });

  browser.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
    if (changeInfo.url && tab.active && !isChatbotTab(changeInfo.url)) {
      lastSourceTabId = tab.id;
    }
  });

  return {
    getLastSourceTabId: () => lastSourceTabId,
  };
}

/**
 * Returns the best source tab (non-chatbot) to fetch content from.
 * Tries: given tab id → active tab → most recently accessed tab in window.
 * @throws Error if no valid source tab found
 */
export async function getSourceTab(sourceTabId: number | undefined): Promise<Browser.tabs.Tab> {
  if (sourceTabId !== undefined) {
    try {
      const tab = await browser.tabs.get(sourceTabId);
      if (tab.url && !isChatbotTab(tab.url)) {
        return tab;
      }
    } catch {
      // Tab may have been closed
    }
  }

  const [activeTab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (activeTab && !isChatbotTab(activeTab.url)) {
    return activeTab;
  }

  const allTabs = await browser.tabs.query({ currentWindow: true });
  const source = allTabs
    .filter((t) => t.url && !isChatbotTab(t.url))
    .sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];

  if (source) return source;
  throw new Error(msg("errorSourceTabNotFound"));
}
