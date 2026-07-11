CREATE TABLE "UserSyncDatabase" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "databaseName" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "schemaVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSyncDatabase_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "UserSyncDatabase_databaseName_key"
ON "UserSyncDatabase"("databaseName");

CREATE INDEX "UserSyncDatabase_status_idx"
ON "UserSyncDatabase"("status");
