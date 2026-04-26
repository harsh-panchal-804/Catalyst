import { cn } from "../../lib/utils";

const VARIANTS = {
  default: "bg-primary text-primary-foreground border-transparent",
  secondary: "bg-secondary text-secondary-foreground border-transparent",
  outline: "border-border text-foreground",
  destructive: "bg-destructive text-destructive-foreground border-transparent"
};

function Badge({ className, variant = "outline", ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        VARIANTS[variant] || VARIANTS.outline,
        className
      )}
      {...props}
    />
  );
}

export { Badge };
