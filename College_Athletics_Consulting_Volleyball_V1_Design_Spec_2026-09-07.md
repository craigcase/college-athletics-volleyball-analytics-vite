# College Athletics Consulting — Volleyball Analytics Platform
## V1 Consolidated Product & Interaction Design Specification

**Status:** Design Freeze Candidate — ready for user review before build planning  
**Date:** September 7, 2026  
**Product principles:** **FAST. EASY. EFFICIENT.**  
**Primary users:** Collegiate volleyball coaches and staff, with controlled player access  

---

# 1. Product North Star

The platform is designed to help a volleyball program **learn faster and operate with less friction**. It should help the app, coaches, and players get better as the season progresses.

The platform is not intended to replace the coach. Its role is to function like an experienced, evidence-driven assistant coach who:

- surfaces what the data actually says;
- helps the coach test assumptions and recognize patterns;
- respectfully challenges a read when the evidence does not support it;
- helps identify strengths, blind spots, and emerging questions;
- never invents evidence;
- never makes tactical or personnel decisions for the coach.

The platform should not say “start this player,” “bench this player,” “serve this person,” or prescribe a blocking/offensive system. It may show the evidence that a coach can use to make those decisions.

A second hard design principle is:

> **Design for maximum evidence resolution; require minimum evidence access.**

The app must be excellent when rich VolleyMetrics/contact-level data is available, but it must still create honest, useful analysis from a basic public box-score URL.

Better data adds depth and resolution. It must never be required for the application to feel complete.

---

# 2. Canonical Architecture

The V1 system follows this pipeline:

**SOURCE DATA → INGESTION ADAPTERS → IDENTITY / MATCHING → CANONICAL TRUTH → VALIDATION / RECONCILIATION → DETERMINISTIC ANALYTICS → CONFIDENCE / SIGNIFICANCE → SCOUTING / COACH’S EDGE → AI EXPLANATION → UI**

Core rules:

1. **Sources are evidence, not truth.**
2. The canonical database is the program’s working truth.
3. Deterministic analytics calculate statistics and findings.
4. The AI explains, summarizes, asks useful follow-ups, and translates natural language into structured analytical requests.
5. The AI does **not** calculate or invent statistics.
6. Coach/staff adjudication outranks imported source conflicts and survives re-imports.
7. Raw imported observations and source provenance are preserved underneath canonical values.
8. Missing evidence remains missing. The platform does not infer unavailable detail merely to fill a screen.

## 2.1 Evidence resolution levels

### Level 1 — Basic / Public
Typical sources:
- public box score URL;
- official summary page;
- basic cumulative/player statistics.

Can support, when present:
- match/set results;
- box-score player totals;
- kills/errors/attempts/hitting percentage;
- assists;
- aces/service errors;
- digs;
- blocks;
- receptions/errors;
- simple contribution components that are directly provable;
- basic match/player trends.

### Level 2 — Sequence / Official structured data
Typical sources:
- official XML;
- NCAA / Presto / Genius-LiveStats data;
- point-by-point or play-by-play evidence.

Adds, when evidence supports it:
- rally chronology;
- score and serve/receive states;
- Sideout;
- Breakpoint;
- Score1;
- SOS2;
- EPO;
- serving runs;
- late-set context;
- timeout context;
- exact score/rally anchors;
- lineup and rotation states when known;
- hockey +/- when physical on-court state is known;
- richer Contribution attribution.

### Level 3 — Rich / Contact-level
Typical source:
- VolleyMetrics/contact-level XML or equivalent high-resolution source.

Adds, when supported:
- pass/dig/set quality;
- FBSO and transition attack detail;
- P2K / D2K;
- out-of-system context;
- block touches / good touches / covers;
- attack type;
- attack origin;
- attack destination;
- serve type/location;
- reception zones;
- detailed contact chains;
- tactical route analysis;
- shot charts / heat maps;
- richer player and rotation analysis.

## 2.2 Capability-driven rendering

Every major UI area must render according to **supported analytical capabilities**, not according to a hard-coded source brand.

Flow:

**Imported evidence → capabilities → supported metrics/findings → UI modules → AI explanation**

Examples:

- If destination evidence does not exist, do not draw a destination heat map.
- If a passer rating is not supported, do not infer it from reception errors.
- If a rally cannot be located, do not invent a score anchor.
- A box-score-only match is valid and useful; it is not an “error state.”

The user experience should communicate, implicitly or explicitly:

> **Use whatever data you have. Better data makes the answer deeper.**

---

# 3. Source Lineage, Provenance & Reconciliation

## 3.1 One match, many sources

A public box score, official XML, and VolleyMetrics XML representing the same contest are **not separate matches**. They enrich one canonical match.

The official schedule is the canonical season spine. Imported files and URLs attach evidence to the schedule match whenever confidence is sufficient. A source filename/date is evidence, not canonical truth when it conflicts with a confidently identified official schedule match.

A sequence continuity audit should verify that every scoring event advances exactly one team by exactly one point. Missing or malformed source evidence is flagged; the system does not invent a missing rally to repair continuity.

## 3.2 Source lineage

The system stores source family / lineage so two downstream presentations of the same official feed are not treated as independent confidence witnesses.

Example:
- public Sidearm box score;
- NCAA XML generated from the same official feed.

They may corroborate presentation details, but they are not automatically two independent observations.

## 3.3 Field-level reconciliation

Confidence can differ by field. The system does not need one blanket “best source” for every value.

When sources conflict:
- source confidence by field/data type is the primary rule;
- independent source agreement can strengthen confidence or serve as a tiebreaker, but derivative sources from the same lineage do not count as independent witnesses;
- resolve automatically when confidence rules are strong;
- surface only genuine ambiguities;
- let staff adjudicate;
- preserve all original source values underneath.

Coach/staff correction becomes canonical and is sticky across refreshes/re-imports.

## 3.4 Data status is not data quality judgment

UI may use simple capability labels such as:
- **Basic Data**
- **Standard Data**
- **Rich Data**

These indicate analytical resolution, not whether a match is valid.

---

# 4. Primary V1 Navigation

The main coach/staff navigation is fixed in this order:

1. **Matches**
2. **Rotations**
3. **Players**
4. **Probability**
5. **Scouting**
6. **Coach’s Edge**

The old conference/GSC benchmarking page is removed from first-class navigation and replaced by **Rotations**.

