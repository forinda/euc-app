import { Controller, Get, Post, Put, Delete, Autowired, reply, type Ctx } from '@forinda/kickjs'
import { SessionService } from './session.service'
import { createSessionSchema } from './dtos/create-session.dto'
import { createQuestionSchema } from './dtos/create-question.dto'
import { voteSchema } from './dtos/vote.dto'
import { PresenterSession } from './contributors/presenter-session.contributor'

@Controller()
export class SessionController {
  @Autowired() private readonly sessions!: SessionService

  @Post('/', { body: createSessionSchema, name: 'CreateSession' })
  async create(ctx: Ctx<KickRoutes.SessionController['create']>) {
    return reply.created(await this.sessions.create(ctx.body))
  }

  @Get('/:code')
  async get(ctx: Ctx<KickRoutes.SessionController['get']>) {
    return this.sessions.getSnapshot(ctx.params.code)
  }

  @PresenterSession
  @Post('/:code/questions', { body: createQuestionSchema, name: 'PublishQuestion' })
  async publishQuestion(ctx: Ctx<KickRoutes.SessionController['publishQuestion']>) {
    return reply.created(
      await this.sessions.publishQuestion(ctx.require('presenterSession'), ctx.body),
    )
  }

  @PresenterSession
  @Post('/:code/questions/:id/close')
  async closeQuestion(ctx: Ctx<KickRoutes.SessionController['closeQuestion']>) {
    return this.sessions.closeQuestion(ctx.require('presenterSession'), ctx.params.id)
  }

  // Prepared questions — presenter-only, never part of the public snapshot.

  @PresenterSession
  @Get('/:code/drafts')
  async listDrafts(ctx: Ctx<KickRoutes.SessionController['listDrafts']>) {
    return this.sessions.listDrafts(ctx.require('presenterSession'))
  }

  @PresenterSession
  @Post('/:code/drafts', { body: createQuestionSchema, name: 'AddDraft' })
  async addDraft(ctx: Ctx<KickRoutes.SessionController['addDraft']>) {
    return reply.created(await this.sessions.addDraft(ctx.require('presenterSession'), ctx.body))
  }

  @PresenterSession
  @Delete('/:code/drafts/:id')
  async deleteDraft(ctx: Ctx<KickRoutes.SessionController['deleteDraft']>) {
    await this.sessions.deleteDraft(ctx.require('presenterSession'), ctx.params.id)
    return reply.noContent()
  }

  @PresenterSession
  @Post('/:code/drafts/:id/publish')
  async publishDraft(ctx: Ctx<KickRoutes.SessionController['publishDraft']>) {
    return reply.created(
      await this.sessions.publishDraft(ctx.require('presenterSession'), ctx.params.id),
    )
  }

  @Put('/:code/questions/:id/vote', { body: voteSchema, name: 'Vote' })
  async vote(ctx: Ctx<KickRoutes.SessionController['vote']>) {
    return this.sessions.vote(ctx.params.code, ctx.params.id, ctx.body)
  }
}
