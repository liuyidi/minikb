"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "@minikb/ui/lib/utils";

function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      data-slot="markdown"
      className={cn(
        "prose prose-sm max-w-none text-foreground prose-headings:tracking-tight prose-a:text-foreground prose-code:rounded prose-code:bg-muted prose-code:px-1",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

export { Markdown };
