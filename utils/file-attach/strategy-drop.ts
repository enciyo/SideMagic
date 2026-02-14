/**
 * Strategy 3: Drop event simulation.
 * Dispatches dragenter → dragover → drop events on the input area.
 *
 * NOTE: drop event uses bubbles:false to prevent duplicate processing
 * on sites where multiple ancestor elements listen for drop (e.g. Kimi/Vue).
 */

import type { SiteConfig } from "../site-config";
import { wait } from "../dom-helpers";
import { TIMEOUTS } from "../constants";

export async function tryDropFile(
  file: File,
  config: SiteConfig,
): Promise<boolean> {
  console.log("SideMagic [S3-Drop]: Attempting drop simulation...");

  const targets = [
    document.querySelector<HTMLElement>(config.inputSelector),
    document.querySelector<HTMLElement>("[role='textbox']"),
    document.querySelector<HTMLElement>("textarea"),
    document.body,
  ].filter(Boolean) as HTMLElement[];

  for (const target of targets) {
    try {
      // dragenter/dragover use EMPTY DataTransfer (visual feedback only).
      // File data is ONLY in the drop event to prevent duplicate processing
      // on sites that read DataTransfer in dragover (e.g. Kimi/Vue).
      const emptyDt = new DataTransfer();
      target.dispatchEvent(
        new DragEvent("dragenter", { bubbles: true, dataTransfer: emptyDt }),
      );
      target.dispatchEvent(
        new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: emptyDt }),
      );

      // Only the drop event carries the actual file
      const dropDt = new DataTransfer();
      dropDt.items.add(file);
      target.dispatchEvent(
        new DragEvent("drop", { bubbles: false, cancelable: true, dataTransfer: dropDt }),
      );

      console.log("SideMagic [S3-Drop]: Drop event sent to:", target.tagName, target.className);
      await wait(TIMEOUTS.DROP_WAIT);
      return true;
    } catch (err) {
      console.warn("SideMagic [S3-Drop]: Drop failed:", err);
    }
  }

  return false;
}
