import { createContext, useContext, useId, useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

const AccordionCtx = createContext(null);
const AccordionItemCtx = createContext(null);

export function Accordion({ type = "single", collapsible = true, className, children }) {
  const [openValues, setOpenValues] = useState([]);

  function toggle(value) {
    setOpenValues((prev) => {
      const isOpen = prev.includes(value);
      if (type === "single") {
        if (isOpen && collapsible) return [];
        return [value];
      }
      return isOpen ? prev.filter((v) => v !== value) : [...prev, value];
    });
  }

  return (
    <AccordionCtx.Provider value={{ openValues, toggle }}>
      <div className={cn("w-full divide-y rounded border", className)}>{children}</div>
    </AccordionCtx.Provider>
  );
}

export function AccordionItem({ value, className, children }) {
  const id = useId();
  return (
    <AccordionItemCtx.Provider value={{ value: value || id }}>
      <div className={cn("", className)}>{children}</div>
    </AccordionItemCtx.Provider>
  );
}

export function AccordionTrigger({ className, children }) {
  const ctx = useContext(AccordionCtx);
  const item = useContext(AccordionItemCtx);
  if (!ctx || !item) return null;
  const isOpen = ctx.openValues.includes(item.value);
  return (
    <button
      type="button"
      onClick={() => ctx.toggle(item.value)}
      aria-expanded={isOpen}
      className={cn(
        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50",
        className
      )}
    >
      <span className="flex-1">{children}</span>
      <ChevronDown
        className={cn("h-4 w-4 shrink-0 transition-transform", isOpen ? "rotate-180" : "rotate-0")}
      />
    </button>
  );
}

export function AccordionContent({ className, children }) {
  const ctx = useContext(AccordionCtx);
  const item = useContext(AccordionItemCtx);
  const ref = useRef(null);
  const [maxHeight, setMaxHeight] = useState("0px");

  const isOpen = !!ctx && !!item && ctx.openValues.includes(item.value);

  useEffect(() => {
    if (!ref.current) return;
    if (isOpen) {
      setMaxHeight(`${ref.current.scrollHeight}px`);
    } else {
      setMaxHeight("0px");
    }
  }, [isOpen, children]);

  return (
    <div
      style={{ maxHeight }}
      className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
      aria-hidden={!isOpen}
    >
      <div ref={ref} className={cn("border-t px-3 py-3", className)}>
        {children}
      </div>
    </div>
  );
}

export default Accordion;
