/**
 * Source tab data retrieval – Fetches HTML/text/URL from the source tab.
 * Chrome MV3: scripting API. Firefox MV2: tabs.executeScript fallback.
 */

import { msg } from "../i18n";
import type { SourceTabData } from "../types";
import { getSourceTab } from "./tab-tracking";

/** Injected script for Firefox MV2 (tabs.executeScript); must return same shape as SourceTabData */
const FIREFOX_SOURCE_TAB_SCRIPT = `({
  url: window.location.href,
  title: document.title,
  html: document.documentElement.outerHTML,
  text: document.body.innerText,
})`;

/** Firefox MV2 tabs.executeScript API shape (not in standard browser types) */
type FirefoxTabsExecuteScript = (
  tabId: number,
  details: { code: string },
) => Promise<unknown[]>;

export async function handleGetSourceTabData(sourceTabId: number | undefined): Promise<SourceTabData> {
  const tab = await getSourceTab(sourceTabId);
  if (!tab.id) throw new Error(msg("errorTabIdNotFound"));

  try {
    const results = await browser.scripting.executeScript({
      target: { tabId: tab.id },
      func: (): SourceTabData => ({
        url: window.location.href,
        title: document.title,
        html: document.documentElement.outerHTML,
        text: document.body.innerText,
      }),
    });
    const result = results?.[0]?.result as SourceTabData | undefined;
    if (result) return result;
  } catch {
    console.log("SideMagic: scripting API not available, trying tabs.executeScript");
  }

  // Firefox MV2 fallback: tabs.executeScript (not scripting.executeScript)
  if (!import.meta.env.FIREFOX) throw new Error(msg("errorPageContentFailed"));

  try {
    const executeScript = (browser.tabs as { executeScript: FirefoxTabsExecuteScript }).executeScript;
    if (!executeScript) throw new Error("executeScript missing");
    const results = await executeScript(tab.id, { code: FIREFOX_SOURCE_TAB_SCRIPT });
    const result = results?.[0] as SourceTabData | undefined;
    if (result) return result;
  } catch (err) {
    console.error("SideMagic: tabs.executeScript error:", err);
  }

  throw new Error(msg("errorPageContentFailed"));
}

export async function handleGetSourceTabUrl(sourceTabId: number | undefined): Promise<string> {
  const tab = await getSourceTab(sourceTabId);
  return tab.url ?? "";
}
