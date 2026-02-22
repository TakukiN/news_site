import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const genres = await prisma.genre.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { sites: true } },
    },
  });

  return NextResponse.json(genres);
}

function generateSlug(name: string): string {
  // Strip non-ASCII characters first, then try to build a slug
  const asciiOnly = name.replace(/[^\x20-\x7E]/g, "");
  const slug = asciiOnly
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug.length >= 2) return slug;
  // Fallback for non-ASCII names (e.g. Japanese)
  return `genre-${Date.now()}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name } = body;
  let slug = body.slug as string | undefined;

  if (!name) {
    return NextResponse.json(
      { error: "name is required" },
      { status: 400 }
    );
  }

  // Auto-generate slug if not provided
  if (!slug) {
    slug = generateSlug(name);
  }

  // Ensure uniqueness by appending a suffix if needed
  let finalSlug = slug;
  let suffix = 1;
  while (await prisma.genre.findUnique({ where: { slug: finalSlug } })) {
    finalSlug = `${slug}-${suffix++}`;
  }

  const maxOrder = await prisma.genre.aggregate({ _max: { sortOrder: true } });
  const genre = await prisma.genre.create({
    data: {
      name,
      slug: finalSlug,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  return NextResponse.json(genre, { status: 201 });
}
