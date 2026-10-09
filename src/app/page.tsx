"use client";

import {
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type ChatMessage,
  type ConversationAnalysis,
  type Insight,
  type Priority,
} from "@/lib/analyze";
import { SAMPLE_CONVERSATION } from "@/lib/sample";
import ThemeControl from "./theme-control";

type Filter = "all" | "high" | "tasks" | "decisions" | "deadlines" | "mentions";
type CategoryId = Filter | "summary" | "conversation";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Everything" },
  { id: "high", label: "High priority" },
  { id: "tasks", label: "Tasks" },
  { id: "decisions", label: "Decisions" },
  { id: "deadlines", label: "Deadlines" },
  { id: "mentions", label: "Mentions" },
];

const CATEGORIES: Array<{ id: CategoryId; label: string }> = [
  { id: "summary", label: "Quick summary" },
  { id: "all", label: "All highlights" },
  { id: "high", label: "High priority" },
  { id: "tasks", label: "Action items" },
  { id: "decisions", label: "Decisions" },
  { id: "deadlines", label: "Deadlines" },
  { id: "mentions", label: "Mentions" },
  { id: "conversation", label: "Original chat" },
];

const MAX_CHARACTERS = 30_000;

const SUGGESTIONS = [
  {
    label: "Schedule change",
    accent: "violet",
    conversation:
      "[9:15 AM] Maya: The client moved the review from 2 PM to 3 PM today.\n[9:18 AM] Sam: Please update the calendar invite before noon.",
  },
  {
    label: "Open action items",
    accent: "amber",
    conversation:
      "[9:25 AM] Sam: @Aisha, please review the pricing table before noon.\n[9:31 AM] Maya: Final submission is due Friday.",
  },
  {
    label: "Team decision",
    accent: "teal",
    conversation:
      "[9:18 AM] Maya: We decided to use the blue concept for the launch deck.\n[9:21 AM] Dev: I'll prepare the updated slides by tomorrow.",
  },
];

