import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdmin, hasPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { assistantEnabled } from "@/lib/assistant/engine";
import CopilotChat from "./CopilotChat";

export const metadata: Metadata = { title: "Ops copilot" };
export const revalidate = 0;

export default async function AdminCopilotPage() {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    redirect("/admin/login");
  }
  if (!hasPermission(session, PERMISSIONS.COPILOT_USE)) redirect("/admin");

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col p-6 lg:h-dvh lg:p-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Ops copilot</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ask about bookings, pros, customers, disputes and weekly numbers. Read-only — it sees only
          what your role can see, drafts messages but never sends them, and every question is logged.
        </p>
      </div>
      {assistantEnabled() ? (
        <CopilotChat />
      ) : (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          The copilot is off. Set <code className="font-mono">ANTHROPIC_API_KEY</code> on the Render web
          service to turn it on.
        </div>
      )}
    </div>
  );
}
