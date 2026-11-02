import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { canManageKledo } from "@/lib/integration/access";

export async function requireKledoAdmin() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  const idRaw = (session?.user as { id?: string } | undefined)?.id;
  if (!session && process.env.NODE_ENV === "development") {
    return { ok: true as const, role: "Super Admin", userId: null as number | null };
  }
  if (!canManageKledo(role)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "Hanya Super Admin dan Finance yang dapat mengakses integrasi Kledo." },
        { status: 403 }
      ),
    };
  }
  return { ok: true as const, role: role || "", userId: idRaw ? Number(idRaw) : null };
}
