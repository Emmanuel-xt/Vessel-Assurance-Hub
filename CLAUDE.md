# Vessel Assurance Hub: Project Brief & Working Notes

> Read this file at the start of every session. It is the source of truth for scope, rules and progress.
> Update the **Key decisions**, **Replace for production** and **Progress** sections as work happens.
>
> **Source priority:** where the owner's original brief and the design document
> `VAH_Version2_Detailed_Functional_Design (1).docx` disagree, **the document wins** (owner decision, 2026-11-05).
> This file already reflects that merge; §18 summarises the document.

---

## 1. Purpose

A standalone, open-web **LOD1 (Line of Defence 1) assurance app** for offshore vessel operations in Nigeria
(locations such as Bonga, EA, Forcados, Bonny). Delivered as a web app / installable PWA, reachable by
browser, mobile and QR code.

- **Owner:** Vessel SIMOPS Manager.
- **Goal:** make assurance open to everyone. Anyone working on or visiting a vessel can log checks, and
  management sees fleet-wide trends.
- **Business goals (doc):** improve workforce engagement; one assurance database; trending by **vessel, package,
  contractor and location**; promote **IOGP Start Work and Life Saving Rules**.

## 2. Version 1 = showcase prototype

- A fully clickable prototype for the project owner to approve.
- Must **look and behave like the finished product**.
- **No real database, no real authentication, no cloud storage.** All data comes from a mocked data layer.
- After approval the mock is replaced by a real backend, so **the swap must be easy** (see §12 and §14).

## 3. Users & roles

| Role | Typical positions | Can do |
|---|---|---|
| **WORKER** | Crew Member, Bridge Officer, Galley Team, Chief Engineer, Master | Self Assessments, Start Work Checks; own submission history; findings/actions assigned to them |
| **SUPERVISOR** | Team Lead, Marine Representative, Offshore Coordinator, Manager/MFE Visitor | Everything a Worker can do, plus supervisory audit types (MFE, Spot Check, Verification); read-only fleet-wide dashboard |
| **ADMIN** | Assurance owner / delegates | Approve users, change roles, disable accounts; manage vessels, packages, locations, modules, question bank, audit types, vessel types, risk categories; full dashboard; reset demo data |

- Everyone sees the **same hub** and can open **any module**.
- **Role only controls which audit types a user can pick** (plus the admin-only areas above).
- Position and role are independent: the position list comes from the doc's personas (plus "Other"),
  the role is requested at signup and confirmed by an admin.

## 4. Signup & account lifecycle

- One simple, general public signup link: `/signup`.
- Registration fields: name, email, password, company, position, requested role.
- New accounts are **PENDING** until an admin approves them.
- Admin can approve, change role, and disable accounts.
- Account statuses: `PENDING` → `ACTIVE` ↔ `DISABLED`.

## 5. Core flow

1. Log in → **Hub home** (same for everyone).
2. Choose one of:
   - a single **module**,
   - **Full Vessel Assurance** (all modules in the *Assurance* category), or
   - **Start Work Check** (pick one of the *Start Work* category modules).
3. Select **vessel** (dropdown; or pre-selected via the vessel's QR code), **location** (pre-filled from the vessel,
   editable) and **audit type** (filtered by role).
4. Answer the questions. Each answer has:
   - Response: `Yes` / `Concern Identified` / `No` / `N/A`
   - Optional comment
   - Photos (optional, or required, see §7 evidence rule)
   - Optional tag: `Good Practice` (creates a Positive Intervention) or `Improvement Opportunity`
5. Findings:
   - `No` on a **critical control** question **automatically creates a finding** (risk High). The user must
     complete the description and assign at least one **action with an owner** before submitting.
   - `No` on a non-critical question **prompts** the user to raise a finding (can be skipped).
   - `Concern Identified` offers an optional "Raise finding" button.
6. At any point the user can **save as draft** and resume later.
7. **Submit.** The system auto-captures date, time, user, company, position, vessel, package, location, module(s),
   audit type, and calculates the score(s).

## 6. Modules

17 seeded modules from the design document (admin can add, edit, reorder, deactivate). Each module has a
**category**: `Start Work` or `Assurance`.

| # | Module | Category |
|---|---|---|
| 1 | Marine Start Work | Start Work |
| 2 | Bridge Team | Assurance |
| 3 | Navigation Watch | Assurance |
| 4 | Personnel Transfer | Assurance |
| 5 | Cargo Operations | Assurance |
| 6 | Bunkering | Assurance |
| 7 | Security | Assurance |
| 8 | Occupational Health | Assurance |
| 9 | Galley | Assurance |
| 10 | Working at Height | Start Work |
| 11 | Confined Space Entry | Start Work |
| 12 | Hot Work | Start Work |
| 13 | Energy Isolation | Start Work |
| 14 | Emergency Preparedness | Assurance |
| 15 | Leadership Engagement | Assurance |
| 16 | Contractor Management | Assurance |
| 17 | Learning & Action Closure | Assurance |

The category split is an assumption (§15): task-based, Life-Saving-Rule style modules are *Start Work*.

## 7. Question bank

Questions are **data, not code**, written in the doc's first-person style ("I have…", "I know…",
"I am satisfied…"). Each question has:

| Field | Notes |
|---|---|
| module | FK to module |
| text | Question wording |
| risk category | FK to admin-editable list |
| weight | Number, default `1` |
| **critical control** | yes / no. `No` on a critical control auto-creates a finding |
| evidence required | yes / no. When yes, a photo is required **only if the response is `No` or `Concern Identified`** |
| applicable vessel types | Empty = all vessel types |
| applicable audit types | Empty = all audit types |
| display order | Sort order within the module |
| active | Questions are **never hard-deleted**, only deactivated, so past assessments stay intact |

- Assessments keep a **snapshot** of question text, weight and critical flag at the time of answering, so editing
  or deactivating a question never changes historical scores.
- Seed content: the doc's 5 core questions (§18) go into every module, plus Claude-drafted, module-specific
  questions in the same style for the owner to review. Drafted questions are marked as drafts in the fixtures.

## 8. Scoring

- Points: `Yes = 1`, `Concern Identified = 0.5`, `No = 0`, `N/A` = excluded.
- Weighted by question weight.
- `Score = Σ(points × weight) / Σ(weight of non-N/A answers) × 100`, rounded to a whole percent.
- Every assessment has a **score per module** and an **overall score** (all answers pooled with the same formula).
- All answers N/A → **no score** (shown as "n/a").
- Start Work modules are scored exactly like the others.
- Lives in `src/lib/services/scoring.ts` and is unit-tested with Vitest.

## 9. Findings, actions & positive interventions

**Finding** (`VAH-F-YYYY-NNNN`)
- Links to an assessment and usually a response.
- Fields: description, risk (Low / Medium / High), critical (from the question), raised by, raised at,
  status (`Open` / `In Progress` / `Closed`), closure comment, closed by, closed at.
- Any role can raise, update and close a finding.
- A finding can only be **closed once all its actions are closed**.
- Critical findings must have **at least one action with an owner**.

**Action** (`VAH-F-YYYY-NNNN-A1`, `-A2`, …)
- Belongs to one finding; a finding can have many actions.
- Fields: description, owner (a registered, active user), target date, status (`Open` / `In Progress` / `Closed`),
  closure comment, closure evidence photo, closed by, closed at.
- Any role can update and close an action; **who closed it and when is always recorded**.
- **Overdue** = action not `Closed` **and** today is past its target date (derived on read, never stored).
  A finding is overdue if any of its actions is overdue.

**Notifications (in-app only in v1)**
- A **High-risk** finding notifies all admins and each action owner.
- Assigning an action notifies its owner.

**Positive Intervention** (`VAH-P-YYYY-NNNN`)
- Created when a response is tagged `Good Practice`.
- Fields: assessment, response, vessel, module, description (from comment), recorded by, date.

## 10. Dashboard

