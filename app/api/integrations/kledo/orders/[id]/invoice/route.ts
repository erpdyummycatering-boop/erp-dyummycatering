import { NextResponse } from "next/server";
import { jakartaToday, toDateOnly } from "@/lib/integration/dates";
import { requireKledoAdmin } from "@/lib/integration/http";
import { enqueueManual } from "@/lib/integration/orderHooks";
import { publishSyncJobs } from "@/lib/qstash";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireKledoAdmin();
  if (!admin.ok) return admin.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const mode = body?.trans_date === "today" ? "today" : "delivery";
  const invoiceDate = mode === "today" ? jakartaToday() : null;
  if (invoiceDate && !toDateOnly(invoiceDate)) {
    return NextResponse.json({ error: "Tanggal invoice tidak valid" }, { status: 400 });
  }
  const jobId = await enqueueManual({
    orderId: Number(id),
    userId: admin.userId,
    action: "invoice",
    invoiceDate,
  });
  if (!jobId) {
    return NextResponse.json({ error: "Tidak ada antrian baru. Sync harus aktif, order harus catering, dan invoice yang sudah terbit tidak dibuat ulang." }, { status: 400 });
  }
  await publishSyncJobs([jobId], 1);
  return NextResponse.json({ ok: true, jobId, trans_date: invoiceDate || "delivery_date" });
}
