import { LintError } from "./lint.error";

describe("LintError", () => {
  it("keeps provided fields as-is", () => {
    const error = new LintError([
      { field: "parsedBody.agenda", message: "Agenda: invalid" },
      { field: "title", message: "Title: invalid" },
    ]);

    expect(error.getIssues()).toEqual([
      { field: "parsedBody.agenda", message: "Agenda: invalid" },
      { field: "title", message: "Title: invalid" },
    ]);
  });
});
