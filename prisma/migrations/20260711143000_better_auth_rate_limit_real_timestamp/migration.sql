CREATE TABLE "new_rateLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" REAL NOT NULL
);

INSERT INTO "new_rateLimit" ("id", "key", "count", "lastRequest")
SELECT "id", "key", "count", CAST("lastRequest" AS REAL)
FROM "rateLimit";

DROP TABLE "rateLimit";
ALTER TABLE "new_rateLimit" RENAME TO "rateLimit";
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");
