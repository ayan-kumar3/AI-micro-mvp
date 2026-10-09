export type Priority = "high" | "medium" | "low";

export type ChatMessage = {
  id: string;
  index: number;
  sender: string | null;
  timestamp: string | null;
  text: string;
  raw: string;
};

export type Insight = {
  id: string;
  messageId: string;
  text: string;
  priority: Priority;
  reason: string;
};

export type ActionItem = Insight & {
  owner: string | null;
  due: string | null;
  completed: boolean;
};

export type Decision = Insight & {
  certainty: "confirmed" | "possible";
};

export type Deadline = Insight & {
  expression: string;
  kind: "explicit" | "relative";
};

export type Mention = Insight & {
  sender: string | null;
};

export type ConversationAnalysis = {
  messages: ChatMessage[];
  wasTruncated: boolean;
  summary: string;
  important: Insight[];
  tasks: ActionItem[];
  decisions: Decision[];
  deadlines: Deadline[];
  mentions: Mention[];
};

const MAX_MESSAGES = 1000;

const messageStart = /^\s*(?:\[([^\]]{1,80})\]\s*)?([^:\r\n]{1,48}):\s*(.*)$/;
const exportedMessageStart =
  /^\s*((?:\d{1,4}[./-]\d{1,2}[./-]\d{1,4},?\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?)\s+-\s+([^:\r\n]{1,48}):\s*(.*)$/i;
const exportedTimestampPrefix =
  /^\s*((?:\d{1,4}[./-]\d{1,2}[./-]\d{1,4},?\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?)\s+-\s+(.*)$/i;
const timestampLike = /^\s*\[(?:[^\]]{0,80})\]\s*/;

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function cleanSender(value: string): string | null {
  const sender = value.trim();
  return sender && sender.length <= 48 ? sender : null;
}

function parseMessages(input: string): {
  messages: ChatMessage[];
  totalMessages: number;
} {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");
  const parsed: Array<Omit<ChatMessage, "id" | "index">> = [];
  let current: Omit<ChatMessage, "id" | "index"> | null = null;

  const flush = () => {
    if (!current) return;
    const text = current.text.trim();
    if (text) parsed.push({ ...current, text, raw: current.raw.trim() });
    current = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      if (current) current.text += "\n";
      continue;
    }

    const exportedMatch = exportedMessageStart.exec(line);
    const exportedPrefix = exportedTimestampPrefix.exec(line);
    const match = exportedMatch || exportedPrefix ? null : messageStart.exec(line);
    if (exportedMatch || match) {
      flush();
      const timestamp = exportedMatch
        ? exportedMatch[1].trim()
        : match?.[1]?.trim() ?? null;
      const senderText = (exportedMatch?.[2] ?? match?.[2] ?? "").trim();
      const sender = cleanSender(senderText);
      const messageText = (exportedMatch?.[3] ?? match?.[3] ?? "").trim();
      current = {
        sender,
        timestamp,
        text: messageText,
        raw: line.trim(),
      };
      continue;
    }

    if (exportedPrefix) {
      flush();
      current = {
        sender: null,
        timestamp: exportedPrefix[1].trim(),
        text: exportedPrefix[2].trim(),
        raw: line.trim(),
      };
      continue;
    }

    if (!current) {
      const timestampOnly = timestampLike.exec(line);
      current = {
        sender: null,
        timestamp: timestampOnly ? line.slice(1, line.indexOf("]")).trim() : null,
        text: line.replace(timestampLike, "").trim(),
        raw: line.trim(),
      };
      continue;
    }

    current.text = `${current.text}${current.text.endsWith("\n") ? "" : " "}${line.trim()}`;
    current.raw = `${current.raw}\n${line.trim()}`;
  }

  flush();

  return {
    messages: parsed.slice(0, MAX_MESSAGES).map((message, index) => ({
      ...message,
      id: `message-${index}`,
      index,
    })),
    totalMessages: parsed.length,
  };
}

export function parseConversation(input: string): ChatMessage[] {
  return parseMessages(input).messages;
}

export function parseConversationDetails(input: string): {
  messages: ChatMessage[];
  totalMessages: number;
} {
  return parseMessages(input);
}

function messagePriority(text: string, directMention: boolean): Priority {
  const urgent = /\b(urgent|asap|immediately|right away|critical|emergency)\b/i.test(text);
  const imminent = /\b(today|tomorrow|tonight|this morning|this afternoon|within \d+ hours?)\b/i.test(
    text,
  );
  const actionableMention =
    directMention &&
    /\b(please|can you|could you|need to|confirm|review|send|prepare|submit|check|upload)\b/i.test(
      text,
    );
  const imminentTask =
    imminent &&
    /\b(due|deadline|by|before|submit|send|review|prepare|finish|complete|upload)\b/i.test(
      text,
    );
  if (urgent || actionableMention || imminentTask) return "high";
  if (
    directMention ||
    imminent ||
    /\b(deadline|due|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|noon|midnight)|must|decided|agreed|final decision)\b/i.test(
      text,
    )
  ) {
    return "medium";
  }
  return "low";
}

