# Prithagoras

**Mathematics, without limits.**

Prithagoras is an independently branded Australian HSC mathematics resource library. It is **not** Pri Learning, the separately operated India-focused educational technology platform.

## What's built

- Precision-designed responsive website in native HTML, CSS and JavaScript
- Original animated mathematical hero artwork
- Searchable collection with subject, year, and resource-type filters
- Keyboard-first quick search (`/` or Cmd/Ctrl+K on desktop)
- Resource details with permanent shareable URLs (`?resource=<id>`)
- Interactive sine transformation lab with adjustable amplitude and phase
- Real GitHub-based publishing studio (`studio.html`) that generates a complete new `resources.json` without handling credentials
- Automatic content integrity checks in GitHub Actions
- No analytics, cookies, tracking, advertising network or paid features in the first release

## Resource publishing: two commits

1. Open the **Publishing studio** on the website. Fill in the details and either enter a public HTTPS resource URL or select a local PDF.
2. Click **Generate publication package**.
3. If you selected a PDF, **upload that PDF** to [the repository's `materials/` directory](https://github.com/Priysharan19/prithagoras-web/upload/main/materials). This action is done in GitHub, not by the studio.
4. Copy the generated full JSON and replace the content of [`resources.json`](https://github.com/Priysharan19/prithagoras-web/edit/main/resources.json). Commit the change.
5. GitHub Pages updates the public collection. The publishing workflow is protected by **GitHub repository permissions**. Resource metadata can be prepared without an account, but only a repository collaborator with write access can publish.

**Important:** Do not edit `resources.json` concurrently from two open publishing-studio browser tabs; the later generated file will omit the earlier resource. Reload the studio after every publication. Every commit is versioned and reversible in GitHub.

**Important:** Publishing is not a direct-to-storage upload form. The page intentionally generates metadata for a GitHub commit. No browser tokens, OAuth secrets, or unsafe fake upload acknowledgements.

## Quality and rights

- Check questions, solutions, marking and syllabus mapping independently.
- Describe topic-specific papers honestly; do not imply every practice paper covers the full HSC course.
- Ensure the rights to any PDF, illustration, or third-party material before publishing.
- The current Bored of Studies link is external and the original resource may carry the former Pri Learning author label. Its detail view explicitly notes this.
- Prithagoras is not affiliated with NESA or any NSW school.
- Store published student-facing PDFs in `materials/`, not student submissions or personal data.

## Testing

No dependency install is needed for the static public site.

```bash
node --check script.js
node --check studio.js
node --test tests/*.test.mjs
python3 -m http.server 8341
```

Visit `http://127.0.0.1:8341`.

Never open `index.html` directly with `file://`: browsers block fetching `resources.json` that way.

## Deployment

The site supports GitHub Pages from the `main` branch, repository root, with no build command. The resource index is fetched at `./resources.json` and all site assets use relative paths, so it works on GitHub Pages under `/prithagoras-web/`. GitHub Pages deploys on pushes to `main` once enabled.

For future commercial tutoring services, custom domains, secure payments, student login or private upload storage, build a separate authenticated backend and use appropriate commercial hosting. The current site is a free public resource library and contains no paid checkout.

## Structure

```
index.html        Public website
script.js         Search, resource dialogs and interactive mathematics
styles.css        Responsive design system
studio.html       Publisher workspace
studio.js         Export of complete updated resource metadata
studio.css        Publisher styling
resources.json    Source of truth for all public resource entries
materials/        Hosted downloadable PDFs
tests/            Static integrity checks
```
