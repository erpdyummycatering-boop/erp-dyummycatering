import { NextResponse } from "next/server";
import { requireKledoAdmin } from "@/lib/integration/http";
import { enqueueManual } from "@/lib/integration/orderHooks";
import { publishSyncJobs } from "@/lib/qstash";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireKledoAdmin();
  if (!admin.ok) return admin.response;
  const { id } = await params;
  const jobId = await enqueueManual({ orderId: Number(id), userId: admin.userId, action: "sync" });
  if (!jobId) {
    return NextResponse.json({ error: "Tidak ada antrian baru. Sync harus aktif, order harus catering, dan dokumen yang sudah sukses tidak dibuat ulang." }, { status: 400 });
  }
  await publishSyncJobs([jobId], 1);
  return NextResponse.json({ ok: true, jobId });
}
