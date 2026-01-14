import type { PlasmoMessaging } from "@plasmohq/messaging"

/**
 * Match a URL against a Chrome extension match pattern
 * Supports patterns like: *://*.medium.com/*
 */
function matchUrlPattern(url: string, pattern: string): boolean {
  try {
    const urlObj = new URL(url);

    // Parse the pattern
    const patternRegex = parseMatchPattern(pattern);
    if (!patternRegex) return false;

    return patternRegex.test(url);
  } catch (error) {
    console.error("Error matching URL pattern:", error);
    return false;
  }
}

/**
 * Parse Chrome extension match pattern to regex
 */
function parseMatchPattern(pattern: string): RegExp | null {
  try {
    // Remove leading/trailing whitespace
    pattern = pattern.trim();

    // Split pattern into protocol, host, and path
    const parts = pattern.split('://');
    if (parts.length !== 2) return null;

    const [protocol, rest] = parts;
    const [host, path] = rest.split('/');

    // Build regex parts
    let protocolRegex: string;
    if (protocol === '*') {
      protocolRegex = '(https?|file|ftp)';
    } else {
      protocolRegex = protocol.replace(/\./g, '\\.');
    }

    let hostRegex: string;
    if (host === '*') {
      hostRegex = '[^/]+';
    } else if (host.startsWith('*.')) {
      // *.example.com -> (.*\\.)*example\\.com
      const domain = host.substring(2);
      hostRegex = `([^/]+\\.)*${domain.replace(/\./g, '\\.')}`;
    } else {
      hostRegex = host.replace(/\./g, '\\.').replace(/\*/g, '[^/]+');
    }

    let pathRegex: string;
    if (!path || path === '*') {
      pathRegex = '.*';
    } else {
      pathRegex = path.replace(/\./g, '\\.').replace(/\*/g, '[^/]*');
    }

    const regexStr = `^${protocolRegex}://${hostRegex}/${pathRegex}$`;
    return new RegExp(regexStr, 'i');
  } catch (error) {
    console.error("Error parsing match pattern:", error);
    return null;
  }
}

type RequestBody = {
  urlMatch: string;
  xpath: string;
};

type ResponseBody = {
  data: string | null;
};

const handler: PlasmoMessaging.MessageHandler<RequestBody, ResponseBody> = async (req, res) => {
  const { urlMatch, xpath } = req.body;

  try {
    const tabs = await chrome.tabs.query({});

    const matchingTab = tabs.find(tab => {
      if (!tab.url) return false;

      try {
        return matchUrlPattern(tab.url, urlMatch);
      } catch {
        return false;
      }
    });

    if (!matchingTab || !matchingTab.id) {
      res.send({ data: null });
      return;
    }

    const tabResponse = await chrome.tabs.sendMessage(matchingTab.id, {
      name: "get-tab-data",
      body: { xpath }
    });

    if (tabResponse?.data !== undefined) {
      res.send({ data: tabResponse.data });
    } else {
      res.send({ data: null });
    }
  } catch (error) {
    console.error("Error fetching tab data:", error);
    res.send({ data: null });
  }
};

export default handler;
