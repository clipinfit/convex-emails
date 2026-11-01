import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Mail } from "lucide-react";
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="brand docs-brand">
          <span className="brand-icon">
            <Mail size={18} />
          </span>
          convex-emails
        </span>
      ),
    },
    links: [{ text: "Home", url: "/" }],
    githubUrl: "https://github.com/clipinfit/convex-emails",
  };
}
