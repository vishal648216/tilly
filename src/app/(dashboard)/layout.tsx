import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import Sidebar from "@/components/Sidebar";
import TopNavbar from "@/components/TopNavbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  return (
    <div className="min-h-screen bg-slate-50/70">
      <Sidebar companyName={company.name} />
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <TopNavbar companyName={company.name} userName={user.name} />
        <main className="flex-1 mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
