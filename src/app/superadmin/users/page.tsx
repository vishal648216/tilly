import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import UsersClient from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function SuperAdminUsersPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") redirect("/login");

  const users = await prisma.user.findMany({
    include: {
      memberships: {
        include: {
          company: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <UsersClient
      initialUsers={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt.toISOString(),
        memberships: u.memberships.map((m) => ({
          role: m.role,
          company: {
            id: m.company.id,
            name: m.company.name,
          },
        })),
      }))}
    />
  );
}
