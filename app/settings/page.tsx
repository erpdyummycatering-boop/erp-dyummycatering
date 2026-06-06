"use client";

import { useEffect, useState } from "react";
import { Plus, Edit2, Lock, UserPlus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PageHeader, FormRow, FormField } from "@/components/ui/PageHeader";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { statusBadgeColor, roleColor } from "@/lib/utils";

const C = { primary: "#5005A6" };

const EMPTY_FORM = { name: "", email: "", role: "CS / Sales", status: "Aktif", password: "" };

export default function SettingsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [itemToDelete, setItemToDelete] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchUsers = () =>
    fetch("/api/users").then((r) => r.json()).then(setUsers);

  useEffect(() => { fetchUsers(); }, []);

  const openAdd = () => { setEditItem(null); setForm(EMPTY_FORM); setShowModal(true); };
  const openEdit = (u: any) => {
    setEditItem(u);
    setForm({ name: u.name, email: u.email, role: u.role, status: u.status, password: "" });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email || !form.role) return alert("Nama, email, role wajib diisi");
    const url = editItem ? `/api/users/${editItem.id}` : "/api/users";
    const method = editItem ? "PUT" : "POST";
    const body = editItem ? { name: form.name, email: form.email, role: form.role, status: form.status } : form;
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) { setShowModal(false); fetchUsers(); }
    else { const d = await res.json(); alert(d.error || "Gagal simpan"); }
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    await fetch(`/api/users/${itemToDelete.id}`, { method: "DELETE" });
    setItemToDelete(null);
    fetchUsers();
  };

  return (
    <div>
      <PageHeader
        title="Manajemen Pengguna"
        subtitle="Kelola akun & role semua pengguna sistem"
        actions={
          <button className="btn btn-primary" onClick={openAdd}><UserPlus size={14} /> Tambah User</button>
        }
      />

      <div className="erp-card-flush">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th>Bergabung</th><th>Aksi</th></tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "#6b7280" }}>Memuat data...</td></tr>
              ) : users.map((u: any) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: C.primary + "20",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: C.primary,
                      }}>
                        {u.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <p style={{ fontWeight: 500 }}>{u.name}</p>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, fontFamily: "monospace" }}>{u.email}</td>
                  <td><Badge color={roleColor(u.role)}>{u.role}</Badge></td>
                  <td><Badge color={statusBadgeColor(u.status)}>{u.status}</Badge></td>
                  <td style={{ fontSize: 12, color: "#6b7280" }}>{u.created_at?.slice(0, 10)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}><Edit2 size={11} /></button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setItemToDelete(u)} title="Hapus">
                        <Trash2 size={11} color="#E24B4A" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal show={showModal} onClose={() => setShowModal(false)} title={editItem ? "Edit User" : "Tambah User Baru"}>
        <FormRow>
          <FormField label="Nama Lengkap"><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Nama pengguna" /></FormField>
          <FormField label="Email"><input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="email@catering.com" /></FormField>
        </FormRow>
        <FormRow>
          <FormField label="Role">
            <SearchableSelect 
              value={form.role} onChange={v => setForm((f) => ({ ...f, role: v }))}
              options={["CS / Sales", "Kitchen", "Purchasing", "Finance", "Super Admin"].map(r => ({ value: r, label: r }))}
              menuPortalTarget={typeof document !== "undefined" ? document.body : null}
            />
          </FormField>
          {editItem ? (
            <FormField label="Status">
              <SearchableSelect 
                value={form.status} onChange={v => setForm((f) => ({ ...f, status: v }))}
                options={["Aktif", "Nonaktif"].map(s => ({ value: s, label: s }))}
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
              />
            </FormField>
          ) : (
            <FormField label="Password Awal"><input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min. 8 karakter" /></FormField>
          )}
        </FormRow>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
          <button className="btn btn-primary" onClick={handleSave}>{editItem ? "Simpan Perubahan" : "Buat Akun"}</button>
        </div>
      </Modal>

      <ConfirmModal
        show={!!itemToDelete}
        title="Hapus Pengguna"
        message={`Yakin ingin menghapus pengguna ${itemToDelete?.name}? Data yang dihapus tidak dapat dikembalikan.`}
        onConfirm={executeDelete}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
