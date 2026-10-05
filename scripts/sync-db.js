const { execSync } = require("child_process");

// Determine if PostgreSQL is configured via any of the standard env vars
const hasPostgresUrl = process.env.POSTGRES_URL && process.env.POSTGRES_URL.startsWith("postgres");
const hasPostgresPrismaUrl = process.env.POSTGRES_PRISMA_URL && process.env.POSTGRES_PRISMA_URL.startsWith("postgres");
const hasDatabaseUrlPostgres = process.env.DATABASE_URL && (process.env.DATABASE_URL.startsWith("postgres://") || process.env.DATABASE_URL.startsWith("postgresql://"));

const isPostgres = Boolean(hasPostgresUrl || hasPostgresPrismaUrl || hasDatabaseUrlPostgres);

if (isPostgres) {
  console.log("☁️ Cloud PostgreSQL detected: Synchronizing schema with database via Prisma db push...");
  try {
    const env = { ...process.env };
    // If non-pooling connection is provided by Vercel / Neon / Supabase, prioritize it for schema push
    if (env.POSTGRES_URL_NON_POOLING) {
      console.log("ℹ️ Using POSTGRES_URL_NON_POOLING for direct schema synchronization...");
      env.POSTGRES_URL = env.POSTGRES_URL_NON_POOLING;
      env.DATABASE_URL = env.POSTGRES_URL_NON_POOLING;
    }

    execSync("npx prisma db push --accept-data-loss", {
      stdio: "inherit",
      env: env,
    });
    console.log("✅ Cloud PostgreSQL database schema synchronized successfully!");
  } catch (err) {
    console.error("❌ Failed to push schema to PostgreSQL:", err.message);
    process.exit(1);
  }
} else {
  console.log("💻 Local environment detected: Skipping remote database push.");
}
