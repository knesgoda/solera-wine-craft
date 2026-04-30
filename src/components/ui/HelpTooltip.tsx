import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

interface HelpTooltipProps {
  content: string;
  size?: "sm" | "md";
}

/**
 * Click-activated help tooltip. Renders a small ? button inline with text.
 * Uses Radix Popover (click to open, click outside / Escape to close).
 * Mobile and tablet friendly — no hover required.
 */
export function HelpTooltip({ content, size = "sm" }: HelpTooltipProps) {
  const [open, setOpen] = React.useState(false);
  const dim = size === "sm" ? 16 : 20;
  const fontSize = size === "sm" ? 10 : 11;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label="Help"
          aria-expanded={open}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((o) => !o);
          }}
          className="inline-flex items-center justify-center rounded-full ml-1 align-middle transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{
            width: dim,
            height: dim,
            border: "1px solid #C8902A",
            color: "#C8902A",
            background: "transparent",
            fontSize,
            fontWeight: 600,
            lineHeight: 1,
            cursor: "pointer",
            // @ts-expect-error CSS custom prop for focus ring
            "--tw-ring-color": "#C8902A",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "#C8902A";
            (e.currentTarget as HTMLButtonElement).style.color = "#FFFFFF";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#C8902A";
          }}
        >
          ?
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          role="tooltip"
          side="top"
          align="center"
          sideOffset={6}
          collisionPadding={12}
          className="z-50 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          style={{
            maxWidth: 280,
            background: "#1a1a1a",
            color: "#F5F0E8",
            fontSize: 13,
            lineHeight: 1.5,
            borderRadius: 6,
            padding: "10px 14px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {content}
          <PopoverPrimitive.Arrow width={10} height={6} style={{ fill: "#1a1a1a" }} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export default HelpTooltip;