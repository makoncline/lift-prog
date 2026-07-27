import { db } from "@/server/db";
import { drainUserSyncDatabaseDeletionQueue } from "@/server/services/user-sync-database";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await drainUserSyncDatabaseDeletionQueue(
      db.userSyncDatabaseDeletion,
    );
    console.info(
      JSON.stringify({
        event: "sync_database_deletion_queue_drained",
        ...result,
      }),
    );
    return Response.json(result);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "sync_database_deletion_queue_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return Response.json(
      { error: "Could not process sync database deletions." },
      { status: 500 },
    );
  }
}
