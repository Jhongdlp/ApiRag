import ChatWindow from "@/components/chat/ChatWindow";
import SystemStatus from "@/components/dashboard/SystemStatus";

export default function ChatPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <SystemStatus />

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ChatWindow />
        </div>
      </div>
    </main>
  );
}
