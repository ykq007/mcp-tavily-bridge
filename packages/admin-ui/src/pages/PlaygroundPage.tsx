import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { formatDistanceToNow } from 'date-fns';
import { JsonViewer } from '../components/JsonViewer';
import { ToolSelector, McpTool } from '../components/ToolSelector';
import { IconRefresh, IconSearch, IconTrash, IconInfo, IconCheck, IconAlertCircle } from '../ui/icons';
import { ErrorBanner } from '../ui/ErrorBanner';
import { resolveMcpUrl } from '../app/mcpSetupTemplates';
import {
  buildMcpHeaders,
  getJsonRpcErrorMessage,
  isSessionInvalidErrorMessage,
  parseMcpResponseMessages,
  pickJsonRpcResponse,
  type JsonRpcMessage
} from './playgroundMcp';

// Types
type PlaygroundHistoryItem = {
  id: string;
  timestamp: number;
  tool: McpTool;
  params: unknown;
  response?: unknown;
  error?: unknown;
  status: 'success' | 'error';
  duration: number;
};

// Helper for local storage
function useStickyState<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stickyValue = window.localStorage.getItem(key);
      return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore write errors
    }
  }, [key, value]);

  return [value, setValue];
}

export function PlaygroundPage({ apiBaseUrl = '' }: { apiBaseUrl?: string }) {
  // State
  const [clientToken, setClientToken] = useStickyState<string>('mcp-playground-token', '');
  const [selectedTool, setSelectedTool] = useStickyState<McpTool>('mcp-playground-tool', 'tavily_search');
  const [paramsJson, setParamsJson] = useStickyState<string>(
    'mcp-playground-params',
    `{
  "query": "what is the weather in San Francisco?"
}`
  );
  const [history, setHistory] = useStickyState<PlaygroundHistoryItem[]>('mcp-playground-history', []);
  const [sessionId, setSessionId] = useStickyState<string>('mcp-playground-session-id', '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const mcpUrl = resolveMcpUrl({ apiBaseUrl, origin });

  // Derived state
  const selectedHistoryItem = selectedHistoryId
    ? history.find((h) => h.id === selectedHistoryId)
    : history[0];

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = clientToken.trim();
    if (!token) {
      setError('Client Token is required');
      return;
    }

    let params: unknown;
    try {
      params = JSON.parse(paramsJson);
      setError(null);
    } catch {
      setError('Invalid JSON parameters');
      return;
    }

    setLoading(true);
    const startTime = Date.now();
    const newItemBase = {
      id: uuidv4(),
      timestamp: startTime,
      tool: selectedTool,
      params,
    };

    try {
      const parseResponse = async (
        response: Response,
        requestId: number
      ): Promise<{ message: JsonRpcMessage | undefined; rawText: string }> => {
        const rawText = await response.text();
        const messages = parseMcpResponseMessages(rawText, response.headers.get('content-type'));
        const message = pickJsonRpcResponse(messages, requestId);
        return { message, rawText };
      };

      const initializeSession = async (): Promise<string> => {
        const initializeRequestId = Date.now();
        const initializeResponse = await fetch(mcpUrl, {
          method: 'POST',
          headers: buildMcpHeaders(token),
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: initializeRequestId,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: {},
              clientInfo: { name: 'mcp-nexus-admin-playground', version: '1.0.0' }
            }
          })
        });

        const { message, rawText } = await parseResponse(initializeResponse, initializeRequestId);
        const initializeError = getJsonRpcErrorMessage(message?.error);
        if (initializeError) {
          throw new Error(initializeError);
        }
        if (!initializeResponse.ok && !message) {
          throw new Error(rawText || `HTTP ${initializeResponse.status}`);
        }

        const nextSessionId = initializeResponse.headers.get('mcp-session-id');
        if (!nextSessionId) {
          throw new Error('Initialize succeeded but no MCP session ID was returned');
        }

        setSessionId(nextSessionId);
        return nextSessionId;
      };

      let activeSessionId = sessionId.trim();
      let responseMessage: JsonRpcMessage | undefined;
      let responseRawText = '';

      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (!activeSessionId) {
          activeSessionId = await initializeSession();
        }

        const callRequestId = Date.now() + attempt + 1;
        const callResponse = await fetch(mcpUrl, {
          method: 'POST',
          headers: buildMcpHeaders(token, activeSessionId),
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: callRequestId,
            method: 'tools/call',
            params: {
              name: selectedTool,
              arguments: params
            }
          })
        });

        const returnedSessionId = callResponse.headers.get('mcp-session-id');
        if (returnedSessionId && returnedSessionId !== activeSessionId) {
          activeSessionId = returnedSessionId;
          setSessionId(returnedSessionId);
        }

        const parsed = await parseResponse(callResponse, callRequestId);
        responseMessage = parsed.message;
        responseRawText = parsed.rawText;

        const messageText = getJsonRpcErrorMessage(responseMessage?.error);
        if (attempt === 0 && isSessionInvalidErrorMessage(messageText)) {
          activeSessionId = '';
          setSessionId('');
          continue;
        }

        if (!callResponse.ok && !responseMessage) {
          throw new Error(responseRawText || `HTTP ${callResponse.status}`);
        }

        break;
      }

      if (!responseMessage) {
        throw new Error(responseRawText || 'No JSON-RPC response received from MCP endpoint');
      }

      const isError = !!responseMessage.error;
      const result = isError ? responseMessage.error : responseMessage.result;
      const duration = Date.now() - startTime;

      const newItem: PlaygroundHistoryItem = {
        ...newItemBase,
        response: result,
        error: isError ? result : undefined,
        status: isError ? 'error' : 'success',
        duration,
      };

      setHistory([newItem, ...history].slice(0, 50));
      setSelectedHistoryId(newItem.id);
    } catch (err: any) {
      const duration = Date.now() - startTime;
      const newItem: PlaygroundHistoryItem = {
        ...newItemBase,
        error: { message: err.message || 'Network Error' },
        status: 'error',
        duration,
      };
      setHistory([newItem, ...history].slice(0, 50));
      setSelectedHistoryId(newItem.id);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear the request history?')) {
      setHistory([]);
      setSelectedHistoryId(null);
    }
  };

  const loadHistoryItem = (item: PlaygroundHistoryItem) => {
     setSelectedTool(item.tool);
     setParamsJson(JSON.stringify(item.params, null, 2));
     setSelectedHistoryId(item.id);
  };

  return (
    <div className="stack gap-6">
      {/* Header */}
      <div className="row">
        <div>
          <h1 className="h1">Playground</h1>
          <p className="help">Test MCP tools in real-time</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Request Panel */}
        <div className="card">
          <div className="cardHeader">
            <div className="h2">Request</div>
          </div>
          <div className="cardBody">
            <form onSubmit={handleExecute} className="stack gap-4">
              {error && <ErrorBanner message={error} />}

              <div className="stack gap-1">
                <label htmlFor="client-token" className="label">
                  Client Token
                </label>
                <input
                  id="client-token"
                  type="password"
                  className="input"
                  placeholder="Enter your Client Token"
                  value={clientToken}
                  onChange={(e) => setClientToken(e.target.value)}
                  autoComplete="off"
                />
                <div className="help">Your secret client token (not the Tavily API key)</div>
              </div>

              <ToolSelector value={selectedTool} onChange={setSelectedTool} disabled={loading} />

              <div className="stack gap-1">
                <label htmlFor="params" className="label">
                  Parameters (JSON)
                </label>
                <textarea
                  id="params"
                  className={`textarea mono ${error === 'Invalid JSON parameters' ? 'border-red-500' : ''}`}
                  rows={8}
                  value={paramsJson}
                  onChange={(e) => setParamsJson(e.target.value)}
                  placeholder="{}"
                />
              </div>

              <div className="row justify-end">
                <button
                  type="submit"
                  className="btn"
                  data-variant="primary"
                  disabled={loading || !clientToken}
                >
                  {loading ? <IconRefresh className="spin" /> : <IconSearch />}
                  {loading ? 'Running...' : 'Execute Tool'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Response Panel */}
        <div className="card flex flex-col min-h-[400px]">
          <div className="cardHeader row">
            <div className="h2">Response</div>
            {selectedHistoryItem && (
               <span className={`badge`} data-variant={selectedHistoryItem.status === 'success' ? 'success' : 'danger'}>
                 {selectedHistoryItem.status.toUpperCase()}
                 <span className="ml-2 opacity-70">{selectedHistoryItem.duration}ms</span>
               </span>
            )}
          </div>
          <div className="cardBody flex-grow flex flex-col relative overflow-hidden">
            {selectedHistoryItem ? (
              <JsonViewer 
                data={selectedHistoryItem.error || selectedHistoryItem.response} 
                className="flex-grow h-full"
              />
            ) : (
              <div className="emptyState emptyState--compact">
                 <div className="emptyStateIcon"><IconInfo /></div>
                 <div className="emptyStateMessage">Execute a tool to see the response here.</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Panel */}
      <div className="card">
        <div className="cardHeader row">
          <div className="h2">Request History</div>
          {history.length > 0 && (
            <button className="btn btn--sm" data-variant="ghost" onClick={handleClearHistory}>
              <IconTrash /> Clear
            </button>
          )}
        </div>
        <div className="cardBody p-0">
          {history.length === 0 ? (
            <div className="p-6 text-center text-muted">No history yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '180px' }}>Time</th>
                    <th>Tool</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr 
                      key={item.id} 
                      onClick={() => setSelectedHistoryId(item.id)}
                      className={selectedHistoryId === item.id ? 'bg-primary-light' : 'cursor-pointer hover:bg-surface-hover'}
                      style={{ backgroundColor: selectedHistoryId === item.id ? 'var(--color-surface-hover)' : undefined }}
                    >
                      <td className="mono text-xs">
                        {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                      </td>
                      <td className="font-medium">{item.tool}</td>
                      <td>
                        {item.status === 'success' ? (
                          <span className="badge" data-variant="success"><IconCheck className="w-3 h-3 mr-1" /> Success</span>
                        ) : (
                          <span className="badge" data-variant="danger"><IconAlertCircle className="w-3 h-3 mr-1" /> Error</span>
                        )}
                      </td>
                      <td className="mono text-xs">{item.duration}ms</td>
                      <td className="text-right">
                        <button 
                          className="btn btn--xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            loadHistoryItem(item);
                          }}
                        >
                          Load Params
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
