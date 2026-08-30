"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  IconBulb,
  IconFileText,
  IconGauge,
  IconLayoutDashboard,
  IconLogout,
  IconPlug,
  IconReportAnalytics,
  IconSearch,
  IconSparkles,
  IconTargetArrow,
} from "@tabler/icons-react";
import { useDashboard } from "@/lib/dashboard-context";
import { Loader, SignInCard } from "@/components/widgets";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: IconLayoutDashboard },
  { href: "/dashboard/site-pages", label: "Pages", icon: IconFileText },
  { href: "/dashboard/queries", label: "Queries", icon: IconSearch },
  { href: "/dashboard/opportunities", label: "Opportunities", icon: IconTargetArrow },
];
const NAV_BOTTOM = [
  { href: "/dashboard/ideas", label: "Ideas", icon: IconSparkles },
  { href: "/dashboard/recommendations", label: "Recommendations", icon: IconBulb },
  { href: "/dashboard/technical", label: "Technical", icon: IconGauge },
  { href: "/dashboard/auditor", label: "Auditor", icon: IconReportAnalytics },
  { href: "/integrations", label: "Integrations", icon: IconPlug },
];

function BrandMark({ size = "h-6 w-6", text = "text-[11px]" }: { size?: string; text?: string }) {
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-md bg-primary font-bold text-white ${text}`}
    >
      I
    </span>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof IconSearch;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-surface-2 font-medium text-ink"
          : "text-ink-subtle hover:bg-surface-1 hover:text-ink-muted"
      }`}
    >
      <Icon size={17} stroke={1.75} />
      {label}
    </Link>
  );
}

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-hairline bg-canvas md:flex">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-[17px]">
        <BrandMark />
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Impiseo</span>
      </Link>
      <nav className="mt-2 flex flex-col gap-0.5 px-3">
        {NAV.map((item) => (
          <NavLink key={item.href} {...item} active={pathname === item.href} />
        ))}
        <div className="mx-3 my-3 border-t border-hairline-tertiary" />
        {NAV_BOTTOM.map((item) => (
          <NavLink key={item.href} {...item} active={pathname === item.href} />
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-0.5 px-3 pb-5">
        <button
          onClick={() => signOut({ redirectTo: "/" })}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink-subtle transition-colors hover:bg-surface-1 hover:text-ink-muted"
        >
          <IconLogout size={17} stroke={1.75} /> Log out
        </button>
      </div>
    </aside>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const items = [...NAV, ...NAV_BOTTOM];
  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-canvas/95 backdrop-blur md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em] text-ink">
          <BrandMark size="h-7 w-7" text="text-xs" />
          Impiseo
        </Link>
        <button
          onClick={() => signOut({ redirectTo: "/" })}
          className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-hairline bg-surface-1 px-3 py-2 text-sm text-ink-subtle transition-colors hover:text-ink-muted"
        >
          <IconLogout size={15} stroke={1.75} /> Log out
        </button>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? "bg-surface-2 font-medium text-ink" : "text-ink-subtle hover:text-ink-muted"
              }`}
            >
              <Icon size={15} stroke={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { loggedIn } = useDashboard();

  if (loggedIn === null) return <Loader />;
  if (!loggedIn) return <SignInCard />;

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-10 md:py-10">{children}</main>
      </div>
    </div>
  );
}
