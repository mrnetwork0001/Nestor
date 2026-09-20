import { useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { Lightbulb, PenLine, Send, Trash2 } from "@/components/icons";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Badge, Button, Callout, Field, Input, Textarea } from "@/components/ui";
import { toastError } from "@/components/listing/helpers";

const TEMPLATE_PREFIX = "Template draft:";
const REWRITE_IDEAS = ["Make it shorter", "Warmer and friendlier", "Push harder on the rent", "Ask about parking"];

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

/**
 * The Negotiator's pending email. The renter can edit it in place, approve
 * it, ask for a rewrite in their own words, or throw it away. Key this
 * component on the message id so a new draft resets the fields.
 */
export function DraftCard({
  message,
  thread,
}: {
  message: Doc<"messages">;
  thread: Doc<"threads">;
  // Still passed by the conversation view, but no label here depends on it: a key being set says nothing about this draft.
  brainLive?: boolean;
}) {
  const approveDraft = useMutation(api.threads.approveDraft);
  const discardDraft = useMutation(api.threads.discardDraft);
  const redraft = useMutation(api.threads.redraft);

  const subjectId = useId();
  const bodyId = useId();
  const instructionId = useId();
  const [subject, setSubject] = useState(message.subject);
  const [body, setBody] = useState(message.body);
  const [rewriting, setRewriting] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<"approve" | "discard" | "rewrite" | null>(null);

  // Grow the box to fit the email, so the whole draft can be read without scrolling inside a field.
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const field = bodyRef.current;
    if (field === null) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight + 2}px`;
  }, [body]);

  const rationale = message.rationale?.trim() ?? "";
  // The badge follows what was recorded when this draft was written, never whether a key exists now.
  // Drafts saved before that was recorded only count as template drafts when their own rationale says so.
  const source = message.draftSource;
  const hasPrefix = rationale.startsWith(TEMPLATE_PREFIX);
  const isTemplate = source !== undefined ? source.kind === "template" : hasPrefix;
  const afterPrefix = hasPrefix ? rationale.slice(TEMPLATE_PREFIX.length).trim() : rationale;
  const templateNote = afterPrefix.charAt(0).toUpperCase() + afterPrefix.slice(1);
  const edited = subject !== message.subject || body !== message.body;
  const words = wordCount(body);

  async function onApprove() {
    if (busy !== null) return;
    setBusy("approve");
    try {
      await approveDraft({
        messageId: message._id,
        subject: subject !== message.subject ? subject : undefined,
        body: body !== message.body ? body : undefined,
      });
      toast.success(
        thread.isSimulated ? "Sent. The demo landlord usually answers within seconds." : "Approved. Nestor is sending it now.",
      );
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(null);
    }
  }

  async function onDiscard() {
    if (busy !== null) return;
    setBusy("discard");
    try {
      await discardDraft({ messageId: message._id });
      toast("Draft discarded. Nothing was sent.");
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(null);
    }
  }

  async function onRewrite(event: FormEvent) {
    event.preventDefault();
    if (busy !== null) return;
    if (instruction.trim() === "") {
      toast.error("Tell Nestor what to change first.");
      return;
    }
    setBusy("rewrite");
    try {
      await redraft({ threadId: thread._id, instruction });
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-label="Draft waiting for your approval"
      className="animate-rise overflow-hidden rounded-card border-2 border-honey/50 bg-card shadow-lift"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-honey/25 bg-honey-soft px-4 py-3">
        <div className="flex items-center gap-2">
          <PenLine className="size-4 text-honey" aria-hidden="true" />
          <h3 className="font-sans text-sm font-semibold text-ink">Draft waiting for your OK</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {isTemplate ? (
            <Badge tone="honey">Template draft</Badge>
          ) : source?.kind === "openai" ? (
            <Badge tone="sky">{source.model ? `Written by OpenAI (${source.model})` : "Written by OpenAI"}</Badge>
          ) : (
            <Badge>Writer not recorded</Badge>
          )}
          <Badge>{thread.isSimulated ? "Goes to the demo landlord" : "Goes out by real email"}</Badge>
        </div>
      </header>

      <div className="space-y-4 p-4">
        {message.error && (
          <Callout tone="clay" title="The last attempt to send this did not go through">
            {message.error}
          </Callout>
        )}

        <p className="text-xs text-ink-faint">
          To <span className="break-all font-medium text-ink-soft">{message.toAddress}</span>
          {thread.landlordName ? ` (${thread.landlordName})` : ""}
        </p>

        <Field label="Subject" htmlFor={subjectId}>
          <Input
            id={subjectId}
            value={subject}
            maxLength={200}
            onChange={(event) => setSubject(event.target.value)}
            disabled={busy !== null}
          />
        </Field>
        <Field
          label="Email"
          htmlFor={bodyId}
          hint={
            edited
              ? `${words} words. Your edits are sent as written. Nestor keeps the line saying an AI assistant is writing.`
              : `${words} words. Edit anything you like before it goes.`
          }
        >
          <Textarea
            id={bodyId}
            ref={bodyRef}
            value={body}
            rows={8}
            className="resize-none overflow-hidden"
            maxLength={6000}
            onChange={(event) => setBody(event.target.value)}
            disabled={busy !== null}
          />
        </Field>

        {rationale !== "" &&
          (isTemplate ? (
            <Callout tone="honey" icon={<Lightbulb className="size-4" />} title="Template draft">
              {templateNote}
            </Callout>
          ) : (
            <div className="flex gap-3 rounded-xl border border-forest/15 bg-forest-soft/60 px-4 py-3 text-sm">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-forest" aria-hidden="true" />
              <div>
                <p className="font-semibold text-forest-deep">Why Nestor wrote it this way</p>
                <p className="mt-0.5 leading-relaxed text-ink-soft">{rationale}</p>
              </div>
            </div>
          ))}

        {rewriting ? (
          <form onSubmit={onRewrite} className="animate-rise space-y-2.5 rounded-xl border border-line bg-paper-deep/50 p-3.5">
            <Field
              label="What should Nestor change?"
              htmlFor={instructionId}
              hint="Your words are saved as an instruction for the rest of this conversation."
            >
              <Textarea
                id={instructionId}
                rows={2}
                maxLength={500}
                placeholder="For example: mention I can move in two weeks earlier"
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                disabled={busy !== null}
              />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {REWRITE_IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => setInstruction(idea)}
                  className="cursor-pointer rounded-full border border-line-strong bg-card px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-forest hover:text-forest"
                >
                  {idea}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={busy === "rewrite"} disabled={busy !== null}>
                Rewrite the draft
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRewriting(false)} disabled={busy !== null}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="accent"
              size="lg"
              onClick={onApprove}
              loading={busy === "approve"}
              disabled={busy !== null}
              icon={<Send className="size-4" />}
            >
              Approve and send
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setRewriting(true)} disabled={busy !== null}>
              Rewrite with an instruction
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={onDiscard}
              loading={busy === "discard"}
              disabled={busy !== null}
              icon={<Trash2 className="size-4" />}
            >
              Discard
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
