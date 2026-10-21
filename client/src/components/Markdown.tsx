import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { researchLinkToRoute } from "@/lib/format";

const components: Components = {
  a({ href, children }) {
    if (!href) return <span>{children}</span>;
    const route = researchLinkToRoute(href);
    if (route) return <Link href={route}>{children}</Link>;
    if (/^https?:\/\//.test(href)) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    }
    return <span title={href}>{children}</span>;
  },
  table({ children }) {
    return (
      <div className="table-wrap">
        <table>{children}</table>
      </div>
    );
  },
  img({ alt }) {
    // Images embedded in research reports are not re-hosted; show the alt text only.
    return <span className="text-ink-faint">[이미지: {alt || "설명 없음"}]</span>;
  },
};

/** Renders a research report body as-is (GFM tables, task lists), with MD cross-links mapped to app routes. */
export function Markdown({ children }: { children: string }) {
  if (!children.trim()) return <p className="text-sm text-ink-faint">본문이 비어 있습니다.</p>;
  return (
    <div className="report">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
