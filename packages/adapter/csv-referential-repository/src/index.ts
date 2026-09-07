import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type {
	RawHostRecord,
	RawReferentialCatalog,
	RawSpeakerRecord,
	ReferentialRepository,
} from "@meetup-automation/referential";
import { parse } from "csv-parse/sync";

export interface CsvReferentialRepositoryOptions {
	workspaceRoot: string;
	hostsPath: string;
	speakersPath: string;
}

type CsvRow = Record<string, string>;

function localPath(rootInput: string, relativeInput: string): string {
	const root = resolve(rootInput);
	const absolute = resolve(root, relativeInput);
	const child = relative(root, absolute);
	if (
		isAbsolute(child) ||
		child === ".." ||
		child.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
	) {
		throw new Error(
			`Referential path must stay inside the checkout: ${relativeInput}`,
		);
	}
	return absolute;
}

function parseRows(source: string): CsvRow[] {
	return parse(source, {
		bom: true,
		columns: true,
		skip_empty_lines: true,
		trim: true,
	}) as CsvRow[];
}

export class CsvReferentialRepository implements ReferentialRepository {
	constructor(private readonly options: CsvReferentialRepositoryOptions) {}

	async load(): Promise<RawReferentialCatalog> {
		const [hostsSource, speakersSource] = await Promise.all([
			readFile(
				localPath(this.options.workspaceRoot, this.options.hostsPath),
				"utf8",
			),
			readFile(
				localPath(this.options.workspaceRoot, this.options.speakersPath),
				"utf8",
			),
		]);

		const hosts: RawHostRecord[] = parseRows(hostsSource).map((row) => ({
			hostId: row.host_id,
			displayName: row.name,
			contactId: row.contact_id,
			contactName: row.contact,
			email: row.mail,
			phone: row.phone || undefined,
			address: row.address,
		}));

		const speakers: RawSpeakerRecord[] = parseRows(speakersSource).map(
			(row) => ({
				speakerId: row.speaker_id,
				firstName: row.firstname,
				lastName: row.lastname,
				company: row.company,
				email: row.mail,
				phone: row.phone || undefined,
			}),
		);

		return { hosts, speakers };
	}
}
