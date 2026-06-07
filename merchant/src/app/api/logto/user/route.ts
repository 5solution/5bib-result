import { getLogtoContext } from "@logto/next/server-actions";
import { NextResponse } from "next/server";
import { logtoConfig } from "@/lib/logto";

export async function GET() {
  const ctx = await getLogtoContext(logtoConfig, { fetchUserInfo: true });
  return NextResponse.json({
    isAuthenticated: ctx.isAuthenticated,
    claims: ctx.claims ?? null,
    userInfo: ctx.userInfo ?? null,
    scopes: ctx.scopes ?? [],
  });
}
