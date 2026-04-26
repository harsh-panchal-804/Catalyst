import { useEffect, useRef } from "react";
import { ArrowUp, Square } from "lucide-react";
import { cn } from "../../lib/utils";

export function PromptInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Message AI…",
  disabled = false,
  className
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    const next = Math.min(200, Math.max(24, ta.scrollHeight));
    ta.style.height = `${next}px`;
  }, [value]);

  const canSubmit = !disabled && Boolean((value || "").trim());

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (canSubmit) onSubmit?.();
    }
  }

  return (
    <div className={cn("sticky bottom-0 w-full pt-2", className)}>
      <div
        className={cn(
          "mx-auto flex w-full max-w-3xl items-end gap-2 rounded-3xl border border-border/80 bg-background px-3 py-2 shadow-sm transition-all",
          "focus-within:border-foreground/30 focus-within:shadow-md",
          disabled ? "opacity-70" : ""
        )}
      >
        <textarea
          ref={textareaRef}
          value={value || ""}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm leading-6 outline-none ring-0",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-0",
            "disabled:cursor-not-allowed"
          )}
        />
        <button
          type="button"
          onClick={() => canSubmit && onSubmit?.()}
          disabled={!canSubmit}
          aria-label={disabled ? "Stop" : "Send"}
          className={cn(
            "mb-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
            canSubmit
              ? "bg-foreground text-background hover:opacity-90"
              : "bg-muted text-muted-foreground"
          )}
        >
          {disabled ? <Square className="h-3.5 w-3.5" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-muted-foreground">
        Press <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Enter</kbd> to send,{" "}
        <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Shift</kbd>+
        <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px]">Enter</kbd> for newline
      </p>
    </div>
  );
}
