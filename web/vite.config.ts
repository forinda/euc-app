import { networkInterfaces } from 'node:os'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Virtual interfaces phones on the Wi-Fi can't reach: loopback, Docker,
// bridges, VMs, VPNs (Tailscale, WireGuard, ZeroTier, …).
const VIRTUAL = /^(lo|docker|br-|veth|virbr|vmnet|vboxnet|tailscale|utun|tun|tap|wg|zt)/i
// Physical Wi-Fi / Ethernet names on Linux, macOS and Windows.
const PHYSICAL = /^(wl|en|eth|wi-?fi|ethernet)/i

/** This machine's LAN IPv4 address (e.g. 192.168.1.20), preferring Wi-Fi/Ethernet. */
function lanAddress(): string {
  const candidates = Object.entries(networkInterfaces())
    .filter(([name]) => !VIRTUAL.test(name))
    .flatMap(([name, addresses]) =>
      (addresses ?? [])
        .filter((a) => a.family === 'IPv4' && !a.internal)
        .map((a) => ({ name, address: a.address })),
    )
  return (candidates.find((c) => PHYSICAL.test(c.name)) ?? candidates[0])?.address ?? ''
}

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  define: {
    // In dev, the presenter screen swaps "localhost" for this address in the
    // join link and QR code, so phones on the same Wi-Fi can reach it
    // (src/lib/public-url.ts). Empty in production builds, where the page's
    // own address is already the public one.
    __DEV_LAN_HOST__: JSON.stringify(command === 'serve' ? lanAddress() : ''),
  },
  server: {
    // Listen on the network, not just this machine, so phones can open the
    // join link during development. Set to false to keep it local-only.
    host: true,
    // The KickJS server (kick dev) listens on 3000; the client's baseUrl is
    // the relative '/api/v1', so the browser hits Vite and Vite forwards.
    // Phones on the LAN go through this proxy too.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
}))
