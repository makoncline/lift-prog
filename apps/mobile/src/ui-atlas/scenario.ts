import type { MobileWorkoutInitialState } from "../workout/initial-state";

export const UI_ATLAS_SCENARIO_BY_NUMBER = {
  9: "home-populated",
  10: "home-empty",
  11: "home-loading",
  12: "home-error",
  13: "home-refreshing",
  14: "home-active-workout",
  15: "settings-local",
  16: "settings-connected",
  17: "settings-syncing",
  18: "settings-offline",
  19: "delete-workout-confirm",
  20: "delete-account-confirm",
  21: "workout-empty",
  22: "workout-active",
  23: "workout-past-review",
  24: "workout-past-edit",
  25: "workout-menu",
  26: "workout-title-edit",
  27: "workout-note-edit",
  28: "body-weight-edit",
  29: "workout-rest-times",
  30: "exercise-plan",
  31: "exercise-search",
  32: "exercise-create",
  33: "time-automatic",
  34: "time-manual",
  35: "start-time-picker",
  36: "end-time-picker",
  37: "rest-timer-presets",
  38: "rest-timer-custom",
  39: "rest-timer-running",
  40: "exercise-menu",
  41: "pinned-note-edit",
  42: "workout-exercise-note-edit",
  43: "set-note-edit",
  44: "previous-set-peek",
  45: "set-swipe-actions",
  46: "delete-set-confirm",
  47: "delete-pause-confirm",
  48: "weight-keyboard",
  49: "reps-keyboard",
  51: "incomplete-sets",
  52: "finish-preview",
  53: "duration-edit",
  54: "end-date-edit",
  55: "end-time-edit",
  56: "workout-error",
  57: "exercise-about",
  58: "exercise-history",
  59: "exercise-charts",
  60: "exercise-records",
  61: "exercise-edit",
  62: "starting-weight-picker",
  63: "increase-total",
  64: "increase-equal",
  65: "increase-negative",
  66: "plates-total",
  67: "plates-equal",
  68: "plates-starting-weight",
  69: "plates-impossible",
  85: "home-copying",
  86: "home-opening-edit",
  87: "home-show-more",
  88: "settings-deleting-account",
  89: "body-weight-health-loading",
  90: "body-weight-error",
  91: "workout-menu-past",
  92: "workout-note-new",
  93: "workout-note-existing",
  94: "exercise-plan-empty",
  95: "exercise-search-empty",
  96: "exercise-plan-reordering",
  97: "remove-exercise-confirm",
  98: "start-time-expanded",
  99: "end-time-expanded",
  100: "exercise-rest-times",
  101: "exercise-preferences",
  102: "pinned-note-visible",
  103: "workout-exercise-note-visible",
  104: "set-note-visible",
  105: "set-incomplete",
  106: "set-complete",
  107: "set-warm-up",
  108: "set-pause-segment",
  109: "previous-set-peek-notes",
  110: "base-set-swipe-actions",
  111: "pause-swipe-actions",
  112: "weight-keyboard-external",
  113: "weight-keyboard-bodyweight",
  114: "reps-keyboard-pause",
  115: "finish-preview-scrolled",
  116: "past-workout-finish-preview",
  117: "exercise-about-empty",
  118: "exercise-history-empty",
  119: "exercise-charts-empty",
  120: "exercise-records-empty",
  121: "starting-weight-custom",
  122: "increase-adjusted",
  123: "plates-adjusted",
  134: "close-workout-confirm",
  137: "exercise-note-keyboard",
  138: "set-command-sheet",
  139: "rest-choice-sheet",
  140: "change-set-kind-confirm",
} as const;

