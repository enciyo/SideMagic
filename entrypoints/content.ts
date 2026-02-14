/**
 * Content Script – Runs on chatbot pages
 *
 * Responsibilities:
 * 1. Process commands: /website, /website-text, /url (only from Cmd+. palette)
 * 2. File attachment: "Upload a file" simulation (DataTransfer) + paste fallback
 * Input "/" does not open a dropdown; palette only opens via Cmd+. in the sidepanel.
 */

import { getSiteConfig, type SiteConfig } from "~/utils/site-config";
import { COMMANDS, type SlashCommand } from "~/utils/slash-menu";
import { attachFile } from "~/utils/file-attach/index";
import { showToast } from "~/utils/toast";
import { msg } from "~/utils/i18n";
import type { SourceTabData } from "~/utils/types";

export default defineContentScript({
  matches: [
    "*://gemini.google.com/*",
    "*://claude.ai/*",
    "*://x.com/*",
    "*://grok.com/*",
    "*://kimi.com/*",
    "*://www.kimi.com/*",
  ],
  allFrames: true, // Also run in iframes inside the side panel
  runAt: "document_idle",

  main(_ctx) {
    const config = getSiteConfig();
    if (!config) return;

    // Execute commands from the Cmd+. palette in the side panel (single trigger)
    window.addEventListener("message", (e) => {
      if (e.source !== window.parent) return;
      const d = e.data as { type?: string; commandId?: string };
      if (d?.type !== "SIDEMAGIC_RUN_COMMAND" || !d?.commandId) return;
      const cmd = COMMANDS.find((c) => c.id === d.commandId);
      if (cmd) handleCommand(cmd, config);
    });
  },
});

/**
 * Clear the slash command from the input field
 */
function clearSlashCommand(el: HTMLElement): void {
  const text = (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)
    ? el.value
    : (el.textContent ?? "");
  const cleaned = text.replace(/\/\S*$/, "").trimEnd();

  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    el.value = cleaned;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    el.textContent = cleaned;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

/**
 * Insert text into the input field (for /url command)
 */
function insertTextToInput(el: HTMLElement, text: string): void {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    el.value += text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    // contenteditable
    el.focus();
    // Insert via execCommand – most reliable for contenteditable
    document.execCommand("insertText", false, text);
  }
}

// ── Command Handler ──────────────────────────────────────────────────

async function handleCommand(
  command: SlashCommand,
  config: SiteConfig,
): Promise<void> {
  const inputEl = document.querySelector<HTMLElement>(config.inputSelector);
  if (inputEl) {
    clearSlashCommand(inputEl);
  }

  try {
    switch (command.id) {
      case "url":
        await handleUrlCommand(config);
        break;
      case "website":
        await handleWebsiteCommand(config, "html");
        break;
      case "website-text":
        await handleWebsiteCommand(config, "text");
        break;
    }
  } catch (err) {
    console.error("SideMagic: Command error:", err);
    showToast(
      msg("errorPrefix", err instanceof Error ? err.message : msg("toastUnknownError")),
      "error",
    );
  }
}

async function handleUrlCommand(config: SiteConfig): Promise<void> {
  const response = await browser.runtime.sendMessage({
    type: "GET_SOURCE_TAB_URL",
  });

  if (!response?.success) {
    showToast(response?.error ?? msg("toastUrlFailed"), "error");
    return;
  }

  const inputEl = document.querySelector<HTMLElement>(config.inputSelector);
  if (inputEl) {
    insertTextToInput(inputEl, response.url);
    showToast(msg("toastUrlAdded"), "success");
  }
}

async function handleWebsiteCommand(
  config: SiteConfig,
  type: "html" | "text",
): Promise<void> {
  showToast(msg("toastFetchingContent"), "info");

  const response = await browser.runtime.sendMessage({
    type: "GET_SOURCE_TAB_DATA",
  });

  if (!response?.success) {
    showToast(response?.error ?? msg("toastContentFailed"), "error");
    return;
  }

  const data = response.data as SourceTabData;

  // File name: tab title; special characters cleaned, truncated to 60 chars
  const safeTitle = (data.title || new URL(data.url).hostname)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);

  let content: string;
  let filename: string;
  let mimeType: string;

  if (type === "html") {
    content = data.html;
    filename = `${safeTitle}.html`;
    mimeType = "text/html";
  } else {
    content = data.text;
    filename = `${safeTitle}.txt`;
    mimeType = "text/plain";
  }

  const success = await attachFile(content, filename, mimeType, config);
  if (success) {
    showToast(msg("toastFileAttached", filename), "success");
  } else {
    showToast(msg("toastAttachNotSupported"), "error");
  }
}
