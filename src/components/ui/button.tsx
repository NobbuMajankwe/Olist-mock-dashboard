import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline";
}

export function Button({ variant = "default", className = "", children, ...props }: ButtonProps) {
  const base = "px-4 py-2 rounded-lg text-sm font-medium transition-colors";
  const styles = variant === "outline"
    ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
    : "bg-slate-900 text-white hover:bg-slate-700";
  return <button className={`${base} ${styles} ${className}`} {...props}>{children}</button>;
}
