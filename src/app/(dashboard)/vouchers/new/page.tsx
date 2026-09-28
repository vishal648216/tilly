import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import JournalEntryForm from "./JournalEntryForm";

export default async function NewVoucherPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const accounts = await prisma.account.findMany({
    where: { companyId: company.id },
    orderBy: [{ type: "asc" }, { code: "asc" }],
  });

  return (
    <div>
      <JournalEntryForm accounts={accounts} />
    </div>
  );
}
