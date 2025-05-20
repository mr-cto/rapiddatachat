-- CreateTable
CREATE TABLE "column_merges" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "file_id" TEXT NOT NULL,
    "merge_name" TEXT NOT NULL,
    "column_list" TEXT[] NOT NULL,
    "delimiter" TEXT NOT NULL DEFAULT ' ',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "column_merges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_column_merges_user_id" ON "column_merges"("user_id");

-- CreateIndex
CREATE INDEX "idx_column_merges_file_id" ON "column_merges"("file_id");

-- AddForeignKey
ALTER TABLE "column_merges" ADD CONSTRAINT "column_merges_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE ON UPDATE CASCADE;