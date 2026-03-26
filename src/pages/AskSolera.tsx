import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Send, Plus, Trash2, ArrowLeft, MessageSquare, Sparkles, AlertTriangle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTED_QUESTIONS = [
  "When should we harvest our most advanced block?",
  "What does our current Brix trajectory look like?",
  "Are there any anomalies in our recent lab data?",
  "How does this vintage compare to last year?",
];

const STREAM_TIMEOUT_MS = 30_000;

const AskSolera = () => {
  const { user, organization } = useAuth();
  const orgId = organization?.id;
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<(Msg & { id?: string; created_at?: string })[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(!isMobile);
  const [activeTab, setActiveTab] = useState<"chat" | "summaries">("chat");

  // Fetch conversations
  const { data: conversations = [] } = useQuery({
    queryKey: ["ai-conversations", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  // Fetch weekly summaries
  const { data: weeklySummaries = [] } = useQuery({
    queryKey: ["weekly-summaries", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_summaries")
        .select("*")
        .order("week_starting", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  // Fetch messages for active conversation
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("ai_messages")
        .select("*")
        .eq("conversation_id", activeConversationId)
        .order("created_at", { ascending: true });
      if (error) {
        console.error(error);
        return;
      }
      setMessages(data.map((m: any) => ({ role: m.role, content: m.content, id: m.id, created_at: m.created_at })));
    })();
  }, [activeConversationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create new conversation
  const createConversation = useMutation({
    mutationFn: async (title: string) => {
      const { data, error } = await supabase
        .from("ai_conversations")
        .insert({ org_id: orgId!, user_id: user!.id, title })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      setActiveConversationId(data.id);
      if (isMobile) setShowSidebar(false);
    },
  });

  // Delete conversation
  const deleteConversation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_conversations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    },
  });

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming || !orgId || !user) return;
    setStreamError(null);

    let convId = activeConversationId;

    // Create conversation if needed
    if (!convId) {
      const title = text.split(/\s+/).slice(0, 6).join(" ");
      const { data, error } = await supabase
        .from("ai_conversations")
        .insert({ org_id: orgId, user_id: user.id, title })
        .select()
        .single();
      if (error) {
        toast({ title: "Error", description: "Failed to create conversation", variant: "destructive" });
        return;
      }
      convId = data.id;
      setActiveConversationId(convId);
      queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      if (isMobile) setShowSidebar(false);
    }

    // Save user message
    const userMsg: Msg & { id?: string; created_at?: string } = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const { error: msgError } = await supabase
      .from("ai_messages")
      .insert({ conversation_id: convId, role: "user", content: text });
    if (msgError) console.error("Failed to save user message:", msgError);

    // Stream AI response
    setIsStreaming(true);
    let assistantContent = "";

    // Set up abort controller for timeout
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, STREAM_TIMEOUT_MS);

    try {
      // Send last 10 messages for context
      const recentMessages = [...messages, userMsg].slice(-10).map((m) => ({ role: m.role, content: m.content }));

      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ask-solera`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ messages: recentMessages, conversationId: convId }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${resp.status})`);
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === "message_stop") { streamDone = true; break; }
            let content: string | undefined;
            if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
              content = parsed.delta.text;
            }
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && !last.id) {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            if (parsed.type === "message_stop") continue;
            let content: string | undefined;
            if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
              content = parsed.delta.text;
            }
            if (content) {
              assistantContent += content;
              setMessages((prev) => prev.map((m, i) =>
                i === prev.length - 1 && m.role === "assistant" ? { ...m, content: assistantContent } : m
              ));
            }
          } catch { /* ignore */ }
        }
      }

      // Save assistant message
      if (assistantContent) {
        await supabase.from("ai_messages").insert({
          conversation_id: convId,
          role: "assistant",
          content: assistantContent,
        });
        await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
        queryClient.invalidateQueries({ queryKey: ["ai-conversations"] });
      }
    } catch (e: any) {
      console.error("Streaming error:", e);
      if (e.name === "AbortError") {
        setStreamError("Ask Solera is taking longer than usual. Try again or rephrase your question.");
      } else if (e.message?.includes("API key")) {
        setStreamError("Something went wrong. Check that your Anthropic API key is configured in Settings.");
      } else {
        setStreamError(e.message || "Failed to get response. Please try again.");
      }
      // Remove the streaming assistant message if it was empty
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
        return prev;
      });
    } finally {
      clearTimeout(timeoutId);
      abortRef.current = null;
      setIsStreaming(false);
    }
  }, [activeConversationId, messages, orgId, user, isStreaming, toast, queryClient, isMobile]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setMessages([]);
    setInput("");
    setStreamError(null);
    if (isMobile) setShowSidebar(false);
  };

  const ConversationSidebar = () => (
    <div className="flex flex-col h-full border-r border-border bg-muted/30">
      <div className="p-3 border-b border-border">
        <Button onClick={handleNewConversation} className="w-full" variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-2" /> New Chat
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {conversations.map((conv: any) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-2 p-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
                conv.id === activeConversationId
                  ? "bg-primary/10 text-primary"
                  : "hover:bg-muted text-foreground/70"
              }`}
              onClick={() => {
                setActiveConversationId(conv.id);
                setStreamError(null);
                if (isMobile) setShowSidebar(false);
              }}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{conv.title}</p>
                <p className="text-[10px] text-muted-foreground">{format(new Date(conv.updated_at), "MMM d, h:mm a")}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                onClick={(e) => { e.stopPropagation(); deleteConversation.mutate(conv.id); }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {conversations.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">No conversations yet</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] -m-4 md:-m-6">
      {/* Sidebar */}
      {showSidebar && (
        <div className={`${isMobile ? "absolute inset-0 z-50 bg-background" : "w-72 shrink-0"}`}>
          {isMobile && (
            <div className="flex items-center gap-2 p-3 border-b border-border">
              <Button variant="ghost" size="icon" onClick={() => setShowSidebar(false)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium">Conversations</span>
            </div>
          )}
          <div className={isMobile ? "h-[calc(100%-3.5rem)]" : "h-full"}>
            <ConversationSidebar />
          </div>
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-3 p-3 border-b border-border shrink-0">
          {isMobile && !showSidebar && (
            <Button variant="ghost" size="icon" onClick={() => setShowSidebar(true)}>
              <MessageSquare className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-foreground text-sm">Ask Solera</h2>
              <p className="text-[10px] text-muted-foreground">AI-powered winery assistant</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${activeTab === "chat" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Chat
              </button>
              <button
                onClick={() => setActiveTab("summaries")}
                className={`px-3 py-1 text-xs font-medium transition-colors ${activeTab === "summaries" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Summaries
              </button>
            </div>
            <Badge variant="outline" className="text-[10px] gap-1">
              <Sparkles className="h-3 w-3" /> AI
            </Badge>
          </div>
        </div>

        {activeTab === "summaries" ? (
          <ScrollArea className="flex-1 px-4">
            <div className="max-w-3xl mx-auto py-6 space-y-4">
              <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Recent Weekly Summaries
              </h3>
              {weeklySummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No weekly summaries yet. Summaries are generated every Monday.
                </p>
              ) : (
                weeklySummaries.map((summary: any) => (
                  <Card key={summary.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        Week of {summary.week_starting}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(summary.created_at), "MMM d, yyyy h:mm a")}
                      </span>
                    </div>
                    <div className="prose prose-sm max-w-none text-sm">
                      <ReactMarkdown>{summary.content}</ReactMarkdown>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        ) : (
          <>
            {/* Messages */}
            <ScrollArea className="flex-1 px-4">
              <div className="max-w-3xl mx-auto py-4 space-y-4">
                {messages.length === 0 && !activeConversationId && (
                  <div className="flex flex-col items-center justify-center py-12 space-y-6">
                    <div className="p-4 rounded-2xl bg-primary/10">
                      <Bot className="h-10 w-10 text-primary" />
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="font-display text-xl font-bold text-foreground">Ask Solera</h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        Your AI winery assistant. Ask about harvest timing, lab results, vineyard conditions, and more.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                      {SUGGESTED_QUESTIONS.map((q) => (
                        <Card
                          key={q}
                          className="p-3 cursor-pointer hover:bg-muted/50 transition-colors border-dashed text-sm text-foreground/80"
                          onClick={() => sendMessage(q)}
                        >
                          {q}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5 gap-0.5 border-primary/30">
                            <Sparkles className="h-2.5 w-2.5" /> AI
                          </Badge>
                          {msg.created_at && (
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(msg.created_at), "h:mm a")}
                            </span>
                          )}
                        </div>
                      )}
                      <div className={`text-sm prose prose-sm max-w-none ${
                        msg.role === "user" ? "prose-invert" : ""
                      }`}>
                        {msg.role === "assistant" ? (
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        ) : (
                          <p className="whitespace-pre-wrap m-0">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Error message */}
                {streamError && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl rounded-bl-md px-4 py-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <p className="text-sm">{streamError}</p>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="border-t border-border p-3 shrink-0">
              <div className="max-w-3xl mx-auto flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your vineyard, vintages, or operations..."
                  className="min-h-[44px] max-h-32 resize-none"
                  rows={1}
                  disabled={isStreaming}
                />
                <Button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || isStreaming}
                  size="icon"
                  className="shrink-0 h-[44px] w-[44px]"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AskSolera;
