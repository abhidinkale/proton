/**
 * EHR Directory Service for Proton
 * 
 * Provides a comprehensive, searchable directory of US EHR endpoints
 * supporting SMART on FHIR (R4) patient-directed access:
 * - Epic Systems (Sandbox + Major US Health Systems)
 * - Oracle Health / Cerner (Sandbox + Health Systems)
 * - Athenahealth
 * - Veterans Affairs (VA Lighthouse)
 * - Medicare (CMS Blue Button 2.0)
 */

const EHR_PROVIDERS = [
  // --- Epic Systems ---
  {
    id: 'epic-sandbox',
    name: 'Epic Sandbox (Synthetic Test Patient)',
    vendor: 'Epic Systems',
    portalName: 'MyChart Sandbox',
    logo: 'https://open.epic.com/Content/Images/epic_logo.svg',
    fhirBaseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    authEndpoint: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    tokenEndpoint: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
    isSandbox: true,
    description: 'Free developer sandbox with synthetic clinical test patients (e.g. Derrick Lin, Camila Lopez)'
  },
  {
    id: 'epic-mayo-clinic',
    name: 'Mayo Clinic',
    vendor: 'Epic Systems',
    portalName: 'Mayo Clinic Patient Portal (MyChart)',
    logo: 'https://www.mayoclinic.org/assets/images/mayo-logo.svg',
    fhirBaseUrl: 'https://netcentral.mayo.edu/FHIR/R4',
    authEndpoint: 'https://netcentral.mayo.edu/OAuth2/authorize',
    tokenEndpoint: 'https://netcentral.mayo.edu/OAuth2/token',
    isSandbox: false,
    description: 'Rochester MN, Phoenix AZ, Jacksonville FL'
  },
  {
    id: 'epic-stanford',
    name: 'Stanford Health Care',
    vendor: 'Epic Systems',
    portalName: 'MyHealth (Stanford)',
    logo: 'https://stanfordhealthcare.org/content/dam/SHC/about-us/logo-stanford.svg',
    fhirBaseUrl: 'https://cstd.stanfordchildrens.org/FHIR/R4',
    authEndpoint: 'https://cstd.stanfordchildrens.org/oauth2/authorize',
    tokenEndpoint: 'https://cstd.stanfordchildrens.org/oauth2/token',
    isSandbox: false,
    description: 'Stanford, Palo Alto, Bay Area California'
  },
  {
    id: 'epic-johns-hopkins',
    name: 'Johns Hopkins Medicine',
    vendor: 'Epic Systems',
    portalName: 'MyChart - Johns Hopkins',
    logo: 'https://www.hopkinsmedicine.org/images/hopkins-logo.svg',
    fhirBaseUrl: 'https://epicmobile.johnshopkins.edu/FHIR-PRD/api/FHIR/R4',
    authEndpoint: 'https://epicmobile.johnshopkins.edu/FHIR-PRD/oauth2/authorize',
    tokenEndpoint: 'https://epicmobile.johnshopkins.edu/FHIR-PRD/oauth2/token',
    isSandbox: false,
    description: 'Baltimore MD, Washington DC'
  },
  {
    id: 'epic-cleveland-clinic',
    name: 'Cleveland Clinic',
    vendor: 'Epic Systems',
    portalName: 'MyChart - Cleveland Clinic',
    logo: 'https://my.clevelandclinic.org/assets/images/cleveland-clinic-logo.svg',
    fhirBaseUrl: 'https://api.clevelandclinic.org/FHIR/R4',
    authEndpoint: 'https://api.clevelandclinic.org/OAuth2/authorize',
    tokenEndpoint: 'https://api.clevelandclinic.org/OAuth2/token',
    isSandbox: false,
    description: 'Cleveland OH, Florida, Nevada'
  },

  // --- Oracle Health / Cerner ---
  {
    id: 'cerner-sandbox',
    name: 'Oracle Cerner Sandbox (Millennium)',
    vendor: 'Oracle Health / Cerner',
    portalName: 'HealtheLife Sandbox',
    logo: 'https://code.cerner.com/images/cerner_ignite.svg',
    fhirBaseUrl: 'https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d',
    authEndpoint: 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/personas/patient/authorize',
    tokenEndpoint: 'https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/token',
    isSandbox: true,
    description: 'Free Oracle Health Millennium FHIR R4 sandbox with synthetic patient records'
  },
  {
    id: 'cerner-banner-health',
    name: 'Banner Health',
    vendor: 'Oracle Health / Cerner',
    portalName: 'Banner Patient Portal (Cerner)',
    logo: 'https://www.bannerhealth.com/images/banner-logo.svg',
    fhirBaseUrl: 'https://fhir-myrecord.bannerhealth.com/r4',
    authEndpoint: 'https://authorization.cerner.com/banner/oauth2/authorize',
    tokenEndpoint: 'https://authorization.cerner.com/banner/oauth2/token',
    isSandbox: false,
    description: 'Arizona, California, Colorado, Nebraska, Nevada, Wyoming'
  },

  // --- Athenahealth ---
  {
    id: 'athena-sandbox',
    name: 'Athenahealth Sandbox',
    vendor: 'Athenahealth',
    portalName: 'athenaCommunicator Sandbox',
    logo: 'https://www.athenahealth.com/themes/custom/athena/logo.svg',
    fhirBaseUrl: 'https://api.preview.platform.athenahealth.com/fhir/r4',
    authEndpoint: 'https://api.preview.platform.athenahealth.com/oauth2/v1/authorize',
    tokenEndpoint: 'https://api.preview.platform.athenahealth.com/oauth2/v1/token',
    isSandbox: true,
    description: 'Athenahealth ambulatory & outpatient practice developer sandbox'
  },

  // --- Government & Public Programs ---
  {
    id: 'va-lighthouse',
    name: 'U.S. Department of Veterans Affairs',
    vendor: 'Veterans Affairs (VA)',
    portalName: 'VA.gov / Login.gov / ID.me',
    logo: 'https://www.va.gov/img/design/logo/va-logo.png',
    fhirBaseUrl: 'https://sandbox-api.va.gov/services/fhir/v0/r4',
    authEndpoint: 'https://sandbox-api.va.gov/oauth2/authorization',
    tokenEndpoint: 'https://sandbox-api.va.gov/oauth2/token',
    isSandbox: true,
    description: 'Veterans health records, military service exposures, VA clinic visits'
  },
  {
    id: 'cms-bluebutton',
    name: 'Medicare (CMS Blue Button 2.0)',
    vendor: 'Centers for Medicare & Medicaid',
    portalName: 'Medicare.gov',
    logo: 'https://bluebutton.cms.gov/assets/img/bb-logo.svg',
    fhirBaseUrl: 'https://sandbox.bluebutton.cms.gov/v2/fhir',
    authEndpoint: 'https://sandbox.bluebutton.cms.gov/v2/o/authorize/',
    tokenEndpoint: 'https://sandbox.bluebutton.cms.gov/v2/o/token/',
    isSandbox: true,
    description: 'Historical claims, prescriptions, and Part A/B/D coverage for Medicare beneficiaries'
  }
];

class EhrDirectoryService {
  /**
   * Search or filter providers by query, vendor, or sandbox flag.
   */
  searchProviders({ query = '', vendor = null, includeSandbox = true } = {}) {
    const q = query.trim().toLowerCase();

    return EHR_PROVIDERS.filter(provider => {
      if (!includeSandbox && provider.isSandbox) return false;
      if (vendor && provider.vendor.toLowerCase() !== vendor.toLowerCase()) return false;

      if (!q) return true;
      return (
        provider.name.toLowerCase().includes(q) ||
        provider.vendor.toLowerCase().includes(q) ||
        provider.portalName.toLowerCase().includes(q) ||
        provider.description.toLowerCase().includes(q)
      );
    });
  }

  /**
   * Get an EHR provider configuration by ID.
   */
  getProviderById(id) {
    return EHR_PROVIDERS.find(p => p.id === id) || null;
  }

  /**
   * List unique vendor categories.
   */
  getVendors() {
    return Array.from(new Set(EHR_PROVIDERS.map(p => p.vendor)));
  }
}

const ehrDirectoryService = new EhrDirectoryService();

module.exports = {
  EHR_PROVIDERS,
  EhrDirectoryService,
  ehrDirectoryService
};
