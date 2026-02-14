/**
 * Strategy 2: Upload button → menu → Main World interception.
 *
 * PROBLEM: Content scripts run in an "isolated world".
 * HTMLInputElement.prototype overrides are not visible to page JS.
 *
 * SOLUTION:
 * - Firefox: wrappedJSObject + exportFunction (browser native API, CSP independent)
 * - Chrome: background scripting.executeScript + world:'MAIN' (CSP independent)
 */

import type { SiteConfig } from "../site-config";
import { wait, deepQueryAll, isFirefox } from "../dom-helpers";
import { TIMEOUTS } from "../constants";
import {
  createFileFromContent,
  setFileOnInput,
  hideUploadMenu,
  unhideUploadMenu,
  clickUploadMenuItem,
  findAttachButton,
} from "./helpers";

// ── Firefox: Direct override via wrappedJSObject ──────────────────────

function setupInterceptFirefox(): {
  getInterceptedInput: () => HTMLInputElement | null;
  restore: () => void;
} {
  if (!import.meta.env.FIREFOX) throw new Error("Firefox-only API");
  // Firefox content script: wrappedJSObject + exportFunction (X-ray vision)
  const pageWin = (window as Window & { wrappedJSObject?: typeof window }).wrappedJSObject!;
  const expFn = (globalThis as typeof globalThis & {
    exportFunction?: (fn: (...args: unknown[]) => unknown, target: object) => (...args: unknown[]) => unknown;
  }).exportFunction!;

  let interceptedInput: HTMLInputElement | null = null;
  const origClick = pageWin.HTMLInputElement.prototype.click;
  const origShowPicker = pageWin.HTMLInputElement.prototype.showPicker;

  const restore = () => {
    pageWin.HTMLInputElement.prototype.click = origClick;
    if (origShowPicker) {
      pageWin.HTMLInputElement.prototype.showPicker = origShowPicker;
    }
  };

  pageWin.HTMLInputElement.prototype.click = expFn(function (this: HTMLInputElement) {
    if (this.type === "file") {
      console.log("SideMagic [Firefox]: File input .click() intercepted!");
      interceptedInput = this;
      return;
    }
    return origClick.call(this);
  }, pageWin);

  if (origShowPicker) {
    pageWin.HTMLInputElement.prototype.showPicker = expFn(function (this: HTMLInputElement) {
      if (this.type === "file") {
        console.log("SideMagic [Firefox]: File input .showPicker() intercepted!");
        interceptedInput = this;
        return;
      }
      return origShowPicker.call(this);
    }, pageWin);
  }

  return {
    getInterceptedInput: () => interceptedInput,
    restore,
  };
}

// ── Chrome: background scripting.executeScript ────────────────────────

async function setupInterceptChrome(
  content: string,
  filename: string,
  mimeType: string,
): Promise<boolean> {
  console.log("SideMagic [Chrome]: Attempting background interception...");
  try {
    const response = await browser.runtime.sendMessage({
      type: "SETUP_FILE_INTERCEPT",
      content,
      filename,
      mimeType,
    });
    return response?.success === true;
  } catch (err) {
    console.warn("SideMagic [Chrome]: Background interception failed:", err);
    return false;
  }
}

// ── Firefox flow ──────────────────────────────────────────────────────

