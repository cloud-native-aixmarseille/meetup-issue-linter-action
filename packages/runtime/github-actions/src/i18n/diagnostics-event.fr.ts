import type { DIAGNOSTICS_EVENT_EN } from "./diagnostics-event.en.js";
export const DIAGNOSTICS_EVENT_FR = {
	"diagnostic.event.link.feedback.invalid":
		"Le lien des retours doit être une URL HTTPS valide.",
	"diagnostic.event.document.reference-metadata.duplicate":
		"Le document contient des métadonnées de références en double.",
	"diagnostic.event.document.reference-metadata.invalid":
		"Les métadonnées des références stables sont mal formées.",
	"diagnostic.event.document.reference-metadata.legacy":
		"Les anciennes métadonnées ne permettent pas de rétablir les identifiants des participants de manière sûre.",
	"diagnostic.event.document.reference-metadata.stale":
		"Les métadonnées des références stables ne correspondent pas aux participants visibles.",
	"diagnostic.event.document.reference-metadata.missing":
		"Les métadonnées des références stables sont manquantes.",
	"diagnostic.event.document.schema-marker.duplicate":
		"Le document contient des marqueurs de schéma en double.",
	"diagnostic.event.document.schema-version.unsupported":
		"La version du schéma du document n'est pas prise en charge.",
	"diagnostic.event.agenda.missing":
		"Le programme doit contenir au moins une conférence.",
	"diagnostic.event.agenda.normalized":
		"Le programme peut être normalisé sans risque.",
	"diagnostic.event.agenda.speaker.missing":
		"Chaque conférence doit avoir au moins un intervenant.",
	"diagnostic.event.agenda.speaker.invalid":
		"Le nom de l'intervenant ne doit pas être vide.",
	"diagnostic.event.agenda.description.missing":
		"La description de la conférence ne doit pas être vide.",
	"diagnostic.event.date.missing": "La date de l'événement est obligatoire.",
	"diagnostic.event.date.invalid":
		"La date doit être une date réelle au format AAAA-MM-JJ.",
	"diagnostic.event.description.missing":
		"La description de l'événement est obligatoire.",
	"diagnostic.event.hoster.missing": "Un hôte doit être sélectionné.",
	"diagnostic.event.hoster.invalid": "Le nom de l'hôte ne doit pas être vide.",
	"diagnostic.event.hoster.normalized":
		"La référence de l'hôte peut être normalisée sans risque.",
	"diagnostic.event.links.normalized":
		"Les liens de publication peuvent être normalisés sans risque.",
	"diagnostic.event.occurrence-status.label-conflict":
		"Les labels de statut s'excluent mutuellement ; conservez uniquement event:postponed, event:held ou event:cancelled.",
	"diagnostic.event.occurrence-status.invalid":
		"Le statut doit être scheduled, postponed, held ou cancelled.",
	"diagnostic.event.title.missing": "Le titre de l'événement est obligatoire.",
	"diagnostic.event.document.invalid-hoster-type":
		"L'ancien champ hoster doit être un tableau.",
	"diagnostic.event.hoster.multiple":
		"L'événement doit avoir exactement un hôte.",
	"diagnostic.event.document.invalid-hoster-entry":
		"L'ancienne référence d'hôte doit être une chaîne de caractères.",
	"diagnostic.event.document.invalid-agenda-type":
		"L'ancien champ agenda doit être une chaîne de caractères.",
	"diagnostic.event.labels.normalized":
		"Les labels gérés par l'automatisation peuvent être synchronisés sans risque.",
	"diagnostic.event.document.legacy-schema":
		"L'ancien document a été migré vers la version 1 du schéma.",
	"diagnostic.event.confirmation.host.missing":
		"La confirmation de l'hôte est nécessaire pour que l'événement soit prêt.",
	"diagnostic.event.confirmation.speakers.missing":
		"La confirmation des intervenants est nécessaire pour que l'événement soit prêt.",
	"diagnostic.event.agenda.legacy-line-invalid":
		"Utilisez - Intervenant: Description pour chaque ligne du programme.",
	"diagnostic.event.link.meetup.invalid":
		"Le lien Meetup doit être une URL HTTPS valide.",
	"diagnostic.event.link.community.invalid":
		"Le lien CNCF / OCGroups doit être une URL HTTPS valide.",
	"diagnostic.event.link.assets.invalid":
		"Le lien vers le dossier des fichiers doit être une URL HTTPS valide.",
	"diagnostic.event.logistics.intent.invalid":
		"Choisissez Yes ou No, ou laissez la réponse vide si elle reste indécise.",
	"diagnostic.event.document.heading.missing":
		"Un en-tête de section obligatoire est manquant.",
	"diagnostic.event.document.heading.duplicate":
		"Un en-tête de section est présent en double.",
	"diagnostic.event.document.checkbox.invalid":
		"Utilisez - [ ] Tâche ou - [x] Tâche pour les cases à cocher.",
	"diagnostic.event.document.invalid-field-type":
		"Le champ de l'issue doit contenir du texte.",
	"diagnostic.event.issue-title.normalized":
		"Le titre de l'issue peut être normalisé sans risque.",
} satisfies Record<keyof typeof DIAGNOSTICS_EVENT_EN, string>;
