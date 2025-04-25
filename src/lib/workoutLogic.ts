/* ----------------------------------------------------------------------
 * Workout Tracker – core domain logic
 * ----------------------------------------------------------------------
 *  ‣ pure functions ➜ easy unit‑testing
 *  ‣ single reducer ➜ predictable state updates & undo‑friendly
 *  ‣ UI layer only dispatches actions ➜ no business logic in JSX
 *
 *  You can import everything from this file into <Workout/> or any other
 *  presentation component (React, React‑Native, CLI, etc.) without change.
 * --------------------------------------------------------------------*/

// -----------------------------  Types  ---------------------------------

export type SetModifier = "warmup";
export type WeightModifier = "bodyweight"; // New type for weight modifier

export interface Note {
  text: string;
}

export interface WorkoutSet {
  id: number;
  weight: number | null; // lb
  reps: number | null;
  completed: boolean;
  weightExplicit: boolean;
  repsExplicit: boolean;
  prevWeight: number | null;
  prevReps: number | null;
  modifier?: SetModifier;
  weightModifier?: WeightModifier; // Added weight modifier field
}

export interface WorkoutExercise {
  id: number;
  name: string;
  sets: WorkoutSet[];
  previousSets: Array<{
    weight: number | null;
    reps: number | null;
    modifier?: SetModifier;
    weightModifier?: WeightModifier; // Ensure consistency if loading previous data
  }>;
  notes: Note[];
}

export interface ActiveField {
  exerciseIndex: number | null;
  setIndex: number | null;
  field: "weight" | "reps" | null;
}

export interface Workout {
  currentExerciseIndex: number;
  exercises: WorkoutExercise[];
  activeField: ActiveField;
  inputValue: string; // mirrors the on‑screen keyboard
  isFirstInteraction: boolean; // tracks whether this is the first key press after focusing
  notes: Note[];
  startTime: number; // Added startTime
  name: string; // Added workout name
  isInProgress: boolean; // Added to track if workout is active
}

// Types for finalized workouts
export interface CompletedSet {
  weight: number | null;
  reps: number | null;
  modifier?: SetModifier;
  weightModifier?: WeightModifier; // Added to completed set
  order: number;
  completed: boolean;
}

export interface CompletedExercise {
  id?: string;
  name: string;
  sets: CompletedSet[];
  notes: Note[];
}

/**
 * Interface representing a completed workout ready to be saved
 */
export interface CompletedWorkout {
  id?: string;
  name: string;
  date: string;
  duration?: number; // in seconds
  notes: Note[];
  exercises: CompletedExercise[];
}

// ---------------------------  Constants  -------------------------------

export const MIN_REPS = 8;
export const MAX_REPS = 12;
export const ONE_RM_INCREMENT = -5; // lb added to est. 1RM when progressing
export const WEIGHT_STEP = 2.5; // lb, smallest plate increment

// ----------------------  Pure helper functions  ------------------------

/** Brzycki 1‑rep‑max formula. Safe for reps ∈ [1,12] */
export const estimate1RM = (weight: number, reps: number): number =>
  weight * (36 / (37 - reps));

/** Round to nearest 2.5 lb so we stay plate‑compatible */
export const roundToStep = (value: number, step = WEIGHT_STEP): number =>
  Math.round(value / step) * step;

/**
 * Given previous weight/reps, returns the next target.
 *  • reps 8‑11   → keep weight, reps+1
 *  • reps 12     → reset reps→8 and add weight (via 1RM progression)
 */
export const nextProgression = (
  prevWeight: number | null,
  prevReps: number | null,
): { weight: number | null; reps: number | null } => {
  if (prevWeight == null || prevReps == null)
    return { weight: null, reps: null };
  if (prevReps >= MAX_REPS) {
    const new1RM = estimate1RM(prevWeight, prevReps) + ONE_RM_INCREMENT;
    const targetWeight = roundToStep((new1RM * (37 - MIN_REPS)) / 36);
    return { weight: targetWeight, reps: MIN_REPS };
  }
  return { weight: prevWeight, reps: prevReps + 1 };
};

/**
 * Get the display (possibly estimated) values for a set.
 * ‣ For first set we apply progression to its own previous values
 * ‣ For subsequent sets we cascade from the first set and any explicit overrides
 * ‣ Warmup sets don't affect estimates for working sets
 */
