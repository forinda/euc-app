import { useEffect, useState } from 'react'
import { api } from './api'
import { Home } from './pages/Home'
import { Join } from './pages/Join'
import { Present } from './pages/Present'
import { Start } from './pages/Start'

// Hash routes: #/, #/start, #/present/:code, #/join/:code. No router dependency, and
// they work unchanged when SpaAdapter serves the build.
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
  const [up, setUp] = useState<boolean | null>(null)
  useEffect(() => {
    api
      .get('/hello/health')
      .then((h) => setUp(h.status === 'ok'))
      .catch(() => setUp(false))
  }, [])
  const label = up === null ? 'checking server' : up ? 'server up' : 'server down'
  return <span className={`health health--${up === null ? 'unknown' : up ? 'up' : 'down'}`} title={label} aria-label={label} />
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
