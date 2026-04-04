# henry-http

An HTTP/1.1 server built from scratch on raw TCP sockets. No dependencies.

## Features

- **Raw TCP**: Built directly on `net.createServer`, not `http.createServer`
- **Request Parser**: Full HTTP/1.1 request parsing (method, path, headers, body)
- **Chunked Transfer**: Decodes chunked transfer encoding
- **Response Builder**: Fluent API for JSON, text, HTML, custom headers
- **Router**: Path matching with parameters (`:id`) and wildcards (`*`)
- **Middleware**: Express-like middleware chain
- **Keep-Alive**: HTTP/1.1 persistent connections
- **Static Files**: File serving with MIME types and cache control
- **CORS**: Cross-origin resource sharing middleware
- **Error Handling**: Custom error handlers with proper HTTP status codes

## Usage

```javascript
import { HttpServer } from './src/index.js';

const app = new HttpServer();

app.get('/', (req, res) => {
  res.json({ message: 'Hello, World!' });
});

app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id });
});

app.post('/data', (req, res) => {
  res.json({ received: req.json });
});

await app.listen(3000);
```

## Middleware

```javascript
// CORS
import { cors, staticFiles } from './src/index.js';
app.use(cors());

// Static files
app.use(staticFiles('./public'));

// Custom middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
```

## Test Summary

| Module | Tests | Description |
|--------|-------|-------------|
| Parser | 33 | Request parsing, headers, body, chunked, query strings |
| Server | 19 | TCP integration, routing, params, POST, errors, concurrent |
| **Total** | **52** | |

## Running Tests

```bash
node --test
```
