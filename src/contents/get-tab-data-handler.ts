import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.name === "get-tab-data") {
    const { xpath } = message.body;

    try {
      const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      const element = result.singleNodeValue as HTMLElement;

      if (element) {
        sendResponse({ data: element.textContent || "" });
      } else {
        sendResponse({ data: "" });
      }
    } catch (error) {
      console.error("Error evaluating XPath:", error);
      sendResponse({ data: "" });
    }

    return true;
  }
})