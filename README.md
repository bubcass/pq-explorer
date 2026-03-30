# PQ Explorer

PQ Explorer is a static, data-driven web app for exploring parliamentary questions (PQs) published through the Oireachtas open data API.

It is built with Observable Framework and uses a precomputed data pipeline so the site stays fast and lightweight in the browser. Rather than loading one large dataset at runtime, the project generates smaller JSON and CSV outputs ahead of time for each page and interaction pattern.

## What the project does

PQ Explorer is designed to help users explore parliamentary questions from a few complementary angles:

- **Overview** — a high-level view of parliamentary questions by year and question type
- **Deputies** — explore questions by individual Member
- **Parties** — compare question activity across political parties
- **Constituencies** — constituency-focused exploration page scaffold, ready for custom visualisations

The site is intended as an open data product: readable, interactive and lightweight, with downloadable datasets where appropriate.

## Tech stack

- **Observable Framework** for the static site
- **Node.js** for build scripts and data generation
- **D3/Observable Plot  components** for charts and interaction
- **GitHub Actions** for deployment and scheduled data refresh
- **GitHub Pages** for hosting

## Project structure

A simplified structure looks like this:

```text
.
├── src/
│   ├── components/          # reusable chart and UI components
│   ├── data/
│   │   └── pq/
│   │       ├── 2025/
│   │       └── 2026/
│   ├── generated/           # generated helper files (where used)
│   ├── index.md             # overview page
│   ├── deputies.md          # deputy page
│   ├── parties.md           # parties page
│   ├── constituencies.md    # constituencies page
│   └── media/
├── scripts/
│   └── pq/                  # data build scripts / transformers
├── .github/
│   └── workflows/           # deploy and refresh workflows
└── dist/                    # built output
```

## Data model and build approach

The app relies on a precomputed data pipeline.

The source data is fetched from the Oireachtas open data API, then transformed into smaller page-specific outputs. This keeps page performance much better than loading a large flat dataset directly in the browser.

Examples of generated outputs include:

- `flat.json`
- `flat-enriched.json`
- `summary-all.json`
- `summary-oral.json`
- `rollup-deputies.json`
- `packed-circle-hierarchy-*.json`
- `treemap-hierarchy-*.json`
- deputy-level JSON detail files
- downloadable CSV files

These generated files live under `src/data/pq/{year}/...`.

## Local development

Install dependencies:

```bash
npm ci
```

Build the data outputs:

```bash
npm run build:data
```

Start the local development server:

```bash
npm run dev
```

## Build for production

Generate the data and build the site:

```bash
npm run build:data
npm run build
```

Some page features, especially deputy-level detail files, also require the post-build copy step used for deployment:

```bash
node scripts/pq/copy-deputy-json-to-dist.js
```

## Deployment

The site is deployed to GitHub Pages via GitHub Actions.

The deploy workflow:

1. installs dependencies
2. runs the data build
3. builds the site
4. copies deputy JSON files into `dist/data/...`
5. uploads `dist` to GitHub Pages

## Scheduled data refresh

The long-term operating model is:

- page code and components remain relatively stable
- data outputs are refreshed automatically on a schedule
- the refreshed data is committed and redeployed

In practice, the key automated step is:

```bash
npm run build:data
```

A nightly GitHub workflow can run this, commit any changed data files, and trigger the normal deploy workflow.

## Current page pattern

The project has settled into a reusable page architecture:

- shared hero/header treatment
- shared year / question type controls
- precomputed JSON inputs for each page
- lightweight client-side state
- selective progressive rendering for heavier charts

This makes it easier to add new pages without rethinking the whole pipeline each time.

## Data source

Data are derived from the **Oireachtas open data API** and related Oireachtas open data resources.

Primary public entry points include:

- Oireachtas open data API
- Oireachtas parliamentary questions pages
- published Member and parliamentary record resources

## Design principles

This project is guided by a few simple principles:

- **open data first**
- **web-first publishing**
- **fast initial load**
- **precompute where possible**
- **keep interaction simple for non-technical users**
- **make datasets downloadable**

## Notes for future development

Likely next steps include:

- dedicated transformers for party and constituency pages
- constituency-specific visual components
- further progressive rendering for heavier visualisations
- clearer freshness / “last updated” indicators
- additional page-level summaries and downloadable outputs

## Commands

Typical commands used in the project:

```bash
npm ci
npm run build:data
npm run dev
npm run build
node scripts/pq/copy-deputy-json-to-dist.js
```

## License / reuse


## Acknowledgement

PQ Explorer is built as an open data exploration project using parliamentary question data published by the Houses of the Oireachtas on its open data platform.

## About Observable Framework

The project uses [Observable Framework](https://observablehq.com/framework/) app. To install the required dependencies, run:

```
npm install
```

Then, to start the local preview server, run:

```
npm run dev
```

Then visit <http://localhost:3000> to preview the project.

For more, see <https://observablehq.com/framework/getting-started>.

### Project structure

A typical Framework project looks like this:

```ini
.
├─ src
│  ├─ components
│  │  └─ timeline.js           # an importable module
│  ├─ data
│  │  ├─ launches.csv.js       # a data loader
│  │  └─ events.json           # a static data file
│  ├─ example-dashboard.md     # a page
│  ├─ example-report.md        # another page
│  └─ index.md                 # the home page
├─ .gitignore
├─ observablehq.config.js      # the app config file
├─ package.json
└─ README.md
```

**`src`** - This is the “source root” — where your source files live. Pages go here. Each page is a Markdown file. Observable Framework uses [file-based routing](https://observablehq.com/framework/project-structure#routing), which means that the name of the file controls where the page is served. You can create as many pages as you like. Use folders to organize your pages.

**`src/index.md`** - This is the home page for your app. You can have as many additional pages as you’d like, but you should always have a home page, too.

**`src/data`** - You can put [data loaders](https://observablehq.com/framework/data-loaders) or static data files anywhere in your source root, but we recommend putting them here.

**`src/components`** - You can put shared [JavaScript modules](https://observablehq.com/framework/imports) anywhere in your source root, but we recommend putting them here. This helps you pull code out of Markdown files and into JavaScript modules, making it easier to reuse code across pages, write tests and run linters, and even share code with vanilla web applications.

**`observablehq.config.js`** - This is the [app configuration](https://observablehq.com/framework/config) file, such as the pages and sections in the sidebar navigation, and the app’s title.

### Command reference

| Command           | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `npm install`            | Install or reinstall dependencies                        |
| `npm run dev`        | Start local preview server                               |
| `npm run build`      | Build your static site, generating `./dist`              |
| `npm run deploy`     | Deploy your app to Observable                            |
| `npm run clean`      | Clear the local data loader cache                        |
| `npm run observable` | Run commands like `observable help`                      |
