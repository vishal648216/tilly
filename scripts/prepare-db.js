const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "../prisma/schema.prisma");
if (fs.existsSync(schemaPath)) {
  let content = fs.readFileSync(schemaPath, "utf8");

  // Determine if PostgreSQL is configured via any of the standard env vars
  const hasPostgresUrl = process.env.POSTGRES_URL && process.env.POSTGRES_URL.startsWith("postgres");
  const hasPostgresPrismaUrl = process.env.POSTGRES_PRISMA_URL && process.env.POSTGRES_PRISMA_URL.startsWith("postgres");
  const hasDatabaseUrlPostgres = process.env.DATABASE_URL && (process.env.DATABASE_URL.startsWith("postgres://") || process.env.DATABASE_URL.startsWith("postgresql://"));

  const isPostgres = Boolean(hasPostgresUrl || hasPostgresPrismaUrl || hasDatabaseUrlPostgres);

  if (isPostgres) {
    console.log("☁️ Vercel / Cloud detected: configuring Prisma for PostgreSQL...");
    content = content.replace(/provider\s*=\s*"(sqlite|postgresql)"/g, 'provider = "postgresql"');
    
    if (hasPostgresUrl) {
      content = content.replace(/url\s*=\s*env\("[^"]+"\)/g, 'url      = env("POSTGRES_URL")');
    } else if (hasPostgresPrismaUrl) {
      content = content.replace(/url\s*=\s*env\("[^"]+"\)/g, 'url      = env("POSTGRES_PRISMA_URL")');
    } else if (hasDatabaseUrlPostgres) {
      content = content.replace(/url\s*=\s*env\("[^"]+"\)/g, 'url      = env("DATABASE_URL")');
    }
    
    fs.writeFileSync(schemaPath, content, "utf8");
    console.log("✅ Schema configured for PostgreSQL");
  } else {
    console.log("💻 Local environment detected: keeping/restoring SQLite configuration...");
    content = content.replace(/provider\s*=\s*"(sqlite|postgresql)"/g, 'provider = "sqlite"');
    content = content.replace(/url\s*=\s*env\("[^"]+"\)/g, 'url      = env("DATABASE_URL")');
    fs.writeFileSync(schemaPath, content, "utf8");
    console.log("✅ Schema configured for SQLite");
  }
}
