-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('regular', 'cashier', 'manager', 'superuser');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('purchase', 'redemption', 'adjustment', 'event', 'transfer');

-- CreateEnum
CREATE TYPE "PromotionType" AS ENUM ('automatic', 'onetime');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "utorid" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "birthday" TEXT,
    "avatarUrl" TEXT,
    "role" "RoleType" NOT NULL DEFAULT 'regular',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 0,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resetToken" TEXT,
    "resetExpiresAt" TIMESTAMP(3),
    "token" TEXT,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "utorid" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "spent" DOUBLE PRECISION,
    "points" INTEGER NOT NULL,
    "remark" TEXT NOT NULL DEFAULT '',
    "relatedId" INTEGER,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER,
    "spaceRemain" INTEGER,
    "pointsRemain" INTEGER NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "PromotionType" NOT NULL,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "minSpending" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_eventOrganizers" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_eventOrganizers_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_eventGuests" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_eventGuests_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_usedPromos" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_usedPromos_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_transactionPromotion" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_transactionPromotion_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_utorid_key" ON "User"("utorid");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "_eventOrganizers_B_index" ON "_eventOrganizers"("B");

-- CreateIndex
CREATE INDEX "_eventGuests_B_index" ON "_eventGuests"("B");

-- CreateIndex
CREATE INDEX "_usedPromos_B_index" ON "_usedPromos"("B");

-- CreateIndex
CREATE INDEX "_transactionPromotion_B_index" ON "_transactionPromotion"("B");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_utorid_fkey" FOREIGN KEY ("utorid") REFERENCES "User"("utorid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("utorid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_eventOrganizers" ADD CONSTRAINT "_eventOrganizers_A_fkey" FOREIGN KEY ("A") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_eventOrganizers" ADD CONSTRAINT "_eventOrganizers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_eventGuests" ADD CONSTRAINT "_eventGuests_A_fkey" FOREIGN KEY ("A") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_eventGuests" ADD CONSTRAINT "_eventGuests_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_usedPromos" ADD CONSTRAINT "_usedPromos_A_fkey" FOREIGN KEY ("A") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_usedPromos" ADD CONSTRAINT "_usedPromos_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_transactionPromotion" ADD CONSTRAINT "_transactionPromotion_A_fkey" FOREIGN KEY ("A") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_transactionPromotion" ADD CONSTRAINT "_transactionPromotion_B_fkey" FOREIGN KEY ("B") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
