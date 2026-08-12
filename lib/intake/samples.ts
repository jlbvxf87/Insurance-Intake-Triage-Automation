/**
 * Prefilled scenarios for the public demonstration.
 *
 * A visitor who wants to see the workflow run needs two things they almost
 * certainly do not have: a filled-in submission and an insurance document.
 * Without these, the page asks a stranger to invent a policy and find a
 * declarations page on their laptop, and almost nobody does — so the system
 * gets described rather than seen.
 *
 * Each scenario is described by its INPUT, not by a promised outcome. The
 * confidence gate decides what happens, and saying in advance where a
 * submission will land would be asserting a result the run has not produced
 * yet. On a page whose argument is that claims should be verifiable, promising
 * the ending would be the one unforced error.
 */

export interface SampleScenario {
  id: string
  label: string
  /** What the document is. Factual, not a prediction. */
  description: string
  /** What to watch for once it runs. */
  watchFor: string
  documentPath: string
  documentName: string
  values: {
    clientName: string
    companyName: string
    email: string
    phone: string
    submissionType: string
    lineOfBusiness: string
    description: string
  }
}

export const SAMPLE_SCENARIOS: readonly SampleScenario[] = [
  {
    id: 'clean',
    label: 'A clean declarations page',
    description:
      'A crisp, digitally generated commercial auto declarations page — the best case an intake team sees.',
    watchFor: 'Per-field confidence, and which routing rule fires.',
    documentPath: '/samples/dec-page-clean.pdf',
    documentName: 'dec-page-clean.pdf',
    values: {
      clientName: 'Dana Whitfield',
      companyName: 'ACME Trucking LLC',
      email: 'dispatch@acmetrucking.example',
      phone: '(816) 555-0142',
      submissionType: 'Quote',
      lineOfBusiness: 'Commercial Auto',
      description:
        'Adding six tractors and four trailers to the fleet ahead of the Q3 contract. Requesting a revised commercial auto quote against the attached declarations page.',
    },
  },
  {
    id: 'scanned',
    label: 'The same page, faxed and scanned',
    description:
      'The identical policy put through a simulated fax: rasterized, rotated, blurred, and speckled — the worst case, and the common one.',
    watchFor: 'Whether extraction clears the confidence threshold, or stops for a person.',
    documentPath: '/samples/dec-page-scanned.pdf',
    documentName: 'dec-page-scanned.pdf',
    values: {
      clientName: 'Priya Raman',
      companyName: 'Belmont Fabrication Co',
      email: 'ops@belmontfab.example',
      phone: '(816) 555-0197',
      submissionType: 'Quote',
      lineOfBusiness: 'Commercial Auto',
      description:
        'Renewal review for the hauling fleet. The only copy of the declarations page we have is a fax from the prior carrier, attached.',
    },
  },
] as const

/**
 * Fetch a sample document and hand back a `File`, so a prefilled scenario
 * enters the form through exactly the same path a hand-picked upload does.
 * Nothing about the submission is privileged because it came from a button.
 */
export async function loadSampleDocument(scenario: SampleScenario): Promise<File> {
  const response = await fetch(scenario.documentPath, { cache: 'force-cache' })
  if (!response.ok) {
    throw new Error(`Sample document unavailable (${response.status}).`)
  }
  const blob = await response.blob()
  return new File([blob], scenario.documentName, { type: 'application/pdf' })
}
