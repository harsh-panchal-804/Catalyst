import { Children, useEffect, useRef } from "react";
import { cn } from "../../lib/utils";

export function ChatContainer({ className, children, autoScroll = true }) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const prevCountRef = useRef(0);

  const childCount = Children.count(children);

  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = childCount;

    if (!autoScroll) return;
    // Only scroll when the number of children actually changed (a new
    // message/input appeared). Re-renders driven by timers, drafts, etc.
    // should NOT yank the user back to the bottom.
    if (childCount === prev) return;

    const scrollEl = scrollRef.current;
    if (scrollEl) {
      // Preserve the user's position if they've scrolled up to read history.
      const distanceFromBottom =
        scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
      if (distanceFromBottom > 160) return;
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [childCount, autoScroll]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        "relative flex max-h-[70vh] min-h-[480px] w-full flex-col overflow-y-auto rounded-xl bg-background",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        {children}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