export function getMobileWorkoutInitialState(
  stateId: string,
): MobileWorkoutInitialState {
  const stateNumber = Number.parseInt(stateId, 10);
  const scenario =
    UI_ATLAS_SCENARIO_BY_NUMBER[
      stateNumber as keyof typeof UI_ATLAS_SCENARIO_BY_NUMBER
    ];
  const initialState: MobileWorkoutInitialState = { freezeEffects: true };

  switch (scenario) {
    case "workout-error":
      initialState.workoutErrorMessage = "Intentional UI atlas workout error.";
      break;
    case "home-show-more":
      initialState.home = { limit: 20 };
      break;
    case "home-copying":
      initialState.home = { copyingWorkoutId: "atlas-workout-1" };
      break;
    case "home-opening-edit":
      initialState.home = { editingWorkoutId: "atlas-workout-1" };
      break;
    case "settings-local":
    case "settings-connected":
    case "settings-syncing":
    case "settings-offline":
      initialState.home = { settingsOpen: true };
      break;
    case "settings-deleting-account":
      initialState.home = { settingsOpen: true, deletingAccount: true };
      break;
    case "delete-workout-confirm":
      initialState.home = { dialog: "delete-workout" };
      break;
    case "delete-account-confirm":
      initialState.home = { dialog: "delete-account" };
      break;
    case "exercise-search":
      initialState.workout = {
        newExerciseName: "row",
        exercisePlanOpen: true,
        exercisePlanAutoFocus: true,
      };
      break;
    case "exercise-create":
    case "exercise-search-empty":
      initialState.workout = {
        newExerciseName: "Sissy squat",
        exercisePlanOpen: true,
        exercisePlanAutoFocus: true,
      };
      break;
    case "exercise-plan":
    case "exercise-plan-empty":
    case "exercise-plan-reordering":
      initialState.workout = { exercisePlanOpen: true };
      break;
    case "weight-keyboard":
    case "weight-keyboard-external":
    case "weight-keyboard-bodyweight":
      initialState.workout = { setEditor: "weight" };
      break;
    case "reps-keyboard":
      initialState.workout = { setEditor: "reps" };
      break;
    case "reps-keyboard-pause":
      initialState.workout = { setEditor: "pause-reps" };
      break;
    case "increase-total":
      initialState.workout = {
        setEditor: "weight",
        helper: { kind: "increase", mode: "total", addedWeight: 5 },
      };
      break;
    case "increase-equal":
      initialState.workout = {
        setEditor: "weight",
        helper: {
          kind: "increase",
          mode: "equal-sides",
          addedWeight: 5,
        },
      };
      break;
    case "increase-negative":
      initialState.workout = {
        setEditor: "weight",
        helper: { kind: "increase", mode: "total", addedWeight: -10 },
      };
      break;
    case "increase-adjusted":
      initialState.workout = {
        setEditor: "weight",
        helper: { kind: "increase", mode: "total", addedWeight: 12.5 },
      };
      break;
    case "plates-total":
      initialState.workout = {
        setEditor: "weight",
        helper: { kind: "plates", mode: "total", startingWeight: 0 },
      };
      break;
    case "plates-equal":
      initialState.workout = {
        setEditor: "weight",
        helper: { kind: "plates", mode: "equal-sides" },
      };
      break;
    case "plates-starting-weight":
      initialState.workout = {
        setEditor: "weight",
        helper: {
          kind: "plates",
          mode: "equal-sides",
          startingWeightPicker: true,
        },
      };
      break;
    case "plates-impossible":
      initialState.workout = {
        setEditor: "weight",
        helper: {
          kind: "plates",
          mode: "equal-sides",
          targetWeight: 32.5,
        },
      };
      break;
    case "plates-adjusted":
      initialState.workout = {
        setEditor: "weight",
        helper: {
          kind: "plates",
          mode: "equal-sides",
          targetWeightOffset: 10,
        },
      };
      break;
    case "pinned-note-edit":
      initialState.workout = {
        noteEditor: "pinned",
        noteDraft: "Hold dumbbell between thighs.",
      };
      break;
    case "workout-exercise-note-edit":
      initialState.workout = {
        noteEditor: "workout-exercise",
        noteDraft: "Stay tight through the final rep.",
      };
      break;
    case "set-note-edit":
      initialState.workout = {
        noteEditor: "set",
        noteDraft: "Smooth final rep.",
      };
      break;
    case "workout-menu":
    case "workout-menu-past":
      initialState.workout = { workoutMenuOpen: true };
      break;
    case "workout-title-edit":
      initialState.workout = { workoutNameEditing: true };
      break;
    case "workout-note-edit":
    case "workout-note-existing":
      initialState.workout = {
        workoutNoteDraft: "Atlas workout note.",
      };
      break;
    case "workout-note-new":
      initialState.workout = { workoutNoteDraft: "" };
      break;
    case "time-automatic":
    case "time-manual":
      initialState.workout = { timingOpen: true };
      break;
    case "start-time-expanded":
      initialState.workout = { timingOpen: true, timingField: "start" };
      break;
    case "end-time-expanded":
      initialState.workout = { timingOpen: true, timingField: "end" };
      break;
    case "workout-rest-times":
      initialState.workout = { workoutRestTimesOpen: true };
      break;
    case "exercise-rest-times":
      initialState.workout = { exerciseRestTimesOpen: true };
      break;
    case "start-time-picker":
      initialState.workout = { timeEditor: "start-date" };
      break;
    case "end-time-picker":
      initialState.workout = { timeEditor: "end-time" };
      break;
    case "duration-edit":
      initialState.workout = { timeEditor: "finish-duration" };
      break;
    case "end-date-edit":
      initialState.workout = { timeEditor: "finish-end-date" };
      break;
    case "end-time-edit":
      initialState.workout = { timeEditor: "finish-end-time" };
      break;
    case "finish-preview":
    case "finish-preview-scrolled":
    case "past-workout-finish-preview":
      initialState.workout = { finishPreviewOpen: true };
      break;
    case "body-weight-edit":
      initialState.workout = { bodyWeightDialog: {} };
      break;
    case "body-weight-health-loading":
      initialState.workout = { bodyWeightDialog: { loading: true } };
      break;
    case "body-weight-error":
      initialState.workout = {
        bodyWeightDialog: {
          error: "No Apple Health body weight found.",
        },
      };
      break;
    case "rest-timer-presets":
      initialState.workout = { restTimer: { picker: "presets" } };
      break;
    case "rest-timer-custom":
      initialState.workout = {
        restTimer: { durationSeconds: 95, picker: "custom" },
      };
      break;
    case "rest-timer-running":
      initialState.workout = { restTimer: { runningSeconds: 114 } };
      break;
    case "delete-set-confirm":
      initialState.workout = { dialog: "delete-set" };
      break;
    case "delete-pause-confirm":
      initialState.workout = { dialog: "delete-pause" };
      break;
    case "incomplete-sets":
      initialState.workout = { dialog: "incomplete-sets" };
      break;
    case "remove-exercise-confirm":
      initialState.workout = { dialog: "remove-exercise" };
      break;
    case "close-workout-confirm":
      initialState.workout = { dialog: "close-workout" };
      break;
    case "change-set-kind-confirm":
      initialState.workout = { dialog: "change-set-kind" };
      break;
    case "exercise-menu":
      initialState.workout = { exerciseMenuOpen: true };
      break;
    case "exercise-about":
    case "exercise-about-empty":
      initialState.workout = { details: { open: true, tab: "about" } };
      break;
    case "exercise-charts":
    case "exercise-charts-empty":
      initialState.workout = { details: { open: true, tab: "charts" } };
      break;
    case "exercise-records":
    case "exercise-records-empty":
      initialState.workout = { details: { open: true, tab: "records" } };
      break;
    case "exercise-history":
    case "exercise-history-empty":
      initialState.workout = { details: { open: true, tab: "history" } };
      break;
    case "exercise-edit":
    case "exercise-preferences":
      initialState.workout = {
        details: { open: true, tab: "about", editing: true },
      };
      break;
    case "starting-weight-picker":
      initialState.workout = {
        details: {
          open: true,
          tab: "about",
          editing: true,
          startingWeightPicker: true,
        },
      };
      break;
    case "starting-weight-custom":
      initialState.workout = {
        details: {
          open: true,
          tab: "about",
          editing: true,
          startingWeight: 32.5,
        },
      };
      break;
    case "exercise-note-keyboard":
      initialState.workout = {
        details: {
          open: true,
          tab: "about",
          editing: true,
          autoFocusNote: true,
        },
      };
      break;
    case "previous-set-peek":
    case "previous-set-peek-notes":
      initialState.workout = { previousGroupIndex: 0 };
      break;
    case "set-command-sheet":
      initialState.workout = { actionSheet: "set-command" };
      break;
    case "rest-choice-sheet":
      initialState.workout = { actionSheet: "rest-choice" };
      break;
    case "set-swipe-actions":
    case "base-set-swipe-actions":
      initialState.workout = { swipe: "base" };
      break;
    case "pause-swipe-actions":
      initialState.workout = { swipe: "pause" };
      break;
  }

  return initialState;
}