export const estimateSet = (
  sets: WorkoutSet[],
  setIndex: number,
  exercise: WorkoutExercise,
): { weight: number | null; reps: number | null } => {
  const set = sets[setIndex];
  if (!set) return { weight: null, reps: null };

  // If this is a warmup set
  if (set.modifier === "warmup") {
    // For warmup sets, find the corresponding warmup in previous data
    const warmupSets = sets.filter((s) => s.modifier === "warmup");
    const warmupIdx = warmupSets.findIndex((s) => s === set);

    // Find the corresponding warmup in previous data
    const prevWarmups = exercise.previousSets.filter(
      (s) => s.modifier === "warmup",
    );
    if (warmupIdx >= 0 && warmupIdx < prevWarmups.length) {
      const prevWarmup = prevWarmups[warmupIdx];
      return {
        weight: prevWarmup?.weight ?? null,
        reps: prevWarmup?.reps ?? null,
      };
    }

    // Fallback to current set's prev values
    return {
      weight: set.prevWeight,
      reps: set.prevReps,
    };
  }

  // For working sets
  const workingSets = sets.filter((s) => s.modifier !== "warmup");
  const workingIdx = workingSets.findIndex((s) => s === set);

  if (workingIdx === -1) return { weight: null, reps: null };

  // Get previous workout's working sets
  const prevWorkingSets = exercise.previousSets.filter(
    (s) => s.modifier !== "warmup",
  );

  // First working set: apply progression from previous workout
  if (workingIdx === 0) {
    const prevFirstWorkingSet = prevWorkingSets[0] ?? {
      weight: null,
      reps: null,
    };

    // Use next progression for first working set if we have previous data
    const progression = nextProgression(
      prevFirstWorkingSet.weight,
      prevFirstWorkingSet.reps,
    );

    // If progression gives null values (no previous data), fall back to template values
    return {
      weight: progression.weight ?? set.prevWeight,
      reps: progression.reps ?? set.prevReps,
    };
  }

  // For subsequent working sets, cascade from earlier sets in this workout
  let baseWeight = null;
  let baseReps = null;

  // First try to get values from the first working set of this workout
  const firstWorkingSet = workingSets[0];
  if (firstWorkingSet) {
    // If first set has explicit values, use them
    if (firstWorkingSet.weightExplicit) {
      baseWeight = firstWorkingSet.weight;
    } else {
      // Otherwise use estimated values from first working set
      const firstEstimate = estimateSet(
        sets,
        sets.indexOf(firstWorkingSet),
        exercise,
      );
      baseWeight = firstEstimate.weight;
    }

    if (firstWorkingSet.repsExplicit) {
      baseReps = firstWorkingSet.reps;
    } else {
      const firstEstimate = estimateSet(
        sets,
        sets.indexOf(firstWorkingSet),
        exercise,
      );
      baseReps = firstEstimate.reps;
    }
  }

  // Then override with any explicit values from earlier sets in the sequence
  for (let i = 1; i < workingIdx; i++) {
    const earlierSet = workingSets[i];
    if (earlierSet?.weightExplicit) {
      baseWeight = earlierSet.weight;
    }
    if (earlierSet?.repsExplicit) {
      baseReps = earlierSet.reps;
    }
  }

  // If we couldn't establish base values from earlier sets,
  // try using the corresponding set from previous workout
  if (baseWeight === null || baseReps === null) {
    const prevWorkingSet = prevWorkingSets[workingIdx];
    if (prevWorkingSet) {
      baseWeight ??= prevWorkingSet.weight;
      baseReps ??= prevWorkingSet.reps;
    }
  }

  // Final fallback to the set's own prev values
  baseWeight ??= set.prevWeight;
  baseReps ??= set.prevReps;

  return { weight: baseWeight, reps: baseReps };
};

/** Build initial Exercise[] from prior workout snapshots */
export type PreviousExerciseData = Parameters<
  typeof initialiseExercises
>[0][number];

