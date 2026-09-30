<!-- header:start -->

# ![Icon](data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIGNsYXNzPSJmZWF0aGVyIGZlYXRoZXItY2hlY2stY2lyY2xlIiBjb2xvcj0iYmx1ZSI+PHBhdGggZD0iTTIyIDExLjA4VjEyYTEwIDEwIDAgMSAxLTUuOTMtOS4xNCI+PC9wYXRoPjxwb2x5bGluZSBwb2ludHM9IjIyIDQgMTIgMTQuMDEgOSAxMS4wMSI+PC9wb2x5bGluZT48L3N2Zz4=) GitHub Action: Reconcile meetup event

<!-- header:end -->
<!-- badges:start -->

[![Marketplace](https://img.shields.io/badge/Marketplace-reconcile--meetup--event-blue?logo=github-actions)](https://github.com/marketplace/actions/reconcile-meetup-event)
[![Release](https://img.shields.io/github/v/release/cloud-native-aixmarseille/meetup-event-automation)](https://github.com/cloud-native-aixmarseille/meetup-event-automation/releases)
[![Stars](https://img.shields.io/github/stars/cloud-native-aixmarseille/meetup-event-automation?style=social)](https://img.shields.io/github/stars/cloud-native-aixmarseille/meetup-event-automation?style=social)

<!-- badges:end -->
<!-- overview:start -->

## Overview

Read one meetup issue, derive lifecycle and readiness, and optionally persist safe issue and managed-comment updates. Publish redacted diagnostics in annotations, logs, and the job summary.

<!-- overview:end -->
<!-- usage:start -->

## Usage

```yaml
- uses: cloud-native-aixmarseille/meetup-event-automation/actions/event/reconcile@88fd8c3495bfbf7061bbd67d1324b0b4e4bc14d3 # main
  with:
    # Optional language for generated text.
    locale: en
    # GitHub issue number in the caller repository containing the meetup event document to inspect.
    # This input is required.
    issue-number: ""

    # Use check for read-only validation or fix to persist safe normalizations to the issue and managed diagnostic comment.
    # This input is required.
    mode: check

    # Token for the caller repository. Requires issues:read; fix mode also requires issues:write.
    # This input is required.
    github-token: ""

    # Trusted bot login allowed to create or update the managed diagnostic comment, for example my-app[bot].
    # This input is required.
    managed-comment-author: ""
```

<!-- usage:end -->
<!-- inputs:start -->

## Inputs

| **Input**                    | **Description**                                                                                                                    | **Required** | **Default** |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| **`locale`**                 | Language for generated reports and guidance (en or fr). Regional variants are supported; unsupported locales fall back to English. | **false**    | `en`        |
| **`issue-number`**           | GitHub issue number in the caller repository containing the meetup event document to inspect.                                      | **true**     | -           |
| **`mode`**                   | Use check for read-only validation or fix to persist safe normalizations to the issue and managed diagnostic comment.              | **true**     | -           |
| **`github-token`**           | Token for the caller repository. Requires issues:read; fix mode also requires issues:write.                                        | **true**     | -           |
| **`managed-comment-author`** | Trusted bot login allowed to create or update the managed diagnostic comment, for example my-app[bot].                             | **true**     | -           |

<!-- inputs:end -->
<!-- secrets:start -->
<!-- secrets:end -->
<!-- outputs:start -->

## Outputs

| **Output**        | **Description**                                                                                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **`result`**      | Versioned JSON envelope containing whether the event was skipped, the derived state, readiness, persistence flags, and redacted diagnostics. |
| **`state`**       | Derived lifecycle state for the meetup issue, such as draft, planned, ready, held, or follow-up-complete.                                    |
| **`is-ready`**    | Whether the current meetup issue revision satisfies readiness checks.                                                                        |
| **`diagnostics`** | Redacted JSON diagnostics safe to expose in workflow logs and summaries.                                                                     |

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
