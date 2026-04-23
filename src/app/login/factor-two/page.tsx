import { redirect } from "next/navigation";

export default function LegacyFactorTwoRedirectPage() {
  redirect("/login");
}
