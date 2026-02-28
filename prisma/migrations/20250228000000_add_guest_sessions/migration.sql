-- AlterTable
ALTER TABLE "User" ADD COLUMN     "guestExpiry" TIMESTAMP(3),
ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "User_guestExpiry_idx" ON "User"("guestExpiry");
