import * as fs from "fs";
import * as path from "path";

const srcDir = path.resolve(__dirname, "../src");
const appDir = path.resolve(__dirname, "../src/app");

// Collect all existing routes from app directory
const existingRoutes = new Set<string>();

function scanRoutes(dir: string, baseRoute: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      let nextBase = baseRoute;
      // Skip route groups like (dashboard), (auth), etc. in the URL
      if (!entry.name.startsWith("(") || !entry.name.endsWith(")")) {
        nextBase = `${baseRoute}/${entry.name}`;
      }
      scanRoutes(path.join(dir, entry.name), nextBase);
    } else if (entry.name === "page.tsx" || entry.name === "page.jsx" || entry.name === "route.ts" || entry.name === "route.js") {
      const normalized = baseRoute || "/";
      existingRoutes.add(normalized);
    }
  }
}

scanRoutes(appDir, "");

console.log(`Found ${existingRoutes.size} valid page/API routes in app directory:`);

// Function to match a link against dynamic routes
function routeMatches(targetPath: string): boolean {
  // Strip query params and hashes
  const cleanPath = targetPath.split("?")[0].split("#")[0];
  if (!cleanPath.startsWith("/")) return true; // external or relative
  if (cleanPath === "") return true;

  if (existingRoutes.has(cleanPath)) return true;

  // Check dynamic matches like [id]
  const targetSegments = cleanPath.split("/").filter(Boolean);

  for (const route of existingRoutes) {
    const routeSegments = route.split("/").filter(Boolean);
    if (targetSegments.length !== routeSegments.length) continue;

    let match = true;
    for (let i = 0; i < targetSegments.length; i++) {
      if (routeSegments[i].startsWith("[") && routeSegments[i].endsWith("]")) {
        // matches any dynamic param
        continue;
      }
      if (routeSegments[i] !== targetSegments[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }

  return false;
}

// Find all files in src and scan for href="..." and router.push("...")
const brokenLinks: { file: string; line: number; link: string }[] = [];

function scanLinks(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanLinks(fullPath);
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, idx) => {
        // match href="/...", newHref="/...", fetch("/..."), router.push("/...")
        const urlMatches = line.matchAll(/(?:href|newHref|action|fetch)\s*[:=]\s*["'](\/[^"'`\s$]+)["']/g);
        for (const m of urlMatches) {
          const link = m[1];
          if (!routeMatches(link)) {
            brokenLinks.push({ file: path.relative(srcDir, fullPath), line: idx + 1, link });
          }
        }

        const pushMatches = line.matchAll(/(?:router\.push|fetch)\(["'](\/[^"'`\s$]+)["']/g);
        for (const m of pushMatches) {
          const link = m[1];
          if (!routeMatches(link)) {
            brokenLinks.push({ file: path.relative(srcDir, fullPath), line: idx + 1, link });
          }
        }
      });
    }
  }
}

scanLinks(srcDir);

console.log("\n=================================================");
console.log(`BROKEN / 404 ROUTE AUDIT RESULTS: ${brokenLinks.length} found`);
console.log("=================================================");
for (const b of brokenLinks) {
  console.log(`[404 LINK] ${b.file}:${b.line} -> "${b.link}"`);
}
