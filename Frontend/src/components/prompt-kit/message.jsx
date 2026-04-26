import { cn } from "../../lib/utils";

export function Message({ role = "assistant", children, className }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start", className)}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "bg-background text-foreground"
        )}
      >
        {children}
      </div>
    </div>
  );
}
