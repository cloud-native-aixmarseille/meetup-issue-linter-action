#!/usr/bin/env node
// Fix meetup Drive folders/files for all meetup issues with drive links

import fs from "fs";
import { google } from "googleapis";
import { getOctokit } from "@actions/github";

const SCOPES = ["https://www.googleapis.com/auth/drive"];
const DEFAULT_PARENT_FOLDER_ID = "0B7BRXkTx9Nj1QXQ1LVBzWUZZMkk";
const DEFAULT_TEMPLATE_FOLDER_ID = "1vh16hOarN-mozHTOZrWZ_Qurl50c2pLV";
const DEFAULT_CREDENTIALS_PATH = "/tmp/meetup-google-credentials.json";
const DEFAULT_REPO_OWNER = "cloud-native-aixmarseille";
const DEFAULT_REPO_NAME = "meetups";
const DRIVE_LINK_REGEX = /^https:\/\/drive\.google\.com\/drive\/folders\/[a-zA-Z0-9-_]+\/?$/;
const DRY_RUN = ["true", "1"].includes((process.env.DRY_RUN || "").toLowerCase());

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});

async function main() {
  const { owner, repo } = getRepo();
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error("Set GITHUB_TOKEN");
  }

  const parentFolderId = process.env.GOOGLE_PARENT_FOLDER_ID || DEFAULT_PARENT_FOLDER_ID;
  const templateFolderId = process.env.GOOGLE_TEMPLATE_FOLDER_ID || DEFAULT_TEMPLATE_FOLDER_ID;
  const credentials = loadCredentials();

  const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
  const drive = google.drive({ version: "v3", auth });
  const octokit = getOctokit(githubToken);

  console.log(
    `Scanning repo ${owner}/${repo} for meetup issues with drive links${DRY_RUN ? " (dry-run)" : ""}`
  );

  const issues = await fetchMeetupIssues(octokit, owner, repo);
  if (!issues.length) {
    console.log("No matching issues.");
    return;
  }

  const templates = await loadTemplates(drive, templateFolderId);
  for (const issue of issues) {
    await handleIssue(drive, issue, parentFolderId, templates);
  }
}

async function fetchMeetupIssues(octokit, owner, repo) {
  const q = `repo:${owner}/${repo} is:issue label:meetup "https://drive.google.com/drive/folders/"`;
  const per_page = 50;
  let page = 1;
  const issues = [];

  while (true) {
    const { data } = await octokit.rest.search.issuesAndPullRequests({ q, per_page, page });
    if (!data.items?.length) break;
    for (const item of data.items) {
      issues.push({ number: item.number, title: item.title, body: item.body || "" });
    }
    if (data.items.length < per_page) break;
    page += 1;
  }

  console.log(`Found ${issues.length} meetup issues with drive links.`);
  return issues;
}

async function handleIssue(drive, issue, parentFolderId, templates) {
  console.log(`\nIssue #${issue.number}: ${issue.title}`);
  const parsed = parseIssue(issue.body);
  const missing = [
    !parsed.drive_link ? "drive_link" : null,
    !parsed.event_date ? "event_date" : null,
    !parsed.hoster ? "hoster" : null,
  ].filter(Boolean);

  if (missing.length) {
    console.warn(
      `  Missing required fields (${missing.join(", ")}) – skipping. Parsed: drive_link=${parsed.drive_link || "none"}, event_date=${parsed.event_date || "none"}, hoster=${parsed.hoster || "none"}`
    );
    return;
  }

  const expectedFolderName = generateFolderName(parsed.event_date, parsed.hoster);
  const folder = await ensureFolder(
    drive,
    issue.number,
    parentFolderId,
    expectedFolderName,
    parsed.drive_link
  );

  if (parsed.drive_link !== folder.url) {
    console.log(`  Drive link differs (issue vs folder): ${parsed.drive_link} => ${folder.url}`);
  }

  await ensureFiles(drive, folder.id, parsed.event_date, templates);
}

function parseIssue(body) {
  const getSection = (label) => {
    const regex = new RegExp(`### ${label}\\s*\\n(.*?)(?=\\n###|$)`, "si");
    const match = body.match(regex);
    return match ? match[1].trim() : "";
  };

  const event_date = getSection("Event Date");
  const hosterRaw = getSection("Hoster");
  const driveLinkSection = getSection("Drive Link");
  const drive_link = (
    driveLinkSection.split(/\s+/).find((p) => DRIVE_LINK_REGEX.test(p)) || ""
  ).trim();

  const hoster = hosterRaw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(stripMarkdown)[0];

  return {
    event_date,
    hoster,
    drive_link,
  };
}

