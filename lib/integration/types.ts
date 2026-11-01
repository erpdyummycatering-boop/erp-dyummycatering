export type KledoSettings = {
  sell_account_id?: number | null;
  unit_id?: number | null;
  tax_id?: number | null;
  pos_product_category_id?: number | null;
  shipping_product_id?: number | null;
  addl_menu_product_id?: number | null;
  shipping_mode?: "shipping_cost" | "product";
  due_days?: number;
  auto_create_contact?: boolean;
  auto_create_product?: boolean;
  invoice_trigger?: string;
};

export type IntegrationConfig = {
  id: number;
  tenantCode: string;
  environment: "demo" | "staging" | "production";
  kledoAccount: string | null;
  name: string;
  baseUrl: string;
  token: string;
  tokenLast4: string | null;
  tokenExpiresAt: string | null;
  settings: KledoSettings;
  isActive: boolean;
  syncEnabled: boolean;
  goLiveDate: string | null;
  lastTestedAt: string | null;
  lastTestOk: boolean | null;
  lastTestMessage: string | null;
  keyVersion: number;
};

export type PublicIntegrationConfig = Omit<IntegrationConfig, "token"> & {
  badge: "DEMO" | "LIVE";
};
