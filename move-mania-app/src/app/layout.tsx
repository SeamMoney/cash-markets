import type { Metadata } from "next";
import { Bai_Jamjuree, Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react"
import { Providers } from "./Providers";
import ClientLayout from "./ClientLayout";

const baijamjuree = Bai_Jamjuree({
  weight: ['200', '300', '400', '500', '600'],
  subsets: ['latin'],
});
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cash Markets",
  description: "Predict the Crash, Win the $CASH!",
  generator: "Next.js",
  manifest: "/manifest.json",
  keywords: ["nextjs", "nextjs13", "next13", "pwa", "next-pwa", "aptos"],
  authors: [
    { name: "Daniel Leavitt" },
    { name: "Max Mohammadi" },
  ],
  icons: [
    { rel: "apple-touch-icon", url: "./../public/CASH_IOS_ICON.svg" },
    { rel: "icon", url: "./../public/CASH_IOS_ICON.svg" },
  ],
};

export const viewport = {
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#000" }],
  viewport: "minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, viewport-fit=cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <Analytics />
      <body className={baijamjuree.className + " text-white bg-[#020202] bg-noise"}>
        <Providers>
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
}