/**
 * Chrome MV3: Main World File Interception (background handler).
 *
 * NOTE: This module is kept for backward compatibility. The primary
 * interception mechanism is now handled directly in the content script
 * (strategy-intercept.ts) via external <script src> injection of
 * intercept-main-world.js — which avoids the sender.tab / documentId
 * issues entirely.
 *
 * If a future scenario requires background-initiated injection (e.g.
 * for tabs that are NOT inside the side panel), this handler is available.
 */

import { TIMEOUTS } from "../constants";

export async function handleSetupFileIntercept(
  sender: Browser.runtime.MessageSender,
  content: string,
  filename: string,
  mimeType: string,
  _originUrl?: string,
): Promise<boolean> {
  const tabId = sender.tab?.id;
  const frameId = sender.frameId ?? 0;

  if (tabId === undefined) {
    // Content script is inside the side panel's extension iframe.
    // Interception is handled client-side via <script src> injection.
    console.log(
      "SideMagic [Intercept]: No tabId (side-panel context) – " +
        "interception handled client-side via intercept-main-world.js",
    );
    return false;
  }

  if (!browser.scripting?.executeScript) {
    console.log("SideMagic [Intercept]: scripting.executeScript not available");
    return false;
  }

  try {
    await browser.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      world: "MAIN",
      func: (
        fileContent: string,
        fileName: string,
        fileMimeType: string,
        eventDispatchMs: number,
        interceptTimeoutMs: number,
      ) => {
        let intercepted = false;
        const origClick = HTMLInputElement.prototype.click;
        const origShowPicker = HTMLInputElement.prototype.showPicker;

        function restore(): void {
          HTMLInputElement.prototype.click = origClick;
          if (origShowPicker) HTMLInputElement.prototype.showPicker = origShowPicker;
        }

        function handleIntercept(input: HTMLInputElement): void {
          if (intercepted) return;
          intercepted = true;

          const blob = new Blob([fileContent], { type: fileMimeType });
          const file = new File([blob], fileName, {
            type: fileMimeType,
            lastModified: Date.now(),
          });
          const dt = new DataTransfer();
          dt.items.add(file);

          const nativeSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            "files",
          )?.set;
          if (nativeSetter) {
            nativeSetter.call(input, dt.files);
          } else {
            input.files = dt.files;
          }

          restore();

          setTimeout(() => {
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new Event("input", { bubbles: true }));
            window.postMessage({ type: "SIDEMAGIC_INTERCEPT_RESULT", success: true }, "*");
          }, eventDispatchMs);
        }

        HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
          if (this.type === "file" && !intercepted) {
            handleIntercept(this);
            return;
          }
          return origClick.call(this);
        };

        if (origShowPicker) {
          HTMLInputElement.prototype.showPicker = function (this: HTMLInputElement) {
            if (this.type === "file" && !intercepted) {
              handleIntercept(this);
              return;
            }
            return origShowPicker.call(this);
          };
        }

        setTimeout(() => {
          if (!intercepted) {
            restore();
            window.postMessage({ type: "SIDEMAGIC_INTERCEPT_RESULT", success: false }, "*");
          }
        }, interceptTimeoutMs);
      },
      args: [content, filename, mimeType, TIMEOUTS.EVENT_DISPATCH, TIMEOUTS.INTERCEPT],
    });

    return true;
  } catch (err) {
    console.error("SideMagic [Intercept]: executeScript failed:", err);
    return false;
  }
}
