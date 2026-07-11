# iOS Release Runbook

## Goal

Produce a standalone App Store/TestFlight build that talks to the deployed API
at `https://lift.makon.dev` and does not require Metro, Expo Go, or a local Mac.

## Production Build Path

1. Confirm `apps/mobile/eas.json` production env points at the deployed API.
2. Confirm `apps/mobile/app.config.ts` has the next `ios.buildNumber`.
3. Confirm the Turso production database has every migration in `prisma/migrations/`
   applied manually, including rest times and Better Auth rate limiting.
4. Confirm the archive is built from committed native iOS sources, not only local
   generated files.
5. Build from the mobile workspace:

   ```sh
   cd apps/mobile
   eas build --platform ios --profile production
   ```

6. Submit through App Store Connect or:

   ```sh
   cd apps/mobile
   eas submit --platform ios --profile production
   ```

## Native Source Tracking

The native iOS project is part of the release source because this app includes a
Watch companion and Live Activity extension that Expo prebuild does not recreate
from config alone. Keep these files in git:

- `apps/mobile/ios/LiftProg.xcodeproj`
- `apps/mobile/ios/LiftProg.xcworkspace`
- `apps/mobile/ios/LiftProg`
- `apps/mobile/ios/LiftProgWatch`
- `apps/mobile/ios/LiftProgRestTimerLiveActivity`
- `apps/mobile/ios/Podfile`
- `apps/mobile/ios/Podfile.lock`

Do not commit generated `Pods/`, `build/`, or local `.xcode.env.local` files.

## Release Verification

- Production/TestFlight builds must not require Metro, Expo Go, or a local Mac.
- Debug signing can use Apple Development, but Release configurations should use
  Apple Distribution or EAS-managed distribution credentials.
- The production archive must be checked for dev-client UI before submission.
  `expo-dev-client` may remain useful for local development, but the submitted
  binary should not expose the dev launcher or dev menu.
