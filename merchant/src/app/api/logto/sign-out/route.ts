import { signOut } from "@logto/next/server-actions";
import { redirect } from "next/navigation";
import { logtoConfig } from "@/lib/logto";

export async function GET() {
  await signOut(logtoConfig);
  redirect("/sign-in");
}
