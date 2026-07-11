CREATE TABLE "rateLimit" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL,
    "lastRequest" INTEGER NOT NULL
);