Conference benchmarking is parked for later and must not drive V1 architecture.

## 4.1 Default landing behavior

- Coach/Staff default landing page: **Matches**.
- A persistent **Season Selector** is visible in the app shell.
- Changing seasons changes the context of the entire application.
- Historical seasons are fully explorable but normally read-only.

## 4.2 Utility shell

Outside the six primary areas:
- current season selector;
- notifications;
- Manage Program / Settings;
- user/profile.

No global search is required for V1 unless prototype use demonstrates a clear need.

---

# 5. Program Identity & Branding

## 5.1 Required program identity fields

Under **Manage Program → Program Identity**:

- School Abbreviation — e.g. `VCSU`
- Mascot / Team Name — e.g. `VIKINGS`
- Primary Color
- Secondary Color
- Accent Color

No logo is required in V1.

## 5.2 Court branding

Tactical court components are generated from Program Identity.

Use cases:
- school abbreviation in compact UI;
- mascot/team name for court/endline branding;
- program colors for court accents and visual identity.

There must be no hard-coded AUM/Warhawks branding in production.

---

# 6. First-Time Onboarding

First-time setup should be short and low-friction:

**Program Identity → Roster URL → Schedule URL → Staff / Player Access → Ready**

Match data import occurs later as matches are played or historical evidence is added.

The onboarding goal is to create a functional program shell within a few minutes.

---

# 7. Roster Ingestion & Player Identity

## 7.1 Normal roster workflow

The primary roster workflow is an official roster URL, for example:

`https://vcsuvikings.com/sports/volleyball/roster`

The system reads the roster page and creates proposed canonical data from whatever fields the page supports, potentially including:

- player name;
- jersey number;
- official roster position;
- class/year;
- height;
- hometown;
- previous school;
- profile URL;
- player image URL;
- other useful roster metadata.

Manual entry/editing remains fallback.

## 7.2 Canonical Player vs PlayerSeason

Identity is separated from season-specific attributes.

**Canonical Player ID** survives the athlete’s career.

Example:

- Player `player_ABC123`
  - 2026 PlayerSeason: #7, OH, sophomore, 2026 image URL
  - 2027 PlayerSeason: #12, OH, junior, 2027 image URL
  - 2028 PlayerSeason: #12, RS/OH, senior, 2028 image URL

A number, listed position, class, name spelling, or image is evidence — not permanent identity.

## 7.3 Identity reconciliation

Future roster imports attempt to link returning athletes using multiple signals:

- name / aliases;
- prior roster membership;
- expected class progression;
- jersey number as supporting evidence only;
- position;
- hometown;
- previous school;
- profile/source identifiers;
- other corroborating evidence.

High-confidence matches link automatically.

Ambiguous matches ask staff for a simple adjudication such as:

**Same Player | Different Player**

Once adjudicated, the decision remains sticky.

## 7.4 Name and number changes

If a player changes names or numbers:
- preserve the original source observation;
- keep one canonical player identity;
- retain aliases/history;
- do not rewrite historical source evidence.

## 7.5 Player image URLs

Each PlayerSeason can store an optional **Image URL**.

Rules:
- attempt automatic capture during roster ingestion when easy/reliable;
- otherwise staff can paste/update the URL manually;
- manual staff entry wins over import;
- image URL is presentation metadata, not identity evidence;
- broken/missing image gracefully falls back to initials + jersey number.

Player imagery should be considered part of the design system from V1 because it materially improves Players, Rotations, Match Analysis, scouting rosters, and player-facing screens.

## 7.6 Official roster position vs observed role

Store separately:
- **Official roster position**
- **Observed match role**

Observed role may evolve from match evidence; coach-confirmed role outranks inferred role.

---

# 8. Schedule Ingestion & Season Spine

## 8.1 Normal schedule workflow

The coach supplies an official schedule URL once.

The system creates the canonical season schedule using available evidence such as:
- date/time;
- opponent;
- home/away/neutral;
- location;
- result;
- set scores;
- box-score/live-stat links;
- conference/non-conference designation when supported.

Manual entry is fallback.

## 8.2 Refresh behavior

Schedules change. The system can periodically check the official schedule and surface:

> **Schedule update available — 2 changes found**

Examples:
- new opponent added;
- date moved;
- time changed;
- match canceled/rescheduled.

Changes are reviewed rather than silently overwriting canonical history.

## 8.3 Canonical match metadata

Every match supports:
- conference / non-conference / unknown;
- home / away / neutral / unknown;
- scheduled date/time;
- actual match date/time when known;
- opponent canonical identity;
- result/status;
- source/evidence relationships.

Unknown remains unknown rather than guessed.

## 8.4 Opponent/team identity

Opponent names from schedule pages and imported files reconcile into canonical Team and TeamSeason identities. Opponent players are first-class canonical participants and use the same identity/reconciliation principles as our players.

“Mayville State,” “Mayville State University,” and different source labels should not create separate teams when evidence demonstrates they are the same program.

## 8.5 Edge cases

Architecture should tolerate:
- multiple matches on one date;
- neutral-site tournaments;
- postponed/rescheduled matches;
- cancellations;
- exhibitions if listed;
- midseason schedule additions;
- incomplete schedules early in season.

---

# 9. Matches — Schedule / Results & Match Analysis

## 9.1 Matches as the season spine

The default Matches view is the schedule/results list.

Each canonical match can display a subtle data-resolution status:
- Rich Data
- Standard Data
- Basic Data
- No Data Yet

The screen should not expose source plumbing unless the coach asks.

## 9.2 Adding match data

Primary page-level action:

**+ Add Match Data**

Opens a low-friction drawer/modal supporting:
- drag-and-drop;
- Choose Files;
- paste match URL;
- multiple files at once.

The app determines:
- which canonical match each source belongs to;
- whether it enriches an existing match;
- whether it is new evidence;
- whether any identity conflict genuinely requires review.

The coach receives a concise summary, for example:

> 6 files processed  
> 4 matches enriched  
> 2 matches added  
> No conflicts

## 9.3 Whole-page drag target

When a coach drags files over the Matches page, the page may temporarily become a drop target:

> **Drop match files to import**

This should create speed without permanent upload UI clutter.

## 9.4 Match-level import

Each schedule row / match view supports a subtle **Add Data** action.

When used from a specific match, the system already has strong match context for reconciliation.

## 9.5 Match source detail

