/**
 * File attachment helper utilities.
 * Shared functions used by multiple file-attach strategies.
 */

import type { SiteConfig } from "../site-config";
import { deepQueryAll } from "../dom-helpers";
import { TIMEOUTS } from "../constants";

// ── File creation ─────────────────────────────────────────────────────

export function createFileFromContent(
  content: string,
  filename: string,
  mimeType: string,
): File {
  const blob = new Blob([content], { type: mimeType });
  return new File([blob], filename, { type: mimeType, lastModified: Date.now() });
}

// ── File input setter ─────────────────────────────────────────────────

export function setFileOnInput(fi: HTMLInputElement, file: File): boolean {
  try {
    const dt = new DataTransfer();
    dt.items.add(file);

    // Prefer native setter (works with React/Vue controlled inputs);
    // fall back to direct assignment. Only ONE change event to avoid duplicates.
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "files",
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(fi, dt.files);
    } else {
      fi.files = dt.files;
    }

    fi.dispatchEvent(new Event("change", { bubbles: true }));
    fi.dispatchEvent(new Event("input", { bubbles: true }));

    return true;
  } catch (err) {
    console.warn("SideMagic [setFileOnInput]: Failed:", err);
    return false;
  }
}

// ── Upload menu visibility ────────────────────────────────────────────

const HIDE_STYLE_ID = "__sidemagic_hide_overlay";

/**
 * Hides the upload menu via CSS so the user doesn't see it while the DOM flow still works.
 * Uses selectors from SiteConfig.uploadMenuHideSelectors.
 */
export function hideUploadMenu(config: SiteConfig): void {
  if (!config.uploadMenuHideSelectors) return;
  if (document.getElementById(HIDE_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = HIDE_STYLE_ID;
  style.textContent = `
    ${config.uploadMenuHideSelectors} {
      opacity: 0 !important;
      pointer-events: auto !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Removes the hide CSS and closes the menu.
 * Tries: 1) Escape key, 2) dismiss selector click, 3) removes hide CSS after
 * the framework's close animation completes.
 *
 * For toggle-based popovers (e.g. Kimi / Naive UI) clicking the trigger
 * button while the popover is still in the DOM would re-open it, so we
 * prefer Escape first and only fall back to click if the popover persists.
 */
export function unhideUploadMenu(config: SiteConfig): void {
  if (!config.uploadMenuHideSelectors) return;

  // 1) Try Escape key first – works for most popover frameworks
  const sendEscape = (): void => {
    const ev = new KeyboardEvent("keydown", {
      key: "Escape",
      code: "Escape",
      keyCode: 27,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(ev);
    document.dispatchEvent(ev);
  };

  // 2) Click dismiss target only if popover is still present
  const clickDismiss = (): void => {
    if (!config.uploadMenuBackdropSelector) return;
    // Check if the popover is still in the DOM before clicking
    const popover = config.uploadMenuHideSelectors
      ? document.querySelector(config.uploadMenuHideSelectors.split(",")[0]?.trim())
      : null;
    if (!popover) return; // already gone
    const el = document.querySelector<HTMLElement>(config.uploadMenuBackdropSelector);
    if (el) el.click();
  };

  sendEscape();

  // Wait for framework close animation, then clean up
  setTimeout(() => {
    clickDismiss();
    sendEscape();

    // Remove hide CSS after another delay so the dismiss animation completes
    setTimeout(() => {
      document.getElementById(HIDE_STYLE_ID)?.remove();
    }, TIMEOUTS.UNHIDE_MENU_DELAY);
  }, TIMEOUTS.UNHIDE_MENU_DELAY);
}

// ── Upload menu item finder ───────────────────────────────────────────

/** Find and click the "Upload file" option in the menu. */
export function clickUploadMenuItem(keywords: string[]): boolean {
  const candidates = document.querySelectorAll<HTMLElement>(
    [
      "[role='menuitem']",
      "[role='option']",
      "[role='listbox'] > *",
      ".mat-menu-item",
      ".mat-mdc-menu-item",
      "[class*='menu'] button",
      "[class*='menu'] [role='button']",
      "[class*='dropdown'] button",
      "[class*='dropdown'] li",
      "[class*='popup'] button",
      "[class*='popover'] button",
      "[class*='overlay'] button",
      "menu li",
      "ul[role] li",
      "[class*='menu-container'] button",
      "[class*='menu-list'] button",
      "cdk-overlay-container button",
      ".cdk-overlay-pane button",
      ".cdk-overlay-pane [role='menuitem']",
    ].join(", "),
  );

  console.log(`SideMagic [Menu]: Found ${candidates.length} menu candidates`);

  for (const item of candidates) {
    const text = (item.textContent ?? "").toLowerCase().trim();
    const aria = (item.getAttribute("aria-label") ?? "").toLowerCase();
    const combined = `${text} ${aria}`;

    if (keywords.some((kw) => combined.includes(kw.toLowerCase()))) {
      console.log(`SideMagic [Menu]: Upload item found: "${item.textContent?.trim()}"`);
      item.click();
      return true;
    }
  }

  console.log("SideMagic [Menu]: Upload menu item not found");
  return false;
}

// ── Attach button finder ──────────────────────────────────────────────

/** Find the attach/upload button on the page using config selectors and fallback heuristics. */
export function findAttachButton(config: SiteConfig): HTMLElement | null {
  // Skip selector-based search if no attach button is configured (e.g. Kimi)
  if (config.attachButtonSelector) {
    const btn = document.querySelector<HTMLElement>(config.attachButtonSelector);
    if (btn) return btn;

    const deepBtns = deepQueryAll<HTMLElement>(config.attachButtonSelector);
    if (deepBtns.length > 0) return deepBtns[0];
  }

  const uploadKeywords = [
    "upload", "attach", "add file", "dosya yükle", "dosya ekle",
    "yükle", "open upload",
  ];
  const allButtons = document.querySelectorAll<HTMLElement>(
    "button, [role='button'], label[for]",
  );
  for (const el of allButtons) {
    const ariaLabel = (el.getAttribute("aria-label") ?? "").toLowerCase();
    const title = (el.getAttribute("title") ?? "").toLowerCase();
    const tooltip = (el.getAttribute("data-tooltip") ?? "").toLowerCase();
    const text = (el.textContent ?? "").toLowerCase().trim();
    const combined = `${ariaLabel} ${title} ${tooltip} ${text}`;
    if (uploadKeywords.some((kw) => combined.includes(kw))) return el;
  }

  if (config.id === "gemini") {
    for (const b of document.querySelectorAll<HTMLElement>("button")) {
      const icon = b.querySelector("mat-icon, .material-icons, .material-symbols-outlined");
      if (icon) {
        const iconText = (icon.textContent ?? "").trim().toLowerCase();
        if (["add", "attach_file", "upload_file", "add_circle"].includes(iconText)) return b;
      }
    }
  }

  return null;
}
