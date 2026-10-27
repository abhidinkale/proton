/**
 * Organization provisioning service entry point.
 */

const organizationStore = require('./organizationStore');
const organizationService = require('./organizationService');
const clinicLinkService = require('./clinicLinkService');
const clinicLinkStore = require('./clinicLinkStore');

module.exports = {
  organizationStore,
  organizationService,
  clinicLinkService,
  clinicLinkStore,
  ...organizationService
};
