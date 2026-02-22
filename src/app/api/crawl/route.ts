import { prisma } from "@/lib/db/prisma";
import { crawlSite, crawlAllSites } from "@/lib/crawler/engine";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const siteId = body?.siteId;
  const stream = body?.stream;
  const genreId = body?.genreId;

  if (siteId && !stream) {
    const site = await prisma.site.findUnique({ where: { id: parseInt(siteId) } });
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }
    const result = await crawlSite(site);
    return NextResponse.json({ [site.name]: result });
  }

  if (!stream) {
    const results = await crawlAllSites();
    return NextResponse.json(results);
  }

  // Streaming mode: send progress updates via SSE
  const siteWhere: Record<string, unknown> = { isActive: true };
  if (siteId) {
    siteWhere.id = parseInt(siteId);
  }
  if (genreId) {
    siteWhere.genreId = parseInt(genreId);
  }
  const sites = await prisma.site.findMany({ where: siteWhere });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "start", totalSites: sites.length });

      const results: Record<string, unknown> = {};
      for (let i = 0; i < sites.length; i++) {
        const site = sites[i];
        send({
          type: "progress",
          current: i + 1,
          total: sites.length,
          siteName: site.name,
          siteUrl: site.url,
        });

        try {
          const result = await crawlSite(site);
          results[site.name] = result;
          send({
            type: "site_done",
            siteName: site.name,
            articlesFound: result.articlesFound,
            newArticles: result.newArticles,
            errors: result.errors.length,
          });
        } catch (e) {
          send({ type: "site_error", siteName: site.name, error: String(e) });
        }
      }

      send({ type: "done", results });
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function GET() {
  const sites = await prisma.site.findMany({
    where: { isActive: true },
    include: {
      crawlLogs: {
        orderBy: { startedAt: "desc" },
        take: 1,
      },
    },
  });

  const status = sites.map((site) => ({
    siteId: site.id,
    siteName: site.name,
    lastCrawl: site.crawlLogs[0] || null,
  }));

  return NextResponse.json(status);
}
