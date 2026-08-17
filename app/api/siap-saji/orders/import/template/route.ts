import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  const client = await pool.connect();
  try {
    // 1. Query Master Data
    const [productsRes, channelsRes, areasRes, bankRes] = await Promise.all([
      client.query("SELECT id, sku, name, is_half_portion, price FROM products WHERE lini = 'siap_saji' ORDER BY name ASC"),
      client.query("SELECT id, name, harga_type FROM channels ORDER BY name ASC"),
      client.query("SELECT id, kecamatan, kota, shipping_zone, default_shipping_fee FROM areas ORDER BY kecamatan ASC"),
      client.query("SELECT id, nama_rekening, no_rekening, nama_bank FROM kas_bank ORDER BY nama_rekening ASC"),
    ]);

    const products = productsRes.rows;
    const channels = channelsRes.rows;
    const areas = areasRes.rows;
    const banks = bankRes.rows;

    // Default sample references
    const sampleProd1 = products[0] ? `${products[0].id} | ${products[0].name}` : "421 | Beef Yakiniku";
    const sampleProd2 = products[1] ? `${products[1].id} | ${products[1].name}` : "422 | Ayam Goreng Terasi";
    const sampleChan = channels[0] ? `${channels[0].id} | ${channels[0].name}` : "1 | Gojek Offline";
    const sampleArea = areas[0] ? `${areas[0].id} | ${areas[0].kecamatan} (${areas[0].kota})` : "12 | Antapani (Kota Bandung)";
    const sampleBank = banks[0] ? `${banks[0].id} | ${banks[0].nama_rekening}` : "1 | BCA Cash";

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateSample = tomorrow.toISOString().split("T")[0];

    // ── SHEET 1: DATA_ORDER (Template Utama) ──
    const orderDataHeaders = [
      "Tanggal Delivery (YYYY-MM-DD)",
      "Nama Customer",
      "No HP / WA",
      "Area / Kecamatan ID",
      "Alamat Lengkap",
      "Patokan / Landmark",
      "Channel ID",
      "Rekening / Kas ID",
      "Biaya Kirim",
      "Diskon Order",
      "Produk ID / Item",
      "Harga Satuan",
      "Quantity",
      "Catatan Item",
    ];

    const orderDataRows = [
      orderDataHeaders,
      // Sample Order 1 - Item 1 (Customer Ibu Elly)
      [
        dateSample,
        "Ibu Elly Margahayu",
        "08111100004",
        sampleArea,
        "Jl Pluto I Blok C No 5 Kel Margasari",
        "Depan puskesmas gerbang putih",
        sampleChan,
        sampleBank,
        12000,
        0,
        sampleProd1,
        100000,
        2,
        "Porsi ekstra pedas",
      ],
      // Sample Order 1 - Item 2 (Customer Ibu Elly - Tanggal & HP sama = 1 Order yang sama)
      [
        dateSample,
        "Ibu Elly Margahayu",
        "08111100004",
        sampleArea,
        "Jl Pluto I Blok C No 5 Kel Margasari",
        "Depan puskesmas gerbang putih",
        sampleChan,
        sampleBank,
        12000,
        0,
        sampleProd2,
        35000,
        1,
        "Kuah dipisah",
      ],
      // Sample Order 2 - Customer Pak Budi (Baru)
      [
        dateSample,
        "Pak Budi Santoso",
        "08129988776",
        sampleArea,
        "Jl Buah Batu No 123",
        "Samping Indomaret Buah Batu",
        sampleChan,
        sampleBank,
        15000,
        5000,
        sampleProd1,
        100000,
        1,
        "Tanpa sambal",
      ],
    ];

    // ── SHEET 2: REF_PRODUK ──
    const refProductHeaders = ["ID", "SKU", "Nama Produk", "Porsi", "Harga Regular", "FORMAT UPLOAD (Copy-Paste Kolom Ini)"];
    const refProductRows = [
      refProductHeaders,
      ...products.map((p) => [
        p.id,
        p.sku,
        p.name,
        p.is_half_portion ? "½ Porsi" : "Full",
        Number(p.price),
        `${p.id} | ${p.name}`,
      ]),
    ];

    // ── SHEET 3: REF_CHANNEL ──
    const refChannelHeaders = ["ID", "Nama Channel", "Tipe Harga", "FORMAT UPLOAD (Copy-Paste Kolom Ini)"];
    const refChannelRows = [
      refChannelHeaders,
      ...channels.map((ch) => [
        ch.id,
        ch.name,
        ch.harga_type,
        `${ch.id} | ${ch.name}`,
      ]),
    ];

    // ── SHEET 4: REF_AREA_ONGKIR ──
    const refAreaHeaders = ["ID", "Kecamatan", "Kota", "Zone", "Default Ongkir", "FORMAT UPLOAD (Copy-Paste Kolom Ini)"];
    const refAreaRows = [
      refAreaHeaders,
      ...areas.map((a) => [
        a.id,
        a.kecamatan,
        a.kota,
        a.shipping_zone,
        Number(a.default_shipping_fee || 0),
        `${a.id} | ${a.kecamatan} (${a.kota})`,
      ]),
    ];

    // ── SHEET 5: REF_KAS_BANK ──
    const refBankHeaders = ["ID", "Nama Rekening", "No Rekening", "Bank", "FORMAT UPLOAD (Copy-Paste Kolom Ini)"];
    const refBankRows = [
      refBankHeaders,
      ...banks.map((b) => [
        b.id,
        b.nama_rekening,
        b.no_rekening,
        b.nama_bank,
        `${b.id} | ${b.nama_rekening}`,
      ]),
    ];

    // Create Workbook
    const wb = XLSX.utils.book_new();

    const wsDataOrder = XLSX.utils.aoa_to_sheet(orderDataRows);
    const wsRefProducts = XLSX.utils.aoa_to_sheet(refProductRows);
    const wsRefChannels = XLSX.utils.aoa_to_sheet(refChannelRows);
    const wsRefAreas = XLSX.utils.aoa_to_sheet(refAreaRows);
    const wsRefBanks = XLSX.utils.aoa_to_sheet(refBankRows);

    // Auto-fit column widths
    wsDataOrder["!cols"] = [
      { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 28 },
      { wch: 32 }, { wch: 30 }, { wch: 22 }, { wch: 22 },
      { wch: 14 }, { wch: 14 }, { wch: 32 }, { wch: 14 },
      { wch: 10 }, { wch: 25 }
    ];
    wsRefProducts["!cols"] = [{ wch: 8 }, { wch: 14 }, { wch: 30 }, { wch: 10 }, { wch: 14 }, { wch: 36 }];
    wsRefChannels["!cols"] = [{ wch: 8 }, { wch: 22 }, { wch: 14 }, { wch: 28 }];
    wsRefAreas["!cols"] = [{ wch: 8 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 34 }];
    wsRefBanks["!cols"] = [{ wch: 8 }, { wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 28 }];

    XLSX.utils.book_append_sheet(wb, wsDataOrder, "DATA_ORDER");
    XLSX.utils.book_append_sheet(wb, wsRefProducts, "REF_PRODUK");
    XLSX.utils.book_append_sheet(wb, wsRefChannels, "REF_CHANNEL");
    XLSX.utils.book_append_sheet(wb, wsRefAreas, "REF_AREA_ONGKIR");
    XLSX.utils.book_append_sheet(wb, wsRefBanks, "REF_KAS_BANK");

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="template_import_order_siap_saji.xlsx"',
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("Gagal generate template import excel:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
