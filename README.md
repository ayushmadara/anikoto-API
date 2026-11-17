<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=240&color=0:0d1117,50:1b2a05,100:ccff00&text=Anikoto%20API&fontColor=ffffff&fontSize=68&fontAlignY=38&desc=Anime%20metadata%20%C2%B7%20streaming%20sources%20%C2%B7%20captions&descSize=18&descAlignY=60&animation=twinkling" alt="Anikoto API" width="100%" />

<a href="https://git.io/typing-svg">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=20&duration=2800&pause=800&color=CCFF00&center=true&vCenter=true&width=640&lines=17+REST+endpoints+for+anime+data;Streaming+sources+%2B+HLS+proxy;SRT+%2F+ASS+%2F+VTT+to+WebVTT+on+the+fly;Self-host+on+Vercel+or+Cloudflare" alt="Typing intro" />
</a>

<br/><br/>

<a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16-0d1117?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js 16" /></a>
<a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5-0d1117?style=for-the-badge&logo=typescript&logoColor=3178C6" alt="TypeScript" /></a>
<a href="https://workers.cloudflare.com"><img src="https://img.shields.io/badge/Cloudflare%20Workers-0d1117?style=for-the-badge&logo=cloudflare&logoColor=F38020" alt="Cloudflare Workers" /></a>
<a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-0d1117?style=for-the-badge&logo=opensourceinitiative&logoColor=22c55e" alt="MIT License" /></a>
<a href="https://github.com/ayushmadara/anikoto-API"><img src="https://img.shields.io/badge/Author-ayushmadara-ccff00?style=for-the-badge&logo=github&logoColor=black" alt="Author" /></a>

<br/><br/>

<a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fayushmadara%2Fanikoto-API"><img src="https://vercel.com/button" alt="Deploy with Vercel" /></a>

<br/><br/>

<a href="#features">Features</a> &nbsp;•&nbsp;
<a href="#architecture">Architecture</a> &nbsp;•&nbsp;
<a href="#quick-start">Quick Start</a> &nbsp;•&nbsp;
<a href="#api-reference">API</a> &nbsp;•&nbsp;
<a href="#captions-engine">Captions</a> &nbsp;•&nbsp;
<a href="#cloudflare-worker">Cloudflare</a> &nbsp;•&nbsp;
<a href="#project-structure">Structure</a>

</div>

<br/>

> [!WARNING]
> **For educational and research purposes only.** This is an independent open-source project and is not affiliated with, sponsored by, or endorsed by anikoto.net or any streaming provider. All scraped data, media and trademarks belong to their respective owners.

> [!IMPORTANT]
> **Self-host your own instance.** Public instances are often rate-limited or blocked by upstream CDNs. Deploy a private copy on **Vercel**, a **Node.js VPS**, or use the bundled **Cloudflare Worker** for streaming.

<br/>

<a id="features"></a>
## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### 🚀 Scraping core
- **17 REST endpoints** covering spotlight, latest episodes, recommendations, search, filters, schedule, tooltips and streaming sources
- **Cheerio + Axios** parsing with header and User-Agent rotation
- **TTL caching** per endpoint, with `?refresh=1` to bypass it

</td>
<td width="50%" valign="top">

### 💬 Captions and subtitles
- **Format conversion:** `.srt`, `.ass` and `.vtt` become standard WebVTT on the fly
- **JSON cues:** pass `format=json` to get `start`, `end` and `text` for apps and custom players
- **Referer handling** for restricted subtitle hosts such as `mysubsplay.com` and `megaplay.buzz`

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🛡️ Proxy and SSRF protection
- **Streamed responses:** HLS (`.m3u8` / `.ts`) is piped through as a `ReadableStream`
- **Domain allowlist** that blocks private subnets, localhost and unknown origins
- **Proxy pool:** outbound rotation via `PROXIES`, with exponential backoff

</td>
<td width="50%" valign="top">

### 📖 Built-in docs UI
- **OpenAPI 3.0 playground** served at `/` with preset payloads
- **Developer tools:** endpoint search, one-click cURL, latency readout, mobile drawer
- **Typed end to end:** TypeScript with a consistent response envelope

</td>
</tr>
</table>

<br/>

<a id="architecture"></a>
## 🏛️ Architecture

```mermaid
flowchart LR
    subgraph Client["Client"]
        A["Web player / app / mobile"]
    end

    subgraph API["Anikoto API (Next.js 16)"]
        B["Docs UI  /"]
        C["Scraper handlers  /api/*"]
        D["Captions converter  /api/captions"]
        E["Stream proxy  /api/proxy"]
    end

    subgraph Edge["Optional edge proxy"]
        F["Cloudflare Worker"]
    end

    subgraph Upstream["Upstream hosts"]
        G["anikoto.net"]
        H["Megaplay / Vidstream CDN"]
        I["Subtitle CDNs (mysubsplay.com)"]
    end

    A --> B
    A -->|"Fetch data"| C
    A -->|"Fetch subtitles"| D
    A -->|"Stream video (HLS)"| E
    A -.->|"Direct edge stream"| F

    C -->|"Cheerio scrape"| G
    D -->|"Fetch and convert"| I
    E -->|"Chunk pipe"| H
    F -->|"Stream pipe"| H
```

