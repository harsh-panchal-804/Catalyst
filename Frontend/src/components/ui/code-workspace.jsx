import { useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  Check,
  Copy,
  Maximize2,
  Minimize2,
  RotateCcw,
  Sparkles,
  Sun,
  Moon,
  Type,
  WrapText
} from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";
import { cn } from "../../lib/utils";

const FONT_STEPS = [11, 12, 13, 14, 15, 16, 18];

export function CodeWorkspace({
  language,
  monacoLanguage,
  value,
  onChange,
  boilerplate,
  height = 360,
  disabled = false,
  className
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const [theme, setTheme] = useState("vs-dark");
  const [fontIdx, setFontIdx] = useState(2);
  const [wrap, setWrap] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [pos, setPos] = useState({ lineNumber: 1, column: 1 });
  const [copied, setCopied] = useState(false);

  const charCount = (value || "").length;
  const lineCount = (value || "").split(/\r?\n/).length;
  const isDark = theme === "vs-dark";
  const fontSize = FONT_STEPS[fontIdx];

  function handleMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onDidChangeCursorPosition((e) => setPos(e.position));
    try {
      // Ctrl/Cmd+S formats the document instead of trying to save the page.
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        editor.getAction("editor.action.formatDocument")?.run();
      });
    } catch (_e) {
      // ignore
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(value || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (_e) {
      // ignore
    }
  }

  function format() {
    editorRef.current?.getAction?.("editor.action.formatDocument")?.run();
  }

  function reset() {
    onChange?.(boilerplate || "");
  }

  function bumpFont(delta) {
    setFontIdx((i) => Math.max(0, Math.min(FONT_STEPS.length - 1, i + delta)));
  }

  return (
    <div
      className={cn(
        "rounded-xl border bg-card shadow-sm",
        maximized && "fixed inset-4 z-50 flex flex-col",
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-mono text-[11px]">
            {language || monacoLanguage || "code"}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            Implement the function below.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            onClick={format}
            disabled={disabled}
            title="Format code (Ctrl/Cmd+S)"
          >
            <Sparkles className="h-3.5 w-3.5" /> Format
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            onClick={copyToClipboard}
            title="Copy code"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-xs"
            onClick={reset}
            disabled={disabled || !boilerplate}
            title="Reset to starter boilerplate"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>

          <span className="mx-1 h-4 w-px bg-border/60" />

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setWrap((w) => !w)}
            title={wrap ? "Disable word wrap" : "Enable word wrap"}
          >
            <WrapText
              className={cn(
                "h-3.5 w-3.5",
                wrap ? "text-primary" : "text-muted-foreground"
              )}
            />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => bumpFont(-1)}
            disabled={fontIdx === 0}
            title="Decrease font size"
          >
            <Type className="h-3 w-3" />
          </Button>
          <span className="w-6 text-center font-mono text-[10px] text-muted-foreground">
            {fontSize}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => bumpFont(1)}
            disabled={fontIdx === FONT_STEPS.length - 1}
            title="Increase font size"
          >
            <Type className="h-4 w-4" />
          </Button>

          <span className="mx-1 h-4 w-px bg-border/60" />

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setTheme(isDark ? "vs" : "vs-dark")}
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
          >
            {isDark ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setMaximized((m) => !m)}
            title={maximized ? "Exit fullscreen" : "Fullscreen"}
          >
            {maximized ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div
        className={cn(
          "overflow-hidden",
          isDark ? "bg-[#1e1e1e]" : "bg-white",
          maximized ? "flex-1" : ""
        )}
      >
        <Editor
          height={maximized ? "100%" : `${height}px`}
          language={monacoLanguage || "plaintext"}
          theme={theme}
          value={value ?? ""}
          onChange={(next) => onChange?.(next ?? "")}
          onMount={handleMount}
          options={{
            fontSize,
            fontFamily:
              "'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: wrap ? "on" : "off",
            smoothScrolling: true,
            cursorSmoothCaretAnimation: "on",
            cursorBlinking: "smooth",
            renderLineHighlight: "all",
            roundedSelection: true,
            renderWhitespace: "selection",
            bracketPairColorization: { enabled: true },
            "bracketPairColorization.independentColorPoolPerBracketType": true,
            guides: {
              bracketPairs: "active",
              indentation: true,
              highlightActiveIndentation: true
            },
            stickyScroll: { enabled: true },
            suggest: { showStatusBar: true, preview: true },
            quickSuggestions: { other: true, comments: false, strings: false },
            acceptSuggestionOnEnter: "smart",
            tabCompletion: "on",
            formatOnPaste: true,
            formatOnType: true,
            padding: { top: 12, bottom: 12 },
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
              useShadows: false
            },
            overviewRulerLanes: 0,
            lineNumbersMinChars: 3
          }}
        />
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/30 px-3 py-1.5 text-[10.5px] font-mono text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span>
            Ln <span className="text-foreground">{pos.lineNumber}</span>, Col{" "}
            <span className="text-foreground">{pos.column}</span>
          </span>
          <span className="opacity-50">·</span>
          <span>
            <span className="text-foreground">{lineCount}</span> lines
          </span>
          <span>
            <span className="text-foreground">{charCount}</span> chars
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span>UTF-8</span>
          <span className="opacity-50">·</span>
          <span>Spaces: 2</span>
          <span className="opacity-50">·</span>
          <span>{language || monacoLanguage || "plain"}</span>
        </div>
      </div>
    </div>
  );
}

export default CodeWorkspace;
