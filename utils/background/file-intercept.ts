/**
 * Chrome MV3: Main World File Interception.
 * Injects into the page JS context (world: MAIN) to override
 * HTMLInputElement.prototype.click and .showPicker for type="file" inputs.
 */

import { TIMEOUTS } from "../constants";

export async function handleSetupFileIntercept(
  sender: Browser.runtime.MessageSender,
  content: string,
  filename: string,
  mimeType: string,
): Promise<boolean> {
  const tabId = sender.tab?.id;
  const frameId = sender.frameId ?? 0;

  if (tabId === undefined) {
    console.error("SideMagic: SETUP_FILE_INTERCEPT – no tab ID");
    return false;
  }

  if (!browser.scripting?.executeScript) {
    console.log("SideMagic: scripting.executeScript not available (Firefox MV2?)");
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
        console.log("SideMagic [MainWorld]: Setting up interception...");

        let intercepted = false;
        const origClick = HTMLInputElement.prototype.click;
        const origShowPicker = HTMLInputElement.prototype.showPicker;

        function restore(): void {
          HTMLInputElement.prototype.click = origClick;
          if (origShowPicker) {
            HTMLInputElement.prototype.showPicker = origShowPicker;
          }
        }

        function handleIntercept(input: HTMLInputElement): void {
          if (intercepted) return;
          intercepted = true;
          console.log("SideMagic [MainWorld]: File input intercepted!");

          const blob = new Blob([fileContent], { type: fileMimeType });
          const file = new File([blob], fileName, {
            type: fileMimeType,
            lastModified: Date.now(),
          });
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;

          restore();

          setTimeout(() => {
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new Event("input", { bubbles: true }));
            window.postMessage(
              { type: "SIDEMAGIC_INTERCEPT_RESULT", success: true },
              "*",
            );
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
            window.postMessage(
              { type: "SIDEMAGIC_INTERCEPT_RESULT", success: false },
              "*",
            );
          }
        }, interceptTimeoutMs);
      },
      args: [content, filename, mimeType, TIMEOUTS.EVENT_DISPATCH, TIMEOUTS.INTERCEPT],
    });

    console.log(`SideMagic: Main world interception set up (tab:${tabId}, frame:${frameId})`);
    return true;
  } catch (err) {
    console.error("SideMagic: executeScript error:", err);
    return false;
  }
}
