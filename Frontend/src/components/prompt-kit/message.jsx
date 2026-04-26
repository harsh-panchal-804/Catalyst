import { Sparkles, User } from "lucide-react";
import { cn } from "../../lib/utils";

export function Message({ role = "assistant", children, className }) {
  const isUser = role === "user";

  if (isUser) {
    return (
      <div className={cn("flex w-full justify-end", className)}>
        <div className="flex max-w-[85%] items-start gap-3">
          <div className="rounded-3xl bg-muted px-4 py-2.5 text-sm text-foreground shadow-sm">
            {children}
          </div>
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <User className="h-4 w-4" />
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex w-full justify-start", className)}>
      <div className="flex w-full max-w-[95%] items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 text-sm leading-7 text-foreground [&_p]:my-0">
          {children}
        </div>
      </div>
    </div>
  );
}
