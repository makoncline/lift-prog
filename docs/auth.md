# Auth

Lift Prog uses Better Auth email OTP for web and mobile sign-in.

The app-level `User` record stays separate from the Better Auth user. Server
code resolves the active Better Auth identity to an app user via
`User.authUserId`; the old `User.clerkUserId` column is legacy compatibility
storage and should not be exposed in new UI copy or new API inputs.
