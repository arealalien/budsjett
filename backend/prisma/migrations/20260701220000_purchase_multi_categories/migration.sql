-- Add a non-destructive join table for multi-category purchases.
-- Existing Purchase.categoryId remains the required primary category for backwards compatibility.
CREATE TABLE "PurchaseCategory" (
    "purchaseId" VARCHAR(25) NOT NULL,
    "categoryId" VARCHAR(25) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseCategory_pkey" PRIMARY KEY ("purchaseId", "categoryId")
);

CREATE INDEX "PurchaseCategory_categoryId_idx" ON "PurchaseCategory"("categoryId");

ALTER TABLE "PurchaseCategory"
    ADD CONSTRAINT "PurchaseCategory_purchaseId_fkey"
    FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PurchaseCategory"
    ADD CONSTRAINT "PurchaseCategory_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill every existing purchase with its current primary category.
INSERT INTO "PurchaseCategory" ("purchaseId", "categoryId")
SELECT "id", "categoryId"
FROM "Purchase"
ON CONFLICT ("purchaseId", "categoryId") DO NOTHING;