function stripMarkdown(text) {
  const linkMatch = text.match(/\[(.+?)\]\(.+?\)/);
  if (linkMatch) return linkMatch[1];
  return text;
}

function generateFolderName(eventDate, hostingName) {
  const date = eventDate.trim();
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(
    new Date(`${date}T00:00:00`)
  );
  return `${date} - ${month} - ${hostingName.trim()}`;
}

async function ensureFolder(drive, issueNumber, parentFolderId, expectedName, driveLink) {
  const existing = await findFolder(drive, issueNumber, parentFolderId);

  if (!existing && driveLink) {
    const byLink = await findFolderByLink(drive, driveLink, parentFolderId);
    if (byLink) {
      if (byLink.issueNumberMissing) {
        if (DRY_RUN) {
          console.log(
            `  [dry-run] Would set issue_number=${issueNumber} on folder '${byLink.name}' (${byLink.id})`
          );
        } else {
          await drive.files.update({
            fileId: byLink.id,
            requestBody: {
              appProperties: { ...(byLink.appProperties || {}), issue_number: String(issueNumber) },
            },
            fields: "id, name, webViewLink, appProperties",
          });
          console.log(
            `  Added issue_number=${issueNumber} to folder '${byLink.name}' (${byLink.id})`
          );
        }
      }

      return { id: byLink.id, name: byLink.name, url: byLink.url };
    }
  }

  if (!existing) {
    if (DRY_RUN) {
      console.log(`  [dry-run] Would create folder '${expectedName}'`);
      return { id: "dry-run", name: expectedName, url: "" };
    }

    const { data } = await drive.files.create({
      requestBody: {
        name: expectedName,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
        appProperties: { issue_number: String(issueNumber) },
      },
      fields: "id, name, webViewLink, appProperties",
    });

    console.log(`  Created folder '${expectedName}'`);
    return { id: data.id, name: data.name || "", url: data.webViewLink || "" };
  }

  if (existing.name !== expectedName) {
    if (DRY_RUN) {
      console.log(`  [dry-run] Would rename folder '${existing.name}' -> '${expectedName}'`);
      return { ...existing, name: expectedName };
    }

    const { data } = await drive.files.update({
      fileId: existing.id,
      requestBody: { name: expectedName },
      fields: "id, name, webViewLink, appProperties",
    });
    console.log(`  Renamed folder '${existing.name}' -> '${expectedName}'`);
    return { id: data.id, name: data.name || "", url: data.webViewLink || "" };
  }

  console.log(`  Folder OK: ${existing.name}`);
  return existing;
}

async function findFolder(drive, issueNumber, parentFolderId) {
  const query = `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='issue_number' and value='${issueNumber}' }`;
  const { data } = await drive.files.list({
    q: query,
    fields: "files(id, name, webViewLink, appProperties)",
    pageSize: 1,
  });
  const file = data.files?.[0];
  if (!file) return null;
  return { id: file.id, name: file.name || "", url: file.webViewLink || "" };
}

async function findFolderByLink(drive, driveLink, parentFolderId) {
  const folderId = getFolderIdFromLink(driveLink);
  if (!folderId) return null;

  const { data } = await drive.files.get({
    fileId: folderId,
    fields: "id, name, webViewLink, parents, appProperties",
    supportsAllDrives: true,
  });

  if (!data.id || !data.name || !data.webViewLink) return null;

  const parents = data.parents || [];
  if (!parents.includes(parentFolderId)) {
    console.warn(
      `  Folder ${data.name} (${data.id}) is not under parent ${parentFolderId} (parents: ${parents.join(",")})`
    );
  }

  const appProperties = data.appProperties || {};
  const issueNumberMissing = !appProperties.issue_number;

  return {
    id: data.id,
    name: data.name,
    url: data.webViewLink,
    appProperties,
    issueNumberMissing,
  };
}

