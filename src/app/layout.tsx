import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Groomee - On-demand Beauty in Lagos",
    template: "%s | Groomee",
  },
  description:
    "Vetted hair, makeup, nails, lashes & barbing professionals delivered to your door in Lagos. No salon run. No traffic. Book in 60 seconds.",
  keywords: [
    "beauty Lagos",
    "makeup artist Lagos",
    "hair braiding at home Lagos",
    "nail technician Lagos",
    "on-demand beauty Nigeria",
    "beauty at home Lagos",
    "barbing Lagos",
    "lash extensions Lagos",
    "mobile hairstylist Lagos",
    "bridal makeup Lagos",
    "knotless braids Lagos",
    "gel nails at home",
    "emergency beauty Lagos",
    "Groomee",
  ],
  authors: [{ name: "Groomee" }],
  creator: "Groomee",
  publisher: "Groomee",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Groomee",
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "https://groomee.ng",
    siteName: "Groomee",
    title: "Groomee - Your beauty pro, at your door, right now",
    description:
      "Vetted beauty professionals delivered to your door in Lagos. Hair, makeup, nails, lashes & barbing. Book in 60 seconds.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Groomee - On-demand beauty professionals in Lagos",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Groomee - On-demand Beauty in Lagos",
    description:
      "Book a vetted beauty pro in 60 seconds. Delivered to your door in Lagos.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://groomee.ng",
  },
  category: "beauty",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://groomee.ng",
  ),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#014342",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#014342" />
        <meta
          name="msapplication-TileImage"
          content="/icons/icon-144x144.png"
        />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body
        style={{
          fontFamily: "'DM Sans', sans-serif",
          background: "#f7f5f0",
          color: "#0a0a0a",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
          minHeight: "100vh",
          overflowX: "hidden",
          margin: 0,
          padding: 0,
        }}
      >
        {children}
      </body>
    </html>
  );
}
