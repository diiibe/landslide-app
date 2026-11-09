import type { ReactNode, SVGProps } from "react";
export type IconName =
  | "search"
  | "catalog"
  | "layers"
  | "folder"
  | "chevron"
  | "close"
  | "plus"
  | "check"
  | "arrow"
  | "map"
  | "filter"
  | "mountain";
const paths: Record<IconName, ReactNode> = {
  search: (
    <>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m13 13 4 4" />
    </>
  ),
  catalog: (
    <>
      <rect x="3" y="3" width="5" height="5" rx=".7" />
      <rect x="12" y="3" width="5" height="5" rx=".7" />
      <rect x="3" y="12" width="5" height="5" rx=".7" />
      <rect x="12" y="12" width="5" height="5" rx=".7" />
    </>
  ),
  layers: (
    <>
      <path d="m2.5 7 7.5-4.5L17.5 7 10 11.5Z" />
      <path d="m3 10.5 7 4 7-4M3 14l7 4 7-4" />
    </>
  ),
  folder: <path d="M2.5 6V4.5h5l2 2h8v10h-15Z" />,
  chevron: <path d="m8 5 5 5-5 5" />,
  close: <path d="m5 5 10 10M15 5 5 15" />,
  plus: <path d="M10 4v12M4 10h12" />,
  check: <path d="m4 10 4 4 8-8" />,
  arrow: <path d="M3 10h14m-5-5 5 5-5 5" />,
  map: (
    <>
      <path d="m2.5 4 5-1.5 5 2 5-1.5v13l-5 1.5-5-2-5 1.5Z" />
      <path d="M7.5 2.5v13m5-11v13" />
    </>
  ),
  filter: (
    <>
      <path d="M3 5h14M5 10h10M7 15h6" />
    </>
  ),
  mountain: (
    <>
      <path d="m2 16 6-12 4 7 2-3 4 8Z" />
      <path d="m6 8 2 2 2-2" />
    </>
  ),
};
export function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
