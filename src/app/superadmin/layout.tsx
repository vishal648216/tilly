import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import SuperAdminSidebar from "./SuperAdminSidebar";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // Strict superadmin access guard
  if (!user || user.role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  // Count pending approvals for badge
  const pendingCount = await prisma.user.count({
    where: { status: "PENDING" },
  });

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 antialiased">
      <SuperAdminSidebar
        adminName={user.name}
        adminEmail={user.email}
        pendingCount={pendingCount}
      />
      <main className="flex-1 lg:pl-64 min-w-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
