"use client";

import "@/styles/globals.css";

import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}

function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const showHeader = pathname !== "/" && !pathname.startsWith("/workout");

  return (
    <html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-title" content="Lift" />
      </head>
      <body
        className={cn(
          "flex min-h-screen flex-col bg-[#fbfaf7] font-sans antialiased",
          geist.variable,
        )}
      >
        <TRPCReactProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            disableTransitionOnChange
          >
            <main className="mx-auto flex w-full max-w-[390px] flex-grow flex-col">
              {showHeader ? (
                <header className="flex h-16 items-center justify-between gap-4 p-4">
                  <div className="flex gap-4">
                    <Link href="/">Home</Link>
                    <Link href="/calc">Calculator</Link>
                  </div>
                  <AuthStatus />
                </header>
              ) : null}
              {children}
            </main>
            <Toaster />
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}

function AuthStatus() {
  const { data: session } = authClient.useSession();

  if (!session?.user) {
    return (
      <Button asChild variant="outline">
        <Link href="/">sign in</Link>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={() => {
        void authClient.signOut();
      }}
    >
      sign out
    </Button>
  );
}
