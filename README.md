# Prithagoras

**Independent Australian HSC mathematics resources and a private practice workspace.**

[Live website](https://priysharan19.github.io/prithagoras-web/) · [Exam Desk](https://priysharan19.github.io/prithagoras-web/desk.html) · [Publishing studio](https://priysharan19.github.io/prithagoras-web/studio.html)

Prithagoras is a separate Australian education project, **not** Pri Learning (the India-focused learning app). It is not affiliated with NESA or any NSW school.

## The product

- **Public resource library:** actual published papers, solutions and notes pulled from `resources.json`; live search, type filters and saved bookmarks. Empty categories are hidden, not padded with placeholders.
- **Keyboard command search:** `/` or `Cmd/Ctrl+K` searches resources and navigates to pages. Arrow keys and Enter work inside the command dialog.
- **Resource detail links:** `?resource=<id>` opens a shareable detail view with the source document and an Exam Desk link for examinations.
- **Exam Desk:** `desk.html?resource=<id>` reads exact exam configuration from the catalogue. Separate reading/working timers, pause/resume, question navigator, completed/flagged statuses, private per-question notes, progress tracking and JSON export.
- **Local privacy:** saved papers, notes and session progress are stored in the browser on the student's own device. No third-party analytics, student accounts, remote submissions or automated marking.
- **Publishing studio:** `studio.html` validates resource metadata and generates a version-controlled `resources.json` package for an authorised editor to commit. For exams, it includes actual reading/working minutes and question-section boundaries.

All public pages are dependency-free HTML, CSS and JavaScript. Session logic is isolated in `session-core.mjs` so mathematical/timekeeping behaviour can be unit tested.

## Publishing a paper (GitHub permissions required)

1. Open the [publishing studio](https://priysharan19.github.io/prithagoras-web/studio.html). Enter title, year, subject, description, marks and question count. For examinations enter reading and working minutes, and the number of multiple-choice questions (if any).
2. Enter a public HTTPS file link **or** choose a local PDF. Selecting a file does **not** upload it.
3. Generate the publication package. The studio validates the metadata and produces the complete updated `resources.json`.
4. If a PDF was selected, upload it through the repository's [`materials/` folder](https://github.com/Priysharan19/prithagoras-web/upload/main/materials). This is a GitHub operation under your authenticated account, not the public website.
5. Commit the generated JSON in [`resources.json`](https://github.com/Priysharan19/prithagoras-web/edit/main/resources.json). GitHub Pages publishes it when the deployment succeeds.

**Concurrency:** Reload the studio before every new publication. A package generated from an older catalogue might overwrite a newer editor's resource if manually committed without review. Git history allows recovery.

**PDF integrity:** Ensure that the file in `materials/` matches the metadata and has the correct rights and academic review. Publication checks reject missing hosted PDFs.

**No direct authenticated uploads:** This is not yet a one-click online CMS. It deliberately does not ask visitors to paste GitHub personal access tokens into a public site. Future instant publishing requires an authenticated server-side GitHub integration or managed CMS.

## Exam Desk behaviour

The first linked examination is the 2027 HSC Mathematics Advanced 100-mark practice paper: 10 multiple-choice questions and 17 extended-response questions; a 10-minute reading session and 180-minute working session. This metadata represents the paper described in the linked resource; it must be updated if the source document changes.

When a student opens the desk:

- The timer starts only on explicit action. Reading time ending stops at a **Ready to work** state; it does not automatically start working time.
- Running countdowns use a deadline based on the device clock, not `setInterval` increments. Reloading or hiding the browser tab cannot slow the clock.
- Paused countdowns retain remaining time. Starting a new attempt requires explicit Reset confirmation.
- Question statuses (done, flagged, untouched) and notes are saved separately for each resource using a versioned localStorage key.
- Export downloads a local JSON attempt record. It is **not** a grading result.
- Keyboard shortcuts: Left/Right to change questions, D to mark done, F to flag, N to focus notes, ? for help (when not typing).

No answers, question text or marking data are fabricated. Students open the actual PDF or external paper alongside the workspace.

## File layout

```text
index.html               Public landing page, command search, library
styles.css               Brand and responsive public site
script.js                Search, bookmarks, resource details
desk.html                Focused examination workspace
desk.css                 Desktop/tablet/mobile workspace UI
desk.js                  Student interaction, timer and local persistence
session-core.mjs         Pure, testable session state machine
studio.html              Editor/publication form
studio.css               Editorial workspace styling
studio.js                Validated publication package generator
resources.json           Published resource source of truth
materials/               PDF files in GitHub
tests/                   Resource and session correctness tests
.github/workflows/       Pull-request and main-branch validation
```

## Local testing

```bash
node --check script.js
node --check desk.js
node --check session-core.mjs
node --check studio.js
node --test tests/*.test.mjs
python3 -m http.server 8341
```

Open `http://127.0.0.1:8341/`. Do not use `file://`; browsers block loading `resources.json` via file URLs.

Desktop and mobile browser testing should cover: command search, saved filters, resource dialog and links, Exam Desk timer transitions, refresh/reload, per-question note isolation, export and the publication form. Test at 320, 390, 768 and 1440 pixels before a significant design release.

## Boundaries and release policy

- No fabricated resources, fake user counts or false syllabus certification.
- Do not present a school-specific Task 1 paper as an official whole-course HSC trial.
- The first external Bored of Studies file may still bear its old Pri Learning attribution. The resource disclaimer makes that provenance explicit until the PDF is updated.
- The project currently relies on GitHub Pages for free **public resources**, not payment or student accounts.
- Add an appropriate authenticated backend, privacy policy and hosting arrangements before introducing paid tutoring subscriptions or personal-data collection.
