import { Link } from "@tanstack/react-router";
import { Bot } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Contextual entry point: opens the assistant pre-filled with context. */
export function AskAIButton({ prompt, context, label = "Ask the AI assistant" }: { prompt: string; context?: string; label?: string }) {
  return (
    <Button variant="outline" size="sm" asChild>
      <Link to="/ai-assistant" search={{ q: prompt, ctx: context }}>
        <Bot /> {label}
      </Link>
    </Button>
  );
}
