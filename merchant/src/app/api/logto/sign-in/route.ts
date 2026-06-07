import { signIn } from "@logto/next/server-actions";
import { redirect } from "next/navigation";
import { logtoConfig } from "@/lib/logto";

export async function GET() {
  await signIn(logtoConfig);
  redirect("/");
}
