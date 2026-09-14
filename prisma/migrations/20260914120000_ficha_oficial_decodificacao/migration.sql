-- DropForeignKey
ALTER TABLE `dreamer_profiles` DROP FOREIGN KEY `dreamer_profiles_userId_fkey`;

-- DropForeignKey
ALTER TABLE `people` DROP FOREIGN KEY `people_userId_fkey`;

-- AlterTable
ALTER TABLE `users` MODIFY `code` VARCHAR(6) NULL;

-- AlterTable
ALTER TABLE `anamnesis_questions` ADD COLUMN `dependsOnAnswer` VARCHAR(190) NULL,
    ADD COLUMN `dependsOnId` INTEGER NULL;

-- AlterTable
ALTER TABLE `dream_elements` ADD COLUMN `timeframe` ENUM('Passado', 'Presente', 'Futuro') NULL;

-- AlterTable
ALTER TABLE `insights` ADD COLUMN `emotionalState` VARCHAR(190) NULL,
    ADD COLUMN `finalMessage` TEXT NULL;

-- DropTable
DROP TABLE `dreamer_profiles`;

-- DropTable
DROP TABLE `people`;

