-- Add provider-neutral auth identity fields to the existing app user table.
ALTER TABLE "User" ADD COLUMN "authUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "authProvider" TEXT;
ALTER TABLE "User" ADD COLUMN "email" TEXT;

CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");
CREATE INDEX "User_authProvider_idx" ON "User"("authProvider");
CREATE INDEX "User_email_idx" ON "User"("email");

-- Better Auth persistence. These are intentionally separate from the app User table.
CREATE TABLE "auth_user" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL,
  "image" TEXT,
  "createdAt" DATETIME NOT NULL,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "auth_user_email_key" ON "auth_user"("email");

CREATE TABLE "auth_session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "expiresAt" DATETIME NOT NULL,
  "token" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL,
  "updatedAt" DATETIME NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL,
  CONSTRAINT "auth_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "auth_session_token_key" ON "auth_session"("token");
CREATE INDEX "auth_session_userId_idx" ON "auth_session"("userId");

CREATE TABLE "auth_account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" DATETIME,
  "refreshTokenExpiresAt" DATETIME,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" DATETIME NOT NULL,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "auth_account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth_user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "auth_account_userId_idx" ON "auth_account"("userId");

CREATE TABLE "auth_verification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME,
  "updatedAt" DATETIME
);
