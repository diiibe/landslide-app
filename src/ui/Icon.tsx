import type { ReactNode, SVGProps } from "react";
export type IconName =
  | "spaces" | "profile" | "brand" | "extensions"
  | "fileData"
  | "sensor" | "lineData" | "pointData" | "areaData" | "rasterData" | "eye" | "tools"
  | "search"
  | "catalog"
  | "layers"
  | "folder"
  | "folderOpen"
  | "chevron"
  | "close"
  | "plus"
  | "check"
  | "arrow"
  | "map"
  | "filter"
  | "mountain"
  | "settings"
  | "sun"
  | "moon"
  | "weather" | "waves" | "air" | "energy" | "territory" | "factory" | "recycle" | "water" | "leaf" | "services" | "mobility" | "network";
const paths: Record<IconName, ReactNode> = {
  extensions: <path d="M3 4h4V3a2 2 0 0 1 4 0v1h5v4h1a2 2 0 0 1 0 4h-1v5h-5v-1a2 2 0 0 0-4 0v1H3v-5h1a2 2 0 0 0 0-4H3Z"/>,
  brand: <><path d="m2 15 5-10 4 7 3-5 4 8"/><path d="M2 18h16M5 11l2 2 2-3"/></>,
  spaces: <><rect x="2" y="3" width="10" height="10" rx="1.5"/><path d="M6 16h11V7M6 7h2m-2 3h3"/></>,
  profile: <><circle cx="10" cy="6" r="3"/><path d="M3.5 18v-2a6.5 6.5 0 0 1 13 0v2"/></>,
  fileData: <><path d="M4 2h8l4 4v12H4Z"/><path d="M12 2v5h4M7 11h6m-6 3h4"/></>,
  sensor: <><circle cx="10" cy="10" r="2.5"/><path d="M5 5a7 7 0 0 0 0 10m10-10a7 7 0 0 1 0 10M2.5 2.5a10.5 10.5 0 0 0 0 15m15-15a10.5 10.5 0 0 1 0 15"/></>,
  pointData: <><circle cx="6" cy="6" r="2"/><circle cx="14" cy="8" r="2"/><circle cx="8" cy="15" r="2"/></>,
  lineData: <><path d="m3 16 5-7 4 2 5-7"/><circle cx="3" cy="16" r="1.5"/><circle cx="17" cy="4" r="1.5"/></>,
  areaData: <><path d="m3 5 9-2 5 6-3 8-11-2Z"/><path d="m7 12 3-5 4 4"/></>,
  rasterData: <><rect x="3" y="3" width="14" height="14" rx="1"/><path d="m3 10 7-7m-7 12L15 3M5 17 17 5m-7 12 7-7"/></>,
  eye: <><path d="M1.5 10s3-5.5 8.5-5.5 8.5 5.5 8.5 5.5-3 5.5-8.5 5.5S1.5 10 1.5 10Z"/><circle cx="10" cy="10" r="2.5"/></>,
  tools: <><path d="M3 5h14M3 10h14M3 15h14"/><circle cx="7" cy="5" r="2" fill="var(--c-surface)"/><circle cx="13" cy="10" r="2" fill="var(--c-surface)"/><circle cx="8" cy="15" r="2" fill="var(--c-surface)"/></>,
  weather: <><path d="M5 14a4 4 0 1 1 1-7.9A5 5 0 0 1 16 9a2.5 2.5 0 0 1-1 5H5Z"/><path d="m7 17-1 2m5-2-1 2m5-2-1 2"/></>,
  waves: <><path d="M2 7c3-4 5 4 8 0s5 4 8 0M2 12c3-4 5 4 8 0s5 4 8 0M2 17c3-4 5 4 8 0s5 4 8 0"/></>,
  air: <><path d="M2 8h11a3 3 0 1 0-3-3M2 12h14a2 2 0 1 1-2 2M2 16h5"/></>,
  energy: <path d="m11 2-7 9h5l-1 7 8-10h-5Z"/>,
  territory: <><path d="m2 15 7-4 9 4-9 4Zm0-5 7-4 9 4M2 5l7-4 9 4"/></>,
  factory: <><path d="M2 18V8l6 3V7l6 3V3h3l1 15Z"/><path d="M5 14v1m4-1v1m4-1v1"/></>,
  recycle: <><path d="m6 5 4-3 4 3m-4-3v8m6-1 3 4-2 4m2-4-7 4M7 17l-5-1V11m0 5 6-6"/></>,
  water: <path d="M10 2C8 6 4 9 4 13a6 6 0 0 0 12 0c0-4-4-7-6-11Zm-3 11c0 2 1 3 3 3"/>,
  leaf: <><path d="M17 2C6 2 1 8 5 14s13 0 12-12Z"/><path d="m3 18 10-11"/></>,
  services: <><path d="M2 18h16M4 18V7h12v11M2 7l8-5 8 5M8 18v-5h4v5M7 10h1m4 0h1"/></>,
  mobility: <><path d="m7 2-4 16M13 2l4 16M10 3v3m0 3v3m0 3v3"/></>,
  network: <><circle cx="10" cy="10" r="2"/><circle cx="4" cy="3" r="2"/><circle cx="17" cy="5" r="2"/><circle cx="4" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="m5 5 4 4m3 0 3-3M6 15l3-3m3 0 3 3"/></>,
  settings: (
    <>
      <path d="M3 5h14M3 15h14M7 2v6m6 4v6" />
      <circle cx="7" cy="5" r="2" fill="var(--c-surface)" />
      <circle cx="13" cy="15" r="2" fill="var(--c-surface)" />
    </>
  ),
  sun: (
    <>
      <circle cx="10" cy="10" r="3.5" />
      <path d="M10 1v2m0 14v2M1 10h2m14 0h2M3.6 3.6 5 5m10 10 1.4 1.4M3.6 16.4 5 15M15 5l1.4-1.4" />
    </>
  ),
  moon: <path d="M17 12.4A7.5 7.5 0 0 1 7.6 3 7.5 7.5 0 1 0 17 12.4Z" />,
  search: (
    <>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="m13 13 4 4" />
    </>
  ),
  catalog: <><path d="M2 3.5h5a4 4 0 0 1 3 1.3 4 4 0 0 1 3-1.3h5v13h-5a4 4 0 0 0-3 1.3 4 4 0 0 0-3-1.3H2Z"/><path d="M10 5v13M5 7h2m-2 3h2m6-3h2m-2 3h2"/></>,
  layers: (
    <>
      <path d="m2.5 7 7.5-4.5L17.5 7 10 11.5Z" />
      <path d="m3 10.5 7 4 7-4M3 14l7 4 7-4" />
    </>
  ),
  folderOpen: <path d="M2.5 8V4.5h5l2 2h8V9M2.5 8h15l-2 8.5h-13Z" />,
  folder: <path d="M2.5 6V4.5h5l2 2h8v10h-15Z" />,
  chevron: <path d="m8 5 5 5-5 5" />,
  close: <path d="m5 5 10 10M15 5 5 15" />,
  plus: <path d="M10 4v12M4 10h12" />,
  check: <path pathLength="1" d="m4 10 4 4 8-8" />,
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
      data-icon={name}
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
