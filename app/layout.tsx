import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LangProvider } from "@/components/LangProvider";
import { LanguageToggle } from "@/components/LanguageToggle";

export const metadata: Metadata = {
  title: "LostArk Tool",
};

/**
 * Site frame: language state and the language toggle above every page.
 * @param props.children The current page.
 * @returns The html document.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LangProvider>
          <header>
            <LanguageToggle />
          </header>
          {children}
        </LangProvider>
      </body>
    </html>
  );
}
