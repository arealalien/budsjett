-- CreateTable
CREATE TABLE `User` (
    `id` CHAR(25) NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `emailVerifiedAt` DATETIME(3) NULL,
    `displayName` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_email_idx`(`email`),
    INDEX `User_username_idx`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuthToken` (
    `id` CHAR(25) NOT NULL,
    `userId` CHAR(25) NOT NULL,
    `token` VARCHAR(64) NOT NULL,
    `type` ENUM('EMAIL_VERIFY', 'PASSWORD_RESET') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,

    UNIQUE INDEX `AuthToken_token_key`(`token`),
    INDEX `AuthToken_userId_type_idx`(`userId`, `type`),
    INDEX `AuthToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Budget` (
    `id` CHAR(25) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `ownerId` CHAR(25) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Budget_ownerId_idx`(`ownerId`),
    UNIQUE INDEX `Budget_ownerId_name_key`(`ownerId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetMember` (
    `budgetId` CHAR(25) NOT NULL,
    `userId` CHAR(25) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BudgetMember_userId_idx`(`userId`),
    PRIMARY KEY (`budgetId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetInvite` (
    `id` CHAR(25) NOT NULL,
    `budgetId` CHAR(25) NOT NULL,
    `invitedUserId` CHAR(25) NULL,
    `invitedEmail` VARCHAR(191) NULL,
    `token` VARCHAR(64) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED') NOT NULL DEFAULT 'PENDING',
    `invitedById` CHAR(25) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,

    UNIQUE INDEX `BudgetInvite_token_key`(`token`),
    INDEX `BudgetInvite_budgetId_idx`(`budgetId`),
    INDEX `BudgetInvite_invitedUserId_idx`(`invitedUserId`),
    INDEX `BudgetInvite_invitedById_idx`(`invitedById`),
    UNIQUE INDEX `BudgetInvite_budgetId_invitedEmail_status_key`(`budgetId`, `invitedEmail`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Category` (
    `id` CHAR(25) NOT NULL,
    `budgetId` CHAR(25) NOT NULL,
    `name` VARCHAR(80) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `color` VARCHAR(20) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Category_budgetId_name_idx`(`budgetId`, `name`),
    UNIQUE INDEX `Category_budgetId_slug_key`(`budgetId`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Purchase` (
    `id` CHAR(25) NOT NULL,
    `itemName` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `paidAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `shared` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `budgetId` CHAR(25) NOT NULL,
    `categoryId` CHAR(25) NOT NULL,
    `paidById` CHAR(25) NOT NULL,
    `createdById` CHAR(25) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Purchase_budgetId_paidAt_idx`(`budgetId`, `paidAt`),
    INDEX `Purchase_budgetId_categoryId_paidAt_idx`(`budgetId`, `categoryId`, `paidAt`),
    INDEX `Purchase_budgetId_paidById_paidAt_idx`(`budgetId`, `paidById`, `paidAt`),
    INDEX `Purchase_budgetId_createdById_paidAt_idx`(`budgetId`, `createdById`, `paidAt`),
    INDEX `Purchase_paidAt_idx`(`paidAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PurchaseShare` (
    `purchaseId` CHAR(25) NOT NULL,
    `userId` CHAR(25) NOT NULL,
    `percent` INTEGER NOT NULL,
    `fixedAmount` DECIMAL(12, 2) NULL,
    `isSettled` BOOLEAN NOT NULL DEFAULT false,
    `settledAt` DATETIME(3) NULL,
    `settledById` CHAR(25) NULL,

    INDEX `PurchaseShare_userId_idx`(`userId`),
    INDEX `PurchaseShare_isSettled_settledAt_idx`(`isSettled`, `settledAt`),
    PRIMARY KEY (`purchaseId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AuthToken` ADD CONSTRAINT `AuthToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Budget` ADD CONSTRAINT `Budget_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetMember` ADD CONSTRAINT `BudgetMember_budgetId_fkey` FOREIGN KEY (`budgetId`) REFERENCES `Budget`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetMember` ADD CONSTRAINT `BudgetMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetInvite` ADD CONSTRAINT `BudgetInvite_budgetId_fkey` FOREIGN KEY (`budgetId`) REFERENCES `Budget`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetInvite` ADD CONSTRAINT `BudgetInvite_invitedUserId_fkey` FOREIGN KEY (`invitedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BudgetInvite` ADD CONSTRAINT `BudgetInvite_invitedById_fkey` FOREIGN KEY (`invitedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Category` ADD CONSTRAINT `Category_budgetId_fkey` FOREIGN KEY (`budgetId`) REFERENCES `Budget`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Purchase` ADD CONSTRAINT `Purchase_budgetId_fkey` FOREIGN KEY (`budgetId`) REFERENCES `Budget`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Purchase` ADD CONSTRAINT `Purchase_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `Category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Purchase` ADD CONSTRAINT `Purchase_paidById_fkey` FOREIGN KEY (`paidById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Purchase` ADD CONSTRAINT `Purchase_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseShare` ADD CONSTRAINT `PurchaseShare_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseShare` ADD CONSTRAINT `PurchaseShare_settledById_fkey` FOREIGN KEY (`settledById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PurchaseShare` ADD CONSTRAINT `PurchaseShare_purchaseId_fkey` FOREIGN KEY (`purchaseId`) REFERENCES `Purchase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
