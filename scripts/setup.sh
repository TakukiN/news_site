#!/bin/bash
# Initial setup script — run after cloning the repository.

set -e
cd "$(dirname "$0")/.."

echo "=== Competitor News Watcher — Setup ==="

# 1. Environment variables
if [ ! -f .env ]; then
  cp .env.example .env
  echo "[OK] Created .env from template"
  echo "     -> Edit .env to set your API keys if needed"
else
  echo "[SKIP] .env already exists"
fi

# 2. Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# 3. Generate Prisma client
echo ""
echo "Generating Prisma client..."
npx prisma generate

# 4. Run migrations
echo ""
echo "Running database migrations..."
npx prisma migrate deploy

# 5. Seed database (optional)
if [ -f prisma/seed.ts ]; then
  echo ""
  echo "Seeding database..."
  npx tsx prisma/seed.ts
fi

echo ""
echo "=== Setup complete! ==="
echo "Run 'npm run dev' to start the development server."
echo ""
echo "Next steps:"
echo "  1. Add your target sites via the Settings page (/settings)"
echo "  2. Or create custom parsers — see src/lib/parsers/example.ts"
echo "  3. Register custom parsers in src/lib/parsers/custom.ts"
