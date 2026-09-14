# jaystewart.co.uk

Source for [jaystewart.co.uk](https://jaystewart.co.uk) — engineering case studies
and notes.

The site is deliberately small: static HTML, no client-side framework, and
about five kilobytes of inline JavaScript in total — a theme toggle, a contents
scroll-spy and an analytics beacon, all hand-rolled. Everything below explains
why it is built the way it is, because the repository is public and is therefore
part of the portfolio.

## Stack

| Layer       | Choice                    | Why                                                                                                                        |
| ----------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Framework   | Astro 7                   | Real HTML per route. The previous site was a client-rendered SPA that served crawlers an empty div.                        |
| Content     | MDX + content collections | Long-form case studies with embedded diagram components, validated by a schema at build time.                              |
| Styling     | Tailwind CSS 4            | CSS-first config. One set of semantic colour tokens whose values swap by theme, so no component carries a `dark:` variant. |
| Type-safety | TypeScript strict         | Including `.astro` frontmatter.                                                                                            |
| Hosting     | GitHub Pages              | Static output, deployed by GitHub Actions.                                                                                 |

No UI library, no icon package, no analytics library, no client router.

## Architecture

```
src/
  content/          case studies and notes as MDX, schema-validated
  data/             site identity, experience, metrics
  components/       presentational Astro components, no client JS
    Analytics.astro the one exception — the inline PostHog beacon
    diagrams/       CSS architecture diagrams — real text, not images
  layouts/          Base (meta, JSON-LD), CaseStudy
  lib/              contrast maths, palette, metric resolution, analytics config
  pages/            routes; [...slug] for collections, rss.xml.ts for the feed
  styles/global.css design system: palette, base, components, prose
scripts/
  og.mjs            generate social images and icons
  check-stealth.mjs fail the build on names that must not be published
  check-links.mjs   fail the build on broken internal references
tests/
  a11y.spec.ts      axe + keyboard tests, every route, both themes
  layout.spec.ts    no sideways scroll at 320px and 390px
  analytics.spec.ts the beacon stays silent anywhere but production
```

### Four decisions worth explaining

**Every figure lives in one file, with its date.** The previous site quoted
"261 API endpoints" and "794 tests". Both were true when written and both had
drifted by the time anyone read them. `src/data/metrics.json` holds every
figure and a `countedAt` date the footer renders, so a reader sees how old a
number is. Content references a figure by key, so a renamed figure fails the
build rather than rendering `undefined`.

**The palette is tested.** `src/lib/contrast.test.ts` asserts every colour
pairing the design relies on against WCAG thresholds, in both themes, and
asserts that the values in `palette.ts` actually appear in `global.css` so the
two cannot drift. This caught a real defect during the build: the dark theme's
section band was a 1.04:1 step from the page background, effectively invisible.

**Names that cannot be published are checked by hash.** One case study
describes a company that has not announced itself. That constraint binds the
source, not just the rendered page — an MDX draft or an image filename leaks as
effectively as body copy. `scripts/check-stealth.mjs` scans file contents and
paths, tokenising camelCase and punctuation, and matches truncated SHA-256
digests rather than storing the words in plaintext in a public repository. It
runs in CI against both the source tree and `dist/`.

**Analytics is a hand-rolled beacon, not a library.** `Analytics.astro` is
about 4KB of inline JavaScript reporting to PostHog's capture API directly.
posthog-js was ruled out by the Lighthouse gate: the CI asserts zero unused
JavaScript and a 400KB page budget, and a ~200KB analytics bundle that runs
a fraction of itself fails both.

No cookies, and no identifier that outlives the visit — `distinct_id` and
`$session_id` live in `sessionStorage`, scoped to one tab and cleared when
it closes. Nothing here recognises a reader who returns tomorrow, and
nothing could, so "returning visitor" is permanently unavailable and the
site owes nobody a consent banner. Sessions use PostHog's own windows, 30
minutes idle and 24 hours maximum, so this site's idea of a session cannot
disagree with the views reading it.

That is a deliberate step past where the beacon started. The first version
minted a fresh UUID per pageview, which made every event its own anonymous
person — and so made funnels, sessions, bounce rate and path analysis not
merely absent but impossible, since PostHog joins all four on `distinct_id`.
It claimed in this file to make a `groundtruth.sh → site → /audit/` funnel
queryable; it never could. Counting pageviews was the only thing it could
ever do.

It now sends `$pageview` with referrer, viewport and any campaign
parameters — PostHog parses UTM tags in its client library, not on ingest,
so a beacon that omits them has no attribution at all — plus `$pageleave`,
which is what makes time-on-page and bounce rate computable, and two
conversion events for the mailto links and the outbound hand-off to
groundtruth.sh, neither of which loads a route where a pageview could see
it.

Reporting goes to the site's own PostHog project (`538067`) rather than the
shared groundtruth one. The cost of that split is real: PostHog has no
cross-project funnels, so the groundtruth.sh → site journey is now read as
referrer and channel data on this side rather than as a single funnel. The
embedded key is publishable by design — it can write events and never read
one — and the `location.hostname` guard keeps local builds, previews and
forks silent. `src/lib/analytics.test.ts` pins the key, because a valid key
for the wrong project is a failure nothing else in CI would notice.

## Local development

```sh
pnpm install
pnpm dev            # http://localhost:4321
pnpm build          # static output to dist/ (regenerates OG images first)
pnpm preview        # serve the production build
```

Node 22+, pnpm 11+.

## Verification

```sh
pnpm verify         # typecheck, lint, unit tests, stealth check, build, links
pnpm test:a11y      # axe + keyboard, 13 routes × 2 themes
pnpm test:lh        # Lighthouse budgets
```

`pnpm test:a11y` and `pnpm test:lh` need a browser:

```sh
pnpm exec playwright install --with-deps chromium
export CHROME_PATH=$(node -e "console.log(require('playwright-core').chromium.executablePath())")
```

Current results: Lighthouse 100 across performance, accessibility, best
practices and SEO on every audited route (99 performance on one), no axe
violations in either theme, and no framework runtime in the output.

## Updating content

**A case study or note** — add an `.mdx` file under `src/content/`. The schema
in `src/content.config.ts` is the contract; a missing field fails the build.
Diagram components (`Diagram`, `Row`, `Node`, `Arrow`) and `Figure` are
injected, so no imports are needed in the file.

**Figures** — edit `src/data/metrics.json` and set `countedAt` to the day the
figures were checked.

**A social image** — add an entry to the `pages` array in `scripts/og.mjs`.
The slug is the URL path with slashes replaced by hyphens, which is how
`Base.astro` finds it.

**Screenshots** — drop the image into `src/assets/media/`, import it, and pass
it to `<Figure src={…} alt="…" />`. Until then `Figure` renders a correctly
sized placeholder, so adding the real image shifts nothing.

`astro:assets` resizes and re-encodes at build time through sharp, which is a
direct devDependency rather than an inherited one: under pnpm, Astro resolves
sharp from the project root and cannot see the nested copy in its own
dependency tree. The build fails loudly if it is missing, so this is a note
about why the dependency is declared, not a warning about a silent failure.
Photographs are stripped of EXIF on the way in — the source files come off a
phone and carry device and location metadata into what is a public
repository.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`: build, stealth
check, link check, then publish to GitHub Pages. `public/CNAME` holds the
custom domain.

DNS for the apex domain needs `A` records to `185.199.108.153`,
`185.199.109.153`, `185.199.110.153` and `185.199.111.153` (plus the
equivalent `AAAA` records), with "Enforce HTTPS" enabled in the repository's
Pages settings.

## Licence

Code is MIT. Written content and case studies are © Jay Stewart — please do not
republish them as your own.
