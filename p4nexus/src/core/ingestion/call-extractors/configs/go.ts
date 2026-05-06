// p4nexus/src/core/ingestion/call-extractors/configs/go.ts

import { SupportedLanguages } from 'p4nexus-shared';
import type { CallExtractionConfig } from '../../call-types.js';

export const goCallConfig: CallExtractionConfig = {
  language: SupportedLanguages.Go,
};