- **Admin:** full dashboard. **Supervisor:** read-only, fleet-wide.
- Headline: **fleet score**, open findings, overdue actions, critical findings, positive interventions.
- Breakdowns: score by **vessel**, **package**, location, module, audit type; **contractor ranking**
  (contractor = the submitting user's company).
- Trend over time: week / month / quarter / year (default **monthly**).
- Top recurring `No` questions.
- Filters: vessel, package, location, module, audit type, contractor, date range.
- Principle: **trends first, drill down to individual assessments second.**

## 11. Tech stack (v1)

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- Zod for validation
- Recharts for charts (`recharts@3.10.1`, exact; colour bars with `shape` + `Rectangle`, not the deprecated `Cell`)
- SheetJS for Excel export (`xlsx-0.20.3` installed from the official `cdn.sheetjs.com` tarball, not the outdated npm
  `xlsx` package; loaded with `import("xlsx")` only when exporting)
- Vitest for tests
- PWA: web app manifest + icons so it is installable; vessel QR codes (generated in the browser)
- **Mobile-first UI.** Most users are on phones offshore (small screens, gloves, glare, patchy connectivity).
- **Visual identity:** simple and neutral. A generic app mark (check in a shield, teal tile) + "Vessel Assurance Hub"
  wordmark (since the polish pass, 2026-11-06); no client name, client logo or branding.

## 12. Architecture & mocked data layer

```
src/
  app/                      # Next.js routes (UI only, no business rules)
  components/               # UI components (shadcn/ui in components/ui)
  lib/
    types.ts                # TypeScript types for EVERY entity
    services/               # Business rules: scoring, permissions, reference numbers, overdue, critical-control logic...
    data/
      index.ts              # THE switch: picks mock vs real implementation (one line to change)
      <repository interfaces>   # e.g. users.list(), assessments.create(), all async / Promise-returning
      mock/                 # MOCK implementation (in-memory store + localStorage + IndexedDB)
      fixtures/             # MOCK seed data
```

Entities: User, Vessel, Package, VesselType, Location, Module, Question, RiskCategory, AuditType, Assessment
(with module sections), Response, Finding, Action, PhotoEvidence, PositiveIntervention, Notification, Session.

Rules:

- **Pages and components only ever call repositories**, never the store directly.
- Every repository function is `async` and returns a `Promise`, exactly like a real API.
- **Business rules live in `src/lib/services/`**, never inside components, so they move to a real backend unchanged.
- Mock store: in-memory, seeded from fixtures, persisted to `localStorage`, with **200–400 ms simulated delay**.
- Mock auth: signup and login work against the mock store; session kept in `localStorage`.
  Demo quick-login buttons and a **"Demo as"** role switcher (Worker / Supervisor / Admin).
- Photos: compressed in the browser, stored in **IndexedDB** via a repository. Nothing is uploaded.
- **"Reset demo data"** button in the admin area restores the fixtures.
- Rich, realistic demo data: the 41-vessel register, users, **~6 months** of assessments, findings, actions and
  positive interventions, so the dashboard tells a story from the first click.
- **Every mock is marked with a `// MOCK` comment** and listed in §14.

## 13. Working rules for Claude

- Build in **small steps**. The user gives one stage at a time. Do not run ahead.
- For larger steps, **show a short plan first and wait for the go-ahead**.
- Keep business rules in `src/lib/services/`.
- After each step, tell the user **exactly how to test it**.
- Keep this file updated: key decisions, Replace for production list, Progress checklist.

## 14. Replace for production

Everything marked `// MOCK` in code. Keep this list in sync.

- [ ] `src/lib/data/index.ts`: switch from mock to real repository implementation
- [ ] `src/lib/data/mock/*`: in-memory + `localStorage` store → real database / API
- [ ] Simulated network delay → remove
- [ ] Mock auth (`src/lib/data/mock/auth.ts`): plain-text password check, session = user id in `localStorage`
      (`vah-demo-v2-session`) → real auth provider, hashed passwords, httpOnly server-side sessions
- [ ] Client-side route guards (`src/components/auth/guards.tsx`) → keep for UX, but enforce auth/roles on the server
      (middleware + API checks with `src/lib/services/permissions.ts`)
- [ ] `demo.logInAs` / `demoLogInAs` (passwordless sign-in) → remove
- [ ] Demo quick-login buttons (`src/components/auth/demo-accounts.tsx`), "Demo as" switcher in the user menu and
      `DEMO_ACCOUNTS` in `src/lib/config.ts` → remove
- [ ] Open `/signup` with self-chosen role → keep approval step; consider email verification
- [ ] "Reset demo data" button → remove
- [ ] `src/lib/data/fixtures/*` → remove, or turn into a one-off production seed (modules, question bank, vessels)
- [ ] Photo storage in IndexedDB (`src/lib/data/mock/photo-store.ts`, object URLs from `getUrl`) → cloud object storage
      (upload to a bucket, `getUrl` returns a signed URL); keep the `photos` repository interface
- [ ] Photos taken but never attached (user left without answering) stay in IndexedDB → server-side cleanup of
      unattached uploads
- [ ] `deleteAnswerPhoto` scans every response to check a photo is unused → server-side ownership/reference check
- [ ] In-app mock notifications (`notify` in `src/lib/services/findings.ts`) → real notifications (email / push),
      keeping the in-app record
- [ ] Client-side permission checks → also enforce on the server (admin services in `src/lib/services/admin/` and
      `questions.ts` run in the browser today; move them behind API routes and re-validate CSV imports server-side)
- [ ] Client-side reference number generation → server-side sequence (avoids duplicates under concurrency)
- [ ] Open signup link → invite / tokenised signup link
- [ ] Drafts in `localStorage` → server-side drafts (and real offline sync if required)
- [ ] `User.password` (plain text in the mock) → never stored client-side; hashed by the auth provider
- [ ] `src/components/admin/demo-data-panel.tsx` (demo counts + reset) and `src/lib/services/admin/demo.ts`
      (`loadDemoSummary`, `resetDemoDataAs`, admin-only) → remove
- [ ] `DEMO_MODE` / `NEXT_PUBLIC_DEMO_MODE` (`src/lib/config.ts`, `.env.example`) → remove, or leave unset in production
- [ ] **Services receive `actor` from the page** (the signed-in user held in the browser; see the header of
      `src/lib/services/permissions.ts`) → on the server, take the actor from the session, never from the request body,
      and re-read role/status on every call (today a role change only takes effect after the user reloads)
- [ ] Mock-side scoring in `assessments.submit()` → server computes scores with `src/lib/services/scoring.ts`
- [ ] Generated demo history (`src/lib/data/fixtures/history.ts`, ~300 assessments, `demo-content.ts`) and the extra
      demo users → remove
- [ ] Placeholder demo photos (`src/lib/data/fixtures/demo-photos.ts`; `demo-photo-…` ids drawn on request by
      `photo-store.ts`) → remove together with the history
- [ ] `loadDashboardData` downloads every submitted assessment, response, finding and action to the browser →
      server-side aggregation: each pure function in `src/lib/services/dashboard.ts` becomes a query (WHERE/GROUP BY)
- [ ] All-assessments "answered No to question" filter scans every response in the browser → database query
- [ ] Excel export built in the browser from loaded data → server-side export for large date ranges
- [ ] `findingDrafts` table in the mock store → server-side draft findings
- [ ] Submit + raising findings (`submitAssessment` → `raiseDraftFindings`) run as separate calls → one server
      transaction (today a failure part-way could leave a submitted assessment with only some findings)
- [ ] Notification links point to `/findings/<id>`, which is not built yet (findings stage)

## 15. Key decisions

_Confirmed decisions, with date. Assumptions are Claude's defaults where the answer was not explicit; the owner can overrule._

### Confirmed 2026-11-05

- **The design document takes priority** over the original brief where they conflict.
- Adopted from the document: 17 modules; responses `Yes / Concern Identified / No`; critical control flag and
  auto-finding logic; separate **Findings** and **Actions**; **Positive Interventions** as records;
  **package** dimension and **contractor ranking**; vessel register as seed fleet; PWA + QR access; personas as positions.
- **Overall score and a score per module** on every assessment.
- **Start Work modules are scored like any other module.**
- **Audit types are an admin-editable list.** Each audit type records which roles may pick it.
- **Any role** can raise, update and close findings/actions; **who closed what, and when, is always recorded**.
- **Reference numbers:** `VAH-A-YYYY-NNNN` (assessments), `VAH-F-YYYY-NNNN` (findings),
  `VAH-F-YYYY-NNNN-A<n>` (actions), `VAH-P-YYYY-NNNN` (positive interventions). 4-digit sequence restarts each year.
- **Workers** see their **own submission history** and the **findings/actions assigned to them**.
- **Supervisors** see the **whole fleet** on the read-only dashboard.
- **Evidence required** applies to some responses only (see §7).
- **Signup:** one simple, general public signup link. Accounts wait as PENDING until approved.
- **Branding:** simple and neutral; no client name or client logo. (Updated 2026-11-06: a generic app mark and
  wordmark are allowed, see Polish pass decisions.)
- **Drafts:** in-progress assessments can be **saved as drafts** and resumed later.
- Hosting and how the demo is presented: deferred.

### Working assumptions (not yet confirmed)

- `N/A` kept as a fourth response (not in the doc), excluded from scoring.
- Module categories as in §6; "Start Work Check" on the hub = choose a *Start Work* module.
- Full Vessel Assurance = one assessment record with a section per *Assurance* module.
- Evidence photo required only for `No` / `Concern Identified` on evidence-required questions.
- Seeded audit types: Self Assessment and Start Work Check (Worker+); MFE, Spot Check, Verification (Supervisor+).
  Admins can pick every audit type.
- Risk categories (admin-editable) seeded as: Personal Safety, Process Safety, Marine Operations, Security,
  Health, Environment.
- Timezone `Africa/Lagos` (WAT); dates shown as `dd MMM yyyy`.
- Submitted assessments are read-only. Drafts are editable and deletable by their author.
- QR code per vessel (admin can display/print it) opens the app with that vessel pre-selected.
  PWA is installable; full offline sync is **out of scope** for v1.

### Confirmed 2026-11-05 (later)

- **Claude writes the real module-specific questions** (doc's first-person style), on top of the doc's 5 core questions.
- **Vessel locations are assigned at random** (Bonga, EA, Forcados, Bonny) in the fixtures, except the 8 featured
  demo vessels, which have fixed locations (2026-11-06, see Demo data set decisions).
- **Scaffolding conventions:**
  - Next.js **15.5.29** (pinned). Scaffolded on 16.4.5, then **stepped down to 15.5 at the owner's request**
    (2026-11-05) so Claude works on a version it knows well. Do not upgrade without asking.
    Next 15 conventions: Tailwind via `@tailwindcss/postcss` (`postcss.config.mjs`); ESLint via `FlatCompat`
    (`eslint.config.mjs`); layouts typed as `Readonly<{ children: React.ReactNode }>`; no `cacheComponents`.
  - React 19.3, Tailwind 4.3, Zod 4.6, Vitest 5.1.
  - shadcn/ui uses the **base-nova** style on **Base UI** (not Radix): use the `render` prop instead of `asChild`;
    `cn` comes from the `cn` package via `@/lib/utils`.
  - Routes: `src/app/(auth)/` (login, signup), `src/app/(app)/` (signed-in pages, shared top bar),
    `src/app/(app)/admin/` (admin pages at `/admin`, inside `(app)` so they share the signed-in layout).
  - Theme tokens `navy` / `teal` in `globals.css` (`bg-navy`, `text-teal`, …); primary = navy, ring = teal.
  - `@types/node` pinned to `^22` to match the local Node 22 runtime (and Vitest 5's peer range).
  - Vitest: `npm test`, node environment, tests are `src/**/*.test.ts` next to the code.
  - Phone access in dev: `allowedDevOrigins` in `next.config.ts` allows private LAN ranges.

### Stage 2 decisions: data layer (2026-11-05)

- Stage 2 prompt was written from the original brief; the owner chose to **keep the document version** (§6–§9).
  Prompt extras adopted: `FindingActivity` audit log; `Vessel.contractor` field.
- **Contractor ranking = the submitting user's company** (confirmed). `Vessel.contractor` stays `null` for the real
  register (no invented operators); admins can fill it in.
- **Data layer layout:** types `src/lib/types.ts`; contracts `src/lib/data/repositories.ts`; mock `src/lib/data/mock/`;
  fixtures `src/lib/data/fixtures/`; switch `src/lib/data/index.ts`; hooks `src/lib/data/hooks.ts`.
  Import data only from `@/lib/data` (and hooks from `@/lib/data/hooks`).
- **Repositories stay plain data access.** Multi-step rules (raise finding + log activity + notify; close finding
  only when all actions closed; critical-control enforcement) go in `src/lib/services/`, not in repositories.
- **Reference numbers are assigned by the data layer:** assessments **on draft creation** (changed in Stage 6; deleted
  drafts leave gaps); findings / positive interventions on create; actions as `<finding ref>-A<n>`.
- **Findings and positive interventions can only be recorded against SUBMITTED assessments.** The form collects them
  while drafting and creates them after submit.
- **Assessments snapshot** user name, company, position, vessel name and package; **responses snapshot** question
  text, weight and critical flag.
- **Question bank:** doc's 5 core questions open every task-based module (5 Start Work modules + Personnel Transfer,
  Cargo Operations, Bunkering); other modules have specific questions only. **Critical controls weigh 2**, others 1.
  Bridge Team, Navigation Watch and Galley questions skip Cargo Barges (unpowered, no bridge or galley).
  111 questions total (53 critical, 20 evidence-required); fixture IDs are stable (e.g. `q-security-01`, `ves-fds`, `mod-galley`, `usr-admin`).
- **Demo users** (all password `demo1234`, fictional, `@example.com`): admin `admin@example.com`; supervisors Tunde
  Bakare, Chidi Eze; workers Ibrahim Musa, Blessing Okon, Emeka Nwosu, Funmi Alade; pending Samuel Etim;
  disabled Kunle Ojo (added in Stage 3 so the "account disabled" message can be demonstrated). 9 users total.
- **IDs** use `crypto.getRandomValues`, not `crypto.randomUUID` (unavailable on plain-http LAN addresses, i.e. phones).
- **Photos** stored in IndexedDB (`vah-demo-photos-v1`) as ArrayBuffers (more reliable on mobile than Blobs).
- **Page data access:** TanStack Query via `useRepoQuery` / `useRepoMutation`; render with `<QueryState>` for
  consistent loading/error UI. Query keys start with the repository name (`["vessels", filter]`).
- **Tests:** Vitest on `happy-dom` + `fake-indexeddb` (`src/test/setup.ts`); config is `vitest.config.mts`.
  Mock tests call `setMockDelay(0)` and `forgetMemoryState()` to simulate a page reload.
- ~6 months of demo history (assessments, findings, actions) was added in Stage 12.

### Stage 3 decisions: mocked authentication (2026-11-05)

- **Auth is a repository** (`auth` in `src/lib/data`): `signUp`, `logIn`, `getSessionUser`, `logOut`. Plus MOCK
  `demo.logInAs(userId)` for quick-login / "Demo as". All return `PublicUser` (never the password).
- **Sign-in errors** are `RepositoryError` codes `INVALID_CREDENTIALS` (same message for unknown email and wrong
  password; checked before status), `PENDING_APPROVAL`, `ACCOUNT_DISABLED`.
- **`canUseAuditType(role, auditType)` reads the audit type's `allowedRoles`** (admin-editable), not a hard-coded list.
  The seeded audit types reproduce the rule: Workers → Self Assessment + Start Work Check; Supervisors/Admins → all.
- `permissions.ts` also has `requireUser`, `requireRole`, `hasRole`, `canAccessAdmin`, `canViewDashboard`,
  `signInBlock`, `SELF_SIGNUP_ROLES` (Worker, Supervisor). Errors are `PermissionError` (`UNAUTHENTICATED` / `FORBIDDEN`).
- **AuthProvider** (`src/components/auth/auth-provider.tsx`): session via TanStack Query key `["auth","session"]`;
  `useAuth()` and `useCurrentUser()` (only below `RequireAuth`). Logout does a full reload to `/login`.
  Switching user resets every other cached query.
- **Guards:** `RequireAuth` wraps `(app)` → `/login?next=<path>`; `RequireRole(["ADMIN"])` wraps `/admin`
  (shows "no access", no redirect); `RedirectIfAuthenticated` wraps `(auth)` → `?next` (same-site paths only) or `/`.
  Server HTML only contains the loader, so protected content never leaks before the check.
- **A disabled user is signed out** the next time the session is read.
- **Forms:** plain React state + Zod (`src/lib/validation/auth.ts`), `FormField` + `fieldA11y` helpers, inputs `h-11`
  for phones. Signup position = persona list + "Other" (free text). Errors shown per field.
- Demo accounts: Admin Ngozi Adeyemi, Supervisor Tunde Bakare, Worker Ibrahim Musa (`DEMO_ACCOUNTS`).
- The hub placeholder now greets the signed-in user and lists the audit types their role can use.

### Stage 4 decisions: admin area (2026-11-05)

- **Admin actions live in `src/lib/services/admin/`** (users, vessels, locations, modules). Each starts with
  `requireAdmin(actor)`, validates with Zod (`parseOrThrow` → `ValidationError` with per-field messages), then calls
  repositories. UI runs them through `useAdminAction` (toast on success/failure, invalidates query prefixes).
- **User rules** (`permissions.ts`): `canChangeUserStatus` / `canChangeUserRole` return a `Decision`
  (`denialReason()` for the message). Admins cannot disable/reject themselves or change their own role; the last
  active admin cannot be demoted or disabled (a safety net: unreachable through the UI since the actor is an admin).
  Approve/Reject apply to PENDING only; Disable to ACTIVE; Re-enable to DISABLED.
- **Vessel type is free text with suggestions** (datalist + tap chips). On save it matches an existing type by name
  (case-insensitive) or creates a new `VesselType`.
- **Unique names** (case-insensitive) for vessels, locations, modules.
- **Reorder** uses `moveInOrder` (`src/lib/services/ordering.ts`): swap with neighbour, renumber 1..n, update only
  changed rows. Shared with questions.
- **Layout:** `/admin` → `/admin/users`. `AdminShell`: sidebar (md+) / "Menu" sheet (phones); Users shows a pending
  count badge. Page width widened to `max-w-6xl`. Tables on desktop, cards on phones.
- **UI kit additions:** Sonner toasts (light theme only; `next-themes` removed), `ConfirmDialog` (AlertDialog, never
  `window.confirm`), `NativeSelect` (native `<select>` for phones), `PageHeader`, `EmptyState`, `StatusBadge`.
- **Settings** holds the demo-data panel and "Reset demo data" (with confirmation). Dashboard is a placeholder.
- Not built yet: admin screens for packages, audit types, risk categories, vessel types.

### Stage 5 decisions: question bank (2026-11-05)

- **`getQuestionsFor({ moduleId, vesselTypeId, auditTypeId })`** in `src/lib/services/questions.ts` drives the
  assessment form. It takes the vessel's **type id** (`vessel.vesselTypeId`), not the type name.
- Questions repository gained `createMany` (all-or-nothing), `isAnswered`, `listAnsweredIds`, `remove`.
  **`remove` refuses (CONFLICT) once a question has any response**, in both the service and the data layer.
- Question form adds **critical control** (not in the stage prompt; required by the design doc). Weight 1–5.
  Duplicate wording within a module is rejected (case-insensitive). Moving a question to another module puts it at
  the end of that module. Editing affects new assessments only (responses keep snapshots).
- **Reorder** is offered only when one module is selected, status = All and no search (so the visible list is the
  whole module).
- **CSV import** (`src/lib/services/question-import.ts`): own RFC 4180 parser (quotes, "" escapes, embedded
  commas/newlines, CRLF, Excel BOM), no dependency. Columns `module,text,riskCategory,weight,evidenceRequired,
  vesselTypes,auditTypes` + optional `criticalControl`; any column order; names matched case-insensitively
  (audit types also by code); lists separated by `;`, empty = all; weight blank = 1; booleans yes/no/true/false/1/0/y/n.
  Row errors: unknown references, bad weight/boolean, short/long text, duplicates (bank or earlier in file).
  **Import saves the valid rows only** and says how many are skipped. Template is generated in the browser.
  Sample file with deliberate errors: `docs/samples/question-import-example.csv` (3 valid, 4 invalid).
- UI: `ToggleChips` multi-select (tappable chips) for vessel/audit types.

### Stage 6 decisions: hub and assessment setup (2026-11-05)

- **Assessment references are assigned when the draft is created** (owner decision; replaces the Stage 2 rule).
- **Hub tiles:** highlighted Start Work Check + Full Vessel Assurance on top, then one tile per active **Assurance**
  module (owner decision). Start Work modules are reached only through Start Work Check ("Which task?").
  Below: My Assessments, My Actions (open count), Dashboard (supervisors/admins via `canViewDashboard`).
- **The START_WORK_CHECK audit type is only used for Start Work Checks** (owner decision):
  `allowedAuditTypesFor(role, kind, auditTypes)` in `permissions.ts`. Workers therefore get only Self Assessment for
  module / Full Vessel assessments.
- **`startAssessment(actor, values)`** (`src/lib/services/assessments.ts`) re-checks everything server-style:
  active user, active vessel/location, module category matches kind, audit type allowed for role + kind. Full Vessel
  = every active Assurance module at creation time.
- **Setup URL:** `/assess/new?module=<moduleId> | start-work | full-vessel`. Location pre-fills from the vessel's
  default (blank if that location is inactive). "Begin" is disabled when no questions apply.
- **Access:** `canViewAssessment` (owner, admin, or supervisor for SUBMITTED); `canEditAssessment` (owner + DRAFT).
  `getAssessmentForUser` returns NOT_FOUND for both missing and forbidden.
- **Overdue** helper: `src/lib/services/overdue.ts` (`businessToday` in Lagos, `isOverdue`).
- `/assess/[id]` is a draft overview until the assessment-form stage. `/my/assessments`, `/my/actions` (list only),
  `/dashboard` (placeholder, SUPERVISOR+ADMIN; admin sidebar links here, `/admin/dashboard` redirects).
- Dev tip: never run `next dev` straight after `next build` on the same `.next` (stale chunk errors);
  delete `.next` if a page suddenly 500s with "Cannot find module './vendor-chunks/…'".

### Stage 7 decisions: assessment form (2026-11-05)

- **Answer buttons read Yes / Concern / No / N/A** (owner decision; doc wording). Long form "Concern Identified".
  Labels in `ANSWER_LABELS` / `ANSWER_LONG_LABELS` (`src/lib/services/assessments.ts`).
- **Findings, photos, critical-control enforcement and evidence photos are deferred to the next stage** (owner
  decision). This stage shows the Critical / Evidence required badges only.
- **Scoring stays in `src/lib/services/scoring.ts`** (not `lib/scoring.ts`). **The service calculates scores at
  submit** (`submitAssessment` → `scoreAnswers` → `calculateAssessmentScores`) and passes them to
  `assessments.submit(id, scores)`; the data layer no longer scores. The review screen uses the same `scoreAnswers`.
- **Only questions that currently apply count.** Required set = `getQuestionsFor` per module at load/submit time;
  answers to questions that stopped applying (deactivated, etc.) are ignored in scoring and in the "unanswered" check.
- **Submit** requires every applicable question answered; then creates a Positive Intervention (`VAH-P-…`) for each
  Good Practice answer (description = comment, or the question text).
- **Autosave** (`use-answer-autosave.ts`): taps save immediately, comments after 0.8 s; saves per question run in
  order; Saving… / Saved / Couldn't save (retry) indicator; `beforeunload` warning while unsaved; "Save draft" and
  "Review & submit" flush first. A comment/tag without an answer is held locally (responses need an answer).
  Tapping the selected answer again clears it (`clearAnswer`).
- **Routes:** `/assess/[id]` = form for the owner's draft, read-only for everyone else (and for submitted);
  `/assess/[id]/review` = live score, answer counts, unanswered list (links to `#q-<id>`), Submit with confirmation;
  `/assess/[id]/submitted` = confirmation (reference, score, Good Practice count, Back to hub / View answers).
- Score colours: see Stage 12 (now ≥90 green, ≥75 amber, else red everywhere). Full Vessel sections are collapsible; the first
  unfinished one opens automatically.

### Stage 8 decisions: photo attachments (2026-11-05)

- **Evidence rule kept as confirmed in §7** (owner: "go with the best"): an evidence-required question needs ≥1 photo
  only when answered **No** or **Concern Identified** (the stage prompt said "any answer except N/A"; not adopted).
  Rules in `src/lib/services/evidence.ts` (`evidenceNeeded`, `isMissingEvidence`, `MAX_PHOTOS_PER_QUESTION = 5`).
- **Photos repository interface:** `upload(blob, dimensions?)`, `getUrl(id)`, `getMeta(id)`, `delete(id)`.
  `PhotoMeta` gained `width` / `height`. The mock caches one object URL per photo and revokes it on delete/reset.
- **Compression** (`src/lib/photos/compress.ts`, browser only): longest side ≤ 1600 px, JPEG 0.7; if over 400 KB,
  quality 0.6 → 0.5, then shrink 85% → 40% until it fits (else smallest). Re-encoding strips EXIF (incl. GPS).
  White background for transparent PNGs; `<img>` fallback when `createImageBitmap` fails.
- **Services** (`assessments.ts`): `uploadAnswerPhoto` (owner's draft only, images only, ≤ 2 MB safety cap);
  `saveAnswer` takes optional `photoIds` (omitted = keep existing; max 5, no duplicates, new ids must exist);
  `deleteAnswerPhoto` refuses (CONFLICT) while any saved answer still uses the photo; `missingEvidence(sections, answers)`;
  `submitAssessment` blocks with "N question(s) still need a photo".
- **Form:** Camera chip (`capture="environment"`, opens the camera) and Gallery chip (multiple) next to the tag chips;
  hidden at 5 photos. Uploads run one at a time with spinner tiles; files over the limit are skipped with a toast.
  Photos added before an answer is chosen are held locally (like comments) and saved with the answer; clearing an
  answer keeps its photos on screen. Delete = save the answer without the photo, **then** delete the stored image.
  "Save draft" / "Review & submit" wait for uploads to finish. Badge turns amber "Photo needed" when evidence is missing.
- **Viewer:** full-screen dialog (`components/ui/dialog.tsx`, shadcn base-nova) with previous/next (arrow keys too)
  and Delete with confirmation on drafts only. Read-only and review views show smaller thumbnails without delete.
- **Review screen:** "Photos needed" list linking to each question; Submit disabled until both lists are empty.

### Stage 9 decisions: fast Start Work Check (2026-11-05)

- **Extra setup fields, Start Work Checks only:** job description (3–200 chars, trimmed) and people in the team
  (whole number 1–99, − / + buttons). Stored on `Assessment.startWork: { taskDescription, teamSize } | null`
  (null for other kinds; older saved demo data is given `null` on load, no reset needed). Validated in
  `assessmentSetupSchema` / `startAssessment`.
- **Answers:** Start Work Checks offer **Yes / No / N/A** only (`answerOptionsFor(kind)`); the stored values stay
  `YES` / `NO` / `NA`, so **Yes = Compliant, No = Non-Compliant** (`COMPLIANCE_LABELS`, `answerLongLabelsFor(kind)`).
  `saveAnswer` rejects `CONCERN` on a Start Work Check. Scoring unchanged (Yes 1, No 0, N/A excluded).
  Other assessments keep the four-level scale.
- **Layout:** three large buttons in one row with "Compliant" / "Non-Compliant" captions; comment, tags and photos stay.
  The evidence-photo rule still applies to No answers. Job and team size show in the form header, review, confirmation,
  read-only view and My Assessments.
- **STOP banner:** `stopWorkItems(sections, answers)` = applicable questions answered No. Confirmation page (and the
  read-only view of a submitted check) shows a red "STOP - resolve the No items before starting work" banner listing
  them with comments, or a green "All clear" when there are none. The review screen warns before submit; "No" answers
  do **not** block submitting (the record is the point).
- **Dashboard:** Start Work Checks are normal assessments with audit type `at-start-work-check` (the only type allowed
  for them, Stage 6), so they show under that audit type; covered by a test using `listSubmitted({ auditTypeIds })`.

### Stage 10 decisions: findings in the assessment flow (2026-11-05)

Owner: "go with the best, considering the document's requirements".

- **Trigger:** a **No** answer (shown as "Non-Compliant" on Start Work Checks) opens the **Raise finding** sheet,
  unless that question already has a finding. **Concern** offers a "Raise finding" button only. One finding per question.
- **Critical control answered No (design document):** the sheet locks risk to **High** and the finding is **mandatory**:
  the review screen lists it as blocking and `submitAssessment` refuses without a High-risk finding for it.
  **Non-critical No:** skippable; the review screen lists "No answers without a finding" and Submit asks for
  confirmation ("Submit anyway"). (Moved from working assumptions to confirmed.)
- **Sheet fields:** description (pre-filled with the question text; 5–500 chars), risk Low/Medium/High, owner
  (searchable active users, default = the person submitting), target date (default High +7, Medium +14, Low +30 days
  from today in Lagos; follows the risk until the user edits the date; not in the past).
- **Owner and target date belong to an action** (data model): each finding is created with action **A1**
  (owner, target date, description = the finding's description). More actions come in the findings stage.
- **Reference format kept as confirmed:** `VAH-F-YYYY-NNNN` (e.g. `VAH-F-2026-0001`), action `…-A1`
  (the stage prompt's `F-2026-0001` was not adopted, for consistency).
- **General findings** (no question) can be added from the form ("General findings" box at the end) and the review screen.
- **While drafting**, findings are `FindingDraft` rows (`findingDrafts` repository; deleted with the draft). Service:
  `src/lib/services/findings.ts` (`addFindingDraft`, `updateFindingDraft`, `removeFindingDraft`, `listFindingDrafts`,
  `listAssignableUsers`, `findingsRequired`, `noAnswersWithoutFinding`, `defaultTargetDate`, `addDays`).
- **At submit:** `checkFindingsBeforeSubmit` runs **before** the assessment is submitted (critical rule; every draft's
  owner still active and date not passed). Then `raiseDraftFindings`: finding (linked to the response, `critical` from
  the question snapshot) + action A1 + activity log (`RAISED`, `ACTION_ADDED`) + notifications, then the draft is deleted.
- **Notifications:** High risk → every active admin (`HIGH_RISK_FINDING`); the action owner gets `ACTION_ASSIGNED`
  ("High-risk action …" when High). Nobody is notified about their own entry. No notifications screen yet.
- **Changing a No after raising a finding:** the finding is kept (the card says the answer changed and offers Remove).
- **Shown:** finding card under the question (risk, owner, due date, Edit); review lists; confirmation page and
  read-only view list raised findings (reference, risk, Critical badge, A1 owner and due date). My Actions now fills.
- Access helpers `getAssessmentForUser` / `requireEditableDraft` moved to `src/lib/services/assessment-access.ts`
  (shared by the assessment and finding services without a circular import). `formatCalendarDate` for ISO dates.
- Saved demo data from older stages is upgraded on load (`upgrade()` in the mock store) instead of being discarded.

### Stage 11 decisions: assessment lists, detail page, print (2026-11-05)

Plan approved by the owner ("Go ahead").

- **`/assessments`** replaces `/my/assessments` (which now redirects; hub link and "Save draft" point to the new page).
  Tabs **My assessments | All assessments**; the All tab (`?view=all`) is for supervisors and admins
  (`canViewAllAssessments` = `canViewDashboard`).
- **My:** drafts (most recently edited first) with **Resume** and **Delete** (confirmation; `deleteMyDraft`, owner +
  DRAFT only; removes answers, photos and prepared findings), then submitted (newest first). Rows show reference,
  title (+ Start Work task / "12 modules"), vessel · location · audit type, date, score and an open-findings badge.
- **All:** **submitted assessments only** (drafts are private), newest first. Filters: vessel, location, module,
  audit type, submitted by, From/To dates. Dates are **Lagos calendar days on `submittedAt`, inclusive**
  (`lagosDayStart` / `lagosDayEnd`; Lagos is UTC+1 all year). Filters live in the URL (shareable); on phones they
  fold behind a "Filters (n)" button. Filter lists keep inactive items and disabled users (history); pending users excluded.
- **`/assessments/[id]`** (read-only detail, `loadAssessmentDetail`): header (reference, status, kind, title, Start
  Work job/team, vessel · package, location, audit type, assessed by, company, submitted/started time), score panel,
  STOP banner (Start Work), findings with **current status**, risk, Critical, Overdue and every action (owner, due,
  status), Good Practice count, then every question by module (module score), answer (Compliant / Non-Compliant
  wording for Start Work), critical badge, comment, tag, photos (tap to enlarge) and a link to its finding.
  **Submitted assessments are rebuilt from their responses' snapshots** (text and critical flag as answered; order
  from the bank's display order), so later bank edits never change the record. Drafts (owner/admin) show the questions
  that apply today; the owner gets "Continue draft".
- **`/assess/[id]`** is now only the form for the owner's draft; anything else redirects to `/assessments/[id]`
  (hash kept). Review and confirmation pages link to the detail page.
- **Print / Save as PDF:** button calls `window.print()`. Print CSS (`globals.css` + `print:` variants): A4, 12 mm
  margins, top bar/buttons/toasts hidden, white background, colours kept (`print-color-adjust: exact`), questions and
  findings not split across pages, photos printed at ~28 mm, header line and footer with reference, print time and
  printer's name.
- Services: `src/lib/services/assessment-lists.ts`. Components: `src/components/assessments/`.
  `ScorePanel` and `StopWorkBanner` accept snapshot-based data (module names / `{id, text}` items).

### Stage 12 decisions: dashboard (2026-11-05)

Owner: "go with the best" on the plan's recommendations.

- **Score colours everywhere:** green ≥ 90%, amber 75–89%, red < 75% (`SCORE_BANDS` / `scoreBand` in `scoring.ts`;
  `scoreTone` uses it). Replaces the Stage 7 85/60 bands.
- **`AuditType.assuranceLevel: "SELF" | "SUPERVISORY"`** decides the Self vs Supervisory split (Self Assessment and
  Start Work Check = SELF; MFE, Spot Check, Verification = SUPERVISORY). Saved data is upgraded on load.
- **Design document additions kept:** package filter, Score by package, Contractor ranking (submitter's company).
- **Demo history** (`fixtures/history.ts`, seeded, dates relative to today, rebuilt by Reset demo data): 300 submitted
  assessments over 182 days (~62% module, ~30% Start Work, ~8% Full Vessel), every audit type by the right roles,
  answers from the real bank and applicability rules, scores via `calculateAssessmentScores`. Story: weak vessels
  (Dark Knight II, BL216, Greenbarge 4, Surfer 1903), self/supervisory gap vessels (Topaz Master, Lady Oge,
  ACE Discoverer — audited ~3× as often), strong vessels, slow improvement, 10 recurring problem questions.
  Findings: always High for a critical No, ~60% of other Nos, ~10% of Concerns, ~3% general; 1–2 actions, closure
  likelier with age (some overdue); activity log; Good Practice → positive interventions; no photos.
  ~2 MB in localStorage (writes ~8 ms). Fleet average ≈ 85%. 10 more fictional users (19 total) across 6 companies.
  **Superseded on 2026-11-06 by the presentation data set (see Demo data set decisions).**
  **Tests run without history** (`configureDemoFixtures({ history: false })` in `src/test/setup.ts`).
- **`src/lib/services/dashboard.ts`:** `loadDashboardData` (supervisors/admins) → `prepareDashboardData` (indexes,
  once per load) → pure `computeDashboard(prepared, filter, now)` with `filterAssessments`, `kpis`, `trend`, `scoreBy`
  (vessel/location/package/auditType/contractor), `scoreByModule`, `contractorRanking`, `selfVsSupervisory`,
  `topNonCompliant`, `findingsByStatusAndRisk`, `exportRows`, plus `periodFor`, `previousPeriod`, `bucketFor`,
  `bucketStart`, `parseDashboardFilter` / `dashboardQuery`, `assessmentsLink`. Filtering runs in the browser on loaded
  data, so filter changes are instant (< 50 ms tested on the demo history).
- **Definitions:** fleet score = average overall score (n/a excluded), rounded; module score = average of module
  scores (Full Vessel counts per module); change = vs the same number of days immediately before; open findings =
  findings on the filtered assessments not closed; overdue = an action past its target date; STOPs = Start Work Checks
  with a No; Non-Compliant = No answers; self–supervisory gap warning at **15+ points**; trend buckets: weeks (Mon)
  ≤ 62 days, months ≤ 366 days, else quarters; all dates in Lagos (UTC+1). Default range **This year**.
- **URL:** `range` (last7/thisMonth/lastMonth/thisQuarter/thisYear/custom + `from`/`to`), `vessel`, `location`,
  `package`, `module`, `auditType`, `scope` (self/supervisory); defaults omitted.
- **UI** (`src/components/dashboard/`): sticky filter bar (range + Self/Supervisory always visible; other filters
  inline on md+, in a sheet on phones; removable chips; Reset all), 6 KPI cards, charts: trend (90/75 reference
  lines), vessel (lowest first, height grows with rows), location, module, package, contractor ranking, self vs
  supervisory (12 biggest gaps, ⚠ + warning note), top-10 No questions list, findings by status × risk (stacked).
  Tap vessel/location/module/package bar → applies the filter; contractor bar / top-10 question → All assessments;
  every chart has "View assessments". Screen-reader summary per chart.
- **All assessments list** gained filters: package, contractor, Self/Supervisory (`scope`), and `question`
  (answered No; removable chip).
- **Export to Excel:** sheets Assessments, Responses, Findings for the filtered assessments
  (`vah-dashboard-<from>-to-<to>.xlsx`).
- `npm audit` still reports pre-existing advisories in dev tooling and Next 15's bundled PostCSS (fix needs Next 16);
  none come from Recharts or SheetJS.

### Polish pass decisions (2026-11-06)

Issue list approved by the owner ("Go ahead"), including the generic app mark.

- **How it was checked:** headless Edge driven over the DevTools protocol at **375 px** (Chrome extension still not
  connected): 42 screens as Admin / Worker / signed out; a script measures horizontal overflow, tap targets < 44 px,
  unlabelled controls and console errors. Result after the pass: no horizontal scroll, no targets under 44 px except
  false positives (signup radios sit inside ~64 px label cards; hidden file inputs are `aria-hidden`, `tabIndex -1`).
- **Tap targets ≥ 44 px:** `Button` base has `min-h-11` (overrides like `h-9` can no longer shrink it); default `h-11`,
  `sm` `h-11` (tighter padding), icon sizes `size-11`. Inputs `h-11`, `NativeSelect` `min-h-11`, menu items `min-h-11`,
  sheet/dialog close 44 px, chips 44 px. Text links that act as controls use `BackLink` / `min-h-11`.
- **Colour (WCAG AA):** `--teal` darkened to `oklch(0.51 0.095 192)` (#007774; white-on-teal and teal text ≥ 4.5:1),
  `--destructive` `oklch(0.52 0.2 27.5)`, `--input` (field borders) `oklch(0.65 0.02 245)` (≥ 3:1). Answers: Yes
  `emerald-700`, Concern `amber-400` + `amber-950` text, Medium risk the same, Low risk `sky-700`.
- **Focus:** solid focus everywhere: base `:focus-visible` 2 px outline in `--ring` (white on navy); component rings are
  solid `ring-ring` (no `/50`).
- **Status by text as well as colour:** `SCORE_BAND_LABELS` / `scoreBandLabel` in `scoring.ts` ("Good" ≥ 90, "Fair"
  75–89, "Poor" < 75); `ScoreValue` (`components/assess/score-value.tsx`) shows number + word in score panels, rows,
  module scores and the fleet KPI.
- **Dates:** `formatDate` / `formatDateTime` / `formatCalendarDate` in `src/lib/format.ts` use fixed month names
  ("27 Sep 2026", never "Sept"); tested.
- **Shared UI:** `PageHeader` (optional `back`, `eyebrow`) and `BackLink`; `EmptyState` (icon, title, hint, action)
  everywhere; `StatusScreen` + `NotFoundState` / `NoAccessState` / `ErrorState` (`components/status-screen.tsx`).
  Assessment workflow screens (setup, form, review, confirmation, detail) keep their reference + title header but use
  `BackLink`.
- **Error pages:** `app/not-found.tsx` (branded 404), `app/(app)/error.tsx` (keeps the top bar), `app/error.tsx`,
  `app/global-error.tsx` (inline styles). `QueryState` turns `NOT_FOUND` into "We couldn't find that <thing>"
  (`notFound="assessment"` on assessment pages) and `FORBIDDEN` into the no-access screen; `RequireRole` uses the same.
- **Layout fixes:** dashboard filter bar on phones = [range ▾][Filters] + full-width Self/Supervisory switch; bar
  charts use 0/50/100 ticks; review count tiles 2×2 on phones (no truncation); question chips are a 2-column grid on
  phones (Good Practice | Improvement, Camera | Gallery, Comment); confirmation buttons no longer collapse;
  All assessments shows **25 rows at a time** ("Show N more").
- **Logo & PWA:** `LogoMark` / `Wordmark` (`components/brand/logo.tsx`) in the top bar, sign-in pages, loader and error
  pages. `app/icon.svg` (favicon), `app/apple-icon.png`, `public/icons/icon-192.png`, `icon-512.png`,
  `maskable-512.png`, `app/manifest.ts` (standalone, navy theme `#0d2b50`). The stock Next.js `favicon.ico` was removed.
  No service worker (offline is out of scope for v1).

### Demo data set decisions (2026-11-06)

Owner: "Do the best for a demo" (on the plan: keep the 41-vessel register, concentrate activity on 8 vessels).

- **Register kept (41 vessels); history on 8 featured vessels**, two per location (`FEATURED_VESSELS` in
  `fixtures/vessels.ts`, fixed locations): Bonga = Dark Knight II, Normand Sentinel; EA = Lady Perpetual,
  Surfer 2624; Forcados = Topaz Master, Armed Responder XV; Bonny = Blue Gretha, ACE Discoverer. The dashboard
  therefore charts 8 vessels.
- **Users: 25** (`fixtures/users.ts`): Project Marine Team (admin + 2 supervisors) and **5 contractor companies**:
  Harbourline Offshore Services, Coastway Marine, Bluewake Vessel Management, Riverbend Marine Logistics (each crews two
  featured vessels; workers mostly assess "their" vessels) and Deltaport Crewing (galley/deck crew fleet-wide;
  Seacrest Catering dropped). 5 active supervisors, **3 pending** (Samuel Etim, Zainab Abubakar, Victor Akpan, who
  requests Supervisor), 1 disabled.
- **Story** (`STORY` in `history.ts`, locked by `history.test.ts`): weak = **Dark Knight II** (~68%, the only red
  bar); improving = **Lady Perpetual** (~75% in May → ~95% in Oct/Nov); self vs supervisory gap = **Topaz Master**
  (~95% self vs ~75% supervisory, the only vessel at or above the 15-point warning). Fleet ≈ 85%; ~60% of checks
  score 75–98%, ~20% are a clean 100% (mostly Start Work Checks). A module check with no remarks usually gets one
  Concern ("audits nearly always note something").
- **Counts** (today = 2026-11-06): 300 assessments (~73% module, ~21% Start Work, ~5% Full Vessel), **75 findings**
  (54 closed, 16 in progress, 5 open; 14 overdue), **8 STOPs**, 90 positive interventions, ~650 comments.
- **Wording** in `fixtures/demo-content.ts`: per-module No / Concern / Good Practice comments, Start Work job
  descriptions, follow-up actions, closure comments, general findings, photo subjects.
- **Placeholder photos:** ~210 `demo-photo-<moduleId>-<n>` ids on every No/Concern answer to an evidence-required
  question (so the history obeys the evidence rule) and on some Good Practice answers. They are **never stored**:
  `photo-store.ts` draws a ~1 KB SVG (sky, sea, deck, object, "Demo photo · <subject>" caption) from the id on
  request; delete is a no-op. Zero IndexedDB use; they survive every reset.
- **Determinism:** shared seeded stream for when / where / what / who; each assessment then uses its own seeded
  stream (`seed * 31 + index * 7919`), so tuning one rate does not reshuffle the whole set. Same data on every load and
  reset (dates relative to today).
- **Size:** 1,551,179 characters in localStorage (~1.5 MB; test limit 2 MB); demo photos 0 bytes stored.
- **Storage key bumped to `vah-demo-v2`** (session `vah-demo-v2-session`) so every browser picks up the new set;
  `vah-demo-v1` and its session are deleted on first load (`LEGACY_STORAGE_KEYS`). Everyone is signed out once.

### Pre-demo review decisions (2026-11-06)

- **Every `// MOCK` spot is in §14**, including production-replacement notes on real code (dashboard full download,
  "answered No" scan, photo reference scan, non-transactional submit, browser Excel export, browser-side services).
- **Reset demo data and the demo counts go through `src/lib/services/admin/demo.ts`** (`requireAdmin`), not straight
  to the repository. `useResetDemoData(actor)` takes the actor.
- **Admin sidebar pending count** uses `listUsersForAdmin` (no full user records in admin components).
- **`saveAnswer` validates its input with Zod** (answer and tag enums, comment ≤ `COMMENT_MAX_LENGTH` = 1000, also
  `maxLength` on the textarea) and refuses inactive questions or questions outside the assessment's modules.
  Applicability (vessel type / audit type) is still enforced at scoring and submit, not on every autosave.
- `changeUserRole` rejects unknown roles at runtime.
- **`safeNextPath`** moved to `src/lib/navigation.ts` (tested); rejects `//`, backslashes and control characters.
- **Redirects** `/admin` → `/admin/users`, `/admin/dashboard` → `/dashboard`, `/my/assessments` → `/assessments` live in
  `next.config.ts` (HTTP 307), not in pages; in-page `redirect()` under the sticky top bar logged a Next.js warning.
- **Error states:** findings that fail to load on the form/review show a retry banner (Submit disabled meanwhile);
  "Findings raised" on the confirmation page shows an error with retry; the setup question count handles errors;
  the hub shows an empty state when no module is active.
- The dashboard performance test takes the **best of 5 runs** per filter (a single run also measured scheduler noise
  while 22 test files run in parallel).
- Pages, components and services import data only from `@/lib/data` (no direct `@/lib/data/repositories` imports).
- **Raised findings and actions: any role may update and close them** (owner re-confirmed 2026-11-07, keeping the
  2026-11-05 rule over the review brief's "owner only, admins excepted"). Who closed what, and when, is always
  recorded. Finding *drafts* stay editable only by the assessment's author while the assessment is a draft.

## 16. Open questions

_Move answers into §15 once resolved._

1. Real risk category list (currently defaults).

## 17. Progress

- [x] Stage 0: Project brief captured in `CLAUDE.md`; design document merged (document takes priority)
- [x] Stage 1: Scaffolding (2026-11-05), stepped down to Next.js 15.5.29 and re-verified. Next.js + Tailwind 4 + shadcn/ui (base-nova, Base UI) + Zod 4 +
      Vitest 5; route groups, navy/teal theme, top bar + placeholder user menu, placeholder pages, `.env.example`.
      Verified: `npm test` (1 passed), `tsc`, `npm run lint`, `npm run build`, and `/`, `/login`, `/signup`, `/admin`
      return 200 on localhost and the LAN address.
- [x] Stage 2: Mocked data layer (2026-11-05). Types, repository contracts, mock store (localStorage `vah-demo-v1`,
      200–400 ms delay, IndexedDB photos, reference numbers), fixtures (8 users, later 9, 4 locations, 41 vessels, 17 modules,
      111 questions, audit types, risk categories), scoring + reference services, TanStack Query hooks, `QueryState`,
      admin demo-data panel with reset. Verified: 36 tests pass, `tsc`, lint, build; `/admin` serves without errors.
      Not yet checked in a real browser (Chrome extension not connected).
- [x] Stage 3: Mocked authentication (2026-11-05). Signup (Zod, PENDING), login with status checks, session in
      localStorage, AuthProvider, route guards, admin guard, permissions service, user menu with role + "Demo as",
      demo quick-login. Verified: 64 tests pass, `tsc`, lint, build; pages serve only the loader before the session
      check. Click-through not yet checked in a real browser (Chrome extension not connected).
- [x] Stage 4: Admin area (2026-11-05). Sidebar/mobile menu; Users (search, status filter, pending first, approve,
      reject, role change, disable/re-enable, self-protection); Vessels (filters, add/edit sheet, free-text type,
      deactivate); Locations (add, rename, deactivate); Modules (add/edit, reorder, deactivate); Settings (reset with
      confirmation); toasts. Verified: 87 tests, `tsc`, lint, build.
- [x] Stage 5: Question bank (2026-11-05). `/admin/questions`: filters, search, add/edit sheet (incl. critical
      control), reorder within module, deactivate, delete only if never answered, CSV import with preview and
      row-level errors, template download; `getQuestionsFor` service. Verified: 104 tests, `tsc`, lint, build; all
      admin pages serve. Click-through not yet checked in a real browser (Chrome extension not connected).
- [x] Stage 6: Hub + assessment setup (2026-11-05). Hub tiles and quick links, `/assess/new` setup (searchable vessel
      picker, location pre-fill, role-filtered audit types, Start Work task choice, question count), `startAssessment`
      creates the DRAFT with reference + snapshot, `/assess/[id]` overview, My Assessments, My Actions, Dashboard
      placeholder. Verified: 118 tests, `tsc`, lint, build; pages serve.
- [x] Stage 7: Assessment form (2026-11-05). Question cards (Yes/Concern/No/N/A, comment, Good Practice /
      Improvement chips, badges), collapsible Full Vessel sections, progress bar, autosave with indicator, sticky
      Save draft / Review & submit, review screen with live score and unanswered list, service-side scoring at submit,
      positive interventions, confirmation page, read-only submitted view, Continue drafts from My Assessments.
      Verified: 133 tests, `tsc`, lint, build; routes serve.
- [x] Stage 8: Photo attachments (2026-11-05). Camera/Gallery per question (max 5), browser compression, photos
      repository (`upload` / `getUrl` / `getMeta` / `delete`, IndexedDB mock), thumbnails, full-screen viewer with
      delete on drafts, evidence rule (No / Concern) enforced on review and at submit, photos in read-only views.
      Verified: 155 tests, `tsc`, lint, build; routes serve. Camera/compression not yet checked in a real browser
      (Chrome extension not connected).
- [x] Stage 9: Fast Start Work Check (2026-11-05). Job description + team size at setup, Yes / No / N/A buttons
      (Compliant / Non-Compliant), STOP banner on the confirmation page, details shown across views.
      Verified: 162 tests, `tsc`, lint, build. Not yet checked in a real browser (Chrome extension not connected).
- [x] Stage 10: Findings in the assessment flow (2026-11-05). Raise finding sheet on No (Concern optional), critical
      controls mandatory + High, general findings, owner picker, default target dates, review lists + confirmation,
      findings + action A1 + activity + notifications created at submit (`VAH-F-…`), findings on the confirmation
      page and read-only view. Verified: 175 tests, `tsc`, lint, build. Not yet checked in a real browser.
- [x] Stage 11: Assessment lists + detail + print (2026-11-05). `/assessments` (My with resume/delete drafts; All with
      filters for supervisors/admins), `/assessments/[id]` read-only detail with findings' current status, photos,
      Print / Save as PDF. Verified: 185 tests, `tsc`, lint, build; routes serve, `/my/assessments` redirects.
      Not yet checked in a real browser (print layout especially).
- [x] Stage 12: Dashboard (2026-11-05). Seeded 6-month demo history (300 assessments), `assuranceLevel` on audit
      types, unified score bands, `dashboard.ts` pure aggregates, `/dashboard` with sticky URL filters, KPIs, 9 charts /
      lists with drill-down, All-assessments drill-down filters, Excel export (SheetJS). Verified: 215 tests (incl.
      performance < 50 ms), `tsc`, lint, build. Not yet checked in a real browser (Chrome extension not connected).
- [x] Polish pass (2026-11-06). 375 px audit of every page (headless Edge), 44 px tap targets, WCAG AA colours, solid
      focus, score band words, branded 404 / error / no-access / not-found screens, richer empty states, compact
      dashboard filter bar, paged All assessments, fixed dates ("Sep"), app mark + favicon + manifest (installable).
      Verified: 218 tests, `tsc`, lint, build; audit re-run shows no overflow and no sub-44 px targets.
      Still not clicked through by a person in a real phone browser.
- [x] Demo data set (2026-11-06). 8 featured vessels with a weak / improving / gap story, 25 users (5 contractors,
      3 pending), 300 assessments, 75 findings (14 overdue), 8 STOPs, offshore comments, generated placeholder photos,
      storage key v2. Verified: 226 tests (story locked in `history.test.ts`), `tsc`, lint, build; checked in headless
      Edge at 375 px (dashboard, users, assessment with photos, photo viewer). Stored size ~1.5 MB.
- [x] Pre-demo review (2026-11-06). Permissions, data-layer boundary, MOCK markers / §14, loading-empty-error states,
      console sweep of 45 page loads in headless Edge (Admin / Worker / Supervisor / signed out). Fixed 13 findings
      (see Pre-demo review decisions).

## 18. Source document summary

`VAH_Version2_Detailed_Functional_Design (1).docx` (repo root, supplied 2026-11-05). Key content:

- **Platform:** web PWA for company personnel, contractors, vessel crews and visitors; access by browser, mobile and QR code.
- **Business goals:** workforce engagement; one assurance database; trending by vessel, package, contractor and location;
  promote IOGP Start Work and Life Saving Rules.
- **Modules:** the 17 in §6.
- **Personas (positions):** Crew Member, Bridge Officer, Master, Chief Engineer, Galley Team, Marine Representative,
  Offshore Coordinator, Team Lead, Manager/MFE Visitor.
- **Question framework:** first-person style; responses Yes / Concern Identified / No; photo; comment; critical control flag.
- **Critical control logic:** "No" on a critical control auto-creates a finding; high-risk finding notification;
  action owner mandatory for critical findings.
- **Dashboard:** fleet score, vessel score, package score, contractor ranking, open findings, overdue actions,
  positive interventions, monthly trends.
- **Data model:** Vessels, Users, Modules, Question Bank, Assessments, Responses, Findings, Actions, Photo Evidence,
  Positive Interventions.
- **Roadmap:** MVP → fleet deployment → advanced analytics and benchmarking.
- **Sample core questions** (identical for Marine Start Work, Personnel Transfer, Cargo Operations, Bunkering,
  Galley, Security, Leadership Engagement):
  1. I am fit for duty and understand my role.
  2. I have reviewed hazards and controls.
  3. I have confirmed communications are effective.
  4. I know how to stop the job if conditions become unsafe.
  5. I am satisfied the activity can proceed safely.
- The doc names the client organisation. The UI stays **unbranded**: no client name or logo.

### Fleet Vessel Register (41 vessels: name, package, type)

| Vessel | Package | Type |
|---|---|---|
| FDS | EPC2 | Installation Vessel |
| Shen Da Hao | EPC2 | Installation Vessel |
| Normand Sentinel | EPC2 | Installation Vessel |
| Greenbarge 2 | EPC2 | Cargo Barge |
| Dark Knight II | EPC2 | AHTS |
| BOA44 | EPC2 | Cargo Barge |
| Topaz Master | EPC2 | AHTS |
| Greenbarge 4 | EPC2 | Cargo Barge |
| BL216 | EPC2 | AHTS |
| JMC3337 | EPC2 | Cargo Barge |
| Astro Sculptor | EPC2 | AHTS |
| Greenbarge 1 | EPC2 | Cargo Barge |
| BL222 | EPC2 | AHTS |
| AHTS Aspire | EPC2 | AHTS |
| Lady Perpetual | EPC2 | PSV |
| Neptun Express | EPC2 | PSV |
| Astro Rasalas | EPC2 | PSV |
| Surfer 2624 | EPC2 | Crew Boat |
| Surfer 1903 | EPC2 | Crew Boat |
| MV Pistos (FSIV) | EPC2 | Crew Boat |
| Lady Oge | EPC2 | SEV |
| Armed Responder XV | EPC2 | SEV |
| Anne 3 | EPC2 | SEV |
| Queen Jay | EPC2 | SEV |
| Otunba Legacy | EPC2 | SEV |
| DPMS Conqueror | EPC2 | SEV |
| Blue Gretha | EPC1 | FLOTEL |
| IGM Amethyst | EPC1 | PSV |
| Eastern Ursinia | EPC1 | PSV |
| Nue Domingas | EPC1 | Crew Boat |
| Nue Strider | EPC1 | SEV |
| SVS Guardsman | EPC1 | SEV |
| BLOEMGRACHT | EPC1 | HLV |
| Safeen Argus 2 | Wells | PSV |
| MV Oshibugie | Wells | PSV |
| A60 | Wells | PSV |
| ACE Discoverer | Wells | PSV |
| DS10 | Wells | Installation Vessel |
| MV Bemigho | Wells | PSV |
| African Vision | Company/EPC3 | Installation Vessel |
| NUE FERULLA | EPC1 | SEV |