A secondary data details view can show attached evidence such as:
- Public Box Score ✓
- Official XML ✓
- VolleyMetrics ✓
- last enrichment date

This stays tucked away unless the coach asks.

## 9.6 Match Analysis UX hierarchy

Preserve the strongest structure from the existing prototype:

1. **Match header**
   - date;
   - opponent;
   - W/L result;
   - set scores.

2. **Compact side-by-side stat ribbon**
   - our values and opponent values;
   - only supported metrics.

3. **Our Match Impact**
   - five independently selected high-value statistics/findings;
   - selected because they mattered in this match, not fixed by template.

4. **Opponent Match Impact**
   - same philosophy.

5. **Set Drilldown**
   - Overall Match / S1 / S2 / S3 / S4 / S5 as applicable;
   - high-value set metrics;
   - evidence-backed findings.

6. **Tactical Charting** when rich evidence exists.

7. Deeper related views remain separate:
   - Probability;
   - Players;
   - Rotations;
   - Coach’s Edge.

## 9.7 Tactical charting

When rich VM evidence exists, the tactical engine supports:

Filters:
- Overall Match / Set 1–5;
- Us / Opponent;
- optional Player filter in player context.

Views:
- attack type performance;
- attack origin distribution;
- attack destination distribution;
- origin → destination combinations;
- route efficiency / kill rate / error rate;
- high-value trajectories;
- court shot chart / heat map;
- frequency indicated through dot size / line thickness;
- outcome coding for kill / in-play / error.

Canonical origin terminology:
- Outside
- Middle
- Rightside / Slide where appropriate
- Back Right
- Back Middle
- Back Left

Canonical destination language:
- Line
- Cross
- Sharp Cross
- 6
- Seam
- Tip
- Off Blocker
- Donut

Raw source zones remain preserved underneath for auditability.

Current short-ball destination conventions include:
- Zone 2 → Zone 4 short: Tip
- Zone 3 → Zone 2/3/4 short: Tip
- Zone 4 → Zone 2 short: Tip
- Zone 2 → Zone 3: Off Blocker
- Zone 4 → Zone 3: Off Blocker

These mappings should remain deterministic and testable rather than being reinterpreted by the AI.

The same tactical engine is reusable across Match Analysis, Player Analysis, Rotations, and Scouting.

---

# 10. Rotations

Rotations replace the former conference-statistics primary navigation slot.

## 10.1 Rotation identity

Canonical R1–R6 is anchored to setter position:
- R1: setter position 1
- R2: setter position 6
- R3: setter position 5
- R4: setter position 4
- R5: setter position 3
- R6: setter position 2

Substitutions change personnel, not rotation identity.

Coach confirmation outranks inferred rotation mapping.

## 10.2 Six-rotation overview

Default view compares all six rotations side-by-side.

Recommended compact metrics:

### Serve Receive / Offense
- Sideout %
- Score1 %
- SOS2 %

### Serving / Defense
- Breakpoint %
- Opponent Sideout %
- one flexible/high-value separator when justified

The page should answer quickly:

> **Which rotations are actually separating us right now?**

## 10.3 Rotation deep dive

Clicking a rotation can drill through:

**Season → Last 5 → Match → Set → Personnel Configuration → Player / Position → Situations**

Supported detail can include:
- Sideout;
- Score1;
- SOS2;
- Breakpoint;
- Opponent Sideout;
- Earned/Given;
- serving runs;
- EPO;
- attack efficiency;
- FBSO/transition when supported;
- player/position contributions;
- personnel configurations;
- lineup state;
- rich tactical patterns when available.

## 10.4 Error Pile-On (EPO) by rotation

EPO is first-class in the rotation deep dive.

Show:
- opportunities;
- conversions;
- EPO %;
- comparison to team baseline;
- won/lost set context where useful;
- season/recent context when sample permits.

Rotation assignment uses the rotation state associated with the opponent’s Given error and the immediate following rally; set-ending errors are censored according to the global EPO definition.

## 10.5 Position leaders by rotation

Each rotation deep dive includes compact **Position Leaders in R#**.

Potential role-aligned metrics, only when supported and with minimum-opportunity protection:

### Pins
- Contribution
- kills/set
- hitting %
- FBSO hitting
- transition hitting

### Middles
- Contribution
- hitting %
- FBSO hitting
- transition hitting
- blocks/set

### Setters
- Contribution
- assists/set
- team hitting %
- team FBSO hitting
- team transition hitting

### Libero / DS
- Contribution
- passer rating
- Good Pass %
- reception FBSO
- D2K / dig conversion

These are descriptive leaders, never lineup/start/bench recommendations.

---

# 11. Players

Players contains two primary subviews:

- **Season Stats**
- **Player Analysis**

## 11.1 Season Stats

Purposefully simple, sortable cumulative stat table.

No AI analysis is required on this page.

Filters:

### Location
- All
- Home
- Away
- Neutral

### Competition
- All
- Conference
- Non-Conference

### Result
- All
- Wins
- Losses

The active sample is always explicit, for example:

> **Conference • Away • Wins — 7 matches**

Columns include standard season stats supported by evidence plus selected universal platform metrics where appropriate.

Rich-source aggregate columns may appear only when supported.

## 11.2 Player Analysis flow

Recommended hierarchy:

**Player Selector → Season → Match → Overall Match / Set → Match Stats → Tactical Analysis → Evidence-backed Player Review**

## 11.3 Four-row match summary

Preserve the prototype’s compact grouping:

### Performance
- sets played on match view;
- Contribution;
- hockey +/- when supportable;
- other high-value universal impact measures.

### Offense
- kills/errors/attempts;
- hitting %;
- setting/offense components;
- FBSO / transition when supported.

### Block & Defense
- blocks;
- digs;
- rich contact detail when supported.

### Serve & Receive
- aces/errors;
- reception/passing;
- rich serve-receive detail when supported.

## 11.4 Player tactical view

When VM-rich evidence exists, use the same reusable tactical engine:

**Player → Match → Overall Match / Set → Attack Type → Origin → Destination → Route → Outcome**

## 11.5 Player Match Review

The review is evidence-backed and constructive.

Allowed statements:
- statistical performance;
- context differences supported by evidence;
- score/rally anchors that are traceable;
- areas worth reviewing on film based on measurable outcomes.

Disallowed unless evidence truly supports them:
- invented technical explanations;
- inferred biomechanics;
- unsupported psychological claims;
- prescriptive personnel decisions.

