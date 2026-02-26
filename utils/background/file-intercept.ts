/**
 * Chrome MV3: Main World File Interception.
 *
 * KEY ARCHITECTURE:
 * The content script runs inside the chatbot iframe embedded in the SideMagic
 * side panel (an extension page). Extension pages have NO sender.tab.id, BUT
 * they DO have sender.documentId — which directly identifies the exact document
 * to inject into, no tab/frame scanning needed.
 *
 * GEMINI-SPECIFIC FINDING (from debug logs):
 * Gemini does NOT use `<input type="file">` directly. It uses a hidden button
 *   <button class="hidden-local-file-image-selector-button" xapfileselectortrigger>
 * When "Upload files" is clicked, Gemini focuses + programmatically activates
 * this button. Clicking it internally creates a dynamic <input type="file">
 * and calls .click() on it (caught by Layer 1) OR it triggers via a label
 * association (caught by Layer 2).
 *
 * INTERCEPT LAYERS (all three run simultaneously for maximum coverage):
 *  L1. Prototype override  – catches direct input.click() / input.showPicker()
 *  L2. Capturing click listener + preventDefault – catches label-trigger path
 *  L3. MutationObserver – patches file inputs created after setup
 *
 * DEBUG: Console logs in the injected func appear in the CHATBOT DOCUMENT's
 * DevTools (right-click inside the side panel iframe > Inspect, or open
 * chrome://inspect and find the iframe). Filter by "SideMagic" to trace
 * exactly which layer fires (or why it times out).
 */

import { TIMEOUTS } from "../constants";

