// Shared helpers for CSPM frontend components.

import { cn } from "@/lib/utils";

export type Severity = "critical" | "high" | "medium" | "low";
export type FindingStatus = "open" | "in_progress" | "resolved" | "suppressed";

export const SEVERITY_STYLES: Record<
  Severity,
  { label: string; badge: string; dot: string; text: string; bg: string; ring: string }
> = {
  critical: {
    label: "Critical",
    badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900",
    dot: "bg-rose-500",
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500",
    ring: "ring-rose-500/30",
  },
  high: {
    label: "High",
    badge: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-900",
    dot: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-500",
    ring: "ring-orange-500/30",
  },
  medium: {
    label: "Medium",
    badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900",
    dot: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500",
    ring: "ring-amber-500/30",
  },
  low: {
    label: "Low",
    badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
    dot: "bg-slate-400",
    text: "text-slate-500 dark:text-slate-400",
    bg: "bg-slate-400",
    ring: "ring-slate-400/30",
  },
};

export const STATUS_STYLES: Record<FindingStatus, { label: string; badge: string; dot: string }> = {
  open: {
    label: "Open",
    badge: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900",
    dot: "bg-rose-500",
  },
  in_progress: {
    label: "In Progress",
    badge: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
    dot: "bg-sky-500",
  },
  resolved: {
    label: "Resolved",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900",
    dot: "bg-emerald-500",
  },
  suppressed: {
    label: "Suppressed",
    badge: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
    dot: "bg-slate-400",
  },
};

export const SERVICE_META: Record<string, { label: string; icon: string; accent: string }> = {
  iam: { label: "Identity & Access", icon: "users", accent: "text-violet-600 dark:text-violet-400" },
  storage: { label: "Storage", icon: "database", accent: "text-teal-600 dark:text-teal-400" },
  networking: { label: "Networking", icon: "network", accent: "text-cyan-600 dark:text-cyan-400" },
  encryption: { label: "Encryption", icon: "key", accent: "text-amber-600 dark:text-amber-400" },
  logging: { label: "Logging & Monitoring", icon: "scroll-text", accent: "text-emerald-600 dark:text-emerald-400" },
};

export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

export function scoreRing(score: number): string {
  if (score >= 80) return "#10b981";
  if (score >= 60) return "#f59e0b";
  return "#f43f5e";
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function severityRank(s: Severity): number {
  return { critical: 0, high: 1, medium: 2, low: 3 }[s] ?? 9;
}

export function cls(...parts: Array<string | false | undefined | null>): string {
  return cn(...parts.filter(Boolean) as string[]);
}
