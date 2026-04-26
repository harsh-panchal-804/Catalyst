import { cn } from "../../lib/utils";

export function ChatContainer({ className, children }) {
  return (
    <div
      className={cn(
        "flex min-h-[420px] flex-col rounded-lg bg-muted/20 p-3",
        className
      )}
    >
      {children}
    </div>
  );
}
