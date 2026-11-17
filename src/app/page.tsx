/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import spec from "@/lib/openapi-spec";
import React, { useMemo, useState } from "react";

// Tag colours
const TAG_COLORS: Record<string, string> = {
  Home: "#818cf8",
  Anime: "#34d399",
  Browse: "#f59e0b",
  Schedule: "#fb923c",
  Watch: "#f87171",
  Captions: "#ec4899",
};

// Group paths by tag
const grouped: Record<string, string[]> = {};
for (const [path, pathData] of Object.entries(spec.paths)) {
  const method = Object.keys(pathData)[0] as string;
  const endpoint = (pathData as any)[method];
  const tag: string = endpoint.tags?.[0] ?? "Other";
  if (!grouped[tag]) grouped[tag] = [];
  grouped[tag].push(path);
}

// Preset examples for quick testing
const PRESETS: Record<string, Array<{ label: string; params: Record<string, string> }>> = {
  "/captions": [
    {
      label: "Megaplay English VTT",
      params: {
        url: "https://qra5z.mysubsplay.com/anime/53adb96c287c3931b3bc41cebb003788/ddff1cdefe993d317922762a05f296fb/subtitles/eng-2.vtt",
        referer: "https://megaplay.buzz/",
        format: "vtt",
      },
    },
    {
      label: "Parsed JSON Cues",
      params: {
        url: "https://qra5z.mysubsplay.com/anime/53adb96c287c3931b3bc41cebb003788/ddff1cdefe993d317922762a05f296fb/subtitles/eng-2.vtt",
        referer: "https://megaplay.buzz/",
        format: "json",
      },
    },
  ],
  "/watch/{slug}": [
    {
      label: "Solo Leveling Ep 1",
      params: {
        slug: "ore-dake-level-up-na-ken",
        ep: "1",
      },
    },
  ],
  "/search": [
    {
      label: "Search 'Naruto'",
      params: {
        keyword: "naruto",
        page: "1",
      },
    },
  ],
};