function getFolderIdFromLink(link) {
  const match = link.match(/drive\/folders\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

async function loadTemplates(drive, templateFolderId) {
  const files = [];
  let pageToken;

  do {
    const { data } = await drive.files.list({
      q: `'${templateFolderId}' in parents and trashed=false`,
      fields: "nextPageToken, files(id, name, appProperties)",
      pageSize: 100,
      pageToken,
    });
    if (data.files) files.push(...data.files);
    pageToken = data.nextPageToken || undefined;
  } while (pageToken);

  return files.map((file) => {
    if (!file.appProperties?.template_kind) {
      throw new Error(`Template kind missing for template ${file.id}`);
    }
    return { id: file.id, name: file.name || "", templateKind: file.appProperties.template_kind };
  });
}

async function ensureFiles(drive, folderId, eventDate, templates) {
  for (const template of templates) {
    const expectedName = template.name.replace(/\[EVENT_DATE:YYYY-MM-DD\]/g, eventDate);
    const file =
      (await findFileByTemplate(drive, folderId, template.id)) ||
      (await findFileByName(drive, folderId, expectedName));

    if (file) {
      await reconcileFile(drive, file, expectedName, template);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] Would copy template ${template.id} -> ${expectedName}`);
      continue;
    }

    await drive.files.copy({
      fileId: template.id,
      requestBody: {
        name: expectedName,
        parents: [folderId],
        appProperties: {
          template_file_id: template.id,
          template_kind: template.templateKind,
        },
      },
      fields: "id, name, webViewLink, appProperties",
    });
    console.log(`  Copied template ${template.id} -> ${expectedName}`);
  }
}

async function findFileByTemplate(drive, folderId, templateId) {
  const query = `'${folderId}' in parents and trashed=false and appProperties has { key='template_file_id' and value='${templateId}' }`;
  const { data } = await drive.files.list({
    q: query,
    fields: "files(id, name, appProperties)",
    pageSize: 1,
  });
  const file = data.files?.[0];
  if (!file) return null;
  return {
    id: file.id,
    name: file.name || "",
    templateKind: file.appProperties?.template_kind || null,
    appProperties: file.appProperties || {},
  };
}

async function findFileByName(drive, folderId, name) {
  const escapedName = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const query = `'${folderId}' in parents and trashed=false and name='${escapedName}'`;
  const { data } = await drive.files.list({
    q: query,
    fields: "files(id, name, appProperties)",
    pageSize: 1,
  });
  const file = data.files?.[0];
  if (!file) return null;
  return {
    id: file.id,
    name: file.name || "",
    templateKind: file.appProperties?.template_kind || null,
    appProperties: file.appProperties || {},
  };
}

async function reconcileFile(drive, file, expectedName, template) {
  let updated = false;

  const needsTemplateProps =
    file.templateKind !== template.templateKind || !file.templateKind || !file.appProperties;

  if (needsTemplateProps) {
    if (DRY_RUN) {
      console.log(
        `  [dry-run] Would set template_kind for ${file.name} (${file.id}) -> ${template.templateKind}`
      );
    } else {
      await drive.files.update({
        fileId: file.id,
        requestBody: {
          appProperties: {
            template_file_id: template.id,
            template_kind: template.templateKind,
          },
        },
        fields: "id, name, appProperties",
      });
      console.log(
        `  Updated template_kind for ${file.name} (${file.id}) -> ${template.templateKind}`
      );
    }
    updated = true;
  }

  if (file.name !== expectedName) {
    if (DRY_RUN) {
      console.log(`  [dry-run] Would rename ${file.name} -> ${expectedName}`);
    } else {
      await drive.files.update({
        fileId: file.id,
        requestBody: { name: expectedName },
        fields: "id, name, appProperties",
      });
      console.log(`  Renamed ${file.name} -> ${expectedName}`);
    }
    updated = true;
  }

  if (!updated) {
    console.log(`  File OK: ${file.name}`);
  }
}

function loadCredentials() {
  if (process.env.GOOGLE_CREDENTIALS) {
    return JSON.parse(process.env.GOOGLE_CREDENTIALS);
  }

  if (fs.existsSync(DEFAULT_CREDENTIALS_PATH)) {
    return JSON.parse(fs.readFileSync(DEFAULT_CREDENTIALS_PATH, "utf8"));
  }

  throw new Error(
    `Provide GOOGLE_CREDENTIALS env or create ${DEFAULT_CREDENTIALS_PATH} with service account JSON`
  );
}

function getRepo() {
  return { owner: DEFAULT_REPO_OWNER, repo: DEFAULT_REPO_NAME };
}
