# App Store Readiness Plan — lift-prog iOS

> Built from a live review of the `codex/mobile-workout-duration` worktree (2026-07-02), including uncommitted changes — not `main`. This is a prioritized execution plan; items may be checked off or updated as the readiness pass progresses.

## Status of this doc

- [x] Mobile app UX / screens / first-run reviewed
- [x] Backend / auth / sync / persistence reviewed
- [x] HealthKit / Watch / native / build config reviewed
- [x] Uncommitted working-tree changes reviewed
- [x] Final phased plan written
- [x] Dead live HealthKit workout / heart-rate bridge removed; HealthKit now reads body weight and saves completed strength workouts only
- [x] Rest-times persistence finished end-to-end: schema, migration, API save/update, initializer return values, and focused router/initializer tests
- [x] Open signup, account deletion, privacy/support pages, privacy manifest, encryption declaration, and narrowed HealthKit usage are present in source
- [x] OTP rate limiting uses Better Auth's built-in database-backed limiter

## Repo snapshot

- Branch `codex/mobile-workout-duration`, with a large readiness worktree in progress. Configurable rest times are now represented across mobile, core, SDK contracts, Prisma schema, migrations, web routers, and workout initialization.
- Workspaces: `apps/mobile` (Expo iOS app, Better Auth email OTP), `apps/web` (Next.js + tRPC + Prisma/Turso), `packages/workout-core` (shared workout state machine), `packages/workout-sdk` (typed tRPC client contracts).
- Auth is **Better Auth email OTP** on both platforms. Clerk is gone from dependencies; only naming residue remains (`User.clerkUserId`, admin UI labels, stale README).

---

## 1. What is already solid (preserve)

- **Core workout logging engine.** `packages/workout-core/src/workout-logic.ts` is a well-tested reducer (see `packages/workout-core/test/workoutLogic.test.ts`) shared between web and mobile: progression suggestions, warmup/working set split, finalization. Do not rewrite it.
- **Shared API contract layer.** `packages/workout-sdk` (Zod contracts + untyped tRPC client) cleanly decouples mobile from the Next.js server. Mobile consumes 9 procedures (`workout.listRecent/prepareInitialWorkout/saveWorkout/getWorkoutDetails/updateWorkout/deleteWorkout`, `exercise.list/updateNote/updatePlateDefaults`), all `protectedProcedure`, all correctly scoped by `userId` server-side.
- **Auth flow itself.** Email OTP via Better Auth works end-to-end on mobile (`apps/mobile/App.tsx` + `src/lib/auth-client.ts` with SecureStore) and server (`apps/web/src/server/auth/index.ts`, real SMTP delivery in `email.ts`, 365-day sessions). The UX pattern ("one code, long-lived session, no password") is right for a fitness app.
- **Active-workout draft persistence.** 300ms-debounced SecureStore draft (`lift-prog-active-workout-draft-v1`), restore banner on home, unfinished-workout local notification that deep-restores the draft. This is the single most important data-loss protection and it exists.
- **Native iOS depth.** `apps/mobile/modules/lift-health/` (in git) is a real Expo native module: HealthKit body-weight read + workout write, WatchConnectivity bridge, rest-timer Live Activity, local notifications — with graceful permission-denied fallbacks throughout. The Watch companion UI (Digital Crown weight/reps editing, set completion, rest timer) works.
- **Error boundary + error reporting pipeline.** `MobileErrorBoundary` with report IDs, `reportMobileError()` → `POST /api/error-reports` → structured server log. Minimal but a real foundation.
- **Agent-operable UI discipline.** Pervasive `testID`s and accessibility labels — keep this; it's how the app gets verified.
- **Server test coverage of core routers.** `apps/web/test/` covers saveWorkout/updateWorkout/listRecent, exercise normalization, admin guards, workout initializer.

---

## 2. Confusing / unfinished / risky / not user-ready

### Rest-times feature status
The rest-times feature is no longer server-incomplete. The server persists workout-level, workout-exercise-level, user-exercise-level, and per-set rest durations, and `prepareInitialWorkout` returns them for future sessions. Keep the migration and tests with the release branch.

### Structural risks
- **`MobileWorkoutApp.tsx` is ~11,100 lines** containing ~50+ components, the reducer wiring, draft persistence, Health/Watch bridges, and every modal. This is the top maintainability risk for shipping. Split by screen/feature (home, workout screen, modals, health, watch) before piling on more product work.
- **The native `apps/mobile/ios/` tree is real build input and must be committed.** The broad gitignore has been removed, but the Watch app (`ios/LiftProgWatch/*.swift`), Live Activity extension (`ios/LiftProgRestTimerLiveActivity/`), Xcode project with those targets, app icon, splash, entitlements, `PrivacyInfo.xcprivacy`, Podfile hacks (`use_modular_headers!`), and related files remain untracked until they are staged. A fresh clone cannot produce the shipping app until these files are committed.
- **Health cleanup completed in this pass.** The dead `startStrengthWorkout` / `cancelStrengthWorkout` / live heart-rate bridge has been removed from the JS facade and native module. The remaining HealthKit surface is body-weight read plus completed strength-workout write.
- **Dead code / unused deps:** `expo-network` is still never imported, and `USE_SWIPEABLE_EXERCISE_SET_CARDS = false` still leaves a live `LegacyExerciseSetLedgerView` alternate path. The unused SDK `getToken`/Bearer path has been removed; mobile is cookie-only.
- **Clerk naming drift:** `User.clerkUserId` column, admin `user.add` asking for a "Clerk user ID" that doesn't map to Better Auth user creation, README still describing Clerk/NextAuth.

