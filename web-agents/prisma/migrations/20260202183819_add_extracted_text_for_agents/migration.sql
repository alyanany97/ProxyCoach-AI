-- AlterTable
ALTER TABLE "UploadedFile" ADD COLUMN     "extracted_text" TEXT;

-- CreateIndex
CREATE INDEX "UploadedFile_uploaded_at_idx" ON "UploadedFile"("uploaded_at");
