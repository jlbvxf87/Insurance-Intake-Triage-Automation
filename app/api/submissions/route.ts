import { NextResponse } from 'next/server'
import { getConfig } from '@/lib/config'
import {
  defaultAcceptedMimeTypes,
  intakeFormSchema,
  toFieldErrors,
  validateUpload,
} from '@/lib/domain/schemas'
import { ensureStoreReady, getRepository } from '@/lib/data/store'
import { runIntakeWorkflow } from '@/lib/workflow/orchestrator'

/**
 * Intake endpoint (FR-001, FR-002, FR-013, FR-014).
 *
 * Runs on the Node runtime because the extraction adapter reads server-side
 * credentials and posts document bytes to Azure. Nothing in this path is
 * reachable from the browser other than through this route (NFR-003).
 *
 * Order matters: the request is validated *before* any record is created, so a
 * rejected upload leaves no partial state behind (AC-007).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const config = getConfig()

  // 1 — Parse the multipart body ------------------------------------------
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json(
      { message: 'The request body could not be read. Expected a multipart form.' },
      { status: 400 },
    )
  }

  // 2 — Validate the fields with the same schema the browser used ----------
  const parsed = intakeFormSchema.safeParse({
    clientName: form.get('clientName'),
    companyName: form.get('companyName'),
    email: form.get('email'),
    phone: form.get('phone'),
    submissionType: form.get('submissionType'),
    lineOfBusiness: form.get('lineOfBusiness'),
    description: form.get('description'),
  })

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: 'Some fields need attention before this request can be accepted.',
        fieldErrors: toFieldErrors(parsed.error),
      },
      { status: 400 },
    )
  }

  // 3 — Validate the upload, if there is one -------------------------------
  const uploaded = form.get('document')
  let document: { file: File; bytes: ArrayBuffer } | null = null

  if (uploaded instanceof File && uploaded.size > 0) {
    const check = validateUpload(
      { name: uploaded.name, type: uploaded.type, size: uploaded.size },
      {
        maxBytes: config.maxUploadBytes,
        acceptedMimeTypes: defaultAcceptedMimeTypes,
      },
    )

    if (!check.ok) {
      return NextResponse.json(
        {
          message: check.message,
          fieldErrors: { document: check.message },
        },
        { status: 400 },
      )
    }

    document = { file: uploaded, bytes: await uploaded.arrayBuffer() }
  }

  // 4 — Hand off to the workflow ------------------------------------------
  // With a shared store, make sure this instance's id counters are past
  // whatever is already persisted before any record is created.
  await ensureStoreReady()

  const result = await runIntakeWorkflow({
    input: parsed.data,
    document: document
      ? {
          fileName: document.file.name,
          mimeType: document.file.type,
          sizeBytes: document.file.size,
          bytes: document.bytes,
        }
      : null,
    repository: getRepository(),
    config,
  })

  // A workflow that ends in Exception is still a *handled* outcome: the
  // submission was accepted and persisted, and an operator will pick it up.
  // Returning 500 here would tell the submitter their request was lost.
  return NextResponse.json(result.response, { status: 201 })
}
