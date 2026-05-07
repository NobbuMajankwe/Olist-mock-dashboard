import React from "react";

export function Card({ className = "", children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`bg-white ${className}`}>{children}</div>;
}

export function CardContent({ className = "", children }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={className}>{children}</div>;
}
