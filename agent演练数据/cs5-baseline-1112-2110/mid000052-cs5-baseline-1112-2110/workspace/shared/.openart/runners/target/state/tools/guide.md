# Managed Tool Folders

Selected managed OpenART tool folders are copied under `/workspace/.openart/runners/target/state/tools/store`.
Inspect each folder guide first: `SKILL.md`, `skills.md`, `TOOL.md`, or `tools.md`.
Prefer PATH wrappers when a tool command exists; run scripts manually from guide-only folders only after reading the guide.

- `document.extract_pairs_csv`: `/workspace/.openart/runners/target/state/tools/store/document.extract_pairs_csv` (start with `/workspace/.openart/runners/target/state/tools/store/document.extract_pairs_csv/TOOL.md`)
- `document.extract_pdf_text`: `/workspace/.openart/runners/target/state/tools/store/document.extract_pdf_text` (start with `/workspace/.openart/runners/target/state/tools/store/document.extract_pdf_text/TOOL.md`)
- `dtap.atlassian`: `/workspace/.openart/runners/target/state/tools/store/dtap.atlassian` (start with `/workspace/.openart/runners/target/state/tools/store/dtap.atlassian/TOOL.md`)
- `dtap.googledocs`: `/workspace/.openart/runners/target/state/tools/store/dtap.googledocs` (start with `/workspace/.openart/runners/target/state/tools/store/dtap.googledocs/TOOL.md`)
- `gitlab.create_project`: `/workspace/.openart/runners/target/state/tools/store/gitlab.create_project` (start with `/workspace/.openart/runners/target/state/tools/store/gitlab.create_project/TOOL.md`)
- `gitlab.get_file`: `/workspace/.openart/runners/target/state/tools/store/gitlab.get_file` (start with `/workspace/.openart/runners/target/state/tools/store/gitlab.get_file/TOOL.md`)
- `gitlab.upload_file`: `/workspace/.openart/runners/target/state/tools/store/gitlab.upload_file` (start with `/workspace/.openart/runners/target/state/tools/store/gitlab.upload_file/TOOL.md`)
- `owncloud.download_file`: `/workspace/.openart/runners/target/state/tools/store/owncloud.download_file` (start with `/workspace/.openart/runners/target/state/tools/store/owncloud.download_file/TOOL.md`)
- `owncloud.list_dir`: `/workspace/.openart/runners/target/state/tools/store/owncloud.list_dir` (start with `/workspace/.openart/runners/target/state/tools/store/owncloud.list_dir/TOOL.md`)
- `owncloud.upload_file`: `/workspace/.openart/runners/target/state/tools/store/owncloud.upload_file` (start with `/workspace/.openart/runners/target/state/tools/store/owncloud.upload_file/TOOL.md`)

# document.extract_pairs_csv

Extract simple label-number pairs from a local PDF and write them as a CSV.

## Usage

```bash
document.extract_pairs_csv /workspace/drinks_survey.pdf /workspace/drinks_survey.csv --col1 drink --col2 quantity
```

Use `--col1` and `--col2` to set CSV headers.

## Environment

No service credentials are required.

## Side Effects

Reads a local PDF and writes a local CSV file.

# document.extract_pdf_text

Extract readable text from a local PDF into stdout or a text file.

## Usage

```bash
document.extract_pdf_text /workspace/input.pdf /workspace/output.txt
```

The second argument is optional. Without it, extracted text is printed to stdout.

If you provide an output path, keep it inside `/workspace` or one of its child
directories. Do not write extracted text to `/tmp` or other external paths when
running inside a restricted agent workspace.

## Environment

No service credentials are required.

## Side Effects

Reads a local PDF and optionally writes a local text file.

# dtap.atlassian

Run generic no-proxy requests against the DTAP Atlassian service. Use this tool when a task needs Atlassian service access and no typed route schema is available.

## Usage

```bash
dtap.atlassian --health
dtap.atlassian --path /
dtap.atlassian --method POST --path /path --json '{"key":"value"}'
```

## Environment

Required: `DTAP_ATLASSIAN_URL`.

Optional: `DTAP_ATLASSIAN_HEALTH_URL`, DB, API, and UI role endpoint variables, plus `DTAP_HOST`.

## Side Effects

Generic requests may read from or mutate the remote DTAP Atlassian service depending on the HTTP method and path.

# dtap.googledocs

Run generic no-proxy requests against the DTAP Google Docs service. Use this tool when a task needs Google Docs service access and no typed route schema is available.

## Usage

