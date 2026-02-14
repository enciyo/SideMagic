/**
 * File attachment orchestrator.
 * Tries strategies in order: Direct → Intercept → Drop → Paste.
 */

import type { SiteConfig } from "../site-config";
import { createFileFromContent } from "./helpers";
import { tryDirectFileInput } from "./strategy-direct";
import { tryButtonThenIntercept } from "./strategy-intercept";
import { tryDropFile } from "./strategy-drop";
import { tryPasteFile } from "./strategy-paste";

/**
 * Dismiss any open popups/overlays (e.g. after Strategy 2 opens a menu).
 * Sends Escape keydown to close menus before trying the next strategy.
 */
function dismissPopups(): void {
  const ev = new KeyboardEvent("keydown", {
    key: "Escape",
    code: "Escape",
    keyCode: 27,
    bubbles: true,
  });
  document.body.dispatchEvent(ev);
  document.dispatchEvent(ev);
}

export async function attachFile(
  content: string,
  filename: string,
  mimeType: string,
  config: SiteConfig,
): Promise<boolean> {
  const file = createFileFromContent(content, filename, mimeType);
  console.log(
    `SideMagic: Attaching file – ${filename} (${(content.length / 1024).toFixed(1)} KB), site: ${config.id}`,
  );

  // Strategy 1: Use existing file inputs directly
  if (await tryDirectFileInput(file, config)) return true;

  // Strategy 2: Upload button → menu → main world interception
  if (await tryButtonThenIntercept(content, filename, mimeType, config)) {
    return true;
  }
  // Dismiss any popups opened by Strategy 2 before trying Drop/Paste
  dismissPopups();

  // Strategy 3: Drop simulation
  if (await tryDropFile(file, config)) return true;

  // Strategy 4: Paste simulation
  if (await tryPasteFile(file, config)) return true;

  console.error("SideMagic: File attachment failed – all strategies exhausted");
  return false;
}
