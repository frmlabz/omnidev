import type { ProviderAdapter } from "@omnidev-ai/core";
import type { AdapterWriterConfig } from "#writers/generic/index";

/**
 * Built-in adapters are writer-backed and may declare provider outputs that are
 * currently materialized outside the writer pipeline.
 */
export interface WriterBackedProviderAdapter extends ProviderAdapter {
	writers: AdapterWriterConfig[];
	additionalOutputPaths?: string[];
}
