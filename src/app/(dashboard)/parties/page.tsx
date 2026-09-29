import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import SearchBar from "@/components/SearchBar";
import PartiesExportButton from "./PartiesExportButton";
import { Users, Plus, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const company = await getCurrentCompany();
  if (!company) redirect("/onboarding");

  const query = searchParams.q?.trim() || "";
  const where: any = { companyId: company.id };
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } },
      { gstin: { contains: query, mode: "insensitive" } },
      { city: { contains: query, mode: "insensitive" } },
      { email: { contains: query, mode: "insensitive" } },
    ];
  }

  const parties = await prisma.party.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-brand-600" /> Parties Directory
          </h1>
          <p className="text-sm text-slate-500">Customers & Suppliers Management</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchBar placeholder="Search name, phone, GSTIN..." defaultValue={query} />
          {parties.length > 0 && <PartiesExportButton parties={parties} />}
          <Link href="/parties/new" className="btn-primary flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> Add Party
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        {parties.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <p className="text-base font-medium text-slate-600">
              {query ? `"${query}" ke liye koi party nahi mili.` : "Koi party nahi hai abhi."}
            </p>
            {query ? (
              <Link href="/parties" className="btn-secondary mt-4 inline-flex">
                Clear search
              </Link>
            ) : (
              <Link href="/parties/new" className="btn-primary mt-4 inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> Pehla party add karo
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Phone</th>
                <th className="px-6 py-3">GSTIN</th>
                <th className="px-6 py-3">City</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parties.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-900">
                    <Link href={`/parties/${p.id}`} className="text-brand-600 hover:text-brand-700">
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        p.type === "CUSTOMER"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {p.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{p.phone ?? "—"}</td>
                  <td className="px-6 py-4 text-slate-600 font-mono">{p.gstin ?? "—"}</td>
                  <td className="px-6 py-4 text-slate-600">{p.city ?? "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/parties/${p.id}`}
                        className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition-colors"
                      >
                        360° Profile
                      </Link>
                      <Link
                        href={`/ledger?partyId=${p.id}`}
                        className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
                      >
                        Ledger
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