Example:

> “You were most productive in transition, recording 4 kills on 7 transition attacks.”

not:

> “Your transition timing allowed maximum power.”

## 11.6 Player photo design

Player images should be used where they improve recognition and feel, including:
- player cards;
- match summaries;
- rotation lineups;
- impact leaders;
- player-facing home.

Graceful fallback is mandatory.

---

# 12. Probability / Match Flow

The probability model is already conceptually developed. V1 design work is about presentation and deterministic implementation, not rediscovering whether probability belongs in the product.

## 12.1 Set-based probability

Set win probability is calculated and displayed by set.

Do **not** create one artificial continuous match probability curve across multiple sets.

## 12.2 Overall Match doorway

Probability includes an **Overall Match** tab showing compact cards for each set, for example:

- final result;
- lowest/peak set-win probability;
- biggest positive rally;
- biggest negative rally;
- turning point / decisive stretch when evidence supports it.

Clicking a set opens the complete rally-by-rally view.

## 12.3 Set probability graph

Every rally is plotted from 0–0 through set end.

When supported, each point can expose:
- score;
- serve/receive;
- rotation;
- personnel state;
- probability before;
- probability after;
- rally WPA;
- result;
- player attribution;
- timeout markers.

## 12.4 Rally WPA

**Rally WPA = WP after rally − WP before rally.**

WPA is distinct from psychological “momentum.”

## 12.5 Rally Impact Log

Rename the old Momentum Log to **Rally Impact Log**.

Sort modes:
- Chronological
- Most Helpful
- Most Costly

## 12.6 Advantage Index

Advantage Index is a short 2–4 rally forecast, not “momentum.”

Potential inputs, when validated and supported:
- season/scouting baseline;
- prior sets/current match;
- current set;
- recent performance relative to expectation if it adds out-of-sample predictive value;
- score/serve/rotation/personnel state;
- timeout availability/effect when empirically supported.

Do not assume streak continuation.

## 12.7 Set Story

Probability can drive the established Set Story structure:

**Lowest Point → Final Climb → Summit / Turning Point → Decisive Stretch / Finish → Control Gained when applicable → Finish**

The story is derived from the probability timeline and traceable evidence.

## 12.8 Recency weighting principle

Do not use generic recency weighting merely because it feels intuitive.

- Full-season descriptive stats default to equal weighting unless a documented team-era change exists.
- Predictive weighting schemes must earn their use through out-of-sample forecasting/calibration improvements.
- Team-era change is distinct from generic recency decay.

---

# 13. Scouting

Scouting is a clean workflow:

**Choose Opponent → Review Data → Generate Report**

## 13.1 Opponent selection

Opponent is selected from our schedule.

The app then assembles:
- opponent roster;
- opponent schedule/history;
- candidate recent matches;
- existing canonical matches already available;
- previous head-to-head if applicable.

## 13.2 Opponent roster

First scout:
- import/upload roster, preferably automatically from official roster URL.

Rematch:
- existing roster persists;
- **Update Roster** is optional;
- updates reconcile canonical Player/PlayerSeason identities rather than duplicating players.

## 13.3 Opponent match sample

Coach can paste/import as many valid opponent match URLs/files as desired.

All legitimately imported matches become permanent opponent history.

Default current scout sample:
- **5 most recent available matches** from the selected filter pool.

Show clearly:

> **5 of 8 selected**

Coach can add/remove individual matches.

If only three valid matches exist, scout three. Do not make five a blocker.

## 13.4 Scouting filters

Default remains simple.

### Opponent
- default five most recent
- Competition: All by default
- Result: All by default
- Location: All by default

### Us
- Full Season (default) or Last 5
- Competition: All by default
- Result: All by default
- Location: All by default

Advanced filters can expose:
- Conference / Non-Conference
- Wins / Losses
- Home / Away / Neutral
- custom match selection

The generated report always states the active sample explicitly.

If **Full Season** is selected for our team, a meaningful recent/team-era change may still be surfaced as supporting context, but it must not silently change the calculation window.

## 13.5 Previous head-to-head

For a rematch:
- current default remains five recent opponent matches;
- previous head-to-head is automatically included as **supplemental evidence**;
- it does not replace one of the five;
- label clearly as **Previous Meeting**;
- distinguish Current Profile from head-to-head evidence;
- reduce H2H relevance when meaningful personnel/role/rotation changes are detected.

## 13.6 Automatic opponent discovery

Primary V1 discovery path:
- locate official opponent schedule page;
- identify completed candidate matches;
- coach confirms the evidence set on one review screen.

Manual schedule URL fallback if confidence is low.

The coach should not shepherd the system through repetitive confirmations.

Hard UX rule:

> **One review screen. One primary action. No unnecessary confirmations.**

The system searches and assembles; the coach confirms the evidence set.

## 13.7 Shared canonical match network

If A vs B is imported while scouting A, that canonical match automatically enriches B’s history too.

UI can indicate:

> **Already available — previously imported**

Do not recursively crawl the entire volleyball universe. Every legitimately imported match enriches both participating teams; history deepens as teams become relevant.

## 13.8 Continuous Team Intelligence Engine

Every imported match incrementally updates structured analytics for both teams, subject to evidence capabilities.

Potentially maintained facts include:
- Sideout;
- Breakpoint;
- Score1;
- SOS2;
- EPO;
- Earned/Given;
- rotations;
- personnel;
- player usage;
- serving runs;
- lineups;
- Tier 3 tactical data;
- confidence/provenance.

Principle:

> **The analytics engine remembers facts; Coach’s Edge reasons over facts.**

## 13.9 Team Identity / Change Detection

The engine should detect meaningful changes such as:
- setter structure;
- 5–1 / 6–2 behavior;
- starters;
- libero;
- rotations;
- substitutions;
- player usage;
- attack distribution;
- serve-receive role;
- availability;
- sustained performance change.

Strong evidence may create an internal **team era**.

Ambiguous change is flagged, not forced.

Conceptual lenses:
- Full History
- Current Identity
- Recent 5

## 13.10 Matchup Intersection Engine

Deterministic engine intersects opponent profile with ours across supported dimensions such as:
- Sideout vs Breakpoint;
- Score1 / SOS2;
- serving pressure / reception;
- Earned/Given;
- rotations;
- player/position vs team;
- late-set;
- timeout response;
- lineups;
- previous head-to-head;
- current era;
- rich tactical evidence.

