import { Storage } from "@plasmohq/storage";
import type { Snippet } from "~types";

const storage = new Storage();

export async function getSnippets(): Promise<Snippet[]> {
  const snippets = await storage.get<Snippet[]>("snippets");
  return snippets || [];
}

export async function saveSnippets(snippets: Snippet[]): Promise<void> {
  await storage.set("snippets", snippets);
}

export async function getSnippet(id: string): Promise<Snippet | undefined> {
  const snippets = await getSnippets();
  return snippets.find(s => s.id === id);
}

export async function saveSnippet(snippet: Snippet): Promise<void> {
  const snippets = await getSnippets();
  const index = snippets.findIndex(s => s.id === snippet.id);

  if (index >= 0) {
    snippets[index] = snippet;
  } else {
    snippets.push(snippet);
  }

  await saveSnippets(snippets);
}

export async function deleteSnippet(id: string): Promise<void> {
  const snippets = await getSnippets();
  const filtered = snippets.filter(s => s.id !== id);
  await saveSnippets(filtered);
}

export async function createSnippet(): Promise<Snippet> {
  const snippet: Snippet = {
    id: crypto.randomUUID(),
    name: "",
    shortcut: "",
    body: [{ type: "text", content: "" }]
  };

  await saveSnippet(snippet);
  return snippet;
}
