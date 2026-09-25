import { useState } from 'react'

export const CODE_LENGTH = 6

/** Keep letters/digits only, so a pasted "rha dyp" becomes "RHADYP". */
const clean = (raw: string) =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LENGTH)

/**
 * Six boxes backed by ONE real input stretched invisibly over them, so the
 * platform handles typing, backspace, paste and autofill — no per-box focus
 * juggling. Calls `onComplete` when the sixth character lands.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  invalid = false,
}: {
  value: string
  onChange: (code: string) => void
  onComplete?: (code: string) => void
  invalid?: boolean
}) {
  const [focused, setFocused] = useState(false)
  const active = Math.min(value.length, CODE_LENGTH - 1)
  return (
    <div className="relative grid grid-cols-6 gap-2">
      <input
        className="absolute inset-0 w-full cursor-text text-base opacity-0" // 16px: no iOS zoom on focus
        aria-label="Session code"
        aria-invalid={invalid}
        value={value}
        autoFocus
        autoComplete="one-time-code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => {
          const next = clean(e.target.value)
          onChange(next)
          if (next.length === CODE_LENGTH && next !== value) onComplete?.(next)
        }}
      />
      {Array.from({ length: CODE_LENGTH }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`grid aspect-[4/5] place-items-center rounded-xl border-2 bg-white text-3xl font-extrabold tabular-nums dark:bg-zinc-900 ${
            invalid
              ? 'border-red-500'
              : focused && i === active
                ? 'border-indigo-500 ring-4 ring-indigo-500/25'
                : value[i]
                  ? 'border-zinc-400 dark:border-zinc-500'
                  : 'border-zinc-200 dark:border-zinc-800'
          }`}
        >
          {value[i] ?? ''}
        </span>
      ))}
    </div>
  )
}
