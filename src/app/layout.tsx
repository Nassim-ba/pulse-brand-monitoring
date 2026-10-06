import type { Metadata, Viewport } from "next";
import { Roboto_Flex } from "next/font/google";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { Providers } from "@/components/Providers";
import "./globals.css";

const roboto = Roboto_Flex({ variable: "--font-roboto-flex", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Pulse · Brand Monitoring",
  description: "KI-gestütztes Brand Monitoring: Relevanz, Stimmung, Themen und Handlungsbedarf auf einen Blick.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9ff" },
    { media: "(prefers-color-scheme: dark)", color: "#111318" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={roboto.variable} suppressHydrationWarning>
      <body>
        <InitColorSchemeScript attribute="class" />
        <AppRouterCacheProvider>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
