import { CityHub, cityMetadata } from "@/components/seo/pages";

export const revalidate = 3600;
export const metadata = cityMetadata("lagos");

export default function LagosPage() {
  return <CityHub city="lagos" />;
}
