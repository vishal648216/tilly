import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { getOutstandingReport } from "@/lib/outstanding";
import OutstandingClient from "./OutstandingClient";

export const dynamic = "force-dynamic";

export default async function OutstandingReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const report = await getOutstandingReport(company.id);

  return <OutstandingClient report={report} />;
}
