-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `document` VARCHAR(18) NULL,
    `phone` VARCHAR(191) NULL,
    `password` VARCHAR(191) NOT NULL,
    `code` VARCHAR(4) NULL,
    `codeExpiresIn` DATETIME(3) NULL,
    `role` ENUM('Master', 'Admin', 'User') NOT NULL DEFAULT 'User',
    `status` ENUM('Active', 'Pending', 'Inactive') NOT NULL DEFAULT 'Pending',
    `provider` ENUM('Email', 'Google', 'Apple') NOT NULL DEFAULT 'Email',
    `plan` ENUM('Gratuito', 'Cobre', 'Prata', 'Ouro', 'Diamante') NOT NULL DEFAULT 'Gratuito',
    `language` ENUM('Pt', 'En', 'Es') NOT NULL DEFAULT 'Pt',
    `streakDays` INTEGER NOT NULL DEFAULT 0,
    `lastDreamAt` DATETIME(3) NULL,
    `dreamsTotal` INTEGER NOT NULL DEFAULT 0,
    `npsAnswered` BOOLEAN NOT NULL DEFAULT false,
    `fileUrl` VARCHAR(1500) NULL,
    `fileKey` VARCHAR(1500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_document_key`(`document`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` ENUM('Dashboard', 'Settings') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_permissions_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `files` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fileUrl` VARCHAR(1500) NULL,
    `fileKey` VARCHAR(1500) NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `texts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('About', 'Policies', 'Terms', 'Tips', 'Cookies') NOT NULL,
    `text` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dreamer_profiles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `nickname` VARCHAR(191) NULL,
    `lifeMoment` VARCHAR(191) NULL,
    `work` VARCHAR(191) NULL,
    `workFeel` VARCHAR(191) NULL,
    `passions` JSON NULL,
    `fears` JSON NULL,
    `currentEmotion` ENUM('Alegria', 'Amor', 'Medo', 'Raiva', 'Tristeza', 'Confianca', 'Esperanca', 'Ansiedade', 'Culpa', 'Vergonha', 'Orgulho', 'Surpresa') NULL,
    `seeking` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `dreamer_profiles_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `people` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `relation` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `people_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `anamnesis_questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `prompt` VARCHAR(500) NOT NULL,
    `kind` ENUM('Text', 'Choice', 'Multi', 'YesNo') NOT NULL DEFAULT 'Text',
    `options` JSON NULL,
    `category` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `anamnesis_answers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `questionId` INTEGER NOT NULL,
    `answer` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `anamnesis_answers_userId_questionId_key`(`userId`, `questionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dreams` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `title` VARCHAR(191) NULL,
    `text` TEXT NOT NULL,
    `captureMode` ENUM('Texto', 'Voz') NOT NULL DEFAULT 'Texto',
    `eventToday` VARCHAR(500) NULL,
    `timeframe` ENUM('Passado', 'Presente', 'Futuro') NULL,
    `status` ENUM('Registrado', 'Decodificado') NOT NULL DEFAULT 'Registrado',
    `mainEmotion` ENUM('Alegria', 'Amor', 'Medo', 'Raiva', 'Tristeza', 'Confianca', 'Esperanca', 'Ansiedade', 'Culpa', 'Vergonha', 'Orgulho', 'Surpresa') NULL,
    `secondaryEmotion` ENUM('Alegria', 'Amor', 'Medo', 'Raiva', 'Tristeza', 'Confianca', 'Esperanca', 'Ansiedade', 'Culpa', 'Vergonha', 'Orgulho', 'Surpresa') NULL,
    `movement` VARCHAR(191) NULL,
    `dreamedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `dreams_userId_dreamedAt_idx`(`userId`, `dreamedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dream_elements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dreamId` INTEGER NOT NULL,
    `word` VARCHAR(191) NOT NULL,
    `type` ENUM('Substantivo', 'Verbo', 'Adjetivo', 'Pronome') NOT NULL DEFAULT 'Substantivo',
    `meaning` VARCHAR(191) NULL,
    `emotionKey` ENUM('Alegria', 'Amor', 'Medo', 'Raiva', 'Tristeza', 'Confianca', 'Esperanca', 'Ansiedade', 'Culpa', 'Vergonha', 'Orgulho', 'Surpresa') NULL,
    `fromDictionary` BOOLEAN NOT NULL DEFAULT false,
    `isPerson` BOOLEAN NOT NULL DEFAULT false,
    `relation` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `dream_elements_dreamId_idx`(`dreamId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dictionary_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `meaning` VARCHAR(191) NULL,
    `emotionKey` ENUM('Alegria', 'Amor', 'Medo', 'Raiva', 'Tristeza', 'Confianca', 'Esperanca', 'Ansiedade', 'Culpa', 'Vergonha', 'Orgulho', 'Surpresa') NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 1,
    `isPerson` BOOLEAN NOT NULL DEFAULT false,
    `relation` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `dictionary_entries_userId_idx`(`userId`),
    UNIQUE INDEX `dictionary_entries_userId_symbol_key`(`userId`, `symbol`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `insights` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dreamId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `mainEmotion` ENUM('Alegria', 'Amor', 'Medo', 'Raiva', 'Tristeza', 'Confianca', 'Esperanca', 'Ansiedade', 'Culpa', 'Vergonha', 'Orgulho', 'Surpresa') NOT NULL,
    `secondaryEmotion` ENUM('Alegria', 'Amor', 'Medo', 'Raiva', 'Tristeza', 'Confianca', 'Esperanca', 'Ansiedade', 'Culpa', 'Vergonha', 'Orgulho', 'Surpresa') NULL,
    `movement` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `aiModel` VARCHAR(191) NULL,
    `promptTokens` INTEGER NULL,
    `outputTokens` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `insights_dreamId_key`(`dreamId`),
    INDEX `insights_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `nps_responses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `score` INTEGER NOT NULL,
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `nps_responses_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_AdminPermissionToUser` (
    `A` INTEGER NOT NULL,
    `B` INTEGER NOT NULL,

    UNIQUE INDEX `_AdminPermissionToUser_AB_unique`(`A`, `B`),
    INDEX `_AdminPermissionToUser_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `files` ADD CONSTRAINT `files_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dreamer_profiles` ADD CONSTRAINT `dreamer_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `people` ADD CONSTRAINT `people_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anamnesis_answers` ADD CONSTRAINT `anamnesis_answers_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anamnesis_answers` ADD CONSTRAINT `anamnesis_answers_questionId_fkey` FOREIGN KEY (`questionId`) REFERENCES `anamnesis_questions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dreams` ADD CONSTRAINT `dreams_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dream_elements` ADD CONSTRAINT `dream_elements_dreamId_fkey` FOREIGN KEY (`dreamId`) REFERENCES `dreams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dictionary_entries` ADD CONSTRAINT `dictionary_entries_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `insights` ADD CONSTRAINT `insights_dreamId_fkey` FOREIGN KEY (`dreamId`) REFERENCES `dreams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `insights` ADD CONSTRAINT `insights_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nps_responses` ADD CONSTRAINT `nps_responses_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_AdminPermissionToUser` ADD CONSTRAINT `_AdminPermissionToUser_A_fkey` FOREIGN KEY (`A`) REFERENCES `admin_permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_AdminPermissionToUser` ADD CONSTRAINT `_AdminPermissionToUser_B_fkey` FOREIGN KEY (`B`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
