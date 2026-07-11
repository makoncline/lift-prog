CREATE TABLE "new_rateLimit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" INTEGER NOT NULL
);

INSERT INTO "new_rateLimit" ("id", "key", "count", "lastRequest")
SELECT "key", "key", "count", "lastRequest"
FROM "rateLimit";

DROP TABLE "rateLimit";
ALTER TABLE "new_rateLimit" RENAME TO "rateLimit";
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");