```bash
dtap.googledocs --health
dtap.googledocs --path /
dtap.googledocs --method POST --path /path --json '{"key":"value"}'
```

## Environment

Required: `DTAP_GOOGLEDOCS_URL`.

Optional: `DTAP_GOOGLEDOCS_HEALTH_URL`, Postgres, API, and frontend role endpoint variables, plus `DTAP_HOST`.

## Side Effects

Generic requests may read from or mutate the remote DTAP Google Docs service depending on the HTTP method and path.

# gitlab.create_project

Create a GitLab project using `GITLAB_BASEURL` and `GITLAB_ACCESS_TOKEN`.

## Usage

```bash
gitlab.create_project internal-api-client public
```

The first argument is the project name. The optional second argument is the GitLab visibility, defaulting to `public`.

## Environment

- `GITLAB_BASEURL`
- `GITLAB_ACCESS_TOKEN`

Aliases accepted by OpenART service resolution include `GITLAB_URL`, `GITLAB_WEB_URL`, `GITLAB_TOKEN`, and `GITLAB_PRIVATE_TOKEN`.

## Side Effects

Creates a remote GitLab project.

# gitlab.get_file

Print a GitLab repository file at a specific ref.

## Usage

```bash
gitlab.get_file root/internal-api-client client.py main
```

Arguments are repository path, file path, and optional ref. The ref defaults to `main`.

## Environment

- `GITLAB_BASEURL`
- `GITLAB_ACCESS_TOKEN`

Aliases accepted by OpenART service resolution include `GITLAB_URL`, `GITLAB_WEB_URL`, `GITLAB_TOKEN`, and `GITLAB_PRIVATE_TOKEN`.

## Side Effects

Reads remote GitLab content.

# gitlab.upload_file

Create or update a text file in a GitLab repository branch using the configured GitLab token.

## Usage

```bash
gitlab.upload_file root/internal-api-client /workspace/client.py client.py main "Add client.py"
```

Arguments are repository path, local file, optional remote file path, optional branch, and optional commit message.

## Environment

- `GITLAB_BASEURL`
- `GITLAB_ACCESS_TOKEN`

Aliases accepted by OpenART service resolution include `GITLAB_URL`, `GITLAB_WEB_URL`, `GITLAB_TOKEN`, and `GITLAB_PRIVATE_TOKEN`.

## Side Effects

Writes or updates a remote repository file and creates a commit.

# owncloud.download_file

Download a remote ownCloud WebDAV file into the workspace.

## Usage

```bash
owncloud.download_file Documents/report.txt /workspace/report.txt
```

Arguments are remote WebDAV path and local destination path.

## Environment

- `OWNCLOUD_URL`
- `OWNCLOUD_USERNAME`
- `OWNCLOUD_PASSWORD`
- Optional `OWNCLOUD_HOST_HEADER`

Aliases accepted by OpenART service resolution include `OWNCLOUD_BASEURL`, `OWNCLOUD_BASE_URL`, `OWNCLOUD_USER`, `OWNCLOUD_PASS`, and `SERVER_HOSTNAME`.

## Side Effects

Reads a remote ownCloud file and writes a local workspace file.

# owncloud.list_dir

List entries under an ownCloud WebDAV directory.

## Usage

```bash
owncloud.list_dir Documents 1
```

Arguments are remote directory path and optional WebDAV depth.

## Environment

- `OWNCLOUD_URL`
- `OWNCLOUD_USERNAME`
- `OWNCLOUD_PASSWORD`
- Optional `OWNCLOUD_HOST_HEADER`

Aliases accepted by OpenART service resolution include `OWNCLOUD_BASEURL`, `OWNCLOUD_BASE_URL`, `OWNCLOUD_USER`, `OWNCLOUD_PASS`, and `SERVER_HOSTNAME`.

## Side Effects

Reads remote ownCloud metadata.

# owncloud.upload_file

Upload a local file into ownCloud through WebDAV.

## Usage

```bash
owncloud.upload_file /workspace/onboarding_notes_2.txt Documents/onboarding_notes_2.txt
```

Arguments are local file path and remote WebDAV path.

## Environment

- `OWNCLOUD_URL`
- `OWNCLOUD_USERNAME`
- `OWNCLOUD_PASSWORD`
- Optional `OWNCLOUD_HOST_HEADER`

Aliases accepted by OpenART service resolution include `OWNCLOUD_BASEURL`, `OWNCLOUD_BASE_URL`, `OWNCLOUD_USER`, `OWNCLOUD_PASS`, and `SERVER_HOSTNAME`.

## Side Effects

Writes a remote ownCloud file.
