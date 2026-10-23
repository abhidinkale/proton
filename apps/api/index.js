const app = require('./app');
const { getProviderStatus } = require('./providers/factory');
const { startWorkflowRuntime, stopWorkflowRuntime } = require('./services/workflow/runtime');

const port = process.env.PORT || 3002;

if (require.main === module) {
  const server = app.listen(port, () => {
    console.log(`Proton Backend API running on port ${port}`);
    const status = getProviderStatus();
    console.log(`AI Pipeline: mode=${status.mode}, provider=${status.provider}, model=${status.model}, configured=${status.configured}`);
  });

  // Durable workflow runtime: Postgres migrations + pg-boss workers.
  // A failure here is fatal in production (the clinical loop would silently
  // stop being durable) but non-fatal in development.
  startWorkflowRuntime()
    .then((result) => {
      if (result.enabled) {
        console.log(`[workflow] durable persistence online (queue=${result.queue}, scheduler=${result.scheduler})`);
      } else {
        console.log(`[workflow] disabled: ${result.reason}`);
        if (process.env.NODE_ENV === 'production') {
          console.error('[workflow] FATAL: production requires DATABASE_URL for durable workflow state.');
          process.exit(1);
        }
      }
    })
    .catch((err) => {
      console.error(`[workflow] failed to start: ${err.message}`);
      if (process.env.NODE_ENV === 'production') process.exit(1);
    });

  const shutdown = async (signal) => {
    console.log(`\n[${signal}] shutting down`);
    server.close();
    await stopWorkflowRuntime();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;
