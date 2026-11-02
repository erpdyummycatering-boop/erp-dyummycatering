import { Client } from "@upstash/qstash";

const appEnv = (process.env.APP_ENV || "demo").toLowerCase();
const base = (process.env.APP_BASE_URL || "").replace(/\/$/, "");
const token = process.env.QSTASH_TOKEN || "";
const production = appEnv === "production";
const suffix = production ? "production" : "demo";
const workerCron = production ? "*/5 * * * *" : "*/15 * * * *";
const invoiceCron = "0 23 * * *";

async function upsert(client: Client, scheduleId: string, destination: string, cron: string, body: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers["Upstash-Forward-x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }
  const request = {
    destination,
    cron,
    scheduleId,
    body: JSON.stringify(body),
    headers,
    retries: 3,
    timeout: 60,
    label: "kledo",
  };
  try {
    const result = await client.schedules.create(request);
    console.log(`Schedule ${result.scheduleId} (${cron}) -> ${destination}`);
  } catch (error) {
    await client.schedules.delete(scheduleId).catch(() => undefined);
    const result = await client.schedules.create(request);
    console.log(`Schedule ${result.scheduleId} dibuat ulang setelah hapus (${cron})`);
    if (error instanceof Error) console.log(`Alasan percobaan pertama: ${error.message}`);
  }
}

async function main() {
  if (!token) {
    console.error("QSTASH_TOKEN belum diisi.");
    process.exit(1);
  }
  if (!base) {
    console.error("APP_BASE_URL belum diisi.");
    process.exit(1);
  }
  const client = new Client({ token, baseUrl: process.env.QSTASH_URL || undefined });
  await upsert(client, `kledo-sync-${suffix}`, `${base}/api/qstash/kledo-sync`, workerCron, { mode: "batch" });
  await upsert(client, `kledo-invoice-due-${suffix}`, `${base}/api/qstash/kledo-invoice-due`, invoiceCron, { source: "schedule" });
  console.log(`Selesai untuk suffix '${suffix}'. Worker: ${workerCron}. Invoice 06:00 WIB: ${invoiceCron} UTC.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
