import { useEffect, useState, useRef } from "react";
import SlateSnippetEditor, { SlateEditorRef } from "~components/SlateEditor";
import { Storage } from "@plasmohq/storage";
import { sendToBackground } from "@plasmohq/messaging";
import type { Snippet, WebsiteCommandNode } from "~types";
import { AVAILABLE_COMMANDS } from "~types";
import { getSnippets, saveSnippet, deleteSnippet, createSnippet } from "~utils/storage";
import "~style.css";

function CommandPanel({
  selectedCommand,
  onUpdate,
  onStartElementSelection,
  onInsertWebsiteCommand
}: {
  selectedCommand: WebsiteCommandNode | null;
  onUpdate: (command: WebsiteCommandNode) => void;
  onStartElementSelection: () => void;
  onInsertWebsiteCommand: () => void;
}) {
  if (!selectedCommand) {
    return (
      <div className="plasmo-p-4">
        <h3 className="plasmo-text-lg plasmo-font-semibold plasmo-mb-4">Commands</h3>
        <div className="plasmo-space-y-2">
          {AVAILABLE_COMMANDS.map((cmd, index) => (
            <div
              key={index}
              onClick={() => cmd.enabled && onInsertWebsiteCommand()}
              className={`plasmo-p-3 plasmo-rounded-lg plasmo-border ${
                cmd.enabled
                  ? "plasmo-bg-white plasmo-border-gray-300 hover:plasmo-bg-gray-50 plasmo-cursor-pointer"
                  : "plasmo-bg-gray-100 plasmo-border-gray-200 plasmo-opacity-60 plasmo-cursor-not-allowed"
              }`}
            >
              <div className="plasmo-font-medium plasmo-text-gray-900">{cmd.title}</div>
              <div className="plasmo-text-sm plasmo-text-gray-600">{cmd.description}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="plasmo-p-4">
      <h3 className="plasmo-text-lg plasmo-font-semibold plasmo-mb-4">Website Command Settings</h3>

      <div className="plasmo-space-y-6">
        <div>
          <h4 className="plasmo-text-md plasmo-font-medium plasmo-mb-2">Selector</h4>
          <p className="plasmo-text-sm plasmo-text-gray-600 plasmo-mb-3">
            Xpath selector to extract a specific part of the page
          </p>

          <div className="plasmo-flex plasmo-items-center plasmo-gap-2 plasmo-mb-2">
            <button
              onClick={onStartElementSelection}
              className="plasmo-px-3 plasmo-py-2 plasmo-bg-blue-500 plasmo-text-white plasmo-rounded-md hover:plasmo-bg-blue-600 plasmo-text-sm"
            >
              Select from webpage
            </button>

            {selectedCommand.xpath && (
              <button
                onClick={() => onUpdate({ ...selectedCommand, xpath: undefined })}
                className="plasmo-px-2 plasmo-py-2 plasmo-text-red-500 hover:plasmo-text-red-700"
              >
                ×
              </button>
            )}
          </div>

          <input
            type="text"
            value={selectedCommand.xpath || ""}
            onChange={(e) => onUpdate({ ...selectedCommand, xpath: e.target.value })}
            className="plasmo-w-full plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 plasmo-text-sm"
            placeholder="No selector set"
          />
        </div>

        <div>
          <h4 className="plasmo-text-md plasmo-font-medium plasmo-mb-2">Page</h4>
          <p className="plasmo-text-sm plasmo-text-gray-600 plasmo-mb-3">
            Page URLs to match for the site command. We will fetch data from these tabs.
          </p>

          <div className="plasmo-flex plasmo-items-center plasmo-gap-2">
            <input
              type="text"
              value={selectedCommand.urlMatch || ""}
              onChange={(e) => onUpdate({ ...selectedCommand, urlMatch: e.target.value })}
              className="plasmo-flex-1 plasmo-px-3 plasmo-py-2 plasmo-border plasmo-border-gray-300 plasmo-rounded-md focus:plasmo-outline-none focus:plasmo-ring-2 focus:plasmo-ring-blue-500 plasmo-text-sm"
              placeholder="https://example.com/*"
            />

            {selectedCommand.urlMatch && (
              <button
                onClick={() => onUpdate({ ...selectedCommand, urlMatch: undefined })}
                className="plasmo-px-2 plasmo-py-2 plasmo-text-red-500 hover:plasmo-text-red-700"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ElementSelectionModal({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="plasmo-fixed plasmo-inset-0 plasmo-bg-black plasmo-bg-opacity-50 plasmo-flex plasmo-items-center plasmo-justify-center plasmo-z-50">
      <div className="plasmo-bg-white plasmo-rounded-lg plasmo-p-6 plasmo-max-w-md plasmo-w-full plasmo-mx-4">
        <h2 className="plasmo-text-xl plasmo-font-semibold plasmo-mb-2">Select the text to read from the website</h2>
        <p className="plasmo-text-gray-600 plasmo-mb-6">
          Visit the website and then select the text you wish to include in your snippet.
        </p>

        <div className="plasmo-flex plasmo-justify-end">
          <button
            onClick={onClose}
            className="plasmo-px-4 plasmo-py-2 plasmo-bg-gray-500 plasmo-text-white plasmo-rounded-md hover:plasmo-bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate intelligent URL match pattern from a URL
 * Handles subdomains and different paths appropriately
 */
function generateUrlMatchPattern(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const parts = hostname.split('.');

    // Handle different domain structures
    let pattern: string;

    if (parts.length >= 2) {
      // Get the main domain (last 2 parts for normal domains, last 3 for co.uk, etc.)
      const mainDomain = parts.slice(-2).join('.');
      pattern = `*://*.${mainDomain}/*`;
    } else {
      // Fallback for localhost or IP addresses
      pattern = `${urlObj.origin}/*`;
    }

    return pattern;
  } catch (error) {
    console.error('Error generating URL match pattern:', error);
    return `${url}/*`;
  }
}

export default function Dashboard() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [selectedSnippetId, setSelectedSnippetId] = useState<string | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<WebsiteCommandNode | null>(null);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const slateEditorRef = useRef<SlateEditorRef>(null);

  const storage = new Storage();

  useEffect(() => {
    loadSnippets();
  }, []);

  const loadSnippets = async () => {
    const loadedSnippets = await getSnippets();
    setSnippets(loadedSnippets);

    if (loadedSnippets.length > 0 && !selectedSnippetId) {
      setSelectedSnippetId(loadedSnippets[0].id);
    }
  };

  const handleAddSnippet = async () => {
    const newSnippet = await createSnippet();
    const updated = await getSnippets();
    setSnippets(updated);
    setSelectedSnippetId(newSnippet.id);
    setSelectedCommand(null);
  };

  const handleDeleteSnippet = async (id: string) => {
    await deleteSnippet(id);
    const updated = await getSnippets();
    setSnippets(updated);

    if (selectedSnippetId === id) {
      setSelectedSnippetId(updated.length > 0 ? updated[0].id : null);
    }
    setSelectedCommand(null);
  };

  const handleUpdateSnippet = async (snippet: Snippet) => {
    await saveSnippet(snippet);
    const updated = await getSnippets();
    setSnippets(updated);
  };

  const handleCommandSelect = (node: WebsiteCommandNode | null) => {
    setSelectedCommand(node);
  };

  const handleUpdateCommand = async (command: WebsiteCommandNode) => {
    if (!selectedSnippetId) return;

    const snippet = snippets.find(s => s.id === selectedSnippetId);
    if (!snippet) return;

    const newBody = snippet.body.map(node =>
      node.type === "website" && (node as WebsiteCommandNode).id === command.id ? command : node
    );

    const updatedSnippet = { ...snippet, body: newBody };
    await saveSnippet(updatedSnippet);
    setSelectedCommand(command);

    const updatedSnippets = await getSnippets();
    setSnippets(updatedSnippets);
  };

  const handleInsertWebsiteCommand = () => {
    // Call the SlateEditor's insert function which handles cursor position
    if (slateEditorRef.current) {
      slateEditorRef.current.insertWebsiteCommand();
    }
  };

  const handleStartElementSelection = async () => {
    setIsSelectionModalOpen(true);

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await sendToBackground({
            name: "start-element-selection",
            body: { tabId: tab.id }
          });
        } catch (error) {
          console.error("Error starting element selection on tab:", error);
        }
      }
    }
  };

  const handleCloseSelectionModal = async () => {
    setIsSelectionModalOpen(false);

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await sendToBackground({
            name: "stop-element-selection",
            body: { tabId: tab.id }
          });
        } catch (error) {
          console.error("Error stopping element selection on tab:", error);
        }
      }
    }
  };

  const selectedSnippet = snippets.find(s => s.id === selectedSnippetId);

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.name === "element-selected") {
        handleElementSelected(message.body.xpath, message.body.url);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, [selectedSnippet, selectedCommand]);

  const handleElementSelected = async (xpath: string, url: string) => {
    if (!selectedCommand || !selectedSnippet) return;

    const urlMatch = generateUrlMatchPattern(url);
    await handleUpdateCommand({ ...selectedCommand, xpath, urlMatch });

    setIsSelectionModalOpen(false);

    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        try {
          await sendToBackground({
            name: "stop-element-selection",
            body: { tabId: tab.id }
          });
        } catch (error) {
          console.error("Error stopping element selection on tab:", error);
        }
      }
    }

    // Find existing dashboard tab or create a new one
    const allTabs = await chrome.tabs.query({});

    // We need to get detailed info including URLs for each tab
    const dashboardTab = await Promise.all(allTabs.map(async (tab) => {
      if (tab.id) {
        try {
          const detailedTab = await chrome.tabs.get(tab.id);
          return detailedTab.url?.includes("dashboard.html") ? detailedTab : null;
        } catch (error) {
          return null;
        }
      }
      return null;
    })).then(results => results.find(tab => tab !== null));

    if (dashboardTab && dashboardTab.id) {
      // Switch to existing dashboard tab
      await chrome.tabs.update(dashboardTab.id, { active: true });
      await chrome.windows.update(dashboardTab.windowId, { focused: true });
    } else {
      // Create new dashboard tab if none exists
      await chrome.tabs.create({ url: chrome.runtime.getURL("/tabs/dashboard.html") });
    }
  };

  return (
    <div className="plasmo-flex plasmo-flex-col plasmo-h-screen plasmo-bg-gray-50">
      <ElementSelectionModal
        isOpen={isSelectionModalOpen}
        onClose={handleCloseSelectionModal}
      />

      <header className="plasmo-bg-white plasmo-border-b plasmo-border-gray-200 plasmo-px-6 plasmo-py-4">
        <h1 className="plasmo-text-2xl plasmo-font-bold plasmo-text-gray-900">MiniBlaze</h1>
      </header>

      <div className="plasmo-flex plasmo-flex-1 plasmo-overflow-hidden">
        <div className="plasmo-w-1/4 plasmo-border-r plasmo-border-gray-200 plasmo-bg-white plasmo-p-4">
          <div className="plasmo-flex plasmo-justify-between plasmo-items-center plasmo-mb-4">
            <h2 className="plasmo-text-lg plasmo-font-semibold">Snippets</h2>
            <button
              onClick={handleAddSnippet}
              className="plasmo-px-3 plasmo-py-1 plasmo-bg-blue-500 plasmo-text-white plasmo-rounded-md hover:plasmo-bg-blue-600 plasmo-text-sm"
            >
              + Add
            </button>
          </div>

          <div className="plasmo-space-y-2">
            {snippets.map(snippet => (
              <div
                key={snippet.id}
                className={`plasmo-p-3 plasmo-rounded-lg plasmo-cursor-pointer plasmo-transition-colors ${
                  selectedSnippetId === snippet.id
                    ? "plasmo-bg-blue-100 plasmo-border-2 plasmo-border-blue-500"
                    : "plasmo-bg-gray-50 hover:plasmo-bg-gray-100 plasmo-border-2 plasmo-border-transparent"
                }`}
                onClick={() => {
                  setSelectedSnippetId(snippet.id);
                  setSelectedCommand(null);
                }}
              >
                <div className="plasmo-font-medium plasmo-text-gray-900">{snippet.name || "Untitled"}</div>
                <div className="plasmo-text-sm plasmo-text-gray-600">{snippet.shortcut || "No shortcut"}</div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSnippet(snippet.id);
                  }}
                  className="plasmo-mt-2 plasmo-text-red-500 hover:plasmo-text-red-700 plasmo-text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="plasmo-w-2/4 plasmo-border-r plasmo-border-gray-200 plasmo-bg-white plasmo-p-4">
          {selectedSnippet ? (
            <SlateSnippetEditor
              ref={slateEditorRef}
              snippet={selectedSnippet}
              onUpdate={handleUpdateSnippet}
              onCommandSelect={handleCommandSelect}
              selectedCommand={selectedCommand}
              onInsertCommand={handleInsertWebsiteCommand}
            />
          ) : (
            <div className="plasmo-flex plasmo-items-center plasmo-justify-center plasmo-h-full plasmo-text-gray-500">
              Select or create a snippet to start editing
            </div>
          )}
        </div>

        <div className="plasmo-w-1/4 plasmo-bg-white">
          <CommandPanel
            selectedCommand={selectedCommand}
            onUpdate={handleUpdateCommand}
            onStartElementSelection={handleStartElementSelection}
            onInsertWebsiteCommand={handleInsertWebsiteCommand}
          />
        </div>
      </div>
    </div>
  );
}
