import * as React from "react";
import { ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { cn } from "../../lib/utils";

const ChartContext = React.createContext(null);

function useChartConfig() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error("Chart components must be used inside <ChartContainer />");
  return ctx;
}

function buildCssVars(config) {
  const lines = [];
  Object.entries(config || {}).forEach(([key, value]) => {
    if (value?.color) lines.push(`--color-${key}: ${value.color};`);
  });
  return lines.join(" ");
}

const ChartContainer = React.forwardRef(
  ({ id, className, config, children, ...props }, ref) => {
    const uid = React.useId();
    const chartId = `chart-${id || uid.replace(/:/g, "")}`;
    const cssVars = buildCssVars(config);
    return (
      <ChartContext.Provider value={{ config }}>
        <div
          ref={ref}
          data-chart={chartId}
          className={cn(
            "flex aspect-square justify-center text-xs",
            "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground",
            "[&_.recharts-polar-grid_line]:stroke-border",
            "[&_.recharts-polar-angle-axis_text]:fill-muted-foreground",
            "[&_.recharts-radial-bar-background-sector]:fill-muted",
            "[&_.recharts-tooltip-cursor]:stroke-border",
            className
          )}
          style={{ ...(props.style || {}), ...(cssVars ? cssVarsToObject(cssVars) : {}) }}
          {...props}
        >
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      </ChartContext.Provider>
    );
  }
);
ChartContainer.displayName = "ChartContainer";

function cssVarsToObject(cssText) {
  const out = {};
  cssText
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((decl) => {
      const idx = decl.indexOf(":");
      if (idx < 0) return;
      const k = decl.slice(0, idx).trim();
      const v = decl.slice(idx + 1).trim();
      if (k.startsWith("--")) out[k] = v;
    });
  return out;
}

function ChartTooltipContent({ active, payload, label, hideLabel = false, className }) {
  const { config } = useChartConfig();
  if (!active || !payload?.length) return null;
  return (
    <div
      className={cn(
        "rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md",
        className
      )}
    >
      {!hideLabel && label ? (
        <div className="mb-1 font-semibold">{label}</div>
      ) : null}
      <div className="grid gap-1">
        {payload.map((item, idx) => {
          const key = item.dataKey || item.name;
          const cfg = (config && config[key]) || {};
          const color = cfg.color || item.color || "currentColor";
          return (
            <div
              key={`${key}-${idx}`}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ background: color }}
                />
                <span className="text-muted-foreground">
                  {cfg.label || item.name || key}
                </span>
              </div>
              <span className="font-mono font-medium">
                {typeof item.value === "number" ? item.value : String(item.value ?? "-")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ChartTooltip = RTooltip;

function ChartLegend({ payload, className }) {
  const { config } = useChartConfig();
  if (!payload?.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-3 text-xs", className)}>
      {payload.map((item, idx) => {
        const key = item.dataKey || item.value;
        const cfg = (config && config[key]) || {};
        const color = cfg.color || item.color || "currentColor";
        return (
          <div key={`${key}-${idx}`} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: color }}
            />
            <span className="text-muted-foreground">
              {cfg.label || item.value || key}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend };
