import { useQuery } from '@tanstack/react-query'
import { healthQueries } from '../features/health/queries'

export function HealthDot() {
  const { data, isError, isPending } = useQuery(healthQueries.status())
  const up = data?.status === 'ok' && !isError
  const label = isPending ? 'checking server' : up ? 'server up' : 'server down'
  return (
    <span
      title={label}
      aria-label={label}
      className={`fixed top-[calc(0.75rem+env(safe-area-inset-top,0px))] right-3 size-2.5 rounded-full ${
        isPending ? 'bg-zinc-400' : up ? 'bg-emerald-500' : 'bg-red-500'
      }`}
    />
  )
}
