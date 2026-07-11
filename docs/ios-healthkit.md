# iOS HealthKit integration

## Current behavior

- The app requests Health permissions when Health-backed body weight or workout save is needed.
- Health authorization currently asks to read body weight and write workouts only.
- The app reads the latest body weight and uses it as the workout body weight unless the user already edited that value.
- Finishing/saving the workout saves a traditional strength-training workout to Apple Health when workout write permission is enabled.
- The workout screen has a `3m` rest timer button that schedules a local iOS notification.

## Verification checklist

- Build the mobile app after native module changes.
- Install on a real iPhone, because HealthKit and notification prompts are not fully reliable in Simulator.
- Start a workout and use the body-weight menu's Apple Health reset path, or finish a workout with Health workout write permission enabled.
- Confirm Health body weight populates only when the workout body weight is empty or unedited.
- Press `3m`, allow notifications if prompted, and confirm a notification fires after three minutes.
- Finish/save the workout and confirm a traditional strength-training workout appears in Apple Health/Fitness.

## Follow-up

Live Apple Watch heart-rate capture may require a watchOS companion or workout mirroring path. The iPhone app currently owns the HealthKit abstraction, so add that behind the existing native module rather than coupling workout UI directly to watch-specific APIs.
