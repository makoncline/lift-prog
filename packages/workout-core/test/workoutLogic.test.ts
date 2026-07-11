import {
  finalizeWorkout,
  nextProgression,
  estimateSet,
  initialiseExercises,
  parseQuickSetLine,
  summarizeSetEntries,
  summarizeWorkingSets,
  workoutReducer,
} from "../src/index";
import type { Workout } from "../src/index";

describe("progression helpers", () => {
  it("cycles 12→8 and bumps weight", () => {
    const { weight, reps } = nextProgression(185, 12);
    expect(reps).toBe(8);
    expect(weight).toBeGreaterThan(185);
  });

  it("warm-up cascade uses previous snapshot", () => {
    const ex = initialiseExercises([
      { name: "Bench", sets: [{ weight: 45, reps: 15, isWarmup: true }] },
    ])[0]!;
    const est = estimateSet(ex.sets, 0, ex);
    expect(est.weight).toBe(45);
    expect(est.reps).toBe(15);
  });
});

describe("initialiseExercises previous summary", () => {
  it("groups repeated weights into shorthand", () => {
    const exercise = initialiseExercises([
      {
        name: "Bench Press",
        sets: [
          { weight: 100, reps: 8, notes: "do not copy" },
          { weight: 100, reps: 6 },
          { weight: 90, reps: 6 },
        ],
        notes: "Paused reps last set",
      },
    ])[0]!;

    expect(exercise.previousSummary).toBe("Bench Press - 100lbx8,6,90lbx6");
    expect(exercise.previousNotes).toBe("Paused reps last set");
    expect(exercise.sets).toMatchObject([
      { weight: 100, reps: 8, weightExplicit: true, repsExplicit: true },
      { weight: 100, reps: 6, weightExplicit: true, repsExplicit: true },
      { weight: 90, reps: 6, weightExplicit: true, repsExplicit: true },
    ]);
    expect(exercise.sets[0]!.notes).toBeUndefined();
    expect(exercise.previousSets[0]!.notes).toBe("do not copy");
  });

  it("compresses repeated weights without dropping rep meaning", () => {
    const exercise = initialiseExercises([
      {
        name: "Overhead Press",
        sets: [
          { weight: 100, reps: 8 },
          { weight: 100, reps: 8 },
          { weight: 100, reps: 6 },
        ],
      },
    ])[0]!;

    expect(exercise.previousSummary).toBe("Overhead Press - 100lbx8,8,6");
  });

  it("handles weight changes that return to a previous load", () => {
    const exercise = initialiseExercises([
      {
        name: "Row",
        sets: [
          { weight: 100, reps: 8 },
          { weight: 90, reps: 6 },
          { weight: 100, reps: 6 },
        ],
      },
    ])[0]!;

    expect(exercise.previousSummary).toBe("Row - 100lbx8,90lbx6,100lbx6");
  });

  it("omits summary when only warmups are present", () => {
    const exercise = initialiseExercises([
      {
        name: "Bike",
        sets: [{ weight: null, reps: 20, isWarmup: true }],
      },
    ])[0]!;

    expect(exercise.previousSummary).toBeUndefined();
    expect(exercise.previousNotes).toBeUndefined();
  });
});

