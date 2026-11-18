// Assessment delta / drift analysis.
//
// Compares two assessments and classifies every (checkId, resource) pair as:
//   - resolved   (was failing in the older assessment, now passing)
//   - new        (was not failing before, now failing)
//   - recurring  (failing in both)
//   - passing    (passing in both — omitted from the diff for brevity)
//
// This turns "two snapshots of findings" into a narrative of remediation
// progress and emerging risk, which is what executives actually need.

export interface DeltaFinding {
  checkId: string;
  title: string;
  service: string;
  resourceName: string;
  resourceType: string;
  severity: "critical" | "high" | "medium" | "low";
  classification: "new" | "resolved" | "recurring";
  prevStatus?: string;
  currStatus?: string;
}

export interface AssessmentDelta {
  previousAssessment: { id: string; startedAt: string; score: number };
  currentAssessment: { id: string; startedAt: string; score: number };
  scoreDelta: number;
  newFindings: DeltaFinding[];
  resolvedFindings: DeltaFinding[];
  recurringFindings: DeltaFinding[];
  totals: {
    new: number;
    resolved: number;
    recurring: number;
    netChange: number; // resolved - new (positive = improving)
  };
  byService: Array<{
    service: string;
    new: number;
    resolved: number;
    recurring: number;
  }>;
}

interface FindingLite {
  checkId: string;
  title: string;
  service: string;
  resourceName: string;
  resourceType: string;
  severity: "critical" | "high" | "medium" | "low";
  status: string;
  result: string;
}

/// key that identifies a unique (check, resource) evaluation across assessments
function key(f: { checkId: string; resourceName: string; resourceType: string }) {
  return `${f.checkId}::${f.resourceType}::${f.resourceName}`;
}

export function computeDelta(
  previous: FindingLite[],
  current: FindingLite[],
  prevMeta: { id: string; startedAt: string; score: number },
  currMeta: { id: string; startedAt: string; score: number }
): AssessmentDelta {
  const prevFails = new Map<string, FindingLite>();
  for (const f of previous) if (f.result === "fail") prevFails.set(key(f), f);

  const currFails = new Map<string, FindingLite>();
  for (const f of current) if (f.result === "fail") currFails.set(key(f), f);

  const allKeys = new Set<string>([...prevFails.keys(), ...currFails.keys()]);

  const newFindings: DeltaFinding[] = [];
  const resolvedFindings: DeltaFinding[] = [];
  const recurringFindings: DeltaFinding[] = [];

  for (const k of allKeys) {
    const prev = prevFails.get(k);
    const curr = currFails.get(k);
    if (prev && !curr) {
      resolvedFindings.push(toDelta(prev, "resolved", prev.status, undefined));
    } else if (!prev && curr) {
      newFindings.push(toDelta(curr, "new", undefined, curr.status));
    } else if (prev && curr) {
      recurringFindings.push(toDelta(curr, "recurring", prev.status, curr.status));
    }
  }

  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortFn = (a: DeltaFinding, b: DeltaFinding) => order[a.severity] - order[b.severity];
  newFindings.sort(sortFn);
  resolvedFindings.sort(sortFn);
  recurringFindings.sort(sortFn);

  const services = ["iam", "storage", "networking", "encryption", "logging"];
  const byService = services.map((service) => ({
    service,
    new: newFindings.filter((f) => f.service === service).length,
    resolved: resolvedFindings.filter((f) => f.service === service).length,
    recurring: recurringFindings.filter((f) => f.service === service).length,
  }));

  return {
    previousAssessment: prevMeta,
    currentAssessment: currMeta,
    scoreDelta: currMeta.score - prevMeta.score,
    newFindings,
    resolvedFindings,
    recurringFindings,
    totals: {
      new: newFindings.length,
      resolved: resolvedFindings.length,
      recurring: recurringFindings.length,
      netChange: resolvedFindings.length - newFindings.length,
    },
    byService,
  };
}

function toDelta(
  f: FindingLite,
  classification: DeltaFinding["classification"],
  prevStatus?: string,
  currStatus?: string
): DeltaFinding {
  return {
    checkId: f.checkId,
    title: f.title,
    service: f.service,
    resourceName: f.resourceName,
    resourceType: f.resourceType,
    severity: f.severity,
    classification,
    prevStatus,
    currStatus,
  };
}
