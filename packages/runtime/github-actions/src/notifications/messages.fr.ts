import type { EN_MESSAGES } from "./messages.en.js";
export const FR_MESSAGES = {
	"communication.organizer-attention":
		"Le ticket du meetup #{issue} nécessite l'attention des organisateurs.",
} satisfies Record<keyof typeof EN_MESSAGES, string>;
