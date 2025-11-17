<!-- header:start -->

# GitHub Reusable Workflow: Update meetup issue

<!-- header:end -->
<!-- badges:start -->

[![Release](https://img.shields.io/github/v/release/cloud-native-aixmarseille/meetup-issue-linter-action)](https://github.com/cloud-native-aixmarseille/meetup-issue-linter-action/releases)
[![Stars](https://img.shields.io/github/stars/cloud-native-aixmarseille/meetup-issue-linter-action?style=social)](https://img.shields.io/github/stars/cloud-native-aixmarseille/meetup-issue-linter-action?style=social)

<!-- badges:end -->
<!-- overview:start -->

## Overview

Reusable workflow that checks one meetup issue and applies the approved
communication and issue updates needed to keep it current.

### Permissions

- **`contents`**: `read`

<!-- overview:end -->
<!-- usage:start -->

## Usage

```yaml
name: Update meetup issue
on:
  push:
    branches:
      - main
permissions: {}
jobs:
  update-meetup-issue:
    uses: cloud-native-aixmarseille/meetup-issue-linter-action/.github/workflows/update-meetup-issue.yml@0123456789abcdef0123456789abcdef01234567 # replace with a release SHA containing asset reconciliation
    permissions:
      contents: read
    secrets:
      # Optional Google service-account JSON for Drive asset reconciliation. Omission keeps asset management manual.
      google-credentials: ""

      # PEM-encoded private key for the GitHub App identified by the github-app-id input. Used to mint a narrowly scoped installation token.
      # This input is required.
      github-app-private-key: ""

      # Optional token used to dispatch approved email communications to the configured mailings repository. When omitted, mail intents remain planned but are not sent.
      mailings-token: ""

      # Optional Slack bot token used for approved notifications. When omitted, Slack delivery is skipped safely.
      slack-token: ""
    with:
      # GitHub App ID used to mint the narrowly scoped installation token for meetup automation.
      # This input is required.
      github-app-id: ""

      # Optional Slack channel ID used for approved notifications. When omitted, Slack delivery is skipped safely.
      slack-channel-id: ""
```

<!-- usage:end -->
<!-- inputs:start -->

## Inputs

### Workflow Call Inputs

| **Input**              | **Description**                                                                                            | **Required** | **Type**   | **Default** |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ------------ | ---------- | ----------- |
| **`github-app-id`**    | GitHub App ID used to mint the narrowly scoped installation token for meetup automation.                   | **true**     | **string** | -           |
| **`slack-channel-id`** | Optional Slack channel ID used for approved notifications. When omitted, Slack delivery is skipped safely. | **false**    | **string** | -           |

<!-- inputs:end -->
<!-- secrets:start -->

## Secrets

| **Secret**                   | **Description**                                                                                                                                                  | **Required** |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **`google-credentials`**     | Optional Google service-account JSON for Drive asset reconciliation. Omission keeps asset management manual.                                                     | **false**    |
| **`github-app-private-key`** | PEM-encoded private key for the GitHub App identified by the github-app-id input. Used to mint a narrowly scoped installation token.                             | **true**     |
| **`mailings-token`**         | Optional token used to dispatch approved email communications to the configured mailings repository. When omitted, mail intents remain planned but are not sent. | **false**    |
| **`slack-token`**            | Optional Slack bot token used for approved notifications. When omitted, Slack delivery is skipped safely.                                                        | **false**    |

<!-- secrets:end -->
<!-- outputs:start -->

## Outputs

| **Output**                      | **Description**                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **`state`**                     | Derived lifecycle state for the target meetup issue, such as draft, planned, ready, held, or follow-up-complete. |
| **`is-ready`**                  | Whether the current meetup issue revision satisfies readiness checks.                                            |
| **`diagnostics`**               | Redacted JSON diagnostics produced by event reconciliation.                                                      |
| **`communication-diagnostics`** | Redacted JSON diagnostics produced by approval capture and communication reconciliation.                         |

<!-- outputs:end -->
<!-- examples:start -->
<!-- examples:end -->
<!-- contributing:start -->
<!-- contributing:end -->
<!-- security:start -->
<!-- security:end -->
<!-- license:start -->
<!-- license:end -->
<!-- generated:start -->

---

This documentation was automatically generated by [CI Dokumentor](https://github.com/hoverkraft-tech/ci-dokumentor).

<!-- generated:end -->
