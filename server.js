const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8765);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function createServer() {
  return http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  let filePath = decodeURIComponent(url.pathname);
  if (filePath === "/") filePath = "/index.html";

  const resolved = path.resolve(root, `.${filePath}`);
  if (!resolved.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(resolved, (err, data) => {
    if (err) {
      send(res, 404, "Not found");
      return;
    }

    const ext = path.extname(resolved).toLowerCase();
    send(res, 200, data, {
      "Content-Type": types[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
  });
  });
}

function listen(preferredPort = port) {
  const server = createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(preferredPort, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      resolve({ server, port: address.port, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

if (require.main === module) {
  listen(port).then(({ url }) => {
    console.log(`Spotify lyrics window: ${url}`);
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { listen };
