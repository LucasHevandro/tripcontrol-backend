-- CreateIndex
CREATE INDEX "expense_splits_participantId_idx" ON "expense_splits"("participantId");

-- CreateIndex
CREATE INDEX "expenses_tripId_idx" ON "expenses"("tripId");

-- CreateIndex
CREATE INDEX "invites_tripId_idx" ON "invites"("tripId");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "reservations_tripId_idx" ON "reservations"("tripId");

-- CreateIndex
CREATE INDEX "roadmap_activities_tripId_idx" ON "roadmap_activities"("tripId");

-- CreateIndex
CREATE INDEX "trip_participants_userId_idx" ON "trip_participants"("userId");
