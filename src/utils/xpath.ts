/**
 * Advanced XPath Generator for MiniBlaze Extension
 *
 * Generates optimal XPath selectors that are:
 * - SHORT - minimal necessary context
 * - ROBUST - structure-based, avoids dynamic IDs and data
 * - READABLE - human-understandable paths
 *
 * Strategy: Build UP from element, stop as soon as unique
 */

interface XPathGeneratorOptions {
  maxDepth?: number;
  timeout?: number;
}

class XPathGenerator {
  private maxDepth: number;
  private timeout: number;
  private startTime: number | null = null;

  // Dynamic ID patterns to avoid
  private readonly dynamicIdPatterns = [
    /^ember\d+$/i,
    /^react-[a-z]+-\d+$/i,
    /^ng-[a-z]+-\d+$/i,
    /^vue-[a-z]+-\d+$/i,
    /^jsx-\d+$/i,
    /^[a-z]+-\d{3,}$/i,
    /^[a-f0-9]{8,}$/i,
    /^uid-/i,
    /^gen-/i,
    /^auto-/i
  ];

  // Stable structural attributes
  private readonly structuralAttributes = [
    'data-testid',
    'data-test',
    'name',
    'role',
    'type',
    'aria-label',
    'aria-labelledby'
  ];

  // Semantic landmarks
  private readonly semanticLandmarks = [
    'main', 'nav', 'header', 'footer', 'aside',
    'article', 'section', 'form'
  ];

  constructor(options: XPathGeneratorOptions = {}) {
    this.maxDepth = options.maxDepth || 10;
    this.timeout = options.timeout || 20000;
    this.startTime = null;
  }

  /**
   * Main entry point. Optimized for shortest path
   */
  generate(element: HTMLElement): string {
    this.startTime = Date.now();

    if (!element || !(element instanceof HTMLElement)) {
      throw new Error('Invalid element provided. Must be an HTMLElement.');
    }

    // Strategy 1: Try absolute minimum (tag + position only)
    const minimalPath = this.tryMinimalPath(element);
    if (minimalPath && this.validateSelector(minimalPath, element)) {
      return minimalPath;
    }

    // Strategy 2: Try with stable attribute (very short)
    const attrPath = this.tryStableAttributePath(element);
    if (attrPath && this.validateSelector(attrPath, element)) {
      return attrPath;
    }

    // Strategy 3: Build up incrementally from element (stops early)
    const incrementalPath = this.buildIncrementalPath(element);
    if (incrementalPath && this.validateSelector(incrementalPath, element)) {
      return incrementalPath;
    }

    // Strategy 4: Try sibling relationships (often shorter)
    const siblingPath = this.trySiblingRelationshipPath(element);
    if (siblingPath && this.validateSelector(siblingPath, element)) {
      return siblingPath;
    }

    // Fallback: Build minimal semantic path
    return this.buildMinimalSemanticPath(element);
  }

  /**
   * Strategy 1: Try absolute minimal paths
   */
  private tryMinimalPath(element: HTMLElement): string | null {
    const tag = element.tagName.toLowerCase();
    const position = this.getElementPosition(element);
    const siblings = this.getSiblingsByTag(element);

    // Try just tag if unique
    const xpath1 = `//${tag}`;
    if (this.isUniqueSelector(xpath1)) {
      return xpath1;
    }

    // Try tag with position
    if (siblings > 1) {
      const xpath2 = `//${tag}[${position}]`;
      if (this.isUniqueSelector(xpath2)) {
        return xpath2;
      }
    }

    return null;
  }

  /**
   * Strategy 2: Try stable attribute (shortest unique selector)
   */
  private tryStableAttributePath(element: HTMLElement): string | null {
    const tag = element.tagName.toLowerCase();

    // Try each structural attribute
    for (const attr of this.structuralAttributes) {
      if (element.hasAttribute(attr)) {
        const value = element.getAttribute(attr);

        if (!this.isDataSpecificValue(attr, value)) {
          const xpath = `//${tag}[@${attr}="${this.escapeXPath(value)}"]`;
          if (this.isUniqueSelector(xpath)) {
            return xpath;
          }
        }
      }
    }

    return null;
  }

