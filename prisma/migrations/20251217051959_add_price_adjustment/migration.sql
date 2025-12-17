-- CreateTable
CREATE TABLE "PriceAdjustment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "adjustment" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceAdjustment_shop_variantId_key" ON "PriceAdjustment"("shop", "variantId");
