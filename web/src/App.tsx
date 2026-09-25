import { useEffect, useState } from 'react'
import { api } from './api'
import { Tasks } from './Tasks'

// The response types below are INFERRED from the server's handlers —
// change server/src/modules/hello/hello.service.ts and these types follow on
// the next `kick typegen`. Not under `kick dev`: resolving the client map
// builds a whole TypeScript program, so it is a build step, not a per-save one.
type Greeting = Awaited<ReturnType<typeof fetchGreeting>>

function fetchGreeting() {
  return api.get('/hello')
}

export function App() {
  const [greeting, setGreeting] = useState<Greeting | null>(null)
  const [health, setHealth] = useState<string>('checking…')

  useEffect(() => {
    fetchGreeting().then(setGreeting).catch(console.error)
    api
      .get('/hello/health')
      .then((h) => setHealth(h.status))
      .catch(() => setHealth('down'))
  }, [])

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 640, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>KickJS fullstack</h1>
      <p>
        <strong>{greeting?.message ?? 'loading…'}</strong>
      </p>
      <p>
        Server said hello at <code>{greeting?.timestamp ?? '…'}</code> — health:{' '}
        <code>{health}</code>
      </p>
      <Tasks />
    </main>
  )
}
