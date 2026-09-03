import { createApp } from './app.js';
import { config } from './config.js';
import { checkDbHealth, closePool, initInMemoryDb, bootstrapRealDb } from './db/index.js';

const app = createApp();

const server = app.listen(config.port, async () => {
  console.log(`🚀 HireFlow server listening on http://localhost:${config.port} [${config.nodeEnv}]`);
  
  // Database health check on startup
  const dbHealth = await checkDbHealth();
  if (dbHealth.status === 'connected') {
    console.log('✅ PostgreSQL database connection established.');
    try {
      await bootstrapRealDb();
      console.log('✅ Database schema verified & demo pipeline seeded.');
    } catch (bootErr) {
      console.error('Error bootstrapping database tables:', bootErr);
    }
  } else {
    console.warn(`⚠️ PostgreSQL connection not established: ${dbHealth.error || 'Connection refused'}`);
    console.log('🚀 Initializing in-memory PostgreSQL instance with full schema & demo seeds...');
    try {
      await initInMemoryDb();
      console.log('✅ In-memory PostgreSQL instance active and seeded with demo accounts.');
    } catch (memErr) {
      console.error('Failed to initialize in-memory database:', memErr);
    }
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
