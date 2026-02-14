/**
 * Strategy 4: Paste file attachment.
 * Dispatches a clipboard paste event with the file as clipboard data.
 */

import type { SiteConfig } from "../site-config";
import { wait } from "../dom-helpers";
import { TIMEOUTS } from "../constants";

export async function tryPasteFile(
  file: File,
  config: SiteConfig,
): Promise<boolean> {
  if (!config.supportsPasteFile) {
    console.log("SideMagic [S4-Paste]: This site does not support file paste:", config.id);
    return false;
  }

  console.log("SideMagic [S4-Paste]: Attempting paste simulation...");

  const inputEl = document.querySelector<HTMLElement>(config.inputSelector);
  if (!inputEl) {
    console.log("SideMagic [S4-Paste]: Input field not found");
    return false;
  }

  // Some sites (e.g. Kimi) start with contenteditable="false" and activate on click
  if (inputEl.getAttribute("contenteditable") === "false") {
    console.log("SideMagic [S4-Paste]: Activating contenteditable via click...");
    inputEl.click();
    await wait(TIMEOUTS.PASTE_FOCUS_WAIT);
  }

  inputEl.focus();
  await wait(TIMEOUTS.PASTE_FOCUS_WAIT);

  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    });
    const handled = !inputEl.dispatchEvent(pasteEvent);
    if (handled) {
      console.log("SideMagic [S4-Paste]: Paste successful");
      return true;
    }
  } catch (e) {
    console.warn("SideMagic [S4-Paste]: ClipboardEvent error:", e);
  }

  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    const ev = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(ev, "clipboardData", { value: dt });
    inputEl.dispatchEvent(ev);
    return true;
  } catch (e) {
    console.warn("SideMagic [S4-Paste]: Manual paste error:", e);
  }

  return false;
}
