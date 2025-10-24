-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "BudgetRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INVITE');

-- CreateEnum
CREATE TYPE "EntryKind" AS ENUM ('EXPENSE', 'INCOME');

-- CreateEnum
CREATE TYPE "Recurrence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "User" (
    "id" CHAR(25) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(191) NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "displayName" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "onboardingSkippedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" CHAR(25) NOT NULL,
    "userId" CHAR(25) NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "type" "TokenType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" CHAR(25) NOT NULL,
    "userId" CHAR(25) NOT NULL,
    "type" "NotificationType" NOT NULL,
    "data" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviteId" CHAR(25),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" CHAR(25) NOT NULL,
    "name" VARCHAR(191) NOT NULL,
    "ownerId" CHAR(25) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetMember" (
    "budgetId" CHAR(25) NOT NULL,
    "userId" CHAR(25) NOT NULL,
    "role" "BudgetRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetMember_pkey" PRIMARY KEY ("budgetId","userId")
);

-- CreateTable
CREATE TABLE "BudgetInvite" (
    "id" CHAR(25) NOT NULL,
    "budgetId" CHAR(25) NOT NULL,
    "invitedUserId" CHAR(25),
    "invitedEmail" VARCHAR(191),
    "token" VARCHAR(64) NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" CHAR(25) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "BudgetInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" CHAR(25) NOT NULL,
    "budgetId" CHAR(25) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "color" VARCHAR(20) NOT NULL,
    "planMonthly" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" CHAR(25) NOT NULL,
    "itemName" VARCHAR(191) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shared" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "budgetId" CHAR(25) NOT NULL,
    "categoryId" CHAR(25) NOT NULL,
    "paidById" CHAR(25) NOT NULL,
    "createdById" CHAR(25) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseShare" (
    "purchaseId" CHAR(25) NOT NULL,
    "userId" CHAR(25) NOT NULL,
    "percent" INTEGER NOT NULL,
    "fixedAmount" DECIMAL(12,2),
    "isSettled" BOOLEAN NOT NULL DEFAULT false,
    "settledAt" TIMESTAMP(3),
    "settledById" CHAR(25),

    CONSTRAINT "PurchaseShare_pkey" PRIMARY KEY ("purchaseId","userId")
);

-- CreateTable
CREATE TABLE "Income" (
    "id" CHAR(25) NOT NULL,
    "budgetId" CHAR(25) NOT NULL,
    "itemName" VARCHAR(191) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" CHAR(25) NOT NULL,
    "notes" TEXT,
    "createdById" CHAR(25) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringRule" (
    "id" CHAR(25) NOT NULL,
    "budgetId" CHAR(25) NOT NULL,
    "kind" "EntryKind" NOT NULL DEFAULT 'EXPENSE',
    "categoryId" CHAR(25),
    "paidById" CHAR(25),
    "receivedById" CHAR(25),
    "itemName" VARCHAR(191) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" VARCHAR(191),
    "recurrence" "Recurrence" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "timeZone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" CHAR(25) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_token_key" ON "AuthToken"("token");

-- CreateIndex
CREATE INDEX "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");

-- CreateIndex
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_type_inviteId_idx" ON "Notification"("userId", "type", "inviteId");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_slug_key" ON "Budget"("slug");

-- CreateIndex
CREATE INDEX "Budget_ownerId_idx" ON "Budget"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_ownerId_name_key" ON "Budget"("ownerId", "name");

-- CreateIndex
CREATE INDEX "BudgetMember_userId_idx" ON "BudgetMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetInvite_token_key" ON "BudgetInvite"("token");

-- CreateIndex
CREATE INDEX "BudgetInvite_budgetId_idx" ON "BudgetInvite"("budgetId");

-- CreateIndex
CREATE INDEX "BudgetInvite_invitedUserId_idx" ON "BudgetInvite"("invitedUserId");

-- CreateIndex
CREATE INDEX "BudgetInvite_invitedById_idx" ON "BudgetInvite"("invitedById");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetInvite_budgetId_invitedEmail_status_key" ON "BudgetInvite"("budgetId", "invitedEmail", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetInvite_budgetId_invitedUserId_status_key" ON "BudgetInvite"("budgetId", "invitedUserId", "status");

-- CreateIndex
CREATE INDEX "Category_budgetId_name_idx" ON "Category"("budgetId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_budgetId_slug_key" ON "Category"("budgetId", "slug");

-- CreateIndex
CREATE INDEX "Purchase_budgetId_paidAt_idx" ON "Purchase"("budgetId", "paidAt");

-- CreateIndex
CREATE INDEX "Purchase_budgetId_categoryId_paidAt_idx" ON "Purchase"("budgetId", "categoryId", "paidAt");

-- CreateIndex
CREATE INDEX "Purchase_budgetId_paidById_paidAt_idx" ON "Purchase"("budgetId", "paidById", "paidAt");

-- CreateIndex
CREATE INDEX "Purchase_budgetId_createdById_paidAt_idx" ON "Purchase"("budgetId", "createdById", "paidAt");

-- CreateIndex
CREATE INDEX "Purchase_paidAt_idx" ON "Purchase"("paidAt");

-- CreateIndex
CREATE INDEX "PurchaseShare_userId_idx" ON "PurchaseShare"("userId");

-- CreateIndex
CREATE INDEX "PurchaseShare_isSettled_settledAt_idx" ON "PurchaseShare"("isSettled", "settledAt");

-- CreateIndex
CREATE INDEX "Income_budgetId_receivedAt_idx" ON "Income"("budgetId", "receivedAt");

-- CreateIndex
CREATE INDEX "RecurringRule_budgetId_active_nextRunAt_idx" ON "RecurringRule"("budgetId", "active", "nextRunAt");

-- CreateIndex
CREATE INDEX "RecurringRule_nextRunAt_active_idx" ON "RecurringRule"("nextRunAt", "active");

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetMember" ADD CONSTRAINT "BudgetMember_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetMember" ADD CONSTRAINT "BudgetMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetInvite" ADD CONSTRAINT "BudgetInvite_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetInvite" ADD CONSTRAINT "BudgetInvite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetInvite" ADD CONSTRAINT "BudgetInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseShare" ADD CONSTRAINT "PurchaseShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseShare" ADD CONSTRAINT "PurchaseShare_settledById_fkey" FOREIGN KEY ("settledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseShare" ADD CONSTRAINT "PurchaseShare_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Income" ADD CONSTRAINT "Income_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
