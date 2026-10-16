/**
 * Proton Operations OS — Integration Adapters Registry
 */

const FhirAdapter = require('./fhirAdapter');
const CalendarAdapter = require('./calendarAdapter');
const SmsAdapter = require('./smsAdapter');
const EmailAdapter = require('./emailAdapter');
const VoiceAdapter = require('./voiceAdapter');
const PatientMessagingAdapter = require('./patientMessagingAdapter');
const EhrPmsAdapter = require('./ehrPmsAdapter');

const fhirAdapter = new FhirAdapter();
const calendarAdapter = new CalendarAdapter();
const smsAdapter = new SmsAdapter();
const emailAdapter = new EmailAdapter();
const voiceAdapter = new VoiceAdapter();
const patientMessagingAdapter = new PatientMessagingAdapter();
const ehrPmsAdapter = new EhrPmsAdapter();

module.exports = {
  FhirAdapter,
  CalendarAdapter,
  SmsAdapter,
  EmailAdapter,
  VoiceAdapter,
  PatientMessagingAdapter,
  EhrPmsAdapter,
  // Global singletons
  fhirAdapter,
  calendarAdapter,
  smsAdapter,
  emailAdapter,
  voiceAdapter,
  patientMessagingAdapter,
  ehrPmsAdapter
};
