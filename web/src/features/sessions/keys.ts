// Query keys mirror the API paths: /sessions/:code → ['sessions', code].
export const sessionKeys = {
  all: ['sessions'] as const,
  detail: (code: string) => [...sessionKeys.all, code] as const,
  drafts: (code: string) => [...sessionKeys.detail(code), 'drafts'] as const,
}
