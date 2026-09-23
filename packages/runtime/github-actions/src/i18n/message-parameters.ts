export interface MessageParameters {
	"report.feedback.changes": { persisted: string; linkUpdated: string };
	"report.fix-applied": { applied: string };
	"report.failed": { reason: string };
	"report.referential.counts": { hosts: number; speakers: number };
	"report.issue-form.files": { files: string };
	"report.event.context": { issue: number; mode: string };
	"report.event.state": { state: string; ready: string };
	"report.event.persisted": { persisted: string; comment: string };
	"report.events.count": { count: number };
	"report.events.issues": { issues: string };
	"report.assets.counts": { persisted: string; count: number };
	"report.communication.mode": { mode: string };
	"report.communication.planned": {
		planned: number;
		due: number;
		dispatched: number;
	};
	"report.communication.accepted": {
		accepted: number;
		recorded: number;
		deferred: number;
	};
	"report.communication.uncertain": { uncertain: number; rejected: number };
}
