# Plan 009: Add An Admin-Only Guard To User-Management APIs

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report; do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 92dd3c7..HEAD -- src/server/api/trpc.ts src/server/api/routers/user.ts src/app/admin/page.tsx src/env.js .env.example`
> If an in-scope file changed since this plan was written, compare the "Current state" excerpts against live code before proceeding. On mismatch, stop and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/001-fix-weight-helper-typecheck.md
- **Category**: security
- **Planned at**: commit `92dd3c7`, 2026-06-18

## Why This Matters

This is pre-existing in a touched area, not introduced by the workout branch. Any signed-in user can call user-management APIs that list users, add users, and delete other users. The app is personal today, but the user explicitly wants future logged-in users, so this needs an admin-only guard before expanding access.

## Current State

Relevant excerpts:

```ts
// src/server/api/routers/user.ts:7
list: protectedProcedure.query(async ({ ctx }) => {
  return ctx.db.user.findMany({
```

```ts
// src/server/api/routers/user.ts:47
delete: protectedProcedure
  .input(z.object({ id: z.string() }))
  .mutation(async ({ ctx, input }) => {
```

```tsx
// src/app/admin/page.tsx:202
const usersQuery = api.user.list.useQuery();

// line 216
const deleteUserMutation = api.user.delete.useMutation({
```

`src/middleware.ts` uses `clerkMiddleware()` but no role/metadata guard.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Typecheck | `npm run typecheck` | exit 0 |
| User/router tests | `npm test -- --run test/workoutRouter.test.ts` or new user-router test | all pass |
| Search | `rg -n "adminProcedure|ADMIN_USER" src .env.example` | shows the new guard/config |

## Scope

**In scope**:
- `src/server/api/trpc.ts`
- `src/server/api/routers/user.ts`
- `src/app/admin/page.tsx`
- `src/env.js`
- `.env.example`
- `test/userRouter.test.ts` (create) or an existing API router test file if a user-router test already exists

**Out of scope**:
- Building a full role-management UI.
- Adding organization support.
- Changing workout/exercise APIs.
- Hardcoding real user IDs or secret values in source.

## Git Workflow

- Branch naming if needed: `codex/admin-user-management-guard`.
- Commit message style: short imperative, for example `Guard admin user APIs`.

## Steps

### Step 1: Add server-side admin configuration

In `src/env.js`, add an optional server env var such as `ADMIN_USER_IDS` or `ADMIN_CLERK_USER_IDS`. It should be optional so local/dev builds still run, but admin APIs must deny when the current user is not listed.

Update `.env.example` with the variable name and an empty value. Do not add real IDs.

**Verify**: `npm run typecheck` exits 0.

### Step 2: Add `adminProcedure`

In `src/server/api/trpc.ts`, create an `adminProcedure` that builds on `protectedProcedure` and checks whether `ctx.session.userId` is in the comma-separated allowlist. Throw `TRPCError({ code: "FORBIDDEN" })` when not allowed.

Keep `protectedProcedure` unchanged for normal user-owned APIs.

**Verify**: `rg -n "adminProcedure|FORBIDDEN" src/server/api/trpc.ts` shows the new middleware.

### Step 3: Apply admin guard to user router

In `src/server/api/routers/user.ts`, replace `protectedProcedure` with `adminProcedure` for `list`, `add`, and `delete`.

Do not change workout/exercise routers in this plan.

**Verify**: `rg -n "protectedProcedure" src/server/api/routers/user.ts` returns no matches, and `rg -n "adminProcedure" src/server/api/routers/user.ts` shows all user-management procedures guarded.

### Step 4: Update admin page error copy

In `src/app/admin/page.tsx`, show a clear unauthorized/error state if user-management queries fail with forbidden/unauthorized. Keep the UI minimal.

**Verify**: `npm run typecheck` exits 0.

### Step 5: Add tests

Create `test/userRouter.test.ts` using `test/workoutRouter.test.ts` as the mock caller pattern. Cover:

- non-admin signed-in user cannot call `user.list`;
- admin signed-in user can call `user.list`;
- non-admin cannot call `user.delete`.

Set `process.env.ADMIN_USER_IDS` inside tests and restore it after.

**Verify**: `npm test -- --run test/userRouter.test.ts` exits 0.

## Test Plan

- New `test/userRouter.test.ts`.
- `npm run typecheck`.
- Optional manual browser check of `/admin` after implementation if local auth is available.

## Done Criteria

- [ ] `user.list`, `user.add`, and `user.delete` use `adminProcedure`.
- [ ] Admin allowlist is configured through env, with no real IDs committed.
- [ ] Non-admin router tests fail with `FORBIDDEN`.
- [ ] `npm test -- --run test/userRouter.test.ts` exits 0.
- [ ] `npm run typecheck` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP Conditions

Stop and report if:

- The app already has a different role/authorization system not visible in the current files.
- Clerk session IDs in `ctx.session.userId` are not the same identifiers intended for the allowlist.
- Product direction requires per-organization admin roles instead of a simple allowlist.

## Maintenance Notes

This is a pragmatic guard for the current app. If this becomes multi-user, replace the env allowlist with a durable role model or Clerk metadata, but keep the server-side procedure boundary.
