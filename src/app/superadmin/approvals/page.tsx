import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ApprovalsClient from "./ApprovalsClient";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") redirect("/login");

  const pendingUsers = await prisma.user.findMany({
    where: { status: "PENDING" },
    include: {
      memberships: {
        include: { company: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <ApprovalsClient
      initialUsers={pendingUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        memberships: u.memberships.map((m) => ({
          role: m.role,
          company: {
            id: m.company.id,
            name: m.company.name,
            city: m.company.city,
            state: m.company.state,
            gstin: m.company.gstin,
            phone: m.company.phone,
          },
        })),
      }))}
    />
  );
}
