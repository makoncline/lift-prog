# Mobile UI Atlas Review

Date: 2026-07-27

## Result

The review covers all 139 reachable states in
`docs/mobile-ui-atlas-states.tsv`.

- 117 iPhone Simulator states are captured.
- 12 Watch Simulator states are captured.
- 10 Apple-owned device states have labeled evidence placeholders.
- 0 required Simulator states are missing.
- 0 major app-owned layout issues remain in the captured atlas.

The generated atlas is at:

`/Users/makon/.codex/visualizations/2026/06/15/019ecbec-b721-7323-9fe1-c2fd1afcb2d7/lift-native-ui-atlas-current`

## Review Method

Each finite UI composition was opened through the development-only atlas route.
The route uses production components and fixed in-memory data. It does not open
or change the user's local or production workout database.

The review checked:

- clipping and unintended wrapping;
- hierarchy, density, spacing, padding, borders, and alignment;
- modal containment and disabled background interaction;
- loading, empty, error, pending, and destructive states;
- iOS keyboard overlap and safe-area behavior;
- current, completed, and past-edit workout modes;
- Watch layouts at the actual Watch Simulator size;
- complete state coverage.

## Fixed Findings

| Area                       | States                | Resolution                                                                                                                                                                 |
| -------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root loading and errors    | 01-03, 08             | Added product identity, correct status-bar contrast, an error reference, retry, and support actions.                                                                       |
| Cloud sign-in              | 04-07, 82-84, 135-136 | Improved vertical composition and secondary actions. Added a visible close action and explicit email and OTP keyboard states.                                              |
| Workout history            | 09, 11-14, 85-87      | Removed contradictory empty/error output, stabilized the exercise-name column, improved pending feedback, and preserved the full-width active-workout drawer.              |
| Empty workout              | 21                    | Made `add exercise` a clear, full-width primary command.                                                                                                                   |
| Active and past modes      | 22-24, 91, 116        | Added concise mode context and preserved a review screen before saving a past edit.                                                                                        |
| Body weight                | 28, 89-90             | Removed the detached native `Done` accessory, kept manual entry available during Health loading, placed validation with the field, and corrected the Health-empty message. |
| Exercise plan              | 30-32, 94-97          | Prevented empty-sheet clipping, kept search and create actions visible above the keyboard, and preserved reorder and delete-confirm states.                                |
| Workout finish             | 51-55, 115-116        | Rebuilt metadata as stable label/value rows and kept long exercise summaries scrollable.                                                                                   |
| Exercise details           | 57-62, 117-121, 137   | Removed unset implementation text, completed empty-state copy, added chart dates and values, and verified the pinned-note editor with the native keyboard.                 |
| Increase-weight helper     | 63-65, 122            | Removed duplicate completion actions, stabilized the stepper, separated suggestion values, and kept every `use` action inside the dialog.                                  |
| Plate helper               | 66-69, 123            | Removed duplicate actions, clarified errors and mode labels, and preserved target adjustment and reset controls.                                                           |
| Set keypads                | 48-49, 112-114        | Added concise labels for uncommon controls while preserving stable keypad geometry. Removed an unreachable legacy note-keypad state.                                       |
| Set rows and swipe actions | 44-47, 102-111        | Kept notes attached to their set, increased effective touch areas, and preserved visible context for completion and destructive actions.                                   |
| Native set actions         | 138-140               | Added coverage for the set command sheet, rest-choice sheet, and set-kind confirmation.                                                                                    |
| Settings                   | 15-20, 88             | Standardized spacing, hid account-only actions in local mode, and added active progress feedback for account deletion.                                                     |
| Watch                      | 70-75, 124-129        | Corrected body-weight warm-up formatting and confirmed all active, edit, timer, navigation, completion, and ended states fit.                                              |

## Final Scene Audit

The following ratings apply to the final, post-fix captures.

### Startup

| States  | Rating | Finding                                                                                       |
| ------- | ------ | --------------------------------------------------------------------------------------------- |
| 01-08   | Pass   | Loading, local-data errors, sign-in, OTP, and root recovery have clear hierarchy and actions. |
| 82-84   | Pass   | Send, verify, and resend pending states remain stable.                                        |
| 135-136 | Pass   | Email and numeric OTP fields remain visible and usable above the iOS keyboard.                |

### Home

| States | Rating | Finding                                                                                        |
| ------ | ------ | ---------------------------------------------------------------------------------------------- |
| 09-14  | Pass   | Populated, empty, loading, error, refresh, and active-drawer states are distinct and readable. |
| 85-87  | Pass   | Pending row actions and expanded history preserve the compact notebook layout.                 |

### Settings

| States    | Rating | Finding                                                                                                             |
| --------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| 15-20, 88 | Pass   | Local, connected, syncing, offline, confirmation, and pending deletion states use consistent spacing and hierarchy. |

### Workout

| States  | Rating | Finding                                                                                                                |
| ------- | ------ | ---------------------------------------------------------------------------------------------------------------------- |
| 21-25   | Pass   | Empty, active, past-review, past-edit, and command-menu states have clear next actions.                                |
| 26-32   | Pass   | Title, note, body weight, rest defaults, exercise plan, search, and custom creation fit with and without the keyboard. |
| 33-40   | Pass   | Timing, native pickers, rest timer, and exercise command surfaces fit without clipping.                                |
| 41-47   | Pass   | Inline notes, previous-set peek, swipe actions, and destructive confirmations preserve ownership and context.          |
| 51-56   | Pass   | Incomplete-set warning, finish review, timing edits, and workout error recovery remain usable.                         |
| 89-116  | Pass   | Health, past-menu, keyboard, exercise-plan, set-row, note, pause, swipe, and long-summary variants render correctly.   |
| 134     | Pass   | Close-workout confirmation separates keep-editing, save-draft, and discard actions.                                    |
| 138-140 | Pass   | Native set commands, rest choices, and set-kind confirmation block the workout correctly and preserve context.         |

