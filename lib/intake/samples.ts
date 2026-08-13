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
 * submission will land would assert a result the run has not produced yet. On
 * a page whose argument is that claims should be verifiable, promising the
 * ending is the one unforced error available.
 */

/**
 * Submitters the seed data does not already contain.
 *
 * The first version of this file reused seeded companies, which meant every
 * sample matched an existing client with a recent request of the same type and
 * line of business — so the duplicate rule fired correctly and the clean path
 * could never be demonstrated at all. The system was right and the fixture was
 * wrong, which is the more embarrassing way round.
 *
 * One identity is chosen per page load. Two consequences, both wanted: a first
 * submission routes on its merits, and pressing the same scenario again in the
 * same session reuses the identity, so the duplicate rule fires on the second
 * submission exactly when a visitor is trying to provoke it.
 */
interface Submitter {
  clientName: string
  companyName: string
  email: string
  phone: string
}

const SUBMITTERS: readonly Submitter[] = [
  {
    clientName: 'Marcus Bell',
    companyName: 'Cascade Freight Logistics LLC',
    email: 'dispatch@cascadefreight.example',
    phone: '(816) 555-0184',
  },
  {
    clientName: 'Elena Ortiz',
    companyName: 'Harbor Point Distribution',
    email: 'ops@harborpointdist.example',
    phone: '(816) 555-0119',
  },
  {
    clientName: 'Grant Whitaker',
    companyName: 'Copperline Haulage Co',
    email: 'requests@copperlinehaul.example',
    phone: '(913) 555-0166',
  },
  {
    clientName: 'Nadia Fournier',
    companyName: 'Stonegate Transit Group',
    email: 'risk@stonegatetransit.example',
    phone: '(816) 555-0173',
  },
  {
    clientName: 'Owen Castellano',
    companyName: 'Willow Creek Carriers',
    email: 'fleet@willowcreekcarriers.example',
    phone: '(913) 555-0128',
  },
  {
    clientName: 'Simone Adeyemi',
    companyName: 'Ridgeway Freight Systems',
    email: 'insurance@ridgewayfreight.example',
    phone: '(816) 555-0155',
  },
] as const

export function pickSubmitter(): Submitter {
  return SUBMITTERS[Math.floor(Math.random() * SUBMITTERS.length)]
}

export interface SampleScenario {
  id: string
  label: string
  /** What the document is. Factual, not a prediction. */
  description: string
  /** What to watch for once it runs. */
  watchFor: string
  documentPath: string
  documentName: string
  /** A crop of the top of the page, so the card shows the document rather than describing it. */
  previewPath: string
  submissionType: string
  lineOfBusiness: string
  description_text: string
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
    previewPath: '/samples/preview-clean.webp',
    submissionType: 'Quote',
    lineOfBusiness: 'Commercial Auto',
    description_text:
      'Adding six tractors and four trailers to the fleet ahead of the Q3 contract. Requesting a revised commercial auto quote against the attached declarations page.',
  },
  {
    id: 'scanned',
    label: 'The same page, faxed and scanned',
    description:
      'The identical policy put through a simulated fax: rasterized, rotated, blurred, and speckled — the worst case, and the common one.',
    watchFor: 'Whether extraction clears the confidence threshold, or stops for a person.',
    documentPath: '/samples/dec-page-scanned.pdf',
    documentName: 'dec-page-scanned.pdf',
    previewPath: '/samples/preview-scanned.webp',
    submissionType: 'Quote',
    lineOfBusiness: 'Commercial Auto',
    description_text:
      'Renewal review for the hauling fleet. The only copy of the declarations page we have is a fax from the prior carrier, attached.',
  },
  {
    id: 'incomplete',
    label: 'A new-business application',
    description:
      'A clean application for coverage that has not been placed yet, so it carries no policy number and no carrier — which is what new business actually looks like.',
    watchFor: 'The system reads it perfectly and still refuses to route it.',
    documentPath: '/samples/dec-page-incomplete.pdf',
    documentName: 'dec-page-incomplete.pdf',
    previewPath: '/samples/preview-incomplete.webp',
    submissionType: 'Quote',
    lineOfBusiness: 'Commercial Auto',
    description_text:
      'New business submission for the fleet. Coverage has not been placed yet, so the application is attached rather than a declarations page.',
  },
] as const

/** The form values for a scenario, bound to the submitter chosen this session. */
export function scenarioValues(scenario: SampleScenario, submitter: Submitter) {
  return {
    clientName: submitter.clientName,
    companyName: submitter.companyName,
    email: submitter.email,
    phone: submitter.phone,
    submissionType: scenario.submissionType,
    lineOfBusiness: scenario.lineOfBusiness,
    description: scenario.description_text,
  }
}

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
