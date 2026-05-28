"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { createSupabaseClient } from "@/lib/supabase";
import { ToastProvider } from "./swiss/ui";
import Sidebar, { type Page } from "./swiss/Sidebar";
import Overview from "./swiss/Overview";
import Documents from "./swiss/Documents";
import ConversationsPage from "./swiss/Conversations";
import SystemPage from "./swiss/SystemPage";
import AnalyticsPage from "./swiss/Analytics";
import EvaluationPage from "./swiss/Evaluation";
import Settings from "./swiss/Settings";

export default function DashboardShell() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [page, setPage] = useState<Page>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/login");
        return;
      }
      setToken(session.access_token);
      setEmail(session.user.email ?? "");
    });
  }, [router]);

  const handleLogout = async () => {
    const supabase = createSupabaseClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleNav = (p: Page) => {
    setPage(p);
    setSidebarOpen(false);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center">
        <span className="font-mono text-[11px] text-dim uppercase tracking-wider animate-pulse">
          Cargando…
        </span>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <ToastProvider>
      <div className="min-h-screen flex bg-ink">
        <Sidebar
          current={page}
          onNav={handleNav}
          email={email}
          onLogout={handleLogout}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 min-w-0 overflow-x-hidden scroll-thin">
          {/* Mobile top bar — visible below lg */}
          <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-12 border-b border-hairline bg-ink">
            <div className="flex items-baseline gap-1.5">
              <span className="font-extrabold text-white text-[15px] tracking-tighter">
                UTI
              </span>
              <span className="w-1 h-1 bg-gold inline-block" />
              <span className="text-white font-medium text-[10px] uppercase tracking-[0.18em]">
                RAG
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-muted hover:text-white transition-colors p-1"
              aria-label="Abrir menú"
            >
              <Menu size={20} strokeWidth={1.5} />
            </button>
          </div>

          <div className="px-4 sm:px-6 lg:px-10 max-w-[1380px] mx-auto pb-20">
            {page === "overview"      && <Overview token={token} onNav={setPage} />}
            {page === "documents"     && <Documents token={token} />}
            {page === "conversations" && <ConversationsPage token={token} />}
            {page === "analytics"     && <AnalyticsPage token={token} />}
            {page === "evaluation"    && <EvaluationPage token={token} />}
            {page === "system"        && <SystemPage token={token} />}
            {page === "settings"      && <Settings />}
          </div>

          {/* Swiss editorial footer */}
          <div className="border-t border-hairline px-4 sm:px-6 lg:px-10 py-4 max-w-[1380px] mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-[10px] text-dim uppercase tracking-[0.18em] font-mono">
              <span>UTI RAG Admin · v1.0 Beta</span>
              <span className="hidden sm:block">{today}</span>
              <span>© 2026 Universidad Tecnológica Indoamérica</span>
            </div>
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
