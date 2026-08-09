import type { SVGProps } from 'react'

/**
 * Brand marks as inline SVG.
 *
 * Lucide removed brand icons in v1 (they are trademarks, not interface icons),
 * so these are hand-included rather than imported. Two paths is a smaller cost
 * than a second icon dependency.
 */

export function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12 .5C5.73.5.75 5.48.75 11.75c0 4.95 3.21 9.15 7.66 10.63.56.1.77-.24.77-.54 0-.27-.01-1.16-.02-2.1-3.12.68-3.78-1.32-3.78-1.32-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.49-.28-5.11-1.25-5.11-5.55 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.08 1.15a10.7 10.7 0 0 1 2.8-.38c.95 0 1.91.13 2.8.38 2.14-1.45 3.08-1.15 3.08-1.15.61 1.54.23 2.68.11 2.96.72.79 1.16 1.79 1.16 3.02 0 4.31-2.63 5.26-5.13 5.54.4.35.76 1.03.76 2.08 0 1.5-.01 2.71-.01 3.08 0 .3.2.65.78.54a11.26 11.26 0 0 0 7.65-10.63C23.25 5.48 18.27.5 12 .5Z" />
    </svg>
  )
}

export function LinkedinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.42v1.56h.05a3.75 3.75 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14Zm1.78 13.02H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z" />
    </svg>
  )
}
