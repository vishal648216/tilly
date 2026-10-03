import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentCompany } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/currency";
import SearchBar from "@/components/SearchBar";
import ItemsExportButton from "./ItemsExportButton";
import { Package, Wrench, Plus, AlertCircle, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ItemsPage({
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
      { sku: { contains: query, mode: "insensitive" } },
      { barcode: { contains: query, mode: "insensitive" } },
      { category: { contains: query, mode: "insensitive" } },
      { hsn: { contains: query, mode: "insensitive" } },
    ];
  }

  const items = await prisma.item.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const isInventoryEnabled = company.settings?.inventoryEnabled ?? true;
  const isServiceBusiness = company.businessType === "Service" || !isInventoryEnabled;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isServiceBusiness ? "Services & Catalog" : "Items & Inventory"}
          </h1>
          <p className="text-sm text-slate-500">
            {isServiceBusiness
              ? "Service offerings, rates, and tax configuration"
              : "Products, stock levels, and inventory valuation"}
          </p>
        </div>
        <div className="flex gap-2">
          <SearchBar placeholder="Search item, SKU, barcode, HSN..." defaultValue={query} />
          {items.length > 0 && (
            <ItemsExportButton
              items={items.map((i) => ({
                ...i,
                salePrice: i.salePrice.toString(),
                purchasePrice: i.purchasePrice.toString(),
                gstRate: i.gstRate.toString(),
                stock: i.stock.toString(),
              }))}
            />
          )}
          <Link href="/items/new" className="btn-primary inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" /> {isServiceBusiness ? "Add Service" : "Add Item"}
          </Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        {items.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Package className="h-6 w-6" />
            </div>
            <p className="text-slate-600 font-medium">
              {query ? `"${query}" ke liye koi item nahi mila.` : "Koi item nahi hai abhi."}
            </p>
            {query ? (
              <Link href="/items" className="btn-secondary mt-4 inline-flex">
                Clear search
              </Link>
            ) : (
              <Link href="/items/new" className="btn-primary mt-4 inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" /> Pehla item add karo
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Brand / Category / Barcode</th>
                <th className="px-4 py-3 font-medium">HSN/SAC</th>
                <th className="px-4 py-3 font-medium text-right">Sale Price</th>
                <th className="px-4 py-3 font-medium text-right">Cost Price</th>
                <th className="px-4 py-3 font-medium text-right">GST %</th>
                <th className="px-4 py-3 font-medium text-right">{isInventoryEnabled ? "Stock" : "Billing Unit"}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const isService = i.type === "SERVICE";
                const isLowStock = isInventoryEnabled && !isService && Number(i.stock) <= Number(i.minStock);
                return (
                  <tr key={i.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <div>
                        {i.name}
                        {i.sku && <span className="block text-xs font-mono text-slate-400">SKU: {i.sku}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge inline-flex items-center gap-1 ${
                          isService ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {isService ? <Wrench className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                        {isService ? "Service" : "Product"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      <div>
                        <div className="flex flex-wrap items-center gap-1">
                          {i.brand && (
                            <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              {i.brand}
                            </span>
                          )}
                          {i.category && <span className="font-medium text-slate-700">{i.category}</span>}
                        </div>
                        {i.barcode && (
                          <span className="block text-xs font-mono text-slate-400">Barcode: {i.barcode}</span>
                        )}
                        {!i.category && !i.barcode && !i.brand && "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-mono">{i.hsn ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {formatCurrency(i.salePrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {formatCurrency(i.purchasePrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">{i.gstRate.toString()}%</td>
                    <td className="px-4 py-3 text-right">
                      {!isInventoryEnabled || isService ? (
                        <span className="text-xs text-slate-500 font-medium">{i.unit || "Service"}</span>
                      ) : (
                        <span
                          className={`font-semibold ${
                            isLowStock ? "text-red-600 bg-red-50 px-2 py-0.5 rounded inline-flex items-center gap-1" : "text-emerald-700"
                          }`}
                        >
                          {Number(i.stock)} {i.unit}
                          {isLowStock && <span className="block text-[10px] font-normal text-red-500">(Low)</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
