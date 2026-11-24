import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "KVM Staff Collective | Café & Tuck Shop",
  description:
    "A unified staff café, tuck shop, kitchen and inventory demo workspace.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
