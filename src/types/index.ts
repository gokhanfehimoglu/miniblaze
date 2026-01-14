export interface TextNode {
  type: "text";
  content: string;
}

export interface WebsiteCommandNode {
  type: "website";
  id: string;
  xpath?: string;
  urlMatch?: string;
}

export type SnippetBodyNode = TextNode | WebsiteCommandNode;

export interface Snippet {
  id: string;
  name: string;
  shortcut: string;
  body: SnippetBodyNode[];
}

export interface CommandInfo {
  title: string;
  description: string;
  enabled: boolean;
}

export const AVAILABLE_COMMANDS: CommandInfo[] = [
  { title: "Website", description: "Extract data from website", enabled: true },
  { title: "Date/Time", description: "Insert date and time", enabled: false },
  { title: "Clipboard", description: "Insert clipboard content", enabled: false },
  { title: "Place cursor", description: "Cursor location after insertion", enabled: false },
  { title: "Formula", description: "Dynamic calculation", enabled: false },
  { title: "If/Else condition", description: "Hide/show contents", enabled: false },
];
