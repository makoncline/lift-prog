# Mobile Workout Gym QA Checklist

Running list of changes requested after the last iPhone Release deploy during the workout. Use this to verify on the computer/simulator later, then decide what needs another phone install.

- Pinned exercise note editing should open only the iOS text keyboard, not the custom weight/reps board.
- All text edit fields should close/avoid the custom weight/reps board: workout title, workout note, pinned exercise note, workout-exercise note, set note, body weight, add-exercise search, and exercise details note.
- Default between-set rest display should be `3:00`, not `2:00`.
- Completing a set should start the 3-minute rest timer.
- Completing another set while the timer is already running should restart the timer from 3:00.
- Canceling a running rest timer should also cancel its pending push notification.
- Tapping the visible completed checkmark should toggle that set back to incomplete.
- Incomplete sets should show no empty check button or outline.
- Keyboard `Next` should move from weight to reps on the same set.
- Keyboard `Next` should move from reps to the next set weight.
- Keyboard `Next` should update the selected/highlighted field in the main workout UI.
- Finishing a workout with incomplete sets should show an incomplete-set warning before the finish preview.
- Incomplete-set warning should list exercises and incomplete logical/base sets.
- Incomplete-set warning should offer `return`, `continue`, and `complete all`.
- Exercise-name details should open as a full-screen sheet.
- Exercise details content should scroll vertically if it does not fit.
- Workout UI behind the exercise details sheet should not be interactive until the sheet is dismissed.
- Exercise history should show historical workout notes, pinned exercise-note snapshots, workout-exercise notes, and set notes.
