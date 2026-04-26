import { useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { cn } from "../../lib/utils";

export function FileUpload({ onChange, accept = "application/pdf", className }) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [hover, setHover] = useState(false);

  function handleFiles(list) {
    const next = Array.from(list || []);
    if (!next.length) return;
    setFiles(next);
    onChange?.(next);
  }

  function onClick() {
    inputRef.current?.click();
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setHover(false);
    handleFiles(e.dataTransfer.files);
  }

  function onDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    setHover(true);
  }

  function onDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    setHover(false);
  }

  function clearFiles(e) {
    e?.stopPropagation();
    setFiles([]);
    onChange?.([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={cn("w-full", className)}>
      <button
        type="button"
        onClick={onClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={cn(
          "group relative flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          hover ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/40"
        )}
      >
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full bg-muted transition-transform",
            hover ? "scale-110" : "group-hover:scale-105"
          )}
        >
          <Upload className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium">
          {hover ? "Drop your file here" : "Click or drag a file to upload"}
        </p>
        <p className="text-xs text-muted-foreground">
          PDF only. Max ~6MB.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </button>

      {files.length ? (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center justify-between rounded border bg-card p-2 text-sm"
              style={{ animation: "tabContentFadeIn 220ms ease-out" }}
            >
              <span className="flex items-center gap-2 truncate">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{f.name}</span>
                <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                  {Math.max(1, Math.round(f.size / 1024))} KB
                </span>
              </span>
              <button
                type="button"
                onClick={clearFiles}
                aria-label="Remove file"
                className="ml-2 rounded p-1 hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default FileUpload;
