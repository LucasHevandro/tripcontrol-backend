-- AlterEnum
ALTER TYPE "SplitType" ADD VALUE 'INDIVIDUAL';

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "fromParticipantId" TEXT NOT NULL,
    "toParticipantId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_tripId_idx" ON "Payment"("tripId");

-- CreateIndex
CREATE INDEX "Payment_fromParticipantId_idx" ON "Payment"("fromParticipantId");

-- CreateIndex
CREATE INDEX "Payment_toParticipantId_idx" ON "Payment"("toParticipantId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_fromParticipantId_fkey" FOREIGN KEY ("fromParticipantId") REFERENCES "trip_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_toParticipantId_fkey" FOREIGN KEY ("toParticipantId") REFERENCES "trip_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
