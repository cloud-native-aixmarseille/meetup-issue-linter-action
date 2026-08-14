import { injectable, injectFromBase } from "inversify";
import { AbstractLinkLinterAdapter } from "./abstract-link-linter.adapter.js";

@injectable()
@injectFromBase({
	extendConstructorArguments: true,
})
export class CNCFLinkLinterAdapter extends AbstractLinkLinterAdapter {
	private static readonly CNCF_LINK_REGEX =
		/^https:\/\/(?:community\.cncf\.io\/events\/details\/cncf-cloud-native-aix-marseille-presents-[0-9a-z-]+|ocgroups\.dev\/cncf\/group\/cloud-native-aix-marseille\/event\/[0-9a-z-]+)\/?$/;

	protected getLinkRegex() {
		return CNCFLinkLinterAdapter.CNCF_LINK_REGEX;
	}

	protected getErrorMessage() {
		return "Must be a valid CNCF link, e.g. https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/ab1cdef";
	}

	protected getFieldName() {
		return "cncf_link" as const;
	}
}
