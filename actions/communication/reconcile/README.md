<!-- header:start -->

# GitHub Action: Reconcile meetup communications

<!-- header:end -->
<!-- badges:start -->

[![Marketplace](https://img.shields.io/badge/Marketplace-reconcile--meetup--communications-blue?logo=github-actions)](https://github.com/marketplace/actions/reconcile-meetup-communications)
[![Release](https://img.shields.io/github/v/release/cloud-native-aixmarseille/meetup-issue-linter-action)](https://github.com/cloud-native-aixmarseille/meetup-issue-linter-action/releases)
[![Stars](https://img.shields.io/github/stars/cloud-native-aixmarseille/meetup-issue-linter-action?style=social)](https://img.shields.io/github/stars/cloud-native-aixmarseille/meetup-issue-linter-action?style=social)

<!-- badges:end -->
<!-- overview:start -->

## Overview

Plan due meetup communications and, when authorized, dispatch them through the configured mail and Slack gateways.

<!-- overview:end -->
<!-- usage:start -->

## Usage

```yaml
- uses: cloud-native-aixmarseille/meetup-issue-linter-action/actions/communication/reconcile@88fd8c3495bfbf7061bbd67d1324b0b4e4bc14d3 # main
  with:
    # GitHub issue number in the caller repository containing the meetup event document to inspect.
    # This input is required.
    issue-number: ""

    # Use check to plan and validate only, or dispatch to send due communications when every safety gate passes.
    # Default: `check`
    mode: check

    # Token for the caller repository. Requires issues:read; dispatch mode also requires issues:write.
    # This input is required.
    github-token: ""

    # Trusted bot login allowed to create or update the managed delivery ledger comment, for example my-app[bot].
    # This input is required.
    managed-comment-author: ""

    # Optional token used to dispatch approved email communications to the configured mailings repository. When omitted, mail intents remain planned but are not sent.
    mailings-token: ""

    # Optional Slack bot token used for approved notifications. When omitted, Slack delivery is skipped safely.
    slack-token: ""

    # Internal workflow assertion that the shared event concurrency lock is held and dispatch is authorized by the caller workflow.
    # Default: `false`
    dispatch-authorized: "false"
```

<!-- usage:end -->
<!-- inputs:start -->

## Inputs

| **Input**                    | **Description**                                                                                                                                                  | **Required** | **Default** |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| **`issue-number`**           | GitHub issue number in the caller repository containing the meetup event document to inspect.                                                                    | **true**     | -           |
| **`mode`**                   | Use check to plan and validate only, or dispatch to send due communications when every safety gate passes.                                                       | **false**    | `check`     |
| **`github-token`**           | Token for the caller repository. Requires issues:read; dispatch mode also requires issues:write.                                                                 | **true**     | -           |
| **`managed-comment-author`** | Trusted bot login allowed to create or update the managed delivery ledger comment, for example my-app[bot].                                                      | **true**     | -           |
| **`mailings-token`**         | Optional token used to dispatch approved email communications to the configured mailings repository. When omitted, mail intents remain planned but are not sent. | **false**    | -           |
| **`slack-token`**            | Optional Slack bot token used for approved notifications. When omitted, Slack delivery is skipped safely.                                                        | **false**    | -           |
| **`dispatch-authorized`**    | Internal workflow assertion that the shared event concurrency lock is held and dispatch is authorized by the caller workflow.                                    | **false**    | `false`     |

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
