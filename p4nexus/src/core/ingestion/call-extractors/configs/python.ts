// p4nexus/src/core/ingestion/call-extractors/configs/python.ts

import { SupportedLanguages } from 'p4nexus-shared';
import type { CallExtractionConfig } from '../../call-types.js';

export const pythonCallConfig: CallExtractionConfig = {
  language: SupportedLanguages.Python,
};
