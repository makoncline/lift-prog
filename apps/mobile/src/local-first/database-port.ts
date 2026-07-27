import type { Database } from "@tursodatabase/sync-react-native";

export type LocalDatabase = Pick<Database, "all" | "get" | "run">;