export const initialiseExercises = (
  previous: {
    name: string;
    sets: Array<{
      weight: number | null;
      reps: number | null;
      isWarmup?: boolean;
      modifier?: SetModifier;
      weightModifier?: WeightModifier;
    }>;
  }[],
): WorkoutExercise[] =>
  previous.map((ex, i) => ({
    id: i,
    name: ex.name,
    sets: ex.sets.map((s, idx) => {
      const isPrevBodyweight = s.weightModifier === "bodyweight";
      return {
        id: idx,
        weight: isPrevBodyweight ? s.weight : null,
        reps: null,
        completed: false,
        weightExplicit: false,
        repsExplicit: false,
        prevWeight: s.weight,
        prevReps: s.reps,
        modifier: s.modifier ?? (s.isWarmup ? "warmup" : undefined),
        weightModifier: s.weightModifier,
      };
    }),
    previousSets: ex.sets.map((s) => ({
      weight: s.weight,
      reps: s.reps,
      modifier: s.modifier ?? (s.isWarmup ? "warmup" : undefined),
      weightModifier: s.weightModifier,
    })),
    notes: [],
  }));

/**
 * Get previous workout data for a set based on its position
 * This considers whether it's a warmup or working set
 */
export const getPreviousSetData = (
  exercise: WorkoutExercise,
  set: WorkoutSet,
  sets: WorkoutSet[],
): {
  weight: number | null;
  reps: number | null;
  weightModifier?: WeightModifier;
} => {
  // Use array position instead of ID for more reliable matching
  if (set.modifier === "warmup") {
    // For warmup sets, count position among warmup sets
    const warmupSets = sets.filter((s) => s.modifier === "warmup");
    const warmupIndex = warmupSets.indexOf(set);

    // Ensure valid index
    if (warmupIndex === -1) {
      return { weight: null, reps: null, weightModifier: undefined };
    }

    // Find corresponding warmup set in previous workout
    const prevWarmupSets = exercise.previousSets.filter(
      (s) => s.modifier === "warmup",
    );

    if (warmupIndex < prevWarmupSets.length) {
      const prevWarmupSet = prevWarmupSets[warmupIndex];
      // Type-safe access
      return {
        weight: prevWarmupSet?.weight ?? null,
        reps: prevWarmupSet?.reps ?? null,
        weightModifier: prevWarmupSet?.weightModifier,
      };
    }
  } else {
    // For working sets, count position among working sets
    const workingSets = sets.filter((s) => s.modifier !== "warmup");
    const workingIndex = workingSets.indexOf(set);

    // Ensure valid index
    if (workingIndex === -1) {
      return { weight: null, reps: null, weightModifier: undefined };
    }

    // Find corresponding working set in previous workout
    const prevWorkingSets = exercise.previousSets.filter(
      (s) => s.modifier !== "warmup",
    );

    if (workingIndex < prevWorkingSets.length) {
      const prevWorkingSet = prevWorkingSets[workingIndex];
      // Type-safe access
      return {
        weight: prevWorkingSet?.weight ?? null,
        reps: prevWorkingSet?.reps ?? null,
        weightModifier: prevWorkingSet?.weightModifier,
      };
    }
  }

  // Fallback to default values
  return {
    weight: set.prevWeight,
    reps: set.prevReps,
    weightModifier: undefined,
  };
};

// ---------------------------  Actions  ---------------------------------

export type Action =
  | {
      type: "FOCUS_FIELD";
      exerciseIndex: number;
      setIndex: number;
      field: "weight" | "reps";
    }
  | { type: "INPUT_DIGIT"; value: string }
  | { type: "BACKSPACE" }
  | { type: "PLUS_MINUS"; sign: 1 | -1 }
  | { type: "TOGGLE_SIGN" }
  | { type: "NEXT" }
  | { type: "TOGGLE_COMPLETE"; exerciseIndex: number; setIndex: number }
  | { type: "TOGGLE_WARMUP"; exerciseIndex: number; setIndex: number }
  | { type: "TOGGLE_BODYWEIGHT" }
  | { type: "DELETE_SET"; exerciseIndex: number; setIndex: number }
  | { type: "ADD_SET"; exerciseIndex: number }
  | { type: "NAV_EXERCISE"; direction: 1 | -1 }
  | { type: "COLLAPSE_KEYBOARD" }
  | { type: "ADD_EXERCISE_NOTE"; exerciseId: number; text: string }
  | { type: "ADD_WORKOUT_NOTE"; text: string }
  | { type: "UPDATE_NOTES"; exerciseId: number; notes: string }
  | { type: "REPLACE_STATE"; state: Workout };

