import { createApp } from './app.js';
import { config } from './config.js';
import { checkDbHealth, closePool } from './db/index.js';

const app = createApp();

const server = app.listen(config.port, async () => {
  console.log(`🚀 HireFlow server listening on http://localhost:${config.port} [${config.nodeEnv}]`);
  
  // Non-blocking database health check on startup
  const dbHealth = await checkDbHealth();
  if (dbHealth.status === 'connected') {
    console.log('✅ PostgreSQL database connection established.');
  } else {
    console.warn(`⚠️ PostgreSQL connection not established at startup: ${dbHealth.error}`);
    console.warn('ℹ️ Ensure PostgreSQL is running and DATABASE_URL is configured in your environment or .env file.');
  }
});

// Graceful shutdown handling
async function handleShutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
  server.close(async () => {
    console.log('🔒 HTTP server closed.');
    try {
      await closePool();
      console.log('🔒 PostgreSQL connection pool closed.');
    } catch (err) {
      console.error('Error closing database pool:', err);
    }
    process.exit(0);
  });

  // Force shutdown if taking longer than 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forcefully terminating server after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export { server, app };
