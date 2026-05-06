"use client";

import { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { TaskLink } from "./TaskLink";
import { WikiLink } from "./WikiLink";

export function DescriptionPreview({
  value,
  placeholder,
}: {
  value: string;
  placeholder: string;
}) {
  const mdComponents = useMemo<
    React.ComponentProps<typeof ReactMarkdown>["components"]
  >(
    () => ({
      code({ className, children, ...props }) {
        const match = /language-(\w+)/.exec(className ?? "");
        const isInline = !className;
        if (!isInline && match) {
          return (
            <SyntaxHighlighter
              style={oneLight}
              language={match[1]}
              PreTag="div"
              customStyle={{
                borderRadius: "0.375rem",
                fontSize: "0.78rem",
                margin: "0.5rem 0",
              }}
            >
              {String(children as string).replace(/\n$/, "")}
            </SyntaxHighlighter>
          );
        }
        return (
          <code
            className="text-pink-600 bg-gray-100 px-1 rounded text-xs"
            {...props}
          >
            {children}
          </code>
        );
      },
      a({ href, children, ...props }) {
        const rawHref = href || "";
        const decodedHref = decodeURIComponent(rawHref);
        const taskUuidMatch = decodedHref.match(
          /task:(?:[^/]*\/)?([0-9a-fA-F-]{36})/,
        );
        const taskId =
          taskUuidMatch?.[1] ||
          (decodedHref.startsWith("task://")
            ? decodedHref.replace("task://", "")
            : null);
        const isTaskLink =
          !!taskId &&
          (decodedHref.includes("task:") || decodedHref.startsWith("task://"));

        const wikiIdMatch = decodedHref.match(
          /wiki:(?:[^/]*\/)?([0-9a-fA-F-]{36})/,
        );
        const pageId =
          wikiIdMatch?.[1] ||
          (decodedHref.startsWith("wiki://")
            ? decodedHref.replace("wiki://", "")
            : null);
        const isWikiLink =
          !!pageId &&
          (decodedHref.includes("wiki:") || decodedHref.startsWith("wiki://"));

        if (isTaskLink && taskId)
          return <TaskLink taskId={taskId}>{children}</TaskLink>;
        if (isWikiLink && pageId)
          return <WikiLink pageId={pageId}>{children}</WikiLink>;

        const isExternal =
          rawHref.startsWith("http") &&
          !rawHref.includes(
            typeof window !== "undefined" ? window.location.hostname : "",
          );

        return (
          <a
            href={rawHref}
            className="text-blue-600 hover:underline"
            target={isExternal ? "_blank" : "_self"}
            rel="noopener noreferrer"
            {...props}
          >
            {children}
          </a>
        );
      },
    }),
    [],
  );

  return value ? (
    <div className="prose prose-sm max-w-none text-gray-700 prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1 prose-li:my-0 prose-pre:p-0 prose-pre:bg-transparent prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={mdComponents}
        urlTransform={(uri) => uri}
      >
        {value}
      </ReactMarkdown>
    </div>
  ) : (
    <span className="text-gray-400 text-sm">{placeholder}</span>
  );
}
