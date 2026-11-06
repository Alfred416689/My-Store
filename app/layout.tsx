import type { Metadata } from "next";
import { Bebas_Neue, Manrope } from "next/font/google";
import "./globals.css";

const display = Bebas_Neue({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "S2G | Curated Thrift",
  description:
    "S2G curates premium thrifted streetwear and vintage finds.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="min-h-full bg-[#111111] text-[#F5F2EC] antialiased">
        {children}
      </body>
    </html>
  );
}
