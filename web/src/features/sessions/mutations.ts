import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api'
import { myVoteStore, presenterKeyStore, getVoterId } from '../../lib/storage'
import { sessionKeys } from './keys'
import { presenterHeaders } from './queries'
import type { Choice, Snapshot } from './types'

export function useCreateSession() {
  return useMutation({
    mutationFn: (title: string) => api.post('/sessions', { body: title.trim() ? { title: title.trim() } : {} }),
    onSuccess: (session) => presenterKeyStore.set(session.code, session.presenterKey),
  })
}

// Live question changes reach every screen through useSessionLive (Ably, or
// polling when it's off), so the question mutations below need no
// invalidation of the session detail.

export function usePublishQuestion(code: string) {
  return useMutation({
    mutationFn: (text: string) =>
      api.post('/sessions/:code/questions', { params: { code }, headers: presenterHeaders(code), body: { text } }),
  })
}

export function useCloseQuestion(code: string) {
  return useMutation({
    mutationFn: (id: string) =>
      api.post('/sessions/:code/questions/:id/close', { params: { code, id }, headers: presenterHeaders(code) }),
  })
}

export function useVote(code: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ questionId, choice }: { questionId: string; choice: Choice }) =>
      api.put('/sessions/:code/questions/:id/vote', {
        params: { code, id: questionId },
        body: { voterId: getVoterId(), choice },
      }),
    onSuccess: (result, { questionId, choice }) => {
      myVoteStore.set(questionId, choice)
      // Show the new counts now instead of waiting for the next broadcast.
      qc.setQueryData<Snapshot>(sessionKeys.detail(code), (prev) =>
        prev?.question?.id === questionId
          ? { ...prev, question: { ...prev.question, yes: result.yes, no: result.no, total: result.total } }
          : prev,
      )
    },
  })
}

// Prepared questions: presenter-only and not broadcast, so each change
// invalidates the drafts list.

export function useAddDraft(code: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (text: string) =>
      api.post('/sessions/:code/drafts', { params: { code }, headers: presenterHeaders(code), body: { text } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.drafts(code) }),
  })
}

export function useDeleteDraft(code: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete('/sessions/:code/drafts/:id', { params: { code, id }, headers: presenterHeaders(code) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.drafts(code) }),
  })
}

export function usePublishDraft(code: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.post('/sessions/:code/drafts/:id/publish', { params: { code, id }, headers: presenterHeaders(code) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: sessionKeys.drafts(code) }),
  })
}