// --------------------------- Reducer -----------------------------------

export const workoutReducer = (state: Workout, action: Action): Workout => {
  const { activeField, exercises } = state;

  // Helper to get the currently active set, returns null if none active
  const getActiveSet = (): WorkoutSet | null => {
    if (activeField.exerciseIndex === null || activeField.setIndex === null) {
      return null;
    }
    const exercise = exercises[activeField.exerciseIndex];
    return exercise?.sets[activeField.setIndex] ?? null;
  };

  switch (action.type) {
    case "REPLACE_STATE":
      return action.state;
    case "FOCUS_FIELD": {
      const { exerciseIndex, setIndex, field } = action;
      const ex = state.exercises[exerciseIndex];
      if (!ex) return state;
      const set = ex.sets[setIndex];
      if (!set) return state;

      let initialValue = "";
      if (field === "weight") {
        // If bodyweight, show 0 if null, otherwise show the number (could be negative)
        if (set.weightModifier === "bodyweight") {
          initialValue = set.weight === null ? "0" : String(set.weight);
        } else {
          initialValue = set.weight !== null ? String(set.weight) : "";
        }
      } else if (field === "reps") {
        initialValue = set.reps !== null ? String(set.reps) : "";
      }

      return {
        ...state,
        activeField: {
          exerciseIndex,
          setIndex,
          field,
        },
        inputValue: initialValue,
        isFirstInteraction: true,
      };
    }

    case "INPUT_DIGIT": {
      const activeSet = getActiveSet();
      if (!activeSet || activeField.field === null) return state;

      const currentVal = state.isFirstInteraction ? "" : state.inputValue;
      let newVal = currentVal;

      if (action.value === "." && activeField.field === "weight") {
        if (!currentVal.includes(".")) {
          newVal = currentVal + ".";
        }
      } else {
        // Append digit
        newVal = currentVal + action.value;
      }

      // Limit precision for weights
      if (activeField.field === "weight") {
        const parts = newVal.split(".");
        if (parts[1] && parts[1].length > 1) {
          // Don't allow more than 1 decimal place for weight
          return state;
        }
      }

      return applyInput(state, newVal);
    }

    case "BACKSPACE": {
      if (!getActiveSet()) return state;
      const currentVal = state.inputValue;
      const newVal = currentVal.length > 0 ? currentVal.slice(0, -1) : "";
      return applyInput(state, newVal, true); // Treat backspace as first interaction if clears field
    }

    case "PLUS_MINUS": {
      const activeSet = getActiveSet();
      // Now only applies to weight field, and only increments/decrements
      if (!activeSet || activeField.field !== "weight") return state;

      const currentVal = parseFloat(state.inputValue) || 0;
      const sign = action.sign;
      const step = sign * WEIGHT_STEP;
      const newVal = String(roundToStep(currentVal + step));
      return applyInput(state, newVal, true);
    }

    case "TOGGLE_SIGN": {
      const activeSet = getActiveSet();
      // Only applies to weight field
      if (!activeSet || activeField.field !== "weight") return state;

      const currentVal = parseFloat(state.inputValue) || 0;
      // Simply multiply by -1 to toggle sign
      const newVal = String(currentVal * -1);
      return applyInput(state, newVal, true);
    }

    case "NEXT": {
      return handleNext(state);
    }

    case "TOGGLE_COMPLETE": {
      const { exerciseIndex, setIndex } = action;
      const ex = state.exercises[exerciseIndex];
      if (!ex) return state;
      const set = ex.sets[setIndex];
      if (!set) return state;
      const estimated = estimateSet(ex.sets, setIndex, ex);
      const updatedSet: WorkoutSet = {
        ...set,
        completed: !set.completed,
        weight: set.completed ? set.weight : (set.weight ?? estimated.weight),
        reps: set.completed ? set.reps : (set.reps ?? estimated.reps),
        weightExplicit: true,
        repsExplicit: true,
        modifier: set.modifier, // Keep existing modifier
      };
      const newExercises = replaceSet(
        state.exercises,
        exerciseIndex,
        setIndex,
        updatedSet,
      );
      return { ...state, exercises: newExercises };
    }

    case "TOGGLE_WARMUP": {
      const { exerciseIndex, setIndex } = action;
      const ex = state.exercises[exerciseIndex];
      if (!ex) return state;
      const set = ex.sets[setIndex];
      if (!set) return state;

      // Toggle the warmup modifier
      const updatedSet: WorkoutSet = {
        ...set,
        modifier: set.modifier === "warmup" ? undefined : "warmup",
      };

      const newExercises = replaceSet(
        state.exercises,
        exerciseIndex,
        setIndex,
        updatedSet,
      );
      return { ...state, exercises: newExercises };
    }

    case "TOGGLE_BODYWEIGHT": {
      const { exerciseIndex, setIndex, field } = activeField;
      if (exerciseIndex === null || setIndex === null || field !== "weight") {
        return state; // Can only toggle BW when weight field is active
      }
      const activeSet = getActiveSet();
      if (!activeSet) return state;

      const newWeightModifier =
        activeSet.weightModifier === "bodyweight" ? undefined : "bodyweight";

      let weightToSet = activeSet.weight;
      // If toggling BW OFF and weight is negative, make it positive
      if (
        newWeightModifier === undefined &&
        weightToSet !== null &&
        weightToSet < 0
      ) {
        weightToSet = Math.abs(weightToSet);
      }
      // If toggling BW ON, reset weight to 0
      else if (newWeightModifier === "bodyweight") {
        weightToSet = 0;
      }

      const newSet: WorkoutSet = {
        ...activeSet,
        weightModifier: newWeightModifier,
        weight: weightToSet,
        weightExplicit: true,
        // Do NOT clear the set modifier (warmup)
      };

      const newExercises = replaceSet(
        exercises,
        exerciseIndex,
        setIndex,
        newSet,
      );

      // Determine inputValue based on the *new* state of the set
      let newInputValue = "";
      if (newSet.weightModifier === "bodyweight") {
        newInputValue = String(newSet.weight ?? 0); // Show the number for BW input
      } else {
        newInputValue = String(newSet.weight ?? ""); // Show number or empty otherwise
      }

      return {
        ...state,
        exercises: newExercises,
        inputValue: newInputValue,
        isFirstInteraction: true,
      };
    }

    case "DELETE_SET": {
      const { exerciseIndex, setIndex } = action;
      const ex = state.exercises[exerciseIndex];
      if (!ex) return state;

      // Get the set being deleted
      const setToDelete = ex.sets[setIndex];
      if (!setToDelete) return state;

      // Create new sets array without the deleted set
      const newSets = ex.sets.filter((_, idx) => idx !== setIndex);

      // Keep each set's original previous values - don't shift them
      // No special handling needed for working vs warmup sets
      const updatedExercise: WorkoutExercise = {
        ...ex,
        sets: newSets,
      };

      const newExercises = replaceExercise(
        state.exercises,
        exerciseIndex,
        updatedExercise,
      );

      return { ...state, exercises: newExercises };
    }

    case "ADD_SET": {
      const { exerciseIndex } = action;
      const exPrev = state.exercises[exerciseIndex];
      if (!exPrev) return state;
      const prevData = exPrev.sets[exPrev.sets.length] ?? {
        weight: null,
        reps: null,
      };
      const newSet: WorkoutSet = {
        id: exPrev.sets.length,
        weight: null,
        reps: null,
        completed: false,
        weightExplicit: false,
        repsExplicit: false,
        prevWeight: prevData.weight,
        prevReps: prevData.reps,
        modifier: undefined, // No modifier by default
      };
      const updatedExercise: WorkoutExercise = {
        ...exPrev,
        sets: [...exPrev.sets, newSet],
      };
      const newExercises = replaceExercise(
        state.exercises,
        exerciseIndex,
        updatedExercise,
      );
      return { ...state, exercises: newExercises };
    }

    case "NAV_EXERCISE": {
      const nextIndex = state.currentExerciseIndex + action.direction;
      if (nextIndex < 0 || nextIndex >= state.exercises.length) return state;
      return {
        ...state,
        currentExerciseIndex: nextIndex,
        activeField: { exerciseIndex: null, setIndex: null, field: null },
      };
    }

    case "COLLAPSE_KEYBOARD": {
      return {
        ...state,
        activeField: { exerciseIndex: null, setIndex: null, field: null },
        inputValue: "",
      };
    }

    case "ADD_EXERCISE_NOTE": {
      const { exerciseId, text } = action;

      // Find the exercise with the matching ID
      const exerciseIndex = state.exercises.findIndex(
        (ex) => ex.id === exerciseId,
      );
      if (exerciseIndex === -1) return state;

      const exercise = state.exercises[exerciseIndex];
      if (!exercise) return state;

      // Create a new note
      const newNote: Note = {
        text,
      };

      // Create updated exercise with new note added
      const updatedExercise: WorkoutExercise = {
        ...exercise,
        notes: [...exercise.notes, newNote],
      };

      // Update the exercises array
      const newExercises = replaceExercise(
        state.exercises,
        exerciseIndex,
        updatedExercise,
      );

      return { ...state, exercises: newExercises };
    }

    case "ADD_WORKOUT_NOTE": {
      const { text } = action;

      // Always create a single note or replace the existing one
      const newNote: Note = { text };

      return {
        ...state,
        notes: [newNote],
      };
    }

    case "UPDATE_NOTES": {
      // For backward compatibility, convert the notes string to a Note object
      const { exerciseId, notes } = action;

      const exerciseIndex = state.exercises.findIndex(
        (ex) => ex.id === exerciseId,
      );
      if (exerciseIndex === -1) return state;

      const exercise = state.exercises[exerciseIndex];
      if (!exercise) return state;

      // Create a new note if text is provided
      let updatedNotes = [...exercise.notes];
      if (notes) {
        // Check if there's already a note, update it instead of adding a new one
        if (updatedNotes.length > 0) {
          const existingNote = updatedNotes[0];
          if (existingNote) {
            updatedNotes[0] = {
              text: notes,
            };
          } else {
            // Fallback if somehow the note is undefined
            updatedNotes[0] = {
              text: notes,
            };
          }
        } else {
          // Create a new note with a definite id
          updatedNotes = [
            {
              text: notes,
            },
          ];
        }
      } else {
        // If notes is empty, clear the notes
        updatedNotes = [];
      }

      // Create updated exercise with notes
      const updatedExercise: WorkoutExercise = {
        ...exercise,
        notes: updatedNotes,
      };

      // Update the exercises array
      const newExercises = replaceExercise(
        state.exercises,
        exerciseIndex,
        updatedExercise,
      );

      return { ...state, exercises: newExercises };
    }

    default: {
      // https://github.com/typescript-eslint/typescript-eslint/issues/6100
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const exhaustiveCheck: never = action;
      return state;
    }
  }
};

