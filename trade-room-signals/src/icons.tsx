// Line icons for the signal form and card. 24px grid, stroke follows currentColor.
import type { SVGProps } from "react";

const paths = {
  bolt: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />,
  chat: <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.4-4A8 8 0 1 1 20 11.5Z" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  chart: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M7 16v-3M11 16V8M15 16v-5M19 16v-2" />
      <path d="M7 8h2" />
    </>
  ),
  robot: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="3" />
      <path d="M12 4v4M9 13h.01M15 13h.01M9.5 17h5" />
      <circle cx="12" cy="3.5" r="1" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  arrow: <path d="m9 6 6 6-6 6" />,
  gold: (
    <>
      <path d="M8.5 4h7l1.5 6h-10l1.5-6Z" />
      <path d="M4 20l1.5-6h6L13 20H4ZM11 20l1.5-6h6L20 20h-9Z" />
    </>
  ),
  note: <path d="M5 4h14v12l-4 4H5V4ZM15 20v-4h4M8 9h8M8 13h5" />,
};

export type IconName = keyof typeof paths;

export function Icon({ name, size = 16, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
