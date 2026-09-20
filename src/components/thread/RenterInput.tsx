import { useId, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { MessageCircleQuestionMark } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Button, Field, Textarea } from "@/components/ui";
import { firstName, toastError } from "@/components/listing/helpers";

/** Questions from the landlord that only the renter can answer. The Negotiator waits for this. */
export function QuestionsCard({ thread, autopilot }: { thread: Doc<"threads">; autopilot: boolean }) {
  const answerQuestions = useMutation(api.threads.answerQuestions);
  const inputId = useId();
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const writing = thread.stage === "drafting";
  const who = firstName(thread.landlordName, "The landlord");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    if (answer.trim() === "") {
      toast.error("Type your answer first.");
      return;
    }
    setSending(true);
    try {
      await answerQuestions({ threadId: thread._id, answer });
      setAnswer("");
    } catch (error) {
      toastError(error);
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      aria-label="Questions for you"
      className="animate-rise overflow-hidden rounded-card border-2 border-honey/50 bg-card shadow-lift"
    >
      <header className="flex items-center gap-2 border-b border-honey/25 bg-honey-soft px-4 py-3">
        <MessageCircleQuestionMark className="size-4 text-honey" aria-hidden="true" />
        <h3 className="font-sans text-sm font-semibold text-ink">{who} asked something only you can answer</h3>
      </header>
      <form onSubmit={onSubmit} className="space-y-3 p-4">
        <ul className="space-y-1.5">
          {thread.openQuestions.map((question) => (
            <li key={question} className="border-l-2 border-clay/50 pl-3 text-sm text-ink">
              {question}
            </li>
          ))}
        </ul>
        <Field
          label="Your answer"
          htmlFor={inputId}
          hint={
            autopilot
              ? "Answer in your own words. Autopilot is on, so Nestor works it into the next email and sends it."
              : "Answer in your own words. Nestor works it into the next email, which you still approve."
          }
        >
          <Textarea
            id={inputId}
            rows={3}
            maxLength={800}
            placeholder="For example: one car, and I work from home two days a week"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={sending || writing}
          />
        </Field>
        <Button type="submit" loading={sending} disabled={writing}>
          Give Nestor my answer
        </Button>
      </form>
    </section>
  );
}

/** Lets the renter steer the conversation when no draft is pending. */
export function SteerBox({ thread, autopilot }: { thread: Doc<"threads">; autopilot: boolean }) {
  const redraft = useMutation(api.threads.redraft);
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [sending, setSending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    if (instruction.trim() === "") {
      toast.error("Tell Nestor what to say first.");
      return;
    }
    setSending(true);
    try {
      await redraft({ threadId: thread._id, instruction });
      setInstruction("");
      setOpen(false);
    } catch (error) {
      toastError(error);
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Tell Nestor what to say next
      </Button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full animate-rise space-y-2.5 rounded-card border border-line bg-card p-4 shadow-card"
    >
      <Field
        label="What should the next email say?"
        htmlFor={inputId}
        hint={
          autopilot
            ? "Autopilot is on: Nestor writes the email from this and sends it."
            : "Nestor writes a draft from this. You approve it before it goes."
        }
      >
        <Textarea
          id={inputId}
          rows={2}
          maxLength={500}
          placeholder="For example: ask whether the rent is lower on an 18-month lease"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          disabled={sending}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={sending}>
          Write the draft
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={sending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
