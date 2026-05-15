import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "danger" | "ghost";
  loading?: boolean;
}

const variants = {
  primary: "bg-uti-blue text-white hover:bg-blue-900 disabled:opacity-50",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-50",
  ghost: "bg-transparent text-uti-blue hover:bg-blue-50 disabled:opacity-50",
};

export default function Button({
  variant = "primary",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? "Cargando..." : children}
    </button>
  );
}
