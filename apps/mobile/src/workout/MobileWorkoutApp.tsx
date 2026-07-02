import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import {
  createWorkoutApiClient,
  getWorkoutApiErrorMessage,
} from "@lift-prog/workout-sdk";
import {
  estimate1RM,
  finalizeWorkout,
  initialiseExercises,
  workoutReducer,
  type Action,
  type CompletedWorkout,
  type PlateLoadMode,
  type PreviousExerciseData,
  type SetRestType,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from "@lift-prog/workout-core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  ActionSheetIOS,
  findNodeHandle,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  type ModalProps,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  type GestureResponderEvent,
  type StyleProp,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { mobileWorkoutApiBaseUrl } from "../lib/config";
import {
  addWatchWorkoutCommandListener,
  addUnfinishedWorkoutReminderListener,
  addHeartRateSampleListener,
  cancelUnfinishedWorkoutNotification,
  cancelWorkoutTimerNotification,
  cancelStrengthWorkout,
  endRestTimerLiveActivity,
  finishStrengthWorkout,
  getHealthAuthorizationStatus,
  getLatestBodyWeight,
  isHealthAvailable,
  requestHealthAuthorization,
  scheduleUnfinishedWorkoutNotification,
  scheduleWorkoutTimerNotification,
  startOrUpdateRestTimerLiveActivity,
  updateWatchWorkoutSnapshot,
  clearWatchWorkoutSnapshot,
} from "../../modules/lift-health/src";
import type { WatchWorkoutCommand } from "../../modules/lift-health/src";
import { MobileErrorBoundary } from "./MobileErrorBoundary";
import {
  countCompletedExerciseWorkingSets,
  countWorkoutWorkingSets,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatRelativeDate,
  formatSetInline,
  formatTime,
  formatWeightLabel,
  getSetDisplayValues,
  splitSets,
  summarizeCompletedExerciseSetGroup,
  summarizeWorkoutExerciseSetGroup,
  type IndexedWorkoutSet,
} from "./format";
import { styles } from "./styles";
import { palette } from "./theme";
import {
  buildAddedWeightRepRows,
  calculatePlatePlan,
  formatPlateWeight,
  PLATES,
  type PlateWeight,
  type WeightSuggestion,
} from "./weight_helper";

type WorkoutApiClient = ReturnType<typeof createWorkoutApiClient>;
type RecentWorkout = Awaited<
  ReturnType<WorkoutApiClient["listRecent"]>
>[number];
type PreparedWorkout = Awaited<
  ReturnType<WorkoutApiClient["prepareInitialWorkout"]>
>;
type WorkoutDetails = Awaited<
  ReturnType<WorkoutApiClient["getWorkoutDetails"]>
>;
type ExerciseSuggestion = Awaited<
  ReturnType<WorkoutApiClient["listExercises"]>
>[number];

type LocalWorkoutFixtures = {
  pullDayPrepared: PreparedWorkout;
  preparedByWorkoutId: Map<number, PreparedWorkout>;
  recent: RecentWorkout[];
};

type AppScreen =
  | { name: "home"; refreshKey: number }
  | {
      name: "workout";
      key: number;
      viewMode?: WorkoutViewMode;
      prepared: PreparedWorkout;
      draftWorkout?: Workout;
      workoutId?: number;
      startedAt?: Date;
      completedAt?: Date | null;
      notes?: string | null;
      contextLabel?: string;
    };

type SetEditTarget = {
  exerciseIndex: number;
  setId: string;
  field?: SetEditField;
};

type SetEditField = "weight" | "reps";
type WorkoutViewMode = "active" | "past-review" | "past-edit";
type ExerciseHistoryEntry = NonNullable<WorkoutExercise["history"]>[number];
type ExerciseDetailsTab = "about" | "history" | "charts" | "records";
type UserExerciseSettings = {
  note: string;
  plateStartingWeight: number | null;
  plateLoadMode: PlateLoadMode;
};
type MenuAnchor = { x: number; y: number; width: number; height: number };
type SwipeActionSetRowHelpers = {
  isPressSuppressed: () => boolean;
  swipeTouchHandlers: {
    onTouchCancel: (event: GestureResponderEvent) => void;
    onTouchEnd: (event: GestureResponderEvent) => void;
    onTouchMove: (event: GestureResponderEvent) => void;
    onTouchStart: (event: GestureResponderEvent) => void;
  };
};
type AppDialogAction = {
  label: string;
  onPress?: () => void | Promise<void>;
  testID?: string;
  variant?: "default" | "primary" | "danger" | "cancel";
};
type AppDialogState = {
  actions: AppDialogAction[];
  message?: string;
  title: string;
};
type AppDialogPresenter = (dialog: AppDialogState) => void;

const USE_SWIPEABLE_EXERCISE_SET_CARDS = false;
const AppDialogContext = React.createContext<AppDialogPresenter | null>(null);
const AppModalLayerOpenContext = React.createContext(false);
const AppModalLayerRegisterContext = React.createContext<
  (() => () => void) | null
>(null);

type NoteEditTarget =
  | { kind: "workout" }
  | { kind: "exercise"; exerciseIndex: number }
  | { kind: "workout-exercise"; exerciseIndex: number }
  | { kind: "set"; exerciseIndex: number; setId: string };
type InlineNoteEditTarget = Exclude<NoteEditTarget, { kind: "workout" }>;
type TimeEditTarget =
  | "start-date"
  | "start-time"
  | "end-date"
  | "end-time"
  | "end-duration"
  | "finish-end-date"
  | "finish-end-time"
  | "finish-duration";
type ClockTimeEditTarget = Exclude<
  TimeEditTarget,
  "end-duration" | "finish-duration"
>;
type DurationEditTarget = Extract<
  TimeEditTarget,
  "end-duration" | "finish-duration"
>;
type IconName = React.ComponentProps<typeof Ionicons>["name"];

const ACTIVE_WORKOUT_DRAFT_KEY = "lift-prog-active-workout-draft-v1";
const REST_TIMER_SECONDS = 180;
const UNFINISHED_WORKOUT_REMINDER_SECONDS = 15 * 60;
const REST_TIMER_PRESET_SECONDS = [30, 60, 90, 120, 150, 180, 240, 300];
const REST_TIMER_STEP_SECONDS = 10;
const MIN_REST_TIMER_SECONDS = 10;
const MAX_REST_TIMER_SECONDS = 20 * 60;
const REST_TIMER_HOLD_DELAY_MS = 300;
const REST_TIMER_CUSTOM_SECONDS = Array.from(
  { length: MAX_REST_TIMER_SECONDS / 10 },
  (_, index) => (index + 1) * 10,
);

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function normalizeRestTimerSeconds(seconds: number) {
  if (!Number.isFinite(seconds)) return REST_TIMER_SECONDS;
  return Math.max(
    MIN_REST_TIMER_SECONDS,
    Math.min(MAX_REST_TIMER_SECONDS, Math.round(seconds)),
  );
}

function formatRestTimerDurationLabel(seconds: number) {
  const safeSeconds = normalizeRestTimerSeconds(seconds);
  if (safeSeconds < 60) return `${safeSeconds}s`;
  if (safeSeconds % 60 === 0) return `${safeSeconds / 60}m`;
  return formatCountdown(safeSeconds);
}

function closestRestTimerOption(seconds: number, options: number[]) {
  const normalized = normalizeRestTimerSeconds(seconds);
  return options.reduce((closest, option) =>
    Math.abs(option - normalized) < Math.abs(closest - normalized)
      ? option
      : closest,
  );
}

type StoredWorkoutDraft = {
  workout: Workout;
  completedAt: string | null;
  savedAt: number;
};

type PendingWorkoutDraft = StoredWorkoutDraft;

type WorkoutSession = {
  past: Workout[];
  present: Workout;
  future: Workout[];
  pendingHistoryBase?: Workout;
};

type WorkoutDispatchOptions = {
  track?: boolean;
  deferHistory?: boolean;
};

type HealthWorkoutState = {
  requested: boolean;
  live: boolean;
  starting: boolean;
  saving: boolean;
  message: string | null;
};

const MAX_MOBILE_DRAFT_HISTORY = 80;
const EPHEMERAL_WORKOUT_ACTIONS = new Set<Action["type"]>([
  "FOCUS_FIELD",
  "COLLAPSE_KEYBOARD",
  "NAV_EXERCISE",
  "SELECT_EXERCISE",
]);

let nextClientId = 1;

function makeClientId() {
  const id = `mobile-set-${Date.now()}-${nextClientId}`;
  nextClientId += 1;
  return id;
}

function normalizeBodyWeightLb(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : null;

  return numeric != null && Number.isFinite(numeric) && numeric > 0
    ? numeric
    : null;
}

function getUnknownErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function Icon({
  name,
  size = 22,
  color = palette.muted,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

function triggerSelectionHaptic() {
  if (Platform.OS !== "ios") return;
  void Haptics.selectionAsync().catch(() => undefined);
}

function ensureWorkoutSetIds(workout: Workout): Workout {
  return {
    ...workout,
    exercises: workout.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({
        ...set,
        clientId: set.clientId ?? makeClientId(),
      })),
    })),
  };
}

function resetExerciseCompletion(exercise: WorkoutExercise): WorkoutExercise {
  return {
    ...exercise,
    sets: exercise.sets.map((set) => ({
      ...set,
      completed: false,
    })),
  };
}

function createWorkoutState(
  prepared: PreparedWorkout,
  options: {
    startedAt?: Date;
    notes?: string | null;
    isInProgress?: boolean;
    preservePreparedValues?: boolean;
  } = {},
): Workout {
  const exercises = initialiseExercises(
    prepared.exercises as PreviousExerciseData[],
  );
  const hydratedExercises = options.preservePreparedValues
    ? exercises.map((exercise, exerciseIndex) => {
        const preparedExercise = prepared.exercises[exerciseIndex];
        if (!preparedExercise) return exercise;

        return {
          ...exercise,
          notes: preparedExercise.notes?.trim()
            ? [{ text: preparedExercise.notes.trim() }]
            : [],
          sets: exercise.sets.map((set, setIndex) => {
            const preparedSet = preparedExercise.sets[setIndex];
            if (!preparedSet) return set;
            const modifier =
              preparedSet.modifier ??
              (preparedSet.isWarmup ? "warmup" : undefined);

            return {
              ...set,
              weight: preparedSet.weight,
              reps: preparedSet.reps,
              completed: true,
              weightExplicit: preparedSet.weight !== null,
              repsExplicit: preparedSet.reps !== null,
              prevWeight: preparedSet.weight,
              prevReps: preparedSet.reps,
              modifier,
              weightModifier: preparedSet.weightModifier,
              restBefore: preparedSet.restBefore,
              notes: preparedSet.notes ?? undefined,
              rir: preparedSet.rir,
            };
          }),
        };
      })
    : exercises.map(resetExerciseCompletion);

  return ensureWorkoutSetIds({
    currentExerciseIndex: 0,
    exercises: hydratedExercises,
    activeField: { exerciseIndex: null, setIndex: null, field: null },
    inputValue: "",
    isFirstInteraction: false,
    notes: options.notes?.trim() ? [{ text: options.notes.trim() }] : [],
    startTime: options.startedAt?.getTime() ?? Date.now(),
    name: prepared.workoutName || "Workout",
    bodyWeightLb: normalizeBodyWeightLb(prepared.bodyWeightLb),
    isInProgress: options.isInProgress ?? true,
  });
}

function blankPreparedWorkout(
  bodyWeightLb: number | null = null,
): PreparedWorkout {
  return {
    workoutName: "Custom Workout",
    bodyWeightLb,
    exercises: [],
  };
}

function applyWorkoutAction(workout: Workout, action: Action) {
  return ensureWorkoutSetIds(workoutReducer(workout, action));
}

function createWorkoutSession(workout: Workout): WorkoutSession {
  return {
    past: [],
    present: ensureWorkoutSetIds(workout),
    future: [],
  };
}

function applyWorkoutSessionAction(
  session: WorkoutSession,
  action: Action,
  options: WorkoutDispatchOptions = {},
): WorkoutSession {
  const nextWorkout = applyWorkoutAction(session.present, action);
  const shouldTrack =
    options.track ?? !EPHEMERAL_WORKOUT_ACTIONS.has(action.type);

  if (!shouldTrack) {
    return { ...session, present: nextWorkout };
  }

  if (options.deferHistory) {
    return {
      ...session,
      present: nextWorkout,
      future: [],
      pendingHistoryBase: session.pendingHistoryBase ?? session.present,
    };
  }

  return pushWorkoutHistory(session, nextWorkout);
}

function pushWorkoutHistory(
  session: WorkoutSession,
  nextWorkout: Workout,
): WorkoutSession {
  const base = session.pendingHistoryBase ?? session.present;
  return {
    past: [...session.past, base].slice(-MAX_MOBILE_DRAFT_HISTORY),
    present: nextWorkout,
    future: [],
    pendingHistoryBase: undefined,
  };
}

function commitPendingWorkoutHistory(session: WorkoutSession): WorkoutSession {
  if (!session.pendingHistoryBase) return session;
  return {
    ...session,
    past: [...session.past, session.pendingHistoryBase].slice(
      -MAX_MOBILE_DRAFT_HISTORY,
    ),
    future: [],
    pendingHistoryBase: undefined,
  };
}

function undoWorkoutSession(session: WorkoutSession): WorkoutSession {
  if (session.pendingHistoryBase) {
    return {
      ...session,
      present: session.pendingHistoryBase,
      future: [session.present, ...session.future],
      pendingHistoryBase: undefined,
    };
  }

  const previous = session.past[session.past.length - 1];
  if (!previous) return session;

  return {
    past: session.past.slice(0, -1),
    present: previous,
    future: [session.present, ...session.future],
  };
}

function redoWorkoutSession(session: WorkoutSession): WorkoutSession {
  const next = session.future[0];
  if (!next) return session;

  return {
    past: [...session.past, session.present].slice(-MAX_MOBILE_DRAFT_HISTORY),
    present: next,
    future: session.future.slice(1),
  };
}

async function readActiveWorkoutDraft(): Promise<StoredWorkoutDraft | null> {
  try {
    const raw =
      Platform.OS === "web"
        ? getWebStorageItem(ACTIVE_WORKOUT_DRAFT_KEY)
        : await SecureStore.getItemAsync(ACTIVE_WORKOUT_DRAFT_KEY);
    return parseStoredWorkoutDraft(raw);
  } catch {
    return null;
  }
}

async function writeActiveWorkoutDraft(draft: StoredWorkoutDraft) {
  const raw = JSON.stringify(draft);
  if (Platform.OS === "web") {
    setWebStorageItem(ACTIVE_WORKOUT_DRAFT_KEY, raw);
    return;
  }

  await SecureStore.setItemAsync(ACTIVE_WORKOUT_DRAFT_KEY, raw);
}

async function clearActiveWorkoutDraft() {
  try {
    if (Platform.OS === "web") {
      removeWebStorageItem(ACTIVE_WORKOUT_DRAFT_KEY);
      return;
    }

    await SecureStore.deleteItemAsync(ACTIVE_WORKOUT_DRAFT_KEY);
  } catch {
    // Draft cleanup should never block navigation after a save or discard.
  }
}

function parseStoredWorkoutDraft(
  raw: string | null,
): StoredWorkoutDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredWorkoutDraft>;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !parsed.workout ||
      !Array.isArray(parsed.workout.exercises) ||
      typeof parsed.savedAt !== "number"
    ) {
      return null;
    }

    const workout = ensureWorkoutSetIds(parsed.workout);

    return {
      workout: {
        ...workout,
        bodyWeightLb: normalizeBodyWeightLb(workout.bodyWeightLb),
      },
      completedAt:
        typeof parsed.completedAt === "string" ? parsed.completedAt : null,
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

function getWebStorageItem(key: string) {
  return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
}

function setWebStorageItem(key: string, value: string) {
  if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
}

function removeWebStorageItem(key: string) {
  if (typeof localStorage !== "undefined") localStorage.removeItem(key);
}

function createLocalWorkoutFixtures(): LocalWorkoutFixtures {
  const now = new Date();
  const pullDayDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const pushDayDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const pullDayExercises: PreparedWorkout["exercises"] = [
    {
      userExerciseId: 1,
      name: "Pull-ups",
      exerciseNotes: "Hold dumbbell in thighs",
      sets: [
        {
          weight: -95,
          reps: 15,
          modifier: "warmup",
          weightModifier: "bodyweight",
          notes: "Assisted pull machine",
        },
        { weight: 20, reps: 13, weightModifier: "bodyweight" },
        { weight: null, reps: 8, restBefore: "standard" },
        {
          weight: 0,
          reps: 3,
          weightModifier: "bodyweight",
          restBefore: "short",
        },
      ],
      history: [
        {
          relation: "last time",
          relativeDate: "3 days ago",
          date: "jun 17",
          workoutNote: "Pull day felt low energy",
          workoutExerciseNote: "Feeling weak today",
          sets: [
            {
              weight: -100,
              reps: 15,
              modifier: "warmup",
              weightModifier: "bodyweight",
              notes: "Foot assist",
            },
            { weight: 20, reps: 13, weightModifier: "bodyweight" },
            {
              weight: null,
              reps: 8,
              restBefore: "standard",
              notes: "failed clean on final rep",
            },
          ],
        },
      ],
    },
    {
      userExerciseId: 2,
      name: "Rows",
      sets: [
        { weight: 0, reps: 30, modifier: "warmup" },
        { weight: 75, reps: 11, notes: "12 back only shrugs after" },
        { weight: null, reps: 11, restBefore: "standard" },
      ],
      history: [
        {
          relation: "last time",
          relativeDate: "3 days ago",
          date: "jun 17",
          sets: [
            { weight: 0, reps: 30, modifier: "warmup" },
            { weight: 75, reps: 11, notes: "good control" },
          ],
        },
      ],
    },
    {
      userExerciseId: 3,
      name: "Bicep curl",
      sets: [
        { weight: 30, reps: 13 },
        { weight: null, reps: 9, restBefore: "standard" },
      ],
    },
  ];

  const pushDayExercises: PreparedWorkout["exercises"] = [
    {
      userExerciseId: 4,
      name: "Machine bench press",
      sets: [
        { weight: 45, reps: 12, modifier: "warmup" },
        { weight: 90, reps: 10 },
        { weight: 100, reps: 8, restBefore: "standard" },
        { weight: null, reps: 3, restBefore: "short" },
      ],
    },
    {
      userExerciseId: 5,
      name: "Chest fly",
      sets: [
        { weight: 80, reps: 12 },
        { weight: null, reps: 10, restBefore: "standard" },
      ],
    },
  ];

  const recent: RecentWorkout[] = [
    {
      id: 2,
      name: "Pull day",
      startedAt: pullDayDate,
      completedAt: new Date(pullDayDate.getTime() + 43 * 60 * 1000),
      bodyWeightLb: 173,
      exerciseSummaries: [
        "Pull-ups - BW+20lbx13,8+BWx3",
        "Rows - 75lbx11,11",
        "Bicep curl - 30lbx13,9",
      ],
    },
    {
      id: 1,
      name: "Push day",
      startedAt: pushDayDate,
      completedAt: new Date(pushDayDate.getTime() + 49 * 60 * 1000),
      bodyWeightLb: 174,
      exerciseSummaries: [
        "Machine bench press - 90lbx10,100lbx8+3",
        "Chest fly - 80lbx12,10",
      ],
    },
  ];

  const preparedByWorkoutId = new Map<number, PreparedWorkout>([
    [
      2,
      {
        workoutName: "Pull day",
        bodyWeightLb: 173,
        exercises: pullDayExercises,
      },
    ],
    [
      1,
      {
        workoutName: "Push day",
        bodyWeightLb: 174,
        exercises: pushDayExercises,
      },
    ],
  ]);

  return {
    pullDayPrepared: preparedByWorkoutId.get(2)!,
    preparedByWorkoutId,
    recent,
  };
}

function createLocalWorkoutApiClient(
  fixtures: LocalWorkoutFixtures = createLocalWorkoutFixtures(),
): WorkoutApiClient {
  const { preparedByWorkoutId, recent } = fixtures;
  const getLatestBodyWeightLb = () =>
    recent.find((workout) => workout.bodyWeightLb != null)?.bodyWeightLb ??
    null;

  return {
    async listRecent(input) {
      return recent.slice(0, input?.limit ?? 10);
    },
    async prepareInitialWorkout(input) {
      if (input.mode === "workoutReference") {
        return (
          preparedByWorkoutId.get(input.workoutId) ??
          blankPreparedWorkout(getLatestBodyWeightLb())
        );
      }

      return {
        workoutName: input.workoutName ?? "Custom Workout",
        bodyWeightLb: getLatestBodyWeightLb(),
        exercises: input.exerciseNames.map((name, index) => ({
          userExerciseId: 100 + index,
          name,
          sets: [],
          history: [],
        })),
      };
    },
    async listExercises() {
      const byName = new Map<
        string,
        RecentWorkout["exerciseSummaries"][number]
      >();
      for (const workout of recent) {
        for (const summary of workout.exerciseSummaries) {
          const { exerciseName } = splitExerciseSummary(summary);
          if (exerciseName && !byName.has(exerciseName)) {
            byName.set(exerciseName, summary);
          }
        }
      }

      return Array.from(byName.keys())
        .sort((a, b) => a.localeCompare(b))
        .map((name, index) => ({
          id: 10_000 + index,
          name,
          notes: null,
          exerciseId: null,
          plateStartingWeight: null,
          plateLoadMode: null,
        }));
    },
    async updateExerciseNote() {
      return { count: 1 };
    },
    async updateExercisePlateDefaults() {
      return { count: 1 };
    },
    async saveWorkout(input) {
      const nextId = recent.length + 1;
      recent.unshift({
        id: nextId,
        name: input.name,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        bodyWeightLb: input.bodyWeightLb,
        exerciseSummaries: input.exercises.map(
          (exercise) =>
            `${exercise.name} - ${
              summarizeCompletedExerciseSetGroup(
                exercise.sets.filter((set) => set.modifier !== "warmup"),
              ) ?? ""
            }`,
        ),
      });
      return { success: true, workoutId: nextId };
    },
    async getWorkoutDetails(input) {
      const prepared =
        preparedByWorkoutId.get(input.workoutId) ??
        blankPreparedWorkout(getLatestBodyWeightLb());
      const recentWorkout = recent.find(
        (workout) => workout.id === input.workoutId,
      );

      return {
        ...prepared,
        bodyWeightLb: prepared.bodyWeightLb ?? getLatestBodyWeightLb(),
        startedAt: recentWorkout?.startedAt ?? new Date(),
        completedAt: recentWorkout?.completedAt ?? null,
        notes: null,
      };
    },
    async updateWorkout(input) {
      const existingIndex = recent.findIndex(
        (workout) => workout.id === input.workoutId,
      );
      if (existingIndex >= 0) {
        recent[existingIndex] = {
          id: input.workoutId,
          name: input.workout.name,
          startedAt: input.workout.startedAt,
          completedAt: input.workout.completedAt,
          bodyWeightLb: input.workout.bodyWeightLb,
          exerciseSummaries: input.workout.exercises.map(
            (exercise) =>
              `${exercise.name} - ${
                summarizeCompletedExerciseSetGroup(
                  exercise.sets.filter((set) => set.modifier !== "warmup"),
                ) ?? ""
              }`,
          ),
        };
      }
      return { success: true, workoutId: input.workoutId };
    },
    async deleteWorkout(input) {
      const existingIndex = recent.findIndex(
        (workout) => workout.id === input.workoutId,
      );
      if (existingIndex >= 0) {
        recent.splice(existingIndex, 1);
      }
      return { success: true };
    },
  };
}

function useAppDialog() {
  const presentDialog = React.use(AppDialogContext);
  if (!presentDialog) {
    throw new Error("useAppDialog must be used inside AppDialogProvider");
  }
  return presentDialog;
}

function useAppModalLayerOpen() {
  return React.use(AppModalLayerOpenContext);
}

function useRegisterAppModalLayer(open: boolean) {
  const registerModal = React.use(AppModalLayerRegisterContext);

  useEffect(() => {
    if (!open || !registerModal) return undefined;
    return registerModal();
  }, [open, registerModal]);
}

function AppModalLayerProvider({ children }: { children: React.ReactNode }) {
  const [openCount, setOpenCount] = useState(0);
  const registerModal = useCallback(() => {
    let released = false;
    setOpenCount((count) => count + 1);

    return () => {
      if (released) return;
      released = true;
      setOpenCount((count) => Math.max(0, count - 1));
    };
  }, []);

  return (
    <AppModalLayerRegisterContext.Provider value={registerModal}>
      <AppModalLayerOpenContext.Provider value={openCount > 0}>
        {children}
      </AppModalLayerOpenContext.Provider>
    </AppModalLayerRegisterContext.Provider>
  );
}

function AppModal({ visible, children, ...props }: ModalProps) {
  useRegisterAppModalLayer(Boolean(visible));
  return (
    <Modal visible={visible} {...props}>
      {children}
    </Modal>
  );
}

function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<AppDialogState | null>(null);
  const presentDialog = useCallback((nextDialog: AppDialogState) => {
    setDialog(nextDialog);
  }, []);
  const dismissDialog = useCallback(() => setDialog(null), []);

  return (
    <AppDialogContext.Provider value={presentDialog}>
      {children}
      <AppDialogModal dialog={dialog} onDismiss={dismissDialog} />
    </AppDialogContext.Provider>
  );
}

