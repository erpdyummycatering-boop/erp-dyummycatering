const KLEDO_ROLES = new Set(["Super Admin", "Finance", "Finance / Keuangan"]);

export function canManageKledo(role: string | null | undefined): boolean {
  return !!role && KLEDO_ROLES.has(role);
}
