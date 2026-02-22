import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const site = await prisma.site.update({
    where: { id: parseInt(id) },
    data: body,
  });

  return NextResponse.json(site);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const siteId = parseInt(id);

  // Delete related records first
  await prisma.crawlLog.deleteMany({ where: { siteId } });
  await prisma.article.deleteMany({ where: { siteId } });
  await prisma.site.delete({ where: { id: siteId } });

  return NextResponse.json({ success: true });
}