Rank findings using:
- magnitude;
- sample size;
- persistence;
- reliability;
- current relevance;
- matchup relevance;
- evidence confidence.

Every surfaced finding retains a hidden evidence chain explaining why it matters.

## 13.11 Scouting report structure

Staff report sections:

1. **Recent Snapshot** — 1–3 findings, fewer allowed
2. **Matchup Factors** — up to 5
3. **Items to Consider** — up to 10, fewer when evidence does not justify more
4. **Questions Worth Asking Coach’s Edge** — exactly 5
5. **Coach Notes / Staff Intelligence** — coach-authored context

Never fill space with weak findings.

Report lifecycle:
- **Generate Report** creates the current working report;
- **Save Report** stores an exact in-app snapshot;
- new opponent evidence never silently mutates a saved snapshot;
- if new opponent matches are discovered later, staff can review/import them and deliberately regenerate a new report;
- **Export PDF** is a separate Staff-only external action.

## 13.12 Evidence drilldown

Staff can expand a finding to see, when supported:
- current rate / baseline;
- opportunity count;
- match consistency;
- driving rotations/players;
- H2H support/contradiction;
- personnel/team-era context;
- reliability/confidence/provenance;
- exact score/rally anchors only when traceable.

If evidence is only set-level, report only set-level detail.

Never invent score anchors.

## 13.13 Coach-authored notes / staff intelligence

A player-facing scouting report cannot be only statistics.

Staff can add contextual intelligence that the data may not know, for example:
- gym environment;
- injury/availability information;
- observed lineup changes;
- travel or crowd context;
- warmup observations;
- information from other staff.

Notes can:
- live in a dedicated Coach Notes / Staff Intelligence section;
- attach directly to a specific finding, player, rotation, or matchup factor;
- carry visibility of **Staff Only** or **Share with Team**.

Coach-authored notes remain clearly distinguished from data-driven findings. The analytics engine does not silently treat anecdotal information as verified statistical truth.

---

# 14. One Canonical Scout, Staff View + Team View

V1 maintains **one canonical scouting report**, not separate staff and player documents.

## 14.1 Staff View

Staff View may contain:
- full findings;
- deeper evidence;
- staff-only notes;
- opponent player/rotation detail;
- confidence/provenance;
- Coach’s Edge questions;
- post-match reflection history.

## 14.2 Team View

Team View is curated, not merely permission-filtered.

Players receive:
- key matchup points selected by staff;
- coach notes intentionally marked Share with Team;
- small supporting data snippets;
- concise player-friendly language;
- selected opponent-player context when useful.

Players do **not** receive:
- giant tables;
- unrestricted evidence trees;
- deep provenance/confidence plumbing;
- full staff scouting workstation detail;
- unrestricted opponent/player drilldown.

Principle:

> **Staff gets analytical depth. Players get actionable clarity.**

## 14.3 Share controls

For each eligible finding/coach note:

**Share with Team ✓**

The platform creates the concise Team View automatically. Staff can edit wording if desired but should not be forced to rewrite the report.

Flow:

**Generate Staff Scout → Select Team Findings/Notes → Preview Team View → Share with Team**

## 14.4 Player access to scouting reports

When shared:
- players see the report inside the authenticated app;
- staff can see Viewed / Not Viewed counts;
- optional player-level drilldown shows who has opened the current version;
- no quiz or mandatory “I understand” acknowledgment.

## 14.5 Report updates

Substantive changes after sharing require:

**Save Update → Share Updated Version**

Do not silently replace the version players already read.

Staff can see whether players viewed:
- original only;
- latest version;
- neither.

## 14.6 After the match

Player-facing scout automatically leaves the active player view after the match unless staff deliberately keeps it active.

Staff archive remains intact.

Rematches generate a new current scout. The old player scout does not simply reappear.

## 14.7 Ask Coach’s Edge about this

When Player Coach’s Edge is enabled, a player can tap:

**Ask Coach’s Edge about this**

from a shared scouting point.

This opens the separate Coach’s Edge experience with that finding carried as context.

The scouting report remains a report; chat is not embedded inside it.

## 14.8 External export

V1 external export is **PDF only** for Staff.

Players do not download/export scouting-report PDFs; their primary access is authenticated in-app viewing.

No public share links in V1.

---

# 15. Scouting Calibration & Match Feedback

This is a quiet learning layer, not a grading system.

Goal:

> Help coaches see strengths and blind spots in their scouting process while allowing the app to learn which pre-match signals tend to be representative.

## 15.1 No hard prediction scoring

Do not freeze scouting predictions or create punitive accuracy scores.

No “Coach Accuracy: 73.”

The mindset is:

> **We’re here for you, not coming for you.**

## 15.2 Post-match note reflection

After a match, the author can optionally revisit their scouting notes.

Soft prompt:

> **Want to revisit your scouting notes?**  
> A quick look back can help you see what held up, what changed, and what might be worth watching next time.

Suggested reflection options:
- Pretty much
- Somewhat
- Not really
- Hard to tell
- Didn’t apply

For data-supported notes, the platform can display relevant evidence beside the note. The coach still makes the judgment.

For anecdotal notes, do not invent statistical validation.

## 15.3 Privacy of reflection data

Reflections are **staff/program-private**, never player-facing by default.

They remain archived and can be analyzed by authorized Coach’s Edge queries.

Example:

> “How accurate have my assistant coach’s scouting notes been?”

Coach’s Edge may summarize the assistant’s own historical reflection choices and supporting data, while emphasizing strengths/blind spots rather than creating a performance grade.

## 15.4 Match-level scouting feedback

After a match, staff can optionally answer a few fast questions:

- Did the opponent generally play like we expected?
- Was the scouting data representative of this match?
- Did any opponent players surprise us or emerge unexpectedly?
- Was anything meaningfully different?

Possible answers remain lightweight and conversational.

## 15.5 Future learning loop

Archive two distinct information types:

1. **Coach observation** — what staff felt/observed.
2. **Match evidence** — what deterministic data can demonstrate.

Over time, the engine can search for correlations such as:
- scout unrepresentativeness coinciding with setter changes;
- surprise players showing prior usage increases;
- personnel instability preceding scouting misses;
- recent availability changes;
- role changes;
- sampling limitations.

The platform may surface patterns only when the evidence earns them.

