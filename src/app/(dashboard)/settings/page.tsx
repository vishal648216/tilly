import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { getCompanySettings } from "@/lib/featureFlags";
import { prisma } from "@/lib/prisma";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const [settings, customFields] = await Promise.all([
    getCompanySettings(company.id),
    prisma.customFieldDefinition.findMany({
      where: { companyId: company.id },
      orderBy: [{ entityType: "asc" }, { displayOrder: "asc" }],
    }),
  ]);

  return (
    <SettingsClient
      company={company as any}
      initialSettings={settings}
      initialCustomFields={customFields}
    />
  );
}
