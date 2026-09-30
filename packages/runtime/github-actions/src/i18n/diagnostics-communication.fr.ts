import type { DIAGNOSTICS_COMMUNICATION_EN } from "./diagnostics-communication.en.js";
export const DIAGNOSTICS_COMMUNICATION_FR = {
	"diagnostic.communication.duplicate-intent":
		"Une intention de communication en double a été ignorée.",
	"diagnostic.communication.gateway-delivery-uncertain":
		"Un service n'a pas pu confirmer la livraison.",
	"diagnostic.communication.gateway-delivery-rejected":
		"Un service a refusé définitivement la demande de livraison.",
	"diagnostic.communication.gateway-delivery-deferred":
		"Un service a différé la demande ; une nouvelle tentative reste sûre.",
	"diagnostic.communication.gateway-threw-ambiguous-error":
		"Un service a échoué sans résultat de livraison définitif.",
	"diagnostic.communication.invalid-clock":
		"L'horloge des communications est invalide.",
	"diagnostic.communication.invalid-event-date":
		"La date de l'événement est invalide.",
	"diagnostic.communication.invalid-identifier":
		"Un identifiant stable de communication est invalide.",
	"diagnostic.communication.invalid-readiness-window":
		"La période de rappel de préparation est invalide.",
	"diagnostic.communication.invalid-time-zone":
		"Le fuseau horaire configuré est invalide.",
	"diagnostic.communication.ledger-read-failed":
		"Le registre des livraisons n'a pas pu être lu.",
	"diagnostic.communication.ledger-reservation-failed":
		"La livraison n'a pas pu être réservée de manière sûre.",
	"diagnostic.communication.ledger-status-write-failed":
		"L'état de la livraison n'a pas pu être enregistré.",
	"diagnostic.communication.missing-mail-destination":
		"Un destinataire ayant accepté les e-mails n'a pas d'adresse.",
	"diagnostic.communication.missing-notification-content":
		"Le contenu de la notification est indisponible.",
	"diagnostic.communication.occurrence-status-unknown":
		"Le statut de l'événement doit être explicite.",
	"diagnostic.communication.delivery-already-recorded":
		"Le registre des livraisons contient déjà cette intention.",
	"diagnostic.communication.dispatch-disabled-by-config":
		"L'envoi des communications est désactivé par la configuration du dépôt.",
	"diagnostic.communication.approval-label-missing":
		"Les communications nécessitent le label d'approbation configuré.",
	"diagnostic.communication.approval-missing":
		"Les communications nécessitent un instantané approuvé par un responsable.",
	"diagnostic.communication.approval-stale":
		"Des informations affectant les messages ont changé depuis l'approbation ; retirez puis ajoutez à nouveau le label d'approbation.",
	"diagnostic.communication.approval-capture-unauthorized":
		"L'auteur du label d'approbation n'a pas les droits suffisants sur le dépôt.",
	"diagnostic.communication.approval-trigger-snapshot-missing":
		"L'événement d'ajout du label ne contient pas d'instantané immuable de l'issue.",
	"diagnostic.communication.approval-trigger-stale":
		"L'issue a changé depuis l'ajout du label ; retirez puis ajoutez à nouveau le label d'approbation.",
	"diagnostic.communication.approval-repository-failed":
		"L'approbation du responsable n'a pas pu être vérifiée de manière sûre.",
	"diagnostic.communication.event-skipped":
		"L'issue n'est pas un événement meetup configuré.",
	"diagnostic.communication.event-concurrently-modified":
		"L'issue a changé pendant la préparation des communications ; aucun envoi n'a été tenté.",
	"diagnostic.communication.event-references-unresolved":
		"Les participants n'ont pas pu être associés à des identifiants stables.",
	"diagnostic.communication.github-credential-missing":
		"Les identifiants GitHub sont indisponibles.",
	"diagnostic.communication.referential-catalog-invalid":
		"Les communications sont désactivées car le catalogue de références est invalide.",
} satisfies Record<keyof typeof DIAGNOSTICS_COMMUNICATION_EN, string>;