  /**
   * Strategy 3: Build incrementally from element UP
   * Key optimization: stop as soon as unique
   */
  private buildIncrementalPath(element: HTMLElement): string | null {
    const tag = element.tagName.toLowerCase();
    const position = this.getElementPosition(element);
    const siblings = this.getSiblingsByTag(element);

    // Start with element itself (prefer position over class)
    let currentSegment: string;
    if (siblings === 1) {
      currentSegment = tag;
    } else {
      currentSegment = `${tag}[${position}]`;
    }

    // Test if this alone is unique
    let xpath = `//${currentSegment}`;
    if (this.isUniqueSelector(xpath)) {
      return xpath;
    }

    // Build upward, adding one ancestor at a time
    let current: HTMLElement | null = element.parentElement;
    let depth = 0;
    const segments: string[] = [currentSegment];

    while (current && current !== document.documentElement && depth < this.maxDepth) {
      if (this.isTimeout()) return null;

      const parentTag = current.tagName.toLowerCase();

      // Skip dynamic IDs completely
      if (current.id && !this.isStableId(current.id)) {
        current = current.parentElement;
        depth++;
        continue;
      }

      // Try adding just the parent tag with //
      xpath = `//${parentTag}//${currentSegment}`;
      if (this.isUniqueSelector(xpath)) {
        return xpath;
      }

      // Try with parent's distinctive feature (if any)
      const distinctiveSegment = this.getDistinctiveSegment(current);

      if (distinctiveSegment) {
        // Test with distinctive parent
        xpath = `//${distinctiveSegment}//${currentSegment}`;
        if (this.isUniqueSelector(xpath)) {
          return xpath;
        }

        segments.unshift(distinctiveSegment);
      } else {
        segments.unshift(parentTag);
      }

      // Test current path
      xpath = '//' + segments.join('//');
      if (this.isUniqueSelector(xpath)) {
        return xpath;
      }

      // Stop at semantic landmarks (good enough context)
      if (this.semanticLandmarks.includes(parentTag)) {
        // Try without intermediate elements
        xpath = `//${parentTag}//${currentSegment}`;
        if (this.isUniqueSelector(xpath)) {
          return xpath;
        }
        break;
      }

      current = current.parentElement;
      depth++;
    }

    return '//' + segments.join('//');
  }

  /**
   * Get the most distinctive segment for an element (prefer position > class)
   */
  private getDistinctiveSegment(element: HTMLElement): string | null {
    const tag = element.tagName.toLowerCase();

    // Check for stable ID
    if (element.id && this.isStableId(element.id)) {
      return `${tag}[@id="${this.escapeXPath(element.id)}"]`;
    }

    // Check for stable attribute
    const stableAttr = this.getStableAttribute(element);
    if (stableAttr) {
      return `${tag}[@${stableAttr.name}="${this.escapeXPath(stableAttr.value)}"]`;
    }

    // Use position for common structural elements
    const position = this.getElementPosition(element);
    const siblings = this.getSiblingsByTag(element);

    // For elements that commonly have multiples, use position
    if (siblings > 1 && ['div', 'span', 'li', 'td', 'dd', 'dt'].includes(tag)) {
      return `${tag}[${position}]`;
    }

    // For semantic elements, just use tag (they're distinctive enough)
    if (this.semanticLandmarks.includes(tag)) {
      return tag;
    }

    // Check for stable class (but only if really distinctive)
    const stableClass = this.getStableClass(element);
    if (stableClass && this.isDistinctiveClass(stableClass)) {
      return `${tag}[contains(@class, "${this.escapeXPath(stableClass)}")]`;
    }

    // Default: just tag
    return tag;
  }

  /**
   * Check if a class is distinctive enough to use
   */
  private isDistinctiveClass(className: string): boolean {
    // Only use classes that are likely unique/semantic
    // Prefer classes with hyphens (BEM-style) and reasonable length
    return className.length >= 5 &&
           className.includes('-') &&
           !className.match(/^[a-z]\d/); // Not like "p1", "m2"
  }

  /**
   * Strategy 4: Sibling relationships (often very short)
   */
  private trySiblingRelationshipPath(element: HTMLElement): string | null {
    const tag = element.tagName.toLowerCase();
    const previousSibling = element.previousElementSibling;

    if (!previousSibling) return null;

    const prevTag = previousSibling.tagName.toLowerCase();

    // For dt/dd pairs. very common and stable pattern
    if (tag === 'dd' && prevTag === 'dt') {
      const labelText = previousSibling.textContent?.trim();
      // Only use if text is short, stable-looking
      if (labelText && labelText.length < 30 && labelText.length > 3 &&
          !this.looksLikeUserData(labelText)) {

        // Try minimal: just the relationship
        const xpath = `//dt[contains(text(), "${this.escapeXPath(labelText)}")]/following-sibling::dd[1]`;
        if (this.isUniqueSelector(xpath)) {
          return xpath;
        }
      }
    }

    return null;
  }

  /**
   * Fallback: Build minimal semantic path
   */
  private buildMinimalSemanticPath(element: HTMLElement): string {
    const segments: string[] = [];
    let current: HTMLElement | null = element;
    let depth = 0;
    let landmarkFound = false;

    while (current && current !== document.documentElement && depth < this.maxDepth) {
      if (this.isTimeout()) {
        return '//' + segments.join('//');
      }

      const tag = current.tagName.toLowerCase();

      // Skip elements with dynamic IDs
      if (current.id && !this.isStableId(current.id)) {
        current = current.parentElement;
        depth++;
        continue;
      }

      // Get minimal segment
      const segment = this.getMinimalSegment(current);
      segments.unshift(segment);

      // Stop at semantic landmarks
      if (this.semanticLandmarks.includes(tag)) {
        landmarkFound = true;
        break;
      }

      current = current.parentElement;
      depth++;
    }

    // Use // between segments for maximum flexibility
    return '//' + segments.join('//');
  }