It must not convert correlation into unsupported causation.

This capability supports a broader **Longitudinal Program Intelligence** flywheel:

**Data → interpretation → match → reflection → better context → better future analysis**

---

# 16. Coach’s Edge

Coach’s Edge is the evidence-driven conversational assistant for the program.

It is not embedded inside reports; it remains a separate primary experience that can receive context from elsewhere in the app.

## 16.1 Landing page

Three immediately available paths:

### Challenge My Read
Coach gives a hypothesis.

Examples:
- “I think we struggle to side out in R4.”
- “Our pins are giving away too many points.”
- “We are better after timeouts.”

Verdicts:
- Supported
- Partially Supported
- Not Supported
- Insufficient Evidence

Coach’s Edge must be comfortable disagreeing when evidence requires it.

### Find an Edge
Coach does not need a hypothesis.

The engine searches structured evidence for meaningful findings, including:
- **Bulletproof Us** — what an opponent could discover about us;
- **Expose Hidden Weaknesses** — meaningful patterns we may not be noticing.

### Open-ended question box

Coach can simply ask anything about permitted data without classifying the question first.

## 16.2 Answer hierarchy

Default answer shape:

**Answer → Evidence → Confidence → Explore Deeper**

First response should be concise and coach-friendly, not an AI essay.

Example evidence block may include:
- rate;
- team baseline;
- opportunities;
- recent sample;
- match consistency;
- likely statistical separator;
- confidence.

Expandable sections may include:
- Why Coach’s Edge says this
- By Match
- By Player/Position
- By Set
- Rally Evidence

## 16.3 Data scope visibility

Every Coach’s Edge answer should make the active analytical scope clear, for example:

> **Analyzing: Full Season • Conference • 18 matches**

or:

> **Analyzing: Mayville Scout • Opponent Last 5 • VCSU Full Season**

## 16.4 Confidence and significance

Coach’s Edge can use separate confidence dimensions:
- Evidence Confidence
- Persistence Confidence
- Matchup Relevance

Pattern classes may include:
- Established
- Emerging
- Matchup Factor
- Interesting
- Watch-list
- Conflicting
- Descriptive Only

The UI should communicate useful confidence without overwhelming the user.

## 16.5 No tactical/personnel prescriptions

Coach’s Edge may expose evidence and ask useful questions, but does not make decisions such as:
- start/bench;
- serve target;
- blocking scheme;
- offensive system.

## 16.6 Contextual handoffs

Other screens can offer actions such as:
- Ask Coach’s Edge about R4
- Ask Coach’s Edge about Geist
- Ask Coach’s Edge about this scouting finding

The destination is always the separate Coach’s Edge experience with context carried internally.

---

# 17. Coach’s Edge Voice Interaction

Mobile Coach’s Edge supports voice interaction, subject to permissions.

## 17.1 Quick Voice

Tap microphone → ask one question → receive:
- spoken concise answer;
- full evidence on screen.

## 17.2 Conversation Mode

Optional continuous back-and-forth voice session for use cases such as:
- walking to practice;
- sitting on a bus;
- drive-time analysis;
- post-match reflection.

The assistant retains conversational context.

## 17.3 Same analytical pipeline

Voice changes modality, not standards:

**Speech → transcription → intent/entity resolution → structured analytical query → deterministic analytics → evidence/confidence → AI explanation → spoken response**

Spoken output should normally be shorter than the complete on-screen answer.

---

# 18. Coach’s Edge Shortcuts & Natural-Language Resolver

Shortcuts are optional accelerators, never requirements.

## 18.1 Entity shortcuts

- `@` → player autocomplete / canonical Player ID
- `#` → opponent/team autocomplete / canonical Team ID
- `R1`–`R6` → canonical rotation
- `S1`–`S5` → set

Examples:

`@Geist`  
`#Mayville`  
`R4`

Typing partial text immediately offers autocomplete suggestions.

Once selected, the entity becomes a recognized visual chip/token rather than ambiguous plain text.

## 18.2 Scope/filter shortcuts

V1 slash commands:

- `/season`
- `/last5`
- `/conference`
- `/nonconference`
- `/wins`
- `/losses`
- `/home`
- `/away`
- `/neutral`

Compatible filters can stack.

Contradictory filters should not silently produce nonsense. The resolver can either interpret an explicit comparison or ask for clarification.

## 18.3 Shortcut discoverability

Coach’s Edge input keeps a faint persistent hint such as:

> Try `@` for a player, `#` for an opponent, `/` for filters

Typing `/` displays the short command list. Coaches should not need to memorize syntax.

## 18.4 Natural language is first-class

The engine must understand the same intent when commands are written out or spoken.

These should resolve to equivalent structured queries:

`How has @Geist performed in R2 /last5 /conference /away?`

“ How has Geist performed in Rotation 2 over our last five conference road matches?”

Voice: “How has Geist been in rotation two in our last five conference matches away from home?”

The resolver should recognize reasonable synonyms such as:
- road → away;
- at home → home;
- neutral site → neutral;
- last five matches → last5;
- matches we lost → losses.

Only map ambiguous language automatically when program context makes the meaning sufficiently clear.

Architecture:

**Natural language / voice / shortcuts → Intent & Entity Resolver → Structured Query → Deterministic Analytics**

---

# 19. Player Access & Player Experience

## 19.1 Player permission class

Players are read-only.

They cannot:
- edit/delete/import data;
- adjudicate source conflicts;
- modify program settings/models;
- change permissions;
- alter canonical data.

## 19.2 Coach-controlled section visibility

Under **Manage Program → Player Access**, staff can enable/disable player access to:
- Matches
- Rotations
- Players
- Probability / Match Flow
- Scouting
- Coach’s Edge

## 19.3 Player data scope

Program-level player data visibility is controlled by staff, with options such as:
- Own + Team
- All permitted team players

Crucially, the restriction is enforced at the **query/analytics layer**, not merely hidden in the UI.

Coach’s Edge, direct URLs, reports, charts, and generated content must honor the same scope and cannot leak restricted player-level information indirectly.

## 19.4 Player landing page

Players do not need the coach’s Matches-first landing experience.

Provide a soft personalized home with:
- Next Match / current shared scout;
- My Latest Match;
- My Season Snapshot;
- Team Snapshot;
- Recent Updates.

The page should feel informative and welcoming, not like an evaluation screen.

## 19.5 My Season Snapshot

