import { DriveLinkLinterAdapter } from "./drive-link-linter.adapter";
import { LintError } from "../lint.error";
import { getMeetupIssueFixture } from "../../__fixtures__/meetup-issue.fixture";

describe("DriveLinkLinterAdapter", () => {
  let driveLinkLinterAdapter: DriveLinkLinterAdapter;

  beforeEach(() => {
    driveLinkLinterAdapter = new DriveLinkLinterAdapter();
  });

  describe("lint", () => {
    it("should return the meetup issue if the Drive Link is valid", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const shouldFix = false;

      // Act
      const result = await driveLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result).toEqual(meetupIssue);
    });

    it("should throw a LintError if the Drive Link is invalid", async () => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        body: {
          drive_link: "invalid-link",
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([
        "Drive Link: Invalid url; Must be a valid Drive Link, e.g. https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j",
      ]);

      await expect(
        driveLinkLinterAdapter.lint(invalidMeetupIssue, shouldFix)
      ).rejects.toStrictEqual(expectedError);
    });

    it("should throw a LintError if the Drive Link is not a Drive Link", async () => {
      // Arrange
      const invalidMeetupIssue = getMeetupIssueFixture({
        body: {
          drive_link: "https://www.google.com",
        },
      });
      const shouldFix = false;

      // Act & Assert
      const expectedError = new LintError([
        "Drive Link: Must be a valid Drive Link, e.g. https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j",
      ]);

      await expect(
        driveLinkLinterAdapter.lint(invalidMeetupIssue, shouldFix)
      ).rejects.toStrictEqual(expectedError);
    });

    it("should accept Drive Link with trailing slash", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        body: {
          drive_link: "https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j/",
        },
      });
      const shouldFix = false;

      // Act
      const result = await driveLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result).toEqual(meetupIssue);
    });

    it("should remove trailing slash when shouldFix is true", async () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture({
        body: {
          drive_link: "https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j/",
        },
      });
      const shouldFix = true;

      // Act
      const result = await driveLinkLinterAdapter.lint(meetupIssue, shouldFix);

      // Assert
      expect(result.body.drive_link).toBe(
        "https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j"
      );
    });
  });
});
