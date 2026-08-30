"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { UserDoc } from "@/lib/db";

export type Site = { url: string; permissionLevel: string };

export type Totals = { clicks: number; impressions: number; ctr: number; position: number };

export type MetricRow = {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type Stats = {
  range: { start: string; end: string; prevStart: string; prevEnd: string };
  totals: Totals;
  prevTotals: Totals;
  series: { date: string; clicks: number; impressions: number }[];
  queries: MetricRow[];
  pages: MetricRow[];
};

export type PostHogStats = {
  connected: boolean;
  totals: { pageviews: number; visitors: number };
  prevTotals?: { pageviews: number; visitors: number };
  daily: { date: string; views: number; visitors: number }[];
  topPages: { path: string; views: number; visitors: number }[];
};

export type JoinedRow = {
  path: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  views: number;
  visitors: number;
};

type MeResponse = { loggedIn: boolean; profile: Omit<UserDoc, "_id"> | null };

type DashboardState = {
  loggedIn: boolean | null;
  profile: Omit<UserDoc, "_id"> | null;
  sites: Site[];
  site: string;
  days: number;
  stats: Stats | null;
  phStats: PostHogStats | null;
  joined: { connected: boolean; rows: JoinedRow[] } | null;
  loading: boolean;
  error: string;
  selectSite: (url: string) => void;
  selectRange: (days: number) => void;
};

const DashboardContext = createContext<DashboardState | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<Omit<UserDoc, "_id"> | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [site, setSite] = useState("");
  const [days, setDays] = useState(28);
  const [stats, setStats] = useState<Stats | null>(null);
  const [phStats, setPhStats] = useState<PostHogStats | null>(null);
  const [joined, setJoined] = useState<{ connected: boolean; rows: JoinedRow[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStats = useCallback((siteUrl: string, rangeDays: number) => {
    setLoading(true);
    setError("");
    fetch(`/api/stats?site=${encodeURIComponent(siteUrl)}&days=${rangeDays}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        return res.json();
      })
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadAnalytics = useCallback((rangeDays: number) => {
    fetch(`/api/analytics?days=${rangeDays}`)
      .then(async (res) => res.json())
      .then(setPhStats)
      .catch(() => setPhStats(null));
  }, []);

  const loadJoined = useCallback((siteUrl: string, rangeDays: number) => {
    fetch(`/api/insights?site=${encodeURIComponent(siteUrl)}&days=${rangeDays}`)
      .then(async (res) => (res.ok ? res.json() : { connected: false, rows: [] }))
      .then(setJoined)
      .catch(() => setJoined(null));
  }, []);

  useEffect(() => {
    let redirected = false;
    fetch("/api/me")
      .then(async (res) => res.json())
      .then((data: MeResponse) => {
        if (!data.loggedIn) {
          setLoggedIn(false);
          return;
        }
        if (!data.profile?.onboarded || !data.profile.activeProperty) {
          redirected = true;
          router.replace("/onboarding");
          return;
        }
        const p = data.profile;
        setLoggedIn(true);
        setProfile(p);
        const active = (p.properties ?? []).find((prop) => prop.url === p.activeProperty);
        const lockedSites: Site[] = [
          {
            url: p.activeProperty,
            permissionLevel: active?.permissionLevel ?? "owner",
          },
        ];
        setSites(lockedSites);
        setSite(p.activeProperty);
        loadStats(p.activeProperty, 28);
        loadJoined(p.activeProperty, 28);
        loadAnalytics(28);
      })
      .catch(() => {
        if (!redirected) setLoggedIn(false);
      });
  }, [router, loadStats, loadAnalytics, loadJoined]);

  const selectSite = useCallback(
    (url: string) => {
      setSite(url);
      loadStats(url, days);
      loadJoined(url, days);
    },
    [days, loadStats, loadJoined]
  );

  const selectRange = useCallback(
    (d: number) => {
      setDays(d);
      if (site) {
        loadStats(site, d);
        loadJoined(site, d);
      }
      loadAnalytics(d);
    },
    [site, loadStats, loadAnalytics, loadJoined]
  );

  return (
    <DashboardContext.Provider
      value={{
        loggedIn,
        profile,
        sites,
        site,
        days,
        stats,
        phStats,
        joined,
        loading,
        error,
        selectSite,
        selectRange,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}
