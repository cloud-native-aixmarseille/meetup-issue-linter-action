declare const hostIdBrand: unique symbol;
declare const contactIdBrand: unique symbol;
declare const speakerIdBrand: unique symbol;

export type HostId = string & { readonly [hostIdBrand]: "HostId" };
export type ContactId = string & { readonly [contactIdBrand]: "ContactId" };
export type SpeakerId = string & { readonly [speakerIdBrand]: "SpeakerId" };

const HOST_ID_PATTERN = /^host-[0-9]{4}$/;
const CONTACT_ID_PATTERN = /^contact-[0-9]{4}$/;
const SPEAKER_ID_PATTERN = /^speaker-[0-9]{4}$/;

export function asHostId(value: string): HostId | undefined {
	return HOST_ID_PATTERN.test(value) ? (value as HostId) : undefined;
}

export function asContactId(value: string): ContactId | undefined {
	return CONTACT_ID_PATTERN.test(value) ? (value as ContactId) : undefined;
}

export function asSpeakerId(value: string): SpeakerId | undefined {
	return SPEAKER_ID_PATTERN.test(value) ? (value as SpeakerId) : undefined;
}
