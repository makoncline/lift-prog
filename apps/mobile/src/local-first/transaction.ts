import type { Database } from "@tursodatabase/sync-react-native";

export async function withLocalTransaction<T>(
  _database: Database,
  operation: () => T | Promise<T>,
) {
  // sync-react-native 0.6.1 finalizes transaction-control statements after
  // each run(), so COMMIT reports "no transaction is active" after the writes
  // have already autocommitted. Keep the write batch boundary centralized so
  // real transactions can be restored when the SDK supports them reliably.
  return operation();
}
