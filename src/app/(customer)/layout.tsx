import Navbar from "@/components/customer/Navbar";
import MobileNav from "@/components/customer/MobileNav";

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="pt-14 lg:pt-[68px] pb-16 lg:pb-0">{children}</main>
      <MobileNav />
    </div>
  );
}
