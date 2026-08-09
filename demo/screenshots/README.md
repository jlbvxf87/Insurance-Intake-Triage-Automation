# Screenshots

Captured from the running application with Playwright at 2× device pixel
ratio. Regenerate after any UI change — a stale screenshot is worse than none,
because it is trusted.

| File | Shows | Viewport |
|---|---|---|
| `01-intake-form.png` | Public intake form, demo-mode banner, upload control | 1440 |
| `02-intake-validation.png` | Field-level validation errors after an empty submit | 1440 |
| `03-ops-dashboard.png` | Queue, KPI counters, view tabs, automation health, distribution | 1440 |
| `04-ops-needs-review.png` | Needs-review queue with review reasons per row | 1440 |
| `05-ops-exceptions.png` | Exceptions queue | 1440 |
| `06-submission-low-confidence.png` | Extraction with per-field confidence and a missing required field | 1440 |
| `07-submission-exception.png` | Full run trace with the failing step and error message | 1440 |
| `08-submission-duplicate.png` | Duplicate flag with the stated reason and a link to the original | 1440 |
| `09-intake-mobile.png` | Intake form on a phone viewport | 390 |
| `10-ops-mobile.png` | Queue as a card list below the `md` breakpoint | 390 |

## Regenerating

Start the production server, then run a Playwright script against it:

```bash
npm run build
npm start &
node scripts/capture-screenshots.mjs
```

Screenshots are captured against seeded synthetic data. Because the seed is
generated relative to the current time, the "received" column and the ageing
figures differ between captures — that is expected, not drift.
