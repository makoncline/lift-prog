import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import {
  CompletedWorkoutSchema,
  type CompletedWorkout,
} from "@lift-prog/workout-core";

const COMPLETED_WORKOUT_OUTBOX_INDEX_KEY =
  "lift-prog-completed-workout-outbox-index-v1";
const COMPLETED_WORKOUT_OUTBOX_ITEM_PREFIX =
  "lift-prog-completed-workout-outbox-item-v1";
const STORAGE_CHUNK_SIZE = 1_800;

export type CompletedWorkoutOutboxItem = {
  id: string;
  action: "create" | "update";
  workoutId?: number;
  workout: CompletedWorkout;
  createdAt: number;
  attemptCount: number;
  lastAttemptAt: number | null;
};

export type CompletedWorkoutOutboxApi = {
  saveWorkout: (workout: CompletedWorkout) => Promise<unknown>;
  updateWorkout: (input: {
    workoutId: number;
    workout: CompletedWorkout;
  }) => Promise<unknown>;
};

type SerializedCompletedWorkoutOutboxItem = Omit<
  CompletedWorkoutOutboxItem,
  "workout"
> & {
  workout: unknown;
};

function getWebStorageItem(key: string) {
  return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
}

function setWebStorageItem(key: string, value: string) {
  if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
}

function removeWebStorageItem(key: string) {
  if (typeof localStorage !== "undefined") localStorage.removeItem(key);
}

async function readStorageValue(key: string) {
  if (Platform.OS === "web") return getWebStorageItem(key);
  return SecureStore.getItemAsync(key);
}

