"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { cn } from "../../lib/utils";

const SidebarContext = createContext(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider.");
  return ctx;
}

export function SidebarProvider({
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  hoverToExpand = true,
  className,
  ...props
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [hovered, setHovered] = useState(false);

  const isControlled = typeof controlledOpen === "boolean";
  const open = isControlled ? controlledOpen : internalOpen;

  function setOpen(next) {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  }

  const expanded = open || (hoverToExpand && hovered);

  const value = useMemo(
    () => ({
      open,
      setOpen,
      hovered,
      setHovered,
      expanded,
      hoverToExpand
    }),
    [open, hovered, expanded, hoverToExpand]
  );

  return (
    <SidebarContext.Provider value={value}>
      <div className={cn("flex w-full", className)} {...props}>
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function Sidebar({ className, children, ...props }) {
  const { expanded, hoverToExpand, setHovered } = useSidebar();
  return (
    <aside
      data-state={expanded ? "expanded" : "collapsed"}
      onMouseEnter={() => hoverToExpand && setHovered(true)}
      onMouseLeave={() => hoverToExpand && setHovered(false)}
      className={cn(
        "hidden h-full shrink-0 border-r bg-background transition-[width] duration-200 ease-linear md:block",
        expanded ? "w-64" : "w-14",
        className
      )}
      {...props}
    >
      <div className="flex h-full w-full flex-col">{children}</div>
    </aside>
  );
}

export function SidebarBody({ className, ...props }) {
  return <div className={cn("flex h-full w-full flex-col overflow-hidden", className)} {...props} />;
}

export function SidebarHeader({ className, ...props }) {
  return <div className={cn("border-b p-2", className)} {...props} />;
}

export function SidebarContent({ className, ...props }) {
  return <div className={cn("min-h-0 flex-1 overflow-auto", className)} {...props} />;
}

export function SidebarMenu({ className, ...props }) {
  return <ul className={cn("flex flex-col gap-1", className)} {...props} />;
}

export function SidebarMenuItem({ className, ...props }) {
  return <li className={cn("list-none", className)} {...props} />;
}

export function SidebarMenuButton({ isActive = false, className, children, ...props }) {
  const { expanded } = useSidebar();
  return (
    <button
      type="button"
      data-active={isActive}
      className={cn(
        "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm transition-colors hover:bg-muted",
        isActive && "bg-muted font-medium",
        !expanded && "justify-center [&>span:last-child]:hidden",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SidebarLink({ link, isActive = false, className, ...props }) {
  const { expanded } = useSidebar();
  if (!link) return null;
  const Comp = link.href ? "a" : "button";
  return (
    <Comp
      type={link.href ? undefined : "button"}
      href={link.href}
      onClick={link.onClick}
      data-active={isActive}
      className={cn(
        "flex w-full items-center gap-3 rounded-md p-2 text-sm transition-colors hover:bg-muted",
        isActive && "bg-muted font-medium",
        !expanded && "justify-center [&>span:last-child]:hidden",
        className
      )}
      {...props}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{link.icon}</span>
      <span>{link.label}</span>
    </Comp>
  );
}

export function SidebarInset({ className, ...props }) {
  return <main className={cn("min-w-0 flex-1", className)} {...props} />;
}
