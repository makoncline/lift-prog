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

import { summarizeWorkingSets } from "@/lib/workout-summary";

// -----------------------------  Types  ---------------------------------

export type SetModifier = "warmup";
export type WeightModifier = "bodyweight"; // New type for weight modifier
export type SetRestType = "standard" | "short";

export interface Note {
  text: string;
}

export interface WorkoutSet {
  weight: number | null; // lb
  reps: number | null;
  completed: boolean;
  weightExplicit: boolean;
  repsExplicit: boolean;
  prevWeight: number | null;
  prevReps: number | null;
  modifier?: SetModifier;
  weightModifier?: WeightModifier; // Added weight modifier field
  restBefore?: SetRestType;
  notes?: string;
  rir?: number | null;
}

export interface WorkoutExercise {
  name: string;
  sets: WorkoutSet[];
  previousSets: Array<{
    weight: number | null;
    reps: number | null;
    modifier?: SetModifier;
    weightModifier?: WeightModifier; // Ensure consistency if loading previous data
    restBefore?: SetRestType;
    notes?: string | null;
    rir?: number | null;
  }>;
  history?: Array<{
    relation: string;
    relativeDate: string;
    date: string;
    workoutNote?: string | null;
    workoutExerciseNote?: string | null;
    exerciseNotesSnapshot?: string | null;
    sets: Array<{
      weight: number | null;
      reps: number | null;
      modifier?: SetModifier;
      weightModifier?: WeightModifier;
      restBefore?: SetRestType;
      notes?: string | null;
    }>;
  }>;
  previousSummary?: string;
  previousNotes?: string;
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

// ---------------------------  Constants  -------------------------------

export const MIN_REPS = 8;
export const MAX_REPS = 12;
export const ONE_RM_INCREMENT = 0; // lb added to est. 1RM when progressing
export const WEIGHT_STEP = 2.5; // lb, smallest plate increment

// ----------------------  Pure helper functions  ------------------------

const makeCompletedSet = ({
  weight,
  reps,
  modifier,
  weightModifier,
  restBefore,
  notes,
}: {
  weight: number | null;
  reps: number | null;
  modifier?: SetModifier;
  weightModifier?: WeightModifier;
  restBefore?: SetRestType;
  notes?: string;
}): WorkoutSet => ({
  weight,
  reps,
  completed: weight !== null && reps !== null,
  weightExplicit: weight !== null,
  repsExplicit: reps !== null,
  prevWeight: null,
  prevReps: null,
  ...(modifier ? { modifier } : {}),
  ...(weightModifier ? { weightModifier } : {}),
  ...(restBefore ? { restBefore } : {}),
  ...(notes ? { notes } : {}),
});

const parseRepToken = (
  token: string,
): Array<{ reps: number; restBefore?: SetRestType; notes?: string }> => {
  const parts = token.split("+").map((part) => part.trim()).filter(Boolean);
  return parts.flatMap((part, index) => {
    const match = part.match(/^(\d+)(?:\(([^)]+)\)|([a-zA-Z]+))?$/);
    if (!match) return [];
    return {
      reps: Number(match[1]),
      ...(index > 0 ? { restBefore: "short" as const } : {}),
      ...((match[2] ?? match[3])
        ? { notes: (match[2] ?? match[3])!.trim() }
        : {}),
    };
  });
};

const parseWeightedGroup = (
  group: string,
): { weight: number; repsText: string; explicitWarmup: boolean } | null => {
  const match = group.match(/^(W)?(\d+(?:\.\d+)?)(?:lb)?x(.+)$/i);
  if (!match) return null;
  return {
    weight: Number(match[2]),
    repsText: match[3]!,
    explicitWarmup: Boolean(match[1]),
  };
};

