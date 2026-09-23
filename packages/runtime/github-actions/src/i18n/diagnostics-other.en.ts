export const DIAGNOSTICS_OTHER_EN = {
	"diagnostic.publication.feedback.unrelated": "This issue is not a meetup",
	"diagnostic.publication.feedback.inactive":
		"Feedback automation is inactive for this event",
	"diagnostic.publication.feedback.prerequisites":
		"Resolve the event title, date and feedback link before updating feedback",
	"diagnostic.publication.feedback.creation-pending":
		"An OpenFeedback event will be created in fix mode; configure its talks and speakers in OpenFeedback",
	"diagnostic.publication.feedback.ambiguous-date":
		"Several active meetups share this date; update the shared feedback link manually",
	"diagnostic.publication.assets.prerequisites":
		"Resolve the event host and date before reconciling assets",
	"diagnostic.publication.community-url.invalid":
		"Community event URL must use an approved CNCF/OCGroups prefix and identifier",
	"diagnostic.publication.meetup.missing":
		"The Meetup publication link is required.",
	"diagnostic.publication.community.missing":
		"The CNCF / OCGroups publication link is required.",
	"diagnostic.publication.assets.missing":
		"The event asset folder link is required.",
	"diagnostic.publication.meetup-url.invalid":
		"Use this group's Meetup event URL, ending with the numeric event ID.",
	"diagnostic.publication.asset-url.invalid": "Use a Google Drive folder URL.",
	"diagnostic.issue-form.out-of-date": "Issue form requires synchronization.",
	"diagnostic.issue-form.updated": "Issue form was synchronized.",
	"diagnostic.action.execution.failed":
		"Meetup automation failed; inspect debug logs using a trusted runner",
} as const;
