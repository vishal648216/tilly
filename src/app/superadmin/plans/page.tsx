import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ensureDefaultPlans } from "@/lib/plans";
import PlansClient from "./PlansClient";

export const dynamic = "force-dynamic";

export default async function SuperAdminPlansPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") redirect("/login");

  await ensureDefaultPlans();

  const plans = await prisma.plan.findMany({
    include: {
      features: true,
      _count: {
        select: { subscriptions: true },
      },
    },
    orderBy: { price: "asc" },
  });

  return <PlansClient initialPlans={plans} />;
}
