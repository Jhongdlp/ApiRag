"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
          onNav={setPage}
          email={email}
          onLogout={handleLogout}
        />

        <main className="flex-1 min-w-0 overflow-x-hidden scroll-thin">
          <div className="px-10 max-w-[1380px] mx-auto pb-20">
            {page === "overview"      && <Overview token={token} onNav={setPage} />}
            {page === "documents"     && <Documents token={token} />}
            {page === "conversations" && <ConversationsPage />}
            {page === "analytics"     && <AnalyticsPage token={token} />}
            {page === "evaluation"    && <EvaluationPage token={token} />}
            {page === "system"        && <SystemPage />}
            {page === "settings"      && <Settings />}
          </div>

          {/* Swiss editorial footer */}
          <div className="border-t border-hairline px-10 py-4 max-w-[1380px] mx-auto flex items-center justify-between text-[10px] text-dim uppercase tracking-[0.18em] font-mono">
            <span>UTI RAG Admin · v1.0 Beta</span>
            <span>{today}</span>
            <span>© 2026 Universidad Tecnológica Indoamérica</span>
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
