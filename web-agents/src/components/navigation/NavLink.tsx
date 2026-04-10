"use client";

import { NavItem } from "@/types/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Navigation Link component
 * 
 * Displays a navigation link with "/" suffix as shown in the wireframe.
 * Uses shadcn/ui Button component with ghost variant for styling.
 * 
 * Supports:
 * - Click handlers
 * - Href links
 * - Optional icons
 * - "/" suffix display
 */
interface NavLinkProps {
  item: NavItem;
  className?: string;
}

export default function NavLink({ item, className }: NavLinkProps) {
  const handleClick = () => {
    if (item.onClick) {
      item.onClick();
    }
  };

  // If href is provided, render as link; otherwise as button
  if (item.href) {
    return (
      <a
        href={item.href}
        className={cn(
          "inline-flex items-center justify-start",
          "w-full",
          className
        )}
      >
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start",
            "h-auto py-2 px-3",
            "text-sm font-normal",
            "hover:bg-accent"
          )}
        >
          {item.icon && <span className="mr-2">{item.icon}</span>}
          <span>{item.label} /</span>
        </Button>
      </a>
    );
  }

  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      className={cn(
        "w-full justify-start",
        "h-auto py-2 px-3",
        "text-sm font-normal",
        "hover:bg-accent",
        className
      )}
    >
      {item.icon && <span className="mr-2">{item.icon}</span>}
      <span>{item.label} /</span>
    </Button>
  );
}


