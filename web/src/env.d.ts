/** Set by vite.config.ts: this machine's LAN IP in dev, '' in production builds. */
declare const __DEV_LAN_HOST__: string

interface ImportMetaEnv {
  /**
   * Optional public origin for join links and QR codes, e.g.
   * https://poll.example.com or a tunnel URL. Defaults to the page's own
   * origin (with the LAN IP in place of localhost during dev).
   */
  readonly VITE_PUBLIC_URL?: string
}
