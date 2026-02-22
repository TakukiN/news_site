import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const companyName = searchParams.get("companyName");
  const category = searchParams.get("category");
  const keyword = searchParams.get("keyword");

  const where: Record<string, unknown> = {};
  if (companyName) where.site = { name: companyName };
  if (category) where.category = category;
  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
      { summaryJa: { contains: keyword } },
    ];
  }

  const articles = await prisma.article.findMany({
    where,
    include: { site: { select: { name: true } } },
    orderBy: [{ publishedAt: "desc" }, { detectedAt: "desc" }],
    take: 1000,
  });

  // Build CSV
  const headers = ["企業名", "カテゴリ", "タイトル", "URL", "公開日", "検出日", "要約"];
  const rows = articles.map((a) => {
    const summary = (a.summaryJa || "")
      .replace(/タイトル[：:][^\n]+\n?/, "")
      .replace(/要約[：:]/, "")
      .trim();
    return [
      a.site.name,
      a.category,
      a.title,
      a.externalUrl,
      a.publishedAt ? new Date(a.publishedAt).toISOString().slice(0, 10) : "",
      new Date(a.detectedAt).toISOString().slice(0, 10),
      summary,
    ];
  });

  const escapeCSV = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const csv =
    "\uFEFF" + // BOM for Excel
    [headers, ...rows].map((row) => row.map(escapeCSV).join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="articles_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