### Behavior risks
- **Finish-workout over a dead network is the scariest path.** Save requires a live tRPC call; on failure the user sees inline red text with no retry affordance and no offline queue. The SecureStore draft is the only safety net.
- **Open signup is enabled.** `assertAuthEmailCanSignIn` now accepts any syntactically non-empty normalized email and app-user resolution creates a `User` row when needed.
- **Auth rate limiting is covered by Better Auth.** Better Auth's built-in database-backed limiter is enabled for auth endpoints, including the email OTP plugin's default send/check/sign-in limits. Do not add a second custom OTP limiter unless Better Auth's behavior proves insufficient.
- **Manual Turso migrations** (`docs/DB.md` runbook) — acceptable for one operator, but every schema change (including the WIP rest-times feature) is a manual production step.

---

## 3. App Store submission blockers & compliance gaps

Ordered by likelihood of rejection:

1. **Native release inputs are not yet committed.** `apps/mobile/eas.json` and `apps/mobile/ios/` are still untracked in the working tree. This blocks reproducible archive/TestFlight work from a fresh clone.
2. **Release signing not proven.** Release config still needs a verified App Store archive path using Distribution signing or EAS-managed credentials. Do not claim App Store readiness until an archive/upload is proven.
3. **expo-dev-client release exclusion not proven.** The production EAS profile sets `developmentClient: false`, but the checked native project/Podfile.lock still contains dev launcher/menu artifacts. Verify a production archive excludes dev UI before submission.
4. **tRPC/error-report abuse controls are still thin.** Auth endpoints use Better Auth's database-backed limiter now, but the authenticated app API and unauthenticated error-report endpoint need throttling or provider-level controls.
5. **Offline finish-workout retry is still not implemented.** The active draft protects against loss, but a finalized failed save is not queued and retried.
6. **Placeholder branding may remain.** App icon is configured in `app.config.ts`, but final icon/splash quality still needs human sign-off.

---

## 4. Product/UX polish for normal users

Current first-run: loading screen → email/OTP form → **empty home with no guidance** — the user must discover the small `+` button. Specific work:

