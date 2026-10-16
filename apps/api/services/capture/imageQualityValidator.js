/**
 * Proton Deterministic Image Quality Control & Validation Engine
 * 
 * Inspects media buffers to enforce strict healthcare asset quality:
 * 1. MIME verification & magic byte inspection (anti-spoofing).
 * 2. File size bounds (1KB min, 15MB max).
 * 3. Header structure & corruption detection.
 * 4. Image dimension constraints (min 200x200, max 8192x8192).
 * 
 * Returns structured, non-fabricated errors.
 */

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const MIN_FILE_SIZE = 1024;             // 1 KB
const MIN_DIMENSION = 200;              // 200 px
const MAX_DIMENSION = 8192;             // 8192 px

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

class ImageQualityError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'ImageQualityError';
    this.code = code;
    this.status = 400;
    this.details = details;
  }
}

class ImageQualityValidator {
  /**
   * Validates an image buffer and MIME declaration deterministically.
   * 
   * @param {Buffer} buffer - Raw image bytes
   * @param {string} declaredMimeType - MIME type declared by client
   * @returns {{ valid: boolean, width: number, height: number, size: number, mimeType: string, sha256?: string }}
   */
  validate(buffer, declaredMimeType) {
    // 1. Buffer existence and corruption check
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new ImageQualityError('IMAGE_CORRUPT', 'Image buffer is empty or null.');
    }

    // 2. MIME type format check
    if (!declaredMimeType || typeof declaredMimeType !== 'string') {
      throw new ImageQualityError('IMAGE_TYPE_INVALID', 'MIME type must be specified.');
    }

    const normalizedMime = declaredMimeType.toLowerCase().trim();
    if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
      throw new ImageQualityError(
        'IMAGE_TYPE_INVALID',
        `Unsupported image MIME type: '${declaredMimeType}'. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`
      );
    }

    // 3. File size boundaries
    if (buffer.length < MIN_FILE_SIZE) {
      throw new ImageQualityError(
        'IMAGE_TOO_SMALL',
        `Image file size (${buffer.length} bytes) is below minimum required 1KB.`
      );
    }

    if (buffer.length > MAX_FILE_SIZE) {
      throw new ImageQualityError(
        'IMAGE_TOO_LARGE',
        `Image file size (${Math.round(buffer.length / (1024 * 1024))}MB) exceeds maximum limit of 15MB.`
      );
    }

    // 4. Magic byte inspection & anti-spoofing verification
    const detectedFormat = this._detectMagicFormat(buffer);
    if (!detectedFormat) {
      throw new ImageQualityError('IMAGE_CORRUPT', 'Unrecognized or corrupted image header signature.');
    }

    if (
      (normalizedMime.includes('jpeg') || normalizedMime.includes('jpg')) && detectedFormat !== 'jpeg' ||
      normalizedMime.includes('png') && detectedFormat !== 'png' ||
      normalizedMime.includes('webp') && detectedFormat !== 'webp'
    ) {
      throw new ImageQualityError(
        'MIME_SPOOFING_DETECTED',
        `Declared MIME type '${declaredMimeType}' does not match binary magic header signature '${detectedFormat}'.`
      );
    }

    // 5. Dimension extraction & resolution validation
    const dimensions = this._extractDimensions(buffer, detectedFormat);
    if (!dimensions || !dimensions.width || !dimensions.height) {
      throw new ImageQualityError('IMAGE_CORRUPT', 'Could not parse image dimensions from headers; file may be truncated.');
    }

    const { width, height } = dimensions;

    if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
      throw new ImageQualityError(
        'IMAGE_QUALITY_REJECTED',
        `Image resolution (${width}x${height}) is below minimum acceptable resolution of ${MIN_DIMENSION}x${MIN_DIMENSION} for clinical documentation.`,
        { width, height, min: MIN_DIMENSION }
      );
    }

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new ImageQualityError(
        'IMAGE_QUALITY_REJECTED',
        `Image resolution (${width}x${height}) exceeds maximum acceptable resolution of ${MAX_DIMENSION}x${MAX_DIMENSION}.`,
        { width, height, max: MAX_DIMENSION }
      );
    }

    return {
      valid: true,
      width,
      height,
      size: buffer.length,
      mimeType: normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime,
      format: detectedFormat
    };
  }

  /**
   * Inspects leading magic bytes to identify binary format.
   * @private
   */
  _detectMagicFormat(buffer) {
    if (buffer.length < 12) return null;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'jpeg';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
      buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A
    ) {
      return 'png';
    }

    // WEBP: 'RIFF' .... 'WEBP'
    if (
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      return 'webp';
    }

    return null;
  }

  /**
   * Extracts width and height from binary headers.
   * @private
   */
  _extractDimensions(buffer, format) {
    try {
      if (format === 'png') {
        // PNG IHDR chunk is located at offset 16 (width) and 20 (height), 4-byte big endian
        if (buffer.length >= 24) {
          const width = buffer.readUInt32BE(16);
          const height = buffer.readUInt32BE(20);
          return { width, height };
        }
      } else if (format === 'jpeg') {
        // Scan JPEG segments for SOF (Start of Frame) marker
        let offset = 2;
        while (offset < buffer.length - 8) {
          if (buffer[offset] !== 0xFF) {
            offset++;
            continue;
          }

          const marker = buffer[offset + 1];
          // Baseline SOF0 (0xC0), Extended SOF1 (0xC1), Progressive SOF2 (0xC2)
          if (marker >= 0xC0 && marker <= 0xC3) {
            const height = buffer.readUInt16BE(offset + 5);
            const width = buffer.readUInt16BE(offset + 7);
            return { width, height };
          }

          // Advance by segment length
          if (offset + 3 < buffer.length) {
            const segmentLength = buffer.readUInt16BE(offset + 2);
            offset += 2 + segmentLength;
          } else {
            break;
          }
        }
      } else if (format === 'webp') {
        // WEBP: VP8, VP8L, or VP8X
        const chunkType = buffer.toString('ascii', 12, 16);
        if (chunkType === 'VP8 ' && buffer.length >= 30) {
          // Key frame header starts around offset 23
          const width = buffer.readUInt16LE(26) & 0x3FFF;
          const height = buffer.readUInt16LE(28) & 0x3FFF;
          return { width, height };
        } else if (chunkType === 'VP8L' && buffer.length >= 25) {
          const b1 = buffer[21];
          const b2 = buffer[22];
          const b3 = buffer[23];
          const b4 = buffer[24];
          const width = 1 + (((b2 & 0x3F) << 8) | b1);
          const height = 1 + (((b4 & 0xF) << 10) | (b3 << 2) | ((b2 & 0xC0) >> 6));
          return { width, height };
        } else if (chunkType === 'VP8X' && buffer.length >= 30) {
          const width = 1 + buffer.readUIntLE(24, 3);
          const height = 1 + buffer.readUIntLE(27, 3);
          return { width, height };
        }
      }
    } catch {
      return null;
    }

    return null;
  }
}

const imageQualityValidator = new ImageQualityValidator();

module.exports = {
  ImageQualityValidator,
  imageQualityValidator,
  ImageQualityError,
  MAX_FILE_SIZE,
  MIN_FILE_SIZE,
  MIN_DIMENSION,
  MAX_DIMENSION
};
