import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const siteId = searchParams.get("siteId");
  const genreId = searchParams.get("genreId");
  const companyName = searchParams.get("companyName");
  const category = searchParams.get("category");
  const keyword = searchParams.get("keyword");
  const favoritesOnly = searchParams.get("favoritesOnly") === "true";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const sortBy = searchParams.get("sortBy") || "publishedAt";
  const sortOrder = searchParams.get("sortOrder") || "desc";
  const offset = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (siteId) where.siteId = parseInt(siteId);
  if (genreId) {
    where.site = { ...((where.site as Record<string, unknown>) || {}), genreId: parseInt(genreId) };
  }
  if (companyName) {
    where.site = { ...((where.site as Record<string, unknown>) || {}), name: companyName };
  }
  if (category) where.category = category;
  if (favoritesOnly) where.isFavorited = true;
  if (keyword) {
    where.OR = [
      { title: { contains: keyword } },
      { summaryJa: { contains: keyword } },
    ];
  }

  const includeFields = {
    site: { select: { name: true, color: true } },
    _count: { select: { views: true, comments: true } },
  };

  const mapArticle = (a: { _count: { views: number; comments: number }; [key: string]: unknown }) => ({
    ...a,
    viewCount: a._count.views,
    commentCount: a._count.comments,
  });

  // View-count based sorting requires raw SQL for time-window filtering
  if (sortBy.startsWith("views_")) {
    const period = sortBy.replace("views_", "");
    const now = new Date();
    let since: Date;
    switch (period) {
      case "week":
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "year":
        since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        since = new Date(0);
    }

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (siteId) {
      conditions.push(`a.site_id = $${paramIdx++}`);
      params.push(parseInt(siteId));
    }
    if (genreId) {
      conditions.push(`s.genre_id = $${paramIdx++}`);
      params.push(parseInt(genreId));
    }
    if (companyName) {
      conditions.push(`s.name = $${paramIdx++}`);
      params.push(companyName);
    }
    if (category) {
      conditions.push(`a.category = $${paramIdx++}`);
      params.push(category);
    }
    if (favoritesOnly) {
      conditions.push(`a.is_favorited = 1`);
    }
    if (keyword) {
      conditions.push(`(a.title LIKE $${paramIdx} OR a.summary_ja LIKE $${paramIdx})`);
      params.push(`%${keyword}%`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const dir = sortOrder === "asc" ? "ASC" : "DESC";

    const sinceStr = since.toISOString();
    params.push(sinceStr, limit, offset);

    const articlesRaw: { id: number }[] = await prisma.$queryRawUnsafe(
      `SELECT a.id FROM articles a
       LEFT JOIN sites s ON a.site_id = s.id
       LEFT JOIN (
         SELECT article_id, COUNT(*) as view_count
         FROM article_views
         WHERE viewed_at >= $${paramIdx++}
         GROUP BY article_id
       ) v ON a.id = v.article_id
       ${whereClause}
       ORDER BY COALESCE(v.view_count, 0) ${dir}, a.published_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      ...params
    );

    const ids = articlesRaw.map((r) => r.id);

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where: { id: { in: ids } },
        include: includeFields,
      }),
      prisma.article.count({ where: where as Prisma.ArticleWhereInput }),
    ]);

    const orderMap = new Map(ids.map((id, i) => [id, i]));
    articles.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

    return NextResponse.json({
      articles: articles.map(mapArticle),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }

  // Standard sorting
  type OrderByType = { [key: string]: "asc" | "desc" };
  const orderBy: OrderByType[] = [];
  const dir = sortOrder === "asc" ? "asc" as const : "desc" as const;

  switch (sortBy) {
    case "publishedAt":
      orderBy.push({ publishedAt: dir }, { detectedAt: dir });
      break;
    case "detectedAt":
      orderBy.push({ detectedAt: dir });
      break;
    case "likeCount":
      orderBy.push({ likeCount: dir }, { publishedAt: "desc" });
      break;
    case "favorites":
      orderBy.push({ isFavorited: dir }, { publishedAt: "desc" });
      break;
    default:
      orderBy.push({ publishedAt: "desc" }, { detectedAt: "desc" });
  }

  const [articles, total] = await Promise.all([
    prisma.article.findMany({
      where: where as Prisma.ArticleWhereInput,
      include: includeFields,
      orderBy,
      skip: offset,
      take: limit,
    }),
    prisma.article.count({ where: where as Prisma.ArticleWhereInput }),
  ]);

  return NextResponse.json({
    articles: articles.map(mapArticle),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { articleIds, isNew } = body;

  if (!articleIds || !Array.isArray(articleIds)) {
    return NextResponse.json({ error: "articleIds required" }, { status: 400 });
  }

  await prisma.article.updateMany({
    where: { id: { in: articleIds } },
    data: { isNew: isNew ?? false },
  });

  return NextResponse.json({ success: true });
}
