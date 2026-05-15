import { CheckCircle, Clock, AlertCircle } from "lucide-react";

type Status = "processing" | "ready" | "error";

const config: Record<Status, { label: string; icon: React.ReactNode; classes: string }> = {
  ready: {
    label: "Listo",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    classes: "text-emerald-700 bg-emerald-50 border-emerald-200",
  },
  processing: {
    label: "Procesando",
    icon: <Clock className="w-3.5 h-3.5 animate-pulse" />,
    classes: "text-amber-700 bg-amber-50 border-amber-200",
  },
  error: {
    label: "Error",
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    classes: "text-red-700 bg-red-50 border-red-200",
  },
};

export default function StatusBadge({ status }: { status: Status }) {
  const { label, icon, classes } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${classes}`}>
      {icon}
      {label}
    </span>
  );
}