// -----------------------  Helper reducers ------------------------------

const replaceSet = (
  arr: WorkoutExercise[],
  exIdx: number,
  setIdx: number,
  newSet: WorkoutSet,
): WorkoutExercise[] => {
  const ex = arr[exIdx];
  if (!ex) return arr;
  const newSets = [...ex.sets];
  newSets[setIdx] = newSet;
  const newEx: WorkoutExercise = { ...ex, sets: newSets };
  return replaceExercise(arr, exIdx, newEx);
};

const replaceExercise = (
  arr: WorkoutExercise[],
  exIdx: number,
  newEx: WorkoutExercise,
): WorkoutExercise[] => {
  const copy = [...arr];
  copy[exIdx] = newEx;
  return copy;
};

export const displayWeight = (
  set: WorkoutSet,
  sets: WorkoutSet[],
  idx: number,
  exercise?: WorkoutExercise,
): number | null => {
  // If bodyweight modifier is active, ALWAYS return the current set's weight value
  if (set.weightModifier === "bodyweight") {
    return set.weight;
  }

  // Return explicit/completed weight
  if (set.weightExplicit || set.completed) return set.weight;

  // Need exercise to estimate
  if (!exercise) return null;

  try {
    // Get estimated weight with error handling
    return estimateSet(sets, idx, exercise).weight;
  } catch (error) {
    console.error("Error estimating weight:", error);
    return null;
  }
};

