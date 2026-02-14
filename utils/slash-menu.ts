/**
 * Command definitions – Single source for slash commands and palette commands.
 */

export interface SlashCommand {
  id: string;
  label: string;
  descriptionKey: string;
}

export const COMMANDS: SlashCommand[] = [
  { id: "website", label: "/website", descriptionKey: "cmdWebsiteDesc" },
  { id: "website-text", label: "/website-text", descriptionKey: "cmdWebsiteTextDesc" },
  { id: "url", label: "/url", descriptionKey: "cmdUrlDesc" },
];