describe("parseQuickSetLine", () => {
  it("marks earlier hyphen groups as warmups", () => {
    expect(parseQuickSetLine("0x30-45x15-90x8,8,6")).toMatchObject([
      { weight: 0, reps: 30, modifier: "warmup" },
      { weight: 45, reps: 15, modifier: "warmup" },
      { weight: 90, reps: 8 },
      { weight: 90, reps: 8 },
      { weight: 90, reps: 6 },
    ]);
  });

  it("keeps hyphen warmups when the working group has a backoff separator", () => {
    const sets = parseQuickSetLine("0x30-45x15-90x8,7,5;75x5");
    expect(sets).toMatchObject([
      { weight: 0, reps: 30, modifier: "warmup" },
      { weight: 45, reps: 15, modifier: "warmup" },
      { weight: 90, reps: 8 },
      { weight: 90, reps: 7 },
      { weight: 90, reps: 5 },
      { weight: 75, reps: 5 },
    ]);
    expect(sets.slice(2).map((set) => set.modifier)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("uses short rest fragments for plus notation", () => {
    expect(parseQuickSetLine("90x10,6+1")).toMatchObject([
      { weight: 90, reps: 10 },
      { weight: 90, reps: 6 },
      { weight: 90, reps: 1, restBefore: "short" },
    ]);
  });

  it("parses bodyweight pull-up notation and neg notes", () => {
    expect(parseQuickSetLine("BW 10,10,9+1+4(neg)")).toMatchObject([
      { weight: 0, reps: 10, weightModifier: "bodyweight" },
      { weight: 0, reps: 10, weightModifier: "bodyweight" },
      { weight: 0, reps: 9, weightModifier: "bodyweight" },
      {
        weight: 0,
        reps: 1,
        weightModifier: "bodyweight",
        restBefore: "short",
      },
      {
        weight: 0,
        reps: 4,
        weightModifier: "bodyweight",
        restBefore: "short",
        notes: "neg",
      },
    ]);
  });

  it("parses weighted bodyweight notation", () => {
    expect(parseQuickSetLine("BW+10x13,10+1")).toMatchObject([
      { weight: 10, reps: 13, weightModifier: "bodyweight" },
      { weight: 10, reps: 10, weightModifier: "bodyweight" },
      {
        weight: 10,
        reps: 1,
        weightModifier: "bodyweight",
        restBefore: "short",
      },
    ]);

    expect(parseQuickSetLine("BW 10lbx13,10")).toMatchObject([
      { weight: 10, reps: 13, weightModifier: "bodyweight" },
      { weight: 10, reps: 10, weightModifier: "bodyweight" },
    ]);
  });

  it("keeps bare weighted notation standard even with bodyweight history", () => {
    expect(parseQuickSetLine("10lbx13,10", { bodyweight: true })).toMatchObject(
      [
        { weight: 10, reps: 13 },
        { weight: 10, reps: 10 },
      ],
    );
    expect(
      parseQuickSetLine("10lbx13,10", { bodyweight: true }).map(
        (set) => set.weightModifier,
      ),
    ).toEqual([undefined, undefined]);
  });
});

describe("summarizeWorkingSets", () => {
  it("can summarize a set group without an exercise title", () => {
    expect(
      summarizeSetEntries([
        { weight: 45, reps: 12, modifier: "warmup" },
        { weight: 65, reps: 8, modifier: "warmup" },
      ]),
    ).toBe("45lbx12,65lbx8");
  });

  it("groups short-rest fragments with plus notation", () => {
    expect(
      summarizeWorkingSets("Pull-ups", [
        { weight: 0, reps: 10, weightModifier: "bodyweight" },
        { weight: 0, reps: 10, weightModifier: "bodyweight" },
        { weight: 0, reps: 9, weightModifier: "bodyweight" },
        {
          weight: 0,
          reps: 1,
          weightModifier: "bodyweight",
          restBefore: "short",
        },
        {
          weight: 0,
          reps: 4,
          weightModifier: "bodyweight",
          restBefore: "short",
        },
      ]),
    ).toBe("Pull-ups - BWx10,10,9+1+4");
  });

  it("includes the weight when a short-rest fragment changes load", () => {
    expect(
      summarizeWorkingSets("Drop", [
        { weight: 90, reps: 8 },
        { weight: 75, reps: 5, restBefore: "short" },
      ]),
    ).toBe("Drop - 90lbx8+75lbx5");
  });
});

describe("PLUS_MINUS reducer", () => {
  const baseState = (): Workout => ({
    currentExerciseIndex: 0,
    exercises: initialiseExercises([
      { name: "Bench", sets: [{ weight: null, reps: 5 }] },
    ]),
    activeField: { exerciseIndex: 0, setIndex: 0, field: "reps" },
    inputValue: "5",
    isFirstInteraction: false,
    notes: [],
    startTime: 0,
    name: "Workout",
    isInProgress: true,
  });

  it("increments and decrements reps", () => {
    const state = baseState();
    const inc = workoutReducer(state, { type: "PLUS_MINUS", sign: 1 });
    expect(inc.inputValue).toBe("6");
    expect(inc.exercises[0]!.sets[0]!.reps).toBe(6);

    const dec = workoutReducer(inc, { type: "PLUS_MINUS", sign: -1 });
    expect(dec.inputValue).toBe("5");
    expect(dec.exercises[0]!.sets[0]!.reps).toBe(5);
  });

  it("does not decrement reps below zero", () => {
    const state: Workout = {
      ...baseState(),
      inputValue: "0",
      exercises: initialiseExercises([
        { name: "Bench", sets: [{ weight: null, reps: 0 }] },
      ]),
    };
    const dec = workoutReducer(state, { type: "PLUS_MINUS", sign: -1 });
    expect(dec.inputValue).toBe("0");
    expect(dec.exercises[0]!.sets[0]!.reps).toBe(0);
  });
});

describe("current exercise reducer state", () => {
  const baseState = (): Workout => ({
    currentExerciseIndex: 0,
    exercises: initialiseExercises([
      { name: "Pull-ups", sets: [{ weight: null, reps: 5 }] },
      { name: "Rows", sets: [{ weight: 75, reps: 10 }] },
      { name: "Curl", sets: [{ weight: 30, reps: 12 }] },
    ]),
    activeField: { exerciseIndex: null, setIndex: null, field: null },
    inputValue: "",
    isFirstInteraction: false,
    notes: [],
    startTime: 0,
    name: "Workout",
    isInProgress: true,
  });

  it("selects a current exercise without changing the active input", () => {
    const state: Workout = {
      ...baseState(),
      activeField: { exerciseIndex: 0, setIndex: 0, field: "reps" },
      inputValue: "5",
    };

    const selected = workoutReducer(state, {
      type: "SELECT_EXERCISE",
      exerciseIndex: 2,
    });

    expect(selected.currentExerciseIndex).toBe(2);
    expect(selected.activeField).toEqual(state.activeField);
    expect(selected.inputValue).toBe("5");
  });

  it("keeps the same current exercise when reordered", () => {
    const state: Workout = {
      ...baseState(),
      currentExerciseIndex: 1,
    };

    const moved = workoutReducer(state, {
      type: "MOVE_EXERCISE_TO",
      exerciseIndex: 1,
      targetIndex: 0,
    });

    expect(moved.currentExerciseIndex).toBe(0);
    expect(moved.exercises[moved.currentExerciseIndex]!.name).toBe("Rows");
  });
});

describe("set completion reducer state", () => {
  it("can update set values without auto-completing the set", () => {
    const state: Workout = {
      currentExerciseIndex: 0,
      exercises: initialiseExercises([
        {
          name: "Rows",
          sets: [{ weight: 75, reps: 10 }],
        },
      ]),
      activeField: { exerciseIndex: null, setIndex: null, field: null },
      inputValue: "",
      isFirstInteraction: false,
      notes: [],
      startTime: 0,
      name: "Workout",
      isInProgress: true,
    };

    const incompleteState: Workout = {
      ...state,
      exercises: [
        {
          ...state.exercises[0]!,
          sets: [
            {
              ...state.exercises[0]!.sets[0]!,
              completed: false,
            },
          ],
        },
      ],
    };

    const updatedReps = workoutReducer(incompleteState, {
      type: "UPDATE_SET_REPS",
      exerciseIndex: 0,
      setIndex: 0,
      reps: 12,
      preserveCompleted: true,
    });

    expect(updatedReps.exercises[0]!.sets[0]).toMatchObject({
      reps: 12,
      completed: false,
    });

    const updatedWeight = workoutReducer(updatedReps, {
      type: "UPDATE_SET_WEIGHT",
      exerciseIndex: 0,
      setIndex: 0,
      weight: 80,
      preserveCompleted: true,
    });

    expect(updatedWeight.exercises[0]!.sets[0]).toMatchObject({
      weight: 80,
      reps: 12,
      completed: false,
    });
  });

  it("toggles completion without filling missing values from estimates", () => {
    const state: Workout = {
      currentExerciseIndex: 0,
      exercises: initialiseExercises([
        {
          name: "Rows",
          sets: [{ weight: 75, reps: 10 }],
        },
      ]),
      activeField: { exerciseIndex: null, setIndex: null, field: null },
      inputValue: "",
      isFirstInteraction: false,
      notes: [],
      startTime: 0,
      name: "Workout",
      isInProgress: true,
    };
    const nextState = {
      ...state,
      exercises: [
        {
          ...state.exercises[0]!,
          sets: [
            {
              ...state.exercises[0]!.sets[0]!,
              weight: null,
              reps: 8,
              completed: false,
            },
          ],
        },
      ],
    };

    const completed = workoutReducer(nextState, {
      type: "TOGGLE_SET_COMPLETED",
      exerciseIndex: 0,
      setIndex: 0,
    });

    expect(completed.exercises[0]!.sets[0]).toMatchObject({
      weight: null,
      reps: 8,
      completed: true,
    });

    const uncompleted = workoutReducer(completed, {
      type: "TOGGLE_SET_COMPLETED",
      exerciseIndex: 0,
      setIndex: 0,
    });

    expect(uncompleted.exercises[0]!.sets[0]).toMatchObject({
      weight: null,
      reps: 8,
      completed: false,
    });
  });
});

describe("finalizeWorkout", () => {
  it("saves carried-forward set values even when the set was never edited", () => {
    const [exercise] = initialiseExercises([
      {
        name: "Incline Press",
        sets: [{ weight: 95, reps: 8 }],
      },
    ]);

    const workout = finalizeWorkout({
      clientId: "workout-local-1",
      currentExerciseIndex: 0,
      exercises: [exercise!],
      activeField: { exerciseIndex: null, setIndex: null, field: null },
      inputValue: "",
      isFirstInteraction: false,
      notes: [],
      startTime: 0,
      name: "Push",
      isInProgress: true,
    });

    expect(workout.exercises[0]!.sets[0]).toMatchObject({
      weight: 95,
      reps: 8,
      completed: true,
    });
    expect(workout.clientId).toBe("workout-local-1");
  });

  it("keeps blank default sets incomplete", () => {
    const [exercise] = initialiseExercises([
      {
        name: "New Movement",
        sets: [{ weight: null, reps: null }],
      },
    ]);

    const workout = finalizeWorkout({
      currentExerciseIndex: 0,
      exercises: [exercise!],
      activeField: { exerciseIndex: null, setIndex: null, field: null },
      inputValue: "",
      isFirstInteraction: false,
      notes: [],
      startTime: 0,
      name: "Push",
      isInProgress: true,
    });

    expect(workout.exercises[0]!.sets[0]).toMatchObject({
      weight: null,
      reps: null,
      completed: false,
    });
  });
});
