const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Set Content Security Policy headers
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "media-src 'self' https: blob: data: *; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://api.venice.ai https://api.imgbb.com;"
  );
  next();
});

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Serve index.html for all routes (for SPA routing if needed)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

