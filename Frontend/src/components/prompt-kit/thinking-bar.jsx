import { AnimatedShinyText } from "../ui/animated-shiny-text";

export function ThinkingBar({ text = "Thinking..." }) {
  return (
    <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
      <AnimatedShinyText>{text}</AnimatedShinyText>
    </div>
  );
}
