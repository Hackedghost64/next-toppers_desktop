const http = require('http');
const https = require('https');
const { URL } = require('url');
const { deriveVideoCryptKeyAndIv, decryptVideoCryptBuffer } = require('./decryptor');

class VideoStreamProxy {
  constructor(port = 0) {
    this.port = port;
    this.server = null;
    this.actualPort = null;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        this.actualPort = this.server.address().port;
        console.log(`[VideoStreamProxy] Running on http://127.0.0.1:${this.actualPort}`);
        resolve(this.actualPort);
      });

      this.server.on('error', (err) => {
        reject(err);
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }

  getUrlForManifest(manifestUrl, token = '') {
    const encoded = encodeURIComponent(manifestUrl);
    const encToken = encodeURIComponent(token || '');
    return `http://127.0.0.1:${this.actualPort}/manifest?url=${encoded}&token=${encToken}`;
  }

  handleRequest(req, res) {
    // Add CORS headers for internal renderer
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const parsedUrl = new URL(req.url, `http://127.0.0.1:${this.actualPort}`);
      const pathname = parsedUrl.pathname;

      if (pathname === '/manifest') {
        this.handleManifest(parsedUrl, req, res);
      } else if (pathname === '/decrypt') {
        this.handleDecryptSegment(parsedUrl, req, res);
      } else if (pathname === '/proxy') {
        this.handleDirectProxy(parsedUrl, req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
      }
    } catch (err) {
      console.error('[VideoStreamProxy] Request Error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Proxy error: ${err.message}`);
    }
  }

  handleManifest(parsedUrl, req, res) {
    const targetUrl = parsedUrl.searchParams.get('url');
    const token = parsedUrl.searchParams.get('token') || '';

    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing target url');
      return;
    }

    const client = targetUrl.startsWith('https:') ? https : http;
    const clientReq = client.get(targetUrl, (upstreamRes) => {
      let body = '';
      upstreamRes.on('data', chunk => { body += chunk; });
      upstreamRes.on('end', () => {
        // Rewrite m3u8 playlist lines
        const lines = body.split('\n');
        const baseUrl = new URL(targetUrl);
        const rewritten = [];

        for (let line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            rewritten.push(line);
            continue;
          }

          if (trimmed.startsWith('#')) {
            // Check for URI inside #EXT-X-KEY or similar
            if (trimmed.includes('URI="')) {
              line = trimmed.replace(/URI="([^"]+)"/, (match, uri) => {
                const absoluteUri = new URL(uri, baseUrl).toString();
                const proxied = `http://127.0.0.1:${this.actualPort}/proxy?url=${encodeURIComponent(absoluteUri)}`;
                return `URI="${proxied}"`;
              });
            }
            rewritten.push(line);
          } else {
            // This is a media segment or sub-playlist URI
            const absoluteSegmentUrl = new URL(trimmed, baseUrl).toString();
            let proxiedUrl;
            if (absoluteSegmentUrl.includes('.m3u8')) {
              proxiedUrl = `http://127.0.0.1:${this.actualPort}/manifest?url=${encodeURIComponent(absoluteSegmentUrl)}&token=${encodeURIComponent(token)}`;
            } else if (token) {
              proxiedUrl = `http://127.0.0.1:${this.actualPort}/decrypt?url=${encodeURIComponent(absoluteSegmentUrl)}&token=${encodeURIComponent(token)}`;
            } else {
              proxiedUrl = `http://127.0.0.1:${this.actualPort}/proxy?url=${encodeURIComponent(absoluteSegmentUrl)}`;
            }
            rewritten.push(proxiedUrl);
          }
        }

        const outputPlaylist = rewritten.join('\n');
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Content-Length': Buffer.byteLength(outputPlaylist),
          'Cache-Control': 'no-cache'
        });
        res.end(outputPlaylist);
      });
    });

    clientReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`Failed to fetch upstream playlist: ${err.message}`);
    });
  }

  handleDecryptSegment(parsedUrl, req, res) {
    const targetUrl = parsedUrl.searchParams.get('url');
    const token = parsedUrl.searchParams.get('token');

    if (!targetUrl || !token) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing url or token');
      return;
    }

    let key, iv;
    try {
      const derived = deriveVideoCryptKeyAndIv(token);
      key = derived.key;
      iv = derived.iv;
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(`Token derivation failed: ${e.message}`);
      return;
    }

    const client = targetUrl.startsWith('https:') ? https : http;
    const clientReq = client.get(targetUrl, (upstreamRes) => {
      const chunks = [];
      upstreamRes.on('data', chunk => chunks.push(chunk));
      upstreamRes.on('end', () => {
        const encrypted = Buffer.concat(chunks);
        try {
          const decrypted = decryptVideoCryptBuffer(encrypted, key, iv);
          res.writeHead(200, {
            'Content-Type': 'video/mp2t',
            'Content-Length': decrypted.length,
            'Cache-Control': 'public, max-age=3600'
          });
          res.end(decrypted);
        } catch (decryptErr) {
          console.error('[VideoStreamProxy] Decryption failure:', decryptErr);
          // Fallback to sending original chunks if decryption failed
          res.writeHead(200, {
            'Content-Type': 'video/mp2t',
            'Content-Length': encrypted.length
          });
          res.end(encrypted);
        }
      });
    });

    clientReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`Failed to fetch segment: ${err.message}`);
    });
  }

  handleDirectProxy(parsedUrl, req, res) {
    const targetUrl = parsedUrl.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing url');
      return;
    }

    const client = targetUrl.startsWith('https:') ? https : http;
    const headers = { ...req.headers };
    delete headers.host;

    const clientReq = client.request(targetUrl, {
      method: req.method,
      headers: headers
    }, (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(res);
    });

    clientReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end(`Proxy error: ${err.message}`);
    });

    req.pipe(clientReq);
  }
}

module.exports = VideoStreamProxy;
