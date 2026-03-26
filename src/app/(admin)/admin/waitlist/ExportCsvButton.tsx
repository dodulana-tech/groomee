"use client";

interface WaitlistEntry {
  id: string;
  createdAt: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string;
  area: string | null;
  role: string;
}

export default function ExportCsvButton({ entries }: { entries: WaitlistEntry[] }) {
  function downloadCsv() {
    const headers = ["Date", "Name", "Phone", "Email", "City", "Area", "Role"];
    const rows = entries.map((e) => [
      new Date(e.createdAt).toISOString(),
      e.name ?? "",
      e.phone ?? "",
      e.email ?? "",
      e.city,
      e.area ?? "",
      e.role,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={downloadCsv}
      className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition-colors"
    >
      ↓ Export CSV
    </button>
  );
}
