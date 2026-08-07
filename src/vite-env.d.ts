/// <reference types="vite/client" />

/**
 * Build-time configuration this app reads.
 *
 * Declared rather than inferred so a typo in an env name is a compile error
 * instead of an `undefined` that silently falls back at runtime.
 */
interface ImportMetaEnv {
  /** Origin of the deployed Apex OS, for the link across to the field console. */
  readonly VITE_APEX_OS_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
