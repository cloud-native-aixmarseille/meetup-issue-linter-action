import * as core from "@actions/core";
import { runCommunicationReconcileAction } from "../communication-action.js";
import { publicErrorMessage } from "../runtime-input.js";

runCommunicationReconcileAction().catch((error: unknown) => {
	core.setFailed(publicErrorMessage(error));
});
