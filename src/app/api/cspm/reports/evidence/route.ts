// GET /api/cspm/reports/evidence
// Returns the structured evidence pack (JSON) for download.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { buildEvidencePack } from "@/lib/cspm/report";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  let accountId = sp.get("accountId") || undefined;

  if (!accountId) {
    const account = await db.cloudAccount.findFirst({ orderBy: { createdAt: "asc" } });
    if (!account) return NextResponse.json({ error: "No account" }, { status: 404 });
    accountId = account.id;
  }

  const pack = await buildEvidencePack(accountId);

  if (sp.get("download") === "1") {
    const filename = `cspm-evidence-pack-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(pack, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json(pack);
}
