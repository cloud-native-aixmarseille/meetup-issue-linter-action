<!-- header:start -->

# GitHub Action: Reconcile meetup assets

<!-- header:end -->
<!-- badges:start -->

[![Marketplace](https://img.shields.io/badge/Marketplace-reconcile--meetup--assets-blue?logo=github-actions)](https://github.com/marketplace/actions/reconcile-meetup-assets)
[![Release](https://img.shields.io/github/v/release/cloud-native-aixmarseille/meetup-event-automation)](https://github.com/cloud-native-aixmarseille/meetup-event-automation/releases)
[![Stars](https://img.shields.io/github/stars/cloud-native-aixmarseille/meetup-event-automation?style=social)](https://img.shields.io/github/stars/cloud-native-aixmarseille/meetup-event-automation?style=social)

<!-- badges:end -->
<!-- overview:start -->

## Overview

Reconcile the event Drive folder, template copies, and issue asset link. Publish redacted diagnostics in annotations, logs, and the job summary.

<!-- overview:end -->
<!-- usage:start -->

## Usage

```yaml
- uses: cloud-native-aixmarseille/meetup-event-automation/actions/publication/reconcile-assets@0123456789abcdef0123456789abcdef01234567 # replace with a release SHA containing asset reconciliation
  with:
    # Optional language for generated text.
    locale: en
    # GitHub issue number containing the meetup event document.
    # This input is required.
    issue-number: ""

    # Token for the caller repository. Requires issues:read and issues:write.
    # This input is required.
    github-token: ""

    # Trusted GitHub App bot login used by the event composition.
    # This input is required.
    managed-comment-author: ""

    # Service-account JSON with access to the configured Drive parent and template folders.
    # This input is required.
    google-credentials: ""

    # Google Drive folder ID of the parent meetup folder.
    # This input is required.
    google-drive-meetup-folder-id: ""

    # Google Drive folder ID of the template folder.
    # This input is required.
    google-drive-meetup-template-folder-id: ""
```

<!-- usage:end -->
<!-- inputs:start -->

## Inputs

| **Input**                                    | **Description**                                                                                                                    | **Required** | **Default** |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------- |
| **`locale`**                                 | Language for generated reports and guidance (en or fr). Regional variants are supported; unsupported locales fall back to English. | **false**    | `en`        |
| **`issue-number`**                           | GitHub issue number containing the meetup event document.                                                                          | **true**     | -           |
| **`github-token`**                           | Token for the caller repository. Requires issues:read and issues:write.                                                            | **true**     | -           |
| **`managed-comment-author`**                 | Trusted GitHub App bot login used by the event composition.                                                                        | **true**     | -           |
| **`google-credentials`**                     | Service-account JSON with access to the configured Drive parent and template folders.                                              | **true**     | -           |
| **`google-drive-meetup-folder-id`**          | Google Drive folder ID of the parent meetup folder.                                                                                | **true**     | -           |
| **`google-drive-meetup-template-folder-id`** | Google Drive folder ID of the template folder.                                                                                     | **true**     | -           |

<!-- inputs:end -->
<!-- secrets:start -->
<!-- secrets:end -->
<!-- outputs:start -->

## Outputs

| **Output**        | **Description**                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| **`result`**      | Versioned JSON envelope containing folder and template links, persistence status, and diagnostics. |
| **`asset-url`**   | URL of the managed event folder, or an empty string when unavailable.                              |
| **`drive-files`** | JSON map from template kind followed by -link to the corresponding copied file URL.                |
| **`diagnostics`** | Redacted JSON diagnostics for asset reconciliation.                                                |

<!-- outputs:end -->
<!-- examples:start -->

See [Google Drive event assets](../../../docs/integrations/assets.md) for the required folder inputs, service-account access, asset identity, and retry behavior.

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
