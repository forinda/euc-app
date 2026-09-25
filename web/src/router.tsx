import { createBrowserRouter, Outlet, useParams } from 'react-router'
import { HealthDot } from './components/health-dot'
import { Home } from './pages/home'
import { Join } from './pages/join'
import { NotFound } from './pages/not-found'
import { Present } from './pages/present'
import { Start } from './pages/start'

function RootLayout() {
  return (
    <>
      <HealthDot />
      <Outlet />
    </>
  )
}

/** Codes are case-insensitive: /join/abc123 and /join/ABC123 are the same session. */
function useCode() {
  return (useParams().code ?? '').toUpperCase()
}

// `key={code}` remounts the page when the code changes, resetting its state and socket.
function JoinRoute() {
  const code = useCode()
  return <Join key={code} code={code} />
}

function PresentRoute() {
  const code = useCode()
  return <Present key={code} code={code} />
}

// Real paths, not hash routes: the QR code encodes /join/:code. In production
// SpaAdapter serves index.html for them; in dev Vite does.
export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/start', element: <Start /> },
      { path: '/join/:code', element: <JoinRoute /> },
      { path: '/present/:code', element: <PresentRoute /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
