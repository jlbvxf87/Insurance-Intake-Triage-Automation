import type { Metadata } from 'next'
import { SiteHeader } from '@/components/case-study/site-header'
import { Hero } from '@/components/case-study/hero'
import { Vsl } from '@/components/case-study/vsl'
import { Pillars } from '@/components/case-study/pillars'
import { InteractiveWorkflow } from '@/components/case-study/interactive-workflow'
import { HowItWorks } from '@/components/case-study/how-it-works'
import { StateComparison } from '@/components/case-study/state-comparison'
import { Architecture } from '@/components/case-study/architecture'
import { DataModel } from '@/components/case-study/data-model'
import { Extraction } from '@/components/case-study/extraction'
import { Rules } from '@/components/case-study/rules'
import { PowerAutomate } from '@/components/case-study/power-automate'
import { ErrorHandling } from '@/components/case-study/error-handling'
import { OpsShowcase } from '@/components/case-study/ops-showcase'
import { Requirements } from '@/components/case-study/requirements'
import { Testing } from '@/components/case-study/testing'
import { WhatIBuilt } from '@/components/case-study/what-i-built'
import { Closing, SiteFooter } from '@/components/case-study/closing'
import { SITE } from '@/lib/case-study/content'

export const metadata: Metadata = {
  title: `${SITE.title} · ${SITE.author}`,
  description: SITE.tagline,
  openGraph: {
    title: SITE.title,
    description: SITE.tagline,
    type: 'website',
  },
}

/**
 * Case-study landing page (Phases 9, 9A, 10).
 *
 * Section order follows the brief. The sequencing has a logic worth stating:
 * the problem and the live workflow come before any architecture, because a
 * reader who has not understood what the system does will not care how it is
 * built. The dark sections are the technical ones — workflow, Power Automate,
 * testing — so the page has a rhythm rather than eighteen identical panels.
 */
export default function CaseStudyPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Pillars />
        <Vsl />
        <InteractiveWorkflow />
        <HowItWorks />
        <StateComparison />
        <Architecture />
        <DataModel />
        <Extraction />
        <Rules />
        <PowerAutomate />
        <ErrorHandling />
        <OpsShowcase />
        <Requirements />
        <Testing />
        <WhatIBuilt />
        <Closing />
      </main>
      <SiteFooter />
    </>
  )
}
