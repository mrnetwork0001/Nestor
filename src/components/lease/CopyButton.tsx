import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui";
import { copyText } from "./leaseHelpers";

/** Copies text and confirms it in place for two seconds. */
export function CopyButton({
  text,
  label,
  copiedLabel = "Copied",
  variant = "secondary",
  size = "sm",
  className,
}: {
  text: string;
  label: string;
  copiedLabel?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      icon={
        copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />
      }
      onClick={async () => {
        const ok = await copyText(text);
        if (!ok) {
          toast.error("Your browser blocked copying. Select the text and copy it by hand.");
          return;
        }
        setCopied(true);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 2000);
      }}
    >
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </Button>
  );
}
