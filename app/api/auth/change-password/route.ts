import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const ENV_PASSWORD = process.env.APP_PASSWORD;
const COOKIE = "apto_session";

async function getActivePassword(): Promise<string | null> {
  try {
    const config = await db.appConfig.findUnique({ where: { key: "login_password" } });
    if (config?.value) return config.value;
  } catch {}
  return ENV_PASSWORD ?? null;
}

export async function POST(req: Request) {
  // Verify the user is authenticated
  const cookieStore = await cookies();
  const session = cookieStore.get(COOKIE)?.value;
  if (!session || session !== ENV_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();

  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
  }

  const activePassword = await getActivePassword();
  if (currentPassword !== activePassword) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  await db.appConfig.upsert({
    where: { key: "login_password" },
    update: { value: newPassword },
    create: { key: "login_password", value: newPassword },
  });

  return NextResponse.json({ ok: true });
}
