import { Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";

export function ThinkingBar({ text = "Thinking…", className }) {
  return (
    <div className={cn("flex w-full justify-start", className)}>
      <div className="flex w-full max-w-[95%] items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
          </span>
          <span>{text}</span>
        </div>
      </div>
    </div>
  );
}
