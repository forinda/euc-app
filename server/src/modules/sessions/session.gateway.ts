import { Autowired, Logger } from '@forinda/kickjs'
import { OnConnect, OnDisconnect, WsController } from '@forinda/kickjs-ws'
import type { SocketIoContext } from '@forinda/kickjs-ws/socket.io'
import { z } from 'zod'
import { SessionService } from './session.service'
import { SESSIONS_NAMESPACE } from './session.events'

const log = Logger.for('SessionGateway')

// Sent by the client as `io('/sessions', { query: { code, role } })`.
const handshakeSchema = z.object({
  code: z.string().trim().min(1).max(12),
  role: z.enum(['audience', 'presenter']).default('audience'),
})

/**
 * Live session updates. A socket joins the room for its session code and
 * gets a `snapshot` immediately, then one after every change (coalesced).
 * Server → client events: `snapshot`, `not-found`. Votes and presenter
 * actions stay on the typed HTTP routes.
 */
@WsController(SESSIONS_NAMESPACE)
export class SessionGateway {
  @Autowired() private readonly sessions!: SessionService

  @OnConnect()
  async connect(ctx: SocketIoContext) {
    const parsed = handshakeSchema.safeParse(ctx.socket.handshake.query)
    const code = parsed.success ? parsed.data.code.toUpperCase() : ''
    let snapshot
    try {
      // Joins presence first, so this socket is already in the snapshot's audience count.
      snapshot = this.sessions.connect(code, ctx.id, parsed.success ? parsed.data.role : 'audience')
    } catch {
      ctx.send('not-found', { code })
      ctx.socket.disconnect(true)
      return
    }
    ctx.set('code', snapshot.code)
    await ctx.join(snapshot.code)
    ctx.send('snapshot', snapshot)
    log.debug(`socket ${ctx.id} joined ${snapshot.code}`)
  }

  @OnDisconnect()
  disconnect(ctx: SocketIoContext) {
    const code = ctx.get<string>('code')
    if (code) this.sessions.disconnect(code, ctx.id)
  }
}
