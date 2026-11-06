"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, FormField, FormRow } from "@/components/ui/PageHeader";

type Lookup = { id: number; name: string; code?: string | null };
type Job = {
  id: number; entity_type: string; local_id: number; action: string; status: string;
  attempts: number; max_attempts: number; last_error: string | null; blocked_reason: string | null;
  triggered_by: string | null; created_at: string;
};

const emptySettings = {
  sell_account_id: "", unit_id: "", tax_id: "", pos_product_category_id: "",
  shipping_product_id: "", addl_menu_product_id: "", shipping_mode: "shipping_cost",
  due_days: 0, auto_create_contact: true, auto_create_product: true,
};

export default function KledoSettingsPage() {
  const [tab, setTab] = useState<"config" | "monitor">("config");
  const [state, setState] = useState<any>(null);
  const [form, setForm] = useState<any>({
    name: "Kledo Catering", environment: "demo", base_url: "",
    token: "", token_expires_at: "", go_live_date: "", is_active: false, sync_enabled: false, settings: emptySettings,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lookupSearch, setLookupSearch] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lookups, setLookups] = useState<Record<string, Lookup[]>>({});
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobStatus, setJobStatus] = useState("");
  const [logs, setLogs] = useState<any[] | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/integrations/kledo");
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Gagal memuat"); return; }
    setState(data);
    if (data.config) {
      const s = data.config.settings || {};
      setForm((f: any) => ({
        ...f,
        name: data.config.name,
        environment: data.config.environment,
        base_url: data.config.baseUrl,
        token: "",
        token_expires_at: data.config.tokenExpiresAt ? String(data.config.tokenExpiresAt).slice(0, 10) : "",
        go_live_date: data.config.goLiveDate || "",
        is_active: data.config.isActive,
        sync_enabled: data.config.syncEnabled,
        settings: {
          ...emptySettings,
          ...s,
          sell_account_id: s.sell_account_id ?? "",
          unit_id: s.unit_id ?? "",
          tax_id: s.tax_id ?? "",
          pos_product_category_id: s.pos_product_category_id ?? "",
          shipping_product_id: s.shipping_product_id ?? "",
          addl_menu_product_id: s.addl_menu_product_id ?? "",
        },
      }));
    }
  }, []);

  const loadJobs = useCallback(async () => {
    const res = await fetch(`/api/integrations/kledo/jobs?status=${encodeURIComponent(jobStatus)}`);
    const data = await res.json();
    if (res.ok) setJobs(data.data || []);
  }, [jobStatus]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "monitor") loadJobs(); }, [tab, loadJobs]);

  const settingsPayload = () => {
    const settings = form.settings;
    return {
      sell_account_id: num(settings.sell_account_id),
      unit_id: num(settings.unit_id),
      tax_id: num(settings.tax_id),
      pos_product_category_id: num(settings.pos_product_category_id),
      shipping_product_id: num(settings.shipping_product_id),
      addl_menu_product_id: num(settings.addl_menu_product_id),
      shipping_mode: settings.shipping_mode,
      due_days: Number(settings.due_days || 0),
      auto_create_contact: Boolean(settings.auto_create_contact),
      auto_create_product: Boolean(settings.auto_create_product),
    };
  };
  const num = (value: string) => value === "" || value == null ? null : Number(value);
  const save = async () => {
    setError(""); setMessage("");
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/kledo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          environment: form.environment,
          base_url: form.base_url,
          token: form.token || undefined,
          token_expires_at: form.token_expires_at || null,
          go_live_date: form.go_live_date || null,
          is_active: form.is_active,
          sync_enabled: form.sync_enabled,
          settings: settingsPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Gagal menyimpan");
      else {
        if (data.warning) setError(data.warning);
        setMessage(data.message || "Konfigurasi tersimpan. Token tidak ditampilkan kembali.");
        setForm((f: any) => ({ ...f, token: "" }));
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setError(""); setMessage("");
    setTesting(true);
    try {
      const res = await fetch("/api/integrations/kledo/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          environment: form.environment,
          base_url: form.base_url,
          token: form.token || undefined,
          settings: settingsPayload(),
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.message || data.error || "Test gagal");
      else setMessage(data.message || "Koneksi berhasil");
      if (!form.token) await load();
    } finally {
      setTesting(false);
    }
  };

  const loadLookup = async (resource: string) => {
    const res = await fetch("/api/integrations/kledo/lookups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource,
        search: lookupSearch[resource] || "",
        base_url: form.base_url,
        token: form.token || undefined,
        environment: form.environment,
        settings: settingsPayload(),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || "Gagal memuat referensi"); return; }
    setLookups((prev) => ({ ...prev, [resource]: data.data || [] }));
    setMessage(`${resource}: ${data.data?.length || 0} data dimuat dari seluruh halaman.`);
  };

  const account = accountFromUrl(form.base_url);

  const badge = state?.config?.badge || (form.environment === "production" ? "LIVE" : "DEMO");
  const expires = state?.config?.tokenExpiresAt ? new Date(state.config.tokenExpiresAt) : null;
  const expiring = expires && now ? expires.getTime() - now < 14 * 86400000 : false;

  return (
    <div>
      <PageHeader title="Integrasi Kledo" subtitle="Sales order dan invoice untuk order catering. Siap-saji tidak ikut." actions={
        <span style={{ background: badge === "LIVE" ? "#E24B4A" : "#BA7517", color: "white", borderRadius: 999, padding: "6px 14px", fontWeight: 700 }}>{badge}</span>
      } />
      {state && !state.schemaReady && <Banner color="#FAEEDA" text="Tabel integrasi belum ada. Terapkan refs/kledo_integration.sql di Neon staging. Sampai itu, sinkronisasi tetap mati dan order catering berjalan normal." />}
      {state && !state.encryptionReady && <Banner color="#FCEBEB" text="INTEGRATION_ENC_KEY belum di-set di environment ini. Token tidak bisa disimpan." />}
      {state?.guardMessage && <Banner color="#FCEBEB" text={state.guardMessage} />}
      {expiring && <Banner color="#FAEEDA" text="Token Kledo akan kedaluwarsa dalam 14 hari. Ganti token lalu jalankan Test koneksi." />}
      {error && <Banner color="#FCEBEB" text={error} />}
      {message && <Banner color="#EAF3DE" text={message} />}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className={`btn ${tab === "config" ? "btn-primary" : "btn-secondary"} btn-sm`} onClick={() => setTab("config")}>Konfigurasi</button>
        <button className={`btn ${tab === "monitor" ? "btn-primary" : "btn-secondary"} btn-sm`} onClick={() => setTab("monitor")}>Monitor Sync</button>
      </div>

      {tab === "config" && (
        <div className="erp-card">
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 0 }}>
            Environment aplikasi: <b>{state?.appEnv || "-"}</b>. Config yang boleh dipakai: {(state?.allowedEnvironments || []).join(", ") || "-"}.
            {state?.config?.tokenLast4 ? ` Token tersimpan ••••${state.config.tokenLast4}.` : " Token belum tersimpan."}
            {state?.config?.lastTestMessage ? ` Test terakhir: ${state.config.lastTestMessage}` : ""}
          </p>
          <FormField label="Nama" style={{ marginBottom: 14 }}>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </FormField>
          <FormRow>
            <FormField label="Subdomain perusahaan Kledo">
              <input
                value={account}
                onChange={(e) => {
                  const sub = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                  setForm({ ...form, base_url: sub ? `https://${sub}.api.kledo.id/api/v1` : "" });
                }}
                placeholder="namaperusahaan"
              />
            </FormField>
            <FormField label="Environment">
              <select value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}>
                {(state?.allowedEnvironments || ["demo", "staging"]).map((env: string) => <option key={env} value={env}>{env}</option>)}
              </select>
            </FormField>
          </FormRow>
          <FormField label="Base URL" style={{ marginBottom: 14 }}>
            <input value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://namaperusahaan.api.kledo.id/api/v1" />
          </FormField>
          <FormRow>
            <FormField label="Token (kosongkan jika tidak diganti)">
              <input type="password" value={form.token} autoComplete="new-password" onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder="kledo_pat_..." />
            </FormField>
            <FormField label="Token kedaluwarsa">
              <input type="date" value={form.token_expires_at} onChange={(e) => setForm({ ...form, token_expires_at: e.target.value })} />
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Go live (kirim >= tanggal ini)">
              <input type="date" value={form.go_live_date} onChange={(e) => setForm({ ...form, go_live_date: e.target.value })} />
            </FormField>
            <FormField label="Jatuh tempo (hari)">
              <input type="number" min={0} value={form.settings.due_days} onChange={(e) => setForm({ ...form, settings: { ...form.settings, due_days: e.target.value } })} />
            </FormField>
          </FormRow>
          <FormField label="Ongkir" style={{ marginBottom: 14 }}>
            <select value={form.settings.shipping_mode} onChange={(e) => setForm({ ...form, settings: { ...form.settings, shipping_mode: e.target.value } })}>
              <option value="shipping_cost">Field shipping_cost</option>
              <option value="product">Produk Ongkos Kirim</option>
            </select>
          </FormField>
          <FormField label="Cari akun / satuan / pajak / kategori" style={{ marginBottom: 8 }}>
            <input
              value={lookupSearch.accounts || ""}
              onChange={(e) => setLookupSearch((s) => ({ ...s, accounts: e.target.value, units: e.target.value, taxes: e.target.value, categories: e.target.value, products: e.target.value }))}
              placeholder="mis. 4-400 atau Pendapatan"
            />
          </FormField>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {["accounts", "units", "taxes", "categories", "products"].map((resource) => (
              <button key={resource} className="btn btn-secondary btn-sm" type="button" onClick={() => loadLookup(resource)}>Muat semua {resource}</button>
            ))}
          </div>
          <FormRow>
            <IdField label={state?.sellAccountLabel ? `Akun penjualan (${state.sellAccountLabel})` : "Akun penjualan"} value={form.settings.sell_account_id} options={lookups.accounts} onChange={(v) => setForm({ ...form, settings: { ...form.settings, sell_account_id: v } })} />
            <IdField label="Satuan" value={form.settings.unit_id} options={lookups.units} onChange={(v) => setForm({ ...form, settings: { ...form.settings, unit_id: v } })} />
          </FormRow>
          <FormRow>
            <IdField label="Kategori produk" value={form.settings.pos_product_category_id} options={lookups.categories} onChange={(v) => setForm({ ...form, settings: { ...form.settings, pos_product_category_id: v } })} />
            <IdField label="Pajak (opsional)" value={form.settings.tax_id} options={lookups.taxes} onChange={(v) => setForm({ ...form, settings: { ...form.settings, tax_id: v } })} />
          </FormRow>
          <FormRow>
            <IdField label="Produk ongkir" value={form.settings.shipping_product_id} options={lookups.products} onChange={(v) => setForm({ ...form, settings: { ...form.settings, shipping_product_id: v } })} />
            <IdField label="Produk menu tambahan" value={form.settings.addl_menu_product_id} options={lookups.products} onChange={(v) => setForm({ ...form, settings: { ...form.settings, addl_menu_product_id: v } })} />
          </FormRow>
          <label style={{ display: "flex", gap: 8, marginBottom: 8 }}><input type="checkbox" checked={!!form.settings.auto_create_contact} onChange={(e) => setForm({ ...form, settings: { ...form.settings, auto_create_contact: e.target.checked } })} /> Buat kontak otomatis</label>
          <label style={{ display: "flex", gap: 8, marginBottom: 8 }}><input type="checkbox" checked={!!form.settings.auto_create_product} onChange={(e) => setForm({ ...form, settings: { ...form.settings, auto_create_product: e.target.checked } })} /> Buat produk otomatis</label>
          <label style={{ display: "flex", gap: 8, marginBottom: 8 }}><input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Config aktif</label>
          <label style={{ display: "flex", gap: 8, marginBottom: 14 }}><input type="checkbox" checked={!!form.sync_enabled} onChange={(e) => setForm({ ...form, sync_enabled: e.target.checked })} /> Sync aktif</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={test} disabled={testing || saving}>{testing ? "Menguji..." : "Test koneksi"}</button>
            <button className="btn btn-primary" onClick={save} disabled={saving || testing}>{saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
          <p style={{ fontSize: 12, color: "#6b7280" }}>Test koneksi memakai isian form ini, tanpa menyimpan, dan tidak membuat SO atau invoice. Jika Base URL atau token berubah, Simpan menguji ulang dan mempertahankan Config aktif serta Sync aktif hanya bila tes berhasil.</p>
        </div>
      )}

      {tab === "monitor" && (
        <div className="erp-card">
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <select value={jobStatus} onChange={(e) => setJobStatus(e.target.value)}>
              <option value="">Semua status</option>
              {["pending", "processing", "success", "failed", "blocked", "dead", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={loadJobs}>Muat</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead><tr><th>ID</th><th>Aksi</th><th>Order</th><th>Status</th><th>Percobaan</th><th>Error</th><th></th></tr></thead>
              <tbody>
                {jobs.length === 0 && <tr><td colSpan={7} style={{ padding: 16, color: "#6b7280" }}>Tidak ada job</td></tr>}
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td>{job.id}</td>
                    <td>{job.entity_type}:{job.action}</td>
                    <td>{job.local_id}</td>
                    <td>{job.status}{job.blocked_reason ? ` (${job.blocked_reason})` : ""}</td>
                    <td>{job.attempts}/{job.max_attempts}</td>
                    <td style={{ maxWidth: 280 }}>{job.last_error || "-"}</td>
                    <td style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-secondary btn-sm" onClick={async () => { const r = await fetch(`/api/integrations/kledo/jobs/${job.id}`); const d = await r.json(); setLogs(d.logs || []); }}>Log</button>
                      <button className="btn btn-secondary btn-sm" onClick={async () => { await fetch(`/api/integrations/kledo/jobs/${job.id}/retry`, { method: "POST" }); loadJobs(); }}>Ulang</button>
                      <button className="btn btn-secondary btn-sm" onClick={async () => { await fetch(`/api/integrations/kledo/jobs/${job.id}/cancel`, { method: "POST" }); loadJobs(); }}>Batal</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {logs && (
            <pre style={{ marginTop: 12, background: "#f8fafc", padding: 12, borderRadius: 8, fontSize: 12, overflow: "auto", maxHeight: 320 }}>{JSON.stringify(logs, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function Banner({ color, text }: { color: string; text: string }) {
  return <div style={{ background: color, borderRadius: 8, padding: "10px 12px", marginBottom: 10, fontSize: 14 }}>{text}</div>;
}

function accountFromUrl(url: string): string {
  const match = String(url || "").trim().replace(/\/+$/, "").match(/^https:\/\/([a-z0-9-]+)\.api\.kledo\.id\/api\/v1$/i);
  return match ? match[1].toLowerCase() : "";
}

function IdField({ label, value, options, onChange }: { label: string; value: string | number; options?: Lookup[]; onChange: (value: string) => void }) {
  const current = value === null || value === undefined ? "" : String(value);
  return (
    <FormField label={label}>
      {options && options.length > 0 && (
        <select value={options.some((opt) => String(opt.id) === current) ? current : ""} onChange={(e) => onChange(e.target.value)} style={{ marginBottom: 6 }}>
          <option value="">— pilih dari daftar —</option>
          {options.map((opt) => <option key={opt.id} value={opt.id}>{opt.code ? `${opt.code} — ` : ""}{opt.name}</option>)}
        </select>
      )}
      <input value={current} onChange={(e) => onChange(e.target.value)} placeholder="atau ketik ID" />
    </FormField>
  );
}