async function tryFirefoxIntercept(
  content: string,
  filename: string,
  mimeType: string,
  config: SiteConfig,
  attachBtn: HTMLElement,
): Promise<boolean> {
  console.log("SideMagic [S2]: Firefox wrappedJSObject method");
  const { getInterceptedInput, restore } = setupInterceptFirefox();

  attachBtn.click();
  await wait(TIMEOUTS.BUTTON_CLICK_WAIT);

  if (config.uploadMenuItemKeywords?.length) {
    clickUploadMenuItem(config.uploadMenuItemKeywords);
    await wait(TIMEOUTS.FIREFOX_MENU_ITEM_WAIT);
  }

  await wait(TIMEOUTS.FIREFOX_INTERCEPT_EXTRA_WAIT);
  restore();

  const capturedInput = getInterceptedInput();
  if (capturedInput) {
    console.log("SideMagic [S2-Firefox]: Input captured, setting file...");
    const file = createFileFromContent(content, filename, mimeType);
    if (setFileOnInput(capturedInput, file)) {
      console.log("SideMagic [S2-Firefox]: Success!");
      unhideUploadMenu(config);
      return true;
    }
  }

  console.log("SideMagic [S2-Firefox]: Input not captured, searching DOM...");
  const file = createFileFromContent(content, filename, mimeType);
  const fileInputs = deepQueryAll<HTMLInputElement>("input[type='file']");
  for (const fi of fileInputs) {
    if (setFileOnInput(fi, file)) {
      unhideUploadMenu(config);
      return true;
    }
  }

  unhideUploadMenu(config);
  return false;
}

// ── Chrome flow ───────────────────────────────────────────────────────

async function tryChromeIntercept(
  content: string,
  filename: string,
  mimeType: string,
  config: SiteConfig,
  attachBtn: HTMLElement,
): Promise<boolean> {
  console.log("SideMagic [S2]: Chrome background method");
  const interceptReady = await setupInterceptChrome(content, filename, mimeType);

  if (!interceptReady) {
    console.log("SideMagic [S2-Chrome]: Background interception setup failed");
    return await tryChromeFallback(content, filename, mimeType, config, attachBtn);
  }

  attachBtn.click();
  await wait(TIMEOUTS.BUTTON_CLICK_WAIT);
  if (config.uploadMenuItemKeywords?.length) {
    clickUploadMenuItem(config.uploadMenuItemKeywords);
    await wait(TIMEOUTS.MENU_WAIT);
  }

  await wait(TIMEOUTS.CHROME_INTERCEPT_WAIT);

  const success = await new Promise<boolean>((resolve) => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "SIDEMAGIC_INTERCEPT_RESULT") {
        window.removeEventListener("message", handler);
        resolve(event.data.success);
      }
    };
    window.addEventListener("message", handler);
    setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(false);
    }, TIMEOUTS.CHROME_INTERCEPT_RESULT);
  });

  if (success) {
    console.log("SideMagic [S2-Chrome]: Success!");
    unhideUploadMenu(config);
    return true;
  }

  return await tryChromeFallback(content, filename, mimeType, config, attachBtn);
}

/** Chrome fallback: click button directly + search for file input in DOM */
async function tryChromeFallback(
  content: string,
  filename: string,
  mimeType: string,
  config: SiteConfig,
  attachBtn: HTMLElement,
): Promise<boolean> {
  attachBtn.click();
  await wait(TIMEOUTS.CHROME_FALLBACK_WAIT);
  if (config.uploadMenuItemKeywords?.length) {
    clickUploadMenuItem(config.uploadMenuItemKeywords);
    await wait(TIMEOUTS.CHROME_FALLBACK_MENU_WAIT);
  }
  await wait(TIMEOUTS.CHROME_FALLBACK_EXTRA_WAIT);

  const file = createFileFromContent(content, filename, mimeType);
  const fileInputs = deepQueryAll<HTMLInputElement>("input[type='file']");
  for (const fi of fileInputs) {
    if (setFileOnInput(fi, file)) {
      unhideUploadMenu(config);
      return true;
    }
  }

  unhideUploadMenu(config);
  return false;
}

// ── Main entry ────────────────────────────────────────────────────────

export async function tryButtonThenIntercept(
  content: string,
  filename: string,
  mimeType: string,
  config: SiteConfig,
): Promise<boolean> {
  console.log("SideMagic [S2]: Attempting upload button + interception...");

  const attachBtn = findAttachButton(config);
  if (!attachBtn) {
    console.log("SideMagic [S2]: Upload button not found");
    return false;
  }

  hideUploadMenu(config);

  if (isFirefox) {
    return await tryFirefoxIntercept(content, filename, mimeType, config, attachBtn);
  }

  return await tryChromeIntercept(content, filename, mimeType, config, attachBtn);
}
