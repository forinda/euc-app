const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * The origin other devices should use to reach this app, for join links and
 * QR codes.
 *
 * 1. `VITE_PUBLIC_URL`, if set at build time (custom domain, tunnel).
 * 2. In dev, opened as localhost: the machine's LAN IP on the same port, so a
 *    phone on the same Wi-Fi can open it.
 * 3. Otherwise the page's own origin. When deployed (e.g. on Vercel) that is
 *    already the public address.
 */
export function publicOrigin(): string {
  const configured = import.meta.env.VITE_PUBLIC_URL
  if (configured) return configured.replace(/\/+$/, '')
  if (__DEV_LAN_HOST__ && LOCAL_HOSTNAMES.has(location.hostname)) {
    return `${location.protocol}//${__DEV_LAN_HOST__}${location.port ? `:${location.port}` : ''}`
  }
  return location.origin
}
