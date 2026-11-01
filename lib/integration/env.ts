export type AppEnv = "production" | "preview" | "development";
export type ConfigEnvironment = "demo" | "staging" | "production";

export function resolveAppEnv(raw?: string): AppEnv {
  const value = (
    raw ??
    process.env.APP_ENV ??
    process.env.VERCEL_ENV ??
    process.env.NODE_ENV ??
    "development"
  ).toLowerCase();
  if (value === "production") return "production";
  if (value === "preview" || value === "staging") return "preview";
  return "development";
}

export function currentAppEnv(): AppEnv {
  return resolveAppEnv();
}

export function allowedConfigEnvironments(appEnv: AppEnv = currentAppEnv()): ConfigEnvironment[] {
  return appEnv === "production" ? ["production"] : ["demo", "staging"];
}

export function configAllowed(environment: string, appEnv: AppEnv = currentAppEnv()): boolean {
  return allowedConfigEnvironments(appEnv).includes(environment as ConfigEnvironment);
}

export function envGuardMessage(environment: string, appEnv: AppEnv = currentAppEnv()): string | null {
  if (configAllowed(environment, appEnv)) return null;
  return `Guard APP_ENV: deployment ${appEnv} menolak konfigurasi environment=${environment}.`;
}

export function kledoBadge(environment: string): "DEMO" | "LIVE" {
  return environment === "production" ? "LIVE" : "DEMO";
}

const KLEDO_BASE = /^https:\/\/([a-z0-9-]+)\.api\.kledo\.id\/api\/v1$/i;

export function normalizeKledoBaseUrl(input: string): string {
  return String(input || "").trim().replace(/\/+$/, "");
}

export function kledoAccountFromUrl(input: string): string | null {
  const match = normalizeKledoBaseUrl(input).match(KLEDO_BASE);
  return match ? match[1].toLowerCase() : null;
}

export function isValidKledoBaseUrl(input: string): boolean {
  return kledoAccountFromUrl(input) !== null;
}
