# Lift Prog

Workout tracking app with a Next.js web/API app, an Expo iOS app, shared workout
logic, Better Auth email-code sign-in, and Prisma/Turso persistence.

## Stack

- Next.js
- Expo / React Native
- Better Auth email OTP
- Prisma
- Turso / SQLite
- tRPC
- Tailwind CSS

## Workspaces

- `apps/web` - Next.js app, API routes, Better Auth server, tRPC routers.
- `apps/mobile` - Expo iOS app plus native iOS modules.
- `packages/workout-core` - shared workout state and schemas.
- `packages/workout-sdk` - typed mobile API client contracts.

## Notes

Database migration details live in `docs/DB.md`. iOS release notes live in
`docs/ios-release.md`.