- **Onboarding / first-run:** brief value framing on the auth screen (why sign in, what the app does), then a first-run home empty state ("Start your first workout") that points at the `+` action. HealthKit permission should be requested in context (first body-weight use) with a one-line explanation, not silently on mount.
- **Empty states:** home with zero workouts is a blank scroll area today (`HomeScreen` in `MobileWorkoutApp.tsx`); workout with zero exercises only says "add an exercise". Both need designed empty states.
- **Settings screen: does not exist.** Needed as the container for: account (email, sign out, delete account), Health permissions status + re-request, default rest times (ties into the WIP feature), units (currently lb-only, fine to display as fixed), privacy policy/terms links, support contact, app version.
- **Error states:** inline red `Text` only; no toasts, no retry buttons, no offline banner. Minimum bar: retry affordance on home load failure and on workout save failure, and a persistent "saved locally, will retry" state for finish-workout (see §5).
- **Account management:** sign out exists (home header icon); add delete account (blocker #1) and a "session expired" path that lands on auth with a message instead of silently resetting.
- **Help/support:** none. A support email link + privacy policy link in Settings is sufficient for v1.
- **Session-expiry UX:** 365-day sessions make this rare, but an expired/revoked session currently just falls back to the auth screen with no explanation.
- **Visual polish:** monospace-everything (Courier/Menlo) aesthetic is a deliberate choice — keep if intended as brand, but the icon/splash must match it. Loading states are mostly present and fine.

---

## 5. Technical readiness gaps

- **Persistence/offline:** mobile is cloud-primary; history, exercise suggestions, and saves all require the network. The stated local-first direction (AGENTS.md 2026-06-20) is not implemented: server auto-increment integer IDs, no client-generated stable IDs, no local SQLite, no sync protocol, `updateWorkout` is delete-and-recreate last-write-wins. **For v1, do not build full local-first sync** (see non-goals) — instead close the acute gap: an outbox for failed `saveWorkout`/`updateWorkout` calls (persist the finalized payload in SecureStore, retry on launch/foreground/connectivity change) plus a cached last-known history list for offline display. `expo-network` is already a dependency; use it or drop it.
- **Auth/session reliability:** cookie forwarding via `getBetterAuthCookieHeaders()` works; add explicit handling for 401/UNAUTHORIZED tRPC errors (route to auth screen with message).
- **HealthKit:** narrow authorization to body weight (read) + workouts (write) to match usage strings, delete the dead live-session/heart-rate path, and update `docs/ios-healthkit.md`. Keep the working `HKWorkoutBuilder` save-on-finish path.
- **Watch/Live Activity persistence:** move `ios/LiftProgWatch/`, `ios/LiftProgRestTimerLiveActivity/`, and the Xcode project (or a config-plugin/template equivalent) into git. Until then, no CI or second machine can build the shipping app. Note the duplicated `LiftRestTimerAttributes` type between main module and extension must stay schema-identical.
- **Release build config:** create `eas.json` (or a documented Xcode Archive flow) with a production profile that excludes `expo-dev-client`, sets `ios.buildNumber`, bakes `EXPO_PUBLIC_WORKOUT_API_BASE_URL`/`EXPO_PUBLIC_AUTH_BASE_URL` explicitly (the `https://lift.makon.dev` fallback is fine as long as it's deliberate), and uses Distribution signing. Prove a fresh-clone → archive build.
- **Logging/error reporting:** adopt Sentry (`@sentry/react-native` mobile + `@sentry/nextjs` server) or commit to the homegrown pipeline and add: retention/alerting on error-reports, auth or rate limiting on the endpoint, and replace the web `reportError` TODO stub in `apps/web/src/lib/error-utils.ts`. Silence the tRPC timing `console.log` in production (`apps/web/src/server/api/trpc.ts` line ~132).
- **Server ops:** decide hosting posture (currently Vercel + Turso, personal domain); document required env (`TURSO_*`, `BETTER_AUTH_SECRET`, `SMTP_USER/PASS`, `ADMIN_USER_IDS`); script the Turso migration apply. Fix `schema.prisma` datasource comment/docs so local-vs-Turso is unambiguous.
- **Tests:** zero mobile tests and zero auth tests are the two real gaps. Priorities: (1) integration test of the OTP sign-in gate incl. open-signup behavior once changed, (2) `finalizeWorkout` → `saveWorkout` contract round-trip incl. new rest-times fields, (3) outbox retry logic, (4) account-deletion cascade.

---

## 6. Implementation phases (ordered by user value and App Review risk)

**Phase 0 — Land the WIP (small).**
Rest-times persistence is implemented. Keep the schema/migration/router/initializer/test changes together and make sure the manual Turso migration is applied before relying on it in production.

**Phase 1 — Make the build reproducible (unblocks everything).**
Un-ignore the needed parts of `apps/mobile/ios/` (Watch + Live Activity source, project file, entitlements, assets, PrivacyInfo) or convert to config plugins; add `eas.json`/documented archive flow with a production profile (no dev-client, Distribution signing, explicit env, `buildNumber`); verify fresh clone → TestFlight-able archive. Real icon + splash, tracked in git.

**Phase 2 — Compliance blockers (App Review gate).**
Open registration, Better Auth database-backed rate limiting, in-app account deletion, privacy/support pages, accurate `PrivacyInfo.xcprivacy`, `ITSAppUsesNonExemptEncryption=false`, and narrowed HealthKit auth are present in source. Re-verify them from a clean build and make sure App Store Connect privacy labels match the manifest.

**Phase 3 — First-run and error UX (user value).**
Settings screen (account, sign out, delete, Health status, legal links, support, version); home + workout empty states; onboarding touches on the auth screen; retry affordances on load/save failures; 401 → auth-screen-with-message handling.

**Phase 4 — Save reliability offline (highest-value technical work).**
Finish-workout outbox with retry on launch/foreground/reconnect; pending-sync indicator on home; cached history for offline read. This is deliberately less than local-first sync.

**Phase 5 — Observability + hardening.**
Sentry (or hardened homegrown reporting) on mobile and server; targeted tests (auth gate, save round-trip, outbox, deletion cascade); prod log hygiene.

**Phase 6 — Structural cleanup (parallelizable, ongoing).**
Split `MobileWorkoutApp.tsx` into modules; remove dead code (`expo-network` or use it, legacy ledger view + feature flag); purge Clerk naming (`clerkUserId` → `legacyAuthId` or drop, fix admin user.add, rewrite README); update `docs/ios-healthkit.md`.

Phases 1–2 gate submission; 3–4 gate "user-ready"; 5–6 gate "maintainable". Phase 6 can interleave with 3–5 but should not precede Phase 0.

## 7. Non-goals for v1

- **Full local-first architecture** (local SQLite primary, client UUIDs, multi-device sync/conflict resolution). Preserve the path per AGENTS.md — the Phase 4 outbox should use the finalized-payload shape that a future sync layer can adopt — but do not build it now.
- **Live HealthKit workout sessions / heart-rate streaming.** Out of scope for v1. The app saves completed workouts to Health instead.
- **Android / web-app parity.** iOS-only release; keep web as the operator/admin surface.
- **Remote push notifications** (APNs). Local notifications + Live Activities cover v1.
- **Social/sharing, workout templates marketplace, analytics dashboards, charts.** Exercise history stats that exist already are enough.
- **Payments/subscriptions.** Free app for v1 avoids a whole class of review scrutiny.
- **Open-ended admin panel work** beyond what account deletion and open signup require.
- **Redesigning the monospace aesthetic.** Polish within it (icon, splash, empty states), don't rebrand.
