/*
  Warnings:

  - You are about to drop the column `source_id` on the `file_data` table. All the data in the column will be lost.
  - You are about to drop the column `source_id` on the `files` table. All the data in the column will be lost.
  - You are about to drop the `_FileToSources` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `file_id` on table `sources` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "_FileToSources" DROP CONSTRAINT "_FileToSources_A_fkey";

-- DropForeignKey
ALTER TABLE "_FileToSources" DROP CONSTRAINT "_FileToSources_B_fkey";

-- DropForeignKey
ALTER TABLE "files" DROP CONSTRAINT "files_source_id_fkey";

-- DropIndex
DROP INDEX "files_source_id_key";

-- DropIndex
DROP INDEX "sources_file_id_key";

-- AlterTable
ALTER TABLE "file_data" DROP COLUMN "source_id";

-- AlterTable
ALTER TABLE "files" DROP COLUMN "source_id";

-- AlterTable
ALTER TABLE "sources" ALTER COLUMN "file_id" SET NOT NULL;

-- DropTable
DROP TABLE "_FileToSources";

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
