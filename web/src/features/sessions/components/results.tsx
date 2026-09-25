import { percent, type Question } from '../types'

const TONE = {
  yes: { label: 'Yes', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  no: { label: 'No', text: 'text-red-400', bar: 'bg-red-500' },
}

/** Projector results: the percentage is the headline, vote counts secondary. */
export function Results({ question }: { question: Question }) {
  return (
    <div className="grid gap-[clamp(1.25rem,4vh,2.25rem)]" aria-live="polite">
      {(['yes', 'no'] as const).map((choice) => {
        const pct = percent(question[choice], question.total)
        return (
          <div key={choice}>
            <div className="flex items-baseline justify-between">
              <span className="text-[clamp(1.4rem,3vw,2.4rem)] font-bold">{TONE[choice].label}</span>
              <span className={`text-[clamp(2.2rem,6vw,4.8rem)] leading-none font-extrabold tabular-nums ${TONE[choice].text}`}>
                {pct}%
              </span>
            </div>
            <div className="mt-2 mb-1.5 h-[clamp(1.25rem,3.5vh,2.25rem)] overflow-hidden rounded-full bg-zinc-800">
              <div
                className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${TONE[choice].bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[clamp(0.95rem,1.6vw,1.2rem)] text-zinc-400 tabular-nums">
              {question[choice]} {question[choice] === 1 ? 'vote' : 'votes'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
