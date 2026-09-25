import { Controller, Get, Post, Put, Delete, Autowired, reply, type Ctx } from '@forinda/kickjs'
import { SessionService } from './session.service'
import { createSessionSchema } from './dtos/create-session.dto'
import { createQuestionSchema } from './dtos/create-question.dto'
import { voteSchema } from './dtos/vote.dto'
import { streamQuerySchema } from './dtos/stream-query.dto'
import { PresenterSession } from './contributors/presenter-session.contributor'
import type { SessionSnapshot } from './session.types'

// SSE keep-alive: idle proxies drop silent connections after ~30–60 s.
const PING_INTERVAL_MS = 20_000

@Controller()
export class SessionController {
  @Autowired() private readonly sessions!: SessionService

  @Post('/', { body: createSessionSchema, name: 'CreateSession' })
  create(ctx: Ctx<KickRoutes.SessionController['create']>) {
    return reply.created(this.sessions.create(ctx.body))
  }

  @Get('/:code')
  get(ctx: Ctx<KickRoutes.SessionController['get']>) {
    return this.sessions.getSnapshot(ctx.params.code)
  }

  @Get('/:code/stream', { query: streamQuerySchema })
  stream(ctx: Ctx<KickRoutes.SessionController['stream']>) {
    // Resolve first so an unknown code is a 404, not an empty stream.
    this.sessions.getSnapshot(ctx.params.code)
    const sse = ctx.sse<SessionSnapshot>()
    // Subscribe before the first send so this device is already in the
    // snapshot's audience count. The presenter screen connects with
    // ?role=presenter and isn't counted.
    const unsubscribe = this.sessions.subscribe(
      ctx.params.code,
      (s) => sse.send(s, 'snapshot'),
      ctx.query.role ?? 'audience',
    )
    sse.send(this.sessions.getSnapshot(ctx.params.code), 'snapshot')
    const ping = setInterval(() => sse.comment('ping'), PING_INTERVAL_MS)
    sse.onClose(() => {
      clearInterval(ping)
      unsubscribe()
    })
    return sse
  }

  @PresenterSession
  @Post('/:code/questions', { body: createQuestionSchema, name: 'PublishQuestion' })
  publishQuestion(ctx: Ctx<KickRoutes.SessionController['publishQuestion']>) {
    return reply.created(this.sessions.publishQuestion(ctx.require('presenterSession'), ctx.body))
  }

  @PresenterSession
  @Post('/:code/questions/:id/close')
  closeQuestion(ctx: Ctx<KickRoutes.SessionController['closeQuestion']>) {
    return this.sessions.closeQuestion(ctx.require('presenterSession'), ctx.params.id)
  }

  // Prepared questions — presenter-only, never part of the public snapshot.

  @PresenterSession
  @Get('/:code/drafts')
  listDrafts(ctx: Ctx<KickRoutes.SessionController['listDrafts']>) {
    return this.sessions.listDrafts(ctx.require('presenterSession'))
  }

  @PresenterSession
  @Post('/:code/drafts', { body: createQuestionSchema, name: 'AddDraft' })
  addDraft(ctx: Ctx<KickRoutes.SessionController['addDraft']>) {
    return reply.created(this.sessions.addDraft(ctx.require('presenterSession'), ctx.body))
  }

  @PresenterSession
  @Delete('/:code/drafts/:id')
  deleteDraft(ctx: Ctx<KickRoutes.SessionController['deleteDraft']>) {
    this.sessions.deleteDraft(ctx.require('presenterSession'), ctx.params.id)
    return reply.noContent()
  }

  @PresenterSession
  @Post('/:code/drafts/:id/publish')
  publishDraft(ctx: Ctx<KickRoutes.SessionController['publishDraft']>) {
    return reply.created(this.sessions.publishDraft(ctx.require('presenterSession'), ctx.params.id))
  }

  @Put('/:code/questions/:id/vote', { body: voteSchema, name: 'Vote' })
  vote(ctx: Ctx<KickRoutes.SessionController['vote']>) {
    return this.sessions.vote(ctx.params.code, ctx.params.id, ctx.body)
  }
}
