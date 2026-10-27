const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { UPLOAD_DIR } = require('./middleware/upload');
const { HttpError } = require('./utils/helpers');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

  app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/properties', require('./routes/properties'));
  app.use('/api/favourites', require('./routes/favourites'));
  app.use('/api/enquiries', require('./routes/enquiries'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/admin', require('./routes/admin'));

  app.use('/api', (req, res, next) => next(new HttpError(404, `No API route for ${req.method} ${req.originalUrl}`)));

  // Serve the built React app (after `npm run build`) so one server runs everything
  const dist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^\/(?!api|uploads).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body is not valid JSON.' });
    }
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server.' : err.message, fields: err.details });
  });

  return app;
}

module.exports = { createApp };
