import * as core from "@actions/core";
import { runEventReconcileAction } from "../event-actions.js";
import { publicErrorMessage } from "../runtime-input.js";

runEventReconcileAction().catch((error: unknown) => {
	core.setFailed(publicErrorMessage(error));
});
