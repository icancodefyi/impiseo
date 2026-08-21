"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

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

type DashboardState = {
  loggedIn: boolean | null;
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
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
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
    fetch("/api/sites")
      .then(async (res) => {
        if (res.status === 401) return null;
        return res.json();
      })
      .then((data) => {
        if (!data) {
          setLoggedIn(false);
          return;
        }
        setLoggedIn(true);
        setSites(data.sites ?? []);
        loadAnalytics(28);
        if (data.sites?.length) {
          const saved = localStorage.getItem("gsc_site");
          const initial = data.sites.some((s: Site) => s.url === saved) ? saved : data.sites[0].url;
          setSite(initial);
          localStorage.setItem("gsc_site", initial);
          loadStats(initial, 28);
          loadJoined(initial, 28);
        }
      })
      .catch(() => setLoggedIn(false));
  }, [loadStats, loadAnalytics, loadJoined]);

  const selectSite = useCallback(
    (url: string) => {
      setSite(url);
      localStorage.setItem("gsc_site", url);
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
