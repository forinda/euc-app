export type Choice = 'yes' | 'no'
export type QuestionStatus = 'open' | 'closed'

export interface Question {
  id: string
  text: string
  status: QuestionStatus
  /** voterId → choice. Re-voting overwrites, so each device counts once. */
  votes: Map<string, Choice>
  createdAt: string
  closedAt?: string
}

export interface Session {
  code: string
  title: string | null
  presenterKey: string
  questions: Map<string, Question>
  /** The question on screen — stays set after it closes so final counts remain visible. */
  activeQuestionId: string | null
  createdAt: string
  lastActivityAt: number
}

export interface QuestionSnapshot {
  id: string
  text: string
  status: QuestionStatus
  yes: number
  no: number
  total: number
}

/** The public view of a session — what GET /:code and every SSE `snapshot` event carry. */
export interface SessionSnapshot {
  code: string
  title: string | null
  /** Audience devices connected to the live stream right now. */
  audience: number
  question: QuestionSnapshot | null
}
