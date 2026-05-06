// p4nexus/src/core/ingestion/call-extractors/configs/php.ts

import { SupportedLanguages } from 'p4nexus-shared';
import type { CallExtractionConfig } from '../../call-types.js';

export const phpCallConfig: CallExtractionConfig = {
  language: SupportedLanguages.PHP,
};