Use small position-based default stat sets.

Staff can override later if needed.

Do not overload players with unnecessary data.

## 19.6 Player Coach’s Edge

When enabled:
- same underlying evidence engine;
- same text + voice modalities;
- strict player permission scope;
- concise developmental language;
- no access expansion through conversational phrasing.

## 19.7 Player analytical depth principle

Players get small, understandable pieces of data rather than unrestricted analytical depth.

Do not encourage statistical rabbit holes that are likely to be misinterpreted.

---

# 20. Staff Roles, Authentication & Invitations

## 20.1 V1 roles

### Program Owner
Full access including ownership transfer.

### Staff
Coach / Assistant Coach / SID / Staff are operationally the same V1 permission class.

Staff can do everything except change/transfer Program Ownership.

Display role/title can differ without changing permissions.

### Player
Read-only, controlled by Player Access settings.

## 20.2 Staff invitations

Any Staff user can invite/remove Staff and Players.

Staff invitation:
- enter email;
- optionally assign display title;
- send invitation;
- invited user joins the existing program.

## 20.3 Player invitations come from the roster

Roster creates athlete identities. Invitations create access.

Do not create a second player identity when a user account is invited.

Workflow:

**Roster → Player Access → add email → Send Invite**

The account links to the existing canonical Player ID.

Bulk invitation should be supported to avoid repetitive setup.

## 20.4 Returning players

A returning player keeps the same canonical Player ID and account linkage across seasons.

No new login should be required merely because a new season begins.

## 20.5 Player deactivation

Any Staff member can immediately **Deactivate Player Access** if a player:
- transfers;
- quits;
- is dismissed;
- graduates;
- otherwise leaves the program.

Deactivation revokes future access to all program intelligence while preserving:
- player identity;
- season records;
- statistics;
- historical match evidence.

Deactivation is reversible by staff.

Program intelligence belongs to the program; player access is revocable.

The system cannot claw back information already screenshotted/copied/downloaded, but future authenticated access stops immediately.

## 20.6 One active program per user

V1 assumes one user account belongs to one active program at a time.

A player can later change programs without needing a new login, but private historical program data does not follow them into the new school.

Former program records remain with the former program.

## 20.7 Ownership transfer

Program Owner can:

**Manage Program → Transfer Ownership → choose existing Staff member → confirm**

Everything else remains unchanged.

## 20.8 Program offboarding

Default behavior:

> **Archive first. Delete only deliberately.**

An inactive program preserves its seasons, players, matches, scouts, corrections, Coach’s Edge history, and longitudinal intelligence.

Permanent deletion requires explicit Program Owner action and stronger confirmation.

---

# 21. Manage Program & Data Management

Do not make coaches feel like database administrators.

## 21.1 Summary state

A simple dashboard may show:

- Roster ✓
- Schedule ✓
- 22 Matches Available
- 14 Rich Matches
- 8 Standard/Basic Matches
- 1 Conflict Needs Review

## 21.2 Needs Review

Only genuine conflicts/ambiguities surface, such as:
- player number conflict;
- ambiguous player identity;
- match could match two schedule entries;
- home/away/neutral conflict;
- possible duplicate.

Missing rich data is **not** a warning.

## 21.3 Manual correction

Staff can use a subtle **Correct Data** action even when the system did not flag a conflict.

Flow:

**Correct Data → edit value → optional note/reason → save**

The original source value remains preserved; the staff correction becomes canonical and survives future re-imports.

---

# 22. Notifications

V1 notifications are minimal and primarily in-app.

Potential notifications:
- new scout shared / scout updated;
- schedule change available;
- data conflict needs review;
- import failed or needs clarification;
- invitation/access status when relevant.

No complex notification preference matrix, push system, or email alert ecosystem is required for V1.

---

# 23. Activity History

Under **Manage Program → Activity History**, preserve a lightweight audit trail of significant staff actions such as:
- imports;
- roster/schedule refreshes;
- corrections;
- conflict resolutions;
- scout shares/updates;
- player activation/deactivation;
- permission changes.

Purpose:

> Answer “what changed, when, and by whom?” when something looks wrong.

This is not intended as staff surveillance.

---

# 24. Seasons & Historical Preservation

## 24.1 New season workflow

**Manage Program → Seasons → Start New Season**

New season setup:
- create season;
- refresh/import roster;
- refresh/import schedule;
- reconcile returning players;
- preserve prior season.

Program identity persists across seasons.

## 24.2 Historical seasons

Once a season is over:
- normal state is read-only;
- all major analytical views remain explorable;
- genuine historical-data corrections remain possible through staff-only correction workflow;
- historical match/player/scouting context is preserved.

## 24.3 Longitudinal player history

Returning players maintain one canonical identity across seasons so the platform can show career progression without mixing season-specific statistics.

## 24.4 Longitudinal Program Intelligence

Architecture should preserve context required to analyze future multi-season patterns such as:
- calendar date;
- week of season;
- matches since season start;
- early/middle/late season;
- conference/non-conference;
- postseason;
- match density;
- days since previous match;
- team-era/personnel context.

Potential future insights:
- repeated late-season sideout changes;
- returning-player seasonal progression;
- performance patterns during high-density stretches;
- current season diverging from prior seasons.

Do not convert correlation into training/rest prescriptions automatically.

---

# 25. Responsive Desktop & Mobile

V1 is one responsive application, not separate desktop/mobile products.

## 25.1 Desktop

Desktop is the primary environment for dense analysis, including:
- six-rotation comparison;
- season-stat tables;
- tactical courts;
- probability charts;
- side-by-side scouting evidence;
- deeper Coach’s Edge exploration.

## 25.2 Mobile

Mobile retains essentially full core functionality.

Presentation adapts:
- stacked cards;
- touch-friendly controls;
- simplified/scrollable tables;
- full-width player cards;
- readable scouting reports;
- tap-to-inspect probability;
- mobile-friendly file/import/correction actions where practical;
- voice Coach’s Edge.

Mobile is not a “lite analytics” product; evidence and calculations are the same.

---

# 26. Connectivity / Offline Philosophy

V1 is online-first.

Do **not** spend V1 engineering effort on:
- offline editing;
- synchronization conflict handling;
- offline Coach’s Edge;
- offline imports;
- offline recalculation.

If saved/generated reports can be cached for offline reading with little implementation cost, that is a useful convenience but not a V1 requirement.

---

