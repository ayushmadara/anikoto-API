<div align="center">

  # ⚡ Anikoto Scraper API

  <p><strong>A high-performance, enterprise-grade REST API for scraping anime metadata, streaming sources, and multi-language captions from anikoto.net</strong></p>

  <p>
    <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fayushmadara%2Fanikoto-API"><img src="https://vercel.com/button" alt="Deploy with Vercel"></a>
  </p>

  <p>
    <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16.4-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js 16"></a>
    <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"></a>
    <a href="https://workers.cloudflare.com"><img src="https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Workers"></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge" alt="MIT License"></a>
    <a href="https://github.com/ayushmadara/anikoto-API"><img src="https://img.shields.io/badge/Author-ayushmadara-8b5cf6?style=for-the-badge&logo=github&logoColor=white" alt="Author ayushmadara"></a>
  </p>

  <p>
    <a href="#-features">Features</a> •
    <a href="#-architecture">Architecture</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-api-reference">API Endpoints</a> •
    <a href="#-captions--subtitles-engine">Captions Engine</a> •
    <a href="#-cloudflare-worker-proxy">Cloudflare Proxy</a> •
    <a href="#%EF%B8%8F-project-structure">Project Structure</a>
  </p>

</div>

---

> [!WARNING]
> **For educational and research purposes only.** This project is an independent open-source project and is not affiliated with, sponsored by, or endorsed by anikoto.net or any streaming providers. All scraped data, media files, and trademarks belong to their respective copyright holders.

> [!IMPORTANT]
> **Self-Hosting Recommended:**
> Public instances are frequently rate-limited or blocked by upstream CDNs. You are strongly advised to clone and deploy your own private instance on **Vercel**, a **VPS/Node.js host**, or via the bundled **Cloudflare Worker**.

---

## ✨ Features

<table>
  <tr>
    <td width="50%">
      <h3>🚀 High-Speed Scraping Core</h3>
      <ul>
        <li><strong>17+ REST Endpoints:</strong> Spotlight, latest episodes, recommendations, search, advanced filter, weekly schedule, tooltip preview, and streaming sources.</li>
        <li><strong>Cheerio & Axios Engine:</strong> Server-side lightweight HTML parsing with anti-bot header rotation and custom User-Agents.</li>
        <li><strong>Intelligent TTL Caching:</strong> Multi-tiered in-memory caching with <code>?refresh=1</code> instant bypass.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>💬 Universal Captions & Subtitles</h3>
      <ul>
        <li><strong>Auto-Format Conversion:</strong> Transcodes upstream <code>.srt</code>, <code>.ass</code>, and <code>.vtt</code> to standard WebVTT on-the-fly.</li>
        <li><strong>JSON Cues Parser:</strong> Pass <code>format=json</code> to get structured cue timing (<code>start</code>, <code>end</code>, <code>text</code>) ready for mobile apps and custom players.</li>
        <li><strong>Referer Spoofing:</strong> Whitelisted bypass for restricted subtitle hosts (e.g. <code>mysubsplay.com</code>, <code>megaplay.buzz</code>).</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>🛡️ Enterprise Proxy & SSRF Shield</h3>
      <ul>
        <li><strong>Zero-Copy Streaming:</strong> Native <code>ReadableStream</code> chunk pipelining for HLS (<code>.m3u8</code> / <code>.ts</code>) video streams.</li>
        <li><strong>SSRF Domain Allowlist:</strong> Strict domain checking blocks private subnets, localhost, and unauthorized origins.</li>
        <li><strong>Multi-Node Proxy Pool:</strong> Outbound proxy routing via <code>PROXIES</code> rotation with exponential backoff.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>📖 Interactive Documentation UI</h3>
      <ul>
        <li><strong>Built-in OpenAPI 3.0 Playground:</strong> Live API tester directly at <code>/</code> with instant preset payloads.</li>
        <li><strong>Developer UX:</strong> Real-time endpoint search, 1-click cURL generators, latency measurement, and mobile drawer view.</li>
        <li><strong>Strict Typing:</strong> 100% TypeScript coverage with structured response envelopes.</li>
      </ul>
    </td>
  </tr>
</table>

---

## 🏛️ Architecture