### Keyboards

| States  | Rating | Finding                                                                                               |
| ------- | ------ | ----------------------------------------------------------------------------------------------------- |
| 48-49   | Pass   | Weight and reps input remain visible with one selected value.                                         |
| 112-114 | Pass   | External load, body-weight load, and pause-segment modes remain distinct and fit above the safe area. |

### Exercise Details

| States  | Rating | Finding                                                                                         |
| ------- | ------ | ----------------------------------------------------------------------------------------------- |
| 57-62   | Pass   | About, history, charts, records, edit, and starting-weight screens are readable and scrollable. |
| 117-121 | Pass   | Empty states and custom starting weight explain the next useful action.                         |
| 137     | Pass   | The full-screen pinned-note editor remains usable above the iOS keyboard.                       |

### Calculators

| States     | Rating | Finding                                                                                              |
| ---------- | ------ | ---------------------------------------------------------------------------------------------------- |
| 63-65, 122 | Pass   | Positive, equal-side, negative, and adjusted increase suggestions fit and have direct `use` actions. |
| 66-69, 123 | Pass   | Plate plans, selection menu, impossible state, and adjusted target remain contained in the dialog.   |

### Watch

| States  | Rating | Finding                                                                                |
| ------- | ------ | -------------------------------------------------------------------------------------- |
| 70-75   | Pass   | Idle, active, edit, timer, and ended states fit the display.                           |
| 124-129 | Pass   | Warm-up, working set, navigation, completion, and timer-reset variants remain legible. |

## Native Keyboard Coverage

The final atlas includes the iOS keyboard for each distinct typing surface:

- cloud sign-in email;
- cloud sign-in OTP;
- workout title;
- workout note, empty and existing;
- body weight, Health loading, and validation error;
- exercise search and custom exercise creation;
- pinned exercise note in the workout;
- workout exercise note;
- set note;
- pinned exercise note in the full exercise editor.

Custom numeric keypads are captured separately for:

- external weight;
- body-weight offset;
- reps;
- pause-segment reps.

No captured text field is hidden by the iOS keyboard. No captured custom keypad
extends through the lower safe area.

## Second-Pass Checks

The 2026-07-27 pass compared the state manifest to the rendered component
branches and reviewed all nine contact sheets again. It also checked every
blocking surface and every keyboard owner.

The pass found and fixed:

- local-only settings incorrectly exposed `Sign Out` and `Delete Account`;
- cloud sign-in had no visible close path;
- the workout-history error state had no retry action;
- an Apple Health empty result used misleading validation text;
- startup atlas states duplicated production loading and error components;
- an unreachable legacy note-keypad state remained in the inventory;
- native set-action and rest-choice sheets were absent from the atlas.

No other major app-owned layout or interaction issue was found.

## Design-System Polish Pass

The final 2026-07-27 pass applied one shared token system to the mobile app and
Watch companion. It normalized:

- 20-point page gutters and 16-point list and sheet insets;
- the 8, 12, 24, and 32-point spacing rhythm;
- screen titles, section headings, row text, metadata, and tabular numbers;
- primary, secondary, tertiary, disabled, destructive, and completed colors;
- compact, field, row, primary, and icon-control dimensions;
- field, surface, dialog, sheet, and pill radii;
- sheet scrims, keyboard-adjacent backgrounds, and safe-area padding;
- startup, loading, empty, error, and destructive states.

The pass also replaced nested pressable modal structures with separate backdrop
and content layers. Command-menu actions are now individually accessible to
automation, and taps outside the surface dismiss it without exposing the
underlying workout controls.

The timing dialog was recaptured after its title was constrained to one line.
The automatic, manual, start-picker, and end-picker states now fit without
wrapping or clipping.

## Remaining Device Evidence

These are not app-owned screenshot failures. iOS owns these surfaces, so they
must be captured on a physical device.

| State | Evidence required                   |
| ----- | ----------------------------------- |
| 76    | Apple Health permission             |
| 77    | Notification permission             |
| 78    | Rest timer Dynamic Island           |
| 79    | Rest timer lock screen              |
| 80    | Unfinished-workout reminder         |
| 81    | TestFlight install and first launch |
| 130   | Apple Health save success           |
| 131   | Apple Health save error             |
| 132   | Single active rest notification     |
| 133   | Rest-notification cancellation      |

## Minor Residual Risks

No major app-owned layout issue is visible. These details still need normal
device usability checks:

- Dense home-history summaries can be slower to scan with very long exercise
  names. They intentionally remain compact to preserve the notebook style.
- Swipe actions are visually small. Their effective touch targets are larger
  than their visible chrome, but gym use should confirm the tolerance.
- Chart text is intentionally small. Dynamic Type and a long history range can
  need a separate accessibility pass.
- The Watch debug preview action is guarded by `#if DEBUG`. A release archive
  must confirm that it is absent.

## Release Gate

The app-owned atlas passes the visual layout gate.

Before App Store release:

1. Capture the 10 Apple-owned device states.
2. Verify Dynamic Type and VoiceOver on the main workout flow.
3. Confirm the Watch release archive excludes debug fixture controls.
4. Re-run the strict atlas after the release candidate bundle is built.
