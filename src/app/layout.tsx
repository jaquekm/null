import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { RegisterServiceWorker } from "@/components/shared/register-service-worker";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JKode",
  description: "Sistema pessoal de organização",
  // iOS não lê o manifest.json para "Adicionar à Tela de Início" — precisa dessas tags à parte.
  appleWebApp: {
    capable: true,
    title: "JKode",
    statusBarStyle: "black-translucent",
  },
  // Ícones vêm dos arquivos de convenção do Next em `src/app` (icon.svg, favicon.ico, apple-icon.png) — logo "JK" do JKode.
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-center" />
          <RegisterServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
