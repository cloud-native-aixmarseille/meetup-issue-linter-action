import * as core from "@actions/core";
import { runReferentialSyncIssueFormAction } from "../referential-actions.js";
import { publicErrorMessage } from "../runtime-input.js";

runReferentialSyncIssueFormAction().catch((error: unknown) => {
	core.setFailed(publicErrorMessage(error));
});
