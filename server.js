import http from 'http';
import fs from 'fs';
import path from 'path';

// Simple static file server for SpaceJam
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const root = process.cwd();

const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.txt': 'text/plain'
};

const server = http.createServer((req, res) => {
  let urlPath = req.url.split('?')[0] || '/';
  if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
  if (urlPath.startsWith('/')) urlPath = urlPath.substring(1);
  const filePath = path.join(root, urlPath);

  fs.stat(filePath, (err, stat) => {
    if (err || !stat || !stat.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mime[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      res.statusCode = 500;
      res.end('Server error');
    });
    stream.pipe(res);
  });
});

server.listen(port, () => {
  console.log(`SpaceJam server listening on http://localhost:${port}`);
});

export default server;
