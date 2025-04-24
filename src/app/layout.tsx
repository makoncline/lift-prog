import "@/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

import { TRPCReactProvider } from "@/trpc/react";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Lift Prog",
  description: "Track your workouts effectively.",
  manifest: "/manifest.webmanifest",
  themeColor: "#ffffff",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lift Prog",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
        <head>{/* Manifest link handled by next-pwa */}</head>
        <body
          className={cn(
            "bg-background flex min-h-screen flex-col font-sans antialiased",
            geist.variable,
          )}
        >
          <TRPCReactProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              disableTransitionOnChange
            >
              <main className="mx-auto flex w-full max-w-md flex-grow flex-col">
                <header className="flex h-16 items-center justify-end gap-4 p-4">
                  <SignedOut>
                    <SignInButton />
                    <SignUpButton />
                  </SignedOut>
                  <SignedIn>
                    <UserButton />
                  </SignedIn>
                </header>
                {children}
              </main>
              <Toaster />
            </ThemeProvider>
          </TRPCReactProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