export const displayReps = (
  set: WorkoutSet,
  sets: WorkoutSet[],
  idx: number,
  exercise?: WorkoutExercise,
): number | null => {
  // Return explicit/completed reps
  if (set.repsExplicit || set.completed) return set.reps;

  // Need exercise to estimate
  if (!exercise) return null;

  try {
    // Get estimated reps with error handling
    return estimateSet(sets, idx, exercise).reps;
  } catch (error) {
    console.error("Error estimating reps:", error);
    return null;
  }
};

// Centralised helper so every input mutation goes through same path
const applyInput = (
  state: Workout,
  newVal: string,
  isFirstInteraction = false,
): Workout => {
  const { activeField, exercises } = state;
  const { exerciseIndex, setIndex, field } = activeField;
  if (exerciseIndex == null || setIndex == null || field == null) return state;
  const ex = exercises[exerciseIndex];
  if (!ex) return state;
  const set = ex.sets[setIndex];
  if (!set) return state;
  const parsed: number | null =
    newVal === "" || newVal === "."
      ? null
      : field === "weight"
        ? parseFloat(newVal)
        : parseInt(newVal, 10);
  const updatedSet: WorkoutSet = {
    ...set,
    [field]: parsed,
    [`${field}Explicit`]: true,
  };
  const newExercises = replaceSet(
    exercises,
    exerciseIndex,
    setIndex,
    updatedSet,
  );
  return {
    ...state,
    exercises: newExercises,
    inputValue: newVal,
    isFirstInteraction,
  };
};

