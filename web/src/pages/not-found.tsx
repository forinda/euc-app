import { TextLink } from '../components/text-link'

export function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-zinc-500 dark:text-zinc-400">That link doesn't lead anywhere.</p>
      <TextLink to="/" className="mt-4 inline-block">
        Join a live poll
      </TextLink>
    </main>
  )
}
