import * as core from "@actions/core";
import { runReferentialValidateAction } from "../referential-actions.js";
import { publicErrorMessage } from "../runtime-input.js";

runReferentialValidateAction().catch((error: unknown) => {
	core.setFailed(publicErrorMessage(error));
});
