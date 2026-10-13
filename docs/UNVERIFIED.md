# Unverified Items Log

| PR Number | Timestamp | Item | Reason | Assignee | Verification Plan |
|---|---|---|---|---|---|
| #3 | 2026-10-14 02:12 | Frontend lint and production build (`npm run lint`, `npm run build`) | PR #3 contains zero frontend code changes. Legacy `frontend/` directory has unpopulated dependencies; Vite PWA migration is scoped to PR #5. | `@soumyadeep` | Verify in PR #5 where Vite PWA frontend shell and test scripts are integrated. |
| #3 | 2026-10-14 02:12 | Live PM-JAY National Health Authority gateway connectivity | Production NHA API requires hospital IP whitelisting and production TLS certificates not available in local test environment. Mock adapter used. | `@soham` | Execute end-to-end sandbox connectivity testing during hospital deployment on isolated hospital VLAN. |
| #3 | 2026-10-14 02:12 | Live WhatsApp Business API message delivery | Requires active Meta WhatsApp Business Account credentials and registered hospital phone number. Mock adapter used. | `@soham` | Validate outbound delivery receipt against Meta Graph API sandbox in staging environment. |
