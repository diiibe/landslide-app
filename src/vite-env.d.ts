/// <reference types="vite/client" />

/** Build-time constant injected by Vite's `define` in vite.config.ts —
 *  populated from package.json `version` so the topbar can render the
 *  current release tag without a runtime fetch. */
declare const __APP_VERSION__: string;