function firstAction(text: string): string | null {
  const patterns = [
    /\b(?:please|could you|can you|remember to|don't forget to|make sure to|need to|needs to|must|should(?!\s+we\b)|have to)\s+(.+)/i,
    /\b(?:i(?:'ll| will)|we(?:'ll| will)|i can|we can|i am going to|we are going to)\s+(.+)/i,
    /\b(?:assigned to|responsible for)\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return match[1].replace(/[.!?]+$/, "").trim();
  }
  return null;
}

function relativeDeadline(text: string): string | null {
  const match = /\b(today|tomorrow|tonight|this morning|this afternoon|this evening|next week|end of day|eod|(?:by|before)\s+(?:noon|midnight|morning|evening|the end of the day)|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i.exec(
    text,
  );
  return match?.[0] ?? null;
}

function explicitDeadline(text: string): string | null {
  const match =
    /\b(?:by|before|due(?:\s+on)?|deadline(?:\s+is)?|on)\s+((?:\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)\b)|(?:noon|midnight)\b|(?:\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)|(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:,\s+[a-z]+\s+\d{1,2})?\b)|(?:[a-z]+\s+\d{1,2}(?:,\s+\d{4})?\b))/i.exec(
      text,
    );
  return match?.[1] ?? null;
}

function isTaskAddressedToUser(text: string, name: string): boolean {
  if (!name) return false;
  const addressedAction =
    /\s*(?:[,!:]\s*)?(?:please\b|can you\b|could you\b|would you\b|need you to\b|review\b|send\b|prepare\b|submit\b|check\b|upload\b|confirm\b|finish\b|complete\b|make sure\b|don't forget\b)/i;
  const namePattern = new RegExp(
    `(?:^|[\\s,])@?${escapeRegex(name)}\\b${addressedAction.source}`,
    "i",
  );
  return namePattern.test(text);
}

function meaningfulMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter(
    (message) =>
      message.text.length > 24 &&
      !/^(hi|hello|hey|morning|good morning|thanks|thank you|ok|okay|lol|great)[!. ]*$/i.test(
        message.text,
      ),
  );
}

function makeSummary(messages: ChatMessage[], important: Insight[]): string {
  if (!messages.length) return "No messages were found in this conversation.";
  const byId = new Map(messages.map((message) => [message.id, message]));
  const selected = important
    .slice()
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))
    .slice(0, 3)
    .map((insight) => byId.get(insight.messageId))
    .filter((message): message is ChatMessage => Boolean(message));
  const source = selected.length ? selected : meaningfulMessages(messages).slice(0, 3);
  if (!source.length) {
    return `${messages.length} message${messages.length === 1 ? "" : "s"} analyzed. Most messages appear to be brief updates or casual chat.`;
  }

  const highlights = source.map((message) => {
    const content = message.text.replace(/\s+/g, " ").trim();
    const sentence = content.length > 135 ? `${content.slice(0, 132).trimEnd()}…` : content;
    return `${message.sender ? `${message.sender}: ` : ""}${sentence}`;
  });
  return `${messages.length} messages analyzed. Key updates: ${highlights.join(" · ")}`;
}

export function priorityRank(priority: Priority): number {
  return priority === "high" ? 3 : priority === "medium" ? 2 : 1;
}