export async function handleSetupFileIntercept(
  sender: Browser.runtime.MessageSender,
  content: string,
  filename: string,
  mimeType: string,
  _originUrl?: string,
): Promise<boolean> {
  if (!browser.scripting?.executeScript) {
    console.log("SideMagic [Intercept]: scripting.executeScript not available");
    return false;
  }

  // ── Resolve injection target ──────────────────────────────────────────
  // Prefer documentId (works for both extension-page iframes and regular tabs)
  // over the tabId+frameId pair, which is unavailable for extension pages.
  const tabId = sender.tab?.id;
  const frameId = sender.frameId ?? 0;
  const documentId = (sender as Record<string, unknown>).documentId as string | undefined;

  let target: browser.scripting.InjectionTarget;

  if (documentId) {
    // Best case: inject directly into the exact document (Chrome MV3 ≥ 116).
    target = { documentId };
    console.log(`SideMagic [Intercept]: using documentId=${documentId}`);
  } else if (tabId !== undefined) {
    // Fallback: regular tab with frame ID.
    target = { tabId, frameIds: [frameId] };
    console.log(`SideMagic [Intercept]: using tabId=${tabId}, frameId=${frameId}`);
  } else {
    console.error("SideMagic [Intercept]: ❌ No documentId and no tabId – cannot inject");
    return false;
  }

  // ── Inject the interception script into the chatbot's main world ──────
  try {
    await browser.scripting.executeScript({
      target,
      world: "MAIN",
      func: (
        fileContent: string,
        fileName: string,
        fileMimeType: string,
        eventDispatchMs: number,
        interceptTimeoutMs: number,
      ) => {
        // ── All logs below appear in the CHATBOT DOCUMENT's DevTools ──
        console.group("SideMagic [MainWorld] intercept setup");
        console.log(`file: "${fileName}" | mime: ${fileMimeType}`);

        let intercepted = false;
        const origClick = HTMLInputElement.prototype.click;
        const origShowPicker = HTMLInputElement.prototype.showPicker;
        let domObserver: MutationObserver | null = null;

        function restore(): void {
          HTMLInputElement.prototype.click = origClick;
          if (origShowPicker) HTMLInputElement.prototype.showPicker = origShowPicker;
          domObserver?.disconnect();
          domObserver = null;
          console.log("SideMagic [MainWorld]: prototypes restored");
        }

        function handleIntercept(input: HTMLInputElement, source: string): void {
          if (intercepted) {
            console.log("SideMagic [MainWorld]: already intercepted – skip (source:", source, ")");
            return;
          }
          intercepted = true;
          console.log("SideMagic [MainWorld]: ✅ INTERCEPTED via", source, input);

          // Use native property setter so React/Angular/Vue controlled inputs
          // see the new FileList without their synthetic event guard interfering.
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
          console.log("SideMagic [MainWorld]: files assigned", input.files);

          restore();

          setTimeout(() => {
            input.dispatchEvent(new Event("change", { bubbles: true }));
            input.dispatchEvent(new Event("input", { bubbles: true }));
            console.log("SideMagic [MainWorld]: events dispatched → success");
            window.postMessage({ type: "SIDEMAGIC_INTERCEPT_RESULT", success: true }, "*");
          }, eventDispatchMs);
        }

        // ── Layer 1: Prototype override (.click / .showPicker) ──────────
        // Catches: Gemini's internal code doing fileInput.click()
        HTMLInputElement.prototype.click = function (this: HTMLInputElement) {
          console.log("SideMagic [L1-click]: called on type=" + this.type);
          if (this.type === "file" && !intercepted) {
            handleIntercept(this, "L1-prototype.click");
            return;
          }
          return origClick.call(this);
        };

        if (origShowPicker) {
          HTMLInputElement.prototype.showPicker = function (this: HTMLInputElement) {
            console.log("SideMagic [L1-showPicker]: called on type=" + this.type);
            if (this.type === "file" && !intercepted) {
              handleIntercept(this, "L1-prototype.showPicker");
              return;
            }
            return origShowPicker.call(this);
          };
        }

        // ── Layer 2: Capturing click listener + preventDefault ──────────
        // Catches: label-triggered native file pickers (browser fires a
        // trusted click on the input; preventDefault() stops the OS dialog).
        const PATCHED = "__smPatch";
        function patchFileInput(fi: HTMLInputElement): void {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((fi as any)[PATCHED]) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (fi as any)[PATCHED] = 1;
          console.log("SideMagic [L2-patch]: applied to", fi);
          fi.addEventListener(
            "click",
            (e: Event) => {
              console.log(
                "SideMagic [L2-click]: caught on file input – intercepted=" + intercepted,
              );
              if (!intercepted) {
                e.preventDefault();
                e.stopImmediatePropagation();
                handleIntercept(fi, "L2-click-listener");
              }
            },
            { capture: true, once: true },
          );
        }

        const existing = document.querySelectorAll<HTMLInputElement>("input[type='file']");
        console.log("SideMagic [L2]: patching", existing.length, "existing file inputs");
        existing.forEach(patchFileInput);

        // ── Layer 3: MutationObserver – dynamic file inputs ─────────────
        // Catches: inputs created by Angular/CDK after the button click.
        domObserver = new MutationObserver((mutations) => {
          for (const m of mutations) {
            for (const node of m.addedNodes) {
              if (node instanceof HTMLInputElement && node.type === "file") {
                console.log("SideMagic [L3-MO]: new file input added", node);
                patchFileInput(node);
              } else if (node instanceof Element) {
                node
                  .querySelectorAll<HTMLInputElement>("input[type='file']")
                  .forEach((fi) => {
                    console.log("SideMagic [L3-MO]: file input found inside added node", fi);
                    patchFileInput(fi);
                  });
              }
            }
          }
        });
        domObserver.observe(document.documentElement, { childList: true, subtree: true });
        console.log("SideMagic [L3]: MutationObserver watching");

        // ── Timeout guard ──────────────────────────────────────────────
        setTimeout(() => {
          if (!intercepted) {
            console.warn(
              "SideMagic [MainWorld]: ❌ TIMEOUT – no layer fired within",
              interceptTimeoutMs,
              "ms.",
              "Gemini may use a mechanism other than .click()/.showPicker()/label.",
              "Check if 'hidden-local-file-image-selector-button' goes through a different path.",
            );
            restore();
            window.postMessage({ type: "SIDEMAGIC_INTERCEPT_RESULT", success: false }, "*");
          }
        }, interceptTimeoutMs);

        console.groupEnd();
      },
      args: [content, filename, mimeType, TIMEOUTS.EVENT_DISPATCH, TIMEOUTS.INTERCEPT],
    });

    console.log(`SideMagic [Intercept]: ✅ Script injected (target: ${JSON.stringify(target)})`);
    return true;
  } catch (err) {
    console.error("SideMagic [Intercept]: ❌ executeScript failed:", err, "target:", target);
    return false;
  }
}
