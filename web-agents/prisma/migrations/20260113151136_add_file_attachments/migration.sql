-- CreateTable
CREATE TABLE "FileAttachment" (
   "id" TEXT NOT NULL,
   "messageId" TEXT NOT NULL,
   "fileName" TEXT NOT NULL,
   "fileType" TEXT NOT NULL,
   "fileSize" INTEGER NOT NULL,
   "fileUrl" TEXT,
   "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

   CONSTRAINT "FileAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileAttachment_messageId_idx" ON "FileAttachment"("messageId");

-- AddForeignKey
ALTER TABLE "FileAttachment"
ADD CONSTRAINT "FileAttachment_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

