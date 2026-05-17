import type { Metadata } from "next";
import {
  Fraunces,
  Geist,
  Geist_Mono,
  Inter,
  JetBrains_Mono,
  Lora,
  Playfair_Display,
  Space_Grotesk,
} from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "@iedora/design-system/styles.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Iedora editorial fonts re-pointed to design-system tokens (--serif / --mono)
// below so design-system primitives render in Fraunces / JetBrains Mono
// without pulling Google Fonts CSS at runtime.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  axes: ["opsz"],
  subsets: ["latin"],
  display: "swap",
});
const jbMono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
  display: "swap",
});

// Theme fonts — exposed as CSS variables so the public menu page can switch
// font-family per restaurant.theme without re-rendering at the html level.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});
const lora = Lora({ variable: "--font-lora", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Menu — an iedora product", template: "%s · Menu" },
  description: "Digital restaurant menus, drag-and-drop. An iedora product.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Locale comes from the cookie set by setUserLocale; falls back to 'en' when
  // absent. The public menu page overrides `lang` on its inner wrapper for
  // anonymous visitors who don't carry a locale cookie.
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} ${playfair.variable} ${lora.variable} ${spaceGrotesk.variable} ${fraunces.variable} ${jbMono.variable} h-full antialiased`}
      style={{
        ['--serif' as string]:
          "var(--font-fraunces), 'Times New Roman', serif",
        ['--mono' as string]:
          'var(--font-jbmono), ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
