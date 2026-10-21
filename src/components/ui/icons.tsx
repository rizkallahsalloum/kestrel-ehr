import type { ReactNode, SVGProps } from "react";
import { cn } from "./cn";

// Stroke icons redrawn from the design references (24px grid, 1.8 stroke).
// Decorative by default; pass `title` when the icon is the only label.

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { title?: string };

function createIcon(displayName: string, paths: ReactNode) {
  // "AlertCircleIcon" -> "alert-circle": tells shapes apart where meaning depends on them (blocking vs advisory).
  const slug = displayName
    .replace(/Icon$/, "")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase();
  function Icon({ title, className, ...props }: IconProps) {
    return (
      <svg
        data-icon={slug}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
        aria-hidden={title ? undefined : true}
        role={title ? "img" : undefined}
        className={cn("size-4 shrink-0", className)}
        {...props}
      >
        {title && <title>{title}</title>}
        {paths}
      </svg>
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

export const SearchIcon = createIcon(
  "SearchIcon",
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </>,
);

export const LockIcon = createIcon(
  "LockIcon",
  <>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </>,
);

export const CloseIcon = createIcon("CloseIcon", <path d="M6 6l12 12M18 6L6 18" />);

export const AlertTriangleIcon = createIcon(
  "AlertTriangleIcon",
  <>
    <path d="M12 3l9 16H3l9-16z" />
    <path d="M12 10v4M12 17.5h.01" />
  </>,
);

export const AlertCircleIcon = createIcon(
  "AlertCircleIcon",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5.5M12 16.5h.01" />
  </>,
);

export const InfoIcon = createIcon(
  "InfoIcon",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.5h.01" />
  </>,
);

export const ChevronDownIcon = createIcon("ChevronDownIcon", <path d="M6 9l6 6 6-6" />);

export const CalendarIcon = createIcon(
  "CalendarIcon",
  <>
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M8 3v4M16 3v4" />
  </>,
);

export const ClockIcon = createIcon(
  "ClockIcon",
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8v4l3 2" />
  </>,
);

export const PillIcon = createIcon(
  "PillIcon",
  <path d="M10.5 20.5l-7-7a4.9 4.9 0 0 1 7-7l7 7a4.9 4.9 0 0 1-7 7zM8.5 8.5l7 7" />,
);

export const CheckIcon = createIcon("CheckIcon", <path d="M5 12.5l4.5 4.5L19 7.5" />);

export const CheckCircleIcon = createIcon(
  "CheckCircleIcon",
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.8 2.8L16 10" />
  </>,
);

export const ChartIcon = createIcon("ChartIcon", <path d="M4 19V5M4 19h16M8 15v-3m4 3V8m4 7v-5" />);

export const AuditIcon = createIcon(
  "AuditIcon",
  <>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4h6v3H9zM9 11.5h6M9 15.5h4" />
  </>,
);

export const EyeOffIcon = createIcon(
  "EyeOffIcon",
  <>
    <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6 0 9.5 7 9.5 7a17.4 17.4 0 0 1-2.6 3.5M6.6 6.6A17.2 17.2 0 0 0 2.5 12s3.5 7 9.5 7a9.6 9.6 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
  </>,
);

/** Loading indicator for field slots. Visual only: announce loading through a live region. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-line-subtle border-t-focus",
        className,
      )}
    />
  );
}