export default function DocsPage() {
  const firstPath = Object.keys(spec.paths)[0];
  const [activePath, setActivePath] = useState<string>(firstPath);
  const [prevActivePath, setPrevActivePath] = useState<string>(firstPath);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [testResponse, setTestResponse] = useState<{
    status: number;
    data: unknown;
    loading: boolean;
    durationMs?: number;
    contentType?: string;
  } | null>(null);

  const origin = React.useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => "https://anikoto-scrap.ayushxroblox.workers.dev"
  );

  if (activePath !== prevActivePath) {
    setPrevActivePath(activePath);
    setParamValues({});
    setTestResponse(null);
  }

  // Filter paths by search query
  const filteredGrouped = useMemo(() => {
    if (!searchQuery.trim()) return grouped;
    const q = searchQuery.toLowerCase().trim();
    const result: Record<string, string[]> = {};
    for (const [tag, paths] of Object.entries(grouped)) {
      const matched = paths.filter((p) => {
        const method = Object.keys((spec.paths as any)[p])[0];
        const summary = (spec.paths as any)[p]?.[method]?.summary || "";
        return (
          p.toLowerCase().includes(q) ||
          tag.toLowerCase().includes(q) ||
          summary.toLowerCase().includes(q)
        );
      });
      if (matched.length > 0) {
        result[tag] = matched;
      }
    }
    return result;
  }, [searchQuery]);

  const copyToClipboard = (key: string, text: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleTestRequest = async (method: string, endpointParams: any[]) => {
    const startTime = performance.now();
    setTestResponse({ status: 0, data: null, loading: true });
    try {
      let url = `/api${activePath}`;
      const queryParams: string[] = [];

      if (endpointParams) {
        endpointParams.forEach((p: any) => {
          const val =
            paramValues[p.name] !== undefined
              ? paramValues[p.name]
              : p.example ||
                (p.schema?.enum
                  ? p.schema.enum[0]
                  : p.schema?.type === "integer"
                  ? "1"
                  : "");
          if (val) {
            if (p.in === "path") {
              url = url.replace(`{${p.name}}`, val);
            } else if (p.in === "query") {
              queryParams.push(`${p.name}=${encodeURIComponent(val)}`);
            }
          }
        });
      }

      if (queryParams.length > 0) url += `?${queryParams.join("&")}`;

      const res = await fetch(url, { method: method.toUpperCase() });
      const durationMs = Math.round(performance.now() - startTime);
      let data: unknown;
      const rawText = await res.text();
      const contentType = res.headers.get("content-type") ?? "";

      if (contentType.includes("text/event-stream")) {
        data = rawText
          .split("\n")
          .filter((l) => l.startsWith("data: "))
          .map((l) => {
            try {
              return JSON.parse(l.slice(6));
            } catch {
              return l.slice(6);
            }
          });
      } else {
        try {
          data = JSON.parse(rawText);
        } catch {
          data = rawText;
        }
      }

      setTestResponse({
        status: res.status,
        data,
        loading: false,
        durationMs,
        contentType,
      });
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - startTime);
      setTestResponse({
        status: 0,
        data: { error: err.message },
        loading: false,
        durationMs,
      });
    }
  };

  const pathData = (spec.paths as any)[activePath];
  const method = pathData ? (Object.keys(pathData)[0] as string) : "get";
  const endpoint = pathData?.[method];

  // Build example URL preview
  let previewUrl = `/api${activePath}`;
  const previewQuery: string[] = [];
  if (endpoint?.parameters) {
    endpoint.parameters.forEach((p: any) => {
      const val =
        paramValues[p.name] !== undefined
          ? paramValues[p.name]
          : p.example ||
            (p.schema?.enum ? p.schema.enum[0] : p.schema?.type === "integer" ? "1" : "");
      if (val) {
        if (p.in === "path") previewUrl = previewUrl.replace(`{${p.name}}`, val);
        else if (p.in === "query") previewQuery.push(`${p.name}=${encodeURIComponent(val)}`);
      }
    });
  }
  if (previewQuery.length) previewUrl += `?${previewQuery.join("&")}`;

  const fullCurlCommand = `curl -X ${method.toUpperCase()} "${origin}${previewUrl}" \\\n  -H "Accept: application/json"`;

  return (
    <div className="docs-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ── MOBILE HEADER ── */}
      <div className="mobile-header">
        <div className="mobile-title">
          <span className="dot" />
          <span>Anikoto API</span>
        </div>
        <button
          className="mobile-toggle-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? "✕ Close" : "☰ Endpoints"}
        </button>
      </div>

      {/* ── SIDEBAR ── */}
      <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-badge">REST API · v1.0</div>
          <h1 className="sidebar-title">Anikoto Scraper</h1>
          <p className="sidebar-sub">High-Speed Anime Data & Captions</p>

          <div className="search-wrap">
            <input
              type="text"
              className="search-input"
              placeholder="Search endpoints..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <nav className="sidebar-nav">
          {Object.entries(filteredGrouped).length === 0 ? (
            <div className="no-endpoints">No endpoints found</div>
          ) : (
            Object.entries(filteredGrouped).map(([tag, paths]) => (
              <div key={tag} className="nav-group">
                <div
                  className="nav-group-label"
                  style={{ color: TAG_COLORS[tag] ?? "#94a3b8" }}
                >
                  <span
                    className="tag-pill"
                    style={{
                      backgroundColor: `${TAG_COLORS[tag] ?? "#94a3b8"}20`,
                      borderColor: `${TAG_COLORS[tag] ?? "#94a3b8"}50`,
                    }}
                  >
                    {tag}
                  </span>
                  <span className="tag-count">{paths.length}</span>
                </div>
                {paths.map((path) => {
                  const m = Object.keys((spec.paths as any)[path])[0];
                  return (
                    <div
                      key={path}
                      className={`nav-item ${activePath === path ? "active" : ""}`}
                      onClick={() => {
                        setActivePath(path);
                        setMobileMenuOpen(false);
                      }}
                    >
                      <span className={`method-badge method-${m}`}>{m}</span>
                      <span className="nav-path">{path}</span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="author-row">
            <span>Maintained by</span>
            <a
              href="https://github.com/ayushmadara"
              target="_blank"
              rel="noopener noreferrer"
              className="author-link"
            >
              ayushmadara ↗
            </a>
          </div>
          <div className="repo-row">
            <a
              href="https://github.com/ayushmadara/anikoto-API"
              target="_blank"
              rel="noopener noreferrer"
              className="repo-link"
            >
              ★ GitHub Repository
            </a>
          </div>
          <span className="educational-note">For educational purposes only.</span>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="main">
        {endpoint && (
          <>
            {/* Header / Title */}
            <div className="endpoint-header">
              <div className="tag-row">
                <span
                  className="badge-tag"
                  style={{
                    color: TAG_COLORS[endpoint.tags?.[0]] ?? "#818cf8",
                    borderColor: `${TAG_COLORS[endpoint.tags?.[0]] ?? "#818cf8"}40`,
                    background: `${TAG_COLORS[endpoint.tags?.[0]] ?? "#818cf8"}15`,
                  }}
                >
                  {endpoint.tags?.[0] ?? "API"}
                </span>
                <span className="endpoint-op">{endpoint.operationId}</span>
              </div>
              <h2 className="endpoint-title">{endpoint.summary}</h2>

              <div className="endpoint-url-bar">
                <span className={`method-badge method-${method} lg`}>
                  {method.toUpperCase()}
                </span>
                <code className="endpoint-path">{previewUrl}</code>
                <button
                  className="copy-btn mini"
                  onClick={() => copyToClipboard("url", `${origin}${previewUrl}`)}
                >
                  {copiedKey === "url" ? "✓ Copied" : "Copy URL"}
                </button>
              </div>

              {endpoint.description && (
                <div
                  className="endpoint-desc"
                  dangerouslySetInnerHTML={{ __html: endpoint.description }}
                />
              )}
            </div>

            {/* Quick Presets (if available) */}
            {PRESETS[activePath] && (
              <section className="section presets-section">
                <h3 className="section-title">⚡ Quick Test Presets</h3>
                <div className="preset-badges">
                  {PRESETS[activePath].map((preset, idx) => (
                    <button
                      key={idx}
                      className="preset-btn"
                      onClick={() => {
                        setParamValues({ ...paramValues, ...preset.params });
                      }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Example Request / cURL */}
            <section className="section">
              <div className="section-header-row">
                <h3 className="section-title">Example Request</h3>
                <button
                  className="copy-btn"
                  onClick={() => copyToClipboard("curl", fullCurlCommand)}
                >
                  {copiedKey === "curl" ? "✓ Copied" : "Copy cURL"}
                </button>
              </div>
              <div className="code-block">
                <div className="code-block-header">cURL</div>
                <div className="code-block-body">
                  <pre>{fullCurlCommand}</pre>
                </div>
              </div>
            </section>

            {/* Parameters & Interactive Playground */}
            {endpoint.parameters?.length > 0 && (
              <section className="section">
                <h3 className="section-title">Parameters</h3>
                <div className="table-wrap">
                  <table className="params-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>In</th>
                        <th>Type</th>
                        <th>Value</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {endpoint.parameters.map((param: any, idx: number) => {
                        const defaultVal =
                          param.example ||
                          (param.schema?.enum ? param.schema.enum[0] : "");
                        const currentVal =
                          paramValues[param.name] !== undefined
                            ? paramValues[param.name]
                            : defaultVal;
                        return (
                          <tr key={idx}>
                            <td>
                              <span className="param-name">{param.name}</span>
                              {param.required && (
                                <span className="param-required">*</span>
                              )}
                            </td>
                            <td>
                              <span className="param-in">{param.in}</span>
                            </td>
                            <td>
                              <span className="param-type">
                                {param.schema?.type ?? "string"}
                              </span>
                            </td>
                            <td>
                              {param.schema?.enum ? (
                                <select
                                  className="param-input"
                                  value={currentVal}
                                  onChange={(e) =>
                                    setParamValues({
                                      ...paramValues,
                                      [param.name]: e.target.value,
                                    })
                                  }
                                >
                                  {param.schema.enum.map((opt: string) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  className="param-input"
                                  placeholder={String(defaultVal)}
                                  value={currentVal}
                                  onChange={(e) =>
                                    setParamValues({
                                      ...paramValues,
                                      [param.name]: e.target.value,
                                    })
                                  }
                                />
                              )}
                            </td>
                            <td className="param-desc">
                              {param.description ?? "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Send button */}
                <div className="action-row">
                  <button
                    className="send-btn"
                    disabled={testResponse?.loading}
                    onClick={() => handleTestRequest(method, endpoint.parameters)}
                  >
                    {testResponse?.loading ? (
                      <span className="spinner-label">
                        <span className="spinner" /> Executing Request…
                      </span>
                    ) : (
                      "▶ Send Request"
                    )}
                  </button>
                  {testResponse && (
                    <button
                      className="reset-btn"
                      onClick={() => setTestResponse(null)}
                    >
                      Clear Response
                    </button>
                  )}
                </div>

                {/* Live response */}
                {testResponse && (
                  <div className="live-response">
                    <div className="live-response-header">
                      <div className="live-meta">
                        <span className="live-label">Live Response</span>
                        {testResponse.durationMs !== undefined && (
                          <span className="latency-badge">
                            ⚡ {testResponse.durationMs}ms
                          </span>
                        )}
                        <span
                          className={`status-badge ${
                            testResponse.status >= 400 || testResponse.status === 0
                              ? "error"
                              : "ok"
                          }`}
                        >
                          {testResponse.loading
                            ? "Fetching…"
                            : testResponse.status === 0
                            ? "Network Error"
                            : `HTTP ${testResponse.status}`}
                        </span>
                      </div>
                      {!testResponse.loading && Boolean(testResponse.data) && (
                        <button
                          className="copy-btn mini"
                          onClick={() =>
                            copyToClipboard(
                              "response",
                              typeof testResponse.data === "object"
                                ? JSON.stringify(testResponse.data, null, 2)
                                : String(testResponse.data)
                            )
                          }
                        >
                          {copiedKey === "response" ? "✓ Copied" : "Copy JSON"}
                        </button>
                      )}
                    </div>
                    <div className="live-response-body">
                      {testResponse.loading ? (
                        <div className="loading-state">
                          <span className="spinner" />
                          <span className="muted">Waiting for response from endpoint…</span>
                        </div>
                      ) : (
                        <pre>
                          {typeof testResponse.data === "object"
                            ? JSON.stringify(testResponse.data, null, 2)
                            : String(testResponse.data)}
                        </pre>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Response schemas */}
            <section className="section">
              <h3 className="section-title">Response Schema</h3>
              {Object.entries(endpoint.responses).map(
                ([code, resData]: [string, any]) => {
                  const isError = code.startsWith("4") || code.startsWith("5");
                  const schema = resData.content?.["application/json"]?.schema;
                  return (
                    <div className="response-block" key={code}>
                      <div className="response-header">
                        <span
                          className={`status-badge ${isError ? "error" : "ok"}`}
                        >
                          {code}
                        </span>
                        <span className="muted">{resData.description}</span>
                      </div>
                      {schema && (
                        <div className="response-body">
                          <pre>
                            {JSON.stringify(schema, null, 2).replace(
                              /"\$ref": "#\/components\/schemas\/(.*?)"/g,
                              '"$1": { ... }'
                            )}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

// ── CSS STYLES ──────────────────────────────────────────────────────────────
const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .docs-root {
    display: flex;
    min-height: 100vh;
    background: #090d16;
    color: #cbd5e1;
    font-family: var(--font-geist-sans), ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.6;
  }

  /* ── Mobile header ── */
  .mobile-header {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 56px;
    background: #0d1322;
    border-bottom: 1px solid rgba(99,102,241,.2);
    padding: 0 16px;
    align-items: center;
    justify-content: space-between;
    z-index: 50;
  }
  .mobile-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 15px;
    color: #f8fafc;
  }
  .mobile-title .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 8px #10b981;
  }
  .mobile-toggle-btn {
    background: rgba(99,102,241,.15);
    border: 1px solid rgba(99,102,241,.3);
    color: #c7d2fe;
    font-size: 12px;
    font-weight: 600;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
  }

  /* ── Sidebar ── */
  .sidebar {
    width: 300px;
    flex-shrink: 0;
    background: #080c16;
    border-right: 1px solid rgba(99,102,241,.15);
    display: flex;
    flex-direction: column;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    z-index: 40;
  }

  .sidebar-header {
    padding: 24px 20px 16px;
    border-bottom: 1px solid rgba(99,102,241,.12);
  }
  .sidebar-badge {
    display: inline-block;
    background: rgba(99,102,241,.15);
    border: 1px solid rgba(99,102,241,.35);
    border-radius: 999px;
    padding: 2px 10px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #a5b4fc;
    margin-bottom: 8px;
  }
  .sidebar-title {
    font-size: 17px;
    font-weight: 700;
    color: #f8fafc;
    margin-bottom: 2px;
    letter-spacing: -0.01em;
  }
  .sidebar-sub {
    font-size: 11px;
    color: #64748b;
    margin-bottom: 14px;
  }

  .search-wrap {
    position: relative;
    width: 100%;
  }
  .search-input {
    width: 100%;
    background: rgba(15,23,42,.7);
    border: 1px solid rgba(99,102,241,.2);
    border-radius: 6px;
    padding: 7px 28px 7px 10px;
    color: #f1f5f9;
    font-size: 12px;
    outline: none;
    transition: border-color .15s;
  }
  .search-input:focus {
    border-color: #6366f1;
    background: rgba(15,23,42,.95);
  }
  .search-clear {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: #64748b;
    font-size: 11px;
    cursor: pointer;
    padding: 2px 4px;
  }
  .search-clear:hover { color: #f8fafc; }

  .sidebar-nav {
    flex: 1;
    padding: 12px 0;
    overflow-y: auto;
  }
  .no-endpoints {
    padding: 24px 20px;
    text-align: center;
    color: #64748b;
    font-size: 12px;
  }

  .nav-group { margin-bottom: 10px; }

  .nav-group-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 20px;
    font-size: 11px;
    font-weight: 700;
  }
  .tag-pill {
    padding: 1px 8px;
    border-radius: 4px;
    border: 1px solid;
    text-transform: uppercase;
    letter-spacing: .05em;
    font-size: 10px;
  }
  .tag-count {
    color: #475569;
    font-size: 10px;
    font-family: var(--font-geist-mono), monospace;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 20px;
    cursor: pointer;
    border-left: 3px solid transparent;
    transition: background .15s, border-color .15s;
  }
  .nav-item:hover { background: rgba(99,102,241,.06); }
  .nav-item.active {
    background: rgba(99,102,241,.12);
    border-left-color: #818cf8;
  }
  .nav-path {
    font-family: var(--font-geist-mono), ui-monospace, monospace;
    font-size: 12px;
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .nav-item.active .nav-path { color: #e0e7ff; font-weight: 500; }

  .sidebar-footer {
    padding: 14px 20px;
    border-top: 1px solid rgba(255,255,255,.06);
    background: rgba(6,9,16,.6);
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    color: #475569;
  }
  .author-row, .repo-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .author-link, .repo-link {
    color: #818cf8;
    text-decoration: none;
    font-weight: 600;
    transition: color .15s;
  }
  .author-link:hover, .repo-link:hover { color: #a5b4fc; text-decoration: underline; }
  .educational-note { color: #334155; font-size: 10px; margin-top: 2px; }

  /* ── Method badges ── */
  .method-badge {
    font-size: 9px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    text-transform: uppercase;
    flex-shrink: 0;
    font-family: var(--font-geist-mono), monospace;
    letter-spacing: .04em;
  }
  .method-badge.lg {
    font-size: 11px;
    padding: 4px 10px;
    border-radius: 5px;
  }
  .method-get  { background: rgba(52,211,153,.15); color: #34d399; border: 1px solid rgba(52,211,153,.3); }
  .method-post { background: rgba(129,140,248,.15); color: #818cf8; border: 1px solid rgba(129,140,248,.3); }
  .method-put  { background: rgba(245,158,11,.15);  color: #f59e0b; border: 1px solid rgba(245,158,11,.3); }
  .method-delete { background: rgba(248,113,113,.15); color: #f87171; border: 1px solid rgba(248,113,113,.3); }

  /* ── Main content ── */
  .main {
    flex: 1;
    margin-left: 300px;
    padding: 44px 56px;
    max-width: 960px;
    min-width: 0;
  }

  .endpoint-header { margin-bottom: 36px; }

  .tag-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .badge-tag {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: .06em;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid;
  }
  .endpoint-op {
    font-family: var(--font-geist-mono), monospace;
    font-size: 11px;
    color: #64748b;
  }

  .endpoint-title {
    font-size: 26px;
    font-weight: 700;
    color: #f8fafc;
    margin-bottom: 14px;
    letter-spacing: -0.02em;
  }

  .endpoint-url-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(15,23,42,.7);
    border: 1px solid rgba(99,102,241,.2);
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 14px;
  }

  .endpoint-path {
    flex: 1;
    font-family: var(--font-geist-mono), monospace;
    font-size: 13px;
    color: #e2e8f0;
    word-break: break-all;
  }

  .endpoint-desc {
    color: #94a3b8;
    font-size: 13.5px;
    line-height: 1.65;
  }

  /* ── Presets ── */
  .presets-section { margin-bottom: 28px; }
  .preset-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .preset-btn {
    background: rgba(236,72,153,.12);
    border: 1px solid rgba(236,72,153,.35);
    color: #f472b6;
    padding: 5px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all .15s;
  }
  .preset-btn:hover {
    background: rgba(236,72,153,.22);
    border-color: #ec4899;
    transform: translateY(-1px);
  }

  /* ── Sections ── */
  .section { margin-bottom: 36px; }

  .section-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid rgba(99,102,241,.12);
  }

  .section-title {
    font-size: 12px;
    font-weight: 700;
    color: #a5b4fc;
    text-transform: uppercase;
    letter-spacing: .08em;
  }

  /* ── Buttons ── */
  .copy-btn {
    background: rgba(99,102,241,.12);
    border: 1px solid rgba(99,102,241,.3);
    color: #c7d2fe;
    padding: 4px 10px;
    border-radius: 5px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background .15s, border-color .15s;
  }
  .copy-btn:hover {
    background: rgba(99,102,241,.25);
    border-color: #818cf8;
  }
  .copy-btn.mini {
    padding: 3px 8px;
    font-size: 10px;
  }

  /* ── Code block ── */
  .code-block {
    background: #060911;
    border: 1px solid rgba(99,102,241,.18);
    border-radius: 8px;
    overflow: hidden;
  }
  .code-block-header {
    padding: 8px 14px;
    background: rgba(99,102,241,.06);
    border-bottom: 1px solid rgba(99,102,241,.12);
    font-size: 10.5px;
    font-weight: 600;
    color: #64748b;
    letter-spacing: .06em;
    text-transform: uppercase;
  }
  .code-block-body { padding: 14px; overflow-x: auto; }
  .code-block-body pre {
    font-family: var(--font-geist-mono), monospace;
    font-size: 12.5px;
    color: #94a3b8;
    line-height: 1.6;
  }

  /* ── Params table ── */
  .table-wrap { overflow-x: auto; margin-bottom: 18px; }

  .params-table {
    width: 100%;
    border-collapse: collapse;
  }
  .params-table th {
    text-align: left;
    padding: 10px 12px;
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: .06em;
    border-bottom: 1px solid rgba(99,102,241,.15);
  }
  .params-table td {
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255,255,255,.04);
    vertical-align: top;
  }
  .params-table tr:last-child td { border-bottom: none; }

  .param-name {
    font-family: var(--font-geist-mono), monospace;
    font-weight: 600;
    color: #c7d2fe;
    font-size: 13px;
  }
  .param-required {
    color: #f87171;
    margin-left: 4px;
    font-size: 13px;
  }
  .param-in {
    font-size: 11px;
    color: #64748b;
    font-family: var(--font-geist-mono), monospace;
  }
  .param-type {
    font-family: var(--font-geist-mono), monospace;
    font-size: 11px;
    color: #818cf8;
    background: rgba(129,140,248,.1);
    border: 1px solid rgba(129,140,248,.2);
    padding: 1px 6px;
    border-radius: 4px;
  }
  .param-desc { color: #94a3b8; font-size: 12.5px; line-height: 1.5; }

  .param-input {
    background: rgba(15,23,42,.8);
    border: 1px solid rgba(99,102,241,.25);
    color: #e2e8f0;
    padding: 6px 10px;
    border-radius: 5px;
    width: 100%;
    font-family: var(--font-geist-mono), monospace;
    font-size: 12px;
    transition: border-color .15s;
  }
  .param-input:focus {
    outline: none;
    border-color: #818cf8;
    background: rgba(15,23,42,1);
  }

  /* ── Action row ── */
  .action-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }

  .send-btn {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    border: none;
    padding: 10px 22px;
    border-radius: 7px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: opacity .15s, transform .1s;
    font-family: var(--font-geist-sans), sans-serif;
  }
  .send-btn:hover { opacity: .9; transform: translateY(-1px); }
  .send-btn:active { transform: translateY(0); }
  .send-btn:disabled { opacity: .5; cursor: not-allowed; transform: none; }

  .reset-btn {
    background: none;
    border: 1px solid rgba(148,163,184,.25);
    color: #94a3b8;
    padding: 9px 16px;
    border-radius: 7px;
    font-size: 12px;
    cursor: pointer;
    transition: all .15s;
  }
  .reset-btn:hover {
    color: #f1f5f9;
    border-color: rgba(148,163,184,.5);
  }

  .spinner-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid rgba(255,255,255,.3);
    border-top-color: #fff;
    border-radius: 50%;
    display: inline-block;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Live response ── */
  .live-response {
    background: #060911;
    border: 1px solid rgba(99,102,241,.25);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 12px;
  }
  .live-response-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    background: rgba(99,102,241,.08);
    border-bottom: 1px solid rgba(99,102,241,.15);
  }
  .live-meta {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .live-label { font-weight: 600; font-size: 12px; color: #94a3b8; }

  .latency-badge {
    font-family: var(--font-geist-mono), monospace;
    font-size: 11px;
    color: #fbbf24;
    background: rgba(251,191,36,.1);
    border: 1px solid rgba(251,191,36,.25);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .live-response-body {
    padding: 16px;
    overflow-x: auto;
    max-height: 440px;
    overflow-y: auto;
  }
  .loading-state {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #64748b;
    font-size: 13px;
    padding: 20px 0;
  }
  .live-response-body pre {
    font-family: var(--font-geist-mono), monospace;
    font-size: 12px;
    color: #cbd5e1;
    line-height: 1.6;
  }

  /* ── Status badges ── */
  .status-badge {
    font-family: var(--font-geist-mono), monospace;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .status-badge.ok    { color: #34d399; background: rgba(52,211,153,.12); border: 1px solid rgba(52,211,153,.3); }
  .status-badge.error { color: #f87171; background: rgba(248,113,113,.12); border: 1px solid rgba(248,113,113,.3); }

  /* ── Response blocks ── */
  .response-block {
    background: rgba(8,12,22,.7);
    border: 1px solid rgba(99,102,241,.14);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 12px;
    transition: border-color .15s;
  }
  .response-block:hover { border-color: rgba(99,102,241,.28); }
  .response-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    background: rgba(99,102,241,.04);
    border-bottom: 1px solid rgba(99,102,241,.1);
  }
  .response-body {
    padding: 16px;
    overflow-x: auto;
  }
  .response-body pre {
    font-family: var(--font-geist-mono), monospace;
    font-size: 12px;
    color: #64748b;
    line-height: 1.6;
  }

  .muted { color: #64748b; font-size: 12.5px; }

  /* ── Scrollbars ── */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(99,102,241,.2); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(99,102,241,.4); }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .mobile-header { display: flex; }
    .sidebar {
      transform: translateX(-100%);
      transition: transform .25s ease-in-out;
      top: 56px;
      height: calc(100vh - 56px);
      width: 100%;
      max-width: 320px;
    }
    .sidebar.open {
      transform: translateX(0);
      box-shadow: 10px 0 30px rgba(0,0,0,.6);
    }
    .main {
      margin-left: 0;
      padding: 76px 20px 40px;
    }
    .endpoint-title { font-size: 22px; }
  }
`;
