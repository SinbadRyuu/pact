import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PACT Onboarding — Dev Shell",
  description: "Development/testing environment for the PACT onboarding widget.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
