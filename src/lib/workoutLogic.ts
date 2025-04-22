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
}

export interface WorkoutExercise {
  id: number;
  name: string;
  sets: WorkoutSet[];
  previousSets: Array<{
    weight: number | null;
    reps: number | null;
    modifier?: SetModifier;
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
}

// Types for finalized workouts
export interface CompletedSet {
  weight: number | null;
  reps: number | null;
  modifier?: SetModifier;
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
  exercise?: WorkoutExercise, // Add exercise parameter to access previous values
): { weight: number | null; reps: number | null } => {
  const set = sets[setIndex];
  if (!set) return { weight: null, reps: null };

  // For warmup sets
  if (set.modifier === "warmup") {
    // If we have the exercise, use position-based previous values
    if (exercise) {
      const prevData = getPreviousSetData(exercise, set, sets);
      return { weight: prevData.weight, reps: prevData.reps };
    }

    // Find the previous warmup set with the same index relative to all warmup sets
    const warmupSets = sets.filter((s) => s.modifier === "warmup");
    const warmupIndex = warmupSets.findIndex((s) => s.id === set.id);

    // If this is the first warmup set, use its own previous values
    if (warmupIndex === 0 || warmupSets.length === 0) {
      // For warmup sets, we don't apply the progressive overload scheme
      // Just return the previous values without incrementing
      return { weight: set.prevWeight, reps: set.prevReps };
    }

    // Otherwise use values from the previous warmup set
    const prevWarmupSet = warmupSets[warmupIndex - 1];
    if (!prevWarmupSet) {
      return { weight: set.prevWeight, reps: set.prevReps };
    }

    let weight = prevWarmupSet.weightExplicit ? prevWarmupSet.weight : null;
    let reps = prevWarmupSet.repsExplicit ? prevWarmupSet.reps : null;

    // If previous warmup set doesn't have explicit values, use its estimates
    if (weight === null || reps === null) {
      const prevEstimates = estimateSet(
        sets,
        sets.findIndex((s) => s.id === prevWarmupSet.id),
        exercise,
      );
      weight = weight ?? prevEstimates.weight;
      reps = reps ?? prevEstimates.reps;
    }

    return { weight, reps };
  }

  // For working sets
  // Find the first non-warmup set
  const firstWorkingSetIndex = sets.findIndex((s) => s.modifier !== "warmup");
  if (firstWorkingSetIndex === -1) return { weight: null, reps: null };

  const firstWorkingSet = sets[firstWorkingSetIndex];
  if (!firstWorkingSet) return { weight: null, reps: null };

  // If this is the first working set, use progression on its previous values
  if (set.id === firstWorkingSet.id) {
    if (exercise) {
      const prevData = getPreviousSetData(exercise, set, sets);
      return nextProgression(prevData.weight, prevData.reps);
    }
    return nextProgression(set.prevWeight, set.prevReps);
  }

  // For subsequent working sets, cascade from the first working set
  let weight: number | null = firstWorkingSet.weightExplicit
    ? firstWorkingSet.weight
    : exercise
      ? nextProgression(
          getPreviousSetData(exercise, firstWorkingSet, sets).weight,
          getPreviousSetData(exercise, firstWorkingSet, sets).reps,
        ).weight
      : nextProgression(firstWorkingSet.prevWeight, firstWorkingSet.prevReps)
          .weight;

  let reps: number | null = firstWorkingSet.repsExplicit
    ? firstWorkingSet.reps
    : exercise
      ? nextProgression(
          getPreviousSetData(exercise, firstWorkingSet, sets).weight,
          getPreviousSetData(exercise, firstWorkingSet, sets).reps,
        ).reps
      : nextProgression(firstWorkingSet.prevWeight, firstWorkingSet.prevReps)
          .reps;

  // Apply any explicit overrides from working sets (skip warmup sets)
  const workingSets = sets.filter((s) => s.modifier !== "warmup");
  const currentWorkingIndex = workingSets.findIndex((s) => s.id === set.id);

  for (let i = 0; i < currentWorkingIndex; i++) {
    const workingSet = workingSets[i];
    if (!workingSet) continue;

    if (workingSet.weightExplicit) weight = workingSet.weight;
    if (workingSet.repsExplicit) reps = workingSet.reps;
  }

  return { weight, reps };
};

/** Build initial Exercise[] from prior workout snapshots */
export const initialiseExercises = (
  previous: {
    name: string;
    sets: Array<{
      weight: number | null;
      reps: number | null;
      isWarmup?: boolean;
    }>;
  }[],
): WorkoutExercise[] =>
  previous.map((ex, i) => ({
    id: i + 1,
    name: ex.name,
    sets: ex.sets.map((s, idx) => ({
      id: idx + 1,
      weight: null,
      reps: null,
      completed: false,
      weightExplicit: false,
      repsExplicit: false,
      prevWeight: s.weight,
      prevReps: s.reps,
      modifier: s.isWarmup ? "warmup" : undefined,
    })),
    // Store previous workout data separately
    previousSets: ex.sets.map((s) => ({
      weight: s.weight,
      reps: s.reps,
      modifier: s.isWarmup ? "warmup" : undefined,
    })),
    notes: [], // Initialize with empty notes array
  }));

/**
 * Get previous workout data for a set based on its position
 * This considers whether it's a warmup or working set
 */
export const getPreviousSetData = (
  exercise: WorkoutExercise,
  set: WorkoutSet,
  sets: WorkoutSet[],
): { weight: number | null; reps: number | null } => {
  // For this function, we need to determine position in a way that's stable
  // even if other sets are deleted

  if (set.modifier === "warmup") {
    // For warmup sets, count position among warmup sets
    const warmupSets = sets.filter((s) => s.modifier === "warmup");
    const warmupIndex = warmupSets.findIndex((s) => s.id === set.id);

    // Find corresponding warmup set in previous workout
    const prevWarmupSets = exercise.previousSets.filter(
      (s) => s.modifier === "warmup",
    );
    const prevWarmupSet = prevWarmupSets[warmupIndex];

    if (prevWarmupSet) {
      return {
        weight: prevWarmupSet.weight,
        reps: prevWarmupSet.reps,
      };
    }
  } else {
    // For working sets, count position among working sets
    const workingSets = sets.filter((s) => s.modifier !== "warmup");
    const workingIndex = workingSets.findIndex((s) => s.id === set.id);

    // Find corresponding working set in previous workout
    const prevWorkingSets = exercise.previousSets.filter(
      (s) => s.modifier !== "warmup",
    );
    const prevWorkingSet = prevWorkingSets[workingIndex];

    if (prevWorkingSet) {
      return {
        weight: prevWorkingSet.weight,
        reps: prevWorkingSet.reps,
      };
    }
  }

  // Fallback to the values stored in the set (backward compatibility)
  return { weight: set.prevWeight, reps: set.prevReps };
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
  | { type: "NEXT" }
  | { type: "TOGGLE_COMPLETE"; exerciseIndex: number; setIndex: number }
  | { type: "TOGGLE_WARMUP"; exerciseIndex: number; setIndex: number }
  | { type: "DELETE_SET"; exerciseIndex: number; setIndex: number }
  | { type: "ADD_SET"; exerciseIndex: number }
  | { type: "NAV_EXERCISE"; direction: 1 | -1 }
  | { type: "COLLAPSE_KEYBOARD" }
  | { type: "ADD_EXERCISE_NOTE"; exerciseId: number; text: string }
  | { type: "ADD_WORKOUT_NOTE"; text: string }
  | { type: "UPDATE_NOTES"; exerciseId: number; notes: string };

// --------------------------- Reducer -----------------------------------

export const workoutReducer = (state: Workout, action: Action): Workout => {
  switch (action.type) {
    case "FOCUS_FIELD": {
      const { exerciseIndex, setIndex, field } = action;
      const ex = state.exercises[exerciseIndex];
      if (!ex) return state;
      const set = ex.sets[setIndex];
      if (!set) return state;
      const display =
        field === "weight"
          ? displayWeight(set, ex.sets, setIndex, ex)
          : displayReps(set, ex.sets, setIndex, ex);
      return {
        ...state,
        activeField: { exerciseIndex, setIndex, field },
        inputValue: display?.toString() ?? "",
        isFirstInteraction: true,
      };
    }

    case "INPUT_DIGIT": {
      if (state.activeField.field == null) return state;

      // If this is the first interaction, replace the input value instead of appending
      const newVal = state.isFirstInteraction
        ? action.value
        : state.inputValue === "0"
          ? action.value
          : state.inputValue + action.value;

      return applyInput(state, newVal, false); // Pass false to keep isFirstInteraction=false after input
    }

    case "BACKSPACE": {
      if (state.activeField.field == null) return state;

      // If this is the first interaction, clear the entire value
      if (state.isFirstInteraction) {
        return applyInput(state, "", false);
      }

      // Otherwise delete one character at a time
      const newVal = state.inputValue.slice(0, -1);
      return applyInput(state, newVal, false);
    }

    case "PLUS_MINUS": {
      if (state.activeField.field !== "weight") return state;
      const cur = parseFloat(state.inputValue || "0");
      const next = roundToStep(cur + action.sign * WEIGHT_STEP);
      return applyInput(state, next.toString(), false);
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
        id: Date.now(),
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
        const now = new Date().toISOString();
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

    default:
      return state;
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
): number | null =>
  set.weightExplicit || set.completed
    ? set.weight
    : estimateSet(sets, idx, exercise).weight;

export const displayReps = (
  set: WorkoutSet,
  sets: WorkoutSet[],
  idx: number,
  exercise?: WorkoutExercise,
): number | null =>
  set.repsExplicit || set.completed
    ? set.reps
    : estimateSet(sets, idx, exercise).reps;

// Centralised helper so every input mutation goes through same path
const applyInput = (
  state: Workout,
  newVal: string,
  isFirstInteraction = false,
): Workout => {
  const { exerciseIndex, setIndex, field } = state.activeField;
  if (exerciseIndex == null || setIndex == null || field == null) return state;
  const ex = state.exercises[exerciseIndex];
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
    state.exercises,
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
  const { exerciseIndex, setIndex, field } = state.activeField;
  if (exerciseIndex == null || setIndex == null || field == null) return state;

  if (field === "weight") {
    // When moving from weight to reps, get the current rep value (explicit or estimated)
    const ex = state.exercises[exerciseIndex];
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
  notes?: string,
  duration?: number,
): CompletedWorkout {
  const now = new Date();

  // Create a note from the provided notes string if available
  const workoutNotes: Note[] = notes
    ? [
        {
          text: notes,
        },
      ]
    : [];

  return {
    name: workoutName,
    date: now.toISOString(),
    notes: [...state.notes, ...workoutNotes],
    duration,
    exercises: state.exercises
      .map((exercise) => ({
        name: exercise.name,
        notes: exercise.notes,
        sets: exercise.sets
          .filter((set) => set.completed)
          .map((set, index) => ({
            weight: set.weight,
            reps: set.reps,
            completed: set.completed,
            order: index,
            modifier: set.modifier,
          })),
      }))
      .filter((exercise) => exercise.sets.length > 0), // Only include exercises with completed sets
  };
}
