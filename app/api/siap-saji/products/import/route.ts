import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

interface ChannelPriceItem {
  channel_id: number;
  harga_override: number | null;
}

interface ProductImportItem {
  sku?: string;
  name: string;
  category_id?: number | null;
  category_name?: string | null;
  description?: string;
  price: number;
  is_half_portion?: boolean;
  parent_sku?: string | null;
  channel_prices?: ChannelPriceItem[];
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const productsInput: ProductImportItem[] = body.products || [];

  if (!Array.isArray(productsInput) || productsInput.length === 0) {
    return NextResponse.json({ error: "Tidak ada data produk yang diunggah." }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Fetch categories lookup for mapping category_name if category_id is null
    const categoriesRes = await client.query("SELECT id, LOWER(name) AS name_lower FROM product_categories");
    const categoryMapByName = new Map<string, number>();
    categoriesRes.rows.forEach((row) => {
      categoryMapByName.set(row.name_lower.trim(), Number(row.id));
    });

    // Fetch channels lookup
    const channelsRes = await client.query("SELECT id FROM channels WHERE lini = 'siap_saji' AND is_active = true");
    const validChannelIds = new Set<number>(channelsRes.rows.map((r) => Number(r.id)));

    // Determine starting number for SKU auto generation
    const skuRes = await client.query(
      `SELECT sku FROM products 
       WHERE lini = 'siap_saji' AND is_half_portion = false 
       ORDER BY id DESC LIMIT 100`
    );

    let maxNum = 0;
    let defaultPrefix = "SP-A";

    for (const row of skuRes.rows) {
      const skuVal = (row.sku || "").trim();
      const match = skuVal.match(/^([A-Za-z]+-?[A-Za-z]*)(\d+)$/);
      if (match) {
        defaultPrefix = match[1];
        const numVal = parseInt(match[2], 10);
        if (numVal > maxNum) {
          maxNum = numVal;
        }
      }
    }

    const insertedProducts = [];

    for (const item of productsInput) {
      if (!item.name || item.name.trim() === "") {
        throw new Error("Terdapat baris produk tanpa Nama Produk.");
      }

      let categoryId: number | null = item.category_id ? Number(item.category_id) : null;
      if (!categoryId && item.category_name) {
        const catNameLower = item.category_name.trim().toLowerCase();
        if (categoryMapByName.has(catNameLower)) {
          categoryId = categoryMapByName.get(catNameLower)!;
        }
      }

      let finalSku = (item.sku || "").trim();
      const isHalf = Boolean(item.is_half_portion);
      const parentSku = item.parent_sku ? item.parent_sku.trim() : null;

      // Auto SKU generation if SKU is blank or AUTO
      if (!finalSku || finalSku.toUpperCase() === "AUTO") {
        if (isHalf) {
          if (parentSku) {
            finalSku = `${parentSku}H`;
          } else {
            maxNum++;
            const numStr = String(maxNum).padStart(2, "0");
            finalSku = `${defaultPrefix}${numStr}H`;
          }
        } else {
          maxNum++;
          const numStr = String(maxNum).padStart(2, "0");
          finalSku = `${defaultPrefix}${numStr}`;
        }
      }

      // Check if SKU exists; if exists, update or fail. We do upsert by SKU.
      const checkSku = await client.query("SELECT id FROM products WHERE sku = $1", [finalSku]);
      let prodId: number;

      if (checkSku.rows.length > 0) {
        prodId = checkSku.rows[0].id;
        await client.query(
          `UPDATE products 
           SET name = $1, category_id = $2, description = $3, price = $4, 
               is_half_portion = $5, parent_sku = $6, updated_at = NOW()
           WHERE id = $7`,
          [
            item.name.trim(),
            categoryId,
            item.description || null,
            Number(item.price || 0),
            isHalf,
            parentSku,
            prodId,
          ]
        );
      } else {
        const insRes = await client.query(
          `INSERT INTO products (sku, name, category_id, description, price, lini, status, is_half_portion, parent_sku)
           VALUES ($1, $2, $3, $4, $5, 'siap_saji', 'Aktif', $6, $7)
           RETURNING id`,
          [
            finalSku,
            item.name.trim(),
            categoryId,
            item.description || null,
            Number(item.price || 0),
            isHalf,
            parentSku,
          ]
        );
        prodId = insRes.rows[0].id;
      }

      // Process channel prices
      if (Array.isArray(item.channel_prices)) {
        for (const cp of item.channel_prices) {
          if (validChannelIds.has(Number(cp.channel_id))) {
            const overrideVal = cp.harga_override !== null && cp.harga_override !== undefined && !isNaN(Number(cp.harga_override))
              ? Number(cp.harga_override)
              : null;

            await client.query(
              `INSERT INTO product_channels (product_id, channel_id, harga_override, is_active)
               VALUES ($1, $2, $3, true)
               ON CONFLICT (product_id, channel_id)
               DO UPDATE SET harga_override = EXCLUDED.harga_override, is_active = true`,
              [prodId, Number(cp.channel_id), overrideVal]
            );
          }
        }
      }

      insertedProducts.push({
        id: prodId,
        sku: finalSku,
        name: item.name,
      });
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      count: insertedProducts.length,
      imported: insertedProducts,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Gagal melakukan batch import produk:", error);
    return NextResponse.json({ error: error.message || "Gagal mengimpor produk." }, { status: 500 });
  } finally {
    client.release();
  }
}
