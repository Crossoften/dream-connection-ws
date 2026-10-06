-- AlterTable: o lembrete para contar o sonho, por usuário.
-- `reminderTime` é HH:mm no fuso do próprio usuário; `reminderSentOn` guarda o
-- dia do último envio (no fuso dele) e é o que impede mandar duas vezes.
ALTER TABLE `users`
  ADD COLUMN `reminderEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `reminderTime` VARCHAR(5) NULL,
  ADD COLUMN `reminderTimezone` VARCHAR(64) NULL,
  ADD COLUMN `reminderSentOn` VARCHAR(10) NULL;

-- CreateTable
CREATE TABLE `push_subscriptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `endpoint` VARCHAR(500) NOT NULL,
    `p256dh` VARCHAR(200) NOT NULL,
    `auth` VARCHAR(100) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `push_subscriptions_endpoint_key`(`endpoint`),
    INDEX `push_subscriptions_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
