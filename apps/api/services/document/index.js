/**
 * Proton Document Services Export
 */

const {
  DocumentService,
  documentService,
  DocumentServiceError,
  ALLOWED_MIME_TYPES,
  MAX_DOCUMENT_SIZE,
  MIN_DOCUMENT_SIZE,
  DOCUMENT_SCHEMA
} = require('./documentService');

module.exports = {
  DocumentService,
  documentService,
  DocumentServiceError,
  ALLOWED_MIME_TYPES,
  MAX_DOCUMENT_SIZE,
  MIN_DOCUMENT_SIZE,
  DOCUMENT_SCHEMA
};
