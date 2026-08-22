"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  IconBulb,
  IconFileText,
  IconLayoutDashboard,
  IconLogout,
  IconPlug,
  IconSearch,
  IconTrendingUp,
} from "@tabler/icons-react";
import { useDashboard } from "@/lib/dashboard-context";
import { Loader, SignInCard } from "@/components/widgets";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: IconLayoutDashboard },
  { href: "/dashboard/site-pages", label: "Pages", icon: IconFileText },
  { href: "/dashboard/queries", label: "Queries", icon: IconSearch },
];

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15">
          <IconTrendingUp size={17} className="text-emerald-400" />
        </span>
        <span className="text-[0.9375rem] font-semibold tracking-tight">Impiseo</span>
      </Link>
      <nav className="mt-2 flex flex-col gap-0.5 px-3">
        {[...NAV, { href: "/dashboard/recommendations", label: "Recommendations", icon: IconBulb }].map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                active ? "bg-zinc-800/80 font-medium text-zinc-100" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              <Icon size={16} stroke={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex flex-col gap-0.5 px-3 pb-5">
        <Link
          href="/integrations"
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
        >
          <IconPlug size={16} stroke={1.75} /> Integrations
        </Link>
        <button
          onClick={() => signOut({ redirectTo: "/" })}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-200"
        >
          <IconLogout size={16} stroke={1.75} /> Log out
        </button>
      </div>
    </aside>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const items = [
    ...NAV,
    { href: "/dashboard/recommendations", label: "Recommendations", icon: IconBulb },
    { href: "/integrations", label: "Integrations", icon: IconPlug },
  ];
  return (
    <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
            <IconTrendingUp size={15} className="text-emerald-400" />
          </span>
          Impiseo
        </Link>
        <button
          onClick={() => signOut({ redirectTo: "/" })}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-400"
        >
          <IconLogout size={13} stroke={1.75} /> Log out
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
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition ${
                active ? "bg-zinc-800 font-medium text-zinc-100" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Icon size={14} stroke={1.75} />
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
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
