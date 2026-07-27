CREATE TABLE "UserSyncDatabaseDeletion" (
    "databaseName" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT
);

CREATE INDEX "UserSyncDatabaseDeletion_requestedAt_idx"
ON "UserSyncDatabaseDeletion"("requestedAt");