```mermaid
flowchart LR
    subgraph Client ["Client Layer"]
        A[Web Player / App / Mobile]
    end

    subgraph API ["Anikoto API Layer (Next.js 16)"]
        B["Interactive Docs UI (/)"]
        C["Scraper API Handlers (/api/*)"]
        D["Captions Converter (/api/captions)"]
        E["Internal Stream Proxy (/api/proxy)"]
    end

    subgraph Edge ["Optional Edge Proxy"]
        F["Cloudflare Worker (Streaming Proxy)"]
    end

    subgraph Upstream ["Upstream Hosts"]
        G[anikoto.net]
        H[Megaplay / Vidstream CDN]
        I[Subtitle CDNs (mysubsplay.com)]
    end

    A --> B
    A -->|Fetch Data| C
    A -->|Fetch Subtitles| D
    A -->|Stream Video (HLS)| E
    A -.->|Direct Edge Stream| F

    C -->|Cheerio Scrape| G
    D -->|Fetch & Convert VTT/SRT/ASS| I
    E -->|Chunk Pipe| H
    F -->|Zero-Copy Pipe| H
```

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
# Clone the repository
git clone https://github.com/ayushmadara/anikoto-API.git
cd anikoto-API

# Install dependencies
npm install
```

### 2. Environment Configuration

Create a `.env` file in the root folder:

```env
# Upstream target base URL
BASE_URL=https://anikoto.net

# Optional: CORS allowed origins (default: "*")
CORS_ALLOWED_ORIGIN=*

# Optional: Cloudflare Worker URL for high-volume video proxying
# CF_WORKER_URL=https://your-worker-name.workers.dev

# Optional: Public origin of your deployed API
# PUBLIC_BASE_URL=https://your-api.vercel.app

# Optional: Outbound HTTP/SOCKS proxies for IP rotation
# PROXIES=http://user:pass@proxy1:8080,http://user:pass@proxy2:8080
```

### 3. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the interactive documentation and live test console.

### 4. Build for Production

```bash
npm run build
npm start
```

---

## 📖 API Reference

Every endpoint delivers a predictable response envelope:

```json
// Success Response
{
  "ok": true,
  "cached": true,
  "data": { ... }
}

// Error Response
{
  "ok": false,
  "message": "Error description"
}
```

### Available Endpoints

| Method | Endpoint | Description | Cache TTL |
| :---: | :--- | :--- | :---: |
| `GET` | `/api/home` | Spotlight carousel, latest episodes, top anime by day/week/month | 5 min |
| `GET` | `/api/search?keyword=&page=` | Keyword search with full pagination | 2 min |
| `GET` | `/api/filter` | Multi-parameter anime search (genres, season, year, sort, type, rating) | 5 min |
| `GET` | `/api/anime/:slug` | Anime details, synopsis, ratings, and studio information | 30 min |
| `GET` | `/api/anime/:slug/episodes` | Full episode list with pagination and range filtering | 10 min |
| `GET` | `/api/anime/:slug/related` | Franchise watch order, sequels, prequels, and side stories | 30 min |
| `GET` | `/api/anime/:slug/recommendations` | Algorithmic community anime recommendations | 30 min |
| `GET` | `/api/anime/tooltip/:id` | Quick hovercard data using element `data-tip` ID | 30 min |
| `GET` | `/api/updated?page=` | Latest updated anime listings from `/latest-updated` | 5 min |
| `GET` | `/api/widget?name=&page=` | Home tab widgets: `updated-all`, `updated-sub`, `updated-dub`, `trending`, `random` | 5 min |
| `GET` | `/api/status?type=&page=` | Airing status categories: `currently-airing`, `finished-airing`, `not-yet-aired` | 5 min |
| `GET` | `/api/genre/:genre?page=` | Category browse by genre slug | 5 min |
| `GET` | `/api/type/:type?page=` | Filter by media format (`tv`, `movie`, `ova`, `ona`, `special`, `music`) | 5 min |
| `GET` | `/api/schedule?tz=&images=` | Airing schedule by weekday (optional timezone offset and poster images) | 1 hour |
| `GET` | `/api/watch/:slug?ep=` | Streaming server sources, HLS m3u8 playlist, subtitles, and intro/outro skip times | 10 min |
| `GET` | `/api/captions?url=` | Subtitle track fetcher with automatic WebVTT conversion or JSON parsed cues | 24 hours |
| `GET` | `/api/proxy?url=` | High-volume video and asset streaming proxy with CORS headers | No cache |

> [!TIP]
> **Cache Bypass:** Add `?refresh=1` to any request to immediately bypass the in-memory cache and trigger a fresh scrape.

---

## 🎬 Captions & Subtitles Engine

Upstream anime CDNs host subtitles in heterogeneous formats (`.vtt`, `.srt`, `.ass`) and block third-party players through strict `Referer` checks.

The `/api/captions` endpoint solves this completely:

```json
// Example track object inside /api/watch/:slug
{
  "file": "https://qra5z.mysubsplay.com/.../subtitles/eng-2.vtt",
  "label": "English",
  "kind": "captions",
  "default": true,
  "proxyUrl": "/api/proxy?url=https%3A%2F%2Fqra5z.mysubsplay.com...",
  "captionUrl": "/api/captions?url=https%3A%2F%2Fqra5z...&referer=https%3A%2F%2Fmegaplay.buzz%2F"
}
```

### Usage Options

1. **Standard WebVTT (`format=vtt` or omitted):**
   ```html
   <video controls crossorigin="anonymous">
     <source src="/api/proxy?url=..." type="application/x-mpegURL">
     <track label="English" kind="subtitles" srclang="en" src="/api/captions?url=...&referer=https://megaplay.buzz/" default>
   </video>
   ```

2. **Parsed JSON Cues (`format=json`):**
   ```http
   GET /api/captions?url=https://...&format=json
   ```
   **Response:**
   ```json
   {
     "ok": true,
     "format": "json",
     "count": 2,
     "cues": [
       {
         "identifier": "1",
         "start": "00:01:15.200",
         "end": "00:01:18.500",
         "text": "I will become the strongest hunter."
       }
     ]
   }
   ```

### Running Caption Unit Tests

Verify the converter without internet access:

```bash
npm run test:captions
```

---

## ☁️ Cloudflare Worker Proxy

For production applications with heavy streaming traffic, deploy the standalone Cloudflare Worker in `cloudflare-worker/` for **free unlimited bandwidth** (100k requests/day free tier).

### Deploying the Worker

```bash
# Navigate to worker directory
cd cloudflare-worker

# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy Worker
wrangler deploy
```

Once deployed, set the worker URL in your main project `.env`:

```env
CF_WORKER_URL=https://your-worker-name.workers.dev
```

Now, `/api/watch/:slug` will automatically output streaming and subtitle proxy URLs routed through your Cloudflare Worker!

---

## 🗂️ Project Structure

```
anikoto-API/
├── src/
│   ├── app/                      # Next.js 16 App Router
│   │   ├── page.tsx              # Interactive OpenAPI Documentation UI
│   │   ├── layout.tsx            # Global Layout & SEO Metadata
│   │   └── api/                  # 17+ REST Endpoint Routes
│   │       ├── anime/            # Anime detail, episodes, related, recommendations
│   │       ├── captions/         # Subtitle fetcher & VTT/SRT/ASS converter
│   │       ├── filter/           # Advanced search filter
│   │       ├── home/             # Spotlight and latest episodes
│   │       ├── proxy/            # Streaming video proxy
│   │       ├── schedule/         # Airing calendar
│   │       ├── search/           # Keyword search
│   │       └── watch/            # Video sources & subtitle track builder
│   ├── lib/
│   │   ├── cache.ts              # In-memory TTL cache
│   │   ├── constants.ts          # Default settings & headers
│   │   ├── extractors.ts         # Cheerio DOM parser helpers
│   │   ├── fetcher.ts            # Resilient HTTP client with retry logic
│   │   ├── openapi-spec.ts       # Type-safe OpenAPI definition
│   │   ├── proxy-pool.ts         # SSRF filter & proxy rotation
│   │   ├── subtitles.ts          # SRT/ASS-to-VTT parser & normalizer
│   │   └── types.ts              # TypeScript schemas
│   └── proxy.ts                  # Edge CORS middleware
├── cloudflare-worker/            # Standalone zero-copy stream proxy
├── scripts/                      # Test suites & benchmarks
├── public/                       # Static assets & openapi.yaml
└── README.md
```

---

## 🛠️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org) (Turbopack, App Router)
- **Language:** [TypeScript 5](https://www.typescriptlang.org)
- **Scraping & DOM:** [Cheerio](https://cheerio.js.org) & [Axios](https://axios-http.com)
- **Caching:** [Node-Cache](https://www.npmjs.com/package/node-cache)
- **Edge Runtime:** [Cloudflare Workers](https://workers.cloudflare.com)

---

## 👤 Author

Crafted with care by **[ayushmadara](https://github.com/ayushmadara)**

⭐ If you find this project useful, please consider giving it a **Star** on [GitHub](https://github.com/ayushmadara/anikoto-API)!

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
