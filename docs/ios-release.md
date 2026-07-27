# iOS TestFlight Release Runbook

## One-command release

From the repository root, run:

```sh
npm run ios:testflight
```

This creates a standalone App Store archive, signs the iPhone, Watch, and Live
Activity targets with team `4PL22H8UY3`, and uploads the result to App Store
Connect. The build uses `https://lift.makon.dev`, ignores local dotenv files, and
cannot include the local development-user override.

The build number defaults to the current UTC second (`YYYYMMDDHHMMSS`), which is
monotonically increasing and does not edit the Xcode project.
Override release metadata when necessary:

```sh
IOS_MARKETING_VERSION=1.0.1 IOS_BUILD_NUMBER=20260722001 npm run ios:testflight
```

To prove the archive without uploading it:

```sh
npm run ios:archive
```

If an upload fails after the archive succeeds, reuse it without rebuilding:

```sh
npm run ios:testflight:upload -- \
  .artifacts/testflight/<build-number>/LiftProg.xcarchive
```

Release artifacts are written under `.artifacts/testflight/<build-number>/`.

## Prerequisites

1. Xcode is signed into the Apple Developer account for team `4PL22H8UY3`.
2. The account has accepted current Apple Developer and App Store Connect terms.
3. Automatic signing is enabled for all three native targets.
4. The production Turso schema is current before releasing code that depends on
   a new migration.
5. The App Store Connect app record uses bundle ID `com.makon.liftprog`.

The script uses Xcode-managed Distribution signing. No EAS subscription, API
key, app-specific password, Metro server, Expo Go, or local tunnel is required.

## After upload

Open the [Lift Prog TestFlight page](https://appstoreconnect.apple.com/teams/69a6de77-9890-47e3-e053-5b8c7c11a4d1/apps/6793640273/testflight).
Apple can take several minutes to process a build before it is available to
testers. The App Store Connect app ID is `6793640273`.

The `Lift Prog Internal` group has automatic distribution enabled and includes
the account holder. After Apple finishes processing a successful upload, the
build should become available to that tester without manually adding the build
to the group.

### External TestFlight testers

Use the `Family Testers` external group for people who should test the app but
should not have access to App Store Connect. Adding a tester record is only the
first step; the tester cannot install a build until that build is added to the
group and approved by TestFlight App Review.

For each new external build:

1. Open `Family Testers` and add the processed build to the group.
2. Enter the real Beta App Review contact information. Do not store the contact
   phone number in this repository.
3. Lift Prog supports self-service email OTP sign-in rather than a reusable
   username and password. Leave App Store Connect's username/password fields
   disabled and tell the reviewer in **What to Test** to use any email address
   they can access; the app sends a six-digit sign-in code to that address.
4. Enable **Automatically notify testers** and submit the build for review.
5. Verify the group shows the build and its status is `Waiting for Review` (or a
   later review/testing status). After approval, App Store Connect sends the
   invitation automatically.

Do not make family or customer testers internal testers merely to bypass Beta
App Review. Internal testers must be App Store Connect users and therefore
receive unnecessary developer-account access.

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
- Debug signing uses Apple Development; TestFlight uses Xcode-managed Apple
  Distribution signing.
- The production archive must be checked for dev-client UI before submission.
  `expo-dev-client` may remain useful for local development, but the submitted
  binary should not expose the dev launcher or dev menu.
