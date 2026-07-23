/*
 * Minimal ambient typing for the one build-time value the auth surface reads.
 * The apps bundle this package with Vite, which replaces import.meta.env at
 * build time; declaring it here keeps the package self contained without a
 * dependency on vite/client.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
