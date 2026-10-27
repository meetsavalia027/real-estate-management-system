const { initDb } = require('./db');
const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 5000;

initDb()
  .then(() => {
    createApp().listen(PORT, () => {
      console.log(`Real Estate Management System API running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
