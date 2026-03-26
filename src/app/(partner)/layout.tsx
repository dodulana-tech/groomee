import PartnerSidebar from "@/components/partner/PartnerSidebar";
import PartnerBottomNav from "@/components/partner/PartnerBottomNav";

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-cream-50">
      <PartnerSidebar />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
      <PartnerBottomNav />
    </div>
  );
}
