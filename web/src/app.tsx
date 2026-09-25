import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { healthQueries } from './features/health/queries'
import { Home } from './pages/home'
import { Join } from './pages/join'
import { Present } from './pages/present'
import { Start } from './pages/start'

// Hash routes: #/, #/start, #/present/:code, #/join/:code. No router
// dependency, and they work unchanged when SpaAdapter serves the build.
function parseRoute(hash: string) {
  const [, page, code] = hash.replace(/^#/, '').split('/')
  const clean = code?.toUpperCase()
  if (page === 'present' && clean) return { page: 'present', code: clean } as const
  if (page === 'join' && clean) return { page: 'join', code: clean } as const
  if (page === 'start') return { page: 'start' } as const
  return { page: 'home' } as const
}

function useHashRoute() {
  const [route, setRoute] = useState(() => parseRoute(location.hash))
  useEffect(() => {
    const sync = () => setRoute(parseRoute(location.hash))
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  return route
}

function HealthDot() {
  const { data, isError, isPending } = useQuery(healthQueries.status())
  const up = data?.status === 'ok'
  const label = isPending ? 'checking server' : up && !isError ? 'server up' : 'server down'
  return (
    <span
      title={label}
      aria-label={label}
      className={`fixed top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 size-2.5 rounded-full ${
        isPending ? 'bg-zinc-400' : up && !isError ? 'bg-emerald-500' : 'bg-red-500'
      }`}
    />
  )
}

export function App() {
  const route = useHashRoute()
  return (
    <>
      <HealthDot />
      {route.page === 'present' ? (
        <Present key={route.code} code={route.code} />
      ) : route.page === 'join' ? (
        <Join key={route.code} code={route.code} />
      ) : route.page === 'start' ? (
        <Start />
      ) : (
        <Home />
      )}
    </>
  )
}
