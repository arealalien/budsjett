/*
  Warnings:

  - The primary key for the `AuthToken` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Budget` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `BudgetInvite` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `BudgetMember` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Category` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Income` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Notification` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Purchase` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `PurchaseShare` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `RecurringRule` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "public"."AuthToken" DROP CONSTRAINT "AuthToken_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Budget" DROP CONSTRAINT "Budget_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BudgetInvite" DROP CONSTRAINT "BudgetInvite_budgetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BudgetInvite" DROP CONSTRAINT "BudgetInvite_invitedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."BudgetInvite" DROP CONSTRAINT "BudgetInvite_invitedUserId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BudgetMember" DROP CONSTRAINT "BudgetMember_budgetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."BudgetMember" DROP CONSTRAINT "BudgetMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Category" DROP CONSTRAINT "Category_budgetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Income" DROP CONSTRAINT "Income_budgetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Income" DROP CONSTRAINT "Income_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."Income" DROP CONSTRAINT "Income_receivedById_fkey";

-- DropForeignKey
ALTER TABLE "public"."Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Purchase" DROP CONSTRAINT "Purchase_budgetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Purchase" DROP CONSTRAINT "Purchase_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Purchase" DROP CONSTRAINT "Purchase_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."Purchase" DROP CONSTRAINT "Purchase_paidById_fkey";

-- DropForeignKey
ALTER TABLE "public"."PurchaseShare" DROP CONSTRAINT "PurchaseShare_purchaseId_fkey";

-- DropForeignKey
ALTER TABLE "public"."PurchaseShare" DROP CONSTRAINT "PurchaseShare_settledById_fkey";

-- DropForeignKey
ALTER TABLE "public"."PurchaseShare" DROP CONSTRAINT "PurchaseShare_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RecurringRule" DROP CONSTRAINT "RecurringRule_budgetId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RecurringRule" DROP CONSTRAINT "RecurringRule_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "public"."RecurringRule" DROP CONSTRAINT "RecurringRule_createdById_fkey";

-- DropForeignKey
ALTER TABLE "public"."RecurringRule" DROP CONSTRAINT "RecurringRule_paidById_fkey";

-- DropForeignKey
ALTER TABLE "public"."RecurringRule" DROP CONSTRAINT "RecurringRule_receivedById_fkey";

-- AlterTable
ALTER TABLE "AuthToken" DROP CONSTRAINT "AuthToken_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "userId" SET DATA TYPE VARCHAR(25),
ADD CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Budget" DROP CONSTRAINT "Budget_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "ownerId" SET DATA TYPE VARCHAR(25),
ADD CONSTRAINT "Budget_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "BudgetInvite" DROP CONSTRAINT "BudgetInvite_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "budgetId" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "invitedUserId" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "invitedById" SET DATA TYPE VARCHAR(25),
ADD CONSTRAINT "BudgetInvite_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "BudgetMember" DROP CONSTRAINT "BudgetMember_pkey",
ALTER COLUMN "budgetId" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "userId" SET DATA TYPE VARCHAR(25),
ADD CONSTRAINT "BudgetMember_pkey" PRIMARY KEY ("budgetId", "userId");

-- AlterTable
ALTER TABLE "Category" DROP CONSTRAINT "Category_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "budgetId" SET DATA TYPE VARCHAR(25),
ADD CONSTRAINT "Category_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Income" DROP CONSTRAINT "Income_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "budgetId" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "receivedById" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "createdById" SET DATA TYPE VARCHAR(25),
ADD CONSTRAINT "Income_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "userId" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "inviteId" SET DATA TYPE VARCHAR(25),
ADD CONSTRAINT "Notification_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Purchase" DROP CONSTRAINT "Purchase_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "budgetId" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "categoryId" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "paidById" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "createdById" SET DATA TYPE VARCHAR(25),
ADD CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "PurchaseShare" DROP CONSTRAINT "PurchaseShare_pkey",
ALTER COLUMN "purchaseId" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "userId" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "settledById" SET DATA TYPE VARCHAR(25),
ADD CONSTRAINT "PurchaseShare_pkey" PRIMARY KEY ("purchaseId", "userId");

-- AlterTable
ALTER TABLE "RecurringRule" DROP CONSTRAINT "RecurringRule_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "budgetId" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "categoryId" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "paidById" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "receivedById" SET DATA TYPE VARCHAR(25),
ALTER COLUMN "createdById" SET DATA TYPE VARCHAR(25),
ADD CONSTRAINT "RecurringRule_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ALTER COLUMN "id" SET DATA TYPE VARCHAR(25),
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

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
