import type { RawReferentialCatalog } from "../../domain/referential-catalog.js";

export interface ReferentialRepository {
	load(): Promise<RawReferentialCatalog>;
}
