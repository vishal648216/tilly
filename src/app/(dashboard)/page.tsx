import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { resolveDateRange } from "@/lib/financialYear";
import { getDashboardAnalytics } from "@/lib/reports";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  // Default to Current Financial Year
  const dateRange = await resolveDateRange({
    companyId: company.id,
    preset: "CURRENT_FY",
  });

  const initialData = await getDashboardAnalytics({
    companyId: company.id,
    from: dateRange.from,
    to: dateRange.to,
    periodLabel: dateRange.label,
  });

  return (
    <DashboardClient
      initialData={initialData}
      companyName={company.name}
      userName={user.name}
    />
  );
}
