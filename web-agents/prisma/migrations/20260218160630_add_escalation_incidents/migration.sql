-- CreateTable
CREATE TABLE "EscalationIncident" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "chat_id" TEXT,
    "question" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,

    CONSTRAINT "EscalationIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EscalationIncident_user_id_idx" ON "EscalationIncident"("user_id");

-- CreateIndex
CREATE INDEX "EscalationIncident_company_id_idx" ON "EscalationIncident"("company_id");

-- CreateIndex
CREATE INDEX "EscalationIncident_created_at_idx" ON "EscalationIncident"("created_at");

-- CreateIndex
CREATE INDEX "EscalationIncident_chat_id_idx" ON "EscalationIncident"("chat_id");

-- AddForeignKey
ALTER TABLE "EscalationIncident" ADD CONSTRAINT "EscalationIncident_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalationIncident" ADD CONSTRAINT "EscalationIncident_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
