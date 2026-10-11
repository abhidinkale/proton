const app = require('./app');
const { getProviderStatus } = require('./providers/factory');

const port = process.env.PORT || 3002;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Proton Backend API running on port ${port}`);
    const status = getProviderStatus();
    console.log(`AI Pipeline: mode=${status.mode}, provider=${status.provider}, model=${status.model}, configured=${status.configured}`);
  });
}

module.exports = app;
