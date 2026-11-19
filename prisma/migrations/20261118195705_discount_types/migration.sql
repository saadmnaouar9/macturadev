-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "globalDiscountAmount" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "globalDiscountType" "DiscountType" NOT NULL DEFAULT 'PERCENT';

-- AlterTable
ALTER TABLE "InvoiceItem" ADD COLUMN     "discountAmount" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENT';

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "globalDiscountAmount" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "globalDiscountType" "DiscountType" NOT NULL DEFAULT 'PERCENT';

-- AlterTable
ALTER TABLE "QuoteItem" ADD COLUMN     "discountAmount" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENT';
