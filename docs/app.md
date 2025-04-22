# Workout Tracker App

## Overview

This workout tracker app allows users to follow a consistent, progressive training program by automatically managing rep counts and weight adjustments. It starts with two predefined workouts (Push and Pull), each composed of multiple exercises. Every exercise contains sets, and each set records the number of reps and the weight used.

Workouts begin at a minimum of 8 reps per set. If the user successfully completes all reps in a session, the next workout increases each set by 1 rep, up to a maximum of 12 reps. Upon reaching 12 reps, the rep count resets to 8, and the app calculates a new weight so the user continues to progress in total volume and load.

## Feature Roadmap

- [ ] Predefined workouts: Push and Pull
- [ ] Exercise and set management
- [ ] Rep progression scheme (8 → 12 reps)
- [ ] Automatic weight adjustment after max reps
- [ ] User interface for tracking workouts and progress
- [ ] Persistent workout history
- [ ] Edit weight and reps of each set while doing workout
- [ ] Option to skip a set
- [ ] Option to add a set
- [ ] Add an exercise to a workout
- [ ] Select difficulty of a set
- [ ] - and − to increment reps
- [ ] Input weight by selecting bar type and plates per side
- [ ] - and − to increment weight by 2.5
- [ ] Calculate weight by doing addition
- [ ] Option for body weight
- [ ] Option for body weight plus and minus modifications
- [ ] Option to repeat same number of reps next workout
- [ ] Workout timer
- [ ] Workout notes
- [ ] Exercise notes
- [ ] Add/remove warm-up sets
- [ ] Option for auto rest timer

## Workout Tracking Requirements

### Set Management & Initialization

- Workouts should initialize with sets based on previous workout data
- If no previous workout data exists, initialize with one default set
- Each set should store its previous workout values (weight and reps)
- Only the first set should default to using previous workout values as estimates
- Subsequent sets should cascade their estimate values from earlier sets in the current workout
- Sets added during a workout should inherit previous values from the last set

### Value Estimation Rules

- Values can be either explicitly set or estimated
- Explicitly set values take priority over estimated values
- A set's values should be marked as explicitly set once the user edits them
- When a set's value is deleted completely, it should revert to estimated values
- When completing a set, estimated values should be saved as explicit values
- Estimation cascade logic:
  - First set: Uses previous workout values as estimates
  - Other sets: Use values from the most recent explicitly set value in the current workout
  - If no explicit values exist, use the first set's values (either explicit or estimated from previous)

### UI/UX Requirements

- Display set number for each set
- Show previous workout values (weight × reps format) for each set
- Display "-" when values are null/undefined
- Visually distinguish between explicitly set values and estimated values
- Mark completed sets with a visual indicator
- Allow adding new sets during a workout
- Support keyboard input for weight and reps values

### Input Behavior

- First interaction with a field should clear it for new input
- First press of delete button should clear the entire field
- Subsequent number inputs should append to existing value
- Subsequent delete presses should remove one character at a time
- Weight input should support decimal values
- Reps input should support whole numbers only
- Plus/minus buttons should increment/decrement weight values by 2.5
- Weight values should round to nearest 2.5 when using plus/minus buttons
- Keyboard interface should auto-advance between fields when appropriate

### Workflow

- Clicking "Next" when on weight field should move to the reps field
- Clicking "Next" when on reps field should mark set as complete and move to the next set
- After completing the last set, the keyboard should close
- Each set should have a toggle button to mark it as completed
- Completed sets should have their values locked in

### Data Persistence

- Workout data should be saved to history after completion
- Previous workout data should be used to initialize new workouts
- Workout history should store date, exercise name, and all sets with weight/reps values
