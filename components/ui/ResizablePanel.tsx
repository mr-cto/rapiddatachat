import React, {
  useState,
  useRef,
  useEffect,
  createContext,
  useContext,
} from "react";

// Context for sharing resize state between panels
interface ResizeContextType {
  leftPanelWidth: number;
  setLeftPanelWidth: (width: number) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  containerWidth: number;
}

const ResizeContext = createContext<ResizeContextType | null>(null);

// ResizablePanelGroup component to manage multiple panels
interface ResizablePanelGroupProps {
  children: React.ReactNode;
  defaultLeftWidth: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  className?: string;
  onResize?: (leftWidth: number, rightWidth: number) => void;
}

const ResizablePanelGroup: React.FC<ResizablePanelGroupProps> = ({
  children,
  defaultLeftWidth,
  minLeftWidth = 200,
  maxLeftWidth = 800,
  className = "",
  onResize,
}) => {
  const [leftPanelWidth, setLeftPanelWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update container width on mount and resize
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    // Initial update
    updateContainerWidth();

    // Update on window resize
    window.addEventListener("resize", updateContainerWidth);
    return () => window.removeEventListener("resize", updateContainerWidth);
  }, []);

  // Handle resize effect
  useEffect(() => {
    if (onResize && containerWidth > 0) {
      const rightWidth = containerWidth - leftPanelWidth;
      onResize(leftPanelWidth, rightWidth);
    }
  }, [leftPanelWidth, containerWidth, onResize]);

  return (
    <ResizeContext.Provider
      value={{
        leftPanelWidth,
        setLeftPanelWidth,
        isDragging,
        setIsDragging,
        containerWidth,
      }}
    >
      <div ref={containerRef} className={`flex ${className}`}>
        {children}
      </div>
    </ResizeContext.Provider>
  );
};

// Individual panel component
interface ResizablePanelProps {
  children: React.ReactNode;
  type: "left" | "right";
  className?: string;
  scrollable?: boolean;
}

const ResizablePanel: React.FC<ResizablePanelProps> = ({
  children,
  type,
  className = "",
  scrollable = false,
}) => {
  const context = useContext(ResizeContext);

  if (!context) {
    throw new Error("ResizablePanel must be used within a ResizablePanelGroup");
  }

  const {
    leftPanelWidth,
    setLeftPanelWidth,
    isDragging,
    setIsDragging,
    containerWidth,
  } = context;
  const panelRef = useRef<HTMLDivElement>(null);

  // Calculate width based on panel type
  const width =
    type === "left"
      ? leftPanelWidth
      : Math.max(containerWidth - leftPanelWidth, 0);

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // Handle drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      // Get min and max from context or use defaults
      const minWidth = 200;
      const maxWidth = Math.min(800, containerWidth * 0.8);

      if (newWidth >= minWidth && newWidth <= maxWidth) {
        // Update state (this will be applied after the event loop)
        setLeftPanelWidth(newWidth);

        // Direct DOM updates for immediate effect
        if (panelRef.current) {
          panelRef.current.style.width = `${newWidth}px`;
        }

        // Update right panel if it exists
        const rightPanel = panelRef.current?.nextElementSibling;
        if (rightPanel) {
          (
            rightPanel as HTMLElement
          ).style.width = `calc(100% - ${newWidth}px)`;
        }

        // Force update chat input position and width immediately
        const chatInput = document.querySelector(".chat-input-container");
        if (chatInput) {
          (chatInput as HTMLElement).style.left = `${newWidth}px`;
          (chatInput as HTMLElement).style.width = `calc(100% - ${newWidth}px)`;
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, setIsDragging, setLeftPanelWidth]);

  return (
    <div
      ref={panelRef}
      className={`relative ${className}`}
      style={{
        width: type === "left" ? `${width}px` : undefined,
        flex: type === "right" ? "1" : undefined,
      }}
    >
      <div
        className={scrollable ? "h-full overflow-y-auto" : ""}
        style={{ maxHeight: scrollable ? "100%" : "none" }}
      >
        {children}
      </div>

      {type === "left" && (
        <div
          className="absolute top-0 right-0 w-1 h-full bg-ui-border cursor-col-resize hover:bg-accent-primary hover:w-1.5 transition-all"
          onMouseDown={handleMouseDown}
          style={{
            transform: "translateX(50%)",
            zIndex: 10,
          }}
        />
      )}
    </div>
  );
};

export { ResizablePanel, ResizablePanelGroup };