// Handle "Next" navigation (weight ➔ reps ➔ next set/close)
const handleNext = (state: Workout): Workout => {
  const { activeField, exercises } = state;
  const { exerciseIndex, setIndex, field } = activeField;
  if (exerciseIndex == null || setIndex == null || field == null) return state;

  if (field === "weight") {
    // When moving from weight to reps, get the current rep value (explicit or estimated)
    const ex = exercises[exerciseIndex];
    if (!ex) return state;
    const set = ex.sets[setIndex];
    if (!set) return state;

    // Get the rep value to display (either explicit or estimated)
    const repValue = displayReps(set, ex.sets, setIndex, ex);

    return {
      ...state,
      activeField: { exerciseIndex, setIndex, field: "reps" },
      inputValue: repValue?.toString() ?? "",
      isFirstInteraction: true, // Reset to first interaction for the new field
    };
  }

  // if on reps, mark set complete and move focus
  const toggleAction: Action = {
    type: "TOGGLE_COMPLETE",
    exerciseIndex,
    setIndex,
  };
  const toggled = workoutReducer(state, toggleAction); // reuse toggle logic
  const ex = toggled.exercises[exerciseIndex];
  if (!ex) return toggled;
  const nextSetExists = setIndex + 1 < ex.sets.length;

  if (nextSetExists) {
    // If moving to next set, get the weight value for the next set
    const nextSet = ex.sets[setIndex + 1];
    if (!nextSet) return toggled;

    const weightValue = displayWeight(nextSet, ex.sets, setIndex + 1, ex);

    return {
      ...toggled,
      activeField: { exerciseIndex, setIndex: setIndex + 1, field: "weight" },
      inputValue: weightValue?.toString() ?? "",
      isFirstInteraction: true,
    };
  }

  // If it's the last set, close the keyboard
  return {
    ...toggled,
    activeField: { exerciseIndex: null, setIndex: null, field: null },
    inputValue: "",
    isFirstInteraction: false,
  };
};

/**
 * Creates a finalized workout object from the current workout state
 */
export function finalizeWorkout(
  state: Workout,
  workoutName: string,
  workoutNotesText?: string,
  duration?: number,
): CompletedWorkout {
  const completedExercises: CompletedExercise[] = state.exercises
    .map((ex) => {
      const completedSets: CompletedSet[] = ex.sets.map((set, index) => ({
        weight: set.weight,
        reps: set.reps,
        modifier: set.modifier,
        weightModifier: set.weightModifier, // Include weight modifier
        order: index + 1,
        completed: set.completed,
      }));
      // Filter out exercises with no completed sets? Maybe not, keep all attempted.
      // .filter(set => set.completed);

      return {
        id: String(ex.id), // Assuming id is number, convert to string if needed
        name: ex.name,
        sets: completedSets,
        notes: ex.notes, // Keep exercise notes
      };
    })
    // Optionally filter exercises that had no sets attempted/completed
    .filter((ex) => ex.sets.length > 0);

  return {
    name: workoutName,
    date: new Date().toISOString(),
    duration: duration,
    notes: workoutNotesText ? [{ text: workoutNotesText }] : [], // Use provided workout notes
    exercises: completedExercises,
  };
}
