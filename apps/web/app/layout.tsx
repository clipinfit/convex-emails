import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import "./global.css";
export const metadata: Metadata = {
  title: {
    default: "convex-emails · Email delivery. On your terms.",
    template: "%s · convex-emails",
  },
  description:
    "Persistent email delivery for Convex. Plunk and Resend adapters, automatic scheduling, provider-aware retries, and recipient restrictions.",
};
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
