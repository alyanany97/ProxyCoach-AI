-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "agentId" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_agentId_idx" ON "Conversation"("agentId");
