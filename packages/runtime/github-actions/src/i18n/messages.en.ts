export const EN_MESSAGES = {
	"action.publication.reconcile-feedback": "Reconcile meetup feedback",
	"report.feedback.skipped":
		"Feedback reconciliation was skipped; review the diagnostics for the reason.",
	"report.feedback.completed": "Feedback reconciliation completed.",
	"report.feedback.changes":
		"Issue changes persisted: {persisted, select, true {true} other {false}}; shared feedback link updated: {linkUpdated, select, true {true} other {false}}.",
	"report.feedback.guidance":
		"Review feedback diagnostics and configure talks and speakers in OpenFeedback.",
	"error.EventNotFoundError":
		"The event could not be found. Check the issue number and repository.",
	"error.EventConcurrentModificationError":
		"The event changed during reconciliation. Rerun against its latest version.",
	"error.GoogleDriveAssetRepositoryError":
		"Google Drive asset reconciliation failed. Check credentials, folders and permissions.",
	"error.GitHubEventRepositoryConfigurationError":
		"The event repository configuration is invalid. Check the repository settings.",
	"error.GitHubEventRepositoryScopeError":
		"The event is outside the configured repository scope.",
	"error.GitHubEventRepositoryResponseError":
		"GitHub returned an invalid event response. Check service availability and repository access.",
	"error.GitHubEventCommentRepositoryConfigurationError":
		"The comment repository configuration is invalid. Check the repository and bot settings.",
	"error.GitHubEventCommentRepositoryScopeError":
		"The comment is outside the configured repository scope.",
	"error.GitHubEventCommentRepositoryResponseError":
		"GitHub returned an invalid comment response. Check service availability and repository access.",
	"action.referential.validate": "Validate meetup referentials",
	"action.referential.sync-issue-form": "Synchronize meetup issue form",
	"action.event.reconcile": "Reconcile meetup event",
	"action.event.list-active": "List active meetup events",
	"action.communication.reconcile": "Reconcile meetup communications",
	"action.publication.reconcile-assets": "Reconcile meetup assets",
	"report.no-diagnostics": "No diagnostics.",
	"report.fix-applied":
		"fix applied: {applied, select, true {true} other {false}}",
	"report.failed": "Action failed: {reason}",
	"report.summary-unavailable":
		"The job summary could not be written; the action report is available in the logs and annotations.",
	"report.severity.error": "error",
	"report.severity.warning": "warning",
	"report.severity.info": "info",
	"report.execution.failed":
		"Action execution failed before a result was available.",
	"report.execution.guidance":
		"Review the action inputs and service configuration. Reproduce on a trusted runner if private debugging is required.",
	"report.error.unexpected":
		"Meetup automation failed; inspect debug logs using a trusted runner",
	"report.referential.valid": "Referentials: valid.",
	"report.referential.invalid": "Referentials: invalid.",
	"report.referential.counts":
		"Valid hosts: {hosts, number}; valid speakers: {speakers, number}.",
	"report.referential.guidance":
		"Correct the catalog fields listed below, then rerun validation. Field indexes are zero-based record positions.",
	"report.issue-form.blocked":
		"Issue form synchronization is blocked by invalid referentials.",
	"report.issue-form.stale": "Issue form is out of date.",
	"report.issue-form.drift-allowed":
		"Issue-form drift does not block this check. Synchronization can run after merge.",
	"report.issue-form.updated": "Issue form was updated.",
	"report.issue-form.current": "Issue form is up to date.",
	"report.issue-form.files": "Affected files: {files}.",
	"report.issue-form.guidance":
		"Run actions/referential/sync-issue-form with mode: fix on this branch, then commit the affected files.",
	"report.event.context": "Issue: #{issue}; mode: {mode}.",
	"report.event.skipped":
		"Skipped: the issue is not a configured meetup event.",
	"report.event.state":
		"Event state: {state}; ready: {ready, select, true {true} other {false}}.",
	"report.event.persisted":
		"Issue changes persisted: {persisted, select, true {true} other {false}}; diagnostic comment updated: {comment, select, true {true} other {false}}.",
	"report.event.guidance":
		"Resolve the event fields and pending tasks listed in the diagnostics.",
	"report.events.count": "Active events: {count, number}.",
	"report.events.issues": "Issue numbers: {issues}.",
	"report.events.empty": "No active meetup events were found.",
	"report.assets.skipped":
		"Asset reconciliation was skipped: the event is ineligible or prerequisites are incomplete.",
	"report.assets.completed": "Asset reconciliation completed.",
	"report.assets.counts":
		"Issue changes persisted: {persisted, select, true {true} other {false}}; asset files: {count, number}.",
	"report.communication.mode": "Communication mode: {mode}.",
	"report.communication.planned":
		"Planned: {planned, number}; due: {due, number}; dispatched: {dispatched, number}.",
	"report.communication.accepted":
		"Accepted: {accepted, number}; already recorded: {recorded, number}; deferred: {deferred, number}.",
	"report.communication.uncertain":
		"Uncertain: {uncertain, number}; rejected: {rejected, number}.",
	"report.communication.guidance":
		"Review approval and delivery diagnostics before retrying.",
	"report.communication.uncertain-guidance":
		"Reconcile uncertain deliveries with the provider and ledger before any resend.",
	"report.communication.failed":
		"Communication reconciliation failed; inspect the diagnostic annotations and job summary.",
	"workflow.referential.failed":
		"Meetup referentials are invalid. Correct the catalog fields listed in the validation annotations and job summary.",
	"workflow.issue-form.failed":
		"The meetup issue form is out of date. Run actions/referential/sync-issue-form with mode: fix on this branch and commit the affected files listed in the job summary.",
} as const;
