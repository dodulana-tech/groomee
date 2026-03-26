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
      <main className="pt-[68px]">{children}</main>
      <MobileNav />
    </div>
  );
}