  /**
   * Get minimal segment (prefer position, avoid classes unless necessary)
   */
  private getMinimalSegment(element: HTMLElement): string {
    const tag = element.tagName.toLowerCase();

    // Stable attribute (if available, use it. it's both short and stable)
    const stableAttr = this.getStableAttribute(element);
    if (stableAttr) {
      return `${tag}[@${stableAttr.name}="${this.escapeXPath(stableAttr.value)}"]`;
    }

    // Position (shortest and often stable for structured content)
    const position = this.getElementPosition(element);
    const siblings = this.getSiblingsByTag(element);

    if (siblings === 1) {
      return tag;
    }

    return `${tag}[${position}]`;
  }

  /**
   * Get stable attributes from element
   */
  private getStableAttributes(element: HTMLElement): { name: string; value: string }[] {
    const attrs: { name: string; value: string }[] = [];

    for (const attr of this.structuralAttributes) {
      if (element.hasAttribute(attr)) {
        const value = element.getAttribute(attr);
        if (value && !this.isDataSpecificValue(attr, value)) {
          attrs.push({ name: attr, value });
        }
      }
    }

    return attrs;
  }

  /**
   * Get single most stable attribute
   */
  private getStableAttribute(element: HTMLElement): { name: string; value: string } | null {
    const attrs = this.getStableAttributes(element);
    return attrs.length > 0 ? attrs[0] : null;
  }

  /**
   * Get most stable class
   */
  private getStableClass(element: HTMLElement): string | null {
    if (!element.className || typeof element.className !== 'string') {
      return null;
    }

    const classes = element.className.trim().split(/\s+/)
      .filter(cls => this.isStableClass(cls));

    // Prefer longer, more semantic classes
    const sorted = classes.sort((a, b) => {
      const aHyphens = (a.match(/-/g) || []).length;
      const bHyphens = (b.match(/-/g) || []).length;
      if (aHyphens !== bHyphens) return bHyphens - aHyphens;
      return b.length - a.length;
    });

    return sorted[0] || null;
  }

  /**
   * Check if ID is stable
   */
  private isStableId(id: string): boolean {
    if (!id) return false;
    return !this.dynamicIdPatterns.some(pattern => pattern.test(id));
  }

  /**
   * Check if class is stable
   */
  private isStableClass(className: string): boolean {
    if (!className) return false;

    const unstablePatterns = [
      /^[a-z0-9]{6,}$/i,
      /^css-/,
      /^jsx-/,
      /^sc-/,
      /^makeStyles-/,
      /^jss\d+/,
      /_[a-z0-9]{5,}$/i,
      /^[a-z]{1,2}\d+$/i,
      /^\d/
    ];

    return !unstablePatterns.some(pattern => pattern.test(className));
  }

  /**
   * Check if value is data-specific
   */
  private isDataSpecificValue(attr: string, value: string | null): boolean {
    if (!value) return false;
    if (/^\d+$/.test(value)) return true;
    if (/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)) return true;
    if (value.length > 30 && /^[a-z0-9]+$/i.test(value)) return true;
    return false;
  }

  /**
   * Check if text looks like user data
   */
  private looksLikeUserData(text: string): boolean {
    if (/^\d+$/.test(text.trim())) return true;
    if (/\d{1,3}(,\d{3})+/.test(text)) return true;
    if (text.length > 50) return true;
    return false;
  }

  /**
   * Get element position among same-tag siblings
   */
  private getElementPosition(element: HTMLElement): number {
    const parent = element.parentElement;
    if (!parent) return 1;

    const siblings = Array.from(parent.children).filter(
      child => child.tagName === element.tagName
    );

    return siblings.indexOf(element) + 1;
  }

  /**
   * Get sibling count by tag
   */
  private getSiblingsByTag(element: HTMLElement): number {
    const parent = element.parentElement;
    if (!parent) return 1;

    return Array.from(parent.children).filter(
      child => child.tagName === element.tagName
    ).length;
  }

  /**
   * Check if selector is unique
   */
  private isUniqueSelector(xpath: string): boolean {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      return result.snapshotLength === 1;
    } catch (e) {
      return false;
    }
  }

  /**
   * Validate selector matches target
   */
  private validateSelector(xpath: string, targetElement: HTMLElement): boolean {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );
      return result.singleNodeValue === targetElement;
    } catch (e) {
      return false;
    }
  }

  /**
   * Escape XPath string values
   */
  private escapeXPath(value: string): string {
    if (!value) return '';

    if (value.includes('"') && value.includes("'")) {
      const parts = value.split('"').map(part => `"${part}"`);
      return `concat(${parts.join(', \'"\', ')})`;
    }

    if (value.includes('"')) {
      return value.replace(/'/g, "\\'");
    }

    return value.replace(/"/g, '\\"');
  }

  /**
   * Check timeout
   */
  private isTimeout(): boolean {
    return Date.now() - (this.startTime || 0) > this.timeout;
  }
}

/**
 * Main exported function for generating XPath selectors
 */
export function generateXPath(element: HTMLElement): string {
  const generator = new XPathGenerator();
  return generator.generate(element);
}

/**
 * Find an element using XPath selector
 */
export function getElementByXPath(xpath: string, doc: Document = document): Element | null {
  const result = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue as Element | null;
}