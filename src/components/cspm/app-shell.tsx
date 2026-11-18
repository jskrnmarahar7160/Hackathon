"use client";

import { useCallback, useState } from "react";
import {
  ShieldCheck,
  LayoutDashboard,
  ShieldAlert,
  BookOpen,
  Boxes,
  History,
  FileText,
  Network,
  Crosshair,
  GitCompareArrows,
  ScrollText,
  Play,
  Loader2,
  Cloud,
  Command,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette, useCommandPalette, NAV_ITEMS } from "./command-palette";
import { toast } from "sonner";
import { OverviewView } from "./views/overview";
import { FindingsView } from "./views/findings-view";
import { ChecksView } from "./views/checks-view";
import { ResourcesView } from "./views/resources-view";
import { AssessmentsView } from "./views/assessments-view";
import { ReportsView } from "./views/reports-view";
import { ArchitectureView } from "./views/architecture-view";
import { AttackPathsView } from "./views/attack-paths-view";
import { DeltaView } from "./views/delta-view";
import { AuditView } from "./views/audit-view";

export function CspmApp() {
  const [tab, setTab] = useState<string>("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [running, setRunning] = useState(false);
  const palette = useCommandPalette();

  const runAssessment = useCallback(async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/cspm/assessments/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Run failed");
      toast.success(`Assessment complete · score ${data.score}/100 · ${data.failed} findings`);
      setRefreshKey((k) => k + 1);
      setTab("dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not run assessment");
    } finally {
      setRunning(false);
    }
  }, []);

  const navigate = useCallback((t: string) => setTab(t), []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
          <button onClick={() => setTab("dashboard")} className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
              <ShieldCheck className="size-5" />
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-semibold leading-tight">Sentinel CSPM</p>
              <p className="text-[11px] text-muted-foreground">Cloud Posture &amp; Compliance</p>
            </div>
          </button>

          <div className="ml-1 hidden items-center gap-2 md:flex">
            <Badge variant="outline" className="gap-1.5 border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Read-only
            </Badge>
            <Badge variant="outline" className="gap-1.5">
              <Cloud className="size-3" /> AWS · Northwind
            </Badge>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => palette.setOpen(true)} className="hidden gap-2 sm:flex">
              <Command className="size-4" />
              <span className="text-muted-foreground">Search</span>
              <kbd className="ml-1 rounded border bg-muted px-1 text-[10px] font-mono">⌘K</kbd>
            </Button>
            <Button onClick={runAssessment} disabled={running} size="sm" className="gap-2">
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              <span className="hidden sm:inline">{running ? "Running..." : "Run assessment"}</span>
              <span className="sm:hidden">{running ? "..." : "Run"}</span>
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {/* Tab nav */}
        <div className="border-t bg-background/60">
          <div className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-2 sm:px-4">
            {NAV_ITEMS.map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "group relative flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors",
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <t.icon className={cn("size-4 shrink-0", active && "text-emerald-600 dark:text-emerald-400")} />
                  <span className="hidden md:inline">{t.label}</span>
                  {active && (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {NAV_ITEMS.find((t) => t.id === tab)?.label}
            </h1>
            <p className="text-sm text-muted-foreground">{tabDescription(tab)}</p>
          </div>
        </div>

        {tab === "dashboard" && <OverviewView key={refreshKey} onNavigate={navigate} />}
        {tab === "findings" && <FindingsView />}
        {tab === "attack-paths" && <AttackPathsView />}
        {tab === "checks" && <ChecksView />}
        {tab === "resources" && <ResourcesView />}
        {tab === "assessments" && <AssessmentsView onAssessmentRun={() => setRefreshKey((k) => k + 1)} />}
        {tab === "delta" && <DeltaView />}
        {tab === "reports" && <ReportsView onNavigate={navigate} />}
        {tab === "audit" && <AuditView />}
        {tab === "architecture" && <ArchitectureView />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-muted/30">
        <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6">
          <div className="flex flex-col items-start justify-between gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              Sentinel CSPM — read-only cloud posture &amp; compliance monitoring
            </p>
            <p>
              Control mappings to CIS &amp; ISO 27001 are for internal alignment only and do not
              constitute certification.
            </p>
          </div>
        </div>
      </footer>

      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} onNavigate={navigate} />
    </div>
  );
}

function tabDescription(tab: string): string {
  switch (tab) {
    case "dashboard":
      return "Posture score, priority risks, severity distribution and remediation trends.";
    case "findings":
      return "All evaluated controls with evidence, control mappings, risk score and AI remediation.";
    case "attack-paths":
      return "Chained findings revealing how misconfigurations combine into larger real-world risk.";
    case "checks":
      return "Documented security checks mapped to CIS Benchmarks and ISO 27001:2022 controls.";
    case "resources":
      return "Cloud resource inventory captured in read-only mode, grouped by service.";
    case "assessments":
      return "Assessment run history and on-demand re-evaluation of the latest snapshot.";
    case "delta":
      return "Compare the two most recent assessments — new, resolved and recurring findings.";
    case "reports":
      return "Downloadable evidence pack and assessment report.";
    case "audit":
      return "Append-only audit trail of every state-changing action in the platform.";
    case "architecture":
      return "Read-only architecture, data model, scope and limitations.";
    default:
      return "";
  }
}
