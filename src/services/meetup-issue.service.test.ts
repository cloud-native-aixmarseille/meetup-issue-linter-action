import { mock, MockProxy } from "jest-mock-extended";
import { GitHubService } from "./github.service.js";
import { MeetupIssueBodyFields, MeetupIssueService } from "./meetup-issue.service.js";
import { getMeetupIssueFixture } from "../__fixtures__/meetup-issue.fixture.js";

describe("MeetupIssueService", () => {
  let githubServiceMock: MockProxy<GitHubService>;

  let meetupIssueService: MeetupIssueService;

  beforeEach(() => {
    githubServiceMock = mock<GitHubService>();

    meetupIssueService = new MeetupIssueService(githubServiceMock);
  });

  describe("getMeetupIssue", () => {
    it("should returns mapped meetup issue", async () => {
      // Arrange
      const body = `### Event date

2023-10-10

### Hoster

test-host
`;

      githubServiceMock.getIssue.mockResolvedValue({
        number: 123,
        title: "Test Issue",
        labels: ["label1", "label2"],
        body,
      });

      const parsedBody = { event_date: "2023-10-10", hoster: ["test-host"] };

      // Act
      const result = await meetupIssueService.getMeetupIssue(123, parsedBody);

      // Assert
      expect(result).toEqual({
        number: 123,
        title: "Test Issue",
        labels: ["label1", "label2"],
        body,
        parsedBody: { event_date: "2023-10-10", hoster: ["test-host"] },
      });
    });
  });

  describe("updateMeetupIssue", () => {
    it("should update the issue title", async () => {
      // Arrange
      const originalIssue = getMeetupIssueFixture();
      const updatedIssue = {
        ...originalIssue,
        title: "Updated Title",
      };

      await meetupIssueService.updateMeetupIssue(originalIssue, updatedIssue);

      expect(githubServiceMock.updateIssue).toHaveBeenCalledWith(1, { title: "Updated Title" });
    });

    it("should update the issue labels", async () => {
      // Arrange
      const originalIssue = getMeetupIssueFixture();
      const updatedIssue = {
        ...originalIssue,
        labels: ["new-label"],
      };

      await meetupIssueService.updateMeetupIssue(originalIssue, updatedIssue);

      expect(githubServiceMock.updateIssue).toHaveBeenCalledWith(1, { labels: ["new-label"] });
    });

    it("should update the issue body", async () => {
      // Arrange
      const originalIssue = getMeetupIssueFixture();
      const updatedIssue = {
        ...originalIssue,
        body: "Updated body content",
      };

      await meetupIssueService.updateMeetupIssue(originalIssue, updatedIssue);

      expect(githubServiceMock.updateIssue).toHaveBeenCalledWith(1, {
        body: "Updated body content",
      });
    });

    it("should throw an error if the issue number is mismatched", async () => {
      // Arrange
      const originalIssue = getMeetupIssueFixture();
      const updatedIssue = {
        ...originalIssue,
        number: 999,
      };

      // Act & Assert
      await expect(
        meetupIssueService.updateMeetupIssue(originalIssue, updatedIssue)
      ).rejects.toThrow("Issue number mismatch");
    });
  });

  describe("updateMeetupIssueBodyField", () => {
    it("should update the issue body field", () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const field = "event_date";

      meetupIssue.parsedBody[field] = "2024-01-01";

      // Act
      meetupIssueService.updateMeetupIssueBodyField(meetupIssue, field);

      // Assert
      expect(meetupIssue.body).toContain("### Event Date\n\n2024-01-01\n\n### Hoster\n\n");
    });

    it("should update the issue body field with array value", () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const field = "hoster";

      meetupIssue.parsedBody[field] = ["hoster-1"];

      // Act
      meetupIssueService.updateMeetupIssueBodyField(meetupIssue, field);

      // Assert
      expect(meetupIssue.body).toContain("### Hoster\n\nhoster-1\n\n### Event Description");
    });

    it("should throw an error if the field is invalid", () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const field = "invalid_field";

      // Act & Assert
      expect(() =>
        meetupIssueService.updateMeetupIssueBodyField(
          { ...meetupIssue, number: 999 },
          field as MeetupIssueBodyFields
        )
      ).toThrow("Invalid field: invalid_field");
    });

    it("should throw an error if the field is not found in the body", () => {
      // Arrange
      const meetupIssue = getMeetupIssueFixture();
      const field = "event_title";

      // Act & Assert
      expect(() => {
        meetupIssueService.updateMeetupIssueBodyField({ ...meetupIssue, body: "" }, field);
      }).toThrow(`Field "${field}" not found in issue body`);
    });
  });
});
