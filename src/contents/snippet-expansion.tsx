import { useEffect } from "react";
import { sendToBackground } from "@plasmohq/messaging";
import { getSnippets } from "~utils/storage";
import type { Snippet, WebsiteCommandNode } from "~types";

function SnippetExpansion() {
  useEffect(() => {
    let lastInputValues = new Map<HTMLInputElement | HTMLTextAreaElement, string>();
    let expandTimeout: NodeJS.Timeout;

    const processSnippet = async (
      input: HTMLInputElement | HTMLTextAreaElement,
      snippet: Snippet
    ): Promise<void> => {
      try {
        let expandedBody = "";

        for (const node of snippet.body) {
          if (node.type === "text") {
            expandedBody += node.content;
          } else if (node.type === "website") {
            const commandNode = node as WebsiteCommandNode;

            if (!commandNode.xpath || !commandNode.urlMatch) {
              expandedBody += "[Website command not configured]";
              continue;
            }

            const tabData = await fetchTabData(commandNode.urlMatch, commandNode.xpath);
            expandedBody += tabData || "[No data found]";
          }
        }

        const currentValue = input.value;
        const shortcut = snippet.shortcut;

        if (currentValue.endsWith(shortcut)) {
          const newValue = currentValue.slice(0, -shortcut.length) + expandedBody;

          input.value = newValue;

          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } catch (error) {
        console.error("Error expanding snippet:", error);
      }
    };

    const fetchTabData = async (urlMatch: string, xpath: string): Promise<string | null> => {
      try {
        const response = await fetchTabDataFromBackground(urlMatch, xpath);
        return response?.data || null;
      } catch (error) {
        console.error("Error fetching tab data:", error);
        return null;
      }
    };

    const handleInput = async (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;

      if (!target.matches("input[type='text'], textarea")) return;

      const currentValue = target.value;
      const previousValue = lastInputValues.get(target) || "";

      lastInputValues.set(target, currentValue);

      if (currentValue.length <= previousValue.length) return;

      clearTimeout(expandTimeout);
      expandTimeout = setTimeout(async () => {
        const snippets = await getSnippets();

        for (const snippet of snippets) {
          if (!snippet.shortcut) continue;

          if (currentValue.endsWith(snippet.shortcut)) {
            await processSnippet(target, snippet);
            break;
          }
        }
      }, 0);
    };

    document.addEventListener("input", handleInput);

    return () => {
      document.removeEventListener("input", handleInput);
      clearTimeout(expandTimeout);
    };
  }, []);

  return null;
}

async function fetchTabDataFromBackground(urlMatch: string, xpath: string): Promise<{ data: string | null }> {
  const response = await sendToBackground({
    name: "fetch-tab-data",
    body: {
      urlMatch,
      xpath
    },
    extensionId: 'elljhibejckdpkilpnbkmdedgkbimglb'
  });

  return response;
}

export default SnippetExpansion;