export function parseQuickSetLine(
  line: string,
  options: { bodyweight?: boolean } = {},
): WorkoutSet[] {
  const trimmedLine = line.trim();
  const explicitBodyweight = /^bw(?:\s|[+-]?\d|x|$)/i.test(trimmedLine);
  const compact = trimmedLine.replace(/^bw\s*/i, "").replace(/\s+/g, "");
  if (!compact) return [];

  if (
    (options.bodyweight || explicitBodyweight) &&
    (explicitBodyweight || !/^W?[+-]?\d+(?:\.\d+)?(?:lb)?x/i.test(compact)) &&
    !compact.includes("-")
  ) {
    let currentWeight = 0;
    return compact
      .split(",")
      .filter(Boolean)
      .flatMap((group) => {
        const weighted = group.match(/^([+-]?\d+(?:\.\d+)?)(?:lb)?x(.+)$/i);
        if (weighted) currentWeight = Number(weighted[1]);
        const repsText = weighted ? weighted[2]! : group;
        return parseRepToken(repsText).map((rep) =>
          makeCompletedSet({
            weight: currentWeight,
            reps: rep.reps,
            weightModifier: "bodyweight",
            restBefore: rep.restBefore,
            notes: rep.notes,
          }),
        );
      });
  }

  const groups = compact
    .replace(/\s*-\s*/g, "-")
    .split("-")
    .filter(Boolean)
    .map((hyphenGroup) =>
      hyphenGroup
        .split(";")
        .filter(Boolean)
        .map(parseWeightedGroup)
        .filter((group): group is NonNullable<typeof group> => Boolean(group)),
    );

  return groups.flatMap((hyphenGroup, groupIndex) => {
    const hyphenGroupIsWarmup = groupIndex < groups.length - 1;
    return hyphenGroup.flatMap((group) => {
      const isWarmup = group.explicitWarmup || hyphenGroupIsWarmup;
      return group.repsText
        .split(",")
        .filter(Boolean)
        .flatMap((token) =>
          parseRepToken(token).map((rep) =>
            makeCompletedSet({
              weight: group.weight,
              reps: rep.reps,
              modifier: isWarmup ? "warmup" : undefined,
              restBefore: rep.restBefore,
              notes: rep.notes,
            }),
          ),
        );
    });
  });
}

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
  prevWeightModifier?: WeightModifier,
): {
  weight: number | null;
  reps: number | null;
  weightModifier?: WeightModifier;
} => {
  if (prevWeight == null || prevReps == null)
    return { weight: null, reps: null, weightModifier: prevWeightModifier };
  if (prevReps >= MAX_REPS) {
    // Calculate the base 1RM increment
    let rmIncrement = ONE_RM_INCREMENT;

    // For bodyweight exercises, adjust increment direction based on weight sign
    if (prevWeightModifier === "bodyweight" && prevWeight !== 0) {
      // If weight is negative (resistance), we want to make it more negative (remove weight)
      // If weight is positive (assistance), we want to make it more positive (add weight)
      // Since ONE_RM_INCREMENT is negative (-5), we need to flip the sign for negative weights
      if (prevWeight < 0) {
        rmIncrement = -ONE_RM_INCREMENT; // Makes it positive, which adds to a negative 1RM
      }
      // For positive weights, keep the negative increment to add more resistance
    }

    const new1RM = estimate1RM(prevWeight, prevReps) + rmIncrement;
    const targetWeight = roundToStep((new1RM * (37 - MIN_REPS)) / 36);
    return {
      weight: targetWeight,
      reps: MIN_REPS,
      weightModifier: prevWeightModifier,
    };
  }
  return {
    weight: prevWeight,
    reps: prevReps + 1,
    weightModifier: prevWeightModifier,
  };
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
): {
  weight: number | null;
  reps: number | null;
  weightModifier?: WeightModifier;
} => {
  const set = sets[setIndex];
  if (!set) return { weight: null, reps: null, weightModifier: undefined };

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
        weightModifier: prevWarmup?.weightModifier,
      };
    }

    // Fallback to current set's prev values
    return {
      weight: set.prevWeight,
      reps: set.prevReps,
      weightModifier: set.weightModifier,
    };
  }

  // For working sets
  const workingSets = sets.filter((s) => s.modifier !== "warmup");
  const workingIdx = workingSets.findIndex((s) => s === set);

  if (workingIdx === -1)
    return { weight: null, reps: null, weightModifier: undefined };

  // SIMPLIFIED APPROACH: For any set after the first, directly inherit from the previous set
  if (workingIdx > 0) {
    // Get the previous working set
    const previousWorkingSet = workingSets[workingIdx - 1];

    // If the previous set has explicit values, use them as our base
    if (previousWorkingSet) {
      const baseWeight = previousWorkingSet.weightExplicit
        ? previousWorkingSet.weight
        : null;
      const baseReps = previousWorkingSet.repsExplicit
        ? previousWorkingSet.reps
        : null;

      // ALWAYS inherit the weightModifier from the previous set if we're not the first working set
      const baseWeightModifier = previousWorkingSet.weightModifier;

      // If previous set doesn't have explicit values, fall back to estimation
      if (baseWeight === null || baseReps === null) {
        // Find the previous set's index in the original sets array
        const prevSetIndex = sets.findIndex((s) => s === previousWorkingSet);
        if (prevSetIndex !== -1) {
          const prevEstimate = estimateSet(sets, prevSetIndex, exercise);

          return {
            weight: baseWeight ?? prevEstimate.weight ?? set.prevWeight,
            reps: baseReps ?? prevEstimate.reps ?? set.prevReps,
            weightModifier: baseWeightModifier,
          };
        }
      }

      // Direct inheritance from previous set
      return {
        weight: baseWeight ?? set.prevWeight,
        reps: baseReps ?? set.prevReps,
        weightModifier: baseWeightModifier,
      };
    }
  }

  // First working set - use progression from previous workout
  if (workingIdx === 0) {
    const prevFirstWorkingSet = exercise.previousSets.find(
      (s) => s.modifier !== "warmup",
    ) ?? {
      weight: null,
      reps: null,
      weightModifier: undefined,
    };

    // Use next progression for first working set if we have previous data
    const progression = nextProgression(
      prevFirstWorkingSet.weight,
      prevFirstWorkingSet.reps,
      prevFirstWorkingSet.weightModifier,
    );

    // If progression gives null values (no previous data), fall back to template values
    return {
      weight: progression.weight ?? set.prevWeight,
      reps: progression.reps ?? set.prevReps,
      weightModifier: progression.weightModifier ?? set.weightModifier,
    };
  }

  // For subsequent working sets, cascade from earlier sets in this workout
  let baseWeight = null;
  let baseReps = null;
  let baseWeightModifier: WeightModifier | undefined = undefined;

  // First try to get values from the first working set of this workout
  const firstWorkingSet = workingSets[0];
  if (firstWorkingSet) {
    // If first set has explicit values, use them
    if (firstWorkingSet.weightExplicit) {
      baseWeight = firstWorkingSet.weight;
      baseWeightModifier = firstWorkingSet.weightModifier;
    } else {
      // Otherwise use estimated values from first working set
      const firstEstimate = estimateSet(
        sets,
        sets.indexOf(firstWorkingSet),
        exercise,
      );
      baseWeight = firstEstimate.weight;
      baseWeightModifier = firstEstimate.weightModifier;
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
      baseWeightModifier = earlierSet.weightModifier;
    }
    if (earlierSet?.repsExplicit) {
      baseReps = earlierSet.reps;
    }
  }

  // Specifically check for the first working set's weightModifier
  // If the user has explicitly removed a bodyweight modifier from the first set,
  // that removal should cascade to all subsequent sets
  const firstWorkingSetIdx = workingSets.findIndex((s) => s !== undefined);
  if (firstWorkingSetIdx !== -1) {
    const firstSet = workingSets[firstWorkingSetIdx];
    if (firstSet?.weightExplicit) {
      // If the first set had its modifier explicitly removed, cascade that removal
      baseWeightModifier = firstSet.weightModifier;
    }
  }

  // If we couldn't establish base values from earlier sets,
  // try using the corresponding set from previous workout
  if (baseWeight === null || baseReps === null) {
    const prevWorkingSet = exercise.previousSets.filter(
      (s) => s.modifier !== "warmup",
    )[workingIdx];
    if (prevWorkingSet) {
      baseWeight ??= prevWorkingSet.weight;
      baseReps ??= prevWorkingSet.reps;
      baseWeightModifier ??= prevWorkingSet.weightModifier;
    }
  }

  // Final fallback to the set's own prev values
  baseWeight ??= set.prevWeight;
  baseReps ??= set.prevReps;
  baseWeightModifier ??= set.weightModifier;

  // Special handling for weight values with bodyweight modifier
  // If we're cascading a bodyweight modifier and weight is null/0, look for a better value
  if (
    baseWeightModifier === "bodyweight" &&
    (baseWeight === null || baseWeight === 0)
  ) {
    // First, check previous working sets from this workout for a better bodyweight value
    for (let i = 0; i < workingIdx; i++) {
      const earlierSet = workingSets[i];
      if (
        earlierSet?.weightModifier === "bodyweight" &&
        earlierSet?.weight !== null &&
        earlierSet?.weight !== 0
      ) {
        baseWeight = earlierSet.weight;
        break;
      }
    }

    // If still no value, check the previous workout's bodyweight values
    if (baseWeight === null || baseWeight === 0) {
      for (const prevSet of exercise.previousSets.filter(
        (s) => s.modifier !== "warmup",
      )) {
        if (
          prevSet.weightModifier === "bodyweight" &&
          prevSet.weight !== null &&
          prevSet.weight !== 0
        ) {
          baseWeight = prevSet.weight;
          break;
        }
      }
    }
  }

  return {
    weight: baseWeight,
    reps: baseReps,
    weightModifier: baseWeightModifier,
  };
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
      restBefore?: SetRestType;
      notes?: string | null;
      rir?: number | null;
    }>;
    exerciseNotes?: string | null;
    notes?: string | null;
    exerciseNotesSnapshot?: string | null;
    history?: WorkoutExercise["history"];
  }[],
): WorkoutExercise[] =>
  previous.map((ex) => {
    const normalizedSets = ex.sets.map((s) => ({
      weight: s.weight,
      reps: s.reps,
      modifier: s.modifier ?? (s.isWarmup ? "warmup" : undefined),
      weightModifier: s.weightModifier,
      restBefore: s.restBefore,
      notes: s.notes,
      rir: s.rir,
    }));

    const previousSummary = summarizeWorkingSets(ex.name, normalizedSets);
    const previousNotes = ex.notes ?? undefined;

    return {
      name: ex.name,
      sets: ex.sets.map((s) => {
        const modifier = s.modifier ?? (s.isWarmup ? "warmup" : undefined);
        const isPrevBodyweight = s.weightModifier === "bodyweight";
        return {
          weight: isPrevBodyweight ? s.weight : null,
          reps: null,
          completed: false,
          weightExplicit: false,
          repsExplicit: false,
          prevWeight: s.weight,
          prevReps: s.reps,
          modifier,
          weightModifier: s.weightModifier,
          restBefore: s.restBefore,
          notes: s.notes ?? undefined,
          rir: s.rir,
        };
      }),
      previousSets: normalizedSets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        modifier: s.modifier,
        weightModifier: s.weightModifier,
        restBefore: s.restBefore,
        notes: s.notes,
        rir: s.rir,
      })),
      history: ex.history,
      previousSummary,
      previousNotes,
      notes: [],
    } satisfies WorkoutExercise;
  });

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
  | {
      type: "REPLACE_EXERCISE_SETS";
      exerciseIndex: number;
      sets: WorkoutSet[];
    }
  | {
      type: "UPDATE_SET_NOTE";
      exerciseIndex: number;
      setIndex: number;
      notes: string;
    }
  | {
      type: "UPDATE_SET_RIR";
      exerciseIndex: number;
      setIndex: number;
      rir: number | null;
    }
  | {
      type: "SET_REST_BEFORE";
      exerciseIndex: number;
      setIndex: number;
      restBefore: SetRestType | undefined;
    }
  | {
      type: "UPDATE_SET_WEIGHT";
      exerciseIndex: number;
      setIndex: number;
      weight: number | null;
    }
  | {
      type: "UPDATE_SET_REPS";
      exerciseIndex: number;
      setIndex: number;
      reps: number | null;
    }
  | {
      type: "APPLY_QUICK_SET_LINE";
      exerciseIndex: number;
      line: string;
    }
  | { type: "ADD_EXERCISE"; exercise: WorkoutExercise }
  | { type: "DELETE_EXERCISE"; exerciseIndex: number }
  | {
      type: "MOVE_EXERCISE";
      exerciseIndex: number;
      direction: 1 | -1;
    }
  | {
      type: "MOVE_EXERCISE_TO";
      exerciseIndex: number;
      targetIndex: number;
    }
  | { type: "NAV_EXERCISE"; direction: 1 | -1 }
  | { type: "COLLAPSE_KEYBOARD" }
  | { type: "ADD_EXERCISE_NOTE"; exerciseIndex: number; text: string }
  | { type: "ADD_WORKOUT_NOTE"; text: string }
  | { type: "UPDATE_NOTES"; exerciseIndex: number; notes: string }
  | {
      type: "UPDATE_EXERCISE_NOTE";
      exerciseIndex: number;
      noteIndex: number;
      text: string;
    }
  | { type: "DELETE_EXERCISE_NOTE"; exerciseIndex: number; noteIndex: number }
  | {
      type: "REORDER_EXERCISE_NOTES";
      exerciseIndex: number;
      fromIndex: number;
      toIndex: number;
    }
  | { type: "UPDATE_WORKOUT_NOTE"; noteIndex: number; text: string }
  | { type: "DELETE_WORKOUT_NOTE"; noteIndex: number }
  | { type: "REORDER_WORKOUT_NOTES"; fromIndex: number; toIndex: number }
  | { type: "UPDATE_WORKOUT_NAME"; name: string }
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
    case "UPDATE_WORKOUT_NAME":
      return {
        ...state,
        name: action.name,
      };
    case "FOCUS_FIELD": {
      const { exerciseIndex, setIndex, field } = action;
      const ex = state.exercises[exerciseIndex];
      if (!ex) return state;
      const set = ex.sets[setIndex];
      if (!set) return state;

      let initialValue = "";
      if (field === "weight") {
        let weightValue: number | null = set.weight;
        if (weightValue === null && !set.weightExplicit) {
          const { weight, weightModifier } = displayWeight(
            set,
            ex.sets,
            setIndex,
            ex,
          );
          weightValue = weight;
          if (weightModifier) {
            const newSet: WorkoutSet = { ...set, weightModifier };
            const newExercises = replaceSet(
              state.exercises,
              exerciseIndex,
              setIndex,
              newSet,
            );
            // This is a bit of a hack, but we need to update the state here
            // so that the rest of the function has the correct weightModifier.
            // A deeper refactor might be needed to avoid this.
            state = { ...state, exercises: newExercises };
          }
        }

        if (set.weightModifier === "bodyweight") {
          initialValue = weightValue !== null ? String(weightValue) : "0";
        } else {
          initialValue = weightValue !== null ? String(weightValue) : "";
        }
      } else if (field === "reps") {
        let repsValue: number | null = set.reps;
        if (repsValue === null && !set.repsExplicit) {
          repsValue = displayReps(set, ex.sets, setIndex, ex);
        }
        initialValue = repsValue !== null ? String(repsValue) : "";
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
      if (!activeSet || activeField.field == null) return state;

      if (activeField.field === "weight") {
        const currentVal = parseFloat(state.inputValue) || 0;
        const step = action.sign * WEIGHT_STEP;
        const newVal = String(roundToStep(currentVal + step));
        return applyInput(state, newVal, true);
      }

      if (activeField.field === "reps") {
        const currentVal = parseInt(state.inputValue, 10) || 0;
        const step = action.sign;
        const newVal = String(Math.max(currentVal + step, 0));
        return applyInput(state, newVal, true);
      }

      return state;
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

      // Create a new sets array without the toggled set
      const otherSets = ex.sets.filter((_, i) => i !== setIndex);

      // Create new sorted lists of warmup and working sets
      const warmups = [
        ...otherSets.filter((s) => s.modifier === "warmup"),
        ...(updatedSet.modifier === "warmup" ? [updatedSet] : []),
      ];

      const working = [
        ...otherSets.filter((s) => s.modifier !== "warmup"),
        ...(updatedSet.modifier !== "warmup" ? [updatedSet] : []),
      ];

      // Combine the sorted lists
      const newSets = [...warmups, ...working];

      const newEx: WorkoutExercise = { ...ex, sets: newSets };
      const newExercises = replaceExercise(
        state.exercises,
        exerciseIndex,
        newEx,
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

      const lastSet =
        exPrev.sets.length > 0
          ? exPrev.sets[exPrev.sets.length - 1]
          : undefined;

      const newSet: WorkoutSet = {
        weight: null,
        reps: null,
        completed: false,
        weightExplicit: false,
        repsExplicit: false,
        prevWeight: null,
        prevReps: null,
        modifier: undefined,
        weightModifier: lastSet?.weightModifier,
      };
      const updatedExercise: WorkoutExercise = {
        ...exPrev,
        sets: [...exPrev.sets, newSet],
      };
      const newSetIndex = updatedExercise.sets.length - 1;
      const newExercises = replaceExercise(
        state.exercises,
        exerciseIndex,
        updatedExercise,
      );
      return {
        ...state,
        exercises: newExercises,
        activeField: { exerciseIndex, setIndex: newSetIndex, field: "weight" },
        inputValue: "",
        isFirstInteraction: true,
      };
    }

    case "REPLACE_EXERCISE_SETS": {
      const { exerciseIndex, sets } = action;
      const exercise = state.exercises[exerciseIndex];
      if (!exercise) return state;

      return {
        ...state,
        exercises: replaceExercise(state.exercises, exerciseIndex, {
          ...exercise,
          sets,
        }),
        activeField: { exerciseIndex: null, setIndex: null, field: null },
        inputValue: "",
        isFirstInteraction: false,
      };
    }

    case "UPDATE_SET_NOTE": {
      const { exerciseIndex, setIndex, notes } = action;
      const ex = state.exercises[exerciseIndex];
      const set = ex?.sets[setIndex];
      if (!ex || !set) return state;
      const updatedSet: WorkoutSet = {
        ...set,
        notes: notes.trim() ? notes : undefined,
      };
      return {
        ...state,
        exercises: replaceSet(state.exercises, exerciseIndex, setIndex, updatedSet),
      };
    }

    case "UPDATE_SET_RIR": {
      const { exerciseIndex, setIndex, rir } = action;
      const ex = state.exercises[exerciseIndex];
      const set = ex?.sets[setIndex];
      if (!ex || !set) return state;
      const updatedSet: WorkoutSet = { ...set, rir };
      return {
        ...state,
        exercises: replaceSet(state.exercises, exerciseIndex, setIndex, updatedSet),
      };
    }

    case "SET_REST_BEFORE": {
      const { exerciseIndex, setIndex, restBefore } = action;
      const ex = state.exercises[exerciseIndex];
      const set = ex?.sets[setIndex];
      if (!ex || !set) return state;
      const updatedSet: WorkoutSet = { ...set, restBefore };
      return {
        ...state,
        exercises: replaceSet(state.exercises, exerciseIndex, setIndex, updatedSet),
      };
    }

    case "UPDATE_SET_WEIGHT": {
      const { exerciseIndex, setIndex, weight } = action;
      const ex = state.exercises[exerciseIndex];
      const set = ex?.sets[setIndex];
      if (!ex || !set) return state;
      const updatedSet: WorkoutSet = {
        ...set,
        weight,
        weightExplicit: weight !== null,
        completed: weight !== null && set.reps !== null ? true : set.completed,
      };
      return {
        ...state,
        exercises: replaceSet(state.exercises, exerciseIndex, setIndex, updatedSet),
      };
    }

    case "UPDATE_SET_REPS": {
      const { exerciseIndex, setIndex, reps } = action;
      const ex = state.exercises[exerciseIndex];
      const set = ex?.sets[setIndex];
      if (!ex || !set) return state;
      const updatedSet: WorkoutSet = {
        ...set,
        reps,
        repsExplicit: reps !== null,
        completed: set.weight !== null && reps !== null ? true : set.completed,
      };
      return {
        ...state,
        exercises: replaceSet(state.exercises, exerciseIndex, setIndex, updatedSet),
      };
    }

    case "APPLY_QUICK_SET_LINE": {
      const { exerciseIndex, line } = action;
      const ex = state.exercises[exerciseIndex];
      if (!ex) return state;
      const parsedSets = parseQuickSetLine(line, {
        bodyweight:
          ex.sets.some((set) => set.weightModifier === "bodyweight") ||
          ex.previousSets.some((set) => set.weightModifier === "bodyweight"),
      });
      if (parsedSets.length === 0) return state;
      return {
        ...state,
        exercises: replaceExercise(state.exercises, exerciseIndex, {
          ...ex,
          sets: parsedSets,
        }),
        activeField: { exerciseIndex: null, setIndex: null, field: null },
        inputValue: "",
      };
    }

    case "ADD_EXERCISE": {
      return {
        ...state,
        exercises: [...state.exercises, action.exercise],
        currentExerciseIndex: state.exercises.length,
      };
    }

    case "DELETE_EXERCISE": {
      const { exerciseIndex } = action;
      if (exerciseIndex < 0 || exerciseIndex >= state.exercises.length) {
        return state;
      }

      const nextExercises = state.exercises.filter(
        (_, index) => index !== exerciseIndex,
      );
      const activeField =
        state.activeField.exerciseIndex === exerciseIndex
          ? { exerciseIndex: null, setIndex: null, field: null }
          : state.activeField.exerciseIndex != null &&
              state.activeField.exerciseIndex > exerciseIndex
            ? {
                ...state.activeField,
                exerciseIndex: state.activeField.exerciseIndex - 1,
              }
            : state.activeField;

      return {
        ...state,
        exercises: nextExercises,
        currentExerciseIndex: Math.min(
          state.currentExerciseIndex,
          Math.max(0, nextExercises.length - 1),
        ),
        activeField,
        inputValue: activeField.exerciseIndex == null ? "" : state.inputValue,
      };
    }

    case "MOVE_EXERCISE": {
      const { exerciseIndex, direction } = action;
      const targetIndex = exerciseIndex + direction;
      if (
        exerciseIndex < 0 ||
        targetIndex < 0 ||
        exerciseIndex >= state.exercises.length ||
        targetIndex >= state.exercises.length
      ) {
        return state;
      }

      const nextExercises = [...state.exercises];
      const moving = nextExercises[exerciseIndex];
      const target = nextExercises[targetIndex];
      if (!moving || !target) return state;
      nextExercises[exerciseIndex] = target;
      nextExercises[targetIndex] = moving;

      const activeField =
        state.activeField.exerciseIndex === exerciseIndex
          ? { ...state.activeField, exerciseIndex: targetIndex }
          : state.activeField.exerciseIndex === targetIndex
            ? { ...state.activeField, exerciseIndex }
            : state.activeField;

      return {
        ...state,
        exercises: nextExercises,
        currentExerciseIndex:
          state.currentExerciseIndex === exerciseIndex
            ? targetIndex
            : state.currentExerciseIndex === targetIndex
              ? exerciseIndex
              : state.currentExerciseIndex,
        activeField,
      };
    }

    case "MOVE_EXERCISE_TO": {
      const { exerciseIndex, targetIndex } = action;
      if (
        exerciseIndex < 0 ||
        targetIndex < 0 ||
        exerciseIndex >= state.exercises.length ||
        targetIndex >= state.exercises.length ||
        exerciseIndex === targetIndex
      ) {
        return state;
      }

      const nextExercises = [...state.exercises];
      const [moving] = nextExercises.splice(exerciseIndex, 1);
      if (!moving) return state;
      nextExercises.splice(targetIndex, 0, moving);

      const remapIndex = (index: number) => {
        if (index === exerciseIndex) return targetIndex;
        if (exerciseIndex < targetIndex && index > exerciseIndex && index <= targetIndex) {
          return index - 1;
        }
        if (exerciseIndex > targetIndex && index >= targetIndex && index < exerciseIndex) {
          return index + 1;
        }
        return index;
      };

      const activeField =
        state.activeField.exerciseIndex == null
          ? state.activeField
          : {
              ...state.activeField,
              exerciseIndex: remapIndex(state.activeField.exerciseIndex),
            };

      return {
        ...state,
        exercises: nextExercises,
        currentExerciseIndex: remapIndex(state.currentExerciseIndex),
        activeField,
      };
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
      const { exerciseIndex, text } = action;

      const exercise = state.exercises[exerciseIndex];
      if (!exercise) return state;

      const newNote: Note = {
        text,
      };

      const updatedExercise: WorkoutExercise = {
        ...exercise,
        notes: [...exercise.notes, newNote],
      };

      const newExercises = replaceExercise(
        state.exercises,
        exerciseIndex,
        updatedExercise,
      );

      return { ...state, exercises: newExercises };
    }

    case "ADD_WORKOUT_NOTE": {
      const { text } = action;
      const newNote: Note = { text };
      return {
        ...state,
        notes: [...state.notes, newNote],
      };
    }

    case "UPDATE_NOTES": {
      // For backward compatibility, convert the notes string to a Note object
      const { exerciseIndex, notes } = action;

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

    case "UPDATE_EXERCISE_NOTE": {
      const { exerciseIndex, noteIndex, text } = action;
      const exercise = state.exercises[exerciseIndex];
      if (!exercise) return state;
      const updatedNotes: Note[] = exercise.notes.map((n, i) =>
        i === noteIndex ? { text } : n,
      );
      const updatedExercise: WorkoutExercise = {
        ...exercise,
        notes: updatedNotes,
      };
      const newExercises = replaceExercise(
        state.exercises,
        exerciseIndex,
        updatedExercise,
      );
      return { ...state, exercises: newExercises };
    }

    case "DELETE_EXERCISE_NOTE": {
      const { exerciseIndex, noteIndex } = action;
      const exercise = state.exercises[exerciseIndex];
      if (!exercise) return state;
      const updatedExercise: WorkoutExercise = {
        ...exercise,
        notes: exercise.notes.filter((_, i) => i !== noteIndex),
      };
      const newExercises = replaceExercise(
        state.exercises,
        exerciseIndex,
        updatedExercise,
      );
      return { ...state, exercises: newExercises };
    }

    case "REORDER_EXERCISE_NOTES": {
      const { exerciseIndex, fromIndex, toIndex } = action;
      const exercise = state.exercises[exerciseIndex];
      if (!exercise) return state;
      const notes: Note[] = [...exercise.notes];
      if (
        fromIndex < 0 ||
        fromIndex >= notes.length ||
        toIndex < 0 ||
        toIndex >= notes.length
      )
        return state;
      const removed = notes.splice(fromIndex, 1);
      if (removed.length === 0) return state;
      const [moved] = removed as [Note];
      notes.splice(toIndex, 0, moved);
      const updatedExercise: WorkoutExercise = { ...exercise, notes };
      const newExercises = replaceExercise(
        state.exercises,
        exerciseIndex,
        updatedExercise,
      );
      return { ...state, exercises: newExercises };
    }

    case "UPDATE_WORKOUT_NOTE": {
      const { noteIndex, text } = action;
      if (noteIndex < 0 || noteIndex >= state.notes.length) return state;
      const updated: Note[] = state.notes.map((n, i) =>
        i === noteIndex ? { text } : n,
      );
      return { ...state, notes: updated };
    }

    case "DELETE_WORKOUT_NOTE": {
      const { noteIndex } = action;
      const updated = state.notes.filter((_, i) => i !== noteIndex);
      return { ...state, notes: updated };
    }

    case "REORDER_WORKOUT_NOTES": {
      const { fromIndex, toIndex } = action;
      const notes: Note[] = [...state.notes];
      if (
        fromIndex < 0 ||
        fromIndex >= notes.length ||
        toIndex < 0 ||
        toIndex >= notes.length
      )
        return state;
      const removed = notes.splice(fromIndex, 1);
      if (removed.length === 0) return state;
      const [moved] = removed as [Note];
      notes.splice(toIndex, 0, moved);
      return { ...state, notes };
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
): { weight: number | null; weightModifier: WeightModifier | undefined } => {
  // Return explicit/completed weight
  if (set.weightExplicit || set.completed)
    return { weight: set.weight, weightModifier: set.weightModifier };

  // Need exercise to estimate
  if (!exercise) return { weight: null, weightModifier: undefined };

  try {
    // Get estimated weight with error handling
    const estimate = estimateSet(sets, idx, exercise);

    return {
      weight: estimate.weight,
      weightModifier: estimate.weightModifier,
    };
  } catch (error) {
    console.error("Error estimating weight:", error);
    return { weight: null, weightModifier: undefined };
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

  const isExplicit = parsed !== null;

  const updatedSet: WorkoutSet = {
    ...set,
    [field]: parsed,
    [`${field}Explicit`]: isExplicit,
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
  let toggled = workoutReducer(state, toggleAction); // reuse toggle logic
  const ex = toggled.exercises[exerciseIndex];
  if (!ex) return toggled;
  const nextSetExists = setIndex + 1 < ex.sets.length;

  if (nextSetExists) {
    // If moving to next set, get the weight value for the next set
    const nextSet = ex.sets[setIndex + 1];
    if (!nextSet) return toggled;

    const { weight, weightModifier } = displayWeight(
      nextSet,
      ex.sets,
      setIndex + 1,
      ex,
    );

    if (weightModifier) {
      const newSet: WorkoutSet = { ...nextSet, weightModifier };
      const newExercises = replaceSet(
        toggled.exercises,
        exerciseIndex,
        setIndex + 1,
        newSet,
      );
      toggled = { ...toggled, exercises: newExercises };
    }

    return {
      ...toggled,
      activeField: { exerciseIndex, setIndex: setIndex + 1, field: "weight" },
      inputValue: weight?.toString() ?? "",
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
import type {
  CompletedExercise,
  CompletedSet,
  CompletedWorkout,
} from "@/lib/schemas/workout-schema";

export function finalizeWorkout(
  state: Workout,
  workoutNotesText?: string,
): CompletedWorkout {
  const completedExercises: CompletedExercise[] = state.exercises
    .map((ex, exIndex) => {
      const completedSets: CompletedSet[] = ex.sets.map((set, index) => ({
        weight: set.weight,
        reps: set.reps,
        modifier: set.modifier ?? null,
        weightModifier: set.weightModifier ?? null,
        restBefore: set.restBefore ?? null,
        notes: set.notes,
        rir: set.rir ?? null,
        order: index + 1,
        completed: set.completed || (set.weight !== null && set.reps !== null),
      }));

      return {
        name: ex.name,
        sets: completedSets,
        notes: ex.notes.length > 0 ? ex.notes[0]?.text : undefined,
        order: exIndex + 1,
      };
    })
    .filter((ex) => ex.sets.length > 0);

  return {
    name: state.name,
    startedAt: new Date(state.startTime),
    completedAt: new Date(),
    notes: workoutNotesText,
    exercises: completedExercises,
  };
}
