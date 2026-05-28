"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase";
import { AlertCircle, ArrowRight, Lock, Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen bg-ink flex">
      {/* ── Left panel: branding (desktop only) ───────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[400px] shrink-0 border-r border-hairline px-10 py-10">
        {/* Logo */}
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-extrabold text-white text-[20px] tracking-tighter">UTI</span>
            <span className="w-1 h-1 bg-gold inline-block" />
            <span className="text-white font-medium text-[12px] uppercase tracking-[0.18em]">RAG</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted uppercase tracking-wider">v1.0</span>
            <span className="w-0.5 h-0.5 bg-dim inline-block" />
            <span className="font-mono text-[10px] text-gold uppercase tracking-wider">Beta</span>
          </div>
        </div>

        {/* Center copy */}
        <div>
          <div className="eyebrow text-dim mb-5">Sistema académico</div>
          <h2 className="text-[38px] font-bold text-white leading-[1.0] tracking-tight display">
            Gestión de<br />Documentos<br />Institucionales
          </h2>
          <p className="mt-5 text-sm text-muted leading-relaxed max-w-[260px]">
            Panel administrativo para la gestión de contenido RAG de la Universidad Tecnológica Indoamérica.
          </p>
          {/* Decorative rule */}
          <div className="mt-8 flex items-center gap-3">
            <div className="w-6 h-[2px] bg-gold" />
            <div className="h-px flex-1 bg-hairline" />
          </div>
        </div>

        {/* Footer */}
        <div>
          <div className="h-px w-full bg-hairline mb-4" />
          <p className="font-mono text-[10px] text-dim uppercase tracking-wider">
            Universidad Tecnológica Indoamérica · Ecuador
          </p>
        </div>
      </div>

      {/* ── Right panel: form ──────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[360px]">

          {/* Mobile logo */}
          <div className="flex items-baseline gap-1.5 mb-10 lg:hidden">
            <span className="font-extrabold text-white text-[20px] tracking-tighter">UTI</span>
            <span className="w-1 h-1 bg-gold inline-block" />
            <span className="text-white font-medium text-[12px] uppercase tracking-[0.18em]">RAG</span>
          </div>

          {/* Page header */}
          <div className="mb-8">
            <div className="eyebrow text-dim mb-3">Acceso al sistema</div>
            <h1 className="text-[28px] font-bold text-white leading-tight tracking-tight">
              Panel Administrativo
            </h1>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Field 01 — email */}
            <div className="border border-hairline border-b-0 px-4 pt-3.5 pb-4">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="font-mono text-[10px] text-dim tabular">01</span>
                <label className="eyebrow text-muted">Correo electrónico</label>
              </div>
              <div className="relative">
                <Mail
                  size={13}
                  strokeWidth={1.5}
                  className="absolute left-0 top-1/2 -translate-y-1/2 text-dim pointer-events-none"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="admin@uti.edu.ec"
                  className="w-full pl-5 bg-transparent text-sm text-white placeholder:text-dim focus:outline-none"
                />
              </div>
            </div>

            {/* Field 02 — password */}
            <div className="border border-hairline px-4 pt-3.5 pb-4">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="font-mono text-[10px] text-dim tabular">02</span>
                <label className="eyebrow text-muted">Contraseña</label>
              </div>
              <div className="relative">
                <Lock
                  size={13}
                  strokeWidth={1.5}
                  className="absolute left-0 top-1/2 -translate-y-1/2 text-dim pointer-events-none"
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-5 bg-transparent text-sm text-white placeholder:text-dim focus:outline-none"
                />
              </div>
            </div>

            {/* Error state */}
            {error && (
              <div className="mt-0 border border-red-500/30 bg-red-500/5 px-4 py-3 flex items-start gap-2.5">
                <AlertCircle size={13} strokeWidth={1.5} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-300 leading-relaxed">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full h-11 bg-gold text-black text-[11px] font-bold uppercase tracking-[0.18em] hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border border-black/30 border-t-black rounded-full animate-spin" />
                  Verificando
                </>
              ) : (
                <>
                  Iniciar sesión
                  <ArrowRight size={13} strokeWidth={2} />
                </>
              )}
            </button>
          </form>

          {/* Divider + footer note */}
          <div className="mt-8 flex items-center gap-3">
            <div className="h-px flex-1 bg-hairline" />
            <span className="font-mono text-[10px] text-dim uppercase tracking-wider">Admin · 2025</span>
            <div className="h-px flex-1 bg-hairline" />
          </div>
        </div>
      </div>
    </main>
  );
}
