import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

const PUBLIC_DIR = path.join(__dirname, 'public');

// Serve static files from public/ with html extension fallback
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html', 'htm']
}));

// Fallback to 404.html if route not found
app.use((req, res) => {
  res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'), (err) => {
    if (err) {
      res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

