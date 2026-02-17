'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

type Status = 'idle' | 'triggering' | 'running' | 'complete' | 'failed';
type CommandType = 'create' | 'improve' | null;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const API_KEY_STORAGE = 'agent-api-key';

export default function AgentChatbot() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);
  const [htmlUrl, setHtmlUrl] = useState<string | null>(null);
  const [commandType, setCommandType] = useState<CommandType>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load API key from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(API_KEY_STORAGE);
    if (stored) {
      setApiKey(stored);
    } else {
      setShowKeyInput(true);
    }
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setMessages((prev) => [...prev, { role, content, timestamp: Date.now() }]);
  }, []);

  const pollStatus = useCallback(
    (rid: number, cmdType: CommandType) => {
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/agent/status/${rid}`, {
            headers: { 'x-api-key': apiKey },
          });
          if (!res.ok) return;

          const data = await res.json();

          if (data.status === 'completed') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;

            if (data.conclusion === 'success') {
              setStatus('complete');
              const successMsg = cmdType === 'improve'
                ? '개선이 완료되었습니다! 자동으로 배포됩니다.'
                : '새로운 게임 모드가 생성되었습니다! 자동으로 배포됩니다.';
              addMessage(
                'assistant',
                `${successMsg}\n\n[View workflow run](${data.htmlUrl})`,
              );
            } else {
              setStatus('failed');
              addMessage(
                'assistant',
                `Workflow finished with conclusion: ${data.conclusion}.\n\n[View details](${data.htmlUrl})`,
              );
            }
          }
        } catch {
          // Silently retry on network errors
        }
      }, 10000);
    },
    [apiKey, addMessage],
  );

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || status === 'triggering' || status === 'running') return;

    addMessage('user', trimmed);
    setInput('');
    setStatus('triggering');
    addMessage('assistant', 'Triggering GitHub Actions workflow...');

    try {
      const res = await fetch('/api/agent/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ prompt: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        setStatus('failed');
        addMessage('assistant', err.error || 'Unknown error');
        return;
      }

      const data = await res.json();
      setCommandType(data.commandType ?? null);

      if (data.runId) {
        setRunId(data.runId);
        setHtmlUrl(data.htmlUrl);
        setStatus('running');
        addMessage(
          'assistant',
          `Workflow started (run #${data.runId}). Polling for completion...\n\n[Watch progress](${data.htmlUrl})`,
        );
        pollStatus(data.runId, data.commandType ?? null);
      } else {
        setStatus('running');
        addMessage(
          'assistant',
          'Workflow triggered but run ID not yet available. Try checking GitHub Actions manually.',
        );
      }
    } catch (err) {
      setStatus('failed');
      addMessage('assistant', `Network error: ${String(err)}`);
    }
  };

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem(API_KEY_STORAGE, apiKey.trim());
      setShowKeyInput(false);
    }
  };

  const statusColor: Record<Status, string> = {
    idle: 'bg-zinc-600',
    triggering: 'bg-yellow-500 animate-pulse',
    running: 'bg-blue-500 animate-pulse',
    complete: 'bg-emerald-500',
    failed: 'bg-red-500',
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-700 shadow-lg transition-transform hover:scale-105 hover:bg-zinc-600"
        aria-label="Toggle agent chatbot"
      >
        <span className="text-2xl">{open ? '\u2715' : '\u2699'}</span>
        {status !== 'idle' && (
          <span
            className={`absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-zinc-900 ${statusColor[status]}`}
          />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[480px] w-[380px] flex-col rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${statusColor[status]}`} />
              <span className="text-sm font-medium">Game Agent</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowKeyInput(!showKeyInput)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
                title="Configure API key"
              >
                Key
              </button>
              {status !== 'idle' && status !== 'triggering' && status !== 'running' && (
                <button
                  onClick={() => {
                    setStatus('idle');
                    setRunId(null);
                    setHtmlUrl(null);
                    setCommandType(null);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* API Key input */}
          {showKeyInput && (
            <div className="border-b border-zinc-700 px-4 py-3">
              <label className="mb-1 block text-xs text-zinc-400">API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your agent API key"
                  className="flex-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveKey()}
                />
                <button
                  onClick={handleSaveKey}
                  className="rounded-lg bg-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-600"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <div className="text-center text-sm text-zinc-500">
                  <p className="mb-2">사용 가능한 명령어:</p>
                  <p>• <strong>모드!</strong> — 새로운 게임 모드 생성</p>
                  <p>• <strong>개선!</strong> — 기존 모드 버그 수정/개선</p>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`mb-3 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
              >
                <div
                  className={`inline-block max-w-[85%] rounded-xl px-3.5 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-zinc-800 text-zinc-200'
                  }`}
                >
                  {msg.content.split('\n').map((line, j) => {
                    // Simple markdown link rendering
                    const linkMatch = line.match(/\[(.+?)\]\((.+?)\)/);
                    if (linkMatch) {
                      const before = line.slice(0, linkMatch.index);
                      const after = line.slice((linkMatch.index ?? 0) + linkMatch[0].length);
                      return (
                        <span key={j}>
                          {before}
                          <a
                            href={linkMatch[2]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline text-emerald-300 hover:text-emerald-200"
                          >
                            {linkMatch[1]}
                          </a>
                          {after}
                          {j < msg.content.split('\n').length - 1 && <br />}
                        </span>
                      );
                    }
                    return (
                      <span key={j}>
                        {line}
                        {j < msg.content.split('\n').length - 1 && <br />}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-zinc-700 px-4 py-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                placeholder={
                  status === 'running' || status === 'triggering'
                    ? 'Agent is working...'
                    : '모드! 또는 개선! 으로 시작하세요'
                }
                disabled={status === 'running' || status === 'triggering'}
                className="flex-1 rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500 disabled:opacity-50"
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || status === 'running' || status === 'triggering'}
                className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
