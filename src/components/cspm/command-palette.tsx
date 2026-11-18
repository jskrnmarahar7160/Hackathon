"use client";

import { useEffect, useState, useCallback } from "react";
import {
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
  Search,
  CornerDownLeft,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Posture overview & trends" },
  { id: "findings", label: "Findings", icon: ShieldAlert, hint: "All findings with evidence" },
  { id: "attack-paths", label: "Attack Paths", icon: Crosshair, hint: "Chained risk scenarios" },
  { id: "checks", label: "Checks Library", icon: BookOpen, hint: "Documented controls" },
  { id: "resources", label: "Resources", icon: Boxes, hint: "Cloud resource inventory" },
  { id: "assessments", label: "Assessments", icon: History, hint: "Run history" },
  { id: "delta", label: "Posture Drift", icon: GitCompareArrows, hint: "Compare assessments" },
  { id: "reports", label: "Reports", icon: FileText, hint: "Evidence pack & assessment report" },
  { id: "audit", label: "Audit Trail", icon: ScrollText, hint: "Append-only action log" },
  { id: "architecture", label: "Architecture", icon: Network, hint: "Read-only design & limits" },
] as const;

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onNavigate: (id: string) => void;
}) {
  const go = useCallback(
    (id: string) => {
      onNavigate(id);
      onOpenChange(false);
    },
    [onNavigate, onOpenChange]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, findings, checks… (Cmd+K)" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.id}
              value={`${item.label} ${item.hint}`}
              onSelect={() => go(item.id)}
              className="gap-2"
            >
              <item.icon className="size-4 text-muted-foreground" />
              <div className="flex flex-1 items-center justify-between">
                <span className="font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.hint}</span>
              </div>
              <CornerDownLeft className="size-3 text-muted-foreground/50" />
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Quick actions">
          <CommandItem
            value="run assessment scan"
            onSelect={() => go("assessments")}
            className="gap-2"
          >
            <History className="size-4 text-emerald-600" />
            <span>Run a new assessment</span>
          </CommandItem>
          <CommandItem
            value="download evidence pack report"
            onSelect={() => go("reports")}
            className="gap-2"
          >
            <FileText className="size-4 text-violet-600" />
            <span>Download evidence pack / report</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/// Hook that toggles the palette on Cmd+K / Ctrl+K.
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return { open, setOpen };
}

export { NAV_ITEMS };