function Icon({
  name,
  size = 18,
}: {
  name: "spark" | "lock" | "arrow" | "copy" | "download" | "search" | "check" | "close" | "message";
  size?: number;
}) {
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  const paths: Record<typeof name, ReactNode> = {
    spark: (
      <>
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
        <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14Z" />
      </>
    ),
    lock: (
      <>
        <rect x="4.5" y="10" width="15" height="11" rx="2.5" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    copy: (
      <>
        <rect x="8" y="8" width="12" height="12" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M5 20h14" />
      </>
    ),
    search: (
      <>
        <circle cx="10.8" cy="10.8" r="6.8" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    message: (
      <>
        <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.8-3.7A7.5 7.5 0 1 1 20 11.5Z" />
        <path d="M8 11h.01M12 11h.01M16 11h.01" />
      </>
    ),
  };
  return <svg {...shared}>{paths[name]}</svg>;
}

function PriorityPill({ priority }: { priority: Priority }) {
  return <span className={`priority-pill priority-${priority}`}>{priority}</span>;
}

function SectionHeading({
  eyebrow,
  title,
  count,
  action,
}: {
  eyebrow: string;
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>
          {title}
          {typeof count === "number" && <span className="section-count">{count}</span>}
        </h2>
      </div>
      {action}
    </div>
  );
}

function SourceButton({
  message,
  onSelect,
}: {
  message: ChatMessage | undefined;
  onSelect: (id: string) => void;
}) {
  if (!message) return null;
  return (
    <button
      className="source-link"
      onClick={() => onSelect(message.id)}
      type="button"
    >
      <span className="source-dot" />
      View original message
      <Icon name="arrow" size={14} />
    </button>
  );
}

function InsightCard({
  insight,
  message,
  label,
  onSelect,
  trailing,
}: {
  insight: Insight;
  message: ChatMessage | undefined;
  label?: string;
  onSelect: (id: string) => void;
  trailing?: ReactNode;
}) {
  return (
    <article className="insight-card">
      <div className="insight-card-top">
        <div className="insight-tags">
          {label && <span className="tag tag-soft">{label}</span>}
          <PriorityPill priority={insight.priority} />
        </div>
        {trailing}
      </div>
      <p className="insight-copy">{insight.text}</p>
      <p className="insight-reason">{insight.reason}</p>
      <SourceButton message={message} onSelect={onSelect} />
    </article>
  );
}

function buildReport(analysis: ConversationAnalysis, completed: Set<string>): string {
  const lines = [
    "UNREAD — WHAT DID I MISS?",
    "",
    "SUMMARY",
    analysis.summary,
    "",
    `MESSAGES ANALYZED: ${analysis.messages.length}`,
    "",
    "ACTION ITEMS",
    ...(analysis.tasks.length
      ? analysis.tasks.map(
          (task) =>
            `${completed.has(task.id) ? "[x]" : "[ ]"} [${task.priority.toUpperCase()}] ${task.text}${task.owner ? ` — ${task.owner}` : ""}${task.due ? ` — due ${task.due}` : ""}`,
        )
      : ["No action items detected."]),
    "",
    "DECISIONS",
    ...(analysis.decisions.length
      ? analysis.decisions.map(
          (decision) => `[${decision.certainty}] ${decision.text}`,
        )
      : ["No decisions detected."]),
    "",
    "DEADLINES",
    ...(analysis.deadlines.length
      ? analysis.deadlines.map(
          (deadline) => `[${deadline.kind}] ${deadline.expression} — ${deadline.text}`,
        )
      : ["No deadlines detected."]),
    "",
    "MENTIONS",
    ...(analysis.mentions.length
      ? analysis.mentions.map(
          (mention) =>
            `${mention.sender ? `${mention.sender}: ` : ""}${mention.text}`,
        )
      : ["No direct name mentions detected."]),
    "",
    "Analyzed with Gemini by Unread. AI analysis can miss context.",
  ];
  return lines.join("\n");
}

function formatTasks(analysis: ConversationAnalysis, completed: Set<string>): string {
  return analysis.tasks.length
    ? analysis.tasks
        .map(
          (task) =>
            `${completed.has(task.id) ? "[x]" : "[ ]"} [${task.priority.toUpperCase()}] ${task.text}${task.owner ? ` — ${task.owner}` : ""}${task.due ? ` — due ${task.due}` : ""}`,
        )
        .join("\n")
    : "No action items detected.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isConversationAnalysis(value: unknown): value is ConversationAnalysis {
  return (
    isRecord(value) &&
    typeof value.summary === "string" &&
    typeof value.wasTruncated === "boolean" &&
    Array.isArray(value.messages) &&
    Array.isArray(value.important) &&
    Array.isArray(value.tasks) &&
    Array.isArray(value.decisions) &&
    Array.isArray(value.deadlines) &&
    Array.isArray(value.mentions)
  );
}

export default function Home() {
  const [conversation, setConversation] = useState("");
  const [userName, setUserName] = useState("");
  const [analysis, setAnalysis] = useState<ConversationAnalysis | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [activeCategory, setActiveCategory] = useState<CategoryId>("summary");
  const [messageSearch, setMessageSearch] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const analysisRequest = useRef<AbortController | null>(null);
  const analysisRequestId = useRef(0);
  const sourceRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const categoryRefs = useRef<Partial<Record<CategoryId, HTMLElement | null>>>({});

  useEffect(() => {
    if (!selectedMessage) return;
    sourceRefs.current[selectedMessage]?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [selectedMessage]);

  useEffect(
    () => () => {
      analysisRequest.current?.abort();
    },
    [],
  );

  const messageLookup = useMemo(
    () => new Map((analysis?.messages ?? []).map((message) => [message.id, message])),
    [analysis],
  );

  const visibleImportant = useMemo(() => {
    if (!analysis) return [];
    switch (filter) {
      case "tasks":
        return analysis.tasks;
      case "decisions":
        return analysis.decisions;
      case "deadlines":
        return analysis.deadlines;
      case "mentions":
        return analysis.mentions;
      case "high":
        return analysis.important.filter((item) => item.priority === "high");
      default:
        return analysis.important;
    }
  }, [analysis, filter]);

  const filteredMessages = useMemo(() => {
    const messages = analysis?.messages ?? [];
    const query = messageSearch.trim().toLowerCase();
    return messages.filter(
      (message) =>
        !query ||
        message.text.toLowerCase().includes(query) ||
        message.sender?.toLowerCase().includes(query),
    );
  }, [analysis, messageSearch]);

  function cancelPendingAnalysis() {
    analysisRequestId.current += 1;
    analysisRequest.current?.abort();
    analysisRequest.current = null;
    setIsAnalyzing(false);
  }

  function loadSample() {
    cancelPendingAnalysis();
    setConversation(SAMPLE_CONVERSATION);
    setUserName((current) => current.trim() ? current : "Aisha");
    setAnalysis(null);
    setError("");
    setNotice("Sample loaded. Select “Catch me up” to analyze it with Gemini.");
    setFeedback("");
    setCompletedTasks(new Set());
    setActiveCategory("summary");
  }

  function loadSuggestion(text: string) {
    cancelPendingAnalysis();
    setConversation(text);
    setAnalysis(null);
    setError("");
    setNotice("Example added. Select “Catch me up” to analyze it with Gemini.");
    setFeedback("");
    setSelectedMessage(null);
    setCompletedTasks(new Set());
    setActiveCategory("summary");
  }

  function clearConversation() {
    cancelPendingAnalysis();
    setConversation("");
    setAnalysis(null);
    setError("");
    setNotice("");
    setFeedback("");
    setMessageSearch("");
    setSelectedMessage(null);
    setCompletedTasks(new Set());
    setFilter("all");
    setActiveCategory("summary");
  }

  function resetApp() {
    clearConversation();
    setUserName("");
  }

  async function handleAnalyze() {
    setError("");
    setNotice("");
    setFeedback("");
    if (!conversation.trim()) {
      setError("Paste a conversation first, or load the sample to try it out.");
      return;
    }
    if (conversation.length > MAX_CHARACTERS) {
      setError(`Please keep the conversation under ${MAX_CHARACTERS.toLocaleString()} characters.`);
      return;
    }
    if (conversation.trim().length < 24) {
      setNotice("This is a short snippet. Analysis may be limited, but you can still continue.");
    }

    cancelPendingAnalysis();
    const controller = new AbortController();
    const requestId = analysisRequestId.current;
    analysisRequest.current = controller;
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation, userName }),
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (!isRecord(payload)) {
        throw new Error("The analysis service returned an invalid response. Please try again.");
      }
      if (!response.ok) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Gemini could not analyze this conversation. Please try again.",
        );
      }
      if (!isConversationAnalysis(payload.analysis)) {
        throw new Error("The analysis service returned incomplete results. Please try again.");
      }

      setAnalysis(payload.analysis);
      if (payload.analysis.wasTruncated) {
        setNotice(
          "This conversation has more than 1,000 messages. Only the first 1,000 were analyzed; use a smaller date range for a complete catch-up.",
        );
      }
      setCompletedTasks(new Set());
      setFilter("all");
      setActiveCategory("summary");
      setSelectedMessage(null);
      setMessageSearch("");
    } catch (caughtError) {
      if (!controller.signal.aborted && requestId === analysisRequestId.current) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not analyze this conversation. Please try again.",
        );
        setAnalysis(null);
      }
    } finally {
      if (requestId === analysisRequestId.current) {
        analysisRequest.current = null;
        setIsAnalyzing(false);
      }
    }
  }

  async function copyText(text: string, label: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setFeedback(`${label} copied to clipboard.`);
    } catch {
      setFeedback("Clipboard access is unavailable here. You can still export the report.");
    }
  }

  function exportReport() {
    if (!analysis) return;
    const report = buildReport(analysis, completedTasks);
    const file = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "unread-catch-up.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback("Your report was exported as a text file.");
  }

  function toggleTask(taskId: string) {
    setCompletedTasks((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  function selectSource(messageId: string) {
    setMessageSearch("");
    setSelectedMessage(messageId);
  }

  function openCategory(category: CategoryId) {
    setActiveCategory(category);
    if (category !== "summary" && category !== "conversation") {
      setFilter(category);
    }
    window.requestAnimationFrame(() => {
      categoryRefs.current[category]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  const priorityCounts = analysis
    ? {
        high: analysis.important.filter((item) => item.priority === "high").length,
        medium: analysis.important.filter((item) => item.priority === "medium").length,
        low: analysis.important.filter((item) => item.priority === "low").length,
      }
    : { high: 0, medium: 0, low: 0 };

  function categoryCount(category: CategoryId): number | null {
    if (!analysis) return null;
    switch (category) {
      case "all":
        return analysis.important.length;
      case "high":
        return priorityCounts.high;
      case "tasks":
        return analysis.tasks.length;
      case "decisions":
        return analysis.decisions.length;
      case "deadlines":
        return analysis.deadlines.length;
      case "mentions":
        return analysis.mentions.length;
      case "conversation":
        return analysis.messages.length;
      default:
        return null;
    }
  }

  return (
    <main className={`app-home${isAnalyzing ? " is-analyzing" : ""}`}>
      <header className="topbar">
        <button className="brand brand-button" onClick={resetApp} type="button" aria-label="Unread home; clear current conversation">
          <span className="brand-mark"><Icon name="message" size={19} /></span>
          <span>unread<span className="brand-period">.</span></span>
        </button>
        <div className="topbar-actions">
          <div className="privacy-chip"><Icon name="spark" size={13} /> Gemini AI</div>
          <ThemeControl />
          <button className="button button-quiet button-small" onClick={loadSample} type="button">
            Try sample
          </button>
          {(conversation || analysis || userName) && (
            <button className="button button-quiet button-small reset-button" onClick={resetApp} type="button">
              <Icon name="close" size={15} /> Reset
            </button>
          )}
        </div>
      </header>

      <div className="page-shell">
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-kicker"><span className="live-dot" /> YOUR GROUP CHAT, CAUGHT UP</div>
            <h1>Back in the loop.<br /><span>Without reading it all.</span></h1>
            <p>Turn a wall of messages into the decisions, deadlines, and to-dos that actually matter.</p>
          </div>
          <div className="hero-note">
            <div className="note-icon"><Icon name="spark" size={18} /></div>
            <div><strong>Less scrolling, more knowing.</strong><span>Goodbye, “wait, what did I miss?”</span></div>
          </div>
        </section>

        <section className="workspace" aria-label="Conversation catch-up">
          <div className="input-card">
            <div className="input-card-header">
              <div>
                <div className="step-label"><span>01</span> PASTE YOUR CHAT</div>
                <h2>Let’s catch you up</h2>
                <p>Copy a conversation from any chat. No uploads or permissions needed.</p>
              </div>
              <span className="local-badge"><Icon name="lock" size={13} /> Key protected on server</span>
            </div>
            <label className="sr-only" htmlFor="conversation">Paste your conversation</label>
            <textarea
              id="conversation"
              className="conversation-input"
              placeholder={"[10:30 AM] Aisha: The meeting has moved to 3 PM.\nRahul: I'll prepare the presentation.\nMe: Please send me the slides before noon.\nPriya: Final submission is due tomorrow."}
              value={conversation}
              onChange={(event) => {
                cancelPendingAnalysis();
                setConversation(event.target.value);
                setAnalysis(null);
                setError("");
                setNotice("");
              }}
              maxLength={MAX_CHARACTERS + 1}
              aria-describedby="input-help input-count"
            />
            <div className="input-meta">
              <span id="input-help">Timestamps are optional. Multi-line messages are supported.</span>
              <span id="input-count" className={conversation.length > MAX_CHARACTERS ? "count-error" : ""}>
                {conversation.length.toLocaleString()} / {MAX_CHARACTERS.toLocaleString()}
              </span>
            </div>

            <div className="input-options">
              <label className="name-field" htmlFor="user-name">
                <span>Your name <span className="optional-label">optional</span></span>
                <input
                  id="user-name"
                  value={userName}
                  onChange={(event) => {
                    cancelPendingAnalysis();
                    setUserName(event.target.value);
                    setAnalysis(null);
                    setError("");
                    setNotice("");
                  }}
                  placeholder="e.g. Aisha"
                  maxLength={60}
                />
              </label>
              <div className="input-actions">
                {(conversation || analysis) && (
                  <button className="button button-quiet" onClick={clearConversation} type="button">
                    Clear
                  </button>
                )}
                <button className="button button-primary" onClick={handleAnalyze} type="button" disabled={isAnalyzing} aria-busy={isAnalyzing}>
                  {isAnalyzing ? (
                    <span className="analysis-thinking" aria-hidden="true">
                      <Icon name="spark" size={16} />
                      <span className="thinking-dots"><i /><i /><i /></span>
                    </span>
                  ) : <Icon name="spark" size={16} />}
                  {isAnalyzing ? "Asking Gemini…" : "Catch me up"}
                  {!isAnalyzing && <Icon name="arrow" size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="form-message error-message" role="alert">{error}</p>}
            {notice && <p className="form-message notice-message" role="status">{notice}</p>}
            <p className="privacy-note"><Icon name="lock" size={14} /> Your conversation and optional name are sent to Google Gemini for analysis. Unread does not save them; the API key stays on the server.</p>
          </div>

          {!analysis && (
            <div className="preview-card">
              <div className="preview-heading">
                <div className="preview-icon"><Icon name="spark" size={17} /></div>
                <div><strong>A clearer headspace</strong><span>What Unread finds in your conversation</span></div>
              </div>
              <div className="preview-chips">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    className="suggestion-chip"
                    key={suggestion.label}
                    onClick={() => loadSuggestion(suggestion.conversation)}
                    type="button"
                  >
                    <i className={`chip-dot dot-${suggestion.accent}`} />
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {analysis && (
          <section className="results" aria-live="polite">
            <div className="results-topline">
              <div className="step-label"><span>02</span> YOUR CATCH-UP</div>
              <div className="report-actions">
                <button className="button button-quiet button-small" onClick={() => void copyText(analysis.summary, "Summary")} type="button">
                  <Icon name="copy" size={14} /> Copy summary
                </button>
                <button className="button button-quiet button-small" onClick={() => void copyText(formatTasks(analysis, completedTasks), "Action items")} type="button">
                  <Icon name="copy" size={14} /> Copy tasks
                </button>
                <button className="button button-quiet button-small" onClick={exportReport} type="button">
                  <Icon name="download" size={14} /> Export report
                </button>
              </div>
            </div>
            {feedback && <p className="feedback-message" role="status">{feedback}</p>}

            <div className="summary-card" ref={(element) => { categoryRefs.current.summary = element; }}>
              <div className="summary-main">
                <div className="summary-title-line">
                  <span className="summary-spark"><Icon name="spark" size={18} /></span>
                  <span className="eyebrow">THE QUICK READ</span>
                </div>
                <h2>Here&apos;s what you missed</h2>
                <p>{analysis.summary}</p>
                <div className="summary-footnote"><Icon name="spark" size={13} /> Analyzed with Gemini · Review original messages</div>
              </div>
              <div className="summary-stats" aria-label="Analysis counts">
                <div><strong>{analysis.messages.length}</strong><span>messages</span></div>
                <div><strong>{analysis.tasks.length}</strong><span>to-dos</span></div>
                <div><strong>{analysis.decisions.length}</strong><span>decisions</span></div>
                <div><strong>{analysis.deadlines.length}</strong><span>deadlines</span></div>
                <div><strong>{analysis.mentions.length}</strong><span>mentions</span></div>
              </div>
            </div>

            <div className="results-workspace">
              <aside className="category-sidebar">
                <div className="category-sidebar-heading">
                  <span className="eyebrow">YOUR CATCH-UP</span>
                  <strong>Jump to</strong>
                </div>
                <nav className="category-sidebar-nav" aria-label="Catch-up categories">
                  {CATEGORIES.map((category) => {
                    const count = categoryCount(category.id);
                    return (
                      <button
                        aria-current={activeCategory === category.id ? "location" : undefined}
                        className={`category-nav-button${activeCategory === category.id ? " category-nav-active" : ""}`}
                        key={category.id}
                        onClick={() => openCategory(category.id)}
                        type="button"
                      >
                        <span className="category-nav-label">
                          <i aria-hidden="true" />
                          {category.label}
                        </span>
                        {count !== null && <span className="category-nav-count">{count}</span>}
                      </button>
                    );
                  })}
                </nav>
                <div className="category-sidebar-note">
                  <Icon name="lock" size={12} />
                  Gemini API · Key protected on server
                </div>
              </aside>

              <div className="results-content">
              <div className="dashboard">
              <section
                className="panel priority-panel"
                ref={(element) => {
                  categoryRefs.current.all = element;
                  categoryRefs.current.high = element;
                }}
              >
                <SectionHeading
                  eyebrow="WHAT NEEDS YOUR ATTENTION"
                  title="Priority inbox"
                  count={visibleImportant.length}
                />
                <div className="filter-row" role="group" aria-label="Filter catch-up items">
                  {FILTERS.map((item) => (
                    <button
                      aria-pressed={filter === item.id}
                      className={`filter-button ${filter === item.id ? "filter-active" : ""}`}
                      key={item.id}
                      onClick={() => {
                        setFilter(item.id);
                        setActiveCategory(item.id);
                      }}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="priority-breakdown">
                  <span><i className="priority-dot dot-high" /> {priorityCounts.high} high</span>
                  <span><i className="priority-dot dot-medium" /> {priorityCounts.medium} medium</span>
                  <span><i className="priority-dot dot-low" /> {priorityCounts.low} context</span>
                </div>
                {visibleImportant.length ? (
                  <div className="insight-list">
                    {visibleImportant.map((item) => (
                      <InsightCard
                        insight={item}
                        key={item.id}
                        message={messageLookup.get(item.messageId)}
                        onSelect={selectSource}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-state-icon"><Icon name="check" size={19} /></span>
                    <strong>Nothing in this lane</strong>
                    <span>No {filter === "all" ? "highlights" : filter} were detected in these messages.</span>
                  </div>
                )}
              </section>

              <div className="side-panels">
                <section
                  className="panel"
                  ref={(element) => { categoryRefs.current.tasks = element; }}
                >
                  <SectionHeading eyebrow="NEXT STEPS" title="Action items" count={analysis.tasks.length} />
                  {analysis.tasks.length ? (
                    <div className="task-list">
                      {analysis.tasks.map((task) => {
                        const done = completedTasks.has(task.id);
                        return (
                          <article className={`task-row ${done ? "task-done" : ""}`} key={task.id}>
                            <label className="task-check-label" aria-label={`${done ? "Mark incomplete" : "Mark complete"}: ${task.text}`}>
                              <input checked={done} onChange={() => toggleTask(task.id)} type="checkbox" />
                              <span className="task-check"><Icon name="check" size={13} /></span>
                            </label>
                            <div className="task-content">
                              <p>{task.text}</p>
                              <div className="task-meta">
                                {task.owner && (
                                  <span className={task.owner.toLowerCase() === userName.trim().toLowerCase() ? "task-owner-you" : ""}>
                                    {task.owner.toLowerCase() === userName.trim().toLowerCase() ? "For you" : task.owner}
                                  </span>
                                )}
                                <span className={`priority-pill priority-${task.priority}`}>
                                  {task.priority === "high" ? "Urgent" : task.priority === "medium" ? "Soon" : "Standard"}
                                </span>
                                {task.due && <span className="due-tag">Due {task.due}</span>}
                              </div>
                              <SourceButton message={messageLookup.get(task.messageId)} onSelect={selectSource} />
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="compact-empty">No action items detected. That&apos;s one less thing to worry about.</div>
                  )}
                </section>

                <section
                  className="panel"
                  ref={(element) => { categoryRefs.current.decisions = element; }}
                >
                  <SectionHeading eyebrow="WHAT'S SETTLED" title="Decisions" count={analysis.decisions.length} />
                  {analysis.decisions.length ? (
                    <div className="insight-list">
                      {analysis.decisions.map((decision) => (
                        <InsightCard
                          insight={decision}
                          key={decision.id}
                          label={decision.certainty === "confirmed" ? "Confirmed" : "Possible"}
                          message={messageLookup.get(decision.messageId)}
                          onSelect={selectSource}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="compact-empty">No decision language found. Suggestions are kept separate from confirmed decisions.</div>
                  )}
                </section>

                <section
                  className="panel"
                  ref={(element) => { categoryRefs.current.deadlines = element; }}
                >
                  <SectionHeading eyebrow="KEEP AN EYE ON" title="Deadlines" count={analysis.deadlines.length} />
                  {analysis.deadlines.length ? (
                    <div className="deadline-list">
                      {analysis.deadlines.map((deadline) => (
                        <div className="deadline-item" key={deadline.id}>
                          <div className="deadline-date">
                            <span className="deadline-icon"><Icon name="arrow" size={15} /></span>
                            <span><strong>{deadline.expression}</strong><small>{deadline.kind === "relative" ? "Relative date" : "From message"}</small></span>
                          </div>
                          <p>{deadline.text}</p>
                          <SourceButton message={messageLookup.get(deadline.messageId)} onSelect={selectSource} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="compact-empty">No dates or deadline phrases detected.</div>
                  )}
                </section>

                <section
                  className="panel"
                  ref={(element) => { categoryRefs.current.mentions = element; }}
                >
                  <SectionHeading eyebrow="CALLING YOUR NAME" title="Mentions" count={analysis.mentions.length} />
                  {analysis.mentions.length ? (
                    <div className="insight-list">
                      {analysis.mentions.map((mention) => (
                        <InsightCard
                          insight={mention}
                          key={mention.id}
                          label={mention.sender ?? "Unknown sender"}
                          message={messageLookup.get(mention.messageId)}
                          onSelect={selectSource}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="compact-empty">
                      {userName.trim()
                        ? `No exact name or @${userName.trim()} matches found. Indirect references may not be recognized.`
                        : "Add your name before analyzing to find direct name and @mentions."}
                    </div>
                  )}
                  <p className="panel-disclaimer">Basic local name matching can miss indirect references.</p>
                </section>
              </div>
            </div>

            <section
              className="panel conversation-panel"
              ref={(element) => { categoryRefs.current.conversation = element; }}
            >
              <SectionHeading
                eyebrow="CHECK THE CONTEXT"
                title="Original conversation"
                count={analysis.messages.length}
                action={
                  <label className="search-control">
                    <Icon name="search" size={15} />
                    <span className="sr-only">Search original messages</span>
                    <input
                      value={messageSearch}
                      onChange={(event) => setMessageSearch(event.target.value)}
                      placeholder="Search messages"
                    />
                  </label>
                }
              />
              <p className="conversation-helper">Every highlight links back to the message it came from. Review the context before acting.</p>
              {filteredMessages.length ? (
                <div className="message-list">
                  {filteredMessages.map((message) => {
                    const highlighted = analysis.important.some((item) => item.messageId === message.id);
                    const active = selectedMessage === message.id;
                    const sender = message.sender?.trim().toLowerCase();
                    const currentUser = userName.trim().toLowerCase();
                    const outgoing = Boolean(sender && (
                      sender === "me" ||
                      sender === "you" ||
                      (currentUser && sender === currentUser)
                    ));
                    return (
                      <div
                        className={`message-row ${outgoing ? "message-outgoing" : ""} ${highlighted ? "message-highlighted" : ""} ${active ? "message-active" : ""}`}
                        key={message.id}
                        ref={(element) => { sourceRefs.current[message.id] = element; }}
                      >
                        <div className="message-avatar" aria-hidden="true">{message.sender?.charAt(0).toUpperCase() ?? "?"}</div>
                        <div className="message-body">
                          <div className="message-meta">
                            <strong>{message.sender ?? "Unknown sender"}</strong>
                            {message.timestamp && <span>{message.timestamp}</span>}
                            {highlighted && <span className="message-flag">Highlighted</span>}
                          </div>
                          <p>{message.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="compact-empty">No messages match “{messageSearch}”.</div>
              )}
            </section>

            <div className="limitations-note">
              <span className="note-info">i</span>
              <p><strong>Helpful, not infallible.</strong> Unread uses explainable local rules—not a language model. It may miss sarcasm, implicit tasks, or complex references. Check the original message for context.</p>
            </div>
              </div>
            </div>
          </section>
        )}

        <footer className="footer">
          <span>unread<span className="brand-period">.</span> <span className="footer-caption">A little less lost in the chat.</span></span>
          <span><Icon name="lock" size={12} /> Your chat is sent to Gemini for analysis</span>
        </footer>
      </div>
    </main>
  );
}
