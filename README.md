<!-- header:start -->

# ![Icon](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJmZWF0aGVyIGZlYXRoZXItY2hlY2stY2lyY2xlIiBjb2xvcj0iYmx1ZSI+PHBhdGggZD0iTTIyIDExLjA4VjEyYTEwIDEwIDAgMSAxLTUuOTMtOS4xNCI+PC9wYXRoPjxwb2x5bGluZSBwb2ludHM9IjIyIDQgMTIgMTQuMDEgOSAxMS4wMSI+PC9wb2x5bGluZT48L3N2Zz4=) GitHub Action: Meetup issue linter action

<div align="center">
  <img src=".github/logo.svg" width="60px" align="center" alt="Meetup issue linter action" />
</div>

---

<!-- header:end -->

<!-- badges:start -->

[![Marketplace](https://img.shields.io/badge/Marketplace-meetup--issue--linter--action-blue?logo=github-actions)](https://github.com/marketplace/actions/meetup-issue-linter-action)
[![Release](https://img.shields.io/github/v/release/cloud-native-aixmarseille/meetup-issue-linter-action)](https://github.com/cloud-native-aixmarseille/meetup-issue-linter-action/releases)
[![License](https://img.shields.io/github/license/cloud-native-aixmarseille/meetup-issue-linter-action)](http://choosealicense.com/licenses/mit/)
[![Stars](https://img.shields.io/github/stars/cloud-native-aixmarseille/meetup-issue-linter-action?style=social)](https://img.shields.io/github/stars/cloud-native-aixmarseille/meetup-issue-linter-action?style=social)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/cloud-native-aixmarseille/meetup-issue-linter-action/blob/main/CONTRIBUTING.md)

<!-- badges:end -->

<!-- overview:start -->

## Overview

This action lint the meetup issue for required fields and format

<!-- overview:end -->

<!-- usage:start -->

## Usage

```yaml
- uses: cloud-native-aixmarseille/meetup-issue-linter-action@0f86169ab69471b8fc8d49c874234d9a3d5e057c # 0.9.4
  with:
    # The issue number to lint.
    # This input is required.
    issue-number: ""

    # The parsed issue body. See <https://github.com/issue-ops/parser>.
    # This input is required.
    issue-parsed-body: ""

    # JSON List of hosters to update.
    # Example: `["Hoster 1", "Hoster 2"]`.
    #
    # This input is required.
    hosters: ""

    # JSON List of speakers with name and URL.
    # Example: `[{"name": "Speaker One", "url": "https://example.com/speaker1"}, {"name": "Speaker Two", "url": "https://example.com/speaker2"}]`.
    #
    # This input is required.
    speakers: ""

    # Whether to fix the issue or not.
    # Default: `true`
    should-fix: "true"

    # Whether to fail on error or not.
    # Default: `true`
    fail-on-error: "true"

    # The GitHub token with permissions to update the issue.
    # This input is required.
    github-token: ""
```

<!-- usage:end -->

<!-- inputs:start -->

## Inputs

| **Input**               | **Description**                                                                                                                              | **Required** | **Default** |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| **`issue-number`**      | The issue number to lint.                                                                                                                    | **true**     | -           |
| **`issue-parsed-body`** | The parsed issue body. See <https://github.com/issue-ops/parser>.                                                                            | **true**     | -           |
| **`hosters`**           | JSON List of hosters to update.                                                                                                              | **true**     | -           |
|                         | Example: `["Hoster 1", "Hoster 2"]`.                                                                                                         |              |             |
| **`speakers`**          | JSON List of speakers with name and URL.                                                                                                     | **true**     | -           |
|                         | Example: `[{"name": "Speaker One", "url": "https://example.com/speaker1"}, {"name": "Speaker Two", "url": "https://example.com/speaker2"}]`. |              |             |
| **`should-fix`**        | Whether to fix the issue or not.                                                                                                             | **false**    | `true`      |
| **`fail-on-error`**     | Whether to fail on error or not.                                                                                                             | **false**    | `true`      |
| **`github-token`**      | The GitHub token with permissions to update the issue.                                                                                       | **true**     | -           |

<!-- inputs:end -->

<!-- secrets:start -->
<!-- secrets:end -->

<!-- outputs:start -->

## Outputs

| **Output**        | **Description**                           |
| ----------------- | ----------------------------------------- |
| **`lint-issues`** | List of issues found in the meetup issue. |

<!-- outputs:end -->

<!-- examples:start -->
<!-- examples:end -->

<!-- contributing:start -->

## Contributing

Contributions are welcome! Please see the [contributing guidelines](https://github.com/cloud-native-aixmarseille/meetup-issue-linter-action/blob/main/CONTRIBUTING.md) for more details.

<!-- contributing:end -->

<!-- security:start -->
<!-- security:end -->

<!-- license:start -->

## License

This project is licensed under the MIT License.

SPDX-License-Identifier: MIT

Copyright © 2025 Cloud Native Aix-Marseille

For more details, see the [license](http://choosealicense.com/licenses/mit/).

<!-- license:end -->

<!-- generated:start -->

---

This documentation was automatically generated by [CI Dokumentor](https://github.com/hoverkraft-tech/ci-dokumentor).

<!-- generated:end -->
