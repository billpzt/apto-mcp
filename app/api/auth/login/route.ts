import { NextResponse } from "next/server";
import { createSessionToken, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

const PASSWORD = process.env.APP_PASSWORD;
const COOKIE = "apto_session";

export async function POST(req: Request) {
  const { password } = await req.json();

  if (!PASSWORD) {
    return NextResponse.json({ error: "No password configured" }, { status: 500 });
  }
  if (password !== PASSWORD) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  // The cookie carries a signed, expiring token rather than the password, so a
  // stolen cookie cannot be replayed as the credential itself and rotating
  // APP_PASSWORD invalidates it. The proxy verifies it with a signature check,
  // no database round trip needed on every request (see lib/session.ts).
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await createSessionToken(PASSWORD), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return res;
}
