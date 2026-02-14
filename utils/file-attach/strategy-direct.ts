/**
 * Strategy 1: Find existing file inputs and set file directly.
 * Works on Grok and sites that have visible <input type="file"> elements.
 */

import type { SiteConfig } from "../site-config";
import { deepQueryAll } from "../dom-helpers";
import { setFileOnInput } from "./helpers";

export async function tryDirectFileInput(
  file: File,
  _config: SiteConfig,
): Promise<boolean> {
  console.log("SideMagic [S1-Direct]: Searching for existing file inputs...");
  const fileInputs = deepQueryAll<HTMLInputElement>(
    "input[type='file'], input[accept]",
  );
  console.log(`SideMagic [S1-Direct]: Found ${fileInputs.length} file input(s)`);

  for (const fi of fileInputs) {
    if (setFileOnInput(fi, file)) {
      console.log("SideMagic [S1-Direct]: File set successfully!");
      return true;
    }
  }
  return false;
}
