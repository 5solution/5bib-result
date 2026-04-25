import { redirect } from "next/navigation";

// Legacy login route — admin đã chuyển sang Clerk. Redirect vĩnh viễn.
export default function LegacyLoginPage() {
  redirect("/sign-in");
}
