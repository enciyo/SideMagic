/**
 * CSS selector definitions for each chatbot site.
 * Content script selects the appropriate config based on the active page.
 */
export interface SiteConfig {
  /** Site identifier */
  id: string;
  /** Hostnames */
  hostnames: string[];
  /** Message input field selector (textarea, contenteditable, etc.) */
  inputSelector: string;
  /** File input selector (<input type="file">) – For "Upload a file" simulation */
  fileInputSelector: string;
  /** Attach/upload button selector – To trigger file input */
  attachButtonSelector: string;
  /** Does it accept file paste? (fallback method) */
  supportsPasteFile: boolean;
  /**
   * Two-step upload: For sites that open a menu when the button is clicked,
   * keywords to find the "Upload file" option in the menu.
   */
  uploadMenuItemKeywords?: string[];
  /**
   * Upload menu hiding – CSS selectors for overlay/menu elements to
   * temporarily hide during file upload interception so the user
   * doesn't see the menu flicker. If set, hide/unhide is applied.
   */
  uploadMenuHideSelectors?: string;
  /**
   * Backdrop/close selector – element to click when unhiding the menu
   * (e.g. overlay backdrop). Used together with Escape key to dismiss.
   */
  uploadMenuBackdropSelector?: string;
}

export const SITE_CONFIGS: SiteConfig[] = [
  {
    id: "gemini",
    hostnames: ["gemini.google.com"],
    inputSelector: ".ql-editor, [contenteditable='true'], rich-textarea .ql-editor",
    fileInputSelector: "input[type='file']",
    // Gemini's actual aria-label: "Open upload file menu"
    attachButtonSelector: [
      "button[aria-label='Open upload file menu']",
      "button[aria-label*='upload file menu']",
      "button[aria-label*='Dosya yükleme menüsü']",
      "button[aria-label*='Upload file']",
      "button[aria-label*='upload file']",
      "button[aria-label*='Dosya yükle']",
      "button[aria-label*='dosya yükle']",
    ].join(", "),
    supportsPasteFile: true,
    // Keywords for the "Upload file" menu item (EN + TR)
    uploadMenuItemKeywords: [
      "upload file",
      "upload from computer",
      "from computer",
      "dosya yükle",
      "bilgisayardan yükle",
      "bilgisayardan",
    ],
    // Hide Gemini's Material overlay while interception runs
    uploadMenuHideSelectors: [
      ".cdk-overlay-container",
      ".cdk-overlay-backdrop",
      ".cdk-overlay-pane",
      ".mat-mdc-menu-panel",
      ".mat-menu-panel",
    ].join(", "),
    uploadMenuBackdropSelector: ".cdk-overlay-backdrop, .mat-mdc-dialog-backdrop",
  },
  {
    id: "grok",
    hostnames: ["x.com", "grok.com"],
    inputSelector: "textarea[data-testid='tweetTextarea_0'], textarea, [role='textbox'], [contenteditable='true']",
    fileInputSelector: "input[type='file']",
    attachButtonSelector: "[aria-label='Attach media'], [aria-label='Upload file'], button[aria-label*='attach'], button[aria-label*='upload']",
    supportsPasteFile: false,
  },
  {
    id: "claude",
    hostnames: ["claude.ai"],
    inputSelector: "[contenteditable='true'], .ProseMirror, fieldset textarea",
    fileInputSelector: "input[type='file']",
    attachButtonSelector: "button[aria-label*='Attach'], button[aria-label*='Upload'], [data-testid='file-upload']",
    supportsPasteFile: true,
  },
  {
    id: "kimi",
    hostnames: ["kimi.com", "www.kimi.com"],
    inputSelector: ".chat-input-editor, [contenteditable='true']",
    fileInputSelector: "input[type='file']",
    attachButtonSelector: ".toolkit-trigger-btn, .icon-button.toolkit-trigger-btn",
    supportsPasteFile: false,
    uploadMenuItemKeywords: [
      "upload",
      "file",
      "add files & photos",
      "upload file",
      "local file",
      "from computer",
      "dosya",
      "dosya yükle",
      "bilgisayardan",
    ],
    // Hide Kimi's Naive UI popover during file interception
    uploadMenuHideSelectors: [
      ".v-binder-follower-container",
      ".v-binder-follower-content",
      ".n-popover",
      ".n-popover-shared",
      ".n-popover--raw",
      ".toolkit-popover",
    ].join(", "),
    // Click outside the popover to trigger Naive UI's click-outside dismiss.
    // Using the chat input area as a safe click target that is always present.
    uploadMenuBackdropSelector: ".chat-input-editor, [contenteditable='true']",
  },
];

export function getSiteConfig(): SiteConfig | null {
  const hostname = window.location.hostname;
  return (
    SITE_CONFIGS.find((config) =>
      config.hostnames.some(
        (h) => hostname === h || hostname.endsWith(`.${h}`),
      ),
    ) ?? null
  );
}
