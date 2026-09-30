export const DIAGNOSTICS_COMMUNICATION_EN = {
	"diagnostic.communication.duplicate-intent":
		"A duplicate communication intent was ignored.",
	"diagnostic.communication.gateway-delivery-uncertain":
		"A gateway could not confirm delivery.",
	"diagnostic.communication.gateway-delivery-rejected":
		"A gateway definitively rejected the delivery request.",
	"diagnostic.communication.gateway-delivery-deferred":
		"A gateway deferred the request; a later retry remains safe.",
	"diagnostic.communication.gateway-threw-ambiguous-error":
		"A gateway failed without a definitive delivery outcome.",
	"diagnostic.communication.invalid-clock":
		"The communication clock is invalid.",
	"diagnostic.communication.invalid-event-date": "The event date is invalid.",
	"diagnostic.communication.invalid-identifier":
		"A stable communication identifier is invalid.",
	"diagnostic.communication.invalid-readiness-window":
		"The readiness reminder window is invalid.",
	"diagnostic.communication.invalid-time-zone":
		"The configured time zone is invalid.",
	"diagnostic.communication.ledger-read-failed":
		"The delivery ledger could not be read.",
	"diagnostic.communication.ledger-reservation-failed":
		"The delivery could not be reserved safely.",
	"diagnostic.communication.ledger-status-write-failed":
		"The delivery status could not be recorded.",
	"diagnostic.communication.missing-mail-destination":
		"An opted-in mail recipient has no destination.",
	"diagnostic.communication.missing-notification-content":
		"Notification content is unavailable.",
	"diagnostic.communication.occurrence-status-unknown":
		"The event occurrence status must be explicit.",
	"diagnostic.communication.delivery-already-recorded":
		"The delivery ledger already contains this intent.",
	"diagnostic.communication.dispatch-disabled-by-config":
		"Communication dispatch is disabled by repository configuration.",
	"diagnostic.communication.approval-label-missing":
		"Communications require the configured maintainer approval label.",
	"diagnostic.communication.approval-missing":
		"Communications require a maintainer-owned approval snapshot.",
	"diagnostic.communication.approval-stale":
		"Message-affecting event facts changed after approval; remove and re-add the approval label.",
	"diagnostic.communication.approval-capture-unauthorized":
		"The approval label actor does not have sufficient repository permission.",
	"diagnostic.communication.approval-trigger-snapshot-missing":
		"The approval label event did not contain an immutable issue snapshot.",
	"diagnostic.communication.approval-trigger-stale":
		"The issue changed after the approval label event; remove and re-add the approval label.",
	"diagnostic.communication.approval-repository-failed":
		"The maintainer approval record could not be verified safely.",
	"diagnostic.communication.event-skipped":
		"The issue is not a configured meetup event.",
	"diagnostic.communication.event-concurrently-modified":
		"The meetup issue changed while communications were being reconciled; no delivery was attempted.",
	"diagnostic.communication.event-references-unresolved":
		"Event participants could not be resolved to stable identifiers.",
	"diagnostic.communication.github-credential-missing":
		"The GitHub credential is unavailable.",
	"diagnostic.communication.referential-catalog-invalid":
		"Communications are disabled because the referential catalog is invalid.",
} as const;
