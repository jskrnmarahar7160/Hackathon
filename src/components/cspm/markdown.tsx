// Lightweight markdown renderer for the AI remediation playbook.
// Uses react-markdown with Tailwind classes (no @tailwindcss/typography
// dependency) so the playbook reads cleanly inside the finding drawer.

"use client";

import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export function MarkdownPlaybook({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("text-sm leading-relaxed text-foreground", className)}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h2 className="mt-3 mb-2 text-base font-semibold">{children}</h2>,
          h2: ({ children }) => <h2 className="mt-3 mb-2 text-base font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-3 mb-1.5 text-sm font-semibold">{children}</h3>,
          h4: ({ children }) => <h4 className="mt-2 mb-1 text-sm font-semibold">{children}</h4>,
          p: ({ children }) => <p className="my-1.5">{children}</p>,
          ul: ({ children }) => <ul className="my-1.5 ml-4 list-disc space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1.5 ml-4 list-decimal space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          code: ({ className: cls, children, ...props }) => {
            const isBlock = String(children).includes("\n") || (cls ?? "").includes("language-");
            if (isBlock) {
              return (
                <pre className="my-2 overflow-x-auto rounded-md bg-muted/80 p-2.5">
                  <code className="font-mono text-xs leading-relaxed">{children}</code>
                </pre>
              );
            }
            return (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs" {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-600 underline dark:text-violet-400">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-muted-foreground/40 pl-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-3 border-muted" />,
          table: ({ children }) => (
            <table className="my-2 w-full border-collapse text-xs">{children}</table>
          ),
          th: ({ children }) => <th className="border border-muted p-1.5 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-muted p-1.5">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