<br/>

<a id="quick-start"></a>
## 🚀 Quick Start

**1. Clone and install**

```bash
git clone https://github.com/ayushmadara/anikoto-API.git
cd anikoto-API
npm install
```

**2. Configure environment**

Create a `.env` file in the project root:

```env
BASE_URL=https://anikoto.net
CORS_ALLOWED_ORIGIN=*
# CF_WORKER_URL=https://your-worker-name.workers.dev
# PUBLIC_BASE_URL=https://your-api.vercel.app
# PROXIES=http://user:pass@proxy1:8080,http://user:pass@proxy2:8080
```

| Variable | Required | Purpose |
| :--- | :---: | :--- |
| `BASE_URL` | yes | Upstream site to scrape |
| `CORS_ALLOWED_ORIGIN` | no | Allowed CORS origin (default `*`) |
| `CF_WORKER_URL` | no | Route video and subtitle proxying through your Cloudflare Worker |
| `PUBLIC_BASE_URL` | no | Public origin of your deployed API, used when building proxy URLs |
| `PROXIES` | no | Comma-separated outbound HTTP/SOCKS proxies for IP rotation |

**3. Run it**

```bash
npm run dev        # http://localhost:3000 opens the docs and live test console
```

```bash
npm run build      # production build
npm start
```

<br/>

<a id="api-reference"></a>
## 📖 API Reference

Every endpoint returns the same envelope:

```jsonc
// Success
{ "ok": true, "cached": true, "data": { } }

// Error
{ "ok": false, "message": "Error description" }
```

> [!TIP]
> Add `?refresh=1` to any request to skip the cache and trigger a fresh scrape.

> [!NOTE]
> The cache is in-memory. On serverless hosts such as Vercel it lives per warm instance, so it can reset between cold starts.

### 🔎 Discover

| Method | Endpoint | Description | Cache |
| :---: | :--- | :--- | :---: |
| `GET` | `/api/home` | Spotlight carousel, latest episodes, top anime by day, week and month | 5 min |
| `GET` | `/api/search?keyword=&page=` | Keyword search with pagination | 2 min |
| `GET` | `/api/filter` | Multi-parameter search: genres, season, year, sort, type, rating | 5 min |
| `GET` | `/api/updated?page=` | Latest updated anime from `/latest-updated` | 5 min |
| `GET` | `/api/widget?name=&page=` | Home widgets: `updated-all`, `updated-sub`, `updated-dub`, `trending`, `random` | 5 min |
| `GET` | `/api/schedule?tz=&images=` | Airing schedule by weekday, with optional timezone offset and posters | 1 hour |

### 🗂️ Browse

| Method | Endpoint | Description | Cache |
| :---: | :--- | :--- | :---: |
| `GET` | `/api/genre/:genre?page=` | Browse by genre slug | 5 min |
| `GET` | `/api/type/:type?page=` | Browse by format: `tv`, `movie`, `ova`, `ona`, `special`, `music` | 5 min |
| `GET` | `/api/status?type=&page=` | Airing status: `currently-airing`, `finished-airing`, `not-yet-aired` | 5 min |

### 🎌 Anime details

| Method | Endpoint | Description | Cache |
| :---: | :--- | :--- | :---: |
| `GET` | `/api/anime/:slug` | Details, synopsis, ratings and studio | 30 min |
| `GET` | `/api/anime/:slug/episodes` | Episode list with pagination and range filtering | 10 min |
| `GET` | `/api/anime/:slug/related` | Watch order, sequels, prequels and side stories | 30 min |
| `GET` | `/api/anime/:slug/recommendations` | Community recommendations | 30 min |
| `GET` | `/api/anime/tooltip/:id` | Hovercard data from the element's `data-tip` ID | 30 min |

### 🎬 Watch and media

| Method | Endpoint | Description | Cache |
| :---: | :--- | :--- | :---: |
| `GET` | `/api/watch/:slug?ep=` | Server sources, HLS playlist, subtitles, intro and outro skip times | 10 min |
| `GET` | `/api/captions?url=` | Subtitle fetcher with WebVTT conversion or JSON cues | 24 hours |
| `GET` | `/api/proxy?url=` | Video and asset streaming proxy with CORS headers | none |

<br/>

<a id="captions-engine"></a>
## 💬 Captions Engine

Anime CDNs host subtitles in mixed formats (`.vtt`, `.srt`, `.ass`) and block third-party players with strict `Referer` checks. `/api/captions` handles both problems.

