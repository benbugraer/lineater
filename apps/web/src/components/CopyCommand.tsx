import { useState } from "react";

interface CopyCommandProps {
  command: string;
}

export default function CopyCommand({ command }: CopyCommandProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button type="button" className="copy-command" onClick={copy} aria-label="Komutu kopyala">
      <span className="prompt" aria-hidden="true">$</span>
      <code>{command}</code>
      <span className="copy-label">{copied ? "copied" : "copy"}</span>
    </button>
  );
}
