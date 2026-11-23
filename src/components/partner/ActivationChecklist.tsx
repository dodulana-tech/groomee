"use client";

import Link from "next/link";

export interface ChecklistItem {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  href: string;
}

export interface ChecklistData {
  items: ChecklistItem[];
  done: number;
  total: number;
  complete: boolean;
  readyToGoOnline: boolean;
}

/**
 * Post-approval "get bookable" checklist shown on the partner dashboard
 * until every step is done.
 */
export default function ActivationChecklist({ data }: { data: ChecklistData }) {
  if (data.complete) return null;
  const pct = Math.round((data.done / data.total) * 100);
  const nextItem = data.items.find((i) => !i.done);

  return (
    <section
      aria-labelledby="activation-heading"
      className="relative overflow-hidden rounded-2xl border border-white/20 p-5 sm:p-6 shadow-lg"
      style={{
        background:
          "linear-gradient(135deg, rgba(1,67,66,0.96) 0%, rgba(1,67,66,0.88) 60%, rgba(83,235,100,0.35) 100%)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#53eb64" }}>
            Get bookable
          </p>
          <h2 id="activation-heading" className="mt-1 text-lg font-bold text-white">
            {data.readyToGoOnline ? "You're ready. Go online for your first job." : "Finish your profile to start getting jobs"}
          </h2>
          <p className="mt-0.5 text-sm text-white/70">
            Complete profiles get offered jobs first. {data.done} of {data.total} done.
          </p>
        </div>
        <span className="rounded-full px-3 py-1 text-sm font-black" style={{ background: "#fffea1", color: "#014342" }}>
          {pct}%
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#53eb64" }} />
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {data.items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className={`flex items-start gap-3 rounded-xl p-3 transition ${
                item.done ? "bg-white/5" : "bg-white/10 hover:bg-white/20"
              } ${nextItem?.key === item.key ? "ring-2 ring-[#53eb64]" : ""}`}
            >
              <span
                aria-hidden
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
                style={
                  item.done
                    ? { background: "#53eb64", color: "#014342" }
                    : { border: "2px solid rgba(255,255,255,0.4)" }
                }
              >
                {item.done ? "✓" : ""}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-semibold ${item.done ? "text-white/50 line-through" : "text-white"}`}>
                  {item.label}
                </span>
                {!item.done && <span className="block text-xs leading-snug text-white/60">{item.hint}</span>}
              </span>
              <span className="sr-only">{item.done ? "(done)" : "(to do)"}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
