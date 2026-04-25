import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

const Select = React.forwardRef(
  ({ className, children, placeholder, value, onValueChange, onChange, ...props }, ref) => {
    const handleChange = (e) => {
      onChange?.(e);
      onValueChange?.(e.target.value);
    };
    return (
      <div className={cn("relative", className)}>
        <select
          ref={ref}
          value={value ?? ""}
          onChange={handleChange}
          className={cn(
            "flex h-9 w-full appearance-none items-center rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm shadow-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          ) : null}
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
