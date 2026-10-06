-- Planos como o cliente definiu em 05/10: Cobre virou Bronze e o Diamante saiu.
-- O domínio cresce ANTES da conversão: trocar o ENUM direto transformaria em ''
-- qualquer linha que ainda estivesse em Cobre ou Diamante.
ALTER TABLE `users` MODIFY `plan` ENUM('Gratuito', 'Cobre', 'Prata', 'Ouro', 'Diamante', 'Bronze') NOT NULL DEFAULT 'Gratuito';

UPDATE `users` SET `plan` = 'Bronze' WHERE `plan` = 'Cobre';
UPDATE `users` SET `plan` = 'Ouro' WHERE `plan` = 'Diamante';

ALTER TABLE `users` MODIFY `plan` ENUM('Gratuito', 'Bronze', 'Prata', 'Ouro') NOT NULL DEFAULT 'Gratuito';

-- AlterTable: 30 dias de teste grátis contados do cadastro. Quem já tem conta
-- recebe o prazo a partir da data em que se cadastrou.
ALTER TABLE `users` ADD COLUMN `trialEndsAt` DATETIME(3) NULL;

UPDATE `users` SET `trialEndsAt` = DATE_ADD(`createdAt`, INTERVAL 30 DAY);

-- CreateTable
CREATE TABLE `plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` ENUM('Gratuito', 'Bronze', 'Prata', 'Ouro') NOT NULL,
    `name` VARCHAR(40) NOT NULL,
    `priceCents` INTEGER NULL,
    `description` VARCHAR(190) NOT NULL,
    `ordering` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `plans_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plan_changes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `fromPlan` ENUM('Gratuito', 'Bronze', 'Prata', 'Ouro') NOT NULL,
    `toPlan` ENUM('Gratuito', 'Bronze', 'Prata', 'Ouro') NOT NULL,
    `status` ENUM('Ativo', 'PendentePagamento') NOT NULL DEFAULT 'Ativo',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `plan_changes_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `plan_changes` ADD CONSTRAINT `plan_changes_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- O catálogo é dado de referência, não semente de teste: entra com a migração
-- para que qualquer ambiente tenha os planos sem depender do `npm run seed`,
-- que se recusa a rodar com NODE_ENV=production.
-- Preço em centavos; NULL é o "a definir" do cliente.
INSERT INTO `plans` (`key`, `name`, `priceCents`, `description`, `ordering`, `active`, `updatedAt`) VALUES
  ('Gratuito', 'Gratuito', 0,    '30 dias para conhecer o app, com a decodificação completa.', 1, true, NOW(3)),
  ('Bronze',   'Bronze',   1000, 'Mantém o app depois dos 30 dias de teste.',                  2, true, NOW(3)),
  ('Prata',    'Prata',    NULL, 'Benefícios e preço a definir com o cliente.',                3, true, NOW(3)),
  ('Ouro',     'Ouro',     NULL, 'Benefícios e preço a definir com o cliente.',                4, true, NOW(3));
