/**
 * Database seed script — customize with your monitored sites.
 *
 * 1. Copy: cp seed.example.ts seed.ts
 * 2. Add your target sites below
 * 3. Run: npx tsx prisma/seed.ts
 *
 * Alternatively, add sites via the Settings UI (/settings).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const sites = [
  // News site using RSS parser
  {
    name: "Example Corp",
    url: "https://example.com/feed.xml",
    color: "#E11D48",
    parserType: "rss",
    parserConfig: JSON.stringify({}),
    cronInterval: "0 */6 * * *",
  },
  // YouTube channel
  {
    name: "Example Corp",
    url: "https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID_HERE",
    color: "#E11D48",
    parserType: "youtube",
    parserConfig: JSON.stringify({}),
    cronInterval: "0 */6 * * *",
  },
  // Custom scraper (requires implementing a parser)
  // {
  //   name: "Another Corp",
  //   url: "https://another-corp.com/news",
  //   color: "#2563EB",
  //   parserType: "example",
  //   parserConfig: JSON.stringify({ maxPages: "3" }),
  //   cronInterval: "0 */6 * * *",
  // },
];

async function main() {
  // Create default genre
  const genre = await prisma.genre.upsert({
    where: { slug: "default" },
    update: { name: "ウォッチャー" },
    create: { name: "ウォッチャー", slug: "default", sortOrder: 0 },
  });

  for (const site of sites) {
    const existing = await prisma.site.findFirst({
      where: { url: site.url },
    });
    if (existing) {
      await prisma.site.update({
        where: { id: existing.id },
        data: { ...site, genreId: genre.id },
      });
    } else {
      await prisma.site.create({ data: { ...site, genreId: genre.id } });
    }
  }
  console.log(`Seeded ${sites.length} sites`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
