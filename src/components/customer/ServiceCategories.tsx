import Link from "next/link";
import type { Service } from "@/types";
import { getServiceCategoryIcon } from "@/lib/utils";
import { formatNaira } from "@/lib/utils";

interface Props {
  services: Service[];
}

const CATEGORY_INFO: Record<
  string,
  { desc: string; color: string; bg: string }
> = {
  HAIR: {
    desc: "Braids, weaves, natural styles & treatments",
    color: "text-brand-700",
    bg: "bg-brand-50",
  },
  MAKEUP: {
    desc: "Full glam, soft glam, bridal & special occasions",
    color: "text-pink-700",
    bg: "bg-pink-50",
  },
  NAILS: {
    desc: "Gel, acrylic, extensions & classic mani-pedi",
    color: "text-purple-700",
    bg: "bg-purple-50",
  },
  BARBING: {
    desc: "Fades, cuts, shape-ups & beard grooming",
    color: "text-blue-700",
    bg: "bg-blue-50",
  },
  LASHES: {
    desc: "Classic, volume & mega-volume extensions",
    color: "text-rose-700",
    bg: "bg-rose-50",
  },
  SKINCARE: {
    desc: "Facial treatments, glow packages & more",
    color: "text-amber-700",
    bg: "bg-amber-50",
  },
};

export default function ServiceCategories({ services }: Props) {
  const categories = [...new Set(services.map((s) => s.category))];

  return (
    <section id="services" className="section bg-white">
      <div className="container">
        <div className="section-header">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600 mb-3">
            Services
          </p>
          <h2 className="font-display text-3xl font-bold text-gray-900 sm:text-4xl">
            Everything you need,
            <br />
            <span className="text-brand-600">at your doorstep</span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-gray-500">
            From last-minute touch-ups to full event glam — our vetted groomers
            cover all your beauty needs.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const catServices = services.filter((s) => s.category === cat);
            const minPrice = Math.min(
              ...catServices.map((s) => s.minPrice ?? s.basePrice),
            );
            const info = CATEGORY_INFO[cat] ?? {
              desc: "",
              color: "text-gray-700",
              bg: "bg-gray-50",
            };
            const slug = catServices[0]?.slug;

            return (
              <Link
                key={cat}
                href={`/search?service=${slug}`}
                className="card-hover flex gap-4 p-5"
              >
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl ${info.bg}`}
                >
                  {getServiceCategoryIcon(cat)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-bold ${info.color}`}>
                      {cat.charAt(0) + cat.slice(1).toLowerCase()}
                    </h3>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                      {catServices.length} services
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 leading-snug">
                    {info.desc}
                  </p>
                  <p className="mt-2 text-sm font-bold text-gray-900">
                    From {formatNaira(minPrice)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
