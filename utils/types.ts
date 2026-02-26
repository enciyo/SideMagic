/**
 * Shared type definitions – Interfaces and types shared across all modules.
 */

/** Page data retrieved from the source tab */
export interface SourceTabData {
  url: string;
  title: string;
  html: string;
  text: string;
}

/** Runtime message types */
export type MessageType =
  | "GET_SOURCE_TAB_DATA"
  | "GET_SOURCE_TAB_URL"
  | "SETUP_FILE_INTERCEPT"
  | "OPEN_COMMAND_PALETTE"
  | "AUTH_REDIRECT_DETECTED"
  | "AUTH_TAB_CLOSED";

/** Runtime message structure sent to background */
export interface RuntimeMessage {
  type: MessageType;
  content?: string;
  filename?: string;
  mimeType?: string;
  /** Auth redirect URL (for AUTH_REDIRECT_DETECTED) */
  url?: string;
  /** Origin URL of the content script's frame (for SETUP_FILE_INTERCEPT tab discovery) */
  originUrl?: string;
}

/** Runtime message response structure */
export interface RuntimeResponse {
  success: boolean;
  data?: SourceTabData;
  url?: string;
  error?: string;
}
