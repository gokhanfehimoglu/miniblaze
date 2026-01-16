/**
 * Advanced XPath Generator for MiniBlaze Extension
 *
 * Generates optimal XPath selectors that are:
 * - SHORT - minimal necessary context
 * - ROBUST - structure-based, avoids dynamic IDs and data
 * - READABLE - human-understandable paths
 *
 * Strategy: Build UP from element, find anchors, simplify down
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

  // Elements to skip/simplify (usually implicit)
  private readonly implicitElements = ['tbody', 'thead', 'tfoot'];

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

    // Strategy 3: Try anchor-based paths (use stable IDs as anchors)
    const anchorPath = this.tryAnchorBasedPath(element);
    if (anchorPath && this.validateSelector(anchorPath, element)) {
      return anchorPath;
    }

    // Strategy 4: Try sibling relationships (often shorter)
    const siblingPath = this.trySiblingRelationshipPath(element);
    if (siblingPath && this.validateSelector(siblingPath, element)) {
      return siblingPath;
    }

    // Strategy 5: Build up incrementally from element (stops early)
    const incrementalPath = this.buildIncrementalPath(element);
    if (incrementalPath && this.validateSelector(incrementalPath, element)) {
      // Try to simplify the path before returning
      const simplified = this.simplifyPath(incrementalPath, element);
      return simplified;
    }

    // Fallback: Build minimal semantic path
    const fallbackPath = this.buildMinimalSemanticPath(element);
    return this.simplifyPath(fallbackPath, element);
  }

  /**
   * Strategy 1: Try absolute minimal paths
   */
  private tryMinimalPath(element: HTMLElement): string | null {
    const tag = element.tagName.toLowerCase();
    const position = this.getElementPosition(element);
    const siblings = this.getSiblingsByTag(element);

    // Try just tag if unique and matches target
    const xpath1 = `//${tag}`;
    if (this.isUniqueSelector(xpath1) && this.validateSelector(xpath1, element)) {
      return xpath1;
    }

    // Try tag with position
    if (siblings > 1) {
      const xpath2 = `//${tag}[${position}]`;
      if (this.isUniqueSelector(xpath2) && this.validateSelector(xpath2, element)) {
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

        if (value && !this.isDataSpecificValue(attr, value)) {
          const xpath = `//${tag}[@${attr}="${this.escapeXPath(value)}"]`;
          if (this.isUniqueSelector(xpath) && this.validateSelector(xpath, element)) {
            return xpath;
          }
        }
      }
    }

    // Try stable class alone (if distinctive)
    const stableClass = this.getStableClass(element);
    if (stableClass && this.isDistinctiveClass(stableClass)) {
      const xpath = `//${tag}[contains(@class, "${this.escapeXPath(stableClass)}")]`;
      if (this.isUniqueSelector(xpath) && this.validateSelector(xpath, element)) {
        return xpath;
      }
    }

    return null;
  }

  /**
   * Strategy 3: Anchor-based paths
   * Find nearest stable anchor (ID/attribute) and build short relative path
   */
  private tryAnchorBasedPath(element: HTMLElement): string | null {
    // Find nearest ancestor with stable ID or strong attribute
    const anchor = this.findNearestStableAnchor(element);
    if (!anchor) return null;

    const anchorSegment = this.getAnchorSegment(anchor);
    if (!anchorSegment) return null;

    // Build short path from anchor to element
    const relativePath = this.buildShortRelativePath(element, anchor);

    // Try different combinations, shortest first
    const attempts = [
      `//${anchorSegment}//${this.getMinimalSegment(element)}`,
      `//${anchorSegment}${relativePath}`,
      `//${anchorSegment}//${relativePath.replace(/^\/+/, '')}`
    ];

    for (const xpath of attempts) {
      if (this.isUniqueSelector(xpath) && this.validateSelector(xpath, element)) {
        return xpath;
      }
    }

    return null;
  }

  /**
   * Find nearest ancestor with stable ID or strong attribute
   */
  private findNearestStableAnchor(element: HTMLElement): HTMLElement | null {
    let current = element.parentElement;
    let depth = 0;

    while (current && current !== document.documentElement && depth < 8) {
      // Check for stable ID
      if (current.id && this.isStableId(current.id)) {
        return current;
      }

      // Check for strong attributes (data-testid, role, etc.)
      const stableAttr = this.getStableAttribute(current);
      if (stableAttr && this.isStrongAttribute(stableAttr.name)) {
        return current;
      }

      current = current.parentElement;
      depth++;
    }

    return null;
  }

  /**
   * Check if attribute is strong enough to be an anchor
   */
  private isStrongAttribute(attrName: string): boolean {
    return ['id', 'data-testid', 'data-test', 'role'].includes(attrName);
  }

  /**
   * Get anchor segment for an element (ID or strong attribute)
   */
  private getAnchorSegment(element: HTMLElement): string | null {
    const tag = element.tagName.toLowerCase();

    if (element.id && this.isStableId(element.id)) {
      return `${tag}[@id="${this.escapeXPath(element.id)}"]`;
    }

    const stableAttr = this.getStableAttribute(element);
    if (stableAttr && this.isStrongAttribute(stableAttr.name)) {
      return `${tag}[@${stableAttr.name}="${this.escapeXPath(stableAttr.value)}"]`;
    }

    return null;
  }

  /**
   * Build minimal child path from parent to target (like /td[3]/span/a)
   */
  private getMinimalChildPath(targetElement: HTMLElement, parentElement: HTMLElement): string {
    const path: string[] = [];
    let current: HTMLElement | null = targetElement;

    while (current && current !== parentElement) {
      const tag = current.tagName.toLowerCase();

      // Skip implicit elements
      if (this.implicitElements.includes(tag)) {
        current = current.parentElement;
        continue;
      }

      // Get position among siblings
      const position = this.getElementPosition(current);
      const siblings = this.getSiblingsByTag(current);

      if (siblings === 1) {
        path.unshift(`/${tag}`);
      } else {
        path.unshift(`/${tag}[${position}]`);
      }

      current = current.parentElement;

      // Safety limit to prevent infinite loops
      if (path.length > 10) break;
    }

    return path.join('');
  }

  /**
   * Build short relative path from anchor to target
   */
  private buildShortRelativePath(element: HTMLElement, anchor: HTMLElement): string {
    const segments: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== anchor) {
      // Skip implicit elements
      if (!this.implicitElements.includes(current.tagName.toLowerCase())) {
        const segment = this.getMinimalSegment(current);
        segments.unshift(segment);
      }
      current = current.parentElement;
    }

    return segments.length > 0 ? '//' + segments.join('//') : '';
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
        if (this.isUniqueSelector(xpath) && this.validateSelector(xpath, element)) {
          return xpath;
        }
      }
    }

    return null;
  }

  /**
   * Strategy 5: Build incrementally from element UP
   * Key optimization: stop as soon as unique
   */
  private buildIncrementalPath(element: HTMLElement): string | null {
    const tag = element.tagName.toLowerCase();

    // Skip implicit elements in the path
    if (this.implicitElements.includes(tag)) {
      return this.buildIncrementalPath(element.parentElement!);
    }

    const position = this.getElementPosition(element);
    const siblings = this.getSiblingsByTag(element);

    // Start with element itself (prefer position over class)
    let currentSegment: string;
    if (siblings === 1) {
      currentSegment = tag;
    } else {
      currentSegment = `${tag}[${position}]`;
    }

    // Test if this alone is unique and matches target
    let xpath = `//${currentSegment}`;
    if (this.isUniqueSelector(xpath) && this.validateSelector(xpath, element)) {
      return xpath;
    }

    // Build upward
    let current: HTMLElement | null = element.parentElement;
    let depth = 0;
    const segments: string[] = [currentSegment];

    while (current && current !== document.documentElement && depth < this.maxDepth) {
      if (this.isTimeout()) return null;

      const parentTag = current.tagName.toLowerCase();

      // Skip implicit elements
      if (this.implicitElements.includes(parentTag)) {
        current = current.parentElement;
        depth++;
        continue;
      }

      // Get distinctive segment
      const parentPosition = this.getElementPosition(current);
      const parentSiblings = this.getSiblingsByTag(current);

      // For parent elements, use position if they have siblings. this distinguishes which post row we're in
      let parentSegment: string;

      // For dynamic IDs, still use them if they help distinguish elements
      if (current.id && !this.isStableId(current.id)) {

        // Try the absolute shortest path. just id + minimal child path
        const minimalChildPath = this.getMinimalChildPath(element, current);
        const shortestPath = `//*[@id="${this.escapeXPath(current.id)}"]${minimalChildPath}`;
        if (this.isUniqueSelector(shortestPath) && this.validateSelector(shortestPath, element)) {
          return shortestPath;
        }

        // Try with tag + ID
        parentSegment = `${parentTag}[@id="${this.escapeXPath(current.id)}"]`;
        const tagIdPath = `//${parentSegment}${minimalChildPath}`;
        if (this.isUniqueSelector(tagIdPath) && this.validateSelector(tagIdPath, element)) {
          return tagIdPath;
        }

        // Add to segments and continue
        segments.unshift(parentSegment);
      } else {
        // Use position for siblings or stable ID if available
        if (parentSiblings > 1) {
          parentSegment = `${parentTag}[${parentPosition}]`;
        } else {
          // Use stable ID if available
          if (current.id && this.isStableId(current.id)) {
            parentSegment = `${parentTag}[@id="${this.escapeXPath(current.id)}"]`;
          } else {
            parentSegment = parentTag;
          }
        }

        // Try adding just parent tag
        xpath = `//${parentTag}//${currentSegment}`;
        if (this.isUniqueSelector(xpath) && this.validateSelector(xpath, element)) {
          return xpath;
        }

        // Try with positioned parent
        xpath = `//${parentSegment}//${currentSegment}`;
        if (this.isUniqueSelector(xpath) && this.validateSelector(xpath, element)) {
          return xpath;
        }

        // Add to segments and continue building upward
        segments.unshift(parentSegment);
      }

      // Test current path
      xpath = '//' + segments.join('//');
      if (this.isUniqueSelector(xpath) && this.validateSelector(xpath, element)) {
        return xpath;
      }

      // Stop at semantic landmarks
      if (this.semanticLandmarks.includes(parentTag)) {
        xpath = `//${parentTag}//${currentSegment}`;
        if (this.isUniqueSelector(xpath) && this.validateSelector(xpath, element)) {
          return xpath;
        }
        break;
      }

      current = current.parentElement;
      depth++;
    }

    const finalPath = '//' + segments.join('//');
    return finalPath;
  }

  /**
   * Fallback: Build minimal semantic path
   */
  private buildMinimalSemanticPath(element: HTMLElement): string {
    const segments: string[] = [];
    let current: HTMLElement | null = element;
    let depth = 0;

    while (current && current !== document.documentElement && depth < this.maxDepth) {
      if (this.isTimeout()) {
        return '//' + segments.join('//');
      }

      const tag = current.tagName.toLowerCase();

      // Skip implicit elements
      if (this.implicitElements.includes(tag)) {
        current = current.parentElement;
        depth++;
        continue;
      }

      // Skip dynamic IDs
      if (current.id && !this.isStableId(current.id)) {
        current = current.parentElement;
        depth++;
        continue;
      }

      const segment = this.getMinimalSegment(current);
      segments.unshift(segment);

      // Stop at semantic landmarks
      if (this.semanticLandmarks.includes(tag)) {
        break;
      }

      current = current.parentElement;
      depth++;
    }

    return '//' + segments.join('//');
  }

  /**
   * Path simplification. Removes unnecessary segments while preserving critical positions
   * This is the key improvement for complex cases
   */
  private simplifyPath(xpath: string, targetElement: HTMLElement): string {
    if (!xpath || xpath.length < 10) return xpath;

    // Extract segments
    const parts = xpath.split('//').filter(s => s);
    if (parts.length <= 2) return xpath;

    // Find the first positional segment. likely critical for uniqueness
    const firstPositionalIndex = parts.findIndex(segment => this.hasPositionalIndex(segment));

    // Separate segments into positional and non-positional
    const positionalSegments: number[] = [];
    const nonPositionalSegments: number[] = [];

    for (let i = 0; i < parts.length; i++) {
      if (this.hasPositionalIndex(parts[i])) {
        positionalSegments.push(i);
      } else {
        nonPositionalSegments.push(i);
      }
    }

    // Try removing non-positional segments first (preferred over removing positional ones)
    for (const index of nonPositionalSegments) {
      if (index === 0 || index === parts.length - 1) continue; // Keep first and last
      const simplified = '//' + parts.filter((_, i) => i !== index).join('//');
      if (this.isUniqueSelector(simplified) && this.validateSelector(simplified, targetElement)) {
        return simplified;
      }
    }

    // Try removing intermediate non-positional segments while keeping all positional ones
    if (parts.length > 3) {
      // Create a version that keeps all positional segments and removes some non-positional ones
      for (let i = 1; i < parts.length - 1; i++) {
        // Skip if this is a positional segment. we want to keep those
        if (this.hasPositionalIndex(parts[i])) continue;

        const simplified = '//' + [parts[0], ...parts.slice(i + 1)].join('//');
        if (this.isUniqueSelector(simplified) && this.validateSelector(simplified, targetElement)) {
          return simplified;
        }
      }
    }

    // Try removing positional segments ONLY if they're not the first positional segment
    for (const index of positionalSegments) {
      // Never remove the first positional segment. critical for uniqueness
      if (index === firstPositionalIndex) continue;
      if (index === 0 || index === parts.length - 1) continue; // Keep first and last

      const simplified = '//' + parts.filter((_, i) => i !== index).join('//');
      if (this.isUniqueSelector(simplified) && this.validateSelector(simplified, targetElement)) {
        return simplified;
      }
    }

    // Try removing segments from the front (but keep first positional if exists)
    for (let i = 1; i < parts.length - 1; i++) {
      // Don't remove segments if it would remove the first positional segment
      if (firstPositionalIndex >= 0 && i <= firstPositionalIndex) continue;

      const simplified = '//' + parts.slice(i).join('//');
      if (this.isUniqueSelector(simplified) && this.validateSelector(simplified, targetElement)) {
        return simplified;
      }
    }

    // Try removing intermediate segments (keep first and last)
    if (parts.length > 3) {
      for (let i = 1; i < parts.length - 1; i++) {
        // Don't remove segments if it would remove the first positional segment
        if (firstPositionalIndex >= 0 && i === firstPositionalIndex) continue;

        const simplified = '//' + [parts[0], ...parts.slice(i + 1)].join('//');
        if (this.isUniqueSelector(simplified) && this.validateSelector(simplified, targetElement)) {
          return simplified;
        }
      }
    }

    // Try keeping only anchor + last 2 segments
    if (parts.length > 3) {
      const anchorIndex = this.findAnchorInPath(parts);
      if (anchorIndex >= 0 && anchorIndex < parts.length - 2) {
        const simplified = '//' + [parts[anchorIndex], ...parts.slice(-2)].join('//');
        if (this.isUniqueSelector(simplified) && this.validateSelector(simplified, targetElement)) {
          return simplified;
        }
      }
    }

    return xpath;
  }

  /**
   * Check if a segment has a positional index like [15], [3], etc.
   */
  private hasPositionalIndex(segment: string): boolean {
    return /\[\d+\]$/.test(segment);
  }

  /**
   * Find anchor segment in path (ID or strong attribute)
   */
  private findAnchorInPath(segments: string[]): number {
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].includes('[@id=') ||
          segments[i].includes('[@data-testid=') ||
          segments[i].includes('[@data-test=')) {
        return i;
      }
    }
    return -1;
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
export function generateXPath(element: HTMLElement, options: XPathGeneratorOptions = {}): string {
  const generator = new XPathGenerator(options);
  return generator.generate(element);
}

/**
 * Find an element using XPath selector
 */
export function getElementByXPath(xpath: string, doc: Document = document): Element | null {
  const result = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  return result.singleNodeValue as Element | null;
}