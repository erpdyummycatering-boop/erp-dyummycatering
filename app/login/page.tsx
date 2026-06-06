"use client";

import { useState, Suspense, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Utensils, AlertCircle } from "lucide-react";

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const searchParams = useSearchParams();

  useEffect(() => {
    const errorType = searchParams ? searchParams.get("error") : null;
    if (errorType) {
      if (errorType === "AccessDenied") {
        setErrorMsg("Akses ditolak. Email Google Anda belum terdaftar dalam sistem Dyummy Catering atau status akun Anda tidak aktif.");
      } else {
        setErrorMsg("Gagal masuk sistem. Silakan pastikan email Anda sudah terdaftar atau hubungi Administrator.");
      }
    }
  }, [searchParams]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0d011e 0%, #3b047a 50%, #1a0235 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px"
    }}>
      {/* Background decoration */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: -120, left: -120, width: 400, height: 400, borderRadius: "50%", background: "rgba(80, 5, 166, 0.15)", filter: "blur(70px)" }} />
        <div style={{ position: "absolute", bottom: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(55, 138, 221, 0.12)", filter: "blur(60px)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 440 }}>
        {/* App Branding */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "rgba(255,255,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,0.18)"
            }}>
              <Utensils size={20} color="white" />
            </div>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: "white", letterSpacing: "-0.02em", lineHeight: 1 }}>Dyummy Catering</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>ERP & CRM Portal</p>
            </div>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "white", margin: "16px 0 6px", letterSpacing: "-0.01em" }}>
            Selamat Datang Kembali
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: 0 }}>
            Silakan masuk dengan akun yang terdaftar untuk melanjutkan.
          </p>
        </div>

        {/* Main Box */}
        <div style={{
          background: "rgba(255, 255, 255, 0.06)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 16,
          padding: "32px",
          boxShadow: "0 20px 40px rgba(0,0,0,0.3)"
        }}>
          {errorMsg && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(226, 75, 74, 0.15)",
              border: "1px solid rgba(226, 75, 74, 0.3)",
              borderRadius: 8,
              padding: "10px 12px",
              marginBottom: 16,
              color: "#fca5a5",
              fontSize: 12,
              lineHeight: 1.4,
              fontWeight: 500
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Google SSO Button */}
          <button
            onClick={() => {
              setLoading(true);
              signIn("google", { callbackUrl: "/dashboard" });
            }}
            disabled={loading}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: "white",
              color: "#1e1b4b",
              border: "none",
              borderRadius: 8,
              height: 44,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            <span>{loading ? "Menghubungkan..." : "Masuk dengan Google"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0d011e 0%, #3b047a 50%, #1a0235 100%)" }} />}>
      <LoginForm />
    </Suspense>
  );
}
