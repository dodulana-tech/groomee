import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center px-4">
      <div className="text-center">
        <div className="font-display text-[100px] font-black text-forest-500/20 leading-none mb-4">
          404
        </div>
        <h1 className="font-display text-3xl font-black text-ink mb-3">
          Page not found
        </h1>
        <p className="text-gray-400 mb-8 max-w-xs mx-auto">
          This page doesn't exist. Let's get you back on track.
        </p>
        <Link href="/" className="btn btn-forest">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
