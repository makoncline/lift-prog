# Mobile UI atlas

The atlas covers each finite, user-visible UI composition in Lift Prog. The
manifest includes base screens and meaningful state variants. This includes
pending actions, validation failures, empty sections, keyboard modes, set
types, sync states, Watch navigation states, and iOS-owned surfaces.

It does not create a screenshot for every possible workout name, weight, rep
count, note value, date, or animation frame. Those values do not change the UI
composition. It does cover loading, empty, error, editing, confirmation,
keyboard, modal, timer, workout-mode, exercise-detail, calculator, Watch, and
system-owned states.

The atlas also does not multiply independent states. For example, it does not
require separate screenshots for every workout title while the timer is
running. A screenshot is required when a state changes layout, controls,
meaning, input method, blocking behavior, or system integration.

## Source of truth

`docs/mobile-ui-atlas-states.tsv` is the state inventory.

Each row has one capture type:

- `simulator`: capture in the iPhone simulator.
- `watch-simulator`: capture in the paired Watch simulator.
- `device`: capture on a physical device because iOS owns the surface.

Screenshot filenames must start with the state ID. Example:

```text
09-home-populated.png
```

The development app exposes each simulator fixture through the installed app
scheme:

```text
com.makon.liftprog://ui-atlas/<state-id>
```

The route uses the production screen components and a fixed in-memory data
client. It does not open or change the user's local or production database.

## Output

Store captures in a directory outside the repository:

```text
<atlas-root>/screenshots/
```

Capture all app-owned iPhone and Watch states:

```bash
scripts/capture-mobile-ui-atlas.sh <atlas-root> \
  --iphone <iphone-simulator-udid> \
  --watch <watch-simulator-udid> \
  --metro-url http://127.0.0.1:<metro-port>
```

Each iPhone route change keys and remounts the complete fixture app. Use
`--fresh-process` only to diagnose state that can escape that boundary. It
terminates and relaunches the app before every screenshot and is substantially
slower.

The capture script disconnects the Simulator hardware keyboard before native
text-entry states. This makes the Apple software keyboard visible in those
screenshots. macOS can request Accessibility permission for `osascript` the
first time.

Native `ActionSheetIOS` surfaces can block later deep links while they remain
open. After an action-sheet state, the capture script terminates the app and
reconnects the Expo development client before it opens the next atlas route.
Wait for the JavaScript bundle to be live before a selected action-sheet
recapture.

To recapture selected states:

```bash
scripts/capture-mobile-ui-atlas.sh <atlas-root> \
  --iphone <iphone-simulator-udid> \
  --metro-url http://127.0.0.1:<metro-port> \
  --only 26-workout-title-edit,27-workout-note-edit
```

Build the labeled sheets:

```bash
scripts/build-mobile-ui-atlas.sh <atlas-root>
```

Use strict mode before publishing the atlas:

```bash
scripts/build-mobile-ui-atlas.sh <atlas-root> --strict
```

Strict mode fails when a simulator or Watch simulator state is missing. Device
states remain listed in `coverage.tsv` until a physical-device capture is
available.

After review, keep the contact sheets and remove the reproducible raw and
labeled images:

```bash
scripts/build-mobile-ui-atlas.sh <atlas-root> \
  --strict \
  --prune-intermediates
```

Pruning runs only after the strict coverage check succeeds. It preserves
`coverage.tsv`, the group sheets, and the complete contact sheet.

Missing app-owned captures are still rendered in every contact sheet as labeled
placeholders. Apple-owned device surfaces use a `DEVICE EVIDENCE` placeholder
until a physical-device capture is added. The sheet therefore always contains
the complete state inventory. It cannot look complete by silently omitting
uncaptured states.

## Capture rules

1. Use the current worktree and one named simulator.
2. Use test or read-only data. Do not modify a saved production workout.
3. Capture the full screen after animation and scrolling stop.
4. Keep the software keyboard visible for keyboard states.
5. Use the same appearance, text size, and device size for one atlas.
6. Do not reuse screenshots from an older app build.
7. Record device-only screenshots separately. Do not replace them with mock UI.
8. Remove unreachable states instead of preserving screenshots for dead UI.

## Review

Review the numbered group sheets first. Each sheet contains at most 12 states.
The `all-*-contact-sheet.jpg` files contain at most 16 states in manifest
order. Use `all-contact-sheet.jpg` only as a complete overview.

Check:

- text does not clip or wrap unexpectedly;
- controls use consistent size, padding, border, and spacing tokens;
- blocking surfaces disable the UI below;
- keyboard and safe-area backgrounds have no gaps;
- empty, loading, and error states explain the next action;
- destructive actions have confirmation;
- each state is reachable and agent-operable.
