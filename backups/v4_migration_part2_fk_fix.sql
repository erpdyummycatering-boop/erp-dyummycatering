-- ----------------------------------------------------------------
-- BAGIAN 5: FOREIGN KEYS (fixed — PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS)
-- ----------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_customers_area') THEN
        ALTER TABLE "public"."customers" ADD CONSTRAINT fk_customers_area
            FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_channel') THEN
        ALTER TABLE "public"."orders" ADD CONSTRAINT fk_orders_channel
            FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_cancelled_by') THEN
        ALTER TABLE "public"."orders" ADD CONSTRAINT fk_orders_cancelled_by
            FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orders_journal') THEN
        ALTER TABLE "public"."orders" ADD CONSTRAINT fk_orders_journal
            FOREIGN KEY ("journal_id") REFERENCES "public"."journals"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pc_product') THEN
        ALTER TABLE "public"."product_channels" ADD CONSTRAINT fk_pc_product
            FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pc_channel') THEN
        ALTER TABLE "public"."product_channels" ADD CONSTRAINT fk_pc_channel
            FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_acs_area') THEN
        ALTER TABLE "public"."area_channel_shipping" ADD CONSTRAINT fk_acs_area
            FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_acs_channel') THEN
        ALTER TABLE "public"."area_channel_shipping" ADD CONSTRAINT fk_acs_channel
            FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_journals_debit') THEN
        ALTER TABLE "public"."journals" ADD CONSTRAINT fk_journals_debit
            FOREIGN KEY ("akun_debit") REFERENCES "public"."coa"("id") ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_journals_kredit') THEN
        ALTER TABLE "public"."journals" ADD CONSTRAINT fk_journals_kredit
            FOREIGN KEY ("akun_kredit") REFERENCES "public"."coa"("id") ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_kas_mutasi_bank') THEN
        ALTER TABLE "public"."kas_mutasi" ADD CONSTRAINT fk_kas_mutasi_bank
            FOREIGN KEY ("kas_bank_id") REFERENCES "public"."kas_bank"("id") ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_purchases_coa') THEN
        ALTER TABLE "public"."purchases" ADD CONSTRAINT fk_purchases_coa
            FOREIGN KEY ("coa_id") REFERENCES "public"."coa"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_purchases_kas') THEN
        ALTER TABLE "public"."purchases" ADD CONSTRAINT fk_purchases_kas
            FOREIGN KEY ("kas_bank_id") REFERENCES "public"."kas_bank"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_purchases_finance') THEN
        ALTER TABLE "public"."purchases" ADD CONSTRAINT fk_purchases_finance
            FOREIGN KEY ("finance_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_purchases_po') THEN
        ALTER TABLE "public"."purchases" ADD CONSTRAINT fk_purchases_po
            FOREIGN KEY ("catering_po_id") REFERENCES "public"."purchase_orders"("id") ON DELETE SET NULL;
    END IF;
END $$;
