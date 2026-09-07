import * as core from "@actions/core";
import { runEventListActiveAction } from "../event-actions.js";
import { publicErrorMessage } from "../runtime-input.js";

runEventListActiveAction().catch((error: unknown) => {
	core.setFailed(publicErrorMessage(error));
});
