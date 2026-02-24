import type { Metadata, Viewport } from "next";
import "./globals.css";
// Using system fonts to avoid remote font fetches during offline builds.
const dmSans = { variable: "" };
const playfair = { variable: "" };

export const metadata: Metadata = {
  title: {
    default: "Groomee — On-demand Grooming in Lagos",
    template: "%s | Groomee",
  },
  description:
    "Professional hair, makeup, nails, lashes & barbing delivered to your door in Lagos. Available 24/7 — late nights, early mornings, and last-minute bookings.",
  keywords: [
    "grooming Lagos",
    "makeup artist Lagos",
    "hair braiding at home",
    "nail technician Lagos",
    "on-demand grooming Nigeria",
    "beauty at home",
  ],
  authors: [{ name: "Groomee" }],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Groomee",
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "https://groomee.ng",
    siteName: "Groomee",
    title: "Groomee — Your groomer, at your door, right now",
    description:
      "Professional grooming delivered to your home in Lagos. Hair, makeup, nails, lashes & barbing. Book in 60 seconds.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Groomee — On-demand Grooming in Lagos",
    description:
      "Book a professional groomer in 60 seconds. Delivered to your door.",
  },
  robots: { index: true, follow: true },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://groomee.ng",
  ),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2D6A4F",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#2D6A4F" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className="font-sans antialiased bg-white text-gray-900 min-h-screen overscroll-none">
        {children}
      </body>
    </html>
  );
}
