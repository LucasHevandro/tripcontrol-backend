-- AlterTable
ALTER TABLE "trip_participants" ADD COLUMN     "sponsorId" TEXT;

-- AddForeignKey
ALTER TABLE "trip_participants" ADD CONSTRAINT "trip_participants_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "trip_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
