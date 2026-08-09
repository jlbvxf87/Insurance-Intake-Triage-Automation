import { NextResponse } from 'next/server'
import { getConfig, toPublicConfig } from '@/lib/config'

/**
 * Non-secret runtime configuration for the client (FR-026).
 *
 * The browser needs to know the upload limit and whether the app is running in
 * fixture mode. It learns that from this endpoint rather than from a
 * `NEXT_PUBLIC_` variable, so the client never reads configuration that could
 * one day carry a credential (NFR-001).
 */
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(toPublicConfig(getConfig()))
}