export function analyzeConversation(
  input: string,
  userName = "",
): ConversationAnalysis {
  const { messages, totalMessages } = parseMessages(input);
  const name = userName.trim();
  const namePattern = name ? new RegExp(`(^|\\W)@?${escapeRegex(name)}($|\\W)`, "i") : null;

  const important: Insight[] = [];
  const tasks: ActionItem[] = [];
  const decisions: Decision[] = [];
  const deadlines: Deadline[] = [];
  const mentions: Mention[] = [];
  const messageIndexes = new Map(messages.map((message) => [message.id, message.index]));
  const chronological = (a: Insight, b: Insight) =>
    (messageIndexes.get(a.messageId) ?? 0) - (messageIndexes.get(b.messageId) ?? 0);

  for (const message of messages) {
    const text = message.text;
    const lower = text.toLowerCase();
    const directMention = Boolean(namePattern?.test(text));
    const addressedToUser = isTaskAddressedToUser(text, name);
    const urgent = /\b(urgent|asap|immediately|right away|critical|emergency)\b/i.test(text);
    const dueExpression = explicitDeadline(text) ?? relativeDeadline(text);
    const hasAction =
      /\b(please|could you|can you|remember to|don't forget to|make sure to|need to|needs to|must|should|have to|i(?:'ll| will)|we(?:'ll| will)|i can|we can|assigned to|responsible for)\b/i.test(
        text,
      );
    const hasChange = /\b(moved|changed|rescheduled|updated|now at|shifted)\b/i.test(
      text,
    );
    const hasAnnouncement = /\b(announce|announcing|heads up|fyi|important update)\b/i.test(
      text,
    );

    if (directMention) {
      mentions.push({
        id: `mention-${message.id}`,
        messageId: message.id,
        text: message.text,
        sender: message.sender,
        priority: messagePriority(text, true),
        reason: `Matches the name “${name}” in the message.`,
      });
    }

    const action = firstAction(text);
    if (action) {
      const ownerMatch = /^(i|we)\b/i.exec(text);
      const owner =
        addressedToUser
          ? name
          : ownerMatch && message.sender
            ? ownerMatch[1].toLowerCase() === "i"
              ? message.sender
              : null
            : null;
      tasks.push({
        id: `task-${message.id}`,
        messageId: message.id,
        text: action.charAt(0).toUpperCase() + action.slice(1),
        owner,
        due: dueExpression,
        priority: messagePriority(text, directMention),
        reason: addressedToUser
          ? `Addressed to ${name}.`
          : owner
            ? `Commitment from ${owner}.`
            : "A request or task was identified.",
        completed: false,
      });
    }

    const decisionPhrase =
      /\b(we decided|decided to|agreed to|we agreed|final decision|the decision is|we will use|we're going with|we are going with|chosen option|settled on)\b/i.test(
        text,
      );
    const proposalPhrase =
      /\b(maybe|perhaps|suggest(?:ion)?|propose|could we|what if|should we|might be|consider(?:ing)?)\b/i.test(
        text,
      );
    if (decisionPhrase || proposalPhrase) {
      const certainty = decisionPhrase && !proposalPhrase ? "confirmed" : "possible";
      decisions.push({
        id: `decision-${message.id}`,
        messageId: message.id,
        text,
        certainty,
        priority: certainty === "confirmed" ? "medium" : "low",
        reason:
          certainty === "confirmed"
            ? "Uses explicit agreement or decision language."
            : "Suggestion language detected; this is not treated as a confirmed decision.",
      });
    }

    if (dueExpression) {
      const explicit = Boolean(explicitDeadline(text));
      deadlines.push({
        id: `deadline-${message.id}`,
        messageId: message.id,
        text,
        expression: dueExpression,
        kind: explicit ? "explicit" : "relative",
        priority: messagePriority(text, directMention),
        reason: explicit
          ? "An explicit date, day, or time expression was found."
          : "A relative deadline was found; its calendar date is not inferred.",
      });
    }

    const shouldHighlight =
      directMention || urgent || Boolean(dueExpression) || decisionPhrase || hasAction || hasChange || hasAnnouncement;
    if (shouldHighlight) {
      const reason = directMention
        ? `Mentions ${name}.`
        : urgent
          ? "Contains explicit urgency language."
          : dueExpression
            ? `Includes a deadline: ${dueExpression}.`
            : decisionPhrase
              ? "Contains explicit decision language."
              : hasAction
                ? "Contains a request or commitment."
                : hasChange
                  ? "Reports a schedule or plan change."
                  : "Contains an important announcement.";
      important.push({
        id: `important-${message.id}`,
        messageId: message.id,
        text,
        priority: messagePriority(text, directMention),
        reason,
      });
    } else if (lower.length > 70 && messages.length > 1) {
      important.push({
        id: `context-${message.id}`,
        messageId: message.id,
        text,
        priority: "low",
        reason: "Useful conversation context; no immediate action was detected.",
      });
    }
  }

  important.sort(
    (a, b) =>
      priorityRank(b.priority) - priorityRank(a.priority) ||
      chronological(a, b),
  );
  tasks.sort(
    (a, b) =>
      priorityRank(b.priority) - priorityRank(a.priority) ||
      chronological(a, b),
  );
  deadlines.sort(
    (a, b) =>
      priorityRank(b.priority) - priorityRank(a.priority) ||
      chronological(a, b),
  );
  mentions.sort(
    (a, b) =>
      priorityRank(b.priority) - priorityRank(a.priority) ||
      chronological(a, b),
  );
  decisions.sort(
    (a, b) =>
      Number(b.certainty === "confirmed") - Number(a.certainty === "confirmed") ||
      chronological(a, b),
  );

  return {
    messages,
    wasTruncated: messages.length < totalMessages,
    summary: makeSummary(messages, important),
    important,
    tasks,
    decisions,
    deadlines,
    mentions,
  };
}
