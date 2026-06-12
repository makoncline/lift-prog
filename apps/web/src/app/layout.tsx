"use client";

import "@/styles/globals.css";

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
import Link from "next/link";
import { Button } from "@/components/ui/button";

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
        <head>
          <meta name="apple-mobile-web-app-title" content="Lift" />
        </head>
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
                <header className="flex h-16 items-center justify-between gap-4 p-4">
                  <div className="flex gap-4">
                    <Link href="/">Home</Link>
                    <Link href="/calc">Calculator</Link>
                  </div>
                  <div className="flex gap-2">
                    <SignedOut>
                      <Button asChild variant="outline">
                        <SignInButton />
                      </Button>
                      <Button asChild variant="outline">
                        <SignUpButton />
                      </Button>
                    </SignedOut>
                    <SignedIn>
                      <UserButton />
                    </SignedIn>
                  </div>
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
