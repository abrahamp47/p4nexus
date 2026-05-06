// p4nexus/src/core/ingestion/call-extractors/configs/csharp.ts

import { SupportedLanguages } from 'p4nexus-shared';
import type { CallExtractionConfig } from '../../call-types.js';

export const csharpCallConfig: CallExtractionConfig = {
  language: SupportedLanguages.CSharp,
  typeAsReceiverHeuristic: true,
};
