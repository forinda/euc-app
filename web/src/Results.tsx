import type { Snapshot } from './session'

type Question = NonNullable<Snapshot['question']>

export function Results({ question, large = false }: { question: Question; large?: boolean }) {
  const pct = (n: number) => (question.total ? Math.round((n / question.total) * 100) : 0)
  return (
    <div className={large ? 'results results--large' : 'results'} aria-live="polite">
      {(['yes', 'no'] as const).map((choice) => (
        <div key={choice} className={`bar bar--${choice}`}>
          <div className="bar__label">
            <span>{choice === 'yes' ? 'Yes' : 'No'}</span>
            <span className="bar__count">
              {question[choice]} <small>({pct(question[choice])}%)</small>
            </span>
          </div>
          <div className="bar__track">
            <div className="bar__fill" style={{ width: `${pct(question[choice])}%` }} />
          </div>
        </div>
      ))}
      <p className="muted">
        {question.total} {question.total === 1 ? 'response' : 'responses'}
        {question.status === 'closed' && ' · voting closed'}
      </p>
    </div>
  )
}
