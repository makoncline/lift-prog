# Workout Tracker App

## Overview

This workout tracker app allows users to follow a consistent, progressive training program by automatically managing rep counts and weight adjustments. It starts with two predefined workouts (Push and Pull), each composed of multiple exercises. Every exercise contains sets, and each set records the number of reps and the weight used.

Workouts begin at a minimum of 8 reps per set. If the user successfully completes all reps in a session, the next workout increases each set by 1 rep, up to a maximum of 12 reps. Upon reaching 12 reps, the rep count resets to 8, and the app calculates a new weight so the user continues to progress in total volume and load.

## Feature Roadmap

- [x] Predefined workout template: Push and Pull (hardcoded for now)
- [x] Exercise and set management
  - [x]     init with same number of sets as last time the exercise was done in a workout
  - [x]     if no previous workout data exists, initialize with one default set
  - [x]     show the previous workout weight x reps for each set
  - [x]     init the first set estimates with the previous workout weight x reps but increment the reps by 1
  - [x]     if estimated reps is above the max, drop to the min reps and calculate the estimated weight base on 1rep max
  - [x]     init the other sets estimates with the set preceding its weight x reps
  - [x]     explicitly set values take priority over estimated values
  - [x]     values are explicitly set on completion of a set
  - [x]     values are explicitly set when the user edits a value directly
  - [x]     clicking next on weight field moves to reps field
  - [x]     clicking next on reps field completes the set
  - [x]     clicking next on last set moves to the next exercise
  - [x]     After completing the last set, the keyboard should close
  - [x]     display "-" when values are null/undefined
  - [x]     visually distinguish between explicitly set values and estimated values
- [x] Rep progression scheme (8 → 12 reps)
- [x] Automatic weight adjustment after max reps
- [x] User interface for tracking workouts and progress
- [x] Persistent workout history
- [x] Edit weight and reps of each set while doing workout
- [x] Option to delete a set
- [x] Option to add a set
- [ ] Add an exercise to a workout
- [ ] Select difficulty of a set
- [x] - and − to increment reps
- [ ] Input weight by selecting bar type and plates per side
- [x] - and − to increment weight by 2.5
- [ ] Calculate weight by doing addition
- [x] Option for body weight
- [x] Option for body weight plus and minus modifications
- [x] Option to repeat same number of reps next workout
- [x] Workout timer
- [x] Workout notes
- [x] Exercise notes
- [x] Add/remove warm-up sets
- [ ] Option for auto rest timer
- [ ] weight estimates should include body weight
- [x] edit workout name, completion time, duration

## Workouts to start

Big 7 - Push

- barbell squat
  - 2 warmup sets
  - 3 working sets
- barbell bench press
  - 1 warmup sets
  - 3 working sets
- Barbell shoulder press
  - 1 warmup sets
  - 3 working sets
- Dips
  - 3 working sets

Big 7 - Pull

- Barbell Deadlift
  - 2 warmup sets
  - 3 working sets
- Barbell Bent-Over Row
  - 1 warmup set
  - 3 working sets
- Wide Pull-up
  - 1 warmup set
  - 3 working sets
- Face pull
  - 3 working sets
