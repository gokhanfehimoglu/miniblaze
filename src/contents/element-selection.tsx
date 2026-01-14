import { useEffect, useState } from "react";
import { generateXPath } from "~utils/xpath";
import "~style.css";

interface ElementSelectionModalProps {
  selectedElement: HTMLElement | null;
  xpath: string | null;
  onCancel: () => void;
  onInsert: () => void;
}

function ElementSelectionModal({
  selectedElement,
  xpath,
  onCancel,
  onInsert
}: ElementSelectionModalProps) {
  return (
    <div
      className="miniblaze-modal-content"
      style={{
        position: "fixed",
        bottom: "20px",
        left: "20px",
        backgroundColor: "white",
        border: "2px solid #3b82f6",
        borderRadius: "8px",
        padding: "16px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        zIndex: 10000,
        minWidth: "300px",
        fontFamily: "system-ui, -apple-system, sans-serif"
      }}
    >
      {!selectedElement ? (
        <>
          <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#374151" }}>
            Click an item to select it
          </p>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onCancel}
              style={{
                padding: "8px 16px",
                backgroundColor: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              Cancel
            </button>
            <button
              disabled
              style={{
                padding: "8px 16px",
                backgroundColor: "#d1d5db",
                color: "#9ca3af",
                border: "none",
                borderRadius: "4px",
                cursor: "not-allowed",
                fontSize: "14px"
              }}
            >
              Insert into snippet
            </button>
          </div>
        </>
      ) : (
        <>
          <p style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#374151" }}>
            Item selected. You can now insert it into your snippet or click on another item on the page to change your selection
          </p>
          {xpath && (
            <div style={{ marginBottom: "12px" }}>
              <p style={{ margin: "0 0 4px 0", fontSize: "12px", color: "#6b7280" }}>
                XPath:
              </p>
              <code
                style={{
                  display: "block",
                  padding: "8px",
                  backgroundColor: "#f3f4f6",
                  borderRadius: "4px",
                  fontSize: "11px",
                  wordBreak: "break-all",
                  color: "#1f2937"
                }}
              >
                {xpath}
              </code>
            </div>
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onCancel}
              style={{
                padding: "8px 16px",
                backgroundColor: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              Cancel
            </button>
            <button
              onClick={onInsert}
              style={{
                padding: "8px 16px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "14px"
              }}
            >
              Insert into snippet
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ElementSelectionOverlay() {
  const [isActive, setIsActive] = useState(false);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [xpath, setXpath] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.name === "start-element-selection") {
        setIsActive(true);
        setSelectedElement(null);
        setXpath(null);
      } else if (message.name === "stop-element-selection") {
        setIsActive(false);
        setSelectedElement(null);
        setHoveredElement(null);
        setXpath(null);
        removeOverlays();
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      setHoveredElement(target);
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (target.tagName.toLowerCase() === "plasmo-csui") {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const generatedXPath = generateXPath(target);

      setSelectedElement(target);
      setXpath(generatedXPath);
    };

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("click", handleClick, true);
    };
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;

    updateOverlays();
  }, [isActive, selectedElement, hoveredElement]);

  const updateOverlays = () => {
    removeOverlays();

    if (hoveredElement && hoveredElement !== selectedElement) {
      createOverlay(hoveredElement, "#fbbf24", "2px solid #f59e0b");
    }

    if (selectedElement) {
      createOverlay(selectedElement, "#3b82f6", "3px solid #2563eb");
    }
  };

  const createOverlay = (element: HTMLElement, bgColor: string, border: string) => {
    const rect = element.getBoundingClientRect();
    const overlay = document.createElement("div");

    overlay.style.position = "fixed";
    overlay.style.left = rect.left + "px";
    overlay.style.top = rect.top + "px";
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";
    overlay.style.backgroundColor = bgColor;
    overlay.style.border = border;
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "9999";
    overlay.style.opacity = "0.3";
    overlay.className = "miniblaze-selection-overlay";

    document.body.appendChild(overlay);
  };

  const removeOverlays = () => {
    const overlays = document.querySelectorAll(".miniblaze-selection-overlay");
    overlays.forEach(overlay => overlay.remove());
  };

  const handleCancel = () => {
    setIsActive(false);
    setSelectedElement(null);
    setHoveredElement(null);
    setXpath(null);
    removeOverlays();
  };

  const handleInsert = async () => {
    if (!selectedElement || !xpath) return;

    chrome.runtime.sendMessage({
      name: "element-selected",
      body: {
        xpath: xpath,
        url: window.location.href
      }
    });

    setIsActive(false);
    setSelectedElement(null);
    setHoveredElement(null);
    setXpath(null);
    removeOverlays();
  };

  if (!isActive) return null;

  return (
    <ElementSelectionModal
      selectedElement={selectedElement}
      xpath={xpath}
      onCancel={handleCancel}
      onInsert={handleInsert}
    />
  );
}

export default ElementSelectionOverlay;
