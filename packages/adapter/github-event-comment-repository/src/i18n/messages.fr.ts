import type { EN_MESSAGES } from "./messages.en.js";
export const FR_MESSAGES = {
	"comment.guidance.event.link.feedback.invalid":
		"Saisissez un lien HTTPS valide vers la page de l'événement OpenFeedback.",
	"comment.resolved":
		"Tous les problèmes signalés précédemment ont été résolus. Aucune modification n'est nécessaire.",
	"comment.duplicate": "Ce commentaire automatique en double a été remplacé.",
	"comment.introduction":
		"Voici les éléments à compléter dans le ticket du meetup :",
	"comment.guidance":
		"Mettez à jour la description du ticket ou ses étiquettes pour traiter ces éléments. Cette liste sera actualisée automatiquement.",
	"comment.unknown":
		"Une vérification supplémentaire nécessite votre attention. Consultez les diagnostics du workflow avec un responsable.",
	"comment.referential":
		"Demandez à un responsable de corriger les référentiels des structures d'accueil ou des intervenants à l'aide des diagnostics du workflow de validation.",
	"comment.agenda.item": "Programme (élément {item}{speaker})",
	"comment.agenda.speaker-suffix": ", intervenant {speaker}",
	"comment.agenda.speaker": "Programme (intervenant {speaker})",
	"comment.guidance.event.title.missing": "Ajoutez un titre à l'événement.",
	"comment.guidance.event.date.missing":
		"Ajoutez la date de l'événement au format AAAA-MM-JJ.",
	"comment.guidance.event.date.invalid":
		"Saisissez une date valide au format AAAA-MM-JJ.",
	"comment.guidance.event.description.missing":
		"Ajoutez une courte description de l'événement.",
	"comment.guidance.event.hoster.missing":
		"Sélectionnez un hôte dans la liste.",
	"comment.guidance.event.hoster.invalid":
		"Utilisez un nom ou un identifiant stable de la liste des hôtes.",
	"comment.guidance.event.hoster.multiple":
		"Sélectionnez un seul hôte pour l'événement.",
	"comment.guidance.event.agenda.missing":
		"Ajoutez au moins une conférence au format `- Intervenant: Description`.",
	"comment.guidance.event.agenda.legacy-line-invalid":
		"Utilisez `- Intervenant: Description` pour chaque ligne du programme.",
	"comment.guidance.event.agenda.speaker.missing":
		"Ajoutez au moins un intervenant pour cette conférence.",
	"comment.guidance.event.agenda.speaker.invalid":
		"Saisissez un nom de la liste des intervenants.",
	"comment.guidance.event.agenda.description.missing":
		"Ajoutez une description après le nom de l'intervenant et les deux-points.",
	"comment.guidance.publication.meetup.missing":
		"Ajoutez le lien vers la page Meetup de l'événement.",
	"comment.guidance.publication.community.missing":
		"Ajoutez le lien vers la page CNCF / OCGroups de l'événement.",
	"comment.guidance.publication.assets.missing":
		"Ajoutez le lien vers le dossier Google Drive de l'événement.",
	"comment.guidance.event.link.meetup.invalid":
		"Saisissez un lien HTTPS valide vers la page Meetup de l'événement.",
	"comment.guidance.event.link.community.invalid":
		"Saisissez un lien HTTPS valide vers la page CNCF / OCGroups de l'événement.",
	"comment.guidance.event.link.assets.invalid":
		"Saisissez un lien HTTPS valide vers le dossier Google Drive de l'événement.",
	"comment.guidance.publication.meetup-url.invalid":
		"Utilisez l'URL Meetup de ce groupe, terminée par l'identifiant numérique de l'événement.",
	"comment.guidance.publication.community-url.invalid":
		"Utilisez l'URL CNCF / OCGroups de ce groupe.",
	"comment.guidance.publication.asset-url.invalid":
		"Utilisez une URL de dossier Google Drive : `https://drive.google.com/drive/folders/FOLDER_ID`.",
	"comment.guidance.event.confirmation.host.missing":
		"Confirmez l'hôte, puis ajoutez le label `hoster:confirmed`.",
	"comment.guidance.event.confirmation.speakers.missing":
		"Confirmez les intervenants, puis ajoutez le label `speakers:confirmed`.",
	"comment.guidance.event.logistics.intent.invalid":
		"Choisissez `Yes` ou `No`, ou laissez la réponse vide si elle reste indécise.",
	"comment.guidance.event.occurrence-status.invalid":
		"Utilisez `scheduled`, `postponed`, `held` ou `cancelled`.",
	"comment.guidance.event.occurrence-status.label-conflict":
		"Conservez un seul label de statut : `event:postponed`, `event:held` ou `event:cancelled`.",
	"comment.guidance.event.document.heading.missing":
		"Rétablissez cet en-tête de section à partir du modèle d'issue.",
	"comment.guidance.event.document.heading.duplicate":
		"Conservez une seule section avec cet en-tête et fusionnez son contenu.",
	"comment.guidance.event.document.checkbox.invalid":
		"Utilisez `- [ ] Tâche` pour les tâches à faire et `- [x] Tâche` pour les tâches terminées.",
	"comment.guidance.event.document.invalid-field-type":
		"Saisissez une réponse textuelle dans ce champ.",
	"comment.guidance.event.document.invalid-hoster-type":
		"Sélectionnez un hôte dans la liste.",
	"comment.guidance.event.document.invalid-hoster-entry":
		"Utilisez un nom ou un identifiant stable de la liste des hôtes.",
	"comment.guidance.event.document.invalid-agenda-type":
		"Rédigez le programme sous forme de lignes `- Intervenant: Description`.",
	"comment.guidance.event.document.schema-marker.duplicate":
		"Demandez à un responsable de corriger les métadonnées d'automatisation en double dans la description.",
	"comment.guidance.event.document.schema-version.unsupported":
		"Demandez à un responsable de mettre à jour l'automatisation pour prendre en charge ce format d'issue.",
	"comment.guidance.event.document.reference-metadata.missing":
		"Demandez à un responsable de régénérer les métadonnées manquantes des références d'hôte et d'intervenants.",
	"comment.guidance.event.document.reference-metadata.duplicate":
		"Demandez à un responsable de corriger les métadonnées en double des références d'hôte et d'intervenants.",
	"comment.guidance.event.document.reference-metadata.invalid":
		"Demandez à un responsable de régénérer les métadonnées invalides des références d'hôte et d'intervenants.",
	"comment.guidance.event.document.reference-metadata.legacy":
		"Vérifiez les références de l'hôte et du programme, puis relancez la mise à jour de l'issue pour actualiser leurs anciennes métadonnées.",
	"comment.guidance.event.document.reference-metadata.stale":
		"Vérifiez les références de l'hôte et du programme, puis relancez la mise à jour de l'issue pour actualiser leurs métadonnées.",
	"comment.guidance.referential.reference.host.unknown":
		"Cet hôte est absent de la liste des hôtes. Copiez son nom exact, accents compris, ou utilisez son identifiant stable : `Nom de l'hôte [host-0001]`.",
	"comment.guidance.referential.reference.host.ambiguous":
		"Plusieurs hôtes portent ce nom. Ajoutez le bon identifiant stable : `Nom de l'hôte [host-0001]`.",
	"comment.guidance.referential.reference.host.display-name-mismatch":
		"Utilisez le nom associé à cet identifiant stable dans la liste des hôtes.",
	"comment.guidance.referential.reference.host.invalid":
		"Choisissez un hôte de la liste des hôtes par son nom ou `Nom de l'hôte [host-0001]`.",
	"comment.guidance.referential.reference.speaker.unknown":
		"Cet intervenant est absent de la liste des intervenants. Copiez son nom exact, accents compris, ou utilisez son identifiant stable : `Nom de l'intervenant [speaker-0001]`.",
	"comment.guidance.referential.reference.speaker.ambiguous":
		"Plusieurs intervenants portent ce nom. Ajoutez le bon identifiant stable : `Nom de l'intervenant [speaker-0001]`.",
	"comment.guidance.referential.reference.speaker.display-name-mismatch":
		"Utilisez le nom associé à cet identifiant stable dans la liste des intervenants.",
	"comment.guidance.referential.reference.speaker.invalid":
		"Choisissez un intervenant de la liste des intervenants par son nom ou `Nom de l'intervenant [speaker-0001]`.",
} satisfies Record<keyof typeof EN_MESSAGES, string>;
