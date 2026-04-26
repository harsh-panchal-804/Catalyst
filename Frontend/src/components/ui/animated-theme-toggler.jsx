import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "../../lib/utils";

function getInitialDark() {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem("theme");
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return true;
}

export function AnimatedThemeToggler({ className, duration = 500 }) {
  const buttonRef = useRef(null);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const initial = getInitialDark();
    setIsDark(initial);
    document.documentElement.classList.toggle("dark", initial);
  }, []);

  function applyTheme(nextDark) {
    setIsDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    try {
      window.localStorage.setItem("theme", nextDark ? "dark" : "light");
    } catch (_e) {
      // ignore storage errors
    }
  }

  async function toggle() {
    const nextDark = !isDark;

    if (typeof document === "undefined" || !document.startViewTransition || !buttonRef.current) {
      applyTheme(nextDark);
      return;
    }

    await document.startViewTransition(() => applyTheme(nextDark)).ready;

    const rect = buttonRef.current.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`
        ]
      },
      {
        duration,
        easing: "ease-in-out",
        pseudoElement: "::view-transition-new(root)"
      }
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background hover:bg-muted",
        className
      )}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export default AnimatedThemeToggler;
