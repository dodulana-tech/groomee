import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { format } from "date-fns";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Surveys | Admin" };
export const revalidate = 0;

export default async function AdminSurveysPage() {
  await requireAdmin();

  const responses = await db.surveyResponse.findMany({
    orderBy: { createdAt: "desc" },
  });

  const total = responses.length;
  const customerCount = responses.filter((r) => r.type === "customer").length;
  const vendorCount = responses.filter((r) => r.type === "vendor").length;

  // Collect all unique answer keys for table header awareness
  const allKeys = Array.from(
    new Set(
      responses.flatMap((r) =>
        r.answers && typeof r.answers === "object" && !Array.isArray(r.answers)
          ? Object.keys(r.answers as Record<string, unknown>)
          : [],
      ),
    ),
  );

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Surveys</h1>
        <p className="mt-1 text-sm text-gray-500">
          {total} total response{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500 font-medium">Total Responses</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{total}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500 font-medium">Customer</p>
          <p className="text-3xl font-bold text-brand-700 mt-1">
            {customerCount}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500 font-medium">Vendor / Pro</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{vendorCount}</p>
        </div>
      </div>

      {/* Responses table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          All Responses
        </h2>

        {responses.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-3xl mb-3">📊</p>
            <p className="font-semibold text-gray-600">No survey responses yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Responses will appear here once customers or vendors complete the survey.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                    Date
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                    Type
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                    Phone
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                    Email
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                    Answers
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {responses.map((r) => {
                  const answers =
                    r.answers && typeof r.answers === "object" && !Array.isArray(r.answers)
                      ? (r.answers as Record<string, unknown>)
                      : {};

                  return (
                    <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-3 text-gray-500 whitespace-nowrap text-xs">
                        {format(new Date(r.createdAt), "dd MMM yyyy, HH:mm")}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={[
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                            r.type === "customer"
                              ? "bg-blue-100 text-blue-700"
                              : r.type === "vendor"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600",
                          ].join(" ")}
                        >
                          {r.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-700">
                        {r.phone ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3 text-gray-700">
                        {r.email ?? <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          {Object.entries(answers).map(([key, val]) => (
                            <div key={key} className="flex gap-1.5 text-xs">
                              <span className="font-medium text-gray-500 shrink-0">
                                {key}:
                              </span>
                              <span className="text-gray-700 break-all">
                                {Array.isArray(val)
                                  ? val.join(", ")
                                  : String(val ?? "")}
                              </span>
                            </div>
                          ))}
                          {Object.keys(answers).length === 0 && (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
