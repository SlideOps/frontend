/*
 * Ambient typing for the build-time values this package reads. The apps bundle it
 * with Vite, which replaces import.meta.env at build time; declaring the shape
 * here keeps the package self contained without depending on vite/client.
 */
interface ImportMetaEnv {
  /**
   * Where the backend API lives. Either a path on this origin (`/api/v1`, the
   * default) or an absolute URL to a backend deployed elsewhere
   * (`https://api.example.com/api/v1`). See .env.example for the CORS and cookie
   * requirements that come with the absolute form.
   */
  readonly VITE_API_BASE_URL?: string;
  /** Older name for VITE_API_BASE_URL, still honoured so nothing breaks. */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
