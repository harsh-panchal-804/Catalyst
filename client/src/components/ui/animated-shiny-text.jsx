import { cn } from "../../lib/utils";

export function AnimatedShinyText({ children, className, shimmerWidth = 100 }) {
  return (
    <span
      style={{ "--shiny-width": `${shimmerWidth}px` }}
      className={cn(
        "mx-auto max-w-md text-neutral-600/70 dark:text-neutral-400/70",
        "animate-shiny-text bg-clip-text bg-no-repeat [background-position:0_0] [background-size:var(--shiny-width)_100%]",
        "bg-gradient-to-r from-transparent via-black/80 via-50% to-transparent dark:via-white/80",
        className
      )}
    >
      {children}
    </span>
  );
}

export default AnimatedShinyText;
