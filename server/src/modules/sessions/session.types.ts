export type Choice = 'yes' | 'no'
export type QuestionStatus = 'open' | 'closed'

/** What the store keeps about a session itself. Questions, votes and drafts are separate. */
export interface StoredSession {
  code: string
  title: string | null
  presenterKey: string
  createdAt: string
}

/** A question the presenter prepared but hasn't published. Never sent to the audience. */
export interface Draft {
  id: string
  text: string
  createdAt: string
}

export interface QuestionSnapshot {
  id: string
  text: string
  status: QuestionStatus
  yes: number
  no: number
  total: number
}

/** The public view of a session: what GET /:code returns and every live update carries. */
export interface SessionSnapshot {
  code: string
  title: string | null
  /**
   * Increases with every change to the public state. Updates can arrive out of
   * order (concurrent serverless invocations), so clients keep the highest.
   */
  version: number
  /** The question on screen. Stays set after it closes so final counts remain visible. */
  question: QuestionSnapshot | null
}

/** Result of a change to the public state: the affected question and the snapshot after it. */
export interface Change {
  question: QuestionSnapshot
  snapshot: SessionSnapshot
}
