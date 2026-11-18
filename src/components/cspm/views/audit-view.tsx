"use client";

import { useEffect, useState } from "react";
import { ScrollText, User, Activity, FileDown, Play, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDate } from "../lib";

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  detail: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  createdAt: string;
}

const ACTION_META: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  "assessment.run": { icon: Play, color: "text-emerald-600" },
  "finding.status_change": { icon: Activity, color: "text-sky-600" },
  "finding.ai_remediation": { icon: ScrollText, color: "text-violet-600" },
  "report.download": { icon: FileDown, color: "text-amber-600" },
  "account.connected": { icon: Settings, color: "text-cyan-600" },
};

export function AuditView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cspm/audit?limit=100")
      .then((r) => r.json())
      .then((d) => setEntries(d.audit ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="size-4 text-violet-600" /> Audit trail
            </CardTitle>
            <CardDescription>Append-only log of every state-changing action — the platform is itself auditable</CardDescription>
          </div>
          <Badge variant="outline">{entries.length} entries</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No audit entries yet.</p>
        ) : (
          <ScrollArea className="max-h-[600px]">
            <ol className="relative space-y-3 border-l border-muted pl-4">
              {entries.map((e) => {
                const meta = ACTION_META[e.action] ?? { icon: Activity, color: "text-muted-foreground" };
                return (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[1.40rem] flex size-3 items-center justify-center rounded-full bg-background">
                      <span className="size-1.5 rounded-full bg-violet-500" />
                    </span>
                    <div className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <meta.icon className={`size-3.5 ${meta.color}`} />
                        <Badge variant="outline" className="font-mono text-[10px]">{e.action}</Badge>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="size-3" /> {e.actor}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">{formatDate(e.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 text-sm">{e.detail}</p>
                      {e.metadata && (
                        <pre className="mt-2 overflow-x-auto rounded bg-muted/50 p-2 font-mono text-[11px] text-muted-foreground">
                          {JSON.stringify(e.metadata, null, 2)}
                        </pre>
                      )}
                      {e.ipAddress && (
                        <p className="mt-1 text-[10px] text-muted-foreground">IP: {e.ipAddress}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
