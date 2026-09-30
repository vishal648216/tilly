const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "../prisma/schema.prisma");
if (fs.existsSync(schemaPath)) {
  let content = fs.readFileSync(schemaPath, "utf8");

  // If running on Vercel or cloud with POSTGRES_URL
  if (process.env.POSTGRES_URL && process.env.POSTGRES_URL.startsWith("postgres")) {
    console.log("☁️ Vercel / Cloud detected: configuring Prisma for PostgreSQL...");
    content = content.replace(/provider\s*=\s*"sqlite"/g, 'provider = "postgresql"');
    content = content.replace(/url\s*=\s*env\("DATABASE_URL"\)/g, 'url      = env("POSTGRES_URL")');
    fs.writeFileSync(schemaPath, content, "utf8");
    console.log("✅ Schema configured for PostgreSQL");
  } else {
    console.log("💻 Local environment detected: keeping/restoring SQLite configuration...");
    content = content.replace(/provider\s*=\s*"postgresql"/g, 'provider = "sqlite"');
    content = content.replace(/url\s*=\s*env\("POSTGRES_URL"\)/g, 'url      = env("DATABASE_URL")');
    fs.writeFileSync(schemaPath, content, "utf8");
    console.log("✅ Schema configured for SQLite");
  }
}