# 27. External Reports & Export

V1 does not need a broad report-builder ecosystem.

External export is **PDF only** for Staff when needed.

No public share links.

Player scouting distribution primarily occurs inside authenticated Team View.

Saved scouting reports remain exact snapshots and do not mutate when new data arrives.

---

# 28. Locked Analytical Definitions

These definitions are part of V1 deterministic analytics and must not drift because of UI/source differences.

## 28.1 Hockey +/-

+1 for a team rally win and −1 for an opponent rally win while the player is physically on court.

Requires sufficient lineup/on-court evidence.

## 28.2 SOS2

A team:
1. sides out;
2. wins its first serving rally;
3. wins its second serving rally.

If the set ends before the required rally, the opportunity is **censored**, not a failure.

## 28.3 EPO — Error Pile-On

After an opponent **Given** error, measure whether our team wins the immediately following rally.

Set-ending opponent Given errors are censored.

Blocked attacks / pressure-created attack errors are not automatically opponent Given errors.

## 28.4 Earned / Given internal model

Internally classify points/errors as:
- Earned
- Given
- Pressure-Created

Headline Earned % includes Pressure-Created with Earned.

Opponent analog:
- Opponent-Earned
- Surrendered

Fallback URL calculation:

**Earned Points = Our Total Points − Opponent Giving Errors**

Given includes, when directly supported:
- unblocked attack errors;
- service errors;
- BHE/setting errors;
- block errors.

Blocked attack errors belong to opponent-created side.

## 28.5 Contribution to Success

Current locked weighting:

- assisted kill: hitter +0.70 / setter +0.30
- unassisted kill: +1.00
- attack error: −1.00
- ace: +1.00
- service error: −1.00
- solo block: +1.00
- block assist: +0.50 each
- setting error: −1.00
- reception error: −1.00
- BHE: −1.00
- direct-point blocking error: −1.00
- fallback dig: +0.19
- fallback pass: +0.27

Richer P2K/D2K/contact-chain evidence can improve attribution when available.

Legacy CTS/Contribution formulas from old datasets do not override this model.

## 28.6 Timeout

Timeout is a first-class non-point timeline event.

Never infer timeout solely from timestamp gaps.

---

# 29. Confidence & Significance Discipline

A number existing does not mean a pattern should be promoted.

Finding selection considers:
- magnitude;
- sample size;
- persistence;
- source reliability;
- current relevance;
- matchup relevance;
- personnel/era changes;
- whether evidence is conflicting.

Unknown remains unknown.

Descriptive observations remain descriptive when causal/predictive evidence is insufficient.

---

# 30. Product Tone

The platform should feel like an experienced, loyal assistant coach who wants the head coach and program to succeed.

Especially in Coach’s Edge, scouting reflection, and player analysis:

- supportive without being sycophantic;
- candid without being adversarial;
- evidence-driven without being cold;
- developmental without being patronizing;
- willing to say “the evidence does not support that”;
- never framed as building a case against a coach or player.

For scouting calibration:

> Help coaches see strengths and blind spots, then go from there.

---

# 31. Explicitly Parked / Not V1 Priorities

The architecture should avoid blocking these future ideas, but they are not V1 commitments unless otherwise noted.

## Parked
- video files attached to scouting observations / rally evidence;
- automatic highlight reels;
- video UI hints/teasers;
- conference/GSC benchmark page;
- full public share-link ecosystem;
- full offline editing/sync;
- complex push/email notification system;
- large report-builder system;
- player PDF export of scouting intelligence;
- granular per-player custom permissions beyond the agreed program controls;
- elaborate staff role matrix beyond Owner / Staff / Player;
- generic multi-program switcher;
- global search unless prototype use proves it valuable;
- coach “accuracy scores” or punitive evaluation dashboards;
- automatic tactical/personnel recommendations.

## Hidden future video hooks to preserve

Data models may retain optional fields for:
- video file/reference;
- match/set/rally;
- timestamp;
- player;
- rotation;
- score state;
- finding ID;
- tags.

Do **not** indicate in the UI that video may become available until intentionally productized.

---

# 32. Known Validation / Build Gates

Before production, deterministic analytics require regression testing against known source examples.

One known issue must be explicitly reconciled:

- earlier SOS2 audits produced different opportunity counts under different parser handling/censoring assumptions;
- this is a parser/regression issue to resolve in implementation testing, not a reason to redefine SOS2 casually.

Other build gates:
- canonical match reconciliation across multiple sources;
- source lineage handling;
- player identity continuity;
- coach correction persistence;
- score-sequence continuity audit;
- capability-driven UI degradation;
- player-permission enforcement at query layer;
- saved-report immutability;
- scouting Team View filtering;
- voice/text/shortcut query equivalence.

---

# 33. V1 Experience Summary

A successful V1 should allow a coach to:

1. Create a branded program in minutes from identity + roster URL + schedule URL.
2. Drop in whatever match evidence they have — from a box-score URL to rich VM files.
3. Immediately get useful Match, Rotation, Player, and Probability analysis at the evidence level the data supports.
4. Build an opponent scout quickly from automatically assembled roster/history and a default recent-five sample.
5. Add staff intelligence that statistics cannot know.
6. Share a clean, curated Team View with players without exposing the entire analytical workspace.
7. Ask Coach’s Edge natural-language, shortcut, typed, or voice questions and receive evidence-backed answers.
8. Preserve every season and returning-player identity so the platform becomes more useful over time.
9. Reflect softly after matches so coaching observations and statistical evidence can improve future scouting context.
10. Keep private program intelligence under program-controlled, revocable access.

The intended compounding effect is:

> **The app gets better, the coaches get better, and the players get better as the season progresses.**

---

# 34. Design Freeze Statement

This document represents the current V1 **product and interaction architecture**.

It is intentionally detailed enough to move into build planning, but it does not claim that every micro-interaction is permanently frozen. Small usability refinements should be expected once real coaches and players drive the prototype.

Changes that should require deliberate design review include:
- changing the six primary navigation areas;
- changing canonical evidence/analytics semantics;
- weakening source provenance or correction rules;
- changing player/staff privacy boundaries;
- adding tactical/personnel prescription;
- changing the one-report Staff View / Team View model;
- changing Coach’s Edge from evidence explanation into statistics generation;
- making rich-source data mandatory for core usefulness.

**Next step after user review:** build sequencing and implementation planning.
