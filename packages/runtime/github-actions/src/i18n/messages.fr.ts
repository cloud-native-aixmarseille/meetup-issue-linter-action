import type { EN_MESSAGES } from "./messages.en.js";
export const FR_MESSAGES = {
	"action.publication.reconcile-feedback":
		"Vérifier et mettre à jour les retours du meetup",
	"report.feedback.skipped":
		"La mise à jour des retours a été ignorée ; consultez les diagnostics pour connaître la raison.",
	"report.feedback.completed":
		"La vérification et la mise à jour des retours sont terminées.",
	"report.feedback.changes":
		"Modifications du ticket enregistrées : {persisted, select, true {oui} other {non}} ; lien partagé des retours mis à jour : {linkUpdated, select, true {oui} other {non}}.",
	"report.feedback.guidance":
		"Consultez les diagnostics des retours et configurez les présentations et les intervenants dans OpenFeedback.",
	"error.EventNotFoundError":
		"L'événement est introuvable. Vérifiez le numéro d'issue et le dépôt.",
	"error.EventConcurrentModificationError":
		"L'événement a changé pendant la synchronisation. Relancez-la sur sa dernière version.",
	"error.GoogleDriveAssetRepositoryError":
		"La synchronisation des fichiers Google Drive a échoué. Vérifiez les identifiants, les dossiers configurés et les autorisations.",
	"error.GitHubEventRepositoryConfigurationError":
		"La configuration du dépôt d'événements est invalide. Vérifiez les paramètres du dépôt.",
	"error.GitHubEventRepositoryScopeError":
		"L'événement est hors du périmètre du dépôt configuré.",
	"error.GitHubEventRepositoryResponseError":
		"La réponse GitHub pour l'événement est invalide. Vérifiez la disponibilité du service et l'accès au dépôt.",
	"error.GitHubEventCommentRepositoryConfigurationError":
		"La configuration du dépôt de commentaires est invalide. Vérifiez les paramètres du dépôt et du bot.",
	"error.GitHubEventCommentRepositoryScopeError":
		"Le commentaire est hors du périmètre du dépôt configuré.",
	"error.GitHubEventCommentRepositoryResponseError":
		"La réponse GitHub pour les commentaires est invalide. Vérifiez la disponibilité du service et l'accès au dépôt.",
	"action.referential.validate": "Valider les référentiels du meetup",
	"action.referential.sync-issue-form": "Synchroniser le formulaire du meetup",
	"action.event.reconcile": "Vérifier et mettre à jour le meetup",
	"action.event.list-active": "Lister les meetups actifs",
	"action.communication.reconcile":
		"Vérifier et envoyer les communications du meetup",
	"action.publication.reconcile-assets":
		"Vérifier et mettre à jour les ressources du meetup",
	"report.no-diagnostics": "Aucun diagnostic.",
	"report.fix-applied":
		"correction appliquée : {applied, select, true {oui} other {non}}",
	"report.failed": "Échec de l'action : {reason}",
	"report.summary-unavailable":
		"Le résumé de la tâche n'a pas pu être écrit ; le rapport est disponible dans les journaux et les annotations.",
	"report.severity.error": "erreur",
	"report.severity.warning": "avertissement",
	"report.severity.info": "information",
	"report.execution.failed": "L'action a échoué avant de produire un résultat.",
	"report.execution.guidance":
		"Vérifiez les paramètres de l'action et la configuration des services. Reproduisez le problème sur un exécuteur de confiance si un débogage privé est nécessaire.",
	"report.error.unexpected":
		"L'automatisation du meetup a échoué ; effectuez le diagnostic sur un exécuteur de confiance.",
	"report.referential.valid": "Référentiels : valides.",
	"report.referential.invalid": "Référentiels : invalides.",
	"report.referential.counts":
		"Structures d'accueil valides : {hosts, number} ; intervenants valides : {speakers, number}.",
	"report.referential.guidance":
		"Corrigez les champs du référentiel indiqués ci-dessous, puis relancez la validation. Les indices désignent la position des enregistrements, à partir de zéro.",
	"report.issue-form.blocked":
		"La synchronisation du formulaire est bloquée par des référentiels invalides.",
	"report.issue-form.stale": "Le formulaire n'est pas à jour.",
	"report.issue-form.drift-allowed":
		"Le décalage du formulaire ne bloque pas cette vérification. La synchronisation peut être exécutée après la fusion.",
	"report.issue-form.updated": "Le formulaire a été mis à jour.",
	"report.issue-form.current": "Le formulaire est à jour.",
	"report.issue-form.files": "Fichiers concernés : {files}.",
	"report.event.context": "Ticket : #{issue} ; mode : {mode}.",
	"report.event.skipped":
		"Ignoré : ce ticket ne correspond pas à un meetup configuré.",
	"report.event.state":
		"État du meetup : {state} ; prêt : {ready, select, true {oui} other {non}}.",
	"report.event.persisted":
		"Modifications du ticket enregistrées : {persisted, select, true {oui} other {non}} ; commentaire de diagnostic mis à jour : {comment, select, true {oui} other {non}}.",
	"report.event.guidance":
		"Corrigez les champs du meetup et terminez les tâches indiquées dans les diagnostics.",
	"report.events.count":
		"{count, plural, =0 {Aucun meetup actif.} one {# meetup actif.} other {# meetups actifs.}}",
	"report.events.issues": "Numéros des tickets : {issues}.",
	"report.events.empty": "Aucun meetup actif n'a été trouvé.",
	"report.assets.skipped":
		"La mise à jour des ressources a été ignorée : le meetup n'est pas éligible ou des prérequis manquent.",
	"report.assets.completed":
		"La vérification et la mise à jour des ressources sont terminées.",
	"report.assets.counts":
		"Modifications du ticket enregistrées : {persisted, select, true {oui} other {non}} ; fichiers de ressources : {count, number}.",
	"report.communication.mode": "Mode de communication : {mode}.",
	"report.communication.planned":
		"Planifiées : {planned, number} ; à envoyer : {due, number} ; tentatives d'envoi : {dispatched, number}.",
	"report.communication.accepted":
		"Acceptées : {accepted, number} ; déjà enregistrées : {recorded, number} ; différées : {deferred, number}.",
	"report.communication.uncertain":
		"Résultats incertains : {uncertain, number} ; rejets : {rejected, number}.",
	"report.communication.guidance":
		"Consultez les diagnostics d'approbation et d'envoi avant de réessayer.",
	"report.communication.uncertain-guidance":
		"Vérifiez les envois incertains auprès du fournisseur et dans le registre avant tout nouvel envoi.",
	"report.communication.issue-reported":
		"Les diagnostics de communication sont enregistrés dans le ticket du meetup ; les erreurs signalées ne font pas échouer cette vérification.",
	"report.communication.failed":
		"La vérification des communications a échoué ; consultez les annotations de diagnostic et le résumé de la tâche.",
	"workflow.referential.failed":
		"Les référentiels du meetup sont invalides. Corrigez les champs indiqués dans les annotations de validation et le résumé de la tâche.",
} satisfies Record<keyof typeof EN_MESSAGES, string>;
