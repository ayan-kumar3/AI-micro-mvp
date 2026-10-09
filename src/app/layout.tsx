import type { Metadata } from "next";
import "./globals.css";
import "./animations.css";
import { ThemeProvider } from "./theme-context";

export const metadata: Metadata = {
  title: "Unread — What did I miss?",
  description:
    "Catch up on group conversations with Gemini-powered summaries, priorities, tasks, and deadlines.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