async function writeStorageValue(key: string, value: string) {
  if (Platform.OS === "web") {
    setWebStorageItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function removeStorageValue(key: string) {
  if (Platform.OS === "web") {
    removeWebStorageItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

const itemBaseKey = (id: string) =>
  `${COMPLETED_WORKOUT_OUTBOX_ITEM_PREFIX}:${id}`;
const itemMetaKey = (id: string) => `${itemBaseKey(id)}:meta`;
const itemChunkKey = (id: string, index: number) =>
  `${itemBaseKey(id)}:${index}`;

async function readOutboxIds(): Promise<string[]> {
  const raw = await readStorageValue(COMPLETED_WORKOUT_OUTBOX_INDEX_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

async function writeOutboxIds(ids: string[]) {
  await writeStorageValue(
    COMPLETED_WORKOUT_OUTBOX_INDEX_KEY,
    JSON.stringify(Array.from(new Set(ids))),
  );
}

async function readChunkedItem(id: string) {
  const metaRaw = await readStorageValue(itemMetaKey(id));
  if (!metaRaw) return null;

  let chunkCount = 0;
  try {
    const meta = JSON.parse(metaRaw) as { chunkCount?: unknown };
    chunkCount =
      typeof meta.chunkCount === "number" && meta.chunkCount > 0
        ? Math.floor(meta.chunkCount)
        : 0;
  } catch {
    return null;
  }

  if (chunkCount === 0) return null;

  const chunks = await Promise.all(
    Array.from({ length: chunkCount }, (_, index) =>
      readStorageValue(itemChunkKey(id, index)),
    ),
  );
  if (chunks.some((chunk) => chunk == null)) return null;

  return chunks.join("");
}

async function writeChunkedItem(id: string, value: string) {
  const previousMetaRaw = await readStorageValue(itemMetaKey(id));
  let previousChunkCount = 0;
  if (previousMetaRaw) {
    try {
      const previousMeta = JSON.parse(previousMetaRaw) as {
        chunkCount?: unknown;
      };
      previousChunkCount =
        typeof previousMeta.chunkCount === "number"
          ? Math.max(0, Math.floor(previousMeta.chunkCount))
          : 0;
    } catch {
      previousChunkCount = 0;
    }
  }

  const chunks = value.match(
    new RegExp(`.{1,${STORAGE_CHUNK_SIZE}}`, "gs"),
  ) ?? [""];
  await Promise.all(
    chunks.map((chunk, index) =>
      writeStorageValue(itemChunkKey(id, index), chunk),
    ),
  );
  await writeStorageValue(
    itemMetaKey(id),
    JSON.stringify({ chunkCount: chunks.length }),
  );

  await Promise.all(
    Array.from(
      { length: Math.max(0, previousChunkCount - chunks.length) },
      (_, index) => removeStorageValue(itemChunkKey(id, chunks.length + index)),
    ),
  );
}

async function removeChunkedItem(id: string) {
  const metaRaw = await readStorageValue(itemMetaKey(id));
  let chunkCount = 0;
  if (metaRaw) {
    try {
      const meta = JSON.parse(metaRaw) as { chunkCount?: unknown };
      chunkCount =
        typeof meta.chunkCount === "number" && meta.chunkCount > 0
          ? Math.floor(meta.chunkCount)
          : 0;
    } catch {
      chunkCount = 0;
    }
  }

  await Promise.all([
    removeStorageValue(itemMetaKey(id)),
    ...Array.from({ length: chunkCount }, (_, index) =>
      removeStorageValue(itemChunkKey(id, index)),
    ),
  ]);
}

function parseOutboxItem(
  raw: string | null,
): CompletedWorkoutOutboxItem | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(
      raw,
    ) as Partial<SerializedCompletedWorkoutOutboxItem>;
    if (
      !parsed ||
      typeof parsed.id !== "string" ||
      (parsed.action !== "create" && parsed.action !== "update") ||
      typeof parsed.createdAt !== "number"
    ) {
      return null;
    }

    const workout = CompletedWorkoutSchema.parse(parsed.workout);
    return {
      id: parsed.id,
      action: parsed.action,
      workoutId:
        typeof parsed.workoutId === "number" ? parsed.workoutId : undefined,
      workout,
      createdAt: parsed.createdAt,
      attemptCount:
        typeof parsed.attemptCount === "number" ? parsed.attemptCount : 0,
      lastAttemptAt:
        typeof parsed.lastAttemptAt === "number" ? parsed.lastAttemptAt : null,
    };
  } catch {
    return null;
  }
}

export async function loadCompletedWorkoutOutboxItems() {
  const ids = await readOutboxIds();
  const items = (
    await Promise.all(
      ids.map(async (id) => parseOutboxItem(await readChunkedItem(id))),
    )
  ).filter((item): item is CompletedWorkoutOutboxItem => item != null);

  if (items.length !== ids.length) {
    await writeOutboxIds(items.map((item) => item.id));
  }

  return items;
}

export async function enqueueCompletedWorkoutSave(
  input:
    | { action: "create"; workout: CompletedWorkout }
    | { action: "update"; workoutId: number; workout: CompletedWorkout },
) {
  const id = `completed-workout-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const item: CompletedWorkoutOutboxItem = {
    id,
    action: input.action,
    workoutId: input.action === "update" ? input.workoutId : undefined,
    workout: input.workout,
    createdAt: Date.now(),
    attemptCount: 0,
    lastAttemptAt: null,
  };

  const ids = await readOutboxIds();
  await writeChunkedItem(id, JSON.stringify(item));
  await writeOutboxIds([...ids, id]);
  return item;
}

async function updateOutboxItem(item: CompletedWorkoutOutboxItem) {
  await writeChunkedItem(item.id, JSON.stringify(item));
}

async function deleteOutboxItem(id: string) {
  const ids = await readOutboxIds();
  await removeChunkedItem(id);
  await writeOutboxIds(ids.filter((currentId) => currentId !== id));
}

async function submitOutboxItem(
  api: CompletedWorkoutOutboxApi,
  item: CompletedWorkoutOutboxItem,
) {
  if (item.action === "update") {
    if (typeof item.workoutId !== "number") {
      throw new Error("Queued workout update is missing workoutId.");
    }

    await api.updateWorkout({
      workoutId: item.workoutId,
      workout: item.workout,
    });
    return;
  }

  await api.saveWorkout(item.workout);
}

export async function flushCompletedWorkoutOutbox(
  api: CompletedWorkoutOutboxApi,
) {
  const items = await loadCompletedWorkoutOutboxItems();
  let flushedCount = 0;

  for (const item of items) {
    try {
      await submitOutboxItem(api, item);
      await deleteOutboxItem(item.id);
      flushedCount += 1;
    } catch {
      await updateOutboxItem({
        ...item,
        attemptCount: item.attemptCount + 1,
        lastAttemptAt: Date.now(),
      });
      break;
    }
  }

  return { pendingCount: items.length - flushedCount, flushedCount };
}