<details>
<summary><b>Example track object from <code>/api/watch/:slug</code></b></summary>
<br/>

```json
{
  "file": "https://qra5z.mysubsplay.com/.../subtitles/eng-2.vtt",
  "label": "English",
  "kind": "captions",
  "default": true,
  "proxyUrl": "/api/proxy?url=https%3A%2F%2Fqra5z.mysubsplay.com...",
  "captionUrl": "/api/captions?url=https%3A%2F%2Fqra5z...&referer=https%3A%2F%2Fmegaplay.buzz%2F"
}
```

</details>

### Option 1: WebVTT (default)

```html
<video controls crossorigin="anonymous">
  <source src="/api/proxy?url=..." type="application/x-mpegURL">
  <track label="English" kind="subtitles" srclang="en"
         src="/api/captions?url=...&referer=https://megaplay.buzz/" default>
</video>
```

> [!NOTE]
> Native HLS playback only works in Safari. In other browsers, attach the stream with [hls.js](https://github.com/video-dev/hls.js) and keep the same `<track>` element.

### Option 2: JSON cues

```http
GET /api/captions?url=https://...&format=json
```

```json
{
  "ok": true,
  "format": "json",
  "count": 1,
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

### Tests

The converter tests run offline:

```bash
npm run test:captions
```

<br/>

<a id="cloudflare-worker"></a>
## ☁️ Cloudflare Worker

Proxying video through a serverless function can hit bandwidth and duration limits on some hosts. For heavy streaming, deploy the standalone worker in `cloudflare-worker/`. Cloudflare's free plan includes 100k requests per day.

```bash
cd cloudflare-worker
npx wrangler login
npx wrangler deploy
```

Then point the main project at it:

```env
CF_WORKER_URL=https://your-worker-name.workers.dev
```

After that, `/api/watch/:slug` returns stream and subtitle URLs routed through your worker.

<br/>

<a id="project-structure"></a>
## 🗂️ Project Structure

```text
anikoto-API/
├── src/
│   ├── app/                      # Next.js 16 App Router
│   │   ├── page.tsx              # Interactive docs UI
│   │   ├── layout.tsx            # Layout and SEO metadata
│   │   └── api/                  # REST routes
│   │       ├── anime/            # Details, episodes, related, recommendations
│   │       ├── captions/         # Subtitle fetcher and converter
│   │       ├── filter/           # Advanced filter
│   │       ├── home/             # Spotlight and latest episodes
│   │       ├── proxy/            # Streaming proxy
│   │       ├── schedule/         # Airing calendar
│   │       ├── search/           # Keyword search
│   │       └── watch/            # Sources and subtitle tracks
│   ├── lib/
│   │   ├── cache.ts              # In-memory TTL cache
│   │   ├── constants.ts          # Defaults and headers
│   │   ├── extractors.ts         # Cheerio parsing helpers
│   │   ├── fetcher.ts            # HTTP client with retry logic
│   │   ├── openapi-spec.ts       # OpenAPI definition
│   │   ├── proxy-pool.ts         # SSRF filter and proxy rotation
│   │   ├── subtitles.ts          # SRT/ASS to VTT parser
│   │   └── types.ts              # TypeScript schemas
│   └── proxy.ts                  # Edge CORS middleware
├── cloudflare-worker/            # Standalone stream proxy
├── scripts/                      # Tests and benchmarks
├── public/                       # Static assets and openapi.yaml
└── README.md
```

<br/>

## 🛠️ Tech Stack

<div align="center">

<img src="https://img.shields.io/badge/Next.js-0d1117?style=for-the-badge&logo=nextdotjs&logoColor=white" alt="Next.js" />
<img src="https://img.shields.io/badge/TypeScript-0d1117?style=for-the-badge&logo=typescript&logoColor=3178C6" alt="TypeScript" />
<img src="https://img.shields.io/badge/Cheerio-0d1117?style=for-the-badge&logo=cheerio&logoColor=ccff00" alt="Cheerio" />
<img src="https://img.shields.io/badge/Axios-0d1117?style=for-the-badge&logo=axios&logoColor=ccff00" alt="Axios" />
<img src="https://img.shields.io/badge/Cloudflare%20Workers-0d1117?style=for-the-badge&logo=cloudflare&logoColor=F38020" alt="Cloudflare Workers" />

</div>

<br/>

## 👤 Author

Built by **[ayushmadara](https://github.com/ayushmadara)**. If this project helps you, a ⭐ on [GitHub](https://github.com/ayushmadara/anikoto-API) is appreciated.

## 📄 License

Released under the **MIT License**. See [LICENSE](LICENSE) for details.

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&height=120&color=0:ccff00,50:1b2a05,100:0d1117&section=footer&animation=twinkling" alt="footer" width="100%" />

</div>
