-- Sépare le cycle de vie de la facture (DRAFT/ISSUED/SENT/CANCELLED)
-- de sa situation de règlement (UNPAID/PARTIAL/PAID), avec conversion des données existantes.

CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');
ALTER TABLE "Invoice" ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID';

-- 1) Situation de règlement dérivée des montants
UPDATE "Invoice" SET "paymentStatus" = CASE
  WHEN "total" > 0 AND "amountPaid" >= "total" THEN 'PAID'::"PaymentStatus"
  WHEN "amountPaid" > 0 THEN 'PARTIAL'::"PaymentStatus"
  ELSE 'UNPAID'::"PaymentStatus"
END;

-- 2) Cycle de vie : UNPAID → ISSUED ; PARTIAL/PAID → SENT si envoyée, sinon ISSUED
CREATE TYPE "InvoiceStatus_new" AS ENUM ('DRAFT', 'ISSUED', 'SENT', 'CANCELLED');
ALTER TABLE "Invoice" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Invoice" ALTER COLUMN "status" TYPE "InvoiceStatus_new" USING (
  CASE "status"::text
    WHEN 'DRAFT' THEN 'DRAFT'
    WHEN 'CANCELLED' THEN 'CANCELLED'
    WHEN 'SENT' THEN 'SENT'
    WHEN 'UNPAID' THEN 'ISSUED'
    ELSE CASE WHEN "sentAt" IS NOT NULL THEN 'SENT' ELSE 'ISSUED' END
  END
)::"InvoiceStatus_new";
ALTER TYPE "InvoiceStatus" RENAME TO "InvoiceStatus_old";
ALTER TYPE "InvoiceStatus_new" RENAME TO "InvoiceStatus";
DROP TYPE "InvoiceStatus_old";
ALTER TABLE "Invoice" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

CREATE INDEX "Invoice_companyId_paymentStatus_idx" ON "Invoice"("companyId", "paymentStatus");

-- Paiements : idempotence et annulation (jamais de suppression physique)
ALTER TABLE "Payment" ADD COLUMN "createdById" TEXT,
ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "voidReason" TEXT,
ADD COLUMN "voidedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
