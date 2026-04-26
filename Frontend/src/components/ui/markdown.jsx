import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";
import { cn } from "../../lib/utils";

export function Markdown({ children, className }) {
  const text = typeof children === "string" ? children : String(children ?? "");
  return (
    <div
      className={cn(
        "text-[14px] leading-7",
        // Headings
        "[&_h1]:mt-0 [&_h1]:mb-2 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold",
        "[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold",
        // Paragraphs / lists
        "[&_p]:my-1 [&_p]:whitespace-pre-wrap",
        "[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5",
        "[&_li]:my-0.5",
        "[&_strong]:font-semibold [&_em]:italic",
        // Inline code
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5",
        "[&_code]:font-mono [&_code]:text-[12.5px]",
        // Block code (rendered inside <pre>)
        "[&_pre]:my-2 [&_pre]:overflow-auto [&_pre]:rounded-lg",
        "[&_pre]:border [&_pre]:bg-[#0d1117] [&_pre]:p-3 [&_pre]:shadow-sm",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[12.5px]",
        "[&_pre_code]:leading-6 [&_pre_code]:text-zinc-100",
        // Tables
        "[&_table]:my-2 [&_table]:w-full [&_table]:text-sm [&_table]:border-collapse",
        "[&_th]:border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
        "[&_td]:border [&_td]:px-2 [&_td]:py-1",
        // Links
        "[&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:opacity-80",
        // Blockquotes
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3",
        "[&_blockquote]:italic [&_blockquote]:text-muted-foreground",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default Markdown;
