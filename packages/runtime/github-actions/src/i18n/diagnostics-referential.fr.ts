import type { DIAGNOSTICS_REFERENTIAL_EN } from "./diagnostics-referential.en.js";
export const DIAGNOSTICS_REFERENTIAL_FR = {
	"diagnostic.referential.contact.id.duplicate":
		"Les identifiants stables des contacts doivent être uniques.",
	"diagnostic.referential.host.id.conflict":
		"Un identifiant stable d'hôte ne peut pas désigner plusieurs noms d'hôte.",
	"diagnostic.referential.host.display-name.invalid":
		"Le nom de l'hôte doit être une chaîne de caractères non vide.",
	"diagnostic.referential.contact.name.invalid":
		"Le nom du contact doit être une chaîne de caractères non vide.",
	"diagnostic.referential.contact.email.invalid":
		"L'adresse e-mail du contact de l'hôte est invalide.",
	"diagnostic.referential.contact.phone.invalid":
		"Le téléphone du contact doit être une chaîne de caractères lorsqu'il est renseigné.",
	"diagnostic.referential.contact.address.invalid":
		"L'adresse du contact doit être une chaîne de caractères non vide.",
	"diagnostic.referential.host.id.invalid":
		"L'identifiant stable de l'hôte doit respecter le format opaque host-0001.",
	"diagnostic.referential.contact.id.invalid":
		"L'identifiant stable du contact doit respecter le format opaque contact-0001.",
	"diagnostic.referential.reference.host.invalid":
		"La référence de l'hôte ou son identifiant stable est invalide.",
	"diagnostic.referential.reference.host.unknown":
		"L'hôte référencé est absent du catalogue.",
	"diagnostic.referential.reference.host.display-name-mismatch":
		"Le nom de l'hôte est obsolète ; son identifiant stable reste la référence.",
	"diagnostic.referential.reference.speaker.invalid":
		"La référence de l'intervenant ou son identifiant stable est invalide.",
	"diagnostic.referential.reference.speaker.unknown":
		"L'intervenant référencé est absent du catalogue.",
	"diagnostic.referential.reference.speaker.display-name-mismatch":
		"Le nom de l'intervenant est obsolète ; son identifiant stable reste la référence.",
	"diagnostic.referential.speaker.id.duplicate":
		"Les identifiants stables des intervenants doivent être uniques.",
	"diagnostic.referential.speaker.id.invalid":
		"L'identifiant stable de l'intervenant doit respecter le format speaker-*.",
	"diagnostic.referential.speaker.first-name.invalid":
		"Le prénom de l'intervenant doit être une chaîne de caractères non vide.",
	"diagnostic.referential.speaker.last-name.invalid":
		"Le nom de l'intervenant doit être une chaîne de caractères non vide.",
	"diagnostic.referential.speaker.company.invalid":
		"L'entreprise de l'intervenant doit être une chaîne de caractères non vide.",
	"diagnostic.referential.speaker.email.invalid":
		"L'adresse e-mail de l'intervenant est invalide.",
	"diagnostic.referential.speaker.phone.invalid":
		"Le téléphone de l'intervenant doit être une chaîne de caractères lorsqu'il est renseigné.",
	"diagnostic.referential.host.display-name.duplicate":
		"Les noms d'hôte normalisés doivent être uniques ; conservez un seul identifiant stable par nom public.",
	"diagnostic.referential.speaker.display-name.duplicate":
		"Les noms d'intervenant normalisés doivent être uniques ; conservez un seul identifiant stable par nom public.",
	"diagnostic.referential.reference.host.ambiguous":
		"Plusieurs hôtes portent ce nom ; ajoutez le bon identifiant stable.",
	"diagnostic.referential.reference.speaker.ambiguous":
		"Plusieurs intervenants portent ce nom ; ajoutez le bon identifiant stable.",
} satisfies Record<keyof typeof DIAGNOSTICS_REFERENTIAL_EN, string>;
