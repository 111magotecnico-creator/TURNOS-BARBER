ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "paymentExpirationMin" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "depositPercent" INTEGER;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "preferenceId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "currency" TEXT;
CREATE INDEX IF NOT EXISTS "Payment_externalId_idx" ON "Payment"("externalId");
CREATE INDEX IF NOT EXISTS "Payment_preferenceId_idx" ON "Payment"("preferenceId");
