import * as core from "@actions/core";
import { runPublicationReconcileAssetsAction } from "../publication-action.js";
import { publicErrorMessage } from "../runtime-input.js";

runPublicationReconcileAssetsAction().catch((error: unknown) => {
	core.setFailed(publicErrorMessage(error));
});
