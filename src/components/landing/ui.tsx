import type { ReactNode } from "react";

export const SURFACES = {
  canvas: "#010102",
  s1: "#0c0d10",
  s2: "#14161a",
  s3: "#1b1d22",
  s4: "#23252b",
} as const;

export const HAIRLINE = "#23252a";
export const PRIMARY = "#5e6ad2";
export const PRIMARY_HOVER = "#828fff";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-6 ${className}`}>{children}</div>
  );
}

type ButtonProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
};

export function Button({ href, children, variant = "primary" }: ButtonProps) {
  const base =
    "inline-flex h-10 items-center justify-center rounded-lg px-3.5 text-sm font-medium transition-colors";
  const styles =
    variant === "primary"
      ? "bg-[#5e6ad2] text-white hover:bg-[#828fff]"
      : "border border-[#23252a] bg-[#0c0d10] text-[#f7f8f8] hover:border-[#2f3238] hover:bg-[#14161a]";
  return (
    <a href={href} className={`${base} ${styles}`}>
      {children}
    </a>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13px] font-medium leading-[1.3] tracking-[0.4px] text-[#8a8f98]">{children}</p>
  );
}

export function Panel({
  children,
  className = "",
  lift = 1,
}: {
  children: ReactNode;
  className?: string;
  lift?: 1 | 2;
}) {
  const bg = lift === 1 ? "bg-[#0c0d10]" : "bg-[#14161a]";
  return (
    <div
      className={`rounded-xl border border-[#23252a] ${bg} shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}
