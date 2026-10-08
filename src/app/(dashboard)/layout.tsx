import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { getCompanySettings } from "@/lib/featureFlags";
import { CompanySettingsProvider } from "@/context/CompanySettingsContext";
import Sidebar from "@/components/Sidebar";
import TopNavbar from "@/components/TopNavbar";
import SuperAdminBanner from "@/components/SuperAdminBanner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const settings = (company as any).settings || (await getCompanySettings(company.id));
  const businessType = (company as any).businessType || "Retail";

  return (
    <CompanySettingsProvider settings={settings} businessType={businessType}>
      <div className="min-h-screen bg-slate-50/70">
        <Sidebar companyName={company.name} businessType={businessType} />
        <div className="lg:pl-64 flex flex-col min-h-screen">
          {user.role === "SUPER_ADMIN" && <SuperAdminBanner companyName={company.name} />}
          <TopNavbar companyName={company.name} userName={user.name} />
          <main className="flex-1 mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </CompanySettingsProvider>
  );
}
