import { PrismaClient } from "@prisma/client";
import path from "path";

// Turbopack resolves relative `file:` paths from the bundle location, not the
// project root, which causes SQLite CANTOPEN errors at runtime. Force an
// absolute path so the DB is always found regardless of bundler CWD.
function resolveDbUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (url?.startsWith("file:./") || url?.startsWith("file:../")) {
    const rel = url.slice("file:".length);
    return `file:${path.resolve(process.cwd(), rel)}`;
  }
  return url;
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Only override the datasource when we actually resolved a URL. Passing
// `url: undefined` makes the PrismaClient constructor throw, which breaks
// `next build` on environments without DATABASE_URL (e.g. Vercel preview
// deploys). When undefined, let Prisma read DATABASE_URL from env lazily.
const resolvedDbUrl = resolveDbUrl();

export const db =
  globalForPrisma.prisma ||
  new PrismaClient({
    ...(resolvedDbUrl ? { datasources: { db: { url: resolvedDbUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
