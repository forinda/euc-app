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
  disabled = false,
}: {
  value: string
  onChange: (code: string) => void
  onComplete?: (code: string) => void
  invalid?: boolean
  disabled?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div className={`code-boxes${invalid ? ' code-boxes--invalid' : ''}`}>
      <input
        className="code-boxes__input"
        aria-label="Session code"
        aria-invalid={invalid}
        value={value}
        disabled={disabled}
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
          className={`code-box${value[i] ? ' code-box--filled' : ''}${
            focused && i === Math.min(value.length, CODE_LENGTH - 1) ? ' code-box--active' : ''
          }`}
        >
          {value[i] ?? ''}
        </span>
      ))}
    </div>
  )
}
