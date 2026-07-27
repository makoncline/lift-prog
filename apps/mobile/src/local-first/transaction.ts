import type { LocalDatabase } from "./database-port";

export async function withLocalTransaction<T>(
  _database: LocalDatabase,
  operation: () => T | Promise<T>,
) {
  // sync-react-native 0.6.1 finalizes transaction-control statements after
  // each run(). Keep this boundary so real transactions can be enabled here
  // when the SDK supports them reliably.
  return operation();
}
