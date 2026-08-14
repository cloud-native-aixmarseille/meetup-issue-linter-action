import { type MockProxy, mock } from "vitest-mock-extended";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture.js";
import type { MeetupIssueService } from "../../services/meetup-issue.service.js";
import { LintError } from "../lint.error.js";
import { CNCFLinkLinterAdapter } from "./cncf-link-linter.adapter.js";

describe("CNCFLinkLinterAdapter", () => {
	let meetupIssueService: MockProxy<MeetupIssueService>;
	let cncfLinkLinterAdapter: CNCFLinkLinterAdapter;

	beforeEach(() => {
		meetupIssueService = mock<MeetupIssueService>();

		cncfLinkLinterAdapter = new CNCFLinkLinterAdapter(meetupIssueService);
	});

	describe("lint", () => {
		it("should return the cncf issue if the CNCF link is valid", async () => {
			// Arrange
			const meetupIssue = getMeetupIssueFixture();
			const shouldFix = false;

			// Act
			const result = await cncfLinkLinterAdapter.lint(meetupIssue, shouldFix);

			// Assert
			expect(
				meetupIssueService.updateMeetupIssueBodyField,
			).not.toHaveBeenCalled();
			expect(result).toEqual(meetupIssue);
		});

		it("should accept the new ocgroups CNCF link format", async () => {
			// Arrange
			const meetupIssue = getMeetupIssueFixture({
				parsedBody: {
					cncf_link:
						"https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/ab1cdef",
				},
			});
			const shouldFix = false;

			// Act
			const result = await cncfLinkLinterAdapter.lint(meetupIssue, shouldFix);

			// Assert
			expect(
				meetupIssueService.updateMeetupIssueBodyField,
			).not.toHaveBeenCalled();
			expect(result).toEqual(meetupIssue);
		});

		it.each([
			{
				description: "CNCF link is invalid",
				cncf_link: "invalid-link",
				error:
					"Invalid URL; Must be a valid CNCF link, e.g. https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/ab1cdef",
			},
			{
				description: "CNCF link is not a CNCF link",
				cncf_link: "https://www.google.com",
				error:
					"Must be a valid CNCF link, e.g. https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/ab1cdef",
			},
		])("should throw a LintError if $description", async ({
			cncf_link,
			error,
		}) => {
			// Arrange
			const invalidmeetupIssue = getMeetupIssueFixture({
				parsedBody: {
					cncf_link,
				},
			});
			const shouldFix = false;

			// Act & Assert
			const expectedError = new LintError([`CNCF Link: ${error}`]);

			await expect(
				cncfLinkLinterAdapter.lint(invalidmeetupIssue, shouldFix),
			).rejects.toStrictEqual(expectedError);

			expect(
				meetupIssueService.updateMeetupIssueBodyField,
			).not.toHaveBeenCalled();
		});

		it("should accept CNCF Link with trailing slash", async () => {
			// Arrange
			const meetupIssue = getMeetupIssueFixture({
				parsedBody: {
					cncf_link:
						"https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/ab1cdef/",
				},
			});
			const shouldFix = false;

			// Act
			const result = await cncfLinkLinterAdapter.lint(meetupIssue, shouldFix);

			// Assert
			expect(
				meetupIssueService.updateMeetupIssueBodyField,
			).not.toHaveBeenCalled();
			expect(result).toEqual(meetupIssue);
		});

		it("should remove trailing slash when shouldFix is true", async () => {
			// Arrange
			const meetupIssue = getMeetupIssueFixture({
				parsedBody: {
					cncf_link:
						"https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/ab1cdef/",
				},
			});
			const shouldFix = true;

			// Act
			const result = await cncfLinkLinterAdapter.lint(meetupIssue, shouldFix);

			// Assert
			expect(
				meetupIssueService.updateMeetupIssueBodyField,
			).toHaveBeenCalledWith(meetupIssue, "cncf_link");
			expect(result.parsedBody.cncf_link).toBe(
				"https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/ab1cdef",
			);
		});

		it("should remove trailing slash from the new ocgroups format when shouldFix is true", async () => {
			// Arrange
			const meetupIssue = getMeetupIssueFixture({
				parsedBody: {
					cncf_link:
						"https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/ab1cdef/",
				},
			});
			const shouldFix = true;

			// Act
			const result = await cncfLinkLinterAdapter.lint(meetupIssue, shouldFix);

			// Assert
			expect(
				meetupIssueService.updateMeetupIssueBodyField,
			).toHaveBeenCalledWith(meetupIssue, "cncf_link");
			expect(result.parsedBody.cncf_link).toBe(
				"https://ocgroups.dev/cncf/group/cloud-native-aix-marseille/event/ab1cdef",
			);
		});
	});

	describe("getDependencies", () => {
		it("should return an empty array", () => {
			// Act
			const result = cncfLinkLinterAdapter.getDependencies();

			// Assert
			expect(result).toEqual([]);
		});
	});
});
