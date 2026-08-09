import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getConfig } from '@/lib/config'
import { ensureStoreReady, getRepository } from '@/lib/data/store'
import {
  applyReviewAction,
  ReviewActionError,
  type ReviewAction,
} from '@/lib/workflow/review'
import { InvalidTransitionError } from '@/lib/workflow/state-machine'

/**
 * Human review actions (FR-010, FR-011).
 *
 * The action payload is validated as strictly as the intake form. An operator
 * endpoint that trusts its input is the same defect as a public one that does
 * — the blast radius is just larger.
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const reviewActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('release'), note: z.string().max(500).optional() }),
  z.object({ type: z.literal('confirm-duplicate'), note: z.string().max(500).optional() }),
  z.object({ type: z.literal('dismiss-duplicate'), note: z.string().max(500).optional() }),
  z.object({ type: z.literal('close'), note: z.string().max(500).optional() }),
  z.object({
    type: z.literal('correct-extraction'),
    note: z.string().max(500).optional(),
    corrections: z.object({
      carrier: z.string().max(160).optional(),
      policyNumber: z.string().max(64).optional(),
      namedInsured: z.string().max(200).optional(),
      effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      coverageAmount: z.number().nonnegative().optional(),
    }),
  }),
])

const requestSchema = z.object({
  action: reviewActionSchema,
  /** In a real deployment this comes from the authenticated session, not the body. */
  actor: z.string().min(1).max(120).default('operations'),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: 'Expected a JSON body.' }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        message: 'The review action could not be understood.',
        issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      },
      { status: 400 },
    )
  }

  try {
    await ensureStoreReady()

    const result = await applyReviewAction({
      submissionId: id,
      action: parsed.data.action as ReviewAction,
      repository: getRepository(),
      actor: parsed.data.actor,
      notificationTransport: getConfig().notificationProvider,
    })

    return NextResponse.json({
      submissionId: result.submission.submissionId,
      status: result.submission.status,
      assignedTeam: result.submission.assignedTeam,
      needsHumanReview: result.submission.needsHumanReview,
      confirmationSent: result.confirmation !== null,
      logId: result.log.logId,
    })
  } catch (error) {
    // A rejected transition is the operator asking for something the design
    // does not allow — a 409, not a 500. The message names what is allowed.
    if (error instanceof InvalidTransitionError) {
      return NextResponse.json({ message: error.message }, { status: 409 })
    }

    // A rejected action carries its own status. Anything else is genuinely
    // unexpected and should surface as a 500 rather than being guessed at from
    // the message text.
    if (error instanceof ReviewActionError) {
      return NextResponse.json({ message: error.message }, { status: error.status })
    }

    const message = error instanceof Error ? error.message : 'Unexpected error.'
    return NextResponse.json({ message }, { status: 500 })
  }
}
