import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const ENV_PASSWORD = process.env.APP_PASSWORD;
const COOKIE = "apto_session";
const ONE_YEAR = 60 * 60 * 24 * 365;

async function getActivePassword(): Promise<string | null> {
  try {
    const config = await db.appConfig.findUnique({ where: { key: "login_password" } });
    if (config?.value) return config.value;
  } catch {}
  return ENV_PASSWORD ?? null;
}

export async function POST(req: Request) {
  const { password } = await req.json();

  const activePassword = await getActivePassword();

  if (!activePassword) {
    return NextResponse.json({ error: "No password configured" }, { status: 500 });
  }

  if (password !== activePassword) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  // Cookie stores the env var so Edge middleware (which can't hit DB) can validate sessions
  const sessionValue = ENV_PASSWORD ?? activePassword;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: ONE_YEAR,
    path: "/",
  });
  return res;
}