function AppDialogModal({
  dialog,
  onDismiss,
}: {
  dialog: AppDialogState | null;
  onDismiss: () => void;
}) {
  if (!dialog) return null;

  return (
    <AppModal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <DismissibleModalShade onDismiss={onDismiss} style={styles.confirmDialogShade}>
        <View
          accessibilityRole="alert"
          accessible
          style={styles.confirmDialog}
        >
          <View style={styles.confirmDialogCopy}>
            <Text style={styles.confirmDialogTitle}>{dialog.title}</Text>
            {dialog.message ? (
              <Text style={styles.confirmDialogMessage}>{dialog.message}</Text>
            ) : null}
          </View>
          <View style={styles.confirmDialogActions}>
            {dialog.actions.map((action, index) => {
              const variant = action.variant ?? "default";
              return (
                <Pressable
                  key={`${action.label}-${index}`}
                  accessibilityLabel={action.label}
                  accessibilityRole="button"
                  style={[
                    styles.confirmDialogAction,
                    variant === "primary"
                      ? styles.confirmDialogActionPrimary
                      : null,
                  ]}
                  testID={action.testID}
                  onPress={() => {
                    onDismiss();
                    void action.onPress?.();
                  }}
                >
                  <Text
                    style={[
                      styles.confirmDialogActionText,
                      variant === "danger"
                        ? styles.confirmDialogActionTextDanger
                        : null,
                      variant === "cancel"
                        ? styles.confirmDialogActionTextMuted
                        : null,
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </DismissibleModalShade>
    </AppModal>
  );
}

export function LiftMobileApp({
  getHeaders,
  localDevUserId,
  onSignOut,
}: {
  getHeaders?: () => Promise<Record<string, string>>;
  localDevUserId?: string;
  onSignOut?: () => void;
}) {
  const localFixtures = useMemo(
    () => (localDevUserId ? createLocalWorkoutFixtures() : null),
    [localDevUserId],
  );
  const api = useMemo(
    () =>
      localFixtures
        ? createLocalWorkoutApiClient(localFixtures)
        : createWorkoutApiClient({
            baseUrl: mobileWorkoutApiBaseUrl,
            getHeaders,
          }),
    [getHeaders, localFixtures],
  );
  const [screen, setScreen] = useState<AppScreen>(() => ({
    name: "home",
    refreshKey: 0,
  }));
  const [pendingDraft, setPendingDraft] = useState<PendingWorkoutDraft | null>(
    null,
  );
  const checkedDraftRef = useRef(false);
  const returnHome = useCallback(() => {
    setScreen((current) => ({
      name: "home",
      refreshKey: current.name === "home" ? current.refreshKey + 1 : Date.now(),
    }));
  }, []);

  const restoreDraft = useCallback((draft: StoredWorkoutDraft) => {
    setPendingDraft(null);
    setScreen({
      name: "workout",
      key: Date.now(),
      viewMode: "active",
      prepared: blankPreparedWorkout(draft.workout.bodyWeightLb ?? null),
      draftWorkout: draft.workout,
      completedAt: draft.completedAt ? new Date(draft.completedAt) : null,
      contextLabel: "continued active workout",
    });
  }, []);

  useEffect(() => {
    if (checkedDraftRef.current) return;
    checkedDraftRef.current = true;

    let cancelled = false;
    void readActiveWorkoutDraft().then((draft) => {
      if (cancelled || !draft || draft.workout.exercises.length === 0) return;
      setPendingDraft(draft);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") return undefined;

    const subscription = addUnfinishedWorkoutReminderListener(() => {
      void readActiveWorkoutDraft().then((draft) => {
        if (!draft || draft.workout.exercises.length === 0) return;
        restoreDraft(draft);
      });
    });

    return () => subscription.remove();
  }, [restoreDraft]);

  const content =
    screen.name === "workout" ? (
      <MobileErrorBoundary
        key={`workout-boundary-${screen.key}`}
        scope="mobile-workout"
        screen={screen.workoutId ? "workout-edit" : "workout"}
        title="workout crashed"
        getHeaders={getHeaders}
        recoverLabel="home"
        onRecover={returnHome}
      >
        <WorkoutScreen
          api={api}
          prepared={screen.prepared}
          initialViewMode={screen.viewMode}
          draftWorkout={screen.draftWorkout}
          workoutId={screen.workoutId}
          startedAt={screen.startedAt}
          completedAt={screen.completedAt}
          workoutNote={screen.notes ?? null}
          contextLabel={screen.contextLabel}
          onBack={returnHome}
          onActiveDraftSaved={setPendingDraft}
        />
      </MobileErrorBoundary>
    ) : (
      <HomeScreen
        api={api}
        refreshKey={screen.refreshKey}
        pendingDraft={pendingDraft}
        onSignOut={onSignOut}
        onContinueDraft={restoreDraft}
        onStartBlank={(bodyWeightLb) =>
          setScreen({
            name: "workout",
            key: Date.now(),
            viewMode: "active",
            prepared: blankPreparedWorkout(bodyWeightLb),
          })
        }
        onStartPrepared={(prepared) =>
          setScreen({
            name: "workout",
            key: Date.now(),
            viewMode: "active",
            prepared,
          })
        }
        onEditWorkout={(workoutId, details) =>
          setScreen({
            name: "workout",
            key: Date.now(),
            viewMode: "past-review",
            workoutId,
            prepared: details,
            startedAt: details.startedAt,
            completedAt: details.completedAt,
            notes: details.notes ?? null,
            contextLabel: `editing past workout #${workoutId}`,
          })
        }
      />
    );

  return (
    <AppModalLayerProvider>
      <AppDialogProvider>{content}</AppDialogProvider>
    </AppModalLayerProvider>
  );
}

function HomeScreen({
  api,
  refreshKey,
  pendingDraft,
  onSignOut,
  onContinueDraft,
  onStartBlank,
  onStartPrepared,
  onEditWorkout,
}: {
  api: WorkoutApiClient;
  refreshKey: number;
  pendingDraft: PendingWorkoutDraft | null;
  onSignOut?: () => void;
  onContinueDraft: (draft: StoredWorkoutDraft) => void;
  onStartBlank: (bodyWeightLb: number | null) => void;
  onStartPrepared: (prepared: PreparedWorkout) => void;
  onEditWorkout: (workoutId: number, details: WorkoutDetails) => void;
}) {
  const insets = useSafeAreaInsets();
  const presentDialog = useAppDialog();
  const [workouts, setWorkouts] = useState<RecentWorkout[]>([]);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyingWorkoutId, setCopyingWorkoutId] = useState<number | null>(null);
  const [editingWorkoutId, setEditingWorkoutId] = useState<number | null>(null);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<number | null>(
    null,
  );
  const [now, setNow] = useState(() => Date.now());
  const loadRequestIdRef = useRef(0);
  const navigationRequestIdRef = useRef(0);
  const bottomDockInset = Math.max(insets.bottom, 12);
  const latestBodyWeightLb = useMemo(
    () =>
      workouts.find((workout) => workout.bodyWeightLb != null)?.bodyWeightLb ??
      null,
    [workouts],
  );
  const getPreviousBodyWeightLb = useCallback(
    (workout: RecentWorkout) => {
      const workoutIndex = workouts.findIndex(
        (entry) => entry.id === workout.id,
      );
      if (workoutIndex < 0) return latestBodyWeightLb;

      return (
        workouts
          .slice(workoutIndex + 1)
          .find((entry) => entry.bodyWeightLb != null)?.bodyWeightLb ??
        latestBodyWeightLb
      );
    },
    [latestBodyWeightLb, workouts],
  );

  const loadWorkouts = useCallback(
    async (nextLimit: number, options: { refresh?: boolean } = {}) => {
      const requestId = loadRequestIdRef.current + 1;
      loadRequestIdRef.current = requestId;
      if (options.refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const recent = await api.listRecent({ limit: nextLimit });
        if (loadRequestIdRef.current !== requestId) return;
        setWorkouts(recent);
      } catch (loadError) {
        if (loadRequestIdRef.current !== requestId) return;
        setError(getWorkoutApiErrorMessage(loadError));
      } finally {
        if (loadRequestIdRef.current !== requestId) return;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api],
  );

  useEffect(() => {
    void loadWorkouts(limit);
  }, [limit, loadWorkouts, refreshKey]);

  useEffect(() => {
    if (!pendingDraft || pendingDraft.completedAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pendingDraft]);

  const copyWorkout = async (workout: RecentWorkout) => {
    const requestId = navigationRequestIdRef.current + 1;
    navigationRequestIdRef.current = requestId;
    setCopyingWorkoutId(workout.id);
    setEditingWorkoutId(null);
    setError(null);
    try {
      const prepared = await api.prepareInitialWorkout({
        mode: "workoutReference",
        workoutId: workout.id,
      });
      if (navigationRequestIdRef.current !== requestId) return;
      onStartPrepared({
        ...prepared,
        bodyWeightLb: normalizeBodyWeightLb(
          prepared.bodyWeightLb ??
            workout.bodyWeightLb ??
            getPreviousBodyWeightLb(workout),
        ),
      });
    } catch (copyError) {
      if (navigationRequestIdRef.current !== requestId) return;
      setError(getWorkoutApiErrorMessage(copyError));
    } finally {
      if (navigationRequestIdRef.current === requestId) {
        setCopyingWorkoutId(null);
      }
    }
  };

  const editWorkout = async (workout: RecentWorkout) => {
    const requestId = navigationRequestIdRef.current + 1;
    navigationRequestIdRef.current = requestId;
    setEditingWorkoutId(workout.id);
    setCopyingWorkoutId(null);
    setError(null);
    try {
      const details = await api.getWorkoutDetails({ workoutId: workout.id });
      if (navigationRequestIdRef.current !== requestId) return;
      onEditWorkout(workout.id, {
        ...details,
        bodyWeightLb:
          details.bodyWeightLb ?? getPreviousBodyWeightLb(workout) ?? null,
      });
    } catch (editError) {
      if (navigationRequestIdRef.current !== requestId) return;
      setError(getWorkoutApiErrorMessage(editError));
    } finally {
      if (navigationRequestIdRef.current === requestId) {
        setEditingWorkoutId(null);
      }
    }
  };

  const deleteWorkout = async (workout: RecentWorkout) => {
    setDeletingWorkoutId(workout.id);
    setError(null);
    try {
      await api.deleteWorkout({ workoutId: workout.id });
      await loadWorkouts(limit);
    } catch (deleteError) {
      setError(getWorkoutApiErrorMessage(deleteError));
    } finally {
      setDeletingWorkoutId(null);
    }
  };

  const confirmDeleteWorkout = (workout: RecentWorkout) => {
    presentDialog({
      title: "Delete workout?",
      message: workout.name,
      actions: [
        { label: "cancel", variant: "cancel" },
        {
          label: "delete",
          variant: "danger",
          onPress: () => void deleteWorkout(workout),
        },
      ],
    });
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <View style={styles.topActions}>
        <Pressable
          accessibilityLabel="Start new workout"
          accessibilityRole="button"
          style={styles.iconButton}
          testID="home-start-new-workout"
          onPress={() => onStartBlank(latestBodyWeightLb)}
        >
          <Text style={styles.iconButtonText}>+</Text>
        </Pressable>
        {onSignOut ? (
          <Pressable
            accessibilityLabel="Sign out"
            accessibilityRole="button"
            style={styles.iconButton}
            testID="home-sign-out"
            onPress={onSignOut}
          >
            <Icon name="log-out-outline" />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.page,
          {
            paddingBottom: pendingDraft
              ? bottomDockInset + 118
              : insets.bottom + 24,
          },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadWorkouts(limit, { refresh: true })}
          />
        }
      >
        <Text style={styles.title}>Lift Prog</Text>
        <Text style={styles.subtleTitle}>workouts</Text>

        {loading && workouts.length === 0 ? (
          <View style={styles.centerRow}>
            <ActivityIndicator color={palette.active} />
            <Text style={styles.mutedText}>loading workouts</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {workouts.map((workout) => (
          <WorkoutHistoryRow
            key={workout.id}
            workout={workout}
            copying={copyingWorkoutId === workout.id}
            editing={editingWorkoutId === workout.id}
            deleting={deletingWorkoutId === workout.id}
            onCopy={() => void copyWorkout(workout)}
            onEdit={() => void editWorkout(workout)}
            onDelete={() => confirmDeleteWorkout(workout)}
          />
        ))}

        {workouts.length >= limit ? (
          <Pressable
            accessibilityLabel="Show more workouts"
            accessibilityRole="button"
            style={styles.textButton}
            testID="home-show-more-workouts"
            onPress={() => setLimit((current) => current + 10)}
          >
            <Text style={styles.textButtonText}>show more</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      {pendingDraft ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.activeWorkoutBannerDock,
            { paddingBottom: bottomDockInset },
          ]}
        >
          <ActiveWorkoutDraftBanner
            draft={pendingDraft}
            now={now}
            onContinue={onContinueDraft}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function ActiveWorkoutDraftBanner({
  draft,
  now,
  onContinue,
}: {
  draft: PendingWorkoutDraft | null;
  now: number;
  onContinue: (draft: StoredWorkoutDraft) => void;
}) {
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextPressRef = useRef(false);
  const restoringRef = useRef(false);

  if (!draft) return null;

  const startedAt = new Date(draft.workout.startTime);
  const endedAt = draft.completedAt ? new Date(draft.completedAt) : new Date(now);
  const restoreDraftFromBanner = () => {
    if (restoringRef.current) return;
    restoringRef.current = true;
    onContinue(draft);
  };
  const getTouchPoint = (event: GestureResponderEvent) => {
    const [touch] = event.nativeEvent.changedTouches;
    return {
      x: touch?.pageX ?? event.nativeEvent.pageX,
      y: touch?.pageY ?? event.nativeEvent.pageY,
    };
  };
  const handleTouchStart = (event: GestureResponderEvent) => {
    swipeStartRef.current = getTouchPoint(event);
    suppressNextPressRef.current = false;
  };
  const handleTouchEnd = (event: GestureResponderEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;

    const end = getTouchPoint(event);
    const dy = end.y - start.y;
    const dx = Math.abs(end.x - start.x);
    const didSwipeUp = dy <= -32 && dx <= 80;
    if (!didSwipeUp) return;

    suppressNextPressRef.current = true;
    triggerSelectionHaptic();
    restoreDraftFromBanner();
  };

  return (
    <Pressable
      accessibilityLabel={`Continue ${draft.workout.name}, active for ${formatElapsedClock(
        startedAt,
        endedAt,
      )}`}
      accessibilityRole="button"
      style={styles.activeWorkoutBanner}
      testID="active-workout-banner"
      onPress={() => {
        if (suppressNextPressRef.current) {
          suppressNextPressRef.current = false;
          return;
        }

        restoreDraftFromBanner();
      }}
      onTouchCancel={() => {
        swipeStartRef.current = null;
        suppressNextPressRef.current = false;
      }}
      onTouchEnd={handleTouchEnd}
      onTouchStart={handleTouchStart}
    >
      <View style={styles.activeWorkoutBannerGrip} />
      <Text style={styles.activeWorkoutBannerTitle}>{draft.workout.name}</Text>
      <Text style={styles.activeWorkoutBannerTime}>
        {formatElapsedClock(startedAt, endedAt)}
      </Text>
    </Pressable>
  );
}

function DismissibleModalShade({
  children,
  keyboardAvoiding = false,
  onDismiss,
  style = styles.modalShade,
}: {
  children: React.ReactNode;
  keyboardAvoiding?: boolean;
  onDismiss: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const content = (
    <Pressable
      accessible={false}
      style={styles.dismissibleModalContent}
      onPress={(event) => event.stopPropagation()}
    >
      {children}
    </Pressable>
  );

  return (
    <Pressable
      accessibilityViewIsModal
      accessible={false}
      style={style}
      onPress={onDismiss}
    >
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardAvoidingModalContent}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </Pressable>
  );
}

function useNativeKeyboardFrame() {
  const [frame, setFrame] = useState({ height: 0, visible: false });

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (event) =>
      setFrame({
        height: Math.max(0, event.endCoordinates.height),
        visible: true,
      }),
    );
    const hide = Keyboard.addListener(hideEvent, () =>
      setFrame((current) => ({ ...current, visible: false })),
    );

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return frame;
}

function WorkoutHistoryRow({
  workout,
  copying,
  editing,
  deleting,
  onCopy,
  onEdit,
  onDelete,
}: {
  workout: RecentWorkout;
  copying: boolean;
  editing: boolean;
  deleting: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const completedAt = workout.completedAt;
  return (
    <View style={styles.historyRow}>
      <View style={styles.rowHeader}>
        <View style={styles.flexColumn}>
          <Text style={styles.historyTitle}>{workout.name}</Text>
        </View>
        <View style={styles.rowActions}>
          <Pressable
            accessibilityLabel={`Copy ${workout.name} into a new workout`}
            accessibilityRole="button"
            style={styles.iconButtonSmall}
            testID={`home-copy-workout-${workout.id}`}
            onPress={onCopy}
            disabled={copying}
          >
            {copying ? (
              <Text style={styles.iconButtonTextSmall}>...</Text>
            ) : (
              <Icon name="copy-outline" size={20} />
            )}
          </Pressable>
          <Pressable
            accessibilityLabel={`Edit ${workout.name}`}
            accessibilityRole="button"
            style={styles.iconButtonSmall}
            testID={`home-edit-workout-${workout.id}`}
            onPress={onEdit}
            disabled={editing}
          >
            {editing ? (
              <Text style={styles.iconButtonTextSmall}>...</Text>
            ) : (
              <Icon name="pencil-outline" size={20} />
            )}
          </Pressable>
          <Pressable
            accessibilityLabel={`Delete ${workout.name}`}
            accessibilityRole="button"
            style={styles.iconButtonSmall}
            testID={`home-delete-workout-${workout.id}`}
            onPress={onDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Text style={styles.iconButtonTextSmall}>...</Text>
            ) : (
              <Icon name="trash-outline" size={20} />
            )}
          </Pressable>
        </View>
      </View>
      <Text style={styles.metaText}>
        {formatRelativeDate(completedAt)} . {formatDateTime(completedAt)} (
        {formatDuration(workout.startedAt, completedAt)})
      </Text>
      {workout.bodyWeightLb ? (
        <Text style={styles.noteBadge}>
          {formatNumber(workout.bodyWeightLb)}lb body weight
        </Text>
      ) : null}
      {workout.exerciseSummaries.map((summary) => {
        const { exerciseName, sets } = splitExerciseSummary(summary);
        return (
          <View key={summary} style={styles.historySummaryRow}>
            <Text style={styles.historySummaryName}>{exerciseName}</Text>
            <Text style={styles.historySummarySets}>{sets}</Text>
          </View>
        );
      })}
    </View>
  );
}

function splitExerciseSummary(summary: string) {
  const separator = " - ";
  const index = summary.indexOf(separator);
  if (index === -1) return { exerciseName: summary, sets: "" };
  return {
    exerciseName: summary.slice(0, index),
    sets: summary.slice(index + separator.length),
  };
}

function WorkoutScreen({
  api,
  prepared,
  initialViewMode,
  draftWorkout,
  workoutId,
  startedAt,
  completedAt: initialCompletedAt,
  workoutNote,
  contextLabel,
  onBack,
  onActiveDraftSaved,
}: {
  api: WorkoutApiClient;
  prepared: PreparedWorkout;
  initialViewMode?: WorkoutViewMode;
  draftWorkout?: Workout;
  workoutId?: number;
  startedAt?: Date;
  completedAt?: Date | null;
  workoutNote?: string | null;
  contextLabel?: string;
  onBack: () => void;
  onActiveDraftSaved?: (draft: StoredWorkoutDraft) => void;
}) {
  const insets = useSafeAreaInsets();
  const presentDialog = useAppDialog();
  const appModalLayerOpen = useAppModalLayerOpen();
  const { height: windowHeight } = useWindowDimensions();
  const isEditingPastWorkout = workoutId != null;
  const [viewMode, setViewMode] = useState<WorkoutViewMode>(
    initialViewMode ?? (isEditingPastWorkout ? "past-review" : "active"),
  );
  const isActiveWorkout = viewMode === "active";
  const isPastReview = viewMode === "past-review";
  const isPastEdit = viewMode === "past-edit";
  const canEditWorkout = isActiveWorkout || isPastEdit;
  const [session, setSession] = useState(() =>
    createWorkoutSession(
      draftWorkout
        ? ensureWorkoutSetIds(draftWorkout)
        : createWorkoutState(prepared, {
            startedAt,
            notes: workoutNote,
            isInProgress: !isEditingPastWorkout,
            preservePreparedValues: isEditingPastWorkout,
          }),
    ),
  );
  const workout = session.present;
  const canUndo =
    session.past.length > 0 || Boolean(session.pendingHistoryBase);
  const canRedo = session.future.length > 0;
  const [completedAt, setCompletedAt] = useState<Date | null>(
    initialCompletedAt ?? null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [addingExercise, setAddingExercise] = useState(false);
  const [exerciseSuggestions, setExerciseSuggestions] = useState<
    ExerciseSuggestion[]
  >([]);
  const [exerciseSuggestionsLoaded, setExerciseSuggestionsLoaded] =
    useState(false);
  const [setEditor, setSetEditor] = useState<SetEditTarget | null>(null);
  const [noteEditor, setNoteEditor] = useState<NoteEditTarget | null>(null);
  const [inlineNoteDraft, setInlineNoteDraft] = useState<string | null>(null);
  const [exercisePlanOpen, setExercisePlanOpen] = useState(false);
  const [workoutMenuOpen, setWorkoutMenuOpen] = useState(false);
  const [workoutMenuAnchor, setWorkoutMenuAnchor] =
    useState<MenuAnchor | null>(null);
  const [workoutNameEditing, setWorkoutNameEditing] = useState(false);
  const [workoutNameDraft, setWorkoutNameDraft] = useState<string | null>(null);
  const [workoutNoteEditing, setWorkoutNoteEditing] = useState(false);
  const [workoutNoteDraft, setWorkoutNoteDraft] = useState<string | null>(null);
  const [workoutTimeAdjustOpen, setWorkoutTimeAdjustOpen] = useState(false);
  const [timeEditor, setTimeEditor] = useState<TimeEditTarget | null>(null);
  const [finishPreviewOpen, setFinishPreviewOpen] = useState(false);
  const [watchSnapshotRequestNonce, setWatchSnapshotRequestNonce] =
    useState(0);
  const [bodyWeightEntry, setBodyWeightEntry] = useState<string | null>(null);
  const [healthWorkout, setHealthWorkout] = useState<HealthWorkoutState>({
    requested: false,
    live: false,
    starting: false,
    saving: false,
    message: null,
  });
  const [heartRateBpm, setHeartRateBpm] = useState<number | null>(null);
  const [timerStatus, setTimerStatus] = useState<string | null>(null);
  const [restTimerDurationSeconds, setRestTimerDurationSeconds] =
    useState(REST_TIMER_SECONDS);
  const [restTimerEndsAt, setRestTimerEndsAt] = useState<number | null>(null);
  const [restTimerDurationOpen, setRestTimerDurationOpen] = useState(false);
  const [restTimerDurationAnchor, setRestTimerDurationAnchor] =
    useState<MenuAnchor | null>(null);
  const [planDragging, setPlanDragging] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const draftWriteGenerationRef = useRef(0);
  const draftWritePromiseRef = useRef<Promise<void>>(Promise.resolve());
  const draftWritesSuppressedRef = useRef(false);
  const bodyWeightEditedRef = useRef(false);
  const healthPromptShownRef = useRef(false);
  const restTimerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const restTimerNotificationIdRef = useRef<string | null>(null);
  const workoutNameInputRef =
    useRef<React.ComponentRef<typeof TextInput> | null>(null);
  const workoutNoteInputRef =
    useRef<React.ComponentRef<typeof TextInput> | null>(null);
  const inlineNoteInputRef =
    useRef<React.ComponentRef<typeof TextInput> | null>(null);
  const workoutNameDraftRef = useRef<string | null>(null);
  const workoutNoteDraftRef = useRef<string | null>(null);
  const inlineNoteDraftRef = useRef<string | null>(null);
  const exercisePagerRef =
    useRef<React.ComponentRef<typeof ScrollView> | null>(null);
  const [exercisePagerContentTop, setExercisePagerContentTop] = useState<
    number | null
  >(null);

  useEffect(() => {
    const tickMs = restTimerEndsAt == null && completedAt ? 30_000 : 1_000;
    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [completedAt, restTimerEndsAt]);

  useEffect(
    () => () => {
      if (restTimerTimeoutRef.current) {
        clearTimeout(restTimerTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (isEditingPastWorkout || workout.exercises.length === 0) return;

    const generation = draftWriteGenerationRef.current + 1;
    draftWriteGenerationRef.current = generation;
    const timeout = setTimeout(() => {
      if (
        draftWritesSuppressedRef.current ||
        draftWriteGenerationRef.current !== generation
      ) {
        return;
      }

      const writePromise = writeActiveWorkoutDraft({
        workout,
        completedAt: completedAt?.toISOString() ?? null,
        savedAt: Date.now(),
      })
        .then(async () => {
          if (completedAt) {
            await cancelUnfinishedWorkoutNotification().catch(() => undefined);
            return;
          }

          await scheduleUnfinishedWorkoutNotification(
            workout.name,
            UNFINISHED_WORKOUT_REMINDER_SECONDS,
          ).catch(() => undefined);
        })
        .catch(() => {
          // A failed draft write or reminder update should not block the active workout.
        });
      draftWritePromiseRef.current = writePromise;
      void writePromise;
    }, 300);

    return () => clearTimeout(timeout);
  }, [completedAt, isEditingPastWorkout, workout]);

  useEffect(() => {
    let cancelled = false;
    setExerciseSuggestionsLoaded(false);
    void api
      .listExercises()
      .then((suggestions) => {
        if (!cancelled) setExerciseSuggestions(suggestions);
      })
      .catch(() => {
        if (!cancelled) setExerciseSuggestions([]);
      })
      .finally(() => {
        if (!cancelled) setExerciseSuggestionsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [api]);

  const dispatch = useCallback(
    (action: Action, options?: WorkoutDispatchOptions) => {
      setSession((current) =>
        applyWorkoutSessionAction(current, action, options),
      );
    },
    [],
  );
  const commitPendingHistory = useCallback(() => {
    setSession(commitPendingWorkoutHistory);
  }, []);
  const beginTextEditing = useCallback(() => {
    commitPendingHistory();
    setSetEditor(null);
  }, [commitPendingHistory]);
  const clearPersistedActiveWorkout = useCallback(async () => {
    draftWriteGenerationRef.current += 1;
    draftWritesSuppressedRef.current = true;
    await draftWritePromiseRef.current;
    await clearActiveWorkoutDraft();
    await cancelUnfinishedWorkoutNotification().catch(() => undefined);
  }, []);

  const applyLatestHealthBodyWeight = useCallback(
    async (options: { requestAuthorization?: boolean } = {}) => {
      if (Platform.OS !== "ios") return;
      if (options.requestAuthorization) {
        await requestHealthAuthorization();
      }
      const latest = await getLatestBodyWeight();
      const latestBodyWeight = normalizeBodyWeightLb(latest?.valueLb);
      if (latestBodyWeight == null || bodyWeightEditedRef.current) return;
      dispatch({
        type: "UPDATE_BODY_WEIGHT",
        bodyWeightLb: latestBodyWeight,
      });
    },
    [dispatch],
  );

  useEffect(() => {
    if (isEditingPastWorkout) return;
    if (Platform.OS !== "ios" || !isHealthAvailable()) return;

    void applyLatestHealthBodyWeight({ requestAuthorization: true }).catch(
      () => undefined,
    );
  }, [applyLatestHealthBodyWeight, isEditingPastWorkout]);

  useEffect(() => {
    if (Platform.OS !== "ios" || !healthWorkout.live) {
      setHeartRateBpm(null);
      return;
    }

    const subscription = addHeartRateSampleListener((sample) => {
      if (Number.isFinite(sample.bpm)) {
        setHeartRateBpm(Math.round(sample.bpm));
      }
    });

    return () => subscription.remove();
  }, [healthWorkout.live]);

  const startHealthWorkoutFlow = useCallback(async () => {
    if (Platform.OS !== "ios" || !isHealthAvailable()) {
      setHealthWorkout((current) => ({
        ...current,
        message: "Apple Health is not available on this device.",
      }));
      return;
    }

    setHealthWorkout((current) => ({
      ...current,
      starting: true,
      message: "preparing health save",
    }));

    try {
      const authorization = await requestHealthAuthorization();
      await applyLatestHealthBodyWeight().catch(() => undefined);

      if (!authorization.canWriteWorkouts) {
        setHealthWorkout({
          requested: false,
          live: false,
          starting: false,
          saving: false,
          message: "Health workout permission is off.",
        });
        return;
      }

      // The iPhone app can reliably save the completed workout to Health.
      // Continuous Apple Watch heart-rate capture needs a watch-owned workout
      // session, so do not start an iPhone live session here.
      setHealthWorkout({
        requested: true,
        live: false,
        starting: false,
        saving: false,
        message: "health workout will save on finish",
      });
    } catch (healthError) {
      setHealthWorkout({
        requested: false,
        live: false,
        starting: false,
        saving: false,
        message: getUnknownErrorMessage(healthError),
      });
    }
  }, [applyLatestHealthBodyWeight, workout.startTime]);

  useEffect(() => {
    if (isEditingPastWorkout || draftWorkout || healthPromptShownRef.current) {
      return;
    }
    if (Platform.OS !== "ios" || !isHealthAvailable()) {
      return;
    }

    healthPromptShownRef.current = true;
    presentDialog({
      title: "Save to Apple Health?",
      message: "Save this as strength training when the workout is finished.",
      actions: [
        { label: "not now", variant: "cancel" },
        {
          label: "save on finish",
          variant: "primary",
          onPress: () => void startHealthWorkoutFlow(),
        },
      ],
    });
  }, [
    draftWorkout,
    isEditingPastWorkout,
    presentDialog,
    startHealthWorkoutFlow,
  ]);

  const moveExerciseTo = useCallback(
    (exerciseIndex: number, targetIndex: number) => {
      dispatch({ type: "MOVE_EXERCISE_TO", exerciseIndex, targetIndex });
    },
    [dispatch],
  );

  const addExercise = async (exerciseName = newExerciseName) => {
    const name = exerciseName.trim();
    if (!name) return;
    setAddingExercise(true);
    setError(null);
    try {
      const preparedExercise = await api.prepareInitialWorkout({
        mode: "exerciseList",
        exerciseNames: [name],
        workoutName: workout.name,
      });
      const [exercise] = initialiseExercises(
        preparedExercise.exercises as PreviousExerciseData[],
      );
      if (!exercise) return;
      dispatch({
        type: "ADD_EXERCISE",
        exercise: resetExerciseCompletion(exercise),
      });
      setNewExerciseName("");
    } catch (addError) {
      setError(getWorkoutApiErrorMessage(addError));
    } finally {
      setAddingExercise(false);
    }
  };

  const updateWorkoutNote = (text: string) => {
    const nextText = text.trim();
    if (!nextText) {
      if (workout.notes[0]) {
        dispatch({ type: "DELETE_WORKOUT_NOTE", noteIndex: 0 });
      }
      return;
    }
    if (workout.notes[0]) {
      dispatch({ type: "UPDATE_WORKOUT_NOTE", noteIndex: 0, text: nextText });
    } else {
      dispatch({ type: "ADD_WORKOUT_NOTE", text: nextText });
    }
  };

  const finishWorkoutNameEdit = () => {
    const nextName = (workoutNameDraftRef.current ?? workoutNameDraft ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (nextName && nextName !== workout.name) {
      dispatch({ type: "UPDATE_WORKOUT_NAME", name: nextName });
    }
    setWorkoutNameEditing(false);
    setWorkoutNameDraft(null);
    workoutNameDraftRef.current = null;
  };

  const startWorkoutNameEdit = () => {
    beginTextEditing();
    if (workoutNoteEditing) finishWorkoutNoteEdit();
    setWorkoutNameDraft(workout.name);
    workoutNameDraftRef.current = workout.name;
    setWorkoutNameEditing(true);
  };

  const changeWorkoutNameDraft = (name: string) => {
    workoutNameDraftRef.current = name;
  };

  const finishWorkoutNoteEdit = () => {
    updateWorkoutNote(workoutNoteDraftRef.current ?? workoutNoteDraft ?? "");
    setWorkoutNoteEditing(false);
    setWorkoutNoteDraft(null);
    workoutNoteDraftRef.current = null;
  };

  const startWorkoutNoteEdit = () => {
    beginTextEditing();
    const draft = workout.notes[0]?.text ?? "";
    if (workoutNameEditing) finishWorkoutNameEdit();
    setWorkoutNoteDraft(draft);
    workoutNoteDraftRef.current = draft;
    setWorkoutNoteEditing(true);
  };

  const changeWorkoutNoteDraft = (note: string) => {
    workoutNoteDraftRef.current = note;
    setWorkoutNoteDraft(note);
  };

  const openNoteEditor = (target: NoteEditTarget) => {
    if (target.kind === "workout") {
      startWorkoutNoteEdit();
      return;
    }

    startInlineNoteEdit(target);
  };

  const finishInlineWorkoutTextEdit = () => {
    const wasEditingName = workoutNameEditing;
    const wasEditingNote = workoutNoteEditing;
    const wasEditingInlineNote = Boolean(
      noteEditor && noteEditor.kind !== "workout",
    );
    if (!wasEditingName && !wasEditingNote && !wasEditingInlineNote) return;

    if (wasEditingName) finishWorkoutNameEdit();
    if (wasEditingNote) finishWorkoutNoteEdit();
    if (wasEditingInlineNote) finishInlineNoteEdit();
    Keyboard.dismiss();
  };

  const handleInlineTextEditTouchCapture = (target: unknown) => {
    if (
      !workoutNameEditing &&
      !workoutNoteEditing &&
      !(noteEditor && noteEditor.kind !== "workout")
    ) {
      return false;
    }

    const focusedInput = TextInput.State.currentlyFocusedInput?.();
    const focusedInputHandle = findNodeHandle(
      focusedInput as unknown as Parameters<typeof findNodeHandle>[0],
    );
    const titleInputHandle = findNodeHandle(workoutNameInputRef.current);
    const noteInputHandle = findNodeHandle(workoutNoteInputRef.current);
    const inlineNoteInputHandle = findNodeHandle(inlineNoteInputRef.current);
    const nativeTarget =
      typeof target === "number"
        ? target
        : typeof target === "string" && Number.isFinite(Number(target))
          ? Number(target)
          : null;
    const inlineInputHandles = [
      focusedInputHandle,
      titleInputHandle,
      noteInputHandle,
      inlineNoteInputHandle,
    ].filter((handle): handle is number => handle != null);

    if (nativeTarget != null && inlineInputHandles.includes(nativeTarget)) {
      return false;
    }

    finishInlineWorkoutTextEdit();
    return false;
  };

  const updateWorkoutExerciseNote = (exerciseIndex: number, text: string) => {
    const exercise = workout.exercises[exerciseIndex];
    if (!exercise) return;
    const nextText = text.trim();
    if (!nextText) {
      if (exercise.notes[0]) {
        dispatch({ type: "DELETE_EXERCISE_NOTE", exerciseIndex, noteIndex: 0 });
      }
      return;
    }
    if (exercise.notes[0]) {
      dispatch({
        type: "UPDATE_EXERCISE_NOTE",
        exerciseIndex,
        noteIndex: 0,
        text: nextText,
      });
    } else {
      dispatch({ type: "ADD_EXERCISE_NOTE", exerciseIndex, text: nextText });
    }
  };

  const saveInlineNoteTarget = (
    target: InlineNoteEditTarget,
    text: string,
  ) => {
    if (target.kind === "exercise") {
      dispatch({
        type: "UPDATE_USER_EXERCISE_NOTE",
        exerciseIndex: target.exerciseIndex,
        note: text,
      });
      return;
    }

    if (target.kind === "workout-exercise") {
      updateWorkoutExerciseNote(target.exerciseIndex, text);
      return;
    }

    const exercise = workout.exercises[target.exerciseIndex];
    if (!exercise) return;
    const setIndex = findSetIndex(exercise, target.setId);
    if (setIndex == null) return;

    dispatch({
      type: "UPDATE_SET_NOTE",
      exerciseIndex: target.exerciseIndex,
      setIndex,
      notes: text,
    });
  };

  const finishInlineNoteEdit = () => {
    if (!noteEditor || noteEditor.kind === "workout") return;
    saveInlineNoteTarget(
      noteEditor,
      inlineNoteDraftRef.current ?? inlineNoteDraft ?? "",
    );
    setNoteEditor(null);
    setInlineNoteDraft(null);
    inlineNoteDraftRef.current = null;
  };

  const startInlineNoteEdit = (target: InlineNoteEditTarget) => {
    beginTextEditing();
    if (workoutNameEditing) finishWorkoutNameEdit();
    if (workoutNoteEditing) finishWorkoutNoteEdit();
    if (noteEditor && noteEditor.kind !== "workout") finishInlineNoteEdit();

    const draft = getNoteValue(workout, target);
    setNoteEditor(target);
    setInlineNoteDraft(draft);
    inlineNoteDraftRef.current = draft;
  };

  const changeInlineNoteDraft = (note: string) => {
    inlineNoteDraftRef.current = note;
  };

  const saveUserExerciseSettings = async (
    exerciseIndex: number,
    settings: UserExerciseSettings,
  ) => {
    const exercise = workout.exercises[exerciseIndex];
    if (!exercise) return;

    dispatch({
      type: "UPDATE_USER_EXERCISE_NOTE",
      exerciseIndex,
      note: settings.note,
    });
    dispatch({
      type: "UPDATE_USER_EXERCISE_PLATE_DEFAULTS",
      exerciseIndex,
      plateStartingWeight: settings.plateStartingWeight,
      plateLoadMode: settings.plateLoadMode,
    });

    const target =
      exercise.userExerciseId != null
        ? { id: exercise.userExerciseId }
        : { name: exercise.name };

    try {
      await Promise.all([
        api.updateExerciseNote({
          ...target,
          note: settings.note,
        }),
        api.updateExercisePlateDefaults({
          ...target,
          plateStartingWeight: settings.plateStartingWeight,
          plateLoadMode: settings.plateLoadMode,
        }),
      ]);
    } catch (settingsError) {
      setError(getWorkoutApiErrorMessage(settingsError));
    }
  };

  const updateStartTime = (startTime: number) => {
    const previousStartTime = workout.startTime;
    if (!Number.isFinite(startTime) || startTime === previousStartTime) return;

    if (completedAt) {
      const durationMs = completedAt.getTime() - previousStartTime;
      setCompletedAt(new Date(startTime + Math.max(60_000, durationMs)));
    }

    dispatch({ type: "UPDATE_WORKOUT_START_TIME", startTime });
  };

  const updateCompletedAt = (completedTime: number) => {
    if (!Number.isFinite(completedTime)) return;
    setCompletedAt(
      new Date(Math.max(workout.startTime + 60_000, completedTime)),
    );
  };

  const updateCompletedDuration = (durationMinutes: number) => {
    if (!Number.isFinite(durationMinutes)) return;
    setCompletedAt(completedAtForDuration(workout.startTime, durationMinutes));
  };

  const updateWorkoutTiming = (
    nextStartTime: number,
    nextCompletedTime: number | null,
  ) => {
    if (Number.isFinite(nextStartTime) && nextStartTime !== workout.startTime) {
      dispatch({ type: "UPDATE_WORKOUT_START_TIME", startTime: nextStartTime });
    }

    setCompletedAt(
      nextCompletedTime == null
        ? null
        : new Date(Math.max(nextStartTime + 60_000, nextCompletedTime)),
    );
  };

  const showFinishPreview = () => {
    if (!completedAt) {
      setCompletedAt(defaultCompletedAtForStartTime(workout.startTime));
    }
    setFinishPreviewOpen(true);
  };

  const getIncompleteSetSummary = () =>
    workout.exercises
      .map((exercise) => {
        const { warmups, working } = splitSets(exercise);
        const groups = [
          ...groupLedgerSets(warmups),
          ...groupLedgerSets(working),
        ];
        const incompleteLabels = groups
          .filter((group) => !group[0]?.set.completed)
          .map((group) => {
            const leadingSet = group[0];
            return leadingSet ? getLedgerSetIndexLabel(exercise, leadingSet) : "";
          })
          .filter(Boolean);

        return incompleteLabels.length
          ? `${exercise.name}: ${incompleteLabels.join(", ")}`
          : null;
      })
      .filter((summary): summary is string => Boolean(summary));

  const completeAllSets = () => {
    workout.exercises.forEach((exercise, exerciseIndex) => {
      if (exercise.sets.every((set) => set.completed)) return;
      dispatch({
        type: "REPLACE_EXERCISE_SETS",
        exerciseIndex,
        sets: exercise.sets.map((set) => ({ ...set, completed: true })),
      });
    });
  };

  const handleFinishPress = () => {
    if (!canEditWorkout) return;
    if (workout.exercises.length === 0) {
      setError("Add at least one exercise before finishing.");
      return;
    }

    const incomplete = getIncompleteSetSummary();
    if (incomplete.length > 0) {
      const visibleRows = incomplete.slice(0, 8);
      const remainingCount = incomplete.length - visibleRows.length;
      const message = [
        ...visibleRows,
        remainingCount > 0 ? `+ ${remainingCount} more` : null,
      ]
        .filter(Boolean)
        .join("\n");

      presentDialog({
        title: "Incomplete sets",
        message,
        actions: [
          { label: "return", variant: "cancel" },
          { label: "continue", onPress: showFinishPreview },
          {
            label: "complete all",
            variant: "primary",
            onPress: () => {
              completeAllSets();
              showFinishPreview();
            },
          },
        ],
      });
      return;
    }

    showFinishPreview();
  };

  const closeActiveWorkoutToHome = () => {
    const draft: StoredWorkoutDraft = {
      workout,
      completedAt: completedAt?.toISOString() ?? null,
      savedAt: Date.now(),
    };

    void draftWritePromiseRef.current
      .catch(() => undefined)
      .then(() => writeActiveWorkoutDraft(draft))
      .then(() => onActiveDraftSaved?.(draft))
      .finally(onBack);
  };

  const closeWorkout = () => {
    if (isEditingPastWorkout || workout.exercises.length === 0) {
      onBack();
      return;
    }

    presentDialog({
      title: "Close workout?",
      message: "This workout draft will stay saved on this device.",
      actions: [
        { label: "keep editing", variant: "cancel" },
        { label: "close", variant: "primary", onPress: closeActiveWorkoutToHome },
        {
          label: "discard",
          variant: "danger",
          onPress: () => {
            void Promise.allSettled([
              clearPersistedActiveWorkout(),
              cancelStrengthWorkout(),
            ]).finally(onBack);
          },
        },
      ],
    });
  };

  const finishedWorkout = useMemo(() => {
    if (!finishPreviewOpen) return null;
    const workoutNote = workout.notes[0]?.text;
    const payload = finalizeWorkout(workout, workoutNote);
    return {
      ...payload,
      completedAt:
        completedAt ?? defaultCompletedAtForStartTime(workout.startTime),
      startedAt: new Date(workout.startTime),
    };
  }, [completedAt, finishPreviewOpen, workout]);

  const saveFinishedWorkout = async () => {
    if (!finishedWorkout) return;
    setSaving(true);
    setError(null);
    try {
      if (isEditingPastWorkout && workoutId) {
        await api.updateWorkout({
          workoutId,
          workout: finishedWorkout,
        });
        setFinishPreviewOpen(false);
        onBack();
        return;
      }

      const shouldSaveHealthWorkout =
        Platform.OS === "ios" &&
        isHealthAvailable() &&
        (healthWorkout.requested ||
          (await getHealthAuthorizationStatus().catch(() => null))
            ?.canWriteWorkouts);

      if (shouldSaveHealthWorkout) {
        setHealthWorkout((current) => ({
          ...current,
          saving: true,
          message: "saving health workout",
        }));
        try {
          const healthResult = await withTimeout(
            finishStrengthWorkout(
              finishedWorkout.startedAt.getTime(),
              finishedWorkout.completedAt.getTime(),
            ),
            20_000,
            "Apple Health workout did not finish.",
          );
          setHealthWorkout((current) => ({
            ...current,
            live: false,
            saving: false,
            message: healthResult.saved
              ? "health workout saved"
              : (healthResult.message ?? "health workout was not saved"),
          }));
        } catch (healthError) {
          setHealthWorkout((current) => ({
            ...current,
            live: false,
            saving: false,
            message: `health save failed: ${getUnknownErrorMessage(healthError)}`,
          }));
        }
      }
      await api.saveWorkout(finishedWorkout);
      await clearPersistedActiveWorkout();
      setFinishPreviewOpen(false);
      onBack();
    } catch (saveError) {
      setError(getWorkoutApiErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const deleteWorkout = () => {
    if (!workoutId || isPastReview) return;
    presentDialog({
      title: "Delete workout?",
      message: workout.name,
      actions: [
        { label: "cancel", variant: "cancel" },
        {
          label: "delete",
          variant: "danger",
          onPress: async () => {
            setSaving(true);
            setError(null);
            try {
              await api.deleteWorkout({ workoutId });
              onBack();
            } catch (deleteError) {
              setError(getWorkoutApiErrorMessage(deleteError));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    });
  };

  const deleteExercise = (exerciseIndex: number) => {
    const exercise = workout.exercises[exerciseIndex];
    if (!exercise) return;
    presentDialog({
      title: "Delete exercise?",
      message: exercise.name,
      actions: [
        { label: "cancel", variant: "cancel" },
        {
          label: "delete",
          variant: "danger",
          onPress: () => dispatch({ type: "DELETE_EXERCISE", exerciseIndex }),
        },
      ],
    });
  };

  const stopRestTimer = () => {
    if (restTimerTimeoutRef.current) {
      clearTimeout(restTimerTimeoutRef.current);
      restTimerTimeoutRef.current = null;
    }
    const notificationId = restTimerNotificationIdRef.current;
    restTimerNotificationIdRef.current = null;
    void cancelWorkoutTimerNotification(notificationId).catch(() => undefined);
    void endRestTimerLiveActivity().catch(() => undefined);
    setRestTimerEndsAt(null);
    setTimerStatus(null);
  };

  const startRestTimer = async (durationSeconds?: number) => {
    const timerSeconds = normalizeRestTimerSeconds(
      durationSeconds ?? restTimerDurationSeconds,
    );
    stopRestTimer();

    setRestTimerDurationSeconds(timerSeconds);
    setTimerStatus(`starting ${formatRestTimerDurationLabel(timerSeconds)} timer`);
    try {
      const result = await withTimeout(
        scheduleWorkoutTimerNotification(timerSeconds),
        60_000,
        "Notification permission did not respond.",
      );
      if (result.scheduled) {
        const endsAt = Date.now() + timerSeconds * 1000;
        restTimerNotificationIdRef.current = result.identifier ?? null;
        void startOrUpdateRestTimerLiveActivity(
          timerSeconds,
          endsAt,
          `${formatRestTimerDurationLabel(timerSeconds)} rest`,
        ).catch(() => undefined);
        setNow(Date.now());
        setRestTimerEndsAt(endsAt);
        setTimerStatus(null);
        restTimerTimeoutRef.current = setTimeout(() => {
          setRestTimerEndsAt(null);
          setTimerStatus(`${formatRestTimerDurationLabel(timerSeconds)} timer done`);
          restTimerTimeoutRef.current = null;
          restTimerNotificationIdRef.current = null;
          void endRestTimerLiveActivity().catch(() => undefined);
        }, timerSeconds * 1000);
        return;
      }

      setTimerStatus(result.message ?? "timer was not scheduled");
    } catch (timerError) {
      setTimerStatus(getUnknownErrorMessage(timerError));
    }
  };

  const chooseRestTimerDuration = (durationSeconds: number) => {
    const timerSeconds = normalizeRestTimerSeconds(durationSeconds);
    setRestTimerDurationSeconds(timerSeconds);
    triggerSelectionHaptic();
  };

  const startChosenRestTimerDuration = (durationSeconds: number) => {
    const timerSeconds = normalizeRestTimerSeconds(durationSeconds);
    setRestTimerDurationSeconds(timerSeconds);
    setRestTimerDurationOpen(false);
    setRestTimerDurationAnchor(null);
    void startRestTimer(timerSeconds);
  };

  const toggleRestTimer = async () => {
    if (restTimerEndsAt != null || restTimerTimeoutRef.current) {
      stopRestTimer();
      return;
    }

    await startRestTimer();
  };
  const startRestTimerRef = useRef(startRestTimer);

  useEffect(() => {
    startRestTimerRef.current = startRestTimer;
  }, [startRestTimer]);

  const restTimerRemainingSeconds =
    restTimerEndsAt == null ? null : Math.ceil((restTimerEndsAt - now) / 1000);
  const restTimerCountdown =
    restTimerRemainingSeconds == null || restTimerRemainingSeconds <= 0
      ? null
      : formatCountdown(restTimerRemainingSeconds);
  const restTimerProgress =
    restTimerRemainingSeconds == null || restTimerRemainingSeconds <= 0
      ? 0
      : Math.max(
          0,
          Math.min(1, restTimerRemainingSeconds / restTimerDurationSeconds),
        );
  const timerStatusText = restTimerCountdown
    ? `rest ${restTimerCountdown}`
    : timerStatus;
  const restTimerIdleLabel = formatRestTimerDurationLabel(
    restTimerDurationSeconds,
  );
  const healthStatusText = healthWorkout.starting
    ? "health starting"
    : healthWorkout.saving
      ? "health saving"
      : healthWorkout.requested
        ? healthWorkout.live
          ? "health running"
          : "health save on finish"
        : healthWorkout.message;
  const bodyWeightText =
    workout.bodyWeightLb == null ? "" : formatNumber(workout.bodyWeightLb);
  const bodyWeightInputText = bodyWeightEntry ?? bodyWeightText;
  const finishPreviewBlockedByEditor =
    timeEditor === "finish-end-date" ||
    timeEditor === "finish-end-time" ||
    timeEditor === "finish-duration";
  const currentExerciseIndex = clampIndex(
    workout.currentExerciseIndex,
    workout.exercises.length,
  );
  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const subscription = addWatchWorkoutCommandListener(
      (command: WatchWorkoutCommand) => {
        if (!isActiveWorkout || completedAt) return;

        if (command.type === "requestSnapshot") {
          setWatchSnapshotRequestNonce((value) => value + 1);
          return;
        }

        if (command.type === "navigateExercise") {
          const nextExerciseIndex = getAdjacentIndex(
            currentExerciseIndex,
            workout.exercises.length,
            command.direction,
          );
          if (nextExerciseIndex == null || nextExerciseIndex === currentExerciseIndex) {
            setWatchSnapshotRequestNonce((value) => value + 1);
            return;
          }
          setSetEditor(null);
          dispatch({
            type: "SELECT_EXERCISE",
            exerciseIndex: nextExerciseIndex,
          });
          return;
        }

        if (command.type === "navigateSet") {
          const exercise = workout.exercises[currentExerciseIndex];
          const nextSet = getAdjacentWatchSetGroupTarget(
            exercise,
            command.setId ?? null,
            command.direction,
          );
          if (!nextSet) {
            setWatchSnapshotRequestNonce((value) => value + 1);
            return;
          }
          setSetEditor({
            exerciseIndex: currentExerciseIndex,
            setId: getSetTargetId(nextSet.set, nextSet.index),
            field: "reps",
          });
          return;
        }

        if (command.type === "startRestTimer") {
          if (restTimerEndsAt == null && !restTimerTimeoutRef.current) {
            void startRestTimerRef.current();
          } else {
            setWatchSnapshotRequestNonce((value) => value + 1);
          }
          return;
        }

        if (command.type === "resetRestTimer") {
          void startRestTimerRef.current(restTimerDurationSeconds);
          return;
        }

        if (command.type === "stopRestTimer") {
          stopRestTimer();
          return;
        }

        const target =
          command.setId == null
            ? null
            : findWatchCommandSetTarget(
                workout.exercises,
                currentExerciseIndex,
                command.setId,
              );
        if (!target) return;

        const exercise = workout.exercises[target.exerciseIndex];
        if (!exercise) return;
        const { setIndex } = target;
        const set = exercise.sets[setIndex];
        if (!set) return;

        if (command.type === "setSetValue") {
          const value = normalizeWatchSetValue(command, set);
          setSetEditor({
            exerciseIndex: target.exerciseIndex,
            setId: getSetTargetId(set, setIndex),
            field: command.field,
          });
          if (command.field === "weight") {
            dispatch({
              type: "UPDATE_SET_WEIGHT",
              exerciseIndex: target.exerciseIndex,
              setIndex,
              weight: value,
            });
          } else {
            dispatch({
              type: "UPDATE_SET_REPS",
              exerciseIndex: target.exerciseIndex,
              setIndex,
              reps: value,
            });
          }
          return;
        }

        const wasCompleted = Boolean(set.completed);
        triggerSelectionHaptic();
        dispatch({
          type: "TOGGLE_SET_COMPLETED",
          exerciseIndex: target.exerciseIndex,
          setIndex,
        });
        if (!wasCompleted) {
          void startRestTimerRef.current();
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [
    completedAt,
    currentExerciseIndex,
    dispatch,
    isActiveWorkout,
    restTimerDurationSeconds,
    restTimerEndsAt,
    workout.exercises,
  ]);
  const watchWorkoutSnapshot = useMemo(() => {
    if (
      isEditingPastWorkout ||
      completedAt ||
      workout.exercises.length === 0
    ) {
      return null;
    }

    const currentExercise = workout.exercises[currentExerciseIndex];
    if (!currentExercise) return null;
    const selectedSetId =
      setEditor?.exerciseIndex === currentExerciseIndex
        ? setEditor.setId
        : null;
    const currentSet = buildWatchCurrentSetSnapshot(
      currentExercise,
      selectedSetId,
    );

    return {
      workoutName: workout.name,
      exerciseName: currentExercise.name,
      setId: currentSet.setId,
      setLabel: currentSet.label,
      setText: currentSet.text,
      setWeight: currentSet.weight,
      setReps: currentSet.reps,
      setWeightModifier: currentSet.weightModifier,
      setCompleted: currentSet.completed,
      restText: restTimerCountdown
        ? `rest ${restTimerCountdown}`
        : `rest ${restTimerIdleLabel}`,
      restTimerRunning: restTimerRemainingSeconds != null,
      restTimerRemainingSeconds,
      restTimerDurationSeconds,
      isActive: true,
      updatedAt: new Date(now).toISOString(),
    };
  }, [
    completedAt,
    currentExerciseIndex,
    isEditingPastWorkout,
    now,
    restTimerCountdown,
    restTimerDurationSeconds,
    restTimerIdleLabel,
    restTimerRemainingSeconds,
    setEditor?.exerciseIndex,
    setEditor?.setId,
    workout,
  ]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    if (!watchWorkoutSnapshot) {
      void clearWatchWorkoutSnapshot().catch(() => undefined);
      return;
    }

    void updateWatchWorkoutSnapshot(watchWorkoutSnapshot).catch(
      () => undefined,
    );
  }, [watchSnapshotRequestNonce, watchWorkoutSnapshot]);

  const showExerciseTabs = workout.exercises.length > 0;
  const exercisePagerHeight = Math.max(
    360,
    windowHeight -
      insets.top -
      insets.bottom -
      (exercisePagerContentTop ?? 250) -
      12,
  );
  const exerciseNavigationLocked = appModalLayerOpen;
  const selectExerciseFromPagerOffset = useCallback(
    (offsetY: number) => {
      if (exerciseNavigationLocked) return;
      if (!workout.exercises.length) return;
      const nextIndex = clampIndex(
        Math.round(offsetY / exercisePagerHeight),
        workout.exercises.length,
      );
      if (nextIndex === workout.currentExerciseIndex) return;
      setSetEditor(null);
      dispatch({ type: "SELECT_EXERCISE", exerciseIndex: nextIndex });
    },
    [
      dispatch,
      exerciseNavigationLocked,
      exercisePagerHeight,
      workout.currentExerciseIndex,
      workout.exercises.length,
    ],
  );
  const selectExercise = useCallback(
    (exerciseIndex: number) => {
      if (exerciseNavigationLocked) return;
      setSetEditor(null);
      dispatch({ type: "SELECT_EXERCISE", exerciseIndex });
    },
    [dispatch, exerciseNavigationLocked],
  );

  useEffect(() => {
    if (!showExerciseTabs || exerciseNavigationLocked) return;
    exercisePagerRef.current?.scrollTo({
      y: currentExerciseIndex * exercisePagerHeight,
      animated: true,
    });
  }, [
    currentExerciseIndex,
    exerciseNavigationLocked,
    exercisePagerHeight,
    showExerciseTabs,
  ]);

  const renderExercisePage = (
    exercise: WorkoutExercise,
    exerciseIndex: number,
  ) => {
    const nextExercise = workout.exercises[exerciseIndex + 1] ?? null;

    return (
      <View
        key={`${exercise.userExerciseId ?? exercise.name}-${exerciseIndex}`}
        style={[styles.exercisePagerPage, { height: exercisePagerHeight }]}
      >
        <View style={styles.exercisePagerPageBody}>
          <ExerciseSection
            exercise={exercise}
            exerciseIndex={exerciseIndex}
            inlineNoteDraft={inlineNoteDraft}
            inlineNoteInputRef={inlineNoteInputRef}
            inlineNoteTarget={
              canEditWorkout &&
              noteEditor?.kind !== "workout" &&
              noteEditor?.exerciseIndex === exerciseIndex
                ? noteEditor
                : null
            }
            selectedField={
              setEditor?.exerciseIndex === exerciseIndex
                ? (setEditor.field ?? null)
                : null
            }
            selectedSetId={
              setEditor?.exerciseIndex === exerciseIndex
                ? setEditor.setId
                : null
            }
            viewMode={viewMode}
            onDispatch={dispatch}
            onChangeInlineNote={changeInlineNoteDraft}
            onEndInlineNoteEdit={finishInlineNoteEdit}
            onSelectExercise={() => selectExercise(exerciseIndex)}
            onOpenSetEditor={(setId, field) => {
              if (!canEditWorkout) return;
              selectExercise(exerciseIndex);
              setSetEditor({
                exerciseIndex,
                setId,
                field,
              });
            }}
            onOpenNoteEditor={openNoteEditor}
            onStartInlineNoteEdit={startInlineNoteEdit}
            onStartTextEdit={beginTextEditing}
            onStartRestTimer={() => {
              void startRestTimer();
            }}
            onDeleteExercise={deleteExercise}
            onSaveUserExerciseSettings={(targetExerciseIndex, settings) => {
              void saveUserExerciseSettings(targetExerciseIndex, settings);
            }}
          />
        </View>
        {nextExercise ? (
          <ExerciseNextHint
            exerciseName={nextExercise.name}
            onPress={() => selectExercise(exerciseIndex + 1)}
          />
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={[
          styles.workoutPage,
          { paddingBottom: insets.bottom + 24 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="always"
        onStartShouldSetResponderCapture={(event) =>
          handleInlineTextEditTouchCapture(event.nativeEvent.target)
        }
        onTouchStart={(event) => {
          handleInlineTextEditTouchCapture(event.nativeEvent.target);
        }}
        scrollEnabled={!planDragging && !showExerciseTabs}
      >
        {isPastReview ? (
          <PastReviewWorkoutHeader
            onBack={closeWorkout}
            onEdit={() => setViewMode("past-edit")}
          />
        ) : isPastEdit ? (
          <PastEditWorkoutHeader
            canRedo={canRedo}
            canUndo={canUndo}
            saving={saving}
            showDelete={Boolean(workoutId)}
            onBack={closeWorkout}
            onDelete={deleteWorkout}
            onRedo={() => setSession(redoWorkoutSession)}
            onSave={handleFinishPress}
            onUndo={() => setSession(undoWorkoutSession)}
          />
        ) : (
          <ActiveWorkoutHeader
            canRedo={canRedo}
            canUndo={canUndo}
            heartRateBpm={healthWorkout.live ? heartRateBpm : null}
            showHeartRate={healthWorkout.live}
            restTimerCountdown={restTimerCountdown}
            restTimerIdleLabel={restTimerIdleLabel}
            restTimerProgress={restTimerProgress}
            saving={saving}
            onBack={closeWorkout}
            onOpenRestTimerDuration={(anchor) => {
              if (restTimerEndsAt != null || restTimerTimeoutRef.current) return;
              setRestTimerDurationAnchor(anchor);
              setRestTimerDurationOpen(true);
            }}
            onRedo={() => setSession(redoWorkoutSession)}
            onSave={handleFinishPress}
            onToggleRestTimer={() => void toggleRestTimer()}
            onUndo={() => setSession(undoWorkoutSession)}
          />
        )}

        <WorkoutTitleSection
          canEditWorkout={canEditWorkout}
          completedAt={completedAt}
          editingName={workoutNameEditing}
          editingNote={workoutNoteEditing}
          now={now}
          startTime={workout.startTime}
          nameInputRef={workoutNameInputRef}
          noteInputRef={workoutNoteInputRef}
          workoutName={workout.name}
          workoutNameDraft={workoutNameDraft}
          workoutNote={workout.notes[0]?.text ?? ""}
          workoutNoteDraft={workoutNoteDraft}
          onChangeName={changeWorkoutNameDraft}
          onChangeNote={changeWorkoutNoteDraft}
          onEndNameEdit={finishWorkoutNameEdit}
          onEndNoteEdit={finishWorkoutNoteEdit}
          onOpenMenu={(anchor) => {
            setWorkoutMenuAnchor(anchor);
            setWorkoutMenuOpen(true);
          }}
          onStartNameEdit={startWorkoutNameEdit}
          onStartNoteEdit={startWorkoutNoteEdit}
        />
        {healthStatusText || timerStatusText ? (
          <Text style={styles.metaText}>
            {[healthStatusText, timerStatusText].filter(Boolean).join(" . ")}
          </Text>
        ) : null}

        {canEditWorkout ? (
          <View style={styles.inlineEditRow}>
            <Text style={styles.subtleTitle}>body weight</Text>
            <View style={styles.bodyWeightInputBox}>
              <TextInput
                value={bodyWeightInputText}
                placeholder="add"
                placeholderTextColor={palette.muted}
                onFocus={beginTextEditing}
                onChangeText={(value) => {
                  bodyWeightEditedRef.current = true;
                  setBodyWeightEntry(value);
                  const trimmed = value.trim();
                  if (!trimmed) {
                    dispatch({
                      type: "UPDATE_BODY_WEIGHT",
                      bodyWeightLb: null,
                    });
                    return;
                  }

                  const nextBodyWeight = parsePositiveDecimalInput(trimmed);
                  if (nextBodyWeight === "pending") return;
                  if (nextBodyWeight != null) {
                    dispatch({
                      type: "UPDATE_BODY_WEIGHT",
                      bodyWeightLb: nextBodyWeight,
                    });
                  }
                }}
                onBlur={() => setBodyWeightEntry(null)}
                keyboardType="decimal-pad"
                style={[
                  styles.bodyWeightInput,
                  {
                    width: getInlineTextInputWidth(
                      bodyWeightInputText || "add",
                    ),
                  },
                ]}
              />
              {workout.bodyWeightLb == null ? null : (
                <Text style={styles.bodyWeightUnit}>lb</Text>
              )}
            </View>
          </View>
        ) : workout.bodyWeightLb != null ? (
          <Text style={styles.metaText}>
            {formatNumber(workout.bodyWeightLb)}lb body weight
          </Text>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {showExerciseTabs ? (
          <WorkoutExerciseTabs
            editable={canEditWorkout}
            currentExerciseIndex={currentExerciseIndex}
            exercises={workout.exercises}
            onEdit={() => setExercisePlanOpen(true)}
            onSelect={selectExercise}
          />
        ) : null}

        {showExerciseTabs ? (
          <View
            style={[styles.exercisePagerViewport, { height: exercisePagerHeight }]}
            onLayout={(event) => {
              const nextTop = Math.round(event.nativeEvent.layout.y);
              setExercisePagerContentTop((previousTop) =>
                previousTop == null || Math.abs(previousTop - nextTop) > 1
                  ? nextTop
                  : previousTop,
              );
            }}
          >
            <ScrollView
              ref={exercisePagerRef}
              contentContainerStyle={styles.exercisePagerContent}
              decelerationRate="fast"
              keyboardShouldPersistTaps="always"
              nestedScrollEnabled
              pagingEnabled
              scrollEnabled={!exerciseNavigationLocked}
              showsVerticalScrollIndicator={false}
              snapToAlignment="start"
              snapToInterval={exercisePagerHeight}
              style={styles.exercisePagerScroll}
              onMomentumScrollEnd={(event) => {
                selectExerciseFromPagerOffset(
                  event.nativeEvent.contentOffset.y,
                );
              }}
              onScrollEndDrag={(event) => {
                selectExerciseFromPagerOffset(
                  event.nativeEvent.contentOffset.y,
                );
              }}
            >
              {workout.exercises.map(renderExercisePage)}
            </ScrollView>
          </View>
        ) : (
          <Text style={styles.metaText}>add an exercise</Text>
        )}
      </ScrollView>

      {canEditWorkout ? (
        <SetEditorModal
          workout={workout}
          target={setEditor}
          onClose={() => {
            commitPendingHistory();
            setSetEditor(null);
          }}
          onRetarget={(nextTarget) => {
            commitPendingHistory();
            setSetEditor(nextTarget);
          }}
          onStartRestTimer={() => {
            void startRestTimer();
          }}
          onDispatch={dispatch}
        />
      ) : null}
      <WorkoutTitleCommandMenu
        visible={canEditWorkout && workoutMenuOpen}
        anchor={workoutMenuAnchor}
        hasWorkoutNote={Boolean(workout.notes[0]?.text?.trim())}
        onAddNote={() => {
          setWorkoutMenuOpen(false);
          startWorkoutNoteEdit();
        }}
        onAdjustTime={() => {
          setWorkoutMenuOpen(false);
          setWorkoutTimeAdjustOpen(true);
        }}
        onClose={() => {
          setWorkoutMenuOpen(false);
          setWorkoutMenuAnchor(null);
        }}
        onEditName={() => {
          setWorkoutMenuOpen(false);
          startWorkoutNameEdit();
        }}
        onRemoveNote={() => {
          setWorkoutMenuOpen(false);
          setWorkoutNoteEditing(false);
          setWorkoutNoteDraft(null);
          updateWorkoutNote("");
        }}
      />
      {isActiveWorkout && restTimerDurationOpen ? (
        <RestTimerDurationSheet
          durationSeconds={restTimerDurationSeconds}
          anchor={restTimerDurationAnchor}
          restTimerCountdown={restTimerCountdown}
          restTimerProgress={restTimerProgress}
          onChooseDuration={chooseRestTimerDuration}
          onStartDuration={startChosenRestTimerDuration}
          onClose={() => {
            setRestTimerDurationOpen(false);
            setRestTimerDurationAnchor(null);
          }}
        />
      ) : null}
      <ExercisePlanModal
        visible={canEditWorkout && exercisePlanOpen}
        exercises={workout.exercises}
        newExerciseName={newExerciseName}
        addingExercise={addingExercise}
        exerciseSuggestions={exerciseSuggestions}
        exerciseSuggestionsLoaded={exerciseSuggestionsLoaded}
        onClose={() => {
          setPlanDragging(false);
          setExercisePlanOpen(false);
        }}
        onNewExerciseNameChange={setNewExerciseName}
        onAddExercise={(name) => void addExercise(name)}
        onMoveTo={moveExerciseTo}
        onDragStateChange={setPlanDragging}
        onTextInputFocus={beginTextEditing}
        onDelete={deleteExercise}
      />
      <WorkoutTimingEditorModal
        visible={canEditWorkout && workoutTimeAdjustOpen}
        completedAt={completedAt}
        now={now}
        startTime={workout.startTime}
        onClose={() => setWorkoutTimeAdjustOpen(false)}
        onSave={(nextStartTime, nextCompletedTime) => {
          updateWorkoutTiming(nextStartTime, nextCompletedTime);
          setWorkoutTimeAdjustOpen(false);
        }}
      />
      <WorkoutStartTimeEditor
        target={
          canEditWorkout && !isDurationEditTarget(timeEditor)
            ? timeEditor
            : null
        }
        startTime={workout.startTime}
        completedAt={completedAt}
        onClose={() => setTimeEditor(null)}
        onSaveStartTime={updateStartTime}
        onSaveCompletedAt={updateCompletedAt}
      />
      {canEditWorkout && isDurationEditTarget(timeEditor) ? (
        <WorkoutDurationEditor
          key={`${timeEditor}-${workout.startTime}-${completedAt?.getTime() ?? "running"}`}
          target={timeEditor}
          startTime={workout.startTime}
          completedAt={completedAt}
          onClose={() => setTimeEditor(null)}
          onSaveDuration={updateCompletedDuration}
        />
      ) : null}
      <FinishPreviewModal
        workout={finishedWorkout}
        saving={saving}
        open={finishPreviewOpen && !finishPreviewBlockedByEditor}
        saveLabel={isEditingPastWorkout ? "save changes" : "save workout"}
        onEditEndDate={() => setTimeEditor("finish-end-date")}
        onEditEndTime={() => setTimeEditor("finish-end-time")}
        onEditDuration={() => setTimeEditor("finish-duration")}
        onBack={() => setFinishPreviewOpen(false)}
        onSave={() => void saveFinishedWorkout()}
      />
    </SafeAreaView>
  );
}

function ActiveWorkoutHeader({
  canRedo,
  canUndo,
  heartRateBpm,
  showHeartRate,
  restTimerCountdown,
  restTimerIdleLabel,
  restTimerProgress,
  saving,
  onBack,
  onOpenRestTimerDuration,
  onRedo,
  onSave,
  onToggleRestTimer,
  onUndo,
}: {
  canRedo: boolean;
  canUndo: boolean;
  heartRateBpm: number | null;
  showHeartRate: boolean;
  restTimerCountdown: string | null;
  restTimerIdleLabel: string;
  restTimerProgress: number;
  saving: boolean;
  onBack: () => void;
  onOpenRestTimerDuration: (anchor: MenuAnchor | null) => void;
  onRedo: () => void;
  onSave: () => void;
  onToggleRestTimer: () => void;
  onUndo: () => void;
}) {
  const timerLongPressRef = useRef(false);
  const timerHoldTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const timerButtonRef = useRef<View | null>(null);
  const timerRunning = Boolean(restTimerCountdown);

  const openRestTimerDuration = () => {
    const timerButton = timerButtonRef.current;
    if (!timerButton) {
      onOpenRestTimerDuration(null);
      return;
    }

    timerButton.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      onOpenRestTimerDuration({
        x,
        y,
        width: measuredWidth,
        height: measuredHeight,
      });
    });
  };
  return (
    <View style={styles.topActions}>
      <View style={styles.topLeftActions}>
        <Pressable
          ref={timerButtonRef}
          accessibilityLabel={
            restTimerCountdown
              ? "Stop rest timer"
              : `Start ${restTimerIdleLabel} rest timer`
          }
          accessibilityRole="button"
          style={[
            styles.timerButton,
            timerRunning ? styles.timerButtonRunning : null,
          ]}
          testID="workout-rest-timer"
          delayLongPress={REST_TIMER_HOLD_DELAY_MS}
          onPressIn={() => {
            if (timerHoldTimeoutRef.current) {
              clearTimeout(timerHoldTimeoutRef.current);
            }
            timerLongPressRef.current = false;
            timerHoldTimeoutRef.current = setTimeout(() => {
              timerHoldTimeoutRef.current = null;
              timerLongPressRef.current = true;
              openRestTimerDuration();
            }, REST_TIMER_HOLD_DELAY_MS);
          }}
          onLongPress={() => {
            if (timerLongPressRef.current) return;
            if (timerHoldTimeoutRef.current) {
              clearTimeout(timerHoldTimeoutRef.current);
              timerHoldTimeoutRef.current = null;
            }
            timerLongPressRef.current = true;
            openRestTimerDuration();
          }}
          onPressOut={() => {
            if (timerHoldTimeoutRef.current) {
              clearTimeout(timerHoldTimeoutRef.current);
              timerHoldTimeoutRef.current = null;
            }
            if (!timerLongPressRef.current) return;
            requestAnimationFrame(() => {
              timerLongPressRef.current = false;
            });
          }}
          onPress={() => {
            if (timerLongPressRef.current) {
              return;
            }
            onToggleRestTimer();
          }}
        >
          {timerRunning ? (
            <View
              pointerEvents="none"
              style={[
                styles.timerButtonProgressFill,
                { width: `${Math.round(restTimerProgress * 100)}%` },
              ]}
            />
          ) : null}
          <View style={styles.timerButtonContent}>
            <Icon name="timer-outline" size={18} color={palette.ink} />
            <Text style={styles.timerButtonText}>
              {restTimerCountdown ?? restTimerIdleLabel}
            </Text>
          </View>
        </Pressable>
        {showHeartRate ? (
          <View
            accessibilityLabel={
              heartRateBpm == null
                ? "Heart rate waiting for sample"
                : `Heart rate ${heartRateBpm} beats per minute`
            }
            style={styles.heartRateIndicator}
          >
            <Icon name="heart" size={14} color={palette.danger} />
            <Text style={styles.heartRateText}>{heartRateBpm ?? "--"}</Text>
          </View>
        ) : null}
      </View>

      <WorkoutHeaderActions
        canRedo={canRedo}
        canUndo={canUndo}
        saving={saving}
        saveKind="finish"
        saveLabel="Finish workout"
        showOnlyAvailableHistoryActions
        onBack={onBack}
        onRedo={onRedo}
        onSave={onSave}
        onUndo={onUndo}
      />
    </View>
  );
}

function RestTimerDurationSheet({
  durationSeconds,
  anchor,
  restTimerCountdown,
  restTimerProgress,
  onChooseDuration,
  onStartDuration,
  onClose,
}: {
  durationSeconds: number;
  anchor: MenuAnchor | null;
  restTimerCountdown: string | null;
  restTimerProgress: number;
  onChooseDuration: (durationSeconds: number) => void;
  onStartDuration: (durationSeconds: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const initialMode = REST_TIMER_PRESET_SECONDS.includes(durationSeconds)
    ? "preset"
    : "custom";
  const [mode, setMode] = useState<"preset" | "custom">(initialMode);
  const [selectedSeconds, setSelectedSeconds] = useState(
    normalizeRestTimerSeconds(durationSeconds),
  );
  const selectedSecondsRef = useRef(selectedSeconds);
  const sheetTop = Math.max(8, Math.round(anchor?.y ?? insets.top + 48));
  const durationOptions =
    mode === "preset" ? REST_TIMER_PRESET_SECONDS : REST_TIMER_CUSTOM_SECONDS;
  const pickerSelectedSeconds = durationOptions.includes(selectedSeconds)
    ? selectedSeconds
    : closestRestTimerOption(selectedSeconds, durationOptions);
  const timerRunning = Boolean(restTimerCountdown);

  const chooseDuration = (nextSeconds: number) => {
    const normalized = normalizeRestTimerSeconds(nextSeconds);
    if (selectedSecondsRef.current === normalized) return;
    selectedSecondsRef.current = normalized;
    setSelectedSeconds(normalized);
    onChooseDuration(normalized);
  };

  const handleModeChange = (nextMode: "preset" | "custom") => {
    const nextOptions =
      nextMode === "preset"
        ? REST_TIMER_PRESET_SECONDS
        : REST_TIMER_CUSTOM_SECONDS;
    const nextSelected = closestRestTimerOption(
      selectedSecondsRef.current,
      nextOptions,
    );
    setMode(nextMode);
    chooseDuration(nextSelected);
  };

  return (
    <AppModal visible transparent animationType="fade" onRequestClose={onClose}>
      <DismissibleModalShade
        onDismiss={onClose}
        style={[
          styles.restTimerDurationShade,
          {
            paddingBottom: Math.max(10, insets.bottom + 10),
            paddingTop: sheetTop,
          },
        ]}
      >
        <View style={styles.restTimerDurationSheet}>
          <View style={styles.restTimerDurationHeader}>
            <Pressable
              accessibilityLabel="Close rest timer duration"
              accessibilityRole="button"
              style={styles.iconButtonSmall}
              testID="rest-timer-duration-close"
              onPress={onClose}
            >
              <Icon name="close-outline" size={24} />
            </Pressable>
            <Text style={styles.restTimerDurationTitle}>rest timer</Text>
            <View style={styles.iconButtonSpacer} />
          </View>

          <Text style={styles.restTimerDurationHelp}>
            choose a duration. start when ready.
          </Text>

          <View style={styles.restTimerModeToggle}>
            {(["preset", "custom"] as const).map((nextMode) => {
              const selected = mode === nextMode;
              return (
                <Pressable
                  key={nextMode}
                  accessibilityLabel={`Show ${nextMode} rest timer durations`}
                  accessibilityRole="button"
                  style={[
                    styles.restTimerModeButton,
                    selected ? styles.restTimerModeButtonSelected : null,
                  ]}
                  testID={`rest-timer-mode-${nextMode}`}
                  onPress={() => handleModeChange(nextMode)}
                >
                  <Text
                    style={[
                      styles.restTimerModeText,
                      selected ? styles.restTimerModeTextSelected : null,
                    ]}
                  >
                    {nextMode}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.restTimerPickerFrame}>
            <Picker
              itemStyle={styles.restTimerPickerItem}
              selectedValue={pickerSelectedSeconds}
              style={styles.restTimerPicker}
              testID="rest-timer-duration-picker"
              onValueChange={(value) => chooseDuration(Number(value))}
            >
              {durationOptions.map((optionSeconds) => (
                <Picker.Item
                  key={optionSeconds}
                  label={formatCountdown(optionSeconds)}
                  value={optionSeconds}
                />
              ))}
            </Picker>
          </View>

          <Pressable
            accessibilityLabel={
              timerRunning
                ? `Reset rest timer, ${restTimerCountdown} left`
                : `Start ${formatCountdown(selectedSeconds)} rest timer`
            }
            accessibilityRole="button"
            style={[
              styles.restTimerUseCustomButton,
              timerRunning ? styles.restTimerUseCustomButtonRunning : null,
            ]}
            testID="rest-timer-start-selected"
            onPress={() => onStartDuration(selectedSeconds)}
          >
            {timerRunning ? (
              <View
                pointerEvents="none"
                style={[
                  styles.timerButtonProgressFill,
                  { width: `${Math.round(restTimerProgress * 100)}%` },
                ]}
              />
            ) : null}
            <Text style={styles.restTimerUseCustomText}>
              {timerRunning ? restTimerCountdown : `start ${formatCountdown(selectedSeconds)}`}
            </Text>
          </Pressable>
        </View>
      </DismissibleModalShade>
    </AppModal>
  );
}

function WorkoutTitleSection({
  canEditWorkout,
  completedAt,
  editingName,
  editingNote,
  nameInputRef,
  noteInputRef,
  now,
  startTime,
  workoutName,
  workoutNameDraft,
  workoutNote,
  workoutNoteDraft,
  onChangeName,
  onChangeNote,
  onEndNameEdit,
  onEndNoteEdit,
  onOpenMenu,
  onStartNameEdit,
  onStartNoteEdit,
}: {
  canEditWorkout: boolean;
  completedAt: Date | null;
  editingName: boolean;
  editingNote: boolean;
  nameInputRef: React.RefObject<React.ComponentRef<typeof TextInput> | null>;
  noteInputRef: React.RefObject<React.ComponentRef<typeof TextInput> | null>;
  now: number;
  startTime: number;
  workoutName: string;
  workoutNameDraft: string | null;
  workoutNote: string;
  workoutNoteDraft: string | null;
  onChangeName: (name: string) => void;
  onChangeNote: (note: string) => void;
  onEndNameEdit: () => void;
  onEndNoteEdit: () => void;
  onOpenMenu: (anchor: MenuAnchor | null) => void;
  onStartNameEdit: () => void;
  onStartNoteEdit: () => void;
}) {
  const presentDialog = useAppDialog();
  const { width } = useWindowDimensions();
  const menuButtonRef = useRef<View | null>(null);
  const startedAt = new Date(startTime);
  const timingEnd = completedAt ?? new Date(now);
  const titleEditValue = workoutNameDraft ?? workoutName;
  const noteValue = workoutNoteDraft ?? workoutNote;
  const titleInputWidth = Math.min(
    getWorkoutTitleInputWidth(titleEditValue),
    Math.max(80, width - 96),
  );

  useEffect(() => {
    if (!editingName) return;

    const frame = requestAnimationFrame(() => nameInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [editingName, nameInputRef]);

  useEffect(() => {
    if (!editingNote) return;

    const frame = requestAnimationFrame(() => noteInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [editingNote]);

  const openMenu = () => {
    const menuButton = menuButtonRef.current;
    if (!menuButton) {
      onOpenMenu(null);
      return;
    }

    menuButton.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      onOpenMenu({
        x,
        y,
        width: measuredWidth,
        height: measuredHeight,
      });
    });
  };

  return (
    <View style={styles.workoutTitleBlock}>
      <View style={styles.workoutTitleHeader}>
        {editingName ? (
          <TextInput
            key={titleEditValue}
            ref={nameInputRef}
            accessibilityLabel="Edit workout name"
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect={false}
            importantForAutofill="no"
            inputMode="text"
            keyboardType="default"
            multiline={false}
            returnKeyType="done"
            selectTextOnFocus
            style={[styles.workoutTitleEditingInput, { width: titleInputWidth }]}
            testID="workout-title-inline-input"
            textContentType="none"
            defaultValue={titleEditValue}
            onBlur={onEndNameEdit}
            onChangeText={onChangeName}
            onTouchStart={(event) => event.stopPropagation()}
            onSubmitEditing={onEndNameEdit}
          />
        ) : canEditWorkout ? (
          <Pressable
            accessibilityLabel="Edit workout name"
            accessibilityRole="button"
            hitSlop={4}
            style={styles.workoutTitleDisplayPressable}
            testID="workout-title-display"
            onPress={onStartNameEdit}
          >
            <Text numberOfLines={2} style={styles.workoutTitleDisplay}>
              {workoutName}
            </Text>
          </Pressable>
        ) : (
          <Text numberOfLines={2} style={styles.workoutTitleDisplay}>
            {workoutName}
          </Text>
        )}
        {canEditWorkout ? (
          <Pressable
            ref={menuButtonRef}
            accessibilityLabel="Workout title options"
            accessibilityRole="button"
            hitSlop={8}
          style={styles.workoutTitleMenuButton}
          testID="workout-title-menu"
          onPress={openMenu}
        >
          <Icon name="ellipsis-horizontal" size={20} color={palette.ink} />
        </Pressable>
        ) : null}
      </View>
      <View style={styles.workoutTitleMetaRow}>
        <Icon name="calendar-outline" size={18} color={palette.muted} />
        <Text style={styles.workoutTitleMetaText}>
          {formatTitleDate(startedAt)}
        </Text>
      </View>
      <View style={styles.workoutTitleMetaRow}>
        <Icon name="time-outline" size={19} color={palette.muted} />
        <Text style={styles.workoutTitleMetaText}>
          {formatElapsedClock(startedAt, timingEnd)}
        </Text>
      </View>
      {editingNote ? (
        <TextInput
          ref={noteInputRef}
          accessibilityLabel="Edit workout note"
          autoComplete="off"
          autoCapitalize="sentences"
          autoCorrect={false}
          autoFocus
          contextMenuHidden
          defaultValue={noteValue}
          blurOnSubmit={false}
          importantForAutofill="no"
          inputMode="text"
          keyboardType="default"
          multiline
          placeholder="Notes"
          placeholderTextColor={palette.muted}
          spellCheck={false}
          returnKeyType="default"
          selectTextOnFocus={false}
          textContentType="none"
          style={styles.workoutTitleNoteInput}
          testID="workout-note-inline-input"
          onBlur={onEndNoteEdit}
          onChangeText={onChangeNote}
          onTouchStart={(event) => event.stopPropagation()}
        />
      ) : workoutNote ? (
        canEditWorkout ? (
          <Pressable
            accessibilityLabel="Edit workout note"
            accessibilityRole="button"
            hitSlop={6}
            onPress={onStartNoteEdit}
          >
            <Text style={styles.workoutTitleNoteText}>{workoutNote}</Text>
          </Pressable>
        ) : (
          <Text style={styles.workoutTitleNoteText}>{workoutNote}</Text>
        )
      ) : null}
    </View>
  );
}

function InlineNoteEditor({
  iconName,
  inputRef,
  note,
  placeholder,
  testID,
  onBlur,
  onChangeText,
}: {
  iconName?: IconName;
  inputRef: React.RefObject<React.ComponentRef<typeof TextInput> | null>;
  note: string;
  placeholder: string;
  testID: string;
  onBlur: () => void;
  onChangeText: (note: string) => void;
}) {
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [inputRef, testID]);

  const input = (
    <TextInput
      key={`${testID}-${note}`}
      ref={inputRef}
      accessibilityLabel={placeholder}
      autoComplete="off"
      autoCapitalize="sentences"
      autoCorrect={false}
      blurOnSubmit={false}
      contextMenuHidden
      defaultValue={note}
      importantForAutofill="no"
      inputMode="text"
      keyboardType="default"
      multiline
      placeholder={placeholder}
      placeholderTextColor={palette.muted}
      returnKeyType="default"
      selectTextOnFocus={false}
      spellCheck={false}
      style={[
        styles.inlineNoteInput,
        iconName ? null : styles.inlineNoteInputPlain,
      ]}
      testID={testID}
      textContentType="none"
      onBlur={onBlur}
      onChangeText={onChangeText}
      onTouchStart={(event) => event.stopPropagation()}
    />
  );

  if (!iconName) return input;

  return (
    <View style={styles.inlineNoteInputRow}>
      <Icon name={iconName} size={13} color={palette.muted} />
      {input}
    </View>
  );
}

function WorkoutTitleCommandMenu({
  visible,
  anchor,
  hasWorkoutNote,
  onAddNote,
  onAdjustTime,
  onClose,
  onEditName,
  onRemoveNote,
}: {
  visible: boolean;
  anchor: MenuAnchor | null;
  hasWorkoutNote: boolean;
  onAddNote: () => void;
  onAdjustTime: () => void;
  onClose: () => void;
  onEditName: () => void;
  onRemoveNote: () => void;
}) {
  const menuTop = Math.max(8, Math.round(anchor?.y ?? 132));

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <DismissibleModalShade onDismiss={onClose} style={styles.commandMenuShade}>
        <View style={[styles.commandMenuPanel, { top: menuTop }]}>
          <CommandMenuItem
            icon="pencil-outline"
            label="Edit Workout Name"
            onPress={onEditName}
            testID="workout-menu-edit-name"
          />
          <CommandMenuItem
            icon="refresh-outline"
            label="Adjust Start/End Time"
            onPress={onAdjustTime}
            testID="workout-menu-adjust-time"
          />
          {hasWorkoutNote ? (
            <CommandMenuItem
              danger
              icon="trash-outline"
              label="Remove Note"
              onPress={onRemoveNote}
              testID="workout-menu-remove-note"
            />
          ) : (
            <CommandMenuItem
              icon="document-outline"
              label="Add Note"
              onPress={onAddNote}
              testID="workout-menu-add-note"
            />
          )}
        </View>
      </DismissibleModalShade>
    </AppModal>
  );
}

function ExerciseCommandMenu({
  visible,
  anchor,
  onAddNote,
  onAddPinnedNote,
  onClose,
  onOpenPreferences,
  onRemoveExercise,
}: {
  visible: boolean;
  anchor: MenuAnchor | null;
  onAddNote: () => void;
  onAddPinnedNote: () => void;
  onClose: () => void;
  onOpenPreferences: () => void;
  onRemoveExercise: () => void;
}) {
  const menuTop = Math.max(8, Math.round(anchor?.y ?? 312));

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <DismissibleModalShade onDismiss={onClose} style={styles.commandMenuShade}>
        <View style={[styles.commandMenuPanel, { top: menuTop }]}>
          <CommandMenuItem
            icon="document-outline"
            label="Add Note"
            onPress={onAddNote}
            testID="exercise-menu-add-note"
          />
          <CommandMenuItem
            icon="pin-outline"
            label="Add Pinned Note"
            onPress={onAddPinnedNote}
            testID="exercise-menu-add-pinned-note"
          />
          <CommandMenuItem
            icon="options-outline"
            label="Preferences"
            onPress={onOpenPreferences}
            testID="exercise-menu-preferences"
          />
          <CommandMenuItem
            danger
            icon="close-outline"
            label="Remove Exercise"
            onPress={onRemoveExercise}
            testID="exercise-menu-remove"
          />
        </View>
      </DismissibleModalShade>
    </AppModal>
  );
}

function CommandMenuItem({
  danger = false,
  icon,
  label,
  onPress,
  testID,
}: {
  danger?: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      style={styles.commandMenuItem}
      testID={testID}
      onPress={onPress}
    >
      <Icon name={icon} size={21} color={danger ? palette.danger : palette.muted} />
      <Text
        style={[
          styles.commandMenuItemText,
          danger ? styles.commandMenuItemTextDanger : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function WorkoutTimingEditorModal({
  visible,
  completedAt,
  now,
  startTime,
  onClose,
  onSave,
}: {
  visible: boolean;
  completedAt: Date | null;
  now: number;
  startTime: number;
  onClose: () => void;
  onSave: (startTime: number, completedTime: number | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const [draftStart, setDraftStart] = useState(() => new Date(startTime));
  const [draftCompleted, setDraftCompleted] = useState<Date | null>(
    () => completedAt,
  );
  const [selectedField, setSelectedField] = useState<"start" | "end" | null>(
    null,
  );

  useEffect(() => {
    if (!visible) return;
    setDraftStart(new Date(startTime));
    setDraftCompleted(completedAt);
    setSelectedField(null);
  }, [completedAt, startTime, visible]);

  const automaticTiming = draftCompleted == null;
  const durationEnd = draftCompleted ?? new Date(now);
  const selectedPickerValue =
    selectedField === "start"
      ? draftStart
      : (draftCompleted ?? defaultCompletedAtForStartTime(draftStart.getTime()));

  const toggleAutomaticTiming = () => {
    if (automaticTiming) {
      setDraftCompleted(defaultCompletedAtForStartTime(draftStart.getTime()));
      setSelectedField("end");
    } else {
      setDraftCompleted(null);
      setSelectedField(null);
    }
  };

  const updateStart = (nextStart: Date) => {
    const previousDurationMs =
      draftCompleted == null
        ? null
        : Math.max(60_000, draftCompleted.getTime() - draftStart.getTime());
    setDraftStart(nextStart);
    if (previousDurationMs != null) {
      setDraftCompleted(new Date(nextStart.getTime() + previousDurationMs));
    }
  };

  const updateEnd = (nextEnd: Date) => {
    setDraftCompleted(
      new Date(Math.max(draftStart.getTime() + 60_000, nextEnd.getTime())),
    );
  };

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <DismissibleModalShade
        onDismiss={onClose}
        style={[
          styles.adjustTimeShade,
          {
            paddingBottom: Math.max(8, insets.bottom + 8),
            paddingTop: Math.max(8, insets.top + 8),
          },
        ]}
      >
        <View style={styles.adjustTimeSheet}>
          <View style={styles.adjustTimeHeader}>
            <Pressable
              accessibilityLabel="Close adjust time"
              accessibilityRole="button"
              style={styles.adjustTimeCloseButton}
              testID="adjust-time-close"
              onPress={onClose}
            >
              <Icon name="close-outline" size={26} color={palette.ink} />
            </Pressable>
            <Text style={styles.adjustTimeTitle}>Adjust Start/End Time</Text>
            <Pressable
              accessibilityLabel="Save workout timing"
              accessibilityRole="button"
              hitSlop={8}
              testID="adjust-time-save"
              onPress={() =>
                onSave(
                  draftStart.getTime(),
                  draftCompleted ? draftCompleted.getTime() : null,
                )
              }
            >
              <Text style={styles.adjustTimeSaveText}>Save</Text>
            </Pressable>
          </View>

          <View style={styles.adjustTimeAutoRow}>
            <Text style={styles.adjustTimeLabel}>Automatic Timing</Text>
            <Pressable
              accessibilityLabel={
                automaticTiming
                  ? "Disable automatic timing"
                  : "Enable automatic timing"
              }
              accessibilityRole="switch"
              accessibilityState={{ checked: automaticTiming }}
              style={[
                styles.adjustTimeSwitch,
                automaticTiming ? styles.adjustTimeSwitchOn : null,
              ]}
              testID="adjust-time-automatic"
              onPress={toggleAutomaticTiming}
            >
              <View
                style={[
                  styles.adjustTimeSwitchKnob,
                  automaticTiming ? styles.adjustTimeSwitchKnobOn : null,
                ]}
              />
            </Pressable>
          </View>
          <Text style={styles.adjustTimeHelp}>
            Disable Automatic Timing to manually set an End Time for this
            workout.
          </Text>

          <View style={styles.adjustTimeRows}>
            <AdjustTimeRow
              label="Duration"
              value={formatElapsedClock(draftStart, durationEnd)}
            />
            <AdjustTimeRow
              active={selectedField === "start"}
              label="Start Time"
              value={formatAdjustDateTime(draftStart, new Date(now))}
              onPress={() => setSelectedField("start")}
            />
            <AdjustTimeRow
              active={selectedField === "end"}
              label="End Time"
              value={
                automaticTiming
                  ? "Currently Active"
                  : formatAdjustDateTime(durationEnd, new Date(now))
              }
              onPress={automaticTiming ? undefined : () => setSelectedField("end")}
            />
          </View>

          {selectedField ? (
            <DateTimePicker
              accessibilityLabel={
                selectedField === "start" ? "Start time" : "End time"
              }
              display="spinner"
              mode="datetime"
              minimumDate={
                selectedField === "end"
                  ? new Date(draftStart.getTime() + 60_000)
                  : undefined
              }
              style={styles.adjustDateTimePicker}
              testID={`adjust-time-${selectedField}-picker`}
              value={selectedPickerValue}
              onChange={(_event, selectedDate) => {
                if (!selectedDate) return;
                if (selectedField === "start") updateStart(selectedDate);
                else updateEnd(selectedDate);
              }}
            />
          ) : null}
        </View>
      </DismissibleModalShade>
    </AppModal>
  );
}

function AdjustTimeRow({
  active = false,
  label,
  value,
  onPress,
}: {
  active?: boolean;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const content = (
    <>
      <Text style={styles.adjustTimeLabel}>{label}</Text>
      <Text
        style={[
          styles.adjustTimeValue,
          onPress ? styles.adjustTimeValueAction : null,
          active ? styles.adjustTimeValueActive : null,
        ]}
      >
        {value}
      </Text>
    </>
  );

  if (!onPress) {
    return <View style={styles.adjustTimeRow}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityLabel={`Edit ${label}`}
      accessibilityRole="button"
      style={styles.adjustTimeRow}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

function PastReviewWorkoutHeader({
  onBack,
  onEdit,
}: {
  onBack: () => void;
  onEdit: () => void;
}) {
  return (
    <View style={[styles.topActions, styles.pastReviewTopActions]}>
      <Pressable
        accessibilityLabel="Close workout"
        accessibilityRole="button"
        style={styles.iconButton}
        testID="workout-close"
        onPress={onBack}
      >
        <Icon name="close-outline" size={20} />
      </Pressable>
      <Pressable
        accessibilityLabel="Edit workout"
        accessibilityRole="button"
        style={styles.textButton}
        testID="workout-enter-edit-mode"
        onPress={onEdit}
      >
        <Text style={styles.textButtonText}>edit</Text>
      </Pressable>
    </View>
  );
}

function PastEditWorkoutHeader({
  canRedo,
  canUndo,
  saving,
  showDelete,
  onBack,
  onDelete,
  onRedo,
  onSave,
  onUndo,
}: {
  canRedo: boolean;
  canUndo: boolean;
  saving: boolean;
  showDelete: boolean;
  onBack: () => void;
  onDelete: () => void;
  onRedo: () => void;
  onSave: () => void;
  onUndo: () => void;
}) {
  return (
    <View style={styles.topActions}>
      <View />
      <WorkoutHeaderActions
        canRedo={canRedo}
        canUndo={canUndo}
        saving={saving}
        saveLabel="Save workout changes"
        showDelete={showDelete}
        showOnlyAvailableHistoryActions
        onBack={onBack}
        onDelete={onDelete}
        onRedo={onRedo}
        onSave={onSave}
        onUndo={onUndo}
      />
    </View>
  );
}

function WorkoutHeaderActions({
  canRedo,
  canUndo,
  saving,
  saveLabel,
  saveKind = "icon",
  showDelete = false,
  showOnlyAvailableHistoryActions = false,
  onBack,
  onDelete,
  onRedo,
  onSave,
  onUndo,
}: {
  canRedo: boolean;
  canUndo: boolean;
  saving: boolean;
  saveLabel: string;
  saveKind?: "icon" | "finish";
  showDelete?: boolean;
  showOnlyAvailableHistoryActions?: boolean;
  onBack: () => void;
  onDelete?: () => void;
  onRedo: () => void;
  onSave: () => void;
  onUndo: () => void;
}) {
  const showUndo = canUndo || !showOnlyAvailableHistoryActions;
  const showRedo = canRedo || !showOnlyAvailableHistoryActions;

  return (
    <View style={styles.topActionButtons}>
      <Pressable
        accessibilityLabel="Close workout"
        accessibilityRole="button"
        style={styles.iconButton}
        testID="workout-close"
        onPress={onBack}
      >
        <Icon name="close-outline" size={20} />
      </Pressable>
      {showUndo ? (
        <Pressable
          accessibilityLabel="Undo workout edit"
          accessibilityRole="button"
          disabled={!canUndo}
          style={[
            styles.iconButton,
            !canUndo ? styles.iconButtonDisabled : null,
          ]}
          testID="workout-undo"
          onPress={onUndo}
        >
          <Icon
            name="arrow-undo-outline"
            size={20}
            color={canUndo ? palette.muted : palette.disabled}
          />
        </Pressable>
      ) : null}
      {showRedo ? (
        <Pressable
          accessibilityLabel="Redo workout edit"
          accessibilityRole="button"
          disabled={!canRedo}
          style={[
            styles.iconButton,
            !canRedo ? styles.iconButtonDisabled : null,
          ]}
          testID="workout-redo"
          onPress={onRedo}
        >
          <Icon
            name="arrow-redo-outline"
            size={20}
            color={canRedo ? palette.muted : palette.disabled}
          />
        </Pressable>
      ) : null}
      {showDelete && onDelete ? (
        <Pressable
          accessibilityLabel="Delete workout"
          accessibilityRole="button"
          style={styles.iconButton}
          testID="workout-delete"
          onPress={onDelete}
        >
          <Icon name="trash-outline" size={20} color={palette.muted} />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityLabel={saveLabel}
        accessibilityRole="button"
        disabled={saving}
        style={saveKind === "finish" ? styles.finishButton : styles.iconButton}
        testID="workout-save"
        onPress={onSave}
      >
        {saveKind === "finish" ? (
          <Text style={styles.finishButtonText}>
            {saving ? "saving" : "Finish"}
          </Text>
        ) : (
          <Icon name="save-outline" size={20} color={palette.ink} />
        )}
      </Pressable>
    </View>
  );
}

function ExercisePlan({
  exercises,
  newExerciseName,
  addingExercise,
  exerciseSuggestions,
  exerciseSuggestionsLoaded,
  onNewExerciseNameChange,
  onAddExercise,
  onMoveTo,
  onDragStateChange,
  onTextInputFocus,
  onDelete,
}: {
  exercises: WorkoutExercise[];
  newExerciseName: string;
  addingExercise: boolean;
  exerciseSuggestions: ExerciseSuggestion[];
  exerciseSuggestionsLoaded: boolean;
  onNewExerciseNameChange: (name: string) => void;
  onAddExercise: (name?: string) => void;
  onMoveTo: (exerciseIndex: number, targetIndex: number) => void;
  onDragStateChange: (dragging: boolean) => void;
  onTextInputFocus: () => void;
  onDelete: (exerciseIndex: number) => void;
}) {
  const [dragState, setDragState] = useState<PlanDragState | null>(null);
  const dragTranslateY = useMemo(() => new Animated.Value(0), []);
  const trimmedExerciseName = newExerciseName.trim();
  const matchingExerciseSuggestions = trimmedExerciseName
    ? exerciseSuggestions
        .filter((exercise) =>
          exercise.name
            .toLowerCase()
            .includes(trimmedExerciseName.toLowerCase()),
        )
        .slice(0, 6)
    : [];
  const hasExactExerciseSuggestion = matchingExerciseSuggestions.some(
    (exercise) =>
      exercise.name.toLowerCase() === trimmedExerciseName.toLowerCase(),
  );
  const getTargetIndex = useCallback(
    (exerciseIndex: number, dy: number) =>
      clampIndex(
        exerciseIndex + Math.round(dy / PLAN_ROW_DRAG_DISTANCE),
        exercises.length,
      ),
    [exercises.length],
  );
  const startDrag = useCallback(
    (exerciseIndex: number) => {
      dragTranslateY.setValue(0);
      setDragState({ exerciseIndex, targetIndex: exerciseIndex });
      onDragStateChange(true);
    },
    [dragTranslateY, onDragStateChange],
  );
  const moveDrag = useCallback(
    (exerciseIndex: number, dy: number) => {
      dragTranslateY.setValue(dy);
      const targetIndex = getTargetIndex(exerciseIndex, dy);
      setDragState((current) => {
        if (!current || current.exerciseIndex !== exerciseIndex) {
          return current;
        }
        if (current.targetIndex === targetIndex) {
          return current;
        }
        return { ...current, targetIndex };
      });
    },
    [dragTranslateY, getTargetIndex],
  );
  const finishDrag = useCallback(
    (exerciseIndex: number, dy: number) => {
      const targetIndex = getTargetIndex(exerciseIndex, dy);
      dragTranslateY.setValue(0);
      setDragState(null);
      onDragStateChange(false);
      if (targetIndex !== exerciseIndex) {
        onMoveTo(exerciseIndex, targetIndex);
      }
    },
    [dragTranslateY, getTargetIndex, onDragStateChange, onMoveTo],
  );
  const cancelDrag = useCallback(() => {
    dragTranslateY.setValue(0);
    setDragState(null);
    onDragStateChange(false);
  }, [dragTranslateY, onDragStateChange]);

  return (
    <View style={styles.planBlock}>
      {exercises.map((exercise, index) => {
        const isDragging = dragState?.exerciseIndex === index;
        const translateY = isDragging
          ? dragTranslateY
          : getPlanRowShift(index, dragState);

        return (
          <Animated.View
            key={`${exercise.name}-${index}`}
            style={[
              styles.planRow,
              isDragging ? styles.planRowDragging : null,
              { transform: [{ translateY }] },
            ]}
          >
            <ExerciseDragHandle
              exerciseName={exercise.name}
              exerciseIndex={index}
              dragging={isDragging}
              onDragStart={startDrag}
              onDragMove={moveDrag}
              onDragEnd={finishDrag}
              onDragCancel={cancelDrag}
            />
            <Text style={styles.planName}>{exercise.name}</Text>
            <Pressable
              accessibilityLabel={`Delete ${exercise.name}`}
              accessibilityRole="button"
              style={styles.microButton}
              testID={`plan-delete-${index}`}
              onPress={() => onDelete(index)}
            >
              <Icon name="trash-outline" size={16} color={palette.muted} />
            </Pressable>
          </Animated.View>
        );
      })}
      <View style={styles.addExerciseRow}>
        <TextInput
          value={newExerciseName}
          onChangeText={onNewExerciseNameChange}
          onFocus={onTextInputFocus}
          placeholder="exercise name"
          placeholderTextColor={palette.muted}
          style={styles.exerciseInput}
          autoCapitalize="words"
        />
        <Pressable
          accessibilityLabel={`Add ${newExerciseName || "exercise"}`}
          accessibilityRole="button"
          style={styles.addButton}
          testID="plan-add-exercise"
          onPress={() => onAddExercise()}
          disabled={addingExercise}
        >
          <Text style={styles.iconButtonTextSmall}>
            {addingExercise ? "..." : "+"}
          </Text>
        </Pressable>
      </View>
      {trimmedExerciseName ? (
        <View style={styles.exerciseSuggestions}>
          {matchingExerciseSuggestions.map((suggestion) => (
            <Pressable
              key={suggestion.id}
              accessibilityLabel={`Add ${suggestion.name}`}
              accessibilityRole="button"
              style={styles.exerciseSuggestion}
              testID={`plan-suggestion-${suggestion.id}`}
              onPress={() => onAddExercise(suggestion.name)}
            >
              <Text style={styles.exerciseSuggestionText}>
                {suggestion.name}
              </Text>
            </Pressable>
          ))}
          {exerciseSuggestionsLoaded && !hasExactExerciseSuggestion ? (
            <Pressable
              accessibilityLabel={`Create ${trimmedExerciseName}`}
              accessibilityRole="button"
              style={styles.exerciseSuggestion}
              testID="plan-create-exercise"
              onPress={() => onAddExercise(trimmedExerciseName)}
            >
              <Text style={styles.exerciseSuggestionMutedText}>
                create {trimmedExerciseName}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function ExercisePlanModal({
  visible,
  exercises,
  newExerciseName,
  addingExercise,
  exerciseSuggestions,
  exerciseSuggestionsLoaded,
  onClose,
  onNewExerciseNameChange,
  onAddExercise,
  onMoveTo,
  onDragStateChange,
  onTextInputFocus,
  onDelete,
}: {
  visible: boolean;
  exercises: WorkoutExercise[];
  newExerciseName: string;
  addingExercise: boolean;
  exerciseSuggestions: ExerciseSuggestion[];
  exerciseSuggestionsLoaded: boolean;
  onClose: () => void;
  onNewExerciseNameChange: (name: string) => void;
  onAddExercise: (name?: string) => void;
  onMoveTo: (exerciseIndex: number, targetIndex: number) => void;
  onDragStateChange: (dragging: boolean) => void;
  onTextInputFocus: () => void;
  onDelete: (exerciseIndex: number) => void;
}) {
  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <DismissibleModalShade onDismiss={onClose} style={styles.exercisePlanShade}>
        <View style={styles.exercisePlanSheet}>
          <View style={styles.exercisePlanHeader}>
            <Pressable
              accessibilityLabel="Close exercise editor"
              accessibilityRole="button"
              hitSlop={8}
              style={styles.exerciseDetailsCloseButton}
              onPress={onClose}
            >
              <Icon name="close-outline" size={25} color={palette.ink} />
            </Pressable>
            <Text style={styles.exercisePlanTitle}>exercises</Text>
            <View style={styles.exercisePlanHeaderSpacer} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.exercisePlanScroll}
            contentContainerStyle={styles.exercisePlanScrollContent}
          >
            <ExercisePlan
              exercises={exercises}
              newExerciseName={newExerciseName}
              addingExercise={addingExercise}
              exerciseSuggestions={exerciseSuggestions}
              exerciseSuggestionsLoaded={exerciseSuggestionsLoaded}
              onNewExerciseNameChange={onNewExerciseNameChange}
              onAddExercise={onAddExercise}
              onMoveTo={onMoveTo}
              onDragStateChange={onDragStateChange}
              onTextInputFocus={onTextInputFocus}
              onDelete={onDelete}
            />
          </ScrollView>
        </View>
      </DismissibleModalShade>
    </AppModal>
  );
}

type PlanDragState = {
  exerciseIndex: number;
  targetIndex: number;
};

const PLAN_ROW_DRAG_DISTANCE = 37;

function getPlanRowShift(rowIndex: number, dragState: PlanDragState | null) {
  if (!dragState || rowIndex === dragState.exerciseIndex) {
    return 0;
  }

  if (
    dragState.targetIndex > dragState.exerciseIndex &&
    rowIndex > dragState.exerciseIndex &&
    rowIndex <= dragState.targetIndex
  ) {
    return -PLAN_ROW_DRAG_DISTANCE;
  }

  if (
    dragState.targetIndex < dragState.exerciseIndex &&
    rowIndex >= dragState.targetIndex &&
    rowIndex < dragState.exerciseIndex
  ) {
    return PLAN_ROW_DRAG_DISTANCE;
  }

  return 0;
}

function ExerciseDragHandle({
  exerciseName,
  exerciseIndex,
  dragging,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: {
  exerciseName: string;
  exerciseIndex: number;
  dragging: boolean;
  onDragStart: (exerciseIndex: number) => void;
  onDragMove: (exerciseIndex: number, dy: number) => void;
  onDragEnd: (exerciseIndex: number, dy: number) => void;
  onDragCancel: () => void;
}) {
  const lastDyRef = useRef(0);
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Math.abs(gestureState.dy) > 4,
        onMoveShouldSetPanResponderCapture: () => false,
        onPanResponderGrant: () => {
          lastDyRef.current = 0;
          onDragStart(exerciseIndex);
        },
        onPanResponderMove: (_event, gestureState) => {
          lastDyRef.current = gestureState.dy;
          onDragMove(exerciseIndex, gestureState.dy);
        },
        onPanResponderRelease: (_event, gestureState) =>
          onDragEnd(exerciseIndex, gestureState.dy || lastDyRef.current),
        onPanResponderTerminate: onDragCancel,
        onPanResponderTerminationRequest: () => false,
      }),
    [exerciseIndex, onDragCancel, onDragEnd, onDragMove, onDragStart],
  );

  return (
    <View
      {...panResponder.panHandlers}
      accessible
      accessibilityLabel={`Drag ${exerciseName} to reorder`}
      accessibilityRole="button"
      collapsable={false}
      style={[styles.dragHandle, dragging ? styles.dragHandleActive : null]}
      testID={`plan-drag-${exerciseIndex}`}
    >
      <Icon
        name="reorder-three-outline"
        size={19}
        color={dragging ? palette.ink : palette.muted}
      />
    </View>
  );
}

function clampIndex(index: number, count: number) {
  return Math.max(0, Math.min(count - 1, index));
}

function WorkoutExerciseTabs({
  editable,
  currentExerciseIndex,
  exercises,
  onEdit,
  onSelect,
}: {
  editable: boolean;
  currentExerciseIndex: number;
  exercises: WorkoutExercise[];
  onEdit: () => void;
  onSelect: (exerciseIndex: number) => void;
}) {
  return (
    <View style={styles.workoutExerciseTabs}>
      {exercises.map((exercise, exerciseIndex) => {
        const selected = exerciseIndex === currentExerciseIndex;
        return (
          <Pressable
            key={`${exercise.userExerciseId ?? exercise.name}-${exerciseIndex}`}
            accessibilityLabel={`Show ${exercise.name}`}
            accessibilityRole="button"
            hitSlop={8}
            style={[
              styles.workoutExerciseTab,
              selected ? styles.workoutExerciseTabSelected : null,
            ]}
            onPress={() => onSelect(exerciseIndex)}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.workoutExerciseTabText,
                selected ? styles.workoutExerciseTabTextSelected : null,
              ]}
            >
              {exercise.name}
            </Text>
          </Pressable>
        );
      })}
      {editable ? (
        <Pressable
          accessibilityLabel="Edit exercises"
          accessibilityRole="button"
          hitSlop={8}
          style={styles.workoutExerciseTab}
          testID="workout-exercise-tabs-edit"
          onPress={onEdit}
        >
          <Text numberOfLines={1} style={styles.workoutExerciseTabText}>
            edit
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ExerciseNextHint({
  exerciseName,
  onPress,
}: {
  exerciseName: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Go to next exercise, ${exerciseName}`}
      accessibilityRole="button"
      hitSlop={8}
      style={styles.exerciseNextHint}
      onPress={onPress}
    >
      <Text style={styles.exerciseNextHintLabel}>next</Text>
      <Icon name="arrow-forward" size={15} color={palette.muted} />
      <Text numberOfLines={1} style={styles.exerciseNextHintName}>
        {exerciseName}
      </Text>
    </Pressable>
  );
}

function ExerciseSection({
  exercise,
  exerciseIndex,
  inlineNoteDraft,
  inlineNoteInputRef,
  inlineNoteTarget,
  selectedField,
  selectedSetId,
  viewMode,
  onDispatch,
  onChangeInlineNote,
  onEndInlineNoteEdit,
  onSelectExercise,
  onOpenSetEditor,
  onOpenNoteEditor,
  onStartInlineNoteEdit,
  onStartTextEdit,
  onStartRestTimer,
  onDeleteExercise,
  onSaveUserExerciseSettings,
}: {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  inlineNoteDraft: string | null;
  inlineNoteInputRef: React.RefObject<React.ComponentRef<typeof TextInput> | null>;
  inlineNoteTarget: InlineNoteEditTarget | null;
  selectedField: SetEditField | null;
  selectedSetId: string | null;
  viewMode: WorkoutViewMode;
  onDispatch: (action: Action) => void;
  onChangeInlineNote: (note: string) => void;
  onEndInlineNoteEdit: () => void;
  onSelectExercise: () => void;
  onOpenSetEditor: (setId: string, field?: SetEditField) => void;
  onOpenNoteEditor: (target: NoteEditTarget) => void;
  onStartInlineNoteEdit: (target: InlineNoteEditTarget) => void;
  onStartTextEdit: () => void;
  onStartRestTimer: () => void;
  onDeleteExercise: (exerciseIndex: number) => void;
  onSaveUserExerciseSettings: (
    exerciseIndex: number,
    settings: UserExerciseSettings,
  ) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<ExerciseDetailsTab>("history");
  const [detailsEditRequest, setDetailsEditRequest] = useState(0);
  const [exerciseMenuOpen, setExerciseMenuOpen] = useState(false);
  const [exerciseMenuAnchor, setExerciseMenuAnchor] =
    useState<MenuAnchor | null>(null);
  const exerciseMenuButtonRef = useRef<View | null>(null);
  const { warmups, working } = splitSets(exercise);
  const editable = viewMode !== "past-review";
  const pinnedNoteTarget: InlineNoteEditTarget = {
    kind: "exercise",
    exerciseIndex,
  };
  const workoutExerciseNoteTarget: InlineNoteEditTarget = {
    kind: "workout-exercise",
    exerciseIndex,
  };
  const editingPinnedNote = isSameNoteTarget(
    inlineNoteTarget,
    pinnedNoteTarget,
  );
  const editingWorkoutExerciseNote = isSameNoteTarget(
    inlineNoteTarget,
    workoutExerciseNoteTarget,
  );
  const closeExerciseDetails = () => {
    setDetailsOpen(false);
  };
  const openExerciseDetails = (tab: ExerciseDetailsTab) => {
    onSelectExercise();
    setDetailsTab(tab);
    setDetailsOpen(true);
  };
  const openExerciseMenu = () => {
    onSelectExercise();
    const menuButton = exerciseMenuButtonRef.current;
    if (!menuButton) {
      setExerciseMenuAnchor(null);
      setExerciseMenuOpen(true);
      return;
    }

    menuButton.measureInWindow((x, y, measuredWidth, measuredHeight) => {
      setExerciseMenuAnchor({
        x,
        y,
        width: measuredWidth,
        height: measuredHeight,
      });
      setExerciseMenuOpen(true);
    });
  };

  const openExercisePreferences = () => {
    setExerciseMenuOpen(false);
    setExerciseMenuAnchor(null);
    openExerciseDetails("about");
    setDetailsEditRequest((request) => request + 1);
  };

  return (
    <View
      accessibilityLabel={`Make ${exercise.name} the current exercise`}
      style={styles.exerciseBlock}
      testID={`exercise-section-${exerciseIndex}`}
    >
      <View style={styles.exerciseTitleRow}>
        <Pressable
          accessibilityLabel={`Open ${exercise.name} details`}
          accessibilityRole="button"
          style={styles.flexColumn}
          testID={`exercise-title-${exerciseIndex}`}
          onPress={() => {
            openExerciseDetails("history");
          }}
        >
          <View style={styles.exerciseTitleTextRow}>
            <Text style={styles.exerciseTitle}>{exercise.name}</Text>
          </View>
        </Pressable>
        {editable ? (
          <View style={styles.exerciseTitleActions}>
            <Pressable
              ref={exerciseMenuButtonRef}
              accessibilityLabel={`${exercise.name} actions`}
              accessibilityRole="button"
              hitSlop={8}
              style={styles.iconButtonSmall}
              testID={`exercise-actions-${exerciseIndex}`}
              onPress={openExerciseMenu}
            >
              <Icon name="ellipsis-horizontal" size={20} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <ExerciseCommandMenu
        visible={editable && exerciseMenuOpen}
        anchor={exerciseMenuAnchor}
        onAddNote={() => {
          setExerciseMenuOpen(false);
          setExerciseMenuAnchor(null);
          onOpenNoteEditor({ kind: "workout-exercise", exerciseIndex });
        }}
        onAddPinnedNote={() => {
          setExerciseMenuOpen(false);
          setExerciseMenuAnchor(null);
          onOpenNoteEditor({ kind: "exercise", exerciseIndex });
        }}
        onClose={() => {
          setExerciseMenuOpen(false);
          setExerciseMenuAnchor(null);
        }}
        onOpenPreferences={openExercisePreferences}
        onRemoveExercise={() => {
          setExerciseMenuOpen(false);
          setExerciseMenuAnchor(null);
          onDeleteExercise(exerciseIndex);
        }}
      />

      {editingPinnedNote ? (
        <InlineNoteEditor
          iconName="pin-outline"
          inputRef={inlineNoteInputRef}
          note={inlineNoteDraft ?? exercise.exerciseNotes ?? ""}
          placeholder="pinned exercise note"
          testID={`exercise-pinned-note-input-${exerciseIndex}`}
          onBlur={onEndInlineNoteEdit}
          onChangeText={onChangeInlineNote}
        />
      ) : exercise.exerciseNotes ? (
        editable ? (
          <Pressable
            accessibilityLabel={`Edit ${exercise.name} pinned exercise note`}
            accessibilityRole="button"
            style={styles.noteBadgeSelf}
            testID={`exercise-pinned-note-${exerciseIndex}`}
            onPress={() => {
              onSelectExercise();
              onStartInlineNoteEdit(pinnedNoteTarget);
            }}
          >
            <View style={styles.noteBadgeRow}>
              <Icon name="pin-outline" size={13} color={palette.muted} />
              <Text style={styles.noteBadgeTextInline}>
                {exercise.exerciseNotes}
              </Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.noteBadgeSelf}>
            <View style={styles.noteBadgeRow}>
              <Icon name="pin-outline" size={13} color={palette.muted} />
              <Text style={styles.noteBadgeTextInline}>
                {exercise.exerciseNotes}
              </Text>
            </View>
          </View>
        )
      ) : null}

      {editingWorkoutExerciseNote ? (
        <InlineNoteEditor
          inputRef={inlineNoteInputRef}
          note={inlineNoteDraft ?? exercise.notes[0]?.text ?? ""}
          placeholder="this workout note"
          testID={`exercise-workout-note-input-${exerciseIndex}`}
          onBlur={onEndInlineNoteEdit}
          onChangeText={onChangeInlineNote}
        />
      ) : exercise.notes[0]?.text ? (
        editable ? (
          <Pressable
            accessibilityLabel={`Edit ${exercise.name} note for this workout`}
            accessibilityRole="button"
            style={styles.noteBadgeSelf}
            testID={`exercise-workout-note-badge-${exerciseIndex}`}
            onPress={() => {
              onSelectExercise();
              onStartInlineNoteEdit(workoutExerciseNoteTarget);
            }}
          >
            <Text style={styles.noteBadgeText}>{exercise.notes[0].text}</Text>
          </Pressable>
        ) : (
          <View style={styles.noteBadgeSelf}>
            <Text style={styles.noteBadgeText}>{exercise.notes[0].text}</Text>
          </View>
        )
      ) : null}

      <ExerciseDetailsSheet
        exercise={exercise}
        editRequest={detailsEditRequest}
        open={detailsOpen}
        selectedTab={detailsTab}
        onClose={closeExerciseDetails}
        onSaveUserExerciseSettings={(settings) => {
          onSelectExercise();
          onSaveUserExerciseSettings(exerciseIndex, settings);
        }}
        onTextInputFocus={onStartTextEdit}
        onSelectTab={setDetailsTab}
      />

      {editable && USE_SWIPEABLE_EXERCISE_SET_CARDS ? (
        <ExerciseSetCards
          exercise={exercise}
          exerciseIndex={exerciseIndex}
          inlineNoteDraft={inlineNoteDraft}
          inlineNoteInputRef={inlineNoteInputRef}
          inlineNoteTarget={inlineNoteTarget}
          selectedField={selectedField}
          selectedSetId={selectedSetId}
          onChangeInlineNote={onChangeInlineNote}
          onDispatch={onDispatch}
          onEndInlineNoteEdit={onEndInlineNoteEdit}
          onOpenSet={onOpenSetEditor}
          onSelectExercise={onSelectExercise}
          onStartRestTimer={onStartRestTimer}
          onStartInlineNoteEdit={onStartInlineNoteEdit}
        />
      ) : editable ? (
        <ExerciseSetLedgerView
          exercise={exercise}
          exerciseIndex={exerciseIndex}
          inlineNoteDraft={inlineNoteDraft}
          inlineNoteInputRef={inlineNoteInputRef}
          inlineNoteTarget={inlineNoteTarget}
          selectedField={selectedField}
          selectedSetId={selectedSetId}
          onChangeInlineNote={onChangeInlineNote}
          onDispatch={onDispatch}
          onEndInlineNoteEdit={onEndInlineNoteEdit}
          onOpenSet={onOpenSetEditor}
          onSelectExercise={onSelectExercise}
          onStartRestTimer={onStartRestTimer}
          onStartInlineNoteEdit={onStartInlineNoteEdit}
        />
      ) : (
        <>
          {warmups.length > 0 ? (
            <SetGroup
              title="warm-up"
              exercise={exercise}
              sets={warmups}
              selectedSetId={null}
              readonly
            />
          ) : null}
          <SetGroup
            title="working sets"
            exercise={exercise}
            sets={working}
            selectedSetId={null}
            readonly
          />
        </>
      )}
    </View>
  );
}

function ExerciseSetLedgerView({
  exercise,
  exerciseIndex,
  inlineNoteDraft,
  inlineNoteInputRef,
  inlineNoteTarget,
  selectedField,
  selectedSetId,
  onChangeInlineNote,
  onDispatch,
  onEndInlineNoteEdit,
  onOpenSet,
  onSelectExercise,
  onStartRestTimer,
  onStartInlineNoteEdit,
}: {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  inlineNoteDraft: string | null;
  inlineNoteInputRef: React.RefObject<React.ComponentRef<typeof TextInput> | null>;
  inlineNoteTarget: InlineNoteEditTarget | null;
  selectedField: SetEditField | null;
  selectedSetId: string | null;
  onChangeInlineNote: (note: string) => void;
  onDispatch: (action: Action) => void;
  onEndInlineNoteEdit: () => void;
  onOpenSet: (setId: string, field?: SetEditField) => void;
  onSelectExercise: () => void;
  onStartRestTimer: () => void;
  onStartInlineNoteEdit: (target: InlineNoteEditTarget) => void;
}) {
  const split = splitSets(exercise);
  const groups = [
    ...groupLedgerSets(split.warmups),
    ...groupLedgerSets(split.working),
  ];
  const previousEntry = exercise.history?.[0];
  const previousExercise = previousEntry
    ? buildHistoricalExercise(exercise, previousEntry)
    : null;
  const previousGroups = previousExercise
    ? [
        ...groupLedgerSets(splitSets(previousExercise).warmups),
        ...groupLedgerSets(splitSets(previousExercise).working),
      ]
    : [];

  return (
    <NotebookSetLedger
      exercise={exercise}
      exerciseIndex={exerciseIndex}
      groups={groups}
      inlineNoteDraft={inlineNoteDraft}
      inlineNoteInputRef={inlineNoteInputRef}
      inlineNoteTarget={inlineNoteTarget}
      previousExercise={previousExercise}
      previousGroups={previousGroups}
      selectedField={selectedField}
      selectedSetId={selectedSetId}
      onChangeInlineNote={onChangeInlineNote}
      onDispatch={onDispatch}
      onEndInlineNoteEdit={onEndInlineNoteEdit}
      onOpenSet={onOpenSet}
      onSelectExercise={onSelectExercise}
      onStartRestTimer={onStartRestTimer}
      onStartInlineNoteEdit={onStartInlineNoteEdit}
    />
  );
}

function NotebookSetLedger({
  exercise,
  exerciseIndex,
  groups,
  inlineNoteDraft,
  inlineNoteInputRef,
  inlineNoteTarget,
  previousExercise,
  previousGroups,
  selectedField,
  selectedSetId,
  onChangeInlineNote,
  onDispatch,
  onEndInlineNoteEdit,
  onOpenSet,
  onSelectExercise,
  onStartRestTimer,
  onStartInlineNoteEdit,
}: {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  groups: IndexedWorkoutSet[][];
  inlineNoteDraft: string | null;
  inlineNoteInputRef: React.RefObject<React.ComponentRef<typeof TextInput> | null>;
  inlineNoteTarget: InlineNoteEditTarget | null;
  previousExercise: WorkoutExercise | null;
  previousGroups: IndexedWorkoutSet[][];
  selectedField: SetEditField | null;
  selectedSetId: string | null;
  onChangeInlineNote: (note: string) => void;
  onDispatch: (action: Action) => void;
  onEndInlineNoteEdit: () => void;
  onOpenSet: (setId: string, field?: SetEditField) => void;
  onSelectExercise: () => void;
  onStartRestTimer: () => void;
  onStartInlineNoteEdit: (target: InlineNoteEditTarget) => void;
}) {
  const presentDialog = useAppDialog();
  const [revealedPreviousGroupIndex, setRevealedPreviousGroupIndex] =
    useState<number | null>(null);

  const addSet = () => {
    onSelectExercise();
    const baseSet =
      [...exercise.sets]
        .reverse()
        .find((candidate) => candidate.modifier !== "warmup") ??
      exercise.sets[exercise.sets.length - 1];
    const nextSetIndex = exercise.sets.length;
    const nextSet: WorkoutSet = {
      clientId: makeClientId(),
      weight: baseSet?.weight ?? null,
      reps: baseSet?.reps ?? null,
      completed: false,
      weightExplicit: baseSet?.weight != null,
      repsExplicit: baseSet?.reps != null,
      prevWeight: baseSet?.weight ?? null,
      prevReps: baseSet?.reps ?? null,
      weightModifier: baseSet?.weightModifier,
      restBefore: groups.length > 0 ? "standard" : undefined,
    };
    onDispatch({
      type: "REPLACE_EXERCISE_SETS",
      exerciseIndex,
      sets: [...exercise.sets, nextSet],
    });
    onOpenSet(getSetTargetId(nextSet, nextSetIndex), "weight");
  };

  const appendShortRestSegment = (group: IndexedWorkoutSet[]) => {
    const lastSegment = group[group.length - 1];
    if (!lastSegment) return;
    onSelectExercise();
    const nextSet: WorkoutSet = {
      clientId: makeClientId(),
      weight: lastSegment.set.weight,
      reps: null,
      completed: false,
      weightExplicit: lastSegment.set.weight !== null,
      repsExplicit: false,
      prevWeight: null,
      prevReps: null,
      modifier: lastSegment.set.modifier,
      weightModifier: lastSegment.set.weightModifier,
      restBefore: "short",
    };
    const nextSets = [...exercise.sets];
    nextSets.splice(lastSegment.index + 1, 0, nextSet);
    onDispatch({
      type: "REPLACE_EXERCISE_SETS",
      exerciseIndex,
      sets: nextSets,
    });
    onOpenSet(getSetTargetId(nextSet, lastSegment.index + 1), "reps");
  };

  const removeSetGroup = (group: IndexedWorkoutSet[]) => {
    const groupIndexes = new Set(group.map(({ index }) => index));
    onDispatch({
      type: "REPLACE_EXERCISE_SETS",
      exerciseIndex,
      sets: exercise.sets.filter(
        (_set, setIndex) => !groupIndexes.has(setIndex),
      ),
    });
  };

  const removeShortRestSegment = (indexedSet: IndexedWorkoutSet) => {
    onDispatch({
      type: "REPLACE_EXERCISE_SETS",
      exerciseIndex,
      sets: exercise.sets.filter(
        (_set, setIndex) => setIndex !== indexedSet.index,
      ),
    });
  };

  const deleteSetGroup = (group: IndexedWorkoutSet[], logicalLabel: string) => {
    presentDialog({
      title: "Delete set?",
      message: `${logicalLabel} and any short-rest reps`,
      actions: [
        { label: "cancel", variant: "cancel" },
        {
          label: "delete",
          variant: "danger",
          onPress: () => removeSetGroup(group),
        },
      ],
    });
  };

  const deleteShortRestSegment = (indexedSet: IndexedWorkoutSet) => {
    presentDialog({
      title: "Delete short-rest reps?",
      message: formatSetInline(exercise, indexedSet) || "short-rest reps",
      actions: [
        { label: "cancel", variant: "cancel" },
        {
          label: "delete",
          variant: "danger",
          onPress: () => removeShortRestSegment(indexedSet),
        },
      ],
    });
  };

  const openSetCommandMenu = (
    group: IndexedWorkoutSet[],
    logicalLabel: string,
    noteSet: IndexedWorkoutSet = group[0]!,
  ) => {
    onSelectExercise();
    triggerSelectionHaptic();
    const noteTarget: InlineNoteEditTarget = {
      kind: "set",
      exerciseIndex,
      setId: getSetTargetId(noteSet.set, noteSet.index),
    };

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: 3,
          destructiveButtonIndex: 2,
          options: ["edit note", "extend set", "delete set", "cancel"],
          title: logicalLabel,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) onStartInlineNoteEdit(noteTarget);
          if (buttonIndex === 1) appendShortRestSegment(group);
          if (buttonIndex === 2) deleteSetGroup(group, logicalLabel);
        },
      );
      return;
    }

    presentDialog({
      title: logicalLabel,
      actions: [
        { label: "edit note", onPress: () => onStartInlineNoteEdit(noteTarget) },
        { label: "extend set", onPress: () => appendShortRestSegment(group) },
        {
          label: "delete set",
          variant: "danger",
          onPress: () => deleteSetGroup(group, logicalLabel),
        },
        { label: "cancel", variant: "cancel" },
      ],
    });
  };

  const toggleWarmupGroup = (group: IndexedWorkoutSet[]) => {
    const leadingSet = group[0];
    if (!leadingSet) return;
    const isWarmup = leadingSet.set.modifier === "warmup";
    const nextModifier: WorkoutSet["modifier"] = isWarmup
      ? undefined
      : "warmup";
    presentDialog({
      title: `Change ${setLabel(exercise, leadingSet.index)}?`,
      message: `Make this ${isWarmup ? "working set" : "warm-up set"}?`,
      actions: [
        { label: "cancel", variant: "cancel" },
        {
          label: "change",
          variant: "primary",
          onPress: () => {
            triggerSelectionHaptic();
            const groupIndexes = new Set(group.map(({ index }) => index));
            onDispatch({
              type: "REPLACE_EXERCISE_SETS",
              exerciseIndex,
              sets: exercise.sets.map((set, setIndex) =>
                groupIndexes.has(setIndex)
                  ? { ...set, modifier: nextModifier }
                  : set,
              ),
            });
          },
        },
      ],
    });
  };

  if (groups.length === 0) {
    return (
      <View style={styles.notebookLedger}>
        <Text style={styles.metaText}>none</Text>
        <NotebookAddSetButton onPress={addSet} />
      </View>
    );
  }

  return (
    <View style={styles.notebookLedger}>
      {groups.map((group, groupIndex) => {
        const leadingSet = group[0]!;
        const logicalLabel = setLabel(exercise, leadingSet.index);
        const previousGroup = previousGroups[groupIndex] ?? null;
        const previousAvailable = Boolean(previousExercise && previousGroup);
        const previousRevealed =
          previousAvailable && revealedPreviousGroupIndex === groupIndex;
        return (
          <React.Fragment
            key={`${getSetTargetId(leadingSet.set, leadingSet.index)}-${leadingSet.index}`}
          >
            {groupIndex > 0 ? (
              <NotebookRestSeparator
                label={
                  leadingSet.set.restBefore === "short"
                    ? "short"
                    : formatRestDurationLabel(leadingSet.set)
                }
                onPress={() => {
                  onSelectExercise();
                  toggleRest(onDispatch, exerciseIndex, exercise, leadingSet.index);
                }}
              />
            ) : null}
            {group.map((indexedSet, segmentIndex) => {
              const setId = getSetTargetId(indexedSet.set, indexedSet.index);
              const setNoteTarget: InlineNoteEditTarget = {
                kind: "set",
                exerciseIndex,
                setId,
              };
              const editingSetNote = isSameNoteTarget(
                inlineNoteTarget,
                setNoteTarget,
              );
              const rowLabel =
                segmentIndex === 0
                  ? getLedgerSetIndexLabel(exercise, indexedSet)
                  : "";
              const loadLabel = formatLedgerLoadLabel(exercise, indexedSet);
              const repsLabel = formatLedgerRepsLabel(exercise, indexedSet);
              const setNoteText = indexedSet.set.notes?.trim();
              const isWeightSelected =
                selectedSetId === setId && selectedField === "weight";
              const isRepsSelected =
                selectedSetId === setId && selectedField === "reps";
              const segmentLabel = setLabel(exercise, indexedSet.index);

              return (
                <View key={`${setId}-${indexedSet.index}`}>
                  {segmentIndex > 0 ? (
                    <NotebookRestSeparator
                      label="short"
                      onPress={() => {
                        onSelectExercise();
                        toggleRest(
                          onDispatch,
                          exerciseIndex,
                          exercise,
                          indexedSet.index,
                        );
                      }}
                    />
                  ) : null}
                  <SwipeActionSetRow
                    canComplete={segmentIndex === 0}
                    completed={Boolean(indexedSet.set.completed)}
                    hasNote={Boolean(indexedSet.set.notes?.trim())}
                    onComplete={() => {
                      if (segmentIndex !== 0) return;
                      const wasCompleted = Boolean(indexedSet.set.completed);
                      onSelectExercise();
                      triggerSelectionHaptic();
                      onDispatch({
                        type: "TOGGLE_SET_COMPLETED",
                        exerciseIndex,
                        setIndex: indexedSet.index,
                      });
                      if (!wasCompleted) onStartRestTimer();
                    }}
                    onDelete={() => {
                      if (segmentIndex === 0) {
                        deleteSetGroup(group, logicalLabel);
                      } else {
                        deleteShortRestSegment(indexedSet);
                      }
                    }}
                    onNote={() => {
                      onSelectExercise();
                      onStartInlineNoteEdit(setNoteTarget);
                    }}
                    onSwipeStart={() => setRevealedPreviousGroupIndex(null)}
                  >
                    {({ isPressSuppressed, swipeTouchHandlers }) => (
                      <Pressable
                        accessible={false}
                        {...swipeTouchHandlers}
                        style={styles.notebookSetRow}
                        onLongPress={() => {
                          if (isPressSuppressed() || !previousAvailable) return;
                          triggerSelectionHaptic();
                          setRevealedPreviousGroupIndex(groupIndex);
                        }}
                        onPressOut={() => {
                          if (isPressSuppressed()) return;
                          setRevealedPreviousGroupIndex(null);
                        }}
                      >
                        {segmentIndex === 0 ? (
                          <Pressable
                            accessibilityLabel={`Toggle ${logicalLabel} warm-up`}
                            accessibilityRole="button"
                            {...swipeTouchHandlers}
                            hitSlop={8}
                            style={[
                              styles.notebookSetIndex,
                              indexedSet.set.modifier === "warmup"
                                ? styles.notebookSetIndexWarmup
                                : null,
                            ]}
                            onPress={() => {
                              if (isPressSuppressed()) return;
                              toggleWarmupGroup(group);
                            }}
                            onLongPress={() => {
                              if (isPressSuppressed()) return;
                              openSetCommandMenu(
                                group,
                                logicalLabel,
                                indexedSet,
                              );
                            }}
                          >
                            <Text style={styles.notebookSetIndexText}>
                              {rowLabel}
                            </Text>
                          </Pressable>
                        ) : (
                          <View style={styles.notebookSetIndex} />
                        )}
                        <View style={styles.notebookSetContent}>
                          <View style={styles.notebookCurrentValue}>
                            <Pressable
                              accessibilityLabel={`Edit ${segmentLabel} weight ${loadLabel}`}
                              accessibilityRole="button"
                              {...swipeTouchHandlers}
                              hitSlop={8}
                              style={[
                                styles.notebookValueChip,
                                isWeightSelected
                                  ? styles.notebookValueChipActive
                                  : null,
                              ]}
                              onPress={() => {
                                if (isPressSuppressed()) return;
                                onSelectExercise();
                                onOpenSet(setId, "weight");
                              }}
                              onLongPress={() => {
                                if (isPressSuppressed()) return;
                                openSetCommandMenu(
                                  group,
                                  logicalLabel,
                                  indexedSet,
                                );
                              }}
                            >
                              <Text style={styles.notebookValueText}>
                                {loadLabel}
                              </Text>
                            </Pressable>
                            <Text style={styles.notebookMultiplyText}>x</Text>
                            <Pressable
                              accessibilityLabel={`Edit ${segmentLabel} reps ${repsLabel}`}
                              accessibilityRole="button"
                              {...swipeTouchHandlers}
                              hitSlop={8}
                              style={[
                                styles.notebookRepsChip,
                                isRepsSelected
                                  ? styles.notebookValueChipActive
                                  : null,
                              ]}
                              onPress={() => {
                                if (isPressSuppressed()) return;
                                onSelectExercise();
                                onOpenSet(setId, "reps");
                              }}
                              onLongPress={() => {
                                if (isPressSuppressed()) return;
                                openSetCommandMenu(
                                  group,
                                  logicalLabel,
                                  indexedSet,
                                );
                              }}
                            >
                              <Text style={styles.notebookValueText}>
                                {repsLabel}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                        {segmentIndex === 0 ? (
                          indexedSet.set.completed ? (
                            <Pressable
                              accessibilityLabel={`Mark ${segmentLabel} incomplete`}
                              accessibilityRole="button"
                              {...swipeTouchHandlers}
                              hitSlop={8}
                              style={styles.notebookCompletionIndicator}
                              onPress={() => {
                                if (isPressSuppressed()) return;
                                onSelectExercise();
                                triggerSelectionHaptic();
                                onDispatch({
                                  type: "TOGGLE_SET_COMPLETED",
                                  exerciseIndex,
                                  setIndex: indexedSet.index,
                                });
                              }}
                            >
                              <Icon
                                name="checkmark"
                                size={16}
                                color={palette.ink}
                              />
                            </Pressable>
                          ) : (
                            <View style={styles.notebookCompletionIndicator} />
                          )
                        ) : (
                          <View
                            style={styles.notebookCompletionIndicatorSpacer}
                          />
                        )}
                      </Pressable>
                    )}
                  </SwipeActionSetRow>
                  {editingSetNote ? (
                    <InlineNoteEditor
                      inputRef={inlineNoteInputRef}
                      note={inlineNoteDraft ?? indexedSet.set.notes ?? ""}
                      placeholder={`${segmentLabel} note`}
                      testID={`set-note-inline-input-${exerciseIndex}-${indexedSet.index}`}
                      onBlur={onEndInlineNoteEdit}
                      onChangeText={onChangeInlineNote}
                    />
                  ) : setNoteText ? (
                    <Pressable
                      accessibilityLabel={`Edit ${segmentLabel} note`}
                      accessibilityRole="button"
                      hitSlop={8}
                      style={styles.notebookSetNote}
                      onPress={() => {
                        onSelectExercise();
                        onStartInlineNoteEdit(setNoteTarget);
                      }}
                    >
                      <Text style={styles.noteBadgeText}>{setNoteText}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
            {previousExercise && previousGroup && previousRevealed ? (
              <NotebookPreviousPeek
                exercise={previousExercise}
                group={previousGroup}
              />
            ) : null}
          </React.Fragment>
        );
      })}
      <NotebookAddSetButton onPress={addSet} />
    </View>
  );
}

function NotebookPreviousPeek({
  exercise,
  group,
}: {
  exercise: WorkoutExercise;
  group: IndexedWorkoutSet[];
}) {
  const value = formatPreviousSetGroup(exercise, group);
  const notes = group
    .map(({ set }) => set.notes?.trim())
    .filter((note): note is string => Boolean(note));

  return (
    <View style={styles.notebookPreviousPeek}>
      <Text style={styles.notebookPreviousPeekTitle}>previous</Text>
      <View style={styles.notebookPreviousPeekEntry}>
        <View style={styles.notebookPreviousPeekRow}>
          <Text style={styles.notebookPreviousPeekValue}>{value}</Text>
        </View>
        {notes.map((note, index) => (
          <Text
            key={`${note}-${index}`}
            style={styles.notebookPreviousPeekNote}
          >
            {note}
          </Text>
        ))}
      </View>
    </View>
  );
}

function SwipeActionSetRow({
  children,
  canComplete,
  completed,
  hasNote,
  onComplete,
  onDelete,
  onNote,
  onSwipeStart,
}: {
  children:
    | React.ReactNode
    | ((helpers: SwipeActionSetRowHelpers) => React.ReactNode);
  canComplete: boolean;
  completed: boolean;
  hasNote: boolean;
  onComplete: () => void;
  onDelete: () => void;
  onNote: () => void;
  onSwipeStart: () => void;
}) {
  const leftOpenX = 72;
  const rightOpenX = -96;
  const translateX = useMemo(() => new Animated.Value(0), []);
  const openSideRef = useRef<"left" | "right" | null>(null);
  const didExecuteRef = useRef(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchDeltaXRef = useRef(0);
  const touchSwipingRef = useRef(false);
  const suppressPressUntilRef = useRef(0);

  const animateTo = useCallback((toValue: number) => {
    Animated.spring(translateX, {
      toValue,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const resetPosition = useCallback(() => {
    openSideRef.current = null;
    animateTo(0);
  }, [animateTo]);

  const openLeft = useCallback(() => {
    openSideRef.current = "left";
    animateTo(leftOpenX);
  }, [animateTo]);

  const openRight = useCallback(() => {
    openSideRef.current = "right";
    animateTo(rightOpenX);
  }, [animateTo]);

  const executeComplete = useCallback(() => {
    if (!canComplete) {
      resetPosition();
      return;
    }
    if (didExecuteRef.current) return;
    didExecuteRef.current = true;
    onComplete();
    resetPosition();
    requestAnimationFrame(() => {
      didExecuteRef.current = false;
    });
  }, [canComplete, onComplete, resetPosition]);

  const executeDelete = useCallback(() => {
    if (didExecuteRef.current) return;
    didExecuteRef.current = true;
    Animated.timing(translateX, {
      duration: 160,
      toValue: rightOpenX,
      useNativeDriver: true,
    }).start(() => {
      onDelete();
      didExecuteRef.current = false;
      resetPosition();
    });
  }, [onDelete, resetPosition, translateX]);

  const settleSwipe = useCallback(
    (dx: number, vx = 0) => {
      if (dx <= -118 || (dx <= -68 && vx < -1)) {
        executeDelete();
        return;
      }
      if (canComplete && (dx >= 92 || (dx >= 56 && vx > 1))) {
        executeComplete();
        return;
      }
      if (dx <= -34) {
        openRight();
        return;
      }
      if (canComplete && dx >= 30) {
        openLeft();
        return;
      }
      resetPosition();
    },
    [
      canComplete,
      executeComplete,
      executeDelete,
      openLeft,
      openRight,
      resetPosition,
    ],
  );

  const getTouchPoint = useCallback((event: GestureResponderEvent) => {
    const touch =
      event.nativeEvent.touches[0] ?? event.nativeEvent.changedTouches[0];
    return touch ? { x: touch.pageX, y: touch.pageY } : null;
  }, []);

  const beginTouch = useCallback(
    (event: GestureResponderEvent) => {
      touchStartRef.current = getTouchPoint(event);
      touchDeltaXRef.current = 0;
      touchSwipingRef.current = false;
    },
    [getTouchPoint],
  );

  const moveTouch = useCallback(
    (event: GestureResponderEvent) => {
      const start = touchStartRef.current;
      const point = getTouchPoint(event);
      if (!start || !point) return;

      const dx = point.x - start.x;
      const dy = point.y - start.y;
      touchDeltaXRef.current = dx;

      if (
        !touchSwipingRef.current &&
        Math.abs(dx) > 5 &&
        Math.abs(dx) > Math.abs(dy) * 1.12
      ) {
        touchSwipingRef.current = true;
        onSwipeStart();
      }

      if (!touchSwipingRef.current) return;
      event.stopPropagation();
      translateX.setValue(Math.max(-128, Math.min(96, dx)));
    },
    [getTouchPoint, onSwipeStart, translateX],
  );

  const endTouch = useCallback(
    (event: GestureResponderEvent) => {
      if (!touchSwipingRef.current) {
        touchStartRef.current = null;
        touchDeltaXRef.current = 0;
        return;
      }

      event.stopPropagation();
      const dx = touchDeltaXRef.current;
      touchStartRef.current = null;
      touchDeltaXRef.current = 0;
      touchSwipingRef.current = false;
      suppressPressUntilRef.current = Date.now() + 450;
      settleSwipe(dx);
    },
    [settleSwipe],
  );

  const cancelTouch = useCallback((_event: GestureResponderEvent) => {
    touchStartRef.current = null;
    touchDeltaXRef.current = 0;
    touchSwipingRef.current = false;
    resetPosition();
  }, [resetPosition]);

  const isPressSuppressed = useCallback(
    () => touchSwipingRef.current || Date.now() < suppressPressUntilRef.current,
    [],
  );

  const swipeTouchHandlers = useMemo(
    () => ({
      onTouchCancel: cancelTouch,
      onTouchEnd: endTouch,
      onTouchMove: moveTouch,
      onTouchStart: beginTouch,
    }),
    [beginTouch, cancelTouch, endTouch, moveTouch],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gestureState) =>
          Math.abs(gestureState.dx) > 8 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2,
        onMoveShouldSetPanResponderCapture: (_event, gestureState) =>
          Math.abs(gestureState.dx) > 12 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.4,
        onPanResponderGrant: () => {
          onSwipeStart();
        },
        onPanResponderMove: (_event, gestureState) => {
          translateX.setValue(Math.max(-128, Math.min(96, gestureState.dx)));
        },
        onPanResponderRelease: (_event, gestureState) =>
          settleSwipe(gestureState.dx, gestureState.vx),
        onPanResponderTerminate: resetPosition,
        onPanResponderTerminationRequest: () => false,
      }),
    [
      canComplete,
      onSwipeStart,
      resetPosition,
      settleSwipe,
      translateX,
    ],
  );

  return (
    <View style={styles.notebookSwipeRow}>
      <View style={styles.notebookSwipeCompleteAction}>
        {canComplete ? (
          <Pressable
            accessibilityLabel={completed ? "Mark set incomplete" : "Complete set"}
            accessibilityRole="button"
            style={[
              styles.notebookSwipeActionButton,
              styles.notebookSwipeCompleteButton,
            ]}
            onPress={executeComplete}
          >
            <Icon
              name={completed ? "refresh-outline" : "checkmark"}
              size={15}
              color={palette.ink}
            />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.notebookSwipeTrailingActions}>
        <Pressable
          accessibilityLabel={hasNote ? "Edit set note" : "Add set note"}
          accessibilityRole="button"
          style={[
            styles.notebookSwipeActionButton,
            hasNote ? styles.notebookSwipeNoteButtonActive : null,
          ]}
          onPress={() => {
            onNote();
            resetPosition();
          }}
        >
          <Icon name="pencil-outline" size={14} color={palette.muted} />
        </Pressable>
        <Pressable
          accessibilityLabel="Delete set"
          accessibilityRole="button"
          style={[
            styles.notebookSwipeActionButton,
            styles.notebookSwipeDeleteButton,
          ]}
          onPress={executeDelete}
        >
          <Icon name="trash-outline" size={14} color={palette.danger} />
        </Pressable>
      </View>
      <Animated.View
        {...panResponder.panHandlers}
        {...swipeTouchHandlers}
        style={[
          styles.notebookSwipeForeground,
          { transform: [{ translateX }] },
        ]}
      >
        {typeof children === "function"
          ? children({ isPressSuppressed, swipeTouchHandlers })
          : children}
      </Animated.View>
    </View>
  );
}

function NotebookRestSeparator({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Edit rest ${label}`}
      accessibilityRole="button"
      hitSlop={8}
      style={styles.notebookRestSeparator}
      onPress={onPress}
    >
      <View style={styles.notebookRestLine} />
      <Text style={styles.notebookRestText}>{label}</Text>
      <View style={styles.notebookRestLine} />
    </Pressable>
  );
}

function NotebookAddSetButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Add set"
      accessibilityRole="button"
      style={styles.notebookAddSetButton}
      onPress={onPress}
    >
      <Text style={styles.notebookAddSetText}>+ set</Text>
    </Pressable>
  );
}

function formatRestDurationLabel(set: WorkoutSet) {
  if (set.modifier === "warmup") return "none";
  return "3:00";
}

function LegacyExerciseSetLedgerView({
  exercise,
  exerciseIndex,
  selectedField,
  selectedSetId,
  onDispatch,
  onOpenSet,
  onSelectExercise,
}: {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  selectedField: SetEditField | null;
  selectedSetId: string | null;
  onDispatch: (action: Action) => void;
  onOpenSet: (setId: string, field?: SetEditField) => void;
  onSelectExercise: () => void;
}) {
  const { warmups, working } = splitSets(exercise);

  return (
    <>
      {warmups.length > 0 ? (
        <SetLedger
          title="warm-up"
          exercise={exercise}
          sets={warmups}
          selectedField={selectedField}
          selectedSetId={selectedSetId}
          onOpenSet={onOpenSet}
          onToggleComplete={(setIndex) => {
            onSelectExercise();
            onDispatch({
              type: "TOGGLE_SET_COMPLETED",
              exerciseIndex,
              setIndex,
            });
          }}
          onToggleRest={(setIndex) => {
            onSelectExercise();
            toggleRest(onDispatch, exerciseIndex, exercise, setIndex);
          }}
        />
      ) : null}

      <View style={styles.currentSetHeaderRow}>
        <Text style={styles.subtleTitle}>working sets</Text>
        <AddExerciseSetButton
          exercise={exercise}
          exerciseIndex={exerciseIndex}
          onDispatch={onDispatch}
          onOpenSet={onOpenSet}
          onSelectExercise={onSelectExercise}
        />
      </View>
      <SetLedger
        exercise={exercise}
        sets={working}
        selectedField={selectedField}
        selectedSetId={selectedSetId}
        onOpenSet={onOpenSet}
        onToggleComplete={(setIndex) => {
          onSelectExercise();
          onDispatch({
            type: "TOGGLE_SET_COMPLETED",
            exerciseIndex,
            setIndex,
          });
        }}
        onToggleRest={(setIndex) => {
          onSelectExercise();
          toggleRest(onDispatch, exerciseIndex, exercise, setIndex);
        }}
      />
    </>
  );
}

function AddExerciseSetButton({
  exercise,
  exerciseIndex,
  onDispatch,
  onOpenSet,
  onSelectExercise,
}: {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  onDispatch: (action: Action) => void;
  onOpenSet: (setId: string, field?: SetEditField) => void;
  onSelectExercise: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`Add set to ${exercise.name}`}
      accessibilityRole="button"
      hitSlop={8}
      style={styles.iconButtonTiny}
      testID={`exercise-add-set-${exerciseIndex}`}
      onPress={() => {
        onSelectExercise();
        const nextSetIndex = exercise.sets.length;
        const nextSet: WorkoutSet = {
          clientId: makeClientId(),
          weight: null,
          reps: null,
          completed: false,
          weightExplicit: false,
          repsExplicit: false,
          prevWeight: null,
          prevReps: null,
          weightModifier:
            exercise.sets[exercise.sets.length - 1]?.weightModifier,
        };
        onDispatch({
          type: "REPLACE_EXERCISE_SETS",
          exerciseIndex,
          sets: [...exercise.sets, nextSet],
        });
        onOpenSet(getSetTargetId(nextSet, nextSetIndex), "weight");
      }}
    >
      <Icon name="add-outline" size={24} color={palette.muted} />
    </Pressable>
  );
}

function ExerciseSetCards({
  exercise,
  exerciseIndex,
  inlineNoteDraft,
  inlineNoteInputRef,
  inlineNoteTarget,
  selectedField,
  selectedSetId,
  onChangeInlineNote,
  onDispatch,
  onEndInlineNoteEdit,
  onOpenSet,
  onSelectExercise,
  onStartRestTimer,
  onStartInlineNoteEdit,
}: {
  exercise: WorkoutExercise;
  exerciseIndex: number;
  inlineNoteDraft: string | null;
  inlineNoteInputRef: React.RefObject<React.ComponentRef<typeof TextInput> | null>;
  inlineNoteTarget: InlineNoteEditTarget | null;
  selectedField: SetEditField | null;
  selectedSetId: string | null;
  onChangeInlineNote: (note: string) => void;
  onDispatch: (action: Action) => void;
  onEndInlineNoteEdit: () => void;
  onOpenSet: (setId: string, field?: SetEditField) => void;
  onSelectExercise: () => void;
  onStartRestTimer: () => void;
  onStartInlineNoteEdit: (target: InlineNoteEditTarget) => void;
}) {
  const presentDialog = useAppDialog();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [cardsViewportWidth, setCardsViewportWidth] = useState(0);
  const cardWidth = cardsViewportWidth || Math.max(248, width - 32);
  const split = splitSets(exercise);
  const groups = [
    ...groupLedgerSets(split.warmups),
    ...groupLedgerSets(split.working),
  ];
  const clampedActiveCardIndex = clampIndex(activeCardIndex, groups.length);
  const canSwipeToPreviousSet = clampedActiveCardIndex > 0;
  const canSwipeToNextSet = clampedActiveCardIndex < groups.length - 1;
  const previousEntry = exercise.history?.[0];
  const previousExercise = previousEntry
    ? buildHistoricalExercise(exercise, previousEntry)
    : null;
  const previousGroups = previousExercise
    ? [
        ...groupLedgerSets(splitSets(previousExercise).warmups),
        ...groupLedgerSets(splitSets(previousExercise).working),
      ]
    : [];
  let warmupTabCount = 0;
  let workingTabCount = 0;
  const tabs = groups.map((group) => {
    const leadingSet = group[0]!;
    const isWarmup = leadingSet.set.modifier === "warmup";
    const label = isWarmup
      ? `W${++warmupTabCount}`
      : `set ${++workingTabCount}`;
    return {
      completed: Boolean(leadingSet.set.completed),
      group,
      label,
      leadingSet,
      setId: getSetTargetId(leadingSet.set, leadingSet.index),
    };
  });
  const scrollToSetCard = (setIndex: number) => {
    const groupIndex = groups.findIndex((group) =>
      group.some((indexedSet) => indexedSet.index === setIndex),
    );
    if (groupIndex < 0) return;
    setActiveCardIndex(groupIndex);
    scrollRef.current?.scrollTo({
      animated: true,
      x: groupIndex * cardWidth,
      y: 0,
    });
  };
  const scrollToSetCardById = (
    setId: string,
    nextExercise: WorkoutExercise = exercise,
  ) => {
    const nextSplit = splitSets(nextExercise);
    const nextGroups = [
      ...groupLedgerSets(nextSplit.warmups),
      ...groupLedgerSets(nextSplit.working),
    ];
    const nextGroupIndex = nextGroups.findIndex((group) =>
      group.some(
        (indexedSet) =>
          getSetTargetId(indexedSet.set, indexedSet.index) === setId,
      ),
    );
    if (nextGroupIndex < 0) return;
    setActiveCardIndex(nextGroupIndex);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        animated: true,
        x: nextGroupIndex * cardWidth,
        y: 0,
      });
    });
  };
  const scrollToSetTab = (indexedSet: IndexedWorkoutSet) => {
    onSelectExercise();
    scrollToSetCard(indexedSet.index);
  };
  const addSet = () => {
    onSelectExercise();
    const nextSetIndex = exercise.sets.length;
    const nextSet: WorkoutSet = {
      clientId: makeClientId(),
      weight: null,
      reps: null,
      completed: false,
      weightExplicit: false,
      repsExplicit: false,
      prevWeight: null,
      prevReps: null,
      weightModifier: exercise.sets[exercise.sets.length - 1]?.weightModifier,
    };
    onDispatch({
      type: "REPLACE_EXERCISE_SETS",
      exerciseIndex,
      sets: [...exercise.sets, nextSet],
    });
    onOpenSet(getSetTargetId(nextSet, nextSetIndex), "weight");
  };
  const appendShortRestSegment = (group: IndexedWorkoutSet[]) => {
    const lastSegment = group[group.length - 1];
    if (!lastSegment) return;
    onSelectExercise();
    const nextSet: WorkoutSet = {
      clientId: makeClientId(),
      weight: lastSegment.set.weight,
      reps: null,
      completed: false,
      weightExplicit: lastSegment.set.weight !== null,
      repsExplicit: false,
      prevWeight: null,
      prevReps: null,
      modifier: lastSegment.set.modifier,
      weightModifier: lastSegment.set.weightModifier,
      restBefore: "short",
    };
    const nextSets = [...exercise.sets];
    nextSets.splice(lastSegment.index + 1, 0, nextSet);
    onDispatch({
      type: "REPLACE_EXERCISE_SETS",
      exerciseIndex,
      sets: nextSets,
    });
    onOpenSet(getSetTargetId(nextSet, lastSegment.index + 1), "reps");
  };
  const deleteShortRestSegment = (indexedSet: IndexedWorkoutSet) => {
    presentDialog({
      title: "Delete short-rest reps?",
      message: formatSetInline(exercise, indexedSet) || "short-rest reps",
      actions: [
        { label: "cancel", variant: "cancel" },
        {
          label: "delete",
          variant: "danger",
          onPress: () => {
            const nextSets = exercise.sets.filter(
              (_set, setIndex) => setIndex !== indexedSet.index,
            );
            onDispatch({
              type: "REPLACE_EXERCISE_SETS",
              exerciseIndex,
              sets: nextSets,
            });
          },
        },
      ],
    });
  };
  const deleteSetGroup = (group: IndexedWorkoutSet[], logicalLabel: string) => {
    presentDialog({
      title: "Delete set?",
      message: `${logicalLabel} and any short-rest reps`,
      actions: [
        { label: "cancel", variant: "cancel" },
        {
          label: "delete",
          variant: "danger",
          onPress: () => {
            const groupIndexes = new Set(group.map(({ index }) => index));
            const nextSets = exercise.sets.filter(
              (_set, setIndex) => !groupIndexes.has(setIndex),
            );
            onDispatch({
              type: "REPLACE_EXERCISE_SETS",
              exerciseIndex,
              sets: nextSets,
            });
          },
        },
      ],
    });
  };
  const openSetCommandMenu = (
    group: IndexedWorkoutSet[],
    logicalLabel: string,
    noteSet: IndexedWorkoutSet = group[0]!,
  ) => {
    onSelectExercise();
    triggerSelectionHaptic();

    const noteTarget: InlineNoteEditTarget = {
      kind: "set",
      exerciseIndex,
      setId: getSetTargetId(noteSet.set, noteSet.index),
    };
    const editNote = () => onStartInlineNoteEdit(noteTarget);
    const extend = () => appendShortRestSegment(group);
    const remove = () => deleteSetGroup(group, logicalLabel);

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          cancelButtonIndex: 3,
          destructiveButtonIndex: 2,
          options: ["edit note", "extend set", "delete set", "cancel"],
          title: logicalLabel,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) editNote();
          if (buttonIndex === 1) extend();
          if (buttonIndex === 2) remove();
        },
      );
      return;
    }

    presentDialog({
      title: logicalLabel,
      actions: [
        { label: "edit note", onPress: editNote },
        { label: "extend set", onPress: extend },
        { label: "delete set", variant: "danger", onPress: remove },
        { label: "cancel", variant: "cancel" },
      ],
    });
  };

  return (
    <View style={styles.exerciseSetCardsBlock}>
      {tabs.length > 0 ? (
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.exerciseSetTabsScroll}
        >
          <View style={styles.exerciseSetTabs}>
            {tabs.map((tab, tabIndex) => {
              const selected = activeCardIndex === tabIndex;
              return (
                <Pressable
                  key={`${tab.setId}-${tab.leadingSet.index}`}
                  accessibilityLabel={`Show ${tab.label}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={[
                    styles.exerciseSetTab,
                    selected ? styles.exerciseSetTabSelected : null,
                  ]}
                  onPress={() => scrollToSetTab(tab.leadingSet)}
                >
                  <View style={styles.exerciseSetTabContent}>
                    <Text
                      style={[
                        styles.exerciseSetTabText,
                        selected ? styles.exerciseSetTabTextSelected : null,
                      ]}
                    >
                      {tab.label}
                    </Text>
                    {tab.completed ? (
                      <Icon
                        name="checkmark-circle"
                        size={13}
                        color={palette.ink}
                      />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityLabel={`Add set to ${exercise.name}`}
              accessibilityRole="button"
              hitSlop={8}
              style={styles.exerciseSetTab}
              onPress={addSet}
            >
              <Icon name="add-outline" size={17} color={palette.muted} />
            </Pressable>
          </View>
        </ScrollView>
      ) : null}
      {groups.length === 0 ? <Text style={styles.metaText}>none</Text> : null}
      <ScrollView
        ref={scrollRef}
        horizontal
        decelerationRate="fast"
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.exerciseSetCardsContent}
        onLayout={(event) => {
          const nextWidth = Math.round(event.nativeEvent.layout.width);
          if (nextWidth > 0 && nextWidth !== cardsViewportWidth) {
            setCardsViewportWidth(nextWidth);
          }
        }}
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(
            event.nativeEvent.contentOffset.x / cardWidth,
          );
          setActiveCardIndex(
            Math.max(0, Math.min(groups.length - 1, nextIndex)),
          );
        }}
        snapToAlignment="start"
        snapToInterval={cardWidth}
        style={styles.exerciseSetCardsScroll}
      >
        {groups.map((group, groupIndex) => {
          const leadingSet = group[0]!;
          const previousGroup = previousGroups[groupIndex] ?? null;
          const leadingSetId = getSetTargetId(
            leadingSet.set,
            leadingSet.index,
          );
          const logicalLabel = setLabel(exercise, leadingSet.index);
          const cardLabel = setCardKindLabel(exercise, leadingSet.index);
          const cardIsWarmup = leadingSet.set.modifier === "warmup";
          const toggleWarmup = () => {
            onSelectExercise();
            const nextModifier: WorkoutSet["modifier"] = cardIsWarmup
              ? undefined
              : "warmup";
            const nextKindLabel = cardIsWarmup ? "working set" : "warm-up set";
            presentDialog({
              title: `Change ${logicalLabel}?`,
              message: `Make this ${nextKindLabel}?`,
              actions: [
                { label: "cancel", variant: "cancel" },
                {
                  label: "change",
                  variant: "primary",
                  onPress: () => {
                    triggerSelectionHaptic();
                    const groupIndexes = new Set(
                      group.map(({ index }) => index),
                    );
                    const nextSets = exercise.sets.map((set, setIndex) =>
                      groupIndexes.has(setIndex)
                        ? {
                            ...set,
                            modifier: nextModifier,
                          }
                        : set,
                    );
                    const nextExercise = { ...exercise, sets: nextSets };
                    onDispatch({
                      type: "REPLACE_EXERCISE_SETS",
                      exerciseIndex,
                      sets: nextSets,
                    });
                    scrollToSetCardById(leadingSetId, nextExercise);
                  },
                },
              ],
            });
          };
          return (
            <Pressable
              key={`${leadingSetId}-${leadingSet.index}`}
              accessible={false}
              style={[styles.exerciseSetCard, { width: cardWidth }]}
              onLongPress={() => openSetCommandMenu(group, logicalLabel)}
            >
              <View style={styles.exerciseSetCardRow}>
                <Pressable
                  accessibilityLabel={`${cardIsWarmup ? "Make" : "Mark"} ${logicalLabel} ${cardIsWarmup ? "a working set" : "warm-up"}`}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={[
                    styles.exerciseSetKindToggle,
                    cardIsWarmup ? styles.exerciseSetKindToggleWarmup : null,
                  ]}
                  onPress={toggleWarmup}
                >
                  <Text
                    style={[
                      styles.exerciseSetKindToggleText,
                      cardIsWarmup
                        ? styles.exerciseSetKindToggleTextWarmup
                        : null,
                    ]}
                  >
                    {cardLabel}
                  </Text>
                </Pressable>
                <View style={styles.exerciseSetCardLine}>
                  <PreviousSetReference
                    entry={previousEntry}
                    exercise={previousExercise}
                    group={previousGroup}
                  />
                  {group.map((indexedSet, segmentIndex) => {
                  const setId = getSetTargetId(
                    indexedSet.set,
                    indexedSet.index,
                  );
                  const values = getSetDisplayValues(
                    exercise,
                    indexedSet.set,
                    indexedSet.index,
                  );
                  const loadLabel = formatLedgerLoadLabel(exercise, indexedSet);
                  const repsLabel = formatLedgerRepsLabel(exercise, indexedSet);
                  const segmentLabel = setLabel(exercise, indexedSet.index);
                  const setNoteTarget: InlineNoteEditTarget = {
                    kind: "set",
                    exerciseIndex,
                    setId,
                  };
                  const editingSetNote = isSameNoteTarget(
                    inlineNoteTarget,
                    setNoteTarget,
                  );
                  const isWeightSelected =
                    selectedSetId === setId && selectedField === "weight";
                  const isRepsSelected =
                    selectedSetId === setId && selectedField === "reps";

                  return (
                    <View
                      key={`${setId}-${indexedSet.index}`}
                      style={styles.exerciseSetCardSegmentBlock}
                    >
                      {segmentIndex > 0 ? (
                        <Pressable
                          accessibilityLabel={`Toggle rest before ${segmentLabel}`}
                          accessibilityRole="button"
                          hitSlop={8}
                          style={styles.exerciseSetCardRestLabel}
                          onPress={() => {
                            onSelectExercise();
                            toggleRest(
                              onDispatch,
                              exerciseIndex,
                              exercise,
                              indexedSet.index,
                            );
                          }}
                        >
                          <Text style={styles.exerciseSetCardRestLabelText}>
                            short rest
                          </Text>
                        </Pressable>
                      ) : null}
                      <View
                        style={[
                          styles.exerciseSetCardSegment,
                          segmentIndex > 0
                            ? styles.exerciseSetCardContinuation
                            : null,
                        ]}
                      >
                        <Pressable
                          accessibilityLabel={`Edit ${segmentLabel} weight ${loadLabel}`}
                          accessibilityRole="button"
                          hitSlop={8}
                          style={[
                            styles.exerciseSetCardChip,
                            isWeightSelected
                              ? styles.inlineSetChipActive
                              : null,
                          ]}
                          onPress={() => {
                            onSelectExercise();
                            onOpenSet(setId, "weight");
                          }}
                          onLongPress={() =>
                            openSetCommandMenu(
                              group,
                              segmentLabel,
                              indexedSet,
                            )
                          }
                        >
                          <Text style={styles.exerciseSetCardText}>
                            {loadLabel}
                          </Text>
                        </Pressable>
                        <Text style={styles.exerciseSetCardText}>x</Text>
                        <Pressable
                          accessibilityLabel={`Edit ${segmentLabel} reps ${repsLabel}`}
                          accessibilityRole="button"
                          hitSlop={8}
                          style={[
                            styles.exerciseSetCardChip,
                            isRepsSelected ? styles.inlineSetChipActive : null,
                          ]}
                          onLongPress={() =>
                            openSetCommandMenu(
                              group,
                              segmentLabel,
                              indexedSet,
                            )
                          }
                          onPress={() => {
                            onSelectExercise();
                            onOpenSet(setId, "reps");
                          }}
                        >
                          <Text style={styles.exerciseSetCardText}>
                            {values.reps == null
                              ? "-"
                              : formatNumber(Number(values.reps))}
                          </Text>
                        </Pressable>
                        {segmentIndex === 0 ? (
                          <View style={styles.flexSpacer} />
                        ) : null}
                        {segmentIndex > 0 ? (
                          <Pressable
                            accessibilityLabel={`Delete ${segmentLabel} short-rest reps`}
                            accessibilityRole="button"
                            hitSlop={8}
                            style={styles.exerciseSetCardDelete}
                            onPress={() => deleteShortRestSegment(indexedSet)}
                          >
                            <Icon
                              name="trash-outline"
                              size={15}
                              color={palette.muted}
                            />
                          </Pressable>
                        ) : null}
                        {segmentIndex === 0 ? (
                          <Pressable
                            accessibilityLabel={`${indexedSet.set.completed ? "Mark incomplete" : "Complete"} ${segmentLabel}`}
                            accessibilityRole="button"
                            hitSlop={8}
                            style={[
                              styles.exerciseSetCardCompleteButton,
                              indexedSet.set.completed
                                ? styles.exerciseSetCardCompleteButtonActive
                                : null,
                            ]}
                            onPress={() => {
                              const wasCompleted = Boolean(
                                indexedSet.set.completed,
                              );
                              onSelectExercise();
                              triggerSelectionHaptic();
                              onDispatch({
                                type: "TOGGLE_SET_COMPLETED",
                                exerciseIndex,
                                setIndex: indexedSet.index,
                              });
                              if (!wasCompleted) onStartRestTimer();
                            }}
                          >
                            <Icon
                              name={
                                indexedSet.set.completed
                                  ? "checkmark-outline"
                                  : "checkmark"
                              }
                              size={15}
                              color={
                                indexedSet.set.completed
                                  ? palette.ink
                                  : palette.muted
                              }
                            />
                          </Pressable>
                        ) : null}
                      </View>
                      {editingSetNote ? (
                        <InlineNoteEditor
                          inputRef={inlineNoteInputRef}
                          note={inlineNoteDraft ?? indexedSet.set.notes ?? ""}
                          placeholder={`${segmentLabel} note`}
                          testID={`set-note-inline-input-${exerciseIndex}-${indexedSet.index}`}
                          onBlur={onEndInlineNoteEdit}
                          onChangeText={onChangeInlineNote}
                        />
                      ) : indexedSet.set.notes?.trim() ? (
                        <Pressable
                          accessibilityLabel={`Edit ${segmentLabel} note`}
                          accessibilityRole="button"
                          hitSlop={6}
                          style={styles.noteBadgeSelf}
                          testID={`set-note-inline-badge-${exerciseIndex}-${indexedSet.index}`}
                          onPress={() => {
                            onSelectExercise();
                            onStartInlineNoteEdit(setNoteTarget);
                          }}
                        >
                          <Text style={styles.noteBadgeText}>
                            {indexedSet.set.notes}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                  })}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {canSwipeToPreviousSet ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[styles.setSwipeIndicator, styles.setSwipeIndicatorLeft]}
        >
          <Icon name="chevron-back-outline" size={15} color={palette.muted} />
        </View>
      ) : null}
      {canSwipeToNextSet ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={[styles.setSwipeIndicator, styles.setSwipeIndicatorRight]}
        >
          <Icon name="chevron-forward-outline" size={15} color={palette.muted} />
        </View>
      ) : null}
    </View>
  );
}

function PreviousSetReference({
  entry,
  exercise,
  group,
}: {
  entry: ExerciseHistoryEntry | undefined;
  exercise: WorkoutExercise | null;
  group: IndexedWorkoutSet[] | null;
}) {
  if (!entry || !exercise || !group) return null;

  const notes = group
    .map((indexedSet) => indexedSet.set.notes?.trim())
    .filter((note): note is string => Boolean(note));
  const value = formatPreviousSetGroup(exercise, group);

  return (
    <View style={styles.previousSetReference}>
      <View style={styles.previousSetReferenceRow}>
        <Text style={styles.previousSetReferenceLabel}>Previous</Text>
        <Text style={styles.previousSetReferenceValue}>{value}</Text>
      </View>
      {notes.map((note, index) => (
        <Text
          key={`${note}-${index}`}
          numberOfLines={2}
          style={styles.previousSetReferenceNote}
        >
          {note}
        </Text>
      ))}
    </View>
  );
}

function ExerciseDetailsSheet({
  exercise,
  editRequest,
  open,
  selectedTab,
  onClose,
  onSaveUserExerciseSettings,
  onTextInputFocus,
  onSelectTab,
}: {
  exercise: WorkoutExercise;
  editRequest: number;
  open: boolean;
  selectedTab: ExerciseDetailsTab;
  onClose: () => void;
  onSaveUserExerciseSettings: (settings: UserExerciseSettings) => void;
  onTextInputFocus: () => void;
  onSelectTab: (tab: ExerciseDetailsTab) => void;
}) {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [draftNote, setDraftNote] = useState("");
  const [draftStartingWeight, setDraftStartingWeight] = useState<
    number | null
  >(null);
  const [draftLoadMode, setDraftLoadMode] =
    useState<PlateLoadMode>("equal-sides");
  const [startingWeightMenuOpen, setStartingWeightMenuOpen] = useState(false);

  const startEditing = useCallback(() => {
    setDraftNote(exercise.exerciseNotes ?? "");
    setDraftStartingWeight(exercise.plateStartingWeight ?? null);
    setDraftLoadMode(parsePlateMode(exercise.plateLoadMode));
    setStartingWeightMenuOpen(false);
    setEditing(true);
  }, [exercise.exerciseNotes, exercise.plateLoadMode, exercise.plateStartingWeight]);

  useEffect(() => {
    if (!open || editRequest === 0) return;
    startEditing();
  }, [editRequest, open, startEditing]);

  const closeSheet = () => {
    setEditing(false);
    onClose();
  };

  const cancelEditing = () => {
    setEditing(false);
    setStartingWeightMenuOpen(false);
  };

  const saveEditing = () => {
    onSaveUserExerciseSettings({
      note: draftNote,
      plateStartingWeight: draftStartingWeight,
      plateLoadMode: draftLoadMode,
    });
    setEditing(false);
    setStartingWeightMenuOpen(false);
    onSelectTab("about");
  };

  if (!open) return null;

  return (
    <AppModal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={closeSheet}
    >
      <SafeAreaView edges={["top", "left", "right"]} style={styles.exerciseDetailsShade}>
        <View
          style={[
            styles.exerciseDetailsSheet,
            { paddingTop: Math.max(insets.top + 8, 48) },
            editing ? styles.exerciseDetailsSheetEditing : null,
          ]}
        >
          <View style={styles.exerciseDetailsHeader}>
            <Pressable
              accessibilityLabel={
                editing ? "Cancel exercise editing" : "Close exercise details"
              }
              accessibilityRole="button"
              hitSlop={8}
              style={styles.exerciseDetailsCloseButton}
              onPress={editing ? cancelEditing : closeSheet}
            >
              <Icon name="close-outline" size={25} color={palette.ink} />
            </Pressable>
            <Text
              numberOfLines={1}
              style={styles.exerciseDetailsHeaderTitle}
            >
              {editing ? "Edit Exercise" : exercise.name}
            </Text>
            <Pressable
              accessibilityLabel={
                editing ? `Save ${exercise.name}` : `Edit ${exercise.name}`
              }
              accessibilityRole="button"
              hitSlop={8}
              style={styles.exerciseDetailsEditButton}
              onPress={editing ? saveEditing : startEditing}
            >
              <Text style={styles.exerciseDetailsEditText}>
                {editing ? "Save" : "Edit"}
              </Text>
            </Pressable>
          </View>

          {editing ? null : (
            <ExerciseDetailsTabBar
              selectedTab={selectedTab}
              onSelectTab={onSelectTab}
            />
          )}

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={styles.exerciseDetailsBody}
            contentContainerStyle={styles.exerciseDetailsBodyContent}
          >
            {editing ? (
              <ExerciseDetailsEditContent
                exercise={exercise}
                draftLoadMode={draftLoadMode}
                draftNote={draftNote}
                draftStartingWeight={draftStartingWeight}
                startingWeightMenuOpen={startingWeightMenuOpen}
                onChangeDraftLoadMode={setDraftLoadMode}
                onChangeDraftNote={setDraftNote}
                onChangeDraftStartingWeight={(weight) => {
                  setDraftStartingWeight(weight);
                  setStartingWeightMenuOpen(false);
                }}
                onTextInputFocus={onTextInputFocus}
                onToggleStartingWeightMenu={() =>
                  setStartingWeightMenuOpen((open) => !open)
                }
              />
            ) : (
              <ExerciseDetailsTabContent
                exercise={exercise}
                selectedTab={selectedTab}
              />
            )}
          </ScrollView>
        </View>
      </SafeAreaView>
    </AppModal>
  );
}

function ExerciseDetailsEditContent({
  exercise,
  draftLoadMode,
  draftNote,
  draftStartingWeight,
  startingWeightMenuOpen,
  onChangeDraftLoadMode,
  onChangeDraftNote,
  onChangeDraftStartingWeight,
  onTextInputFocus,
  onToggleStartingWeightMenu,
}: {
  exercise: WorkoutExercise;
  draftLoadMode: PlateLoadMode;
  draftNote: string;
  draftStartingWeight: number | null;
  startingWeightMenuOpen: boolean;
  onChangeDraftLoadMode: (mode: PlateLoadMode) => void;
  onChangeDraftNote: (note: string) => void;
  onChangeDraftStartingWeight: (weight: number | null) => void;
  onTextInputFocus: () => void;
  onToggleStartingWeightMenu: () => void;
}) {
  const startingWeightChoices: Array<{
    label: string;
    weight: number | null;
  }> = [{ label: "not set", weight: null }, ...STARTING_WEIGHTS];

  return (
    <View style={styles.exerciseDetailsEditForm}>
      <View style={styles.exerciseDetailsEditGroup}>
        <Text style={styles.exerciseDetailsEditLabel}>Name</Text>
        <View style={styles.exerciseDetailsLockedField}>
          <Text
            numberOfLines={1}
            style={styles.exerciseDetailsLockedFieldText}
          >
            {exercise.name}
          </Text>
          <Icon name="lock-closed-outline" size={16} color={palette.muted} />
        </View>
      </View>

      <View style={styles.exerciseDetailsEditGroup}>
        <Text style={styles.exerciseDetailsEditLabel}>
          pinned exercise note
        </Text>
        <TextInput
          accessibilityLabel={`${exercise.name} pinned exercise note`}
          autoCapitalize="sentences"
          autoCorrect={false}
          blurOnSubmit={false}
          multiline
          placeholder="note"
          placeholderTextColor={palette.muted}
          style={styles.exerciseDetailsNoteInput}
          value={draftNote}
          onChangeText={onChangeDraftNote}
          onFocus={onTextInputFocus}
        />
      </View>

      <View style={styles.exerciseDetailsEditGroup}>
        <Text style={styles.exerciseDetailsEditLabel}>
          starting weight / bar
        </Text>
        <Pressable
          accessibilityLabel="Choose exercise starting weight or bar"
          accessibilityRole="button"
          style={styles.exerciseDetailsSelect}
          onPress={onToggleStartingWeightMenu}
        >
          <Text style={styles.exerciseDetailsSelectText}>
            {formatExerciseStartingWeightChoice(draftStartingWeight)}
          </Text>
          <Icon name="chevron-down-outline" size={18} />
        </Pressable>
        {startingWeightMenuOpen ? (
          <View style={styles.exerciseDetailsMenu}>
            {startingWeightChoices.map((choice) => (
              <Pressable
                key={choice.weight == null ? "unset" : choice.weight}
                accessibilityLabel={`Use ${choice.label} starting weight`}
                accessibilityRole="button"
                style={styles.exerciseDetailsMenuItem}
                onPress={() => onChangeDraftStartingWeight(choice.weight)}
              >
                <Text style={styles.exerciseDetailsMenuItemText}>
                  {choice.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.exerciseDetailsEditGroup}>
        <Text style={styles.exerciseDetailsEditLabel}>load mode</Text>
        <View style={styles.segmentedRow}>
          <SegmentedChoice
            active={draftLoadMode === "equal-sides"}
            accessibilityLabel="Use weight per side"
            onPress={() => onChangeDraftLoadMode("equal-sides")}
          >
            weight per side
          </SegmentedChoice>
          <SegmentedChoice
            active={draftLoadMode === "total"}
            accessibilityLabel="Use total load"
            onPress={() => onChangeDraftLoadMode("total")}
          >
            total load
          </SegmentedChoice>
        </View>
      </View>
    </View>
  );
}

const EXERCISE_DETAILS_TABS: Array<{
  id: ExerciseDetailsTab;
  label: string;
}> = [
  { id: "about", label: "About" },
  { id: "history", label: "History" },
  { id: "charts", label: "Charts" },
  { id: "records", label: "Records" },
];

function ExerciseDetailsTabBar({
  selectedTab,
  onSelectTab,
}: {
  selectedTab: ExerciseDetailsTab;
  onSelectTab: (tab: ExerciseDetailsTab) => void;
}) {
  return (
    <View style={styles.exerciseDetailsTabs}>
      {EXERCISE_DETAILS_TABS.map((tab) => {
        const selected = tab.id === selectedTab;
        return (
          <Pressable
            key={tab.id}
            accessibilityLabel={`Show ${tab.label}`}
            accessibilityRole="button"
            style={[
              styles.exerciseDetailsTab,
              selected ? styles.exerciseDetailsTabActive : null,
            ]}
            onPress={() => onSelectTab(tab.id)}
          >
            <Text
              style={[
                styles.exerciseDetailsTabText,
                selected ? styles.exerciseDetailsTabTextActive : null,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ExerciseDetailsTabContent({
  exercise,
  selectedTab,
}: {
  exercise: WorkoutExercise;
  selectedTab: ExerciseDetailsTab;
}) {
  if (selectedTab === "about") return <ExerciseDetailsAbout exercise={exercise} />;
  if (selectedTab === "history") {
    return <ExerciseDetailsHistory exercise={exercise} />;
  }
  if (selectedTab === "charts") return <ExerciseDetailsCharts exercise={exercise} />;
  return <ExerciseDetailsRecords exercise={exercise} />;
}

function ExerciseDetailsAbout({ exercise }: { exercise: WorkoutExercise }) {
  const pinnedNote = exercise.exerciseNotes?.trim();
  const workoutExerciseNote = exercise.notes[0]?.text?.trim();

  return (
    <View style={styles.exerciseDetailsSection}>
      {pinnedNote ? (
        <ExerciseDetailsNoteRow iconName="pin-outline" value={pinnedNote} />
      ) : null}
      {workoutExerciseNote ? (
        <ExerciseDetailsNoteRow value={workoutExerciseNote} />
      ) : null}
      <ExerciseDetailsInfoRow
        label="Load helper"
        value={formatExercisePlateSettings(exercise)}
      />
      <ExerciseDetailsInfoRow
        label="History"
        value={`${exercise.history?.length ?? 0} ${
          exercise.history?.length === 1 ? "workout" : "workouts"
        }`}
      />
    </View>
  );
}

function ExerciseDetailsNoteRow({
  iconName,
  value,
}: {
  iconName?: React.ComponentProps<typeof Ionicons>["name"];
  value: string;
}) {
  return (
    <View style={styles.exerciseDetailsNoteRow}>
      {iconName ? (
        <Icon name={iconName} size={13} color={palette.muted} />
      ) : null}
      <Text style={styles.exerciseDetailsInfoValue}>{value}</Text>
    </View>
  );
}

function ExerciseDetailsInfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.exerciseDetailsInfoRow}>
      <Text style={styles.exerciseDetailsInfoLabel}>{label}</Text>
      <Text style={styles.exerciseDetailsInfoValue}>{value}</Text>
    </View>
  );
}

function formatExercisePlateSettings(exercise: WorkoutExercise) {
  const start =
    exercise.plateStartingWeight == null
      ? "start unset"
      : exercise.plateStartingWeight === 0
        ? "no starting weight"
        : `${formatNumber(exercise.plateStartingWeight)}lb start`;
  const mode =
    exercise.plateLoadMode === "total"
      ? "total load"
      : exercise.plateLoadMode === "equal-sides"
        ? "equal sides"
        : "load mode unset";
  return `${start} . ${mode}`;
}

function formatExerciseStartingWeightChoice(weight: number | null) {
  if (weight == null) return "not set";
  return getStartingWeightLabel(weight);
}

function ExerciseDetailsHistory({ exercise }: { exercise: WorkoutExercise }) {
  const entries = exercise.history ?? [];

  if (entries.length === 0) {
    return (
      <View style={styles.exerciseDetailsEmpty}>
        <Text style={styles.metaText}>no history yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.exerciseDetailsHistoryList}>
      {entries.map((entry) => (
        <View
          key={`${entry.relation}-${entry.relativeDate}-${entry.date}`}
          style={styles.exerciseDetailsHistoryCard}
        >
          <Text style={styles.exerciseDetailsHistoryMeta}>
            {entry.relation} . {entry.relativeDate} . {entry.date}
          </Text>
          <ExerciseDetailsHistoryNote text={entry.workoutNote} />
          <ExerciseDetailsHistoryNote
            iconName="pin-outline"
            text={entry.exerciseNotesSnapshot}
          />
          <ExerciseDetailsHistoryNote text={entry.workoutExerciseNote} />
          <ExerciseDetailsHistorySetRows exercise={exercise} entry={entry} />
        </View>
      ))}
    </View>
  );
}

function ExerciseDetailsHistoryNote({
  iconName,
  text,
}: {
  iconName?: IconName;
  text?: string | null;
}) {
  const trimmedText = text?.trim();
  if (!trimmedText) return null;

  return (
    <View style={styles.exerciseDetailsHistoryNoteBadge}>
      {iconName ? <Icon name={iconName} size={13} color={palette.muted} /> : null}
      <Text
        style={[
          styles.noteBadgeTextInline,
          styles.exerciseDetailsHistoryNoteText,
        ]}
      >
        {trimmedText}
      </Text>
    </View>
  );
}

function ExerciseDetailsHistorySetRows({
  exercise,
  entry,
}: {
  exercise: WorkoutExercise;
  entry: ExerciseHistoryEntry;
}) {
  const historicalExercise = buildHistoricalExercise(exercise, entry);
  const indexedSets = historicalExercise.sets.map((set, index) => ({
    index,
    set,
  }));
  const groups = groupLedgerSets(indexedSets);

  if (groups.length === 0) return <Text style={styles.metaText}>no sets</Text>;

  return (
    <View style={styles.exerciseDetailsHistoryRows}>
      <View style={styles.exerciseDetailsHistoryRowHeader}>
        <Text style={styles.exerciseDetailsHistoryHeaderText}>
          Sets Performed
        </Text>
        <Text style={styles.exerciseDetailsHistoryHeaderText}>1RM</Text>
      </View>
      {groups.map((group) => {
        const leadingSet = group[0]!;
        const label =
          leadingSet.set.modifier === "warmup"
            ? "W"
            : getLedgerSetIndexLabel(historicalExercise, leadingSet);
        const e1rm = getHistoryGroupOneRepMax(entry, group);
        const notes = group
          .map((indexedSet, groupIndex) => ({
            key: `${indexedSet.index}-${groupIndex}`,
            text: indexedSet.set.notes?.trim(),
          }))
          .filter(
            (note): note is { key: string; text: string } => Boolean(note.text),
          );

        return (
          <View
            key={`${entry.date}-${leadingSet.index}`}
            style={styles.exerciseDetailsHistorySetBlock}
          >
            <View style={styles.exerciseDetailsHistorySetRow}>
              <Text
                style={[
                  styles.exerciseDetailsHistorySetIndex,
                  leadingSet.set.modifier === "warmup"
                    ? styles.exerciseDetailsHistoryWarmupIndex
                    : null,
                ]}
              >
                {label}
              </Text>
              <Text style={styles.exerciseDetailsHistorySetText}>
                {formatPreviousSetGroup(historicalExercise, group)}
              </Text>
              <Text style={styles.exerciseDetailsHistoryOneRepMax}>
                {e1rm == null ? "-" : formatNumber(e1rm)}
              </Text>
            </View>
            {notes.length > 0 ? (
              <View style={styles.exerciseDetailsHistorySetNotes}>
                {notes.map((note) => (
                  <ExerciseDetailsHistoryNote
                    key={note.key}
                    text={note.text}
                  />
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function getHistoryGroupOneRepMax(
  entry: ExerciseHistoryEntry,
  group: IndexedWorkoutSet[],
) {
  let best: number | null = null;
  for (const indexedSet of group) {
    const historySet = entry.sets[indexedSet.index];
    if (!historySet) continue;
    const weight = getHistorySetLoad(entry, historySet);
    const reps = Number(historySet.reps);
    if (weight == null || weight <= 0 || !Number.isFinite(reps) || reps <= 0) {
      continue;
    }
    const e1rm = estimate1RM(weight, reps);
    best = best == null || e1rm > best ? e1rm : best;
  }
  return best;
}

function ExerciseDetailsCharts({ exercise }: { exercise: WorkoutExercise }) {
  const { chartCount, charts } = buildExerciseDetailsCharts(exercise.history);

  if (chartCount === 0) {
    return (
      <View style={styles.exerciseDetailsEmpty}>
        <Text style={styles.metaText}>more data soon</Text>
      </View>
    );
  }

  return (
    <View style={styles.exerciseDetailsChartList}>
      {charts.map((chart) => (
        <View key={chart.key} style={styles.exerciseDetailsChartCard}>
          <HistoryTinyChart title={chart.title} points={chart.points} />
        </View>
      ))}
    </View>
  );
}

function ExerciseDetailsRecords({ exercise }: { exercise: WorkoutExercise }) {
  const records = buildExerciseDetailsRecords(exercise.history);

  if (records.length === 0) {
    return (
      <View style={styles.exerciseDetailsEmpty}>
        <Text style={styles.metaText}>more data soon</Text>
      </View>
    );
  }

  return (
    <View style={styles.exerciseDetailsSection}>
      {records.map((record) => (
        <View key={record.label} style={styles.exerciseDetailsRecordRow}>
          <View style={styles.flexColumn}>
            <Text style={styles.exerciseDetailsRecordLabel}>
              {record.label}
            </Text>
            {record.detail ? (
              <Text style={styles.exerciseDetailsRecordDetail}>
                {record.detail}
              </Text>
            ) : null}
          </View>
          <Text style={styles.exerciseDetailsRecordValue}>{record.value}</Text>
        </View>
      ))}
    </View>
  );
}

type HistoryChartPoint = {
  xValue: number;
  value: number;
  displayValue: string;
};

type ParsedHistoryStats = {
  e1rm: number | null;
  bestSetVolume: number | null;
  volume: number | null;
  maxConsecutiveReps: number | null;
};

type ExerciseDetailsChart = {
  key: string;
  title: string;
  points: HistoryChartPoint[];
};

type ExerciseDetailsRecord = {
  label: string;
  value: string;
  detail?: string;
};

function HistoryTinyChart({
  title,
  points,
}: {
  title: string;
  points: HistoryChartPoint[];
}) {
  const chartWidth = 300;
  const chartHeight = 82;
  const positions = getChartPositions(points, chartWidth, chartHeight);
  const labelOffsets = [12, 28, 44];

  return (
    <View style={styles.historyChartBlock}>
      <Text style={styles.subtleTitle}>{title}</Text>
      {points.length > 0 ? (
        <View
          accessibilityLabel={`${title}: ${points
            .map((point) => point.displayValue)
            .join(", ")}`}
          style={[styles.historyChart, { height: chartHeight }]}
        >
          {positions.slice(1).map((position, index) => {
            const previous = positions[index];
            const dx = position.x - previous.x;
            const dy = position.y - previous.y;
            const length = Math.hypot(dx, dy);
            const angle = `${Math.atan2(dy, dx)}rad`;

            return (
              <View
                key={`line-${index}`}
                style={[
                  styles.historyChartLine,
                  {
                    left: previous.x,
                    top: previous.y,
                    transform: [{ rotateZ: angle }],
                    width: length,
                  },
                ]}
              />
            );
          })}
          {positions.map((position, index) => (
            <React.Fragment key={`${points[index].displayValue}-${index}`}>
              <Text
                style={[
                  styles.historyChartValue,
                  {
                    left: Math.max(
                      0,
                      Math.min(chartWidth - 56, position.x - 22),
                    ),
                    top: Math.max(
                      0,
                      position.y - labelOffsets[index % labelOffsets.length],
                    ),
                  },
                ]}
              >
                {points[index].displayValue}
              </Text>
              <View
                style={[
                  styles.historyChartDot,
                  { left: position.x - 2.5, top: position.y - 2.5 },
                ]}
              />
            </React.Fragment>
          ))}
        </View>
      ) : (
        <Text style={styles.metaText}>more data soon</Text>
      )}
    </View>
  );
}

function getChartPositions(
  points: HistoryChartPoint[],
  width: number,
  height: number,
) {
  if (points.length === 0) return [];
  const xValues = points.map((point) => point.xValue);
  const yValues = points.map((point) => point.value);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const xSpan = maxX - minX || 1;
  const ySpan = maxY - minY || 1;
  const xPadding = 20;
  const yPadding = 44;

  return points.map((point) => ({
    x: xPadding + ((point.xValue - minX) / xSpan) * (width - xPadding * 2),
    y: yPadding + (1 - (point.value - minY) / ySpan) * (height - yPadding - 8),
  }));
}

function buildExerciseDetailsCharts(history: WorkoutExercise["history"]): {
  chartCount: number;
  charts: ExerciseDetailsChart[];
} {
  if (!history || history.length === 0) {
    return { chartCount: 0, charts: [] };
  }

  const recentChronological = history
    .slice(0, 5)
    .map((entry) => ({ entry, stats: getHistoryWorkoutStats(entry) }))
    .reverse();
  const xValues = getHistoryChartXValues(
    recentChronological.map(({ entry }) => entry),
  );
  let currentPr: number | null = null;

  const e1rmPoints: HistoryChartPoint[] = [];
  const bestSetVolumePoints: HistoryChartPoint[] = [];
  const totalVolumePoints: HistoryChartPoint[] = [];
  const prPoints: HistoryChartPoint[] = [];
  const maxRepPoints: HistoryChartPoint[] = [];

  recentChronological.forEach(({ stats }, index) => {
    const xValue = xValues[index] ?? index;
    if (stats.e1rm != null) {
      e1rmPoints.push(toHistoryChartPoint(stats.e1rm, xValue));
      currentPr =
        currentPr == null ? stats.e1rm : Math.max(currentPr, stats.e1rm);
    }
    if (currentPr != null) {
      prPoints.push(toHistoryChartPoint(currentPr, xValue));
    }
    if (stats.bestSetVolume != null) {
      bestSetVolumePoints.push(
        toHistoryChartPoint(stats.bestSetVolume, xValue),
      );
    }
    if (stats.volume != null) {
      totalVolumePoints.push(toHistoryChartPoint(stats.volume, xValue));
    }
    if (stats.maxConsecutiveReps != null) {
      maxRepPoints.push(
        toHistoryChartPoint(stats.maxConsecutiveReps, xValue, "reps"),
      );
    }
  });

  return {
    chartCount: recentChronological.length,
    charts: [
      {
        key: "best-set-e1rm",
        title: "best set (est 1rm)",
        points: e1rmPoints,
      },
      {
        key: "best-set-volume",
        title: "best set (max volume)",
        points: bestSetVolumePoints,
      },
      {
        key: "total-volume",
        title: "total volume",
        points: totalVolumePoints,
      },
      {
        key: "pr-progression-e1rm",
        title: "PR progression (1rm)",
        points: prPoints,
      },
      {
        key: "max-consecutive-reps",
        title: "max consecutive reps",
        points: maxRepPoints,
      },
    ],
  };
}

function buildExerciseDetailsRecords(
  history: WorkoutExercise["history"],
): ExerciseDetailsRecord[] {
  if (!history || history.length === 0) return [];

  const entries = history.map((entry) => ({
    entry,
    stats: getHistoryWorkoutStats(entry),
  }));
  const records: ExerciseDetailsRecord[] = [];

  const bestE1rm = getBestHistoryMetric(entries, (item) => item.stats.e1rm);
  if (bestE1rm) {
    records.push({
      label: "best set (est 1rm)",
      value: `${formatNumber(bestE1rm.value)}lb`,
      detail: `${bestE1rm.entry.relation} . ${bestE1rm.entry.date}`,
    });
  }

  const bestSetVolume = getBestHistoryMetric(
    entries,
    (item) => item.stats.bestSetVolume,
  );
  if (bestSetVolume) {
    records.push({
      label: "best set (max volume)",
      value: `${formatNumber(bestSetVolume.value)}lb`,
      detail: `${bestSetVolume.entry.relation} . ${bestSetVolume.entry.date}`,
    });
  }

  const bestTotalVolume = getBestHistoryMetric(
    entries,
    (item) => item.stats.volume,
  );
  if (bestTotalVolume) {
    records.push({
      label: "total volume",
      value: `${formatNumber(bestTotalVolume.value)}lb`,
      detail: `${bestTotalVolume.entry.relation} . ${bestTotalVolume.entry.date}`,
    });
  }

  const maxReps = getBestHistoryMetric(
    entries,
    (item) => item.stats.maxConsecutiveReps,
  );
  if (maxReps) {
    records.push({
      label: "max consecutive reps",
      value: formatNumber(maxReps.value),
      detail: `${maxReps.entry.relation} . ${maxReps.entry.date}`,
    });
  }

  return records;
}

function getBestHistoryMetric<T extends { entry: ExerciseHistoryEntry }>(
  entries: T[],
  selector: (entry: T) => number | null,
) {
  return entries.reduce<{
    entry: ExerciseHistoryEntry;
    value: number;
  } | null>((best, item) => {
    const value = selector(item);
    if (value == null || !Number.isFinite(value)) return best;
    if (!best || value > best.value) {
      return { entry: item.entry, value };
    }
    return best;
  }, null);
}

function toHistoryChartPoint(
  value: number,
  xValue: number,
  unit: "lb" | "reps" = "lb",
): HistoryChartPoint {
  return {
    xValue,
    value,
    displayValue:
      unit === "lb" ? `${formatNumber(value)}lb` : formatNumber(value),
  };
}

function getHistoryChartXValues(
  history: NonNullable<WorkoutExercise["history"]>,
) {
  const daysAgoValues = history.map((item) =>
    parseHistoryRelativeDaysAgo(item.relativeDate),
  );

  if (
    daysAgoValues.every((value): value is number => value != null) &&
    new Set(daysAgoValues).size > 1
  ) {
    const oldestDaysAgo = Math.max(...daysAgoValues);
    return daysAgoValues.map((daysAgo) => oldestDaysAgo - daysAgo);
  }

  return history.map((_, index) => index);
}

function parseHistoryRelativeDaysAgo(relativeDate: string) {
  const normalized = relativeDate.trim().toLowerCase();
  if (normalized === "today") return 0;
  if (normalized === "yesterday") return 1;

  const match = /^(\d+)\s+(day|week|month|year)s?\s+ago$/.exec(normalized);
  if (!match) return null;

  const value = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(value)) return null;

  if (unit === "day") return value;
  if (unit === "week") return value * 7;
  if (unit === "month") return value * 30;
  if (unit === "year") return value * 365;
  return null;
}

function getHistoryWorkoutStats(
  entry: NonNullable<WorkoutExercise["history"]>[number],
): ParsedHistoryStats {
  let bestE1rm: number | null = null;
  let bestSetVolume: number | null = null;
  let maxConsecutiveReps: number | null = null;
  let volume = 0;

  for (const set of entry.sets) {
    if (set.modifier === "warmup") continue;

    const weight = getHistorySetLoad(entry, set);
    const reps = Number(set.reps);
    if (weight == null || !Number.isFinite(reps) || reps <= 0) continue;

    maxConsecutiveReps =
      maxConsecutiveReps == null ? reps : Math.max(maxConsecutiveReps, reps);

    if (weight > 0) {
      const setVolume = weight * reps;
      volume += setVolume;
      bestSetVolume =
        bestSetVolume == null ? setVolume : Math.max(bestSetVolume, setVolume);
    }

    const e1rm = weight > 0 ? estimate1RM(weight, reps) : null;
    if (e1rm != null && (bestE1rm == null || e1rm > bestE1rm)) {
      bestE1rm = e1rm;
    }
  }

  return {
    e1rm: bestE1rm,
    bestSetVolume,
    volume: volume > 0 ? volume : null,
    maxConsecutiveReps,
  };
}

function getHistorySetLoad(
  entry: NonNullable<WorkoutExercise["history"]>[number],
  set: NonNullable<WorkoutExercise["history"]>[number]["sets"][number],
) {
  if (set.weightModifier === "bodyweight") {
    const offset = set.weight ?? 0;
    return entry.bodyWeightLb == null ? offset : entry.bodyWeightLb + offset;
  }
  return set.weight;
}

function SetLedger({
  title,
  exercise,
  sets,
  selectedSetId,
  selectedField,
  onOpenSet,
  onToggleComplete,
  onToggleRest,
}: {
  title?: string;
  exercise: WorkoutExercise;
  sets: IndexedWorkoutSet[];
  selectedSetId: string | null;
  selectedField: SetEditField | null;
  onOpenSet: (setId: string, field?: SetEditField) => void;
  onToggleComplete: (setIndex: number) => void;
  onToggleRest: (setIndex: number) => void;
}) {
  const noteEntries = sets
    .filter(({ set }) => Boolean(set.notes?.trim()))
    .map(({ set, index }, noteIndex) => ({
      letter: String.fromCharCode(97 + noteIndex),
      note: set.notes!.trim(),
      setId: getSetTargetId(set, index),
    }));
  const noteBySetId = new Map(
    noteEntries.map((entry) => [entry.setId, entry.letter]),
  );
  const groups = groupLedgerSets(sets);

  return (
    <View style={styles.setLedger}>
      {title ? <Text style={styles.subtleTitle}>{title}</Text> : null}
      {sets.length === 0 ? <Text style={styles.metaText}>none</Text> : null}
      {groups.map((group, rowIndex) => {
        const leadingSet = group[0]!;
        const leadingSetId = getSetTargetId(
          leadingSet.set,
          leadingSet.index,
        );
        const loadLabel = formatLedgerLoadLabel(exercise, leadingSet);
        const isWeightSelected =
          selectedSetId === leadingSetId && selectedField === "weight";
        const rowSelected = group.some(
          (indexedSet) =>
            selectedSetId === getSetTargetId(indexedSet.set, indexedSet.index),
        );
        const setAccessibilityName = setLabel(exercise, leadingSet.index);

        return (
          <React.Fragment key={`${leadingSetId}-${leadingSet.index}`}>
            {rowIndex > 0 ? (
              <Pressable
                accessibilityLabel={`Toggle rest before ${setAccessibilityName}`}
                accessibilityRole="button"
                hitSlop={8}
                style={styles.setLedgerRestRow}
                onPress={() => onToggleRest(leadingSet.index)}
              >
                <Text style={styles.setLedgerRestText}>
                  {leadingSet.set.restBefore === "short"
                    ? "short rest"
                    : "standard rest"}
                </Text>
              </Pressable>
            ) : null}
            <View
              style={[
                styles.setLedgerRow,
                rowSelected ? styles.setLedgerRowSelected : null,
              ]}
            >
              <Text style={styles.setLedgerIndex}>
                {getLedgerSetIndexLabel(exercise, leadingSet)}
              </Text>
              <Pressable
                accessibilityLabel={`Edit ${setAccessibilityName} weight ${loadLabel}`}
                accessibilityRole="button"
                hitSlop={8}
                style={[
                  styles.setLedgerValue,
                  isWeightSelected ? styles.setLedgerValueSelected : null,
                ]}
                onPress={() => onOpenSet(leadingSetId, "weight")}
              >
                <Text style={styles.setLedgerLoadText}>{loadLabel}</Text>
              </Pressable>
              <View style={styles.setLedgerRepsChain}>
                {group.map((indexedSet, segmentIndex) => {
                  const setId = getSetTargetId(indexedSet.set, indexedSet.index);
                  const repsLabel = formatLedgerSegmentRepsLabel(
                    exercise,
                    indexedSet,
                    segmentIndex === 0 ? undefined : group[segmentIndex - 1],
                  );
                  const noteLetter = noteBySetId.get(setId);
                  const isRepsSelected =
                    selectedSetId === setId && selectedField === "reps";
                  const segmentAccessibilityName = setLabel(
                    exercise,
                    indexedSet.index,
                  );

                  return (
                    <React.Fragment key={`${setId}-${indexedSet.index}`}>
                      {segmentIndex > 0 ? (
                        <Pressable
                          accessibilityLabel={`Toggle rest before ${segmentAccessibilityName}`}
                          accessibilityRole="button"
                          hitSlop={8}
                          style={styles.setLedgerShortRestChip}
                          onPress={() => onToggleRest(indexedSet.index)}
                        >
                          <Text style={styles.setLedgerRestJoinText}>+</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        accessibilityLabel={`Edit ${segmentAccessibilityName} reps ${repsLabel}`}
                        accessibilityRole="button"
                        hitSlop={8}
                        style={[
                          styles.setLedgerReps,
                          indexedSet.set.completed
                            ? styles.setLedgerRepsCompleted
                            : null,
                          isRepsSelected ? styles.setLedgerValueSelected : null,
                        ]}
                        onLongPress={() => {
                          triggerSelectionHaptic();
                          onToggleComplete(indexedSet.index);
                        }}
                        onPress={() => onOpenSet(setId, "reps")}
                      >
                        <Text style={styles.setLedgerRepsText}>
                          {repsLabel}
                          {noteLetter ? (
                            <Text style={styles.supText}>{noteLetter}</Text>
                          ) : null}
                        </Text>
                      </Pressable>
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          </React.Fragment>
        );
      })}
      {noteEntries.length > 0 ? (
        <View style={styles.noteList}>
          {noteEntries.map((entry) => (
            <View
              key={`${entry.setId}-${entry.letter}-${entry.note}`}
              style={styles.noteRow}
            >
              <Text style={styles.noteLetter}>{entry.letter}</Text>
              <Text style={styles.noteBadge}>{entry.note}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function groupLedgerSets(sets: IndexedWorkoutSet[]) {
  const groups: IndexedWorkoutSet[][] = [];
  for (const indexedSet of sets) {
    const currentGroup = groups[groups.length - 1];
    if (indexedSet.set.restBefore === "short" && currentGroup) {
      currentGroup.push(indexedSet);
    } else {
      groups.push([indexedSet]);
    }
  }
  return groups;
}

function buildWatchCurrentSetSnapshot(
  exercise: WorkoutExercise,
  selectedSetId: string | null,
) {
  const { warmups, working } = splitSets(exercise);
  const groups = [...groupLedgerSets(warmups), ...groupLedgerSets(working)];
  const selectedIndex =
    selectedSetId == null ? null : findSetIndex(exercise, selectedSetId);
  const selectedGroup =
    selectedIndex == null
      ? null
      : groups.find((group) =>
          group.some((indexedSet) => indexedSet.index === selectedIndex),
        );
  const firstIncompleteGroup = groups.find(
    (group) => !group[0]?.set.completed,
  );
  const group = selectedGroup ?? firstIncompleteGroup ?? groups[0] ?? [];
  const leadingSet = group[0];

  if (!leadingSet) {
    return {
      setId: null,
      label: "set",
      text: "no sets",
      weight: null,
      reps: null,
      weightModifier: null,
      completed: false,
    };
  }

  return {
    setId: getSetTargetId(leadingSet.set, leadingSet.index),
    label: setLabel(exercise, leadingSet.index),
    text: formatPreviousSetGroup(exercise, group),
    weight: leadingSet.set.weight,
    reps: leadingSet.set.reps,
    weightModifier: leadingSet.set.weightModifier ?? null,
    completed: Boolean(leadingSet.set.completed),
  };
}

function getAdjacentIndex(
  currentIndex: number,
  count: number,
  direction: "previous" | "next",
) {
  if (count <= 0) return null;
  const nextIndex =
    direction === "previous" ? currentIndex - 1 : currentIndex + 1;
  return Math.min(Math.max(nextIndex, 0), count - 1);
}

function getAdjacentWatchSetGroupTarget(
  exercise: WorkoutExercise | undefined,
  selectedSetId: string | null,
  direction: "previous" | "next",
) {
  if (!exercise) return null;
  const { warmups, working } = splitSets(exercise);
  const groups = [...groupLedgerSets(warmups), ...groupLedgerSets(working)];
  if (groups.length === 0) return null;

  const selectedIndex =
    selectedSetId == null ? null : findSetIndex(exercise, selectedSetId);
  const selectedGroupIndex =
    selectedIndex == null
      ? groups.findIndex((group) => !group[0]?.set.completed)
      : groups.findIndex((group) =>
          group.some((indexedSet) => indexedSet.index === selectedIndex),
        );
  const currentGroupIndex =
    selectedGroupIndex >= 0 ? selectedGroupIndex : 0;
  const nextGroupIndex = getAdjacentIndex(
    currentGroupIndex,
    groups.length,
    direction,
  );
  if (nextGroupIndex == null) return null;
  return groups[nextGroupIndex]?.[0] ?? null;
}

function normalizeWatchSetValue(
  command: Extract<WatchWorkoutCommand, { type: "setSetValue" }>,
  set: WorkoutSet,
) {
  const numericValue =
    typeof command.value === "number" && Number.isFinite(command.value)
      ? command.value
      : null;

  if (numericValue == null) return null;

  if (command.field === "reps") {
    return Math.max(0, Math.round(numericValue));
  }

  if (set.weightModifier === "bodyweight") {
    return Math.round(numericValue * 2) / 2;
  }

  return Math.max(0, Math.round(numericValue * 2) / 2);
}

function buildHistoricalExercise(
  exercise: WorkoutExercise,
  entry: ExerciseHistoryEntry,
): WorkoutExercise {
  return {
    ...exercise,
    sets: entry.sets.map((set, index) => ({
      weight: set.weight,
      reps: set.reps,
      completed: true,
      weightExplicit: true,
      repsExplicit: true,
      prevWeight: null,
      prevReps: null,
      modifier: set.modifier,
      weightModifier: set.weightModifier,
      restBefore: set.restBefore,
      notes: set.notes ?? undefined,
      clientId: `history-${entry.relation}-${entry.date}-${index}`,
    })),
    previousSets: [],
  };
}

function formatPreviousSetGroup(
  exercise: WorkoutExercise,
  group: IndexedWorkoutSet[],
) {
  const firstLoad = group[0]
    ? formatLedgerLoadLabel(exercise, group[0])
    : "";

  return group
    .map((indexedSet, index) => {
      const load = formatLedgerLoadLabel(exercise, indexedSet);
      const reps =
        indexedSet.set.reps == null
          ? "-"
          : formatNumber(Number(indexedSet.set.reps));

      if (index > 0 && load === firstLoad) return reps;
      return `${load || "-lb"} x ${reps}`;
    })
    .join(" + ");
}

function formatLedgerLoadLabel(
  exercise: WorkoutExercise,
  indexedSet: IndexedWorkoutSet,
) {
  const values = getSetDisplayValues(
    exercise,
    indexedSet.set,
    indexedSet.index,
  );

  if (values.weightModifier === "bodyweight") {
    const offset = values.weight ?? 0;
    if (offset > 0) return `BW+${formatNumber(offset)}lb`;
    if (offset < 0) return `BW-${formatNumber(Math.abs(offset))}lb`;
    return "BW";
  }

  if (values.weight == null) return "-lb";
  return `${formatNumber(values.weight)}lb`;
}

function formatLedgerRepsLabel(
  exercise: WorkoutExercise,
  indexedSet: IndexedWorkoutSet,
) {
  const values = getSetDisplayValues(
    exercise,
    indexedSet.set,
    indexedSet.index,
  );
  return values.reps == null ? "-" : formatNumber(Number(values.reps));
}

function formatLedgerSegmentRepsLabel(
  exercise: WorkoutExercise,
  indexedSet: IndexedWorkoutSet,
  previousIndexedSet?: IndexedWorkoutSet,
) {
  if (!previousIndexedSet) return formatLedgerRepsLabel(exercise, indexedSet);
  const token = getSetLineToken(exercise, indexedSet, previousIndexedSet);
  if (token.kind === "reps-only") return token.repsLabel;
  return `${token.weightLabel}x${token.repsLabel}`;
}

function getLedgerSetIndexLabel(
  exercise: WorkoutExercise,
  indexedSet: IndexedWorkoutSet,
) {
  if (indexedSet.set.modifier === "warmup") return "WU";
  if (indexedSet.set.restBefore === "short") return "+";
  const workingSetCount = exercise.sets
    .slice(0, indexedSet.index + 1)
    .filter(
      (set) => set.modifier !== "warmup" && set.restBefore !== "short",
    ).length;
  return String(Math.max(1, workingSetCount));
}

function SetGroup({
  title,
  exercise,
  sets,
  selectedSetId,
  selectedField = null,
  readonly = false,
  onOpenSet,
  onToggleComplete,
  onToggleRest,
}: {
  title?: string;
  exercise: WorkoutExercise;
  sets: IndexedWorkoutSet[];
  selectedSetId: string | null;
  selectedField?: SetEditField | null;
  readonly?: boolean;
  onOpenSet?: (setId: string, field?: SetEditField) => void;
  onToggleComplete?: (setIndex: number) => void;
  onToggleRest?: (setIndex: number) => void;
}) {
  const noteEntries = sets
    .filter(({ set }) => Boolean(set.notes?.trim()))
    .map(({ set, index }, noteIndex) => ({
      letter: String.fromCharCode(97 + noteIndex),
      note: set.notes!.trim(),
      setId: getSetTargetId(set, index),
    }));
  const noteBySetId = new Map(
    noteEntries.map((entry) => [entry.setId, entry.letter]),
  );

  return (
    <View style={styles.setGroup}>
      {title ? <Text style={styles.subtleTitle}>{title}</Text> : null}
      <View style={styles.setLine}>
        {sets.length === 0 ? <Text style={styles.metaText}>none</Text> : null}
        {sets.map((indexedSet, index) => {
          const setId = getSetTargetId(indexedSet.set, indexedSet.index);
          const token = getSetLineToken(exercise, indexedSet, sets[index - 1]);
          const fullLabel = formatSetInline(exercise, indexedSet) || "set";
          const setAccessibilityName = setLabel(exercise, indexedSet.index);
          const noteLetter = noteBySetId.get(setId);
          const separatorText =
            indexedSet.set.restBefore === "short" ? "+" : ",";
          return (
            <React.Fragment key={`${setId}-${indexedSet.index}`}>
              {index > 0 ? (
                readonly || !onToggleRest ? (
                  <View style={styles.separatorChip}>
                    <Text style={styles.separatorText}>{separatorText}</Text>
                  </View>
                ) : (
                  <Pressable
                    accessibilityLabel={`Toggle rest before ${setAccessibilityName}`}
                    accessibilityRole="button"
                    hitSlop={10}
                    style={styles.separatorChip}
                    onPress={() => onToggleRest(indexedSet.index)}
                  >
                    <Text style={styles.separatorText}>{separatorText}</Text>
                  </Pressable>
                )
              ) : null}
              {indexedSet.set.modifier === "warmup" ? (
                <Text style={styles.warmupInlinePrefix}>w</Text>
              ) : null}
              {token.kind === "reps-only" ? (
                <SetValueChip
                  accessibilityLabel={`Edit ${setAccessibilityName} reps ${fullLabel}`}
                  active={selectedSetId === setId && selectedField === "reps"}
                  disabled={readonly || !onOpenSet}
                  label={token.repsLabel}
                  noteLetter={noteLetter}
                  completed={
                    Boolean(onToggleComplete) && indexedSet.set.completed
                  }
                  onPress={() => onOpenSet?.(setId, "reps")}
                  onLongPress={() => onToggleComplete?.(indexedSet.index)}
                />
              ) : (
                <>
                  <SetValueChip
                    accessibilityLabel={`Edit ${setAccessibilityName} weight ${fullLabel}`}
                    active={
                      selectedSetId === setId && selectedField === "weight"
                    }
                    disabled={readonly || !onOpenSet}
                    label={token.weightLabel}
                    onPress={() => onOpenSet?.(setId, "weight")}
                  />
                  <Text style={styles.inlineSetText}>x</Text>
                  <SetValueChip
                    accessibilityLabel={`Edit ${setAccessibilityName} reps ${fullLabel}`}
                    active={selectedSetId === setId && selectedField === "reps"}
                    disabled={readonly || !onOpenSet}
                    label={token.repsLabel}
                    noteLetter={noteLetter}
                    completed={
                      Boolean(onToggleComplete) && indexedSet.set.completed
                    }
                    onPress={() => onOpenSet?.(setId, "reps")}
                    onLongPress={() => onToggleComplete?.(indexedSet.index)}
                  />
                </>
              )}
            </React.Fragment>
          );
        })}
      </View>
      {noteEntries.length > 0 ? (
        <View style={styles.noteList}>
          {noteEntries.map((entry) => (
            <View
              key={`${entry.setId}-${entry.letter}-${entry.note}`}
              style={styles.noteRow}
            >
              <Text style={styles.noteLetter}>{entry.letter}</Text>
              <Text style={styles.noteBadge}>{entry.note}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SetValueChip({
  accessibilityLabel,
  active,
  disabled,
  label,
  noteLetter,
  completed = false,
  onPress,
  onLongPress,
}: {
  accessibilityLabel: string;
  active: boolean;
  disabled: boolean;
  label: string;
  noteLetter?: string;
  completed?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const longPressedRef = useRef(false);
  const chipStyle = [
    styles.inlineSetChip,
    completed ? styles.inlineSetChipCompleted : null,
    active ? styles.inlineSetChipActive : null,
  ];
  const content = (
    <Text style={styles.inlineSetText}>
      {label}
      {noteLetter ? <Text style={styles.supText}>{noteLetter}</Text> : null}
    </Text>
  );

  if (disabled) {
    return <View style={chipStyle}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={10}
      onPress={() => {
        if (longPressedRef.current) {
          longPressedRef.current = false;
          return;
        }
        onPress();
      }}
      onLongPress={() => {
        if (!onLongPress) return;
        longPressedRef.current = true;
        triggerSelectionHaptic();
        onLongPress();
      }}
      style={chipStyle}
    >
      {content}
    </Pressable>
  );
}

function getSetLineToken(
  exercise: WorkoutExercise,
  indexedSet: IndexedWorkoutSet,
  previousIndexedSet?: IndexedWorkoutSet,
):
  | { kind: "full"; weightLabel: string; repsLabel: string }
  | {
      kind: "reps-only";
      repsLabel: string;
    } {
  const current = getSetDisplayValues(
    exercise,
    indexedSet.set,
    indexedSet.index,
  );
  const repsLabel =
    current.reps == null ? "-" : formatNumber(Number(current.reps));
  const currentWeightLabel = formatSetLineWeightLabel(
    current.weight,
    current.weightModifier,
    indexedSet.set,
  );
  if (!previousIndexedSet) {
    return { kind: "full", weightLabel: currentWeightLabel, repsLabel };
  }

  const previous = getSetDisplayValues(
    exercise,
    previousIndexedSet.set,
    previousIndexedSet.index,
  );
  const sameWeight =
    current.weight === previous.weight &&
    current.weightModifier === previous.weightModifier;

  if (sameWeight && repsLabel && !isExplicitNullWeight(indexedSet.set)) {
    return { kind: "reps-only", repsLabel };
  }
  return { kind: "full", weightLabel: currentWeightLabel, repsLabel };
}

function formatSetLineWeightLabel(
  weight: number | null,
  weightModifier: "bodyweight" | undefined,
  set: WorkoutSet,
) {
  const label = formatWeightLabel(weight, weightModifier);
  if (label) return label;
  return isExplicitNullWeight(set) ? "-lb" : "-lb";
}

function isExplicitNullWeight(set: WorkoutSet) {
  return set.weight === null && set.weightExplicit;
}

function getLogicalSetGroup(
  exercise: WorkoutExercise,
  setIndex: number,
): IndexedWorkoutSet[] {
  const selectedSet = exercise.sets[setIndex];
  if (!selectedSet) return [];
  const selectedModifier = selectedSet.modifier;

  let startIndex = setIndex;
  while (
    startIndex > 0 &&
    exercise.sets[startIndex]?.restBefore === "short" &&
    exercise.sets[startIndex - 1]?.modifier === selectedModifier
  ) {
    startIndex -= 1;
  }

  let endIndex = setIndex;
  while (
    endIndex < exercise.sets.length - 1 &&
    exercise.sets[endIndex + 1]?.restBefore === "short" &&
    exercise.sets[endIndex + 1]?.modifier === selectedModifier
  ) {
    endIndex += 1;
  }

  return exercise.sets
    .slice(startIndex, endIndex + 1)
    .map((set, offset) => ({ set, index: startIndex + offset }));
}

function LogicalSetComposer({
  exercise,
  field,
  group,
  selectedSetId,
  selectedSetIndex,
  selectedWeightLabel,
  onOpenSet,
  onToggleRest,
}: {
  exercise: WorkoutExercise;
  field: "weight" | "reps";
  group: IndexedWorkoutSet[];
  selectedSetId: string;
  selectedSetIndex: number;
  selectedWeightLabel: string;
  onOpenSet: (setId: string, field: SetEditField) => void;
  onToggleRest: (setIndex: number) => void;
}) {
  return (
    <View style={styles.logicalSetComposer}>
      {group.map((indexedSet, segmentIndex) => {
        const setId = getSetTargetId(indexedSet.set, indexedSet.index);
        const values = getSetDisplayValues(
          exercise,
          indexedSet.set,
          indexedSet.index,
        );
        const weightLabel =
          selectedSetIndex === indexedSet.index && field === "weight"
            ? selectedWeightLabel
            : formatKeyboardWeightLabel(values.weight, values.weightModifier);
        const repsLabel =
          values.reps == null ? "-" : formatNumber(Number(values.reps));
        const setAccessibilityName = setLabel(exercise, indexedSet.index);

        return (
          <View
            key={`${setId}-${indexedSet.index}`}
            style={styles.logicalSetSegmentBlock}
          >
            {segmentIndex > 0 ? (
              <Pressable
                accessibilityLabel={`Toggle rest before ${setAccessibilityName}`}
                accessibilityRole="button"
                hitSlop={8}
                style={styles.logicalSetRestLabel}
                onPress={() => onToggleRest(indexedSet.index)}
              >
                <Text style={styles.logicalSetRestLabelText}>short rest</Text>
              </Pressable>
            ) : null}
            <View style={styles.logicalSetSegment}>
              <Pressable
                accessibilityLabel={`Edit ${setAccessibilityName} weight`}
                accessibilityRole="button"
                hitSlop={8}
                style={[
                  styles.logicalSetChip,
                  selectedSetId === setId && field === "weight"
                    ? styles.inlineSetChipActive
                    : null,
                ]}
                onPress={() => onOpenSet(setId, "weight")}
              >
                <Text style={styles.logicalSetText}>{weightLabel}</Text>
              </Pressable>
              <Text style={styles.logicalSetText}>x</Text>
              <Pressable
                accessibilityLabel={`Edit ${setAccessibilityName} reps`}
                accessibilityRole="button"
                hitSlop={8}
                style={[
                  styles.logicalSetChip,
                  selectedSetId === setId && field === "reps"
                    ? styles.inlineSetChipActive
                    : null,
                ]}
                onPress={() => onOpenSet(setId, "reps")}
              >
                <Text style={styles.logicalSetText}>{repsLabel}</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function SetEditorModal({
  workout,
  target,
  onClose,
  onRetarget,
  onStartRestTimer,
  onDispatch,
}: {
  workout: Workout;
  target: SetEditTarget | null;
  onClose: () => void;
  onRetarget: (target: SetEditTarget | null) => void;
  onStartRestTimer: () => void;
  onDispatch: (action: Action, options?: WorkoutDispatchOptions) => void;
}) {
  const insets = useSafeAreaInsets();
  const presentDialog = useAppDialog();
  const nativeKeyboard = useNativeKeyboardFrame();
  const [field, setField] = useState<"weight" | "reps">("weight");
  const [entry, setEntryState] = useState("");
  const entryRef = useRef("");
  const firstPressRef = useRef(true);
  const [helperMode, setHelperMode] = useState<"increase" | "plates" | null>(
    null,
  );
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteValue, setNoteValue] = useState("");
  const exercise = target ? workout.exercises[target.exerciseIndex] : undefined;
  const setIndex =
    exercise && target ? findSetIndex(exercise, target.setId) : null;
  const set = setIndex == null ? undefined : exercise?.sets[setIndex];
  const exerciseRef = useRef<WorkoutExercise | undefined>(undefined);
  const setIndexRef = useRef<number | null>(null);
  const targetRef = useRef<SetEditTarget | null>(null);
  const setEntryValue = (nextEntry: string) => {
    entryRef.current = nextEntry;
    setEntryState(nextEntry);
  };
  const setFirstPressValue = (nextFirstPress: boolean) => {
    firstPressRef.current = nextFirstPress;
  };
  exerciseRef.current = exercise;
  setIndexRef.current = setIndex;
  targetRef.current = target;

  useEffect(() => {
    if (!target?.field) return;
    setField(target.field);
  }, [target?.exerciseIndex, target?.setId, target?.field]);

  useEffect(() => {
    if (!exercise || setIndex == null || !set) return;
    const values = getSetDisplayValues(exercise, set, setIndex);
    setEntryValue(
      field === "weight"
        ? values.weight == null
          ? ""
          : String(values.weight)
        : values.reps == null
          ? ""
          : String(values.reps),
    );
    setFirstPressValue(true);
  }, [field, target?.exerciseIndex, target?.setId]);

  useEffect(() => {
    setHelperMode(null);
    setNoteEditing(false);
  }, [target?.exerciseIndex, target?.setId]);

  if (!target || !exercise || setIndex == null || !set) return null;

  const commitValue = (nextEntry: string, nextField = field) => {
    const parsed =
      nextEntry.trim() === "" ? null : parseKeypadEntry(nextEntry, nextField);
    if (parsed === "pending") return;
    const currentExercise = exerciseRef.current;
    const currentSetIndex = setIndexRef.current;
    const currentTarget = targetRef.current;
    if (!currentExercise || currentSetIndex == null || !currentTarget) return;

    onDispatch(
      {
        type: "REPLACE_EXERCISE_SETS",
        exerciseIndex: currentTarget.exerciseIndex,
        sets: materializeEditedExerciseSets(currentExercise, currentSetIndex, {
          [nextField]: parsed,
        }),
      },
      { deferHistory: true },
    );
  };

  const selectField = (nextField: "weight" | "reps") => {
    setField(nextField);
    setFirstPressValue(true);
  };

  const advanceSetEditor = () => {
    if (field === "weight") {
      selectField("reps");
      onRetarget({
        exerciseIndex: target.exerciseIndex,
        setId: target.setId,
        field: "reps",
      });
      return;
    }

    const nextSetIndex = setIndex + 1;
    const nextSet = exercise.sets[nextSetIndex];
    if (!nextSet) {
      selectField("weight");
      return;
    }

    selectField("weight");
    onRetarget({
      exerciseIndex: target.exerciseIndex,
      setId: getSetTargetId(nextSet, nextSetIndex),
      field: "weight",
    });
  };

  const completeAndAdvanceSetEditor = () => {
    commitValue(entryRef.current, "reps");
    if (!set.completed) {
      triggerSelectionHaptic();
      onDispatch({
        type: "TOGGLE_SET_COMPLETED",
        exerciseIndex: target.exerciseIndex,
        setIndex,
      });
      onStartRestTimer();
    }

    const nextSetIndex = setIndex + 1;
    const nextSet = exercise.sets[nextSetIndex];
    if (!nextSet) {
      onClose();
      return;
    }

    selectField("weight");
    onRetarget({
      exerciseIndex: target.exerciseIndex,
      setId: getSetTargetId(nextSet, nextSetIndex),
      field: "weight",
    });
  };

  const handleKey = (key: string) => {
    const currentEntry = firstPressRef.current ? "" : entryRef.current;
    const next =
      key === "."
        ? field === "weight" && !currentEntry.includes(".")
          ? currentEntry === "" || currentEntry === "-"
            ? `${currentEntry}0.`
            : `${currentEntry}.`
          : currentEntry
        : currentEntry === "0"
          ? key
          : currentEntry === "-0"
            ? `-${key}`
            : `${currentEntry}${key}`;
    setEntryValue(next);
    setFirstPressValue(false);
    commitValue(next);
  };

  const backspace = () => {
    const next = firstPressRef.current ? "" : entryRef.current.slice(0, -1);
    setEntryValue(next);
    setFirstPressValue(false);
    commitValue(next);
  };

  const stepValue = (sign: 1 | -1) => {
    const current = Number(entryRef.current) || 0;
    const next =
      field === "weight"
        ? formatNumber(Math.max(0, current + sign * 5))
        : String(Math.max(0, current + sign));
    setEntryValue(next);
    setFirstPressValue(false);
    commitValue(next);
  };

  const toggleSign = () => {
    if (set?.weightModifier !== "bodyweight") return;
    const current = Number(entryRef.current) || 0;
    const next = String(current * -1);
    setEntryValue(next);
    setFirstPressValue(false);
    commitValue(next);
  };

  const addShortRestSet = () => {
    const logicalSetGroup = getLogicalSetGroup(exercise, setIndex);
    const insertAfterIndex =
      logicalSetGroup[logicalSetGroup.length - 1]?.index ?? setIndex;
    const baseSet = exercise.sets[insertAfterIndex] ?? set;
    const nextSet: WorkoutSet = {
      clientId: makeClientId(),
      weight: baseSet.weight,
      reps: null,
      completed: false,
      weightExplicit: baseSet.weight !== null,
      repsExplicit: false,
      prevWeight: null,
      prevReps: null,
      modifier: baseSet.modifier,
      weightModifier: baseSet.weightModifier,
      restBefore: "short",
    };
    const nextSets = [...exercise.sets];
    nextSets.splice(insertAfterIndex + 1, 0, nextSet);
    onDispatch({
      type: "REPLACE_EXERCISE_SETS",
      exerciseIndex: target.exerciseIndex,
      sets: nextSets,
    });
    onRetarget({
      exerciseIndex: target.exerciseIndex,
      setId: getSetTargetId(nextSet, insertAfterIndex + 1),
      field: "reps",
    });
    setField("reps");
  };

  const addSet = () => {
    const baseSet =
      [...exercise.sets]
        .reverse()
        .find((candidate) => candidate.modifier !== "warmup") ??
      exercise.sets[exercise.sets.length - 1] ??
      set;
    const nextSetIndex = exercise.sets.length;
    const nextSet: WorkoutSet = {
      clientId: makeClientId(),
      weight: baseSet.weight,
      reps: baseSet.reps,
      completed: false,
      weightExplicit: baseSet.weight !== null,
      repsExplicit: baseSet.reps !== null,
      prevWeight: baseSet.weight,
      prevReps: baseSet.reps,
      weightModifier: baseSet.weightModifier,
    };

    onDispatch({
      type: "REPLACE_EXERCISE_SETS",
      exerciseIndex: target.exerciseIndex,
      sets: [...exercise.sets, nextSet],
    });
    onRetarget({
      exerciseIndex: target.exerciseIndex,
      setId: getSetTargetId(nextSet, nextSetIndex),
      field: "reps",
    });
    setField("reps");
  };

  const deleteSet = () => {
    presentDialog({
      title: "Delete set?",
      message: formatSetInline(exercise, { set, index: setIndex }),
      actions: [
        { label: "cancel", variant: "cancel" },
        {
          label: "delete",
          variant: "danger",
          onPress: () => {
            const remainingSets = exercise.sets.filter(
              (_candidate, candidateIndex) => candidateIndex !== setIndex,
            );
            const nextSet =
              remainingSets[Math.min(setIndex, remainingSets.length - 1)];
            const nextSetIndex = Math.min(setIndex, remainingSets.length - 1);
            onDispatch({
              type: "DELETE_SET",
              exerciseIndex: target.exerciseIndex,
              setIndex,
            });
            if (nextSet) {
              onRetarget({
                exerciseIndex: target.exerciseIndex,
                setId: getSetTargetId(nextSet, nextSetIndex),
                field,
              });
            } else {
              onClose();
            }
          },
        },
      ],
    });
  };

  const openSetNote = () => {
    setHelperMode(null);
    setNoteValue(set.notes ?? "");
    setNoteEditing(true);
  };

  const saveSetNote = (notes: string) => {
    onDispatch({
      type: "UPDATE_SET_NOTE",
      exerciseIndex: target.exerciseIndex,
      setIndex,
      notes,
    });
    setNoteEditing(false);
  };

  const deleteSetNote = () => {
    if (!set.notes?.trim()) {
      saveSetNote("");
      return;
    }

    presentDialog({
      title: "Delete note?",
      message: `${setLabel(exercise, setIndex)} note`,
      actions: [
        { label: "cancel", variant: "cancel" },
        {
          label: "delete",
          variant: "danger",
          onPress: () => saveSetNote(""),
        },
      ],
    });
  };

  const values = getSetDisplayValues(exercise, set, setIndex);
  const helperWeight =
    values.weight != null && Number.isFinite(values.weight) && values.weight > 0
      ? values.weight
      : 135;
  const helperReps =
    values.reps != null && Number.isFinite(values.reps) && values.reps > 0
      ? values.reps
      : 8;

  const useWeightSuggestion = (suggestion: WeightSuggestion) => {
    onDispatch({
      type: "REPLACE_EXERCISE_SETS",
      exerciseIndex: target.exerciseIndex,
      sets: materializeEditedExerciseSets(exercise, setIndex, {
        weight: suggestion.weight,
        reps: suggestion.reps,
        weightModifier: undefined,
      }),
    });
    setEntryValue(
      field === "weight"
        ? formatNumber(suggestion.weight)
        : String(suggestion.reps),
    );
    setFirstPressValue(true);
    setHelperMode(null);
  };

  const updatePlateSettings = (settings: {
    startingWeight: number | null;
    loadMode: PlateLoadMode;
  }) => {
    onDispatch({
      type: "UPDATE_USER_EXERCISE_PLATE_DEFAULTS",
      exerciseIndex: target.exerciseIndex,
      plateStartingWeight: settings.startingWeight,
      plateLoadMode: settings.loadMode,
    });
  };

  return (
    <View pointerEvents="box-none" style={styles.keyboardPassthroughOverlay}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
        style={styles.keyboardAvoidingModalContent}
      >
        <View style={styles.keyboardDock}>
          <View
            style={[
              styles.keyboardSheet,
              {
                paddingBottom:
                  noteEditing && nativeKeyboard.visible
                    ? 6
                    : Math.max(6, insets.bottom + 6),
              },
            ]}
          >
            {noteEditing ? (
              <>
                <Text style={styles.subtleTitle}>
                  {setLabel(exercise, setIndex)} note
                </Text>
                <TextInput
                  accessibilityLabel={`${setLabel(exercise, setIndex)} note`}
                  autoFocus
                  blurOnSubmit={false}
                  multiline
                  style={styles.noteInput}
                  testID="set-note-input"
                  value={noteValue}
                  onChangeText={setNoteValue}
                />
                <View style={styles.noteActions}>
                  <Pressable
                    accessibilityLabel={`Delete ${setLabel(exercise, setIndex)} note`}
                    accessibilityRole="button"
                    style={styles.iconButton}
                    testID="set-note-delete"
                    onPress={deleteSetNote}
                  >
                    <Icon name="trash-outline" size={24} />
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Save ${setLabel(exercise, setIndex)} note`}
                    accessibilityRole="button"
                    style={[styles.textButton, styles.sheetActionFill]}
                    testID="set-note-done"
                    onPress={() => saveSetNote(noteValue)}
                  >
                    <Text style={styles.textButtonText}>done</Text>
                  </Pressable>
                </View>
                {nativeKeyboard.visible ? (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.nativeKeyboardBackgroundFill,
                      {
                        bottom: -nativeKeyboard.height,
                        height: nativeKeyboard.height,
                      },
                    ]}
                  />
                ) : null}
              </>
            ) : (
              <>
                <View style={styles.keypad}>
                  <View style={styles.keypadRow}>
                    <KeypadButton onPress={() => handleKey("1")}>
                      1
                    </KeypadButton>
                    <KeypadButton onPress={() => handleKey("2")}>
                      2
                    </KeypadButton>
                    <KeypadButton onPress={() => handleKey("3")}>
                      3
                    </KeypadButton>
                    {field === "weight" ? (
                      <View style={styles.keypadSplitCell}>
                        <KeypadButton
                          accessibilityLabel="Open increase weight helper"
                          icon="trending-up-outline"
                          onPress={() => setHelperMode("increase")}
                        />
                        <KeypadButton
                          accessibilityLabel="Open plate calculator"
                          icon="barbell-outline"
                          onPress={() => setHelperMode("plates")}
                        />
                      </View>
                    ) : (
                      <KeypadButton
                        accessibilityLabel="Close set keyboard"
                        onPress={onClose}
                      >
                        <View style={styles.keyIconPair}>
                          <Icon
                            name="keypad-outline"
                            size={21}
                            color={palette.ink}
                          />
                          <Icon
                            name="chevron-down-circle-outline"
                            size={16}
                            color={palette.ink}
                          />
                        </View>
                      </KeypadButton>
                    )}
                  </View>
                  <View style={styles.keypadRow}>
                    <KeypadButton onPress={() => handleKey("4")}>
                      4
                    </KeypadButton>
                    <KeypadButton onPress={() => handleKey("5")}>
                      5
                    </KeypadButton>
                    <KeypadButton onPress={() => handleKey("6")}>
                      6
                    </KeypadButton>
                    <View style={styles.keypadSplitCell}>
                      <KeypadButton onPress={() => stepValue(-1)}>
                        -
                      </KeypadButton>
                      <KeypadButton onPress={() => stepValue(1)}>
                        +
                      </KeypadButton>
                    </View>
                  </View>
                  <View style={styles.keypadRow}>
                    <KeypadButton onPress={() => handleKey("7")}>
                      7
                    </KeypadButton>
                    <KeypadButton onPress={() => handleKey("8")}>
                      8
                    </KeypadButton>
                    <KeypadButton onPress={() => handleKey("9")}>
                      9
                    </KeypadButton>
                    {field === "weight" ? (
                      <View style={styles.keypadSplitCell}>
                        <KeypadButton
                          accessibilityLabel="Toggle body weight"
                          active={set.weightModifier === "bodyweight"}
                          icon="person-outline"
                          onPress={() => {
                            onDispatch({
                              type: "FOCUS_FIELD",
                              exerciseIndex: target.exerciseIndex,
                              setIndex,
                              field: "weight",
                            });
                            onDispatch({ type: "TOGGLE_BODYWEIGHT" });
                            setField("weight");
                          }}
                        />
                        <KeypadButton
                          accessibilityLabel="Toggle body weight sign"
                          disabled={set.weightModifier !== "bodyweight"}
                          onPress={toggleSign}
                        >
                          +/-
                        </KeypadButton>
                      </View>
                    ) : (
                      <KeypadButton
                        accessibilityLabel="Add short-rest reps"
                        onPress={addShortRestSet}
                      >
                        <View style={styles.keyIconPair}>
                          <Icon
                            name="timer-outline"
                            size={20}
                            color={palette.ink}
                          />
                          <Icon
                            name="add-outline"
                            size={15}
                            color={palette.ink}
                          />
                        </View>
                      </KeypadButton>
                    )}
                  </View>
                  <View style={styles.keypadRow}>
                    {field === "weight" ? (
                      <KeypadButton onPress={() => handleKey(".")}>
                        .
                      </KeypadButton>
                    ) : (
                      <View style={styles.keyBlank} />
                    )}
                    <KeypadButton onPress={() => handleKey("0")}>
                      0
                    </KeypadButton>
                    <KeypadButton
                      icon="backspace-outline"
                      onPress={backspace}
                    />
                    <KeypadButton
                      primary
                      accessibilityLabel={
                        field === "reps" ? "Complete set" : "Next field"
                      }
                      onPress={
                        field === "reps"
                          ? completeAndAdvanceSetEditor
                          : advanceSetEditor
                      }
                    >
                      {field === "reps" ? (
                        <Icon name="checkmark" size={22} color={palette.raised} />
                      ) : (
                        "Next"
                      )}
                    </KeypadButton>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        <IncreaseWeightHelperModal
          visible={helperMode === "increase"}
          defaultWeight={helperWeight}
          defaultReps={helperReps}
          defaultLoadMode={exercise.plateLoadMode}
          onClose={() => setHelperMode(null)}
          onUse={useWeightSuggestion}
        />
        <PlateCalculatorHelperModal
          visible={helperMode === "plates"}
          defaultWeight={helperWeight}
          defaultStartingWeight={exercise.plateStartingWeight}
          defaultLoadMode={exercise.plateLoadMode}
          onClose={() => setHelperMode(null)}
          onSettingsChange={updatePlateSettings}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

function parseKeypadEntry(
  entry: string,
  field: "weight" | "reps",
): number | null | "pending" {
  const trimmed = entry.trim();
  if (trimmed === "" || trimmed === "-") return null;
  if (trimmed === "." || trimmed === "-.") return "pending";
  if (field === "weight" && /^-?\d+\.$/.test(trimmed)) return "pending";

  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue)) return "pending";
  if (field === "reps") return Math.max(0, Math.trunc(numericValue));
  return numericValue;
}

function parsePositiveDecimalInput(entry: string): number | "pending" | null {
  const trimmed = entry.trim();
  if (trimmed === "") return null;
  if (trimmed === "." || /^\d+\.$/.test(trimmed)) return "pending";

  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return "pending";
  return numericValue;
}

function formatKeyboardWeightLabel(
  weight: number | null,
  weightModifier?: "bodyweight",
) {
  if (weight == null) return weightModifier === "bodyweight" ? "BW" : "-lb";
  return formatWeightLabel(weight, weightModifier);
}

function formatKeyboardWeightEntryLabel(
  entry: string,
  weightModifier?: "bodyweight",
) {
  const trimmed = entry.trim();
  if (!trimmed) return weightModifier === "bodyweight" ? "BW" : "-lb";
  if (weightModifier !== "bodyweight") return `${trimmed}lb`;

  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue) || numericValue === 0) return "BW";
  return `BW${numericValue > 0 ? "+" : ""}${trimmed}lb`;
}

function materializeEditedExerciseSets(
  exercise: WorkoutExercise,
  editedSetIndex: number,
  updates: {
    weight?: number | null;
    reps?: number | null;
    weightModifier?: WorkoutSet["weightModifier"];
  },
) {
  return exercise.sets.map((set, setIndex) => {
    const displayed = getSetDisplayValues(exercise, set, setIndex);
    const isEditedSet = setIndex === editedSetIndex;
    const hasWeightUpdate = isEditedSet && "weight" in updates;
    const hasRepsUpdate = isEditedSet && "reps" in updates;
    const nextWeight = hasWeightUpdate ? updates.weight! : displayed.weight;
    const nextReps = hasRepsUpdate ? updates.reps! : displayed.reps;
    const nextWeightModifier =
      isEditedSet && "weightModifier" in updates
        ? updates.weightModifier
        : displayed.weightModifier;

    return {
      ...set,
      weight: nextWeight,
      reps: nextReps,
      weightModifier: nextWeightModifier,
      weightExplicit:
        set.weightExplicit || nextWeight !== null || hasWeightUpdate,
      repsExplicit: set.repsExplicit || nextReps !== null || hasRepsUpdate,
      completed: set.completed,
    };
  });
}

function KeypadButton({
  children,
  icon,
  accessibilityLabel,
  active,
  primary,
  disabled,
  onPress,
}: {
  children?: React.ReactNode;
  icon?: IconName;
  accessibilityLabel?: string;
  active?: boolean;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={
        accessibilityLabel ??
        (typeof children === "string" ? children : (icon ?? "keypad button"))
      }
      accessibilityRole="button"
      disabled={disabled}
      style={[
        styles.key,
        active ? styles.keyActive : null,
        primary ? styles.keyDark : null,
        disabled ? styles.keyDisabled : null,
      ]}
      onPress={onPress}
    >
      {icon ? (
        <Icon
          name={icon}
          size={24}
          color={primary ? palette.raised : palette.ink}
        />
      ) : typeof children === "string" ? (
        <Text style={primary ? styles.keyDarkText : styles.keyText}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

function IncreaseWeightHelperModal({
  visible,
  defaultWeight,
  defaultReps,
  defaultLoadMode,
  onClose,
  onUse,
}: {
  visible: boolean;
  defaultWeight: number;
  defaultReps: number;
  defaultLoadMode?: PlateLoadMode | null;
  onClose: () => void;
  onUse: (suggestion: WeightSuggestion) => void;
}) {
  const [mode, setMode] = useState<PlateLoadMode>(
    parsePlateMode(defaultLoadMode),
  );
  const [addedWeight, setAddedWeight] = useState(5);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setMode(parsePlateMode(defaultLoadMode));
    setAddedWeight(5);
    setSelectedKey(null);
  }, [defaultLoadMode, visible]);

  const oneRepMax = estimate1RM(defaultWeight, defaultReps);
  const rows = buildAddedWeightRepRows(
    defaultWeight,
    oneRepMax,
    addedWeight,
    mode,
  );
  const targetWeight =
    defaultWeight + (mode === "equal-sides" ? addedWeight * 2 : addedWeight);

  const adjustAddedWeight = (direction: 1 | -1) => {
    setSelectedKey(null);
    setAddedWeight((current) =>
      Math.max(2.5, roundToHalf(current + direction * 2.5)),
    );
  };

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <DismissibleModalShade onDismiss={onClose} style={styles.helperShade}>
        <View style={styles.helperDialog}>
          <View style={styles.helperHeader}>
            <Text style={styles.helperTitle}>increase weight</Text>
            <Pressable
              accessibilityLabel="Close increase weight helper"
              accessibilityRole="button"
              style={styles.helperDoneButton}
              testID="increase-weight-helper-close"
              onPress={onClose}
            >
              <Text style={styles.helperDoneText}>done</Text>
            </Pressable>
          </View>

          <View style={styles.helperSection}>
            <Text style={styles.subtleTitle}>current</Text>
            <Text style={styles.helperLargeText}>
              {formatSetSummary(defaultWeight, defaultReps)} .{" "}
              {formatOneRepMax(oneRepMax)}
            </Text>
          </View>

          <View style={styles.helperSection}>
            <Text style={styles.subtleTitle}>add weight</Text>
            <View style={styles.segmentedRow}>
              <SegmentedChoice
                active={mode === "equal-sides"}
                accessibilityLabel="Use equal sides for increase weight"
                testID="increase-weight-mode-equal-sides"
                onPress={() => setMode("equal-sides")}
              >
                equal sides
              </SegmentedChoice>
              <SegmentedChoice
                active={mode === "total"}
                accessibilityLabel="Use total load for increase weight"
                testID="increase-weight-mode-total"
                onPress={() => setMode("total")}
              >
                total load
              </SegmentedChoice>
            </View>
            <View style={styles.addWeightRow}>
              <Text style={styles.addWeightValue}>
                +{formatNumber(addedWeight)}lb
              </Text>
              <View style={styles.addWeightButtons}>
                <Pressable
                  accessible
                  accessibilityLabel="Increase added weight"
                  accessibilityRole="button"
                  style={styles.addWeightStepButton}
                  testID="increase-weight-added-weight-increase"
                  onPress={() => adjustAddedWeight(1)}
                >
                  <Text style={styles.addWeightStepText}>+</Text>
                </Pressable>
                <Pressable
                  accessible
                  accessibilityLabel="Decrease added weight"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: addedWeight <= 2.5 }}
                  style={[
                    styles.addWeightStepButton,
                    addedWeight <= 2.5 ? styles.keyDisabled : null,
                  ]}
                  testID="increase-weight-added-weight-decrease"
                  onPress={() => {
                    if (addedWeight > 2.5) {
                      adjustAddedWeight(-1);
                    }
                  }}
                >
                  <Text style={styles.addWeightStepText}>-</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.helperMutedLine}>
              {mode === "equal-sides"
                ? `per side . ${formatSignedCompactPounds(
                    targetWeight - defaultWeight,
                  )} . ${formatNumber(targetWeight)}lb total`
                : `${formatNumber(targetWeight)}lb total`}
            </Text>
          </View>

          <View style={styles.helperSection}>
            {rows.map((row) => (
              <View key={row.key} style={styles.suggestionBlock}>
                <Text style={styles.subtleTitle}>{row.label}</Text>
                <View
                  style={[
                    styles.suggestionRow,
                    selectedKey === row.key ? styles.suggestionRowActive : null,
                  ]}
                >
                  <Text style={styles.suggestionText}>
                    {formatSetSummary(row.targetWeight, row.targetReps)} .{" "}
                    {formatOneRepMax(row.targetOneRepMax)} .{" "}
                    {formatPercentChangeNarrative(row.percentChange)}
                  </Text>
                  <Pressable
                    accessibilityLabel={`Use ${row.label} increase weight suggestion`}
                    accessibilityRole="button"
                    style={styles.useButton}
                    testID={`increase-weight-use-${row.label}`}
                    onPress={() => {
                      setSelectedKey(row.key);
                      onUse({
                        weight: row.targetWeight,
                        reps: row.targetReps,
                      });
                    }}
                  >
                    <Icon name="checkmark-outline" size={18} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            accessibilityLabel="Close increase weight helper"
            accessibilityRole="button"
            style={styles.helperDoneFooter}
            testID="increase-weight-helper-done"
            onPress={onClose}
          >
            <Text style={styles.helperDoneFooterText}>done</Text>
          </Pressable>
        </View>
      </DismissibleModalShade>
    </AppModal>
  );
}

function PlateCalculatorHelperModal({
  visible,
  defaultWeight,
  defaultStartingWeight,
  defaultLoadMode,
  onClose,
  onSettingsChange,
}: {
  visible: boolean;
  defaultWeight: number;
  defaultStartingWeight?: number | null;
  defaultLoadMode?: PlateLoadMode | null;
  onClose: () => void;
  onSettingsChange: (settings: {
    startingWeight: number | null;
    loadMode: PlateLoadMode;
  }) => void;
}) {
  const [startingWeight, setStartingWeight] = useState(
    defaultStartingWeight ?? 45,
  );
  const [mode, setMode] = useState<PlateLoadMode>(
    parsePlateMode(defaultLoadMode),
  );
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setStartingWeight(defaultStartingWeight ?? 45);
    setMode(parsePlateMode(defaultLoadMode));
    setMenuOpen(false);
  }, [defaultLoadMode, defaultStartingWeight, visible]);

  const platePlan = calculatePlatePlan(defaultWeight, startingWeight, mode);

  const updateStartingWeight = (nextStartingWeight: number) => {
    setStartingWeight(nextStartingWeight);
    setMenuOpen(false);
    onSettingsChange({
      startingWeight: nextStartingWeight,
      loadMode: mode,
    });
  };

  const updateMode = (nextMode: PlateLoadMode) => {
    setMode(nextMode);
    onSettingsChange({
      startingWeight,
      loadMode: nextMode,
    });
  };

  return (
    <AppModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <DismissibleModalShade onDismiss={onClose} style={styles.helperShade}>
        <View style={styles.helperDialog}>
          <View style={styles.helperHeader}>
            <Text style={styles.helperTitle}>plates</Text>
            <Pressable
              accessibilityLabel="Close plate calculator"
              accessibilityRole="button"
              style={styles.helperDoneButton}
              testID="plate-calculator-close"
              onPress={onClose}
            >
              <Text style={styles.helperDoneText}>done</Text>
            </Pressable>
          </View>

          <View style={styles.plateTopRow}>
            <View>
              <Text style={styles.subtleTitle}>total weight</Text>
              <Text style={styles.helperLargeText}>
                {formatNumber(defaultWeight)}
                <Text style={styles.helperUnit}>lb</Text>
              </Text>
            </View>
            <View>
              <Text style={styles.subtleTitle}>starting weight</Text>
              <Pressable
                accessibilityLabel="Choose plate starting weight"
                accessibilityRole="button"
                style={styles.helperSelect}
                testID="plate-starting-weight-select"
                onPress={() => setMenuOpen((open) => !open)}
              >
                <Text style={styles.helperSelectText}>
                  {getStartingWeightLabel(startingWeight)}
                </Text>
                <Icon name="chevron-down-outline" size={18} />
              </Pressable>
            </View>
          </View>

          {menuOpen ? (
            <View style={styles.helperMenu}>
              {STARTING_WEIGHTS.map((choice) => (
                <Pressable
                  key={choice.weight}
                  accessibilityLabel={`Use ${choice.label} starting weight`}
                  accessibilityRole="button"
                  style={styles.helperMenuItem}
                  testID={`plate-starting-weight-${choice.weight}`}
                  onPress={() => updateStartingWeight(choice.weight)}
                >
                  <Text style={styles.helperMenuItemText}>{choice.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.segmentedRow}>
            <SegmentedChoice
              active={mode === "equal-sides"}
              accessibilityLabel="Use equal sides for plate calculator"
              testID="plate-mode-equal-sides"
              onPress={() => updateMode("equal-sides")}
            >
              equal sides
            </SegmentedChoice>
            <SegmentedChoice
              active={mode === "total"}
              accessibilityLabel="Use total load for plate calculator"
              testID="plate-mode-total"
              onPress={() => updateMode("total")}
            >
              total load
            </SegmentedChoice>
          </View>

          <View style={styles.helperSection}>
            {platePlan.error ? (
              <>
                <HelperLine
                  left="start"
                  right={
                    startingWeight > 0
                      ? `${formatNumber(startingWeight)}lb`
                      : "none"
                  }
                />
                <HelperLine
                  left={mode === "equal-sides" ? "each" : "load"}
                  right={platePlan.title}
                />
                <HelperLine left="-" right={platePlan.error} />
              </>
            ) : (
              <PlatePlanDisplay plan={platePlan} />
            )}
          </View>

          <Pressable
            accessibilityLabel="Close plate calculator"
            accessibilityRole="button"
            style={styles.helperDoneFooter}
            testID="plate-calculator-done"
            onPress={onClose}
          >
            <Text style={styles.helperDoneFooterText}>done</Text>
          </Pressable>
        </View>
      </DismissibleModalShade>
    </AppModal>
  );
}

function SegmentedChoice({
  active,
  accessibilityLabel,
  children,
  onPress,
  testID,
}: {
  active: boolean;
  accessibilityLabel?: string;
  children: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityRole="button"
      style={[
        styles.segmentedButton,
        active ? styles.segmentedButtonActive : null,
      ]}
      onPress={onPress}
      testID={testID}
    >
      <Text
        style={[
          styles.segmentedButtonText,
          active ? styles.segmentedButtonTextActive : null,
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

function PlatePlanDisplay({
  plan,
}: {
  plan: ReturnType<typeof calculatePlatePlan>;
}) {
  const plateBlocks = plan.plates.flatMap((plate) =>
    Array.from({ length: plate.count }, (_, index) => ({
      key: `${plate.weight}-${index}`,
      weight: plate.weight,
    })),
  );

  return (
    <View style={styles.platePlan}>
      <View style={styles.plateVisualRow}>
        <BarVisual weight={plan.startingWeight} />
        <View style={styles.plateBlockRow}>
          {plateBlocks.length ? (
            plateBlocks.map((plate) => (
              <PlateBlock key={plate.key} weight={plate.weight} />
            ))
          ) : (
            <Text style={styles.helperMutedLine}>no plates</Text>
          )}
        </View>
      </View>
      <Text style={styles.helperMutedLine}>{formatPlateSummary(plan)}</Text>
      <View style={styles.plateLegendRow}>
        {PLATES.map((plate) => {
          const count =
            plan.plates.find((candidate) => candidate.weight === plate)
              ?.count ?? 0;
          return (
            <View key={plate} style={styles.plateLegendItem}>
              <PlateChip weight={plate} active={count > 0} />
              <Text style={styles.plateCountText}>
                {count > 0 ? `x${count}` : " "}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function BarVisual({ weight }: { weight: number }) {
  return (
    <View style={styles.barVisual}>
      <Text style={styles.barVisualText}>
        {weight > 0 ? `${formatNumber(weight)}lb` : ""}
      </Text>
    </View>
  );
}

function PlateBlock({ weight }: { weight: PlateWeight }) {
  const colors = getPlateColor(weight);
  return (
    <View
      style={[
        styles.plateBlock,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          height: getPlateHeight(weight),
        },
      ]}
    >
      <Text style={[styles.plateBlockText, { color: colors.text }]}>
        {formatNumber(weight)}
      </Text>
    </View>
  );
}

function PlateChip({
  weight,
  active,
}: {
  weight: PlateWeight;
  active: boolean;
}) {
  const colors = getPlateColor(weight);
  return (
    <View
      style={[
        styles.plateChip,
        {
          backgroundColor: active ? colors.background : palette.raised,
          borderColor: active ? colors.border : palette.line,
        },
      ]}
    >
      <Text
        style={[
          styles.plateChipText,
          { color: active ? colors.text : palette.muted },
        ]}
      >
        {formatNumber(weight)}
      </Text>
    </View>
  );
}

function HelperLine({ left, right }: { left: string; right: string }) {
  return (
    <View style={styles.helperLine}>
      <Text style={styles.helperLineLeft}>{left}</Text>
      <Text style={styles.helperLineRight}>{right}</Text>
    </View>
  );
}

const STARTING_WEIGHTS = [
  { label: "none", weight: 0 },
  { label: "45lb bar", weight: 45 },
  { label: "25lb bar", weight: 25 },
  { label: "15lb bar", weight: 15 },
] as const;

function parsePlateMode(
  value: PlateLoadMode | null | undefined,
): PlateLoadMode {
  return value === "total" ? "total" : "equal-sides";
}

function getStartingWeightLabel(weight: number) {
  return (
    STARTING_WEIGHTS.find((choice) => choice.weight === weight)?.label ??
    `${formatNumber(weight)}lb`
  );
}

function formatSetSummary(weight: number, reps: number) {
  return `${formatNumber(weight)}lb×${formatNumber(reps)}`;
}

function formatOneRepMax(oneRepMax: number) {
  return `${formatNumber(oneRepMax)}lb 1rm`;
}

function formatSignedCompactPounds(value: number) {
  if (value > 0) return `+${formatNumber(value)}lb`;
  if (value < 0) return `-${formatNumber(Math.abs(value))}lb`;
  return "0lb";
}

function formatPercentChangeNarrative(value: number) {
  const rounded = Number(value.toFixed(1));
  const absolute = formatNumber(Math.abs(rounded));
  if (rounded > 0) return `+${absolute}% increase`;
  if (rounded < 0) return `-${absolute}% decrease`;
  return "same";
}

function formatPlateSummary(plan: ReturnType<typeof calculatePlatePlan>) {
  return `${formatPlateWeight(plan.startingWeight)}lb start . ${formatPlateWeight(
    plan.loadWeight,
  )}lb ${plan.mode === "equal-sides" ? "per side" : "total"}`;
}

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

function getPlateHeight(weight: PlateWeight) {
  if (weight === 45) return 64;
  if (weight === 35) return 56;
  if (weight === 25) return 52;
  if (weight === 10) return 44;
  if (weight === 5) return 40;
  return 34;
}

function getPlateColor(weight: PlateWeight) {
  if (weight === 45) {
    return { background: "#ff3347", border: "#4b5563", text: "#fffefa" };
  }
  if (weight === 35) {
    return { background: "#eef1f6", border: "#c8ced8", text: "#7a7468" };
  }
  if (weight === 25) {
    return { background: "#dbe4f1", border: "#9aa7b8", text: "#383225" };
  }
  if (weight === 10) {
    return { background: "#f7b91e", border: "#4b5563", text: "#1f1c17" };
  }
  if (weight === 5) {
    return { background: "#a855f7", border: "#4b5563", text: "#fffefa" };
  }
  return { background: "#e8dfce", border: "#a99f8e", text: "#383225" };
}

function WorkoutStartTimeEditor({
  target,
  startTime,
  completedAt,
  onClose,
  onSaveStartTime,
  onSaveCompletedAt,
}: {
  target: ClockTimeEditTarget | null;
  startTime: number;
  completedAt: Date | null;
  onClose: () => void;
  onSaveStartTime: (startTime: number) => void;
  onSaveCompletedAt: (completedTime: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const startDate = new Date(startTime);
  const fallbackEndDate =
    completedAt ?? defaultCompletedAtForStartTime(startTime);
  const baseDate =
    target === "start-date" || target === "start-time"
      ? startDate
      : target === "end-time" || target === "finish-end-time"
        ? mergeDatePart(fallbackEndDate, startDate)
        : fallbackEndDate;
  const [value, setValue] = useState(() => baseDate);

  useEffect(() => {
    if (!target) return;
    setValue(baseDate);
  }, [baseDate.getTime(), target]);

  if (!target) return null;

  const isDateTarget = target.endsWith("date");
  const isStartTarget = target.startsWith("start");
  const label = `${isStartTarget ? "start" : "end"} ${isDateTarget ? "date" : "time"}`;

  const save = () => {
    if (isStartTarget) {
      onSaveStartTime(value.getTime());
    } else {
      onSaveCompletedAt(value.getTime());
    }
    onClose();
  };

  return (
    <AppModal visible transparent animationType="none" onRequestClose={onClose}>
      <DismissibleModalShade onDismiss={onClose}>
        <View style={styles.sheetDock}>
          <View
            style={[
              styles.noteSheet,
              { paddingBottom: Math.max(12, insets.bottom + 8) },
            ]}
          >
            <View style={styles.keyboardHeader}>
              <Text style={styles.metaText}>{label}</Text>
              <View style={styles.flexSpacer} />
              <Pressable
                accessibilityLabel="Close time editor"
                accessibilityRole="button"
                style={styles.iconButtonSmall}
                testID="time-editor-close"
                onPress={onClose}
              >
                <Icon name="close-outline" size={24} />
              </Pressable>
            </View>
            <DateTimePicker
              accessibilityLabel={label}
              display={isDateTarget ? "inline" : "spinner"}
              mode={isDateTarget ? "date" : "time"}
              style={styles.dateTimePicker}
              testID={`workout-${target}-picker`}
              value={value}
              onChange={(_event, selectedDate) => {
                if (!selectedDate) return;
                setValue(
                  isDateTarget
                    ? mergeDatePart(baseDate, selectedDate)
                    : mergeTimePart(baseDate, selectedDate),
                );
              }}
            />
            <View style={styles.sheetActionsEnd}>
              <Pressable
                accessibilityLabel={`Save ${label}`}
                accessibilityRole="button"
                style={styles.textButton}
                testID="time-editor-done"
                onPress={save}
              >
                <Text style={styles.textButtonText}>done</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </DismissibleModalShade>
    </AppModal>
  );
}

function WorkoutDurationEditor({
  target,
  startTime,
  completedAt,
  onClose,
  onSaveDuration,
}: {
  target: DurationEditTarget;
  startTime: number;
  completedAt: Date | null;
  onClose: () => void;
  onSaveDuration: (durationMinutes: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const initialMinutes = durationMinutesBetween(
    startTime,
    completedAt ?? defaultCompletedAtForStartTime(startTime),
  );
  const [entry, setEntry] = useState(String(initialMinutes));

  const updateEntry = (nextEntry: string) => {
    setEntry(nextEntry.replace(/[^\d]/g, ""));
  };

  const handleKey = (key: string) => {
    updateEntry(entry === "0" ? key : `${entry}${key}`);
  };

  const backspace = () => {
    updateEntry(entry.slice(0, -1));
  };

  const step = (amount: number) => {
    const current = Number(entry) || 0;
    updateEntry(String(Math.max(1, current + amount)));
  };

  const save = () => {
    onSaveDuration(Math.max(1, Number(entry) || 1));
    onClose();
  };

  return (
    <AppModal visible transparent animationType="none" onRequestClose={onClose}>
      <DismissibleModalShade onDismiss={onClose}>
        <View style={styles.sheetDock}>
          <View
            style={[
              styles.noteSheet,
              { paddingBottom: Math.max(12, insets.bottom + 8) },
            ]}
          >
            <View style={styles.keyboardHeader}>
              <Text style={styles.metaText}>
                {target === "finish-duration" ? "finish duration" : "duration"}
              </Text>
              <View style={styles.flexSpacer} />
              <Pressable
                accessibilityLabel="Close duration editor"
                accessibilityRole="button"
                style={styles.iconButtonSmall}
                testID="duration-editor-close"
                onPress={onClose}
              >
                <Icon name="close-outline" size={24} />
              </Pressable>
            </View>
            <View style={styles.editorValueRow}>
              <View style={styles.valueChip} testID="duration-editor-value">
                <Text style={styles.bigValueText}>{entry || "-"}m</Text>
              </View>
              <View style={styles.keypadSplitCell}>
                <KeypadButton
                  accessibilityLabel="Decrease duration"
                  onPress={() => step(-5)}
                >
                  -
                </KeypadButton>
                <KeypadButton
                  accessibilityLabel="Increase duration"
                  onPress={() => step(5)}
                >
                  +
                </KeypadButton>
              </View>
            </View>
            <View style={styles.keypad}>
              <View style={styles.keypadRow}>
                <KeypadButton onPress={() => handleKey("1")}>1</KeypadButton>
                <KeypadButton onPress={() => handleKey("2")}>2</KeypadButton>
                <KeypadButton onPress={() => handleKey("3")}>3</KeypadButton>
              </View>
              <View style={styles.keypadRow}>
                <KeypadButton onPress={() => handleKey("4")}>4</KeypadButton>
                <KeypadButton onPress={() => handleKey("5")}>5</KeypadButton>
                <KeypadButton onPress={() => handleKey("6")}>6</KeypadButton>
              </View>
              <View style={styles.keypadRow}>
                <KeypadButton onPress={() => handleKey("7")}>7</KeypadButton>
                <KeypadButton onPress={() => handleKey("8")}>8</KeypadButton>
                <KeypadButton onPress={() => handleKey("9")}>9</KeypadButton>
              </View>
              <View style={styles.keypadRow}>
                <View style={styles.keyBlank} />
                <KeypadButton onPress={() => handleKey("0")}>0</KeypadButton>
                <KeypadButton icon="backspace-outline" onPress={backspace} />
                <KeypadButton primary onPress={save}>
                  done
                </KeypadButton>
              </View>
            </View>
          </View>
        </View>
      </DismissibleModalShade>
    </AppModal>
  );
}

function FinishPreviewModal({
  workout,
  saving,
  open,
  saveLabel,
  onEditEndDate,
  onEditEndTime,
  onEditDuration,
  onBack,
  onSave,
}: {
  workout: CompletedWorkout | null;
  saving: boolean;
  open: boolean;
  saveLabel: string;
  onEditEndDate: () => void;
  onEditEndTime: () => void;
  onEditDuration: () => void;
  onBack: () => void;
  onSave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const previewMaxHeight = Math.max(
    320,
    height - insets.top - insets.bottom - 16,
  );

  if (!workout) return null;

  return (
    <AppModal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onBack}
    >
      <DismissibleModalShade onDismiss={onBack}>
        <View
          style={[
            styles.previewBox,
            {
              maxHeight: previewMaxHeight,
              marginBottom: Math.max(8, insets.bottom + 8),
            },
          ]}
        >
          <Text style={styles.exerciseTitle}>{workout.name}</Text>
          <Text style={styles.metaText}>
            {workout.exercises.length} exercises .{" "}
            {countWorkoutWorkingSets(workout)} sets
          </Text>
          <View style={styles.timeInlineRow}>
            <Text style={styles.metaText}>
              {formatDateTime(workout.startedAt)} -{" "}
            </Text>
            <Pressable
              accessibilityLabel="Edit finish end date"
              accessibilityRole="button"
              style={styles.timeTextButton}
              testID="finish-preview-end-date"
              onPress={onEditEndDate}
            >
              <Text style={styles.timeTextButtonText}>
                {formatWorkoutStartDate(workout.completedAt)}
              </Text>
            </Pressable>
            <Text style={styles.metaText}> </Text>
            <Pressable
              accessibilityLabel="Edit finish end time"
              accessibilityRole="button"
              style={styles.timeTextButton}
              testID="finish-preview-end-time"
              onPress={onEditEndTime}
            >
              <Text style={styles.timeTextButtonText}>
                {formatTime(workout.completedAt)}
              </Text>
            </Pressable>
            <Text style={styles.metaText}> (</Text>
            <Pressable
              accessibilityLabel="Edit finish duration"
              accessibilityRole="button"
              style={styles.timeTextButton}
              testID="finish-preview-duration"
              onPress={onEditDuration}
            >
              <Text style={styles.timeTextButtonText}>
                {formatDuration(workout.startedAt, workout.completedAt)}
              </Text>
            </Pressable>
            <Text style={styles.metaText}>)</Text>
          </View>
          <ScrollView
            contentContainerStyle={styles.previewScrollContent}
            keyboardShouldPersistTaps="handled"
            style={styles.previewScroll}
          >
            {workout.exercises.map((exercise) => (
              <View
                key={`${exercise.name}-${exercise.order}`}
                style={styles.previewExercise}
              >
                <Text style={styles.previewExerciseTitle}>
                  {exercise.name} .{" "}
                  {countCompletedExerciseWorkingSets(exercise)} sets
                </Text>
                <Text style={styles.historySummary}>
                  {summarizeCompletedExerciseSetGroup(
                    exercise.sets.filter((set) => set.modifier === "warmup"),
                  ) ?? ""}
                </Text>
                <Text style={styles.historySummary}>
                  {summarizeCompletedExerciseSetGroup(
                    exercise.sets.filter((set) => set.modifier !== "warmup"),
                  ) ?? ""}
                </Text>
              </View>
            ))}
          </ScrollView>
          <View style={styles.noteActions}>
            <Pressable
              accessibilityLabel="Go back to workout"
              accessibilityRole="button"
              style={styles.iconButton}
              testID="finish-preview-back"
              onPress={onBack}
            >
              <Icon name="arrow-back-outline" size={24} />
            </Pressable>
            <Pressable
              accessibilityLabel={saveLabel}
              accessibilityRole="button"
              style={[styles.textButton, styles.primaryWideButton]}
              testID="finish-preview-save"
              onPress={onSave}
              disabled={saving}
            >
              <Text style={styles.primaryWideButtonText}>
                {saving ? "saving" : saveLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </DismissibleModalShade>
    </AppModal>
  );
}

function toggleRest(
  dispatch: (action: Action) => void,
  exerciseIndex: number,
  exercise: WorkoutExercise,
  setIndex: number,
) {
  const set = exercise.sets[setIndex];
  if (!set) return;
  const nextRest: SetRestType | undefined =
    set.restBefore === "short" ? "standard" : "short";
  dispatch({
    type: "SET_REST_BEFORE",
    exerciseIndex,
    setIndex,
    restBefore: nextRest,
  });
}

function findSetIndex(exercise: WorkoutExercise | undefined, setId: string) {
  if (!exercise) return null;
  const stableIndex = exercise.sets.findIndex((set) => set.clientId === setId);
  if (stableIndex >= 0) return stableIndex;
  const indexTarget = parseSetTargetId(setId);
  if (indexTarget != null) {
    return exercise.sets[indexTarget] ? indexTarget : null;
  }
  return null;
}

function findWatchCommandSetTarget(
  exercises: WorkoutExercise[],
  currentExerciseIndex: number,
  setId: string,
) {
  const currentSetIndex = findSetIndex(
    exercises[currentExerciseIndex],
    setId,
  );
  if (currentSetIndex != null) {
    return { exerciseIndex: currentExerciseIndex, setIndex: currentSetIndex };
  }

  if (parseSetTargetId(setId) != null) return null;

  for (let exerciseIndex = 0; exerciseIndex < exercises.length; exerciseIndex += 1) {
    if (exerciseIndex === currentExerciseIndex) continue;
    const setIndex = findSetIndex(exercises[exerciseIndex], setId);
    if (setIndex != null) return { exerciseIndex, setIndex };
  }

  return null;
}

function getSetTargetId(set: WorkoutSet, setIndex: number) {
  return set.clientId ?? makeSetTargetId(setIndex);
}

function getInlineTextInputWidth(text: string) {
  return Math.max(34, text.length * 12 + 2);
}

function getWorkoutTitleInputWidth(text: string) {
  return Math.max(48, text.length * 19 + 8);
}

function makeSetTargetId(setIndex: number) {
  return `index:${setIndex}`;
}

function parseSetTargetId(setId: string) {
  if (!setId.startsWith("index:")) return null;
  const index = Number(setId.slice("index:".length));
  return Number.isInteger(index) && index >= 0 ? index : null;
}

function formatWorkoutStartDate(date: Date) {
  return date
    .toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
    .toLowerCase();
}

function formatTitleDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatElapsedClock(startedAt: Date, endedAt: Date) {
  const seconds = Math.max(
    0,
    Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000),
  );
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) return `${hours}:${String(minutes).padStart(2, "0")}`;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatAdjustDateTime(date: Date, now: Date) {
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const time = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  if (sameDay) return `Today, ${time}`;
  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${day}, ${time}`;
}

function defaultCompletedAtForStartTime(startTime: number) {
  const startDate = new Date(startTime);
  const now = new Date();
  const completedAt = mergeTimePart(startDate, now);
  const minimumCompletedAt = startTime + 60_000;
  return new Date(Math.max(minimumCompletedAt, completedAt.getTime()));
}

function completedAtForDuration(startTime: number, durationMinutes: number) {
  const safeMinutes = Math.max(1, Math.trunc(durationMinutes));
  return new Date(startTime + safeMinutes * 60_000);
}

function durationMinutesBetween(startTime: number, completedAt: Date) {
  return Math.max(1, Math.round((completedAt.getTime() - startTime) / 60_000));
}

function isDurationEditTarget(
  target: TimeEditTarget | null,
): target is DurationEditTarget {
  return target === "end-duration" || target === "finish-duration";
}

function mergeDatePart(startDate: Date, selectedDate: Date) {
  const nextDate = new Date(startDate);
  nextDate.setFullYear(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
  );
  return nextDate;
}

function mergeTimePart(startDate: Date, selectedDate: Date) {
  const nextDate = new Date(startDate);
  nextDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
  return nextDate;
}

function getNoteValue(workout: Workout, target: NoteEditTarget) {
  if (target.kind === "workout") return workout.notes[0]?.text ?? "";
  const exercise = workout.exercises[target.exerciseIndex];
  if (!exercise) return "";
  if (target.kind === "exercise") return exercise.exerciseNotes ?? "";
  if (target.kind === "workout-exercise") return exercise.notes[0]?.text ?? "";
  const setIndex = findSetIndex(exercise, target.setId);
  return setIndex == null ? "" : (exercise.sets[setIndex]?.notes ?? "");
}

function getInlineNoteTargetKey(target: InlineNoteEditTarget | null) {
  if (!target) return "";
  if (target.kind === "set") {
    return `${target.kind}:${target.exerciseIndex}:${target.setId}`;
  }
  return `${target.kind}:${target.exerciseIndex}`;
}

function isSameNoteTarget(
  left: InlineNoteEditTarget | null,
  right: InlineNoteEditTarget,
) {
  return getInlineNoteTargetKey(left) === getInlineNoteTargetKey(right);
}

function setLabel(exercise: WorkoutExercise, setIndex: number) {
  const set = exercise.sets[setIndex];
  if (!set) return "set";
  const sameKind = exercise.sets
    .slice(0, setIndex + 1)
    .filter((candidate) =>
      set.modifier === "warmup"
        ? candidate.modifier === "warmup"
        : candidate.modifier !== "warmup" && candidate.restBefore !== "short",
    );
  if (set.modifier === "warmup") return `warm-up set ${sameKind.length}`;
  if (set.restBefore === "short") {
    const workingBefore = exercise.sets
      .slice(0, setIndex)
      .filter(
        (candidate) =>
          candidate.modifier !== "warmup" && candidate.restBefore !== "short",
      );
    return `set ${Math.max(1, workingBefore.length)}`;
  }
  return `set ${sameKind.length}`;
}

function setCardKindLabel(exercise: WorkoutExercise, setIndex: number) {
  const set = exercise.sets[setIndex];
  if (!set) return "";
  const sameKind = exercise.sets
    .slice(0, setIndex + 1)
    .filter((candidate) =>
      set.modifier === "warmup"
        ? candidate.modifier === "warmup" && candidate.restBefore !== "short"
        : candidate.modifier !== "warmup" && candidate.restBefore !== "short",
    );

  return set.modifier === "warmup"
    ? `W${sameKind.length}`
    : String(sameKind.length);
}
