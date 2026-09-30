<!-- header:start -->

# GitHub Action: Reconcile meetup communications

<!-- header:end -->
<!-- badges:start -->

[![Marketplace](https://img.shields.io/badge/Marketplace-reconcile--meetup--communications-blue?logo=github-actions)](https://github.com/marketplace/actions/reconcile-meetup-communications)
[![Release](https://img.shields.io/github/v/release/cloud-native-aixmarseille/meetup-event-automation)](https://github.com/cloud-native-aixmarseille/meetup-event-automation/releases)
[![Stars](https://img.shields.io/github/stars/cloud-native-aixmarseille/meetup-event-automation?style=social)](https://img.shields.io/github/stars/cloud-native-aixmarseille/meetup-event-automation?style=social)

<!-- badges:end -->
<!-- overview:start -->

## Overview

Reconcile due meetup communications and dispatch them through the configured mail and Slack gateways when approval and delivery checks pass. Publish redacted diagnostics in annotations, logs, and the job summary.

The action uses one reconciliation path. Its result still reports the effective
`check` or `dispatch` mode according to approval and delivery checks. Run the
action under the shared per-event lock; the reusable workflows provide it.

The required `report-errors-to-issue` input selects the error policy. Issue
updates use `false` to fail on error diagnostics. Audits use `true` to record the
report in a managed meetup issue comment and succeed after it is saved or
confirmed current. Later runs update that comment, including when errors are
resolved. Execution and comment persistence failures still fail the action.

<!-- overview:end -->
<!-- usage:start -->

## Usage

```yaml
- uses: cloud-native-aixmarseille/meetup-event-automation/actions/communication/reconcile@88fd8c3495bfbf7061bbd67d1324b0b4e4bc14d3 # main
  with:
    # Optional language for generated text.
    locale: en
    # GitHub issue number in the caller repository containing the meetup event document to inspect.
    # This input is required.
    issue-number: ""

    # Required: true reports errors in the issue; false fails on error diagnostics.
    # Use the shared event lock.
    report-errors-to-issue: "false"

    # Token for the caller repository. Requires issues:write for approval, delivery ledger, and diagnostic comments.
    # This input is required.
    github-token: ""

    # Trusted bot login allowed to create or update managed delivery ledger and communication diagnostic comments, for example my-app[bot].
    # This input is required.
    managed-comment-author: ""

    # Token used to dispatch approved email communications to the configured mailings repository.
    # This input is required.
    mailings-token: ""

    # Slack channel ID used for approved notifications.
    # This input is required.
    slack-channel-id: ""

    # Slack bot token used for approved notifications.
    # This input is required.
    slack-token: ""
```

<!-- usage:end -->
<!-- inputs:start -->

## Inputs

| **Input**                    | **Description**                                                                                                                                                                                                        | **Required** | **Default** |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| **`locale`**                 | Language for generated reports and guidance (en or fr). Regional variants are supported; unsupported locales fall back to English.                                                                                     | **false**    | `en`        |
| **`issue-number`**           | GitHub issue number in the caller repository containing the meetup event document to inspect.                                                                                                                          | **true**     | -           |
| **`report-errors-to-issue`** | Use true to record diagnostics in a managed issue comment and succeed after persistence, or false to fail on error diagnostics. Execution and comment persistence failures still fail. Requires the shared event lock. | **true**     | -           |
| **`github-token`**           | Token for the caller repository. Requires issues:write for approval, delivery ledger, and diagnostic comments.                                                                                                         | **true**     | -           |
| **`managed-comment-author`** | Trusted bot login allowed to create or update managed delivery ledger and communication diagnostic comments, for example my-app[bot].                                                                                  | **true**     | -           |
| **`mailings-token`**         | Token used to dispatch approved email communications to the configured mailings repository.                                                                                                                            | **true**     | -           |
| **`slack-channel-id`**       | Slack channel ID used for approved notifications.                                                                                                                                                                      | **true**     | -           |
| **`slack-token`**            | Slack bot token used for approved notifications.                                                                                                                                                                       | **true**     | -           |

<!-- inputs:end -->
<!-- secrets:start -->
<!-- secrets:end -->
<!-- outputs:start -->

## Outputs

| **Output**             | **Description**                                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **`result`**           | Versioned redacted JSON envelope containing the effective mode, reconciliation counts, hashed intent identifiers, and diagnostics. |
| **`planned-count`**    | Number of due communication intents identified for the current event revision.                                                     |
| **`dispatched-count`** | Number of gateway calls attempted during this run.                                                                                 |
| **`diagnostics`**      | Redacted JSON diagnostics safe to expose in workflow logs and summaries.                                                           |

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
