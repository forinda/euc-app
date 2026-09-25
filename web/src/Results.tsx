import { percent, type Snapshot } from './session'

type Question = NonNullable<Snapshot['question']>

/** Projector results: big percentages, vote counts secondary. */
export function Results({ question }: { question: Question }) {
  return (
    <div className="results" aria-live="polite">
      {(['yes', 'no'] as const).map((choice) => {
        const pct = percent(question[choice], question.total)
        return (
          <div key={choice} className={`result result--${choice}`}>
            <div className="result__head">
              <span className="result__label">{choice === 'yes' ? 'Yes' : 'No'}</span>
              <span className="result__pct">{pct}%</span>
            </div>
            <div className="result__track">
              <div className="result__fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="result__count">
              {question[choice]} {question[choice] === 1 ? 'vote' : 'votes'}
            </div>
          </div>
        )
      })}
    </div>
  )
}
