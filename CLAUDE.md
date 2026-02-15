# Screening Room

## Vision

A private, invite-only app where friends and family log what they've watched (movies, TV shows, YouTube videos), leave ratings and short reviews, and see what others think — with smart detection of where content is currently streaming.

Think of it as Letterboxd meets a private group chat, but for all video content including YouTube.

## Core Principles

- **Low friction above all else.** Logging something should take under 30 seconds. Rating is optional — you can mark "watched" without rating. Short takes are optional on top of that.
- **Private by default.** Single invite-only group. You're in or you're not. No public profiles, no discoverability.
- **Platform-agnostic.** Movies, TV, and YouTube are all equal citizens. A great YouTube documentary gets the same treatment as a Netflix original.
- **Minimal infrastructure costs.** Free tiers and static hosting wherever possible. This is a passion project, not a startup.

## Architecture Direction

Single-page application with a lightweight backend for auth and data. Not AI-powered at its core — the value is in the social layer and shared taste graph.

### Recommended Stack

- **Frontend:** React (Vite) or vanilla HTML/JS, hosted on Vercel/Netlify/GitHub Pages
- **Backend/DB:** Supabase (Postgres + Auth + Row Level Security)
  - Why Supabase: free tier is generous (500MB, 50k MAU), RLS handles access control natively, real-time subscriptions available if you want live feed updates later
- **Metadata APIs:**
  - TMDB API (free, requires attribution) — movie/TV search, posters, cast, genres, streaming availability via JustWatch partnership
  - YouTube Data API v3 (free, 10k quota units/day) — video metadata, thumbnails, channel info

## Access Model

**Single group, admin-controlled.** Ryan (or designated admin) invites users via a link or code. All approved users can see all reviews from all other users. No sub-groups, no visibility tiers. This dramatically simplifies auth and UI.

Implementation note: still include a `group_id` foreign key on reviews in the data model. Costs nothing now, preserves optionality if multi-group ever makes sense. But the UI and invite flow should assume a single group for the foreseeable future.

### Auth Flow
1. New user clicks invite link → lands on signup page
2. Signs up via email/password or Google OAuth (Supabase Auth)
3. Admin approves the user (or auto-approve via invite link with embedded token)
4. User sees the shared feed

## Data Model (Conceptual)

### Users
- id, display_name, email, avatar_url, is_approved, created_at

### Groups
- id, name, invite_code, created_by, created_at
- MVP: exactly one row in this table

### Group Memberships
- user_id, group_id, role (admin | member), joined_at

### Content Items
- id, content_type (movie | tv_show | youtube_video), external_id (TMDB ID or YouTube video ID), title, poster_thumbnail_url, year, metadata_json (flexible — genre array, seasons, channel name, duration, etc.)
- Deduplicated by external_id + content_type. Two users logging the same movie resolve to the same content item.

### Reviews
- id, user_id, content_item_id, group_id, rating (integer 1–10, displayed as 0.5–5.0 stars; NULL if "watched but not rated"), short_take (text, max ~280 chars, optional), watched_date, created_at, updated_at
- One review per user per content item per group. Users can update their review.

### Tags (User-Applied)
- review_id, tag (from curated list — see Tagging System below)
- Many-to-many: a single review can have multiple tags

### Streaming Availability (Cached)
- content_item_id, platform_name, platform_logo_url, link, country, last_checked_at
- Auto-populated from TMDB on content creation. Refreshed periodically or on-demand.
- YouTube content skips this — the "platform" is always YouTube.

## Rating System

**Half-star scale: 0.5 to 5.0 stars.**

- Stored as integer 1–10 internally (avoids floating point issues, cleaner averages)
- Displayed as 0.5–5.0 stars in the UI
- Rating is **optional** — users can log "watched" without rating
- Short take (free text, ~280 char max) is **optional** on top of rating
- Group average displayed on content cards when 2+ people have rated

### "Watched But Not Rated" State
Sometimes you finish something and don't feel strongly. Forcing a rating leads to dishonest data. The flow should be:
1. Search/find content → "Mark as Watched" (one tap, done)
2. Optionally add a star rating
3. Optionally add a short take
4. Optionally add tags

This keeps the barrier to logging as low as possible while still capturing signal when people want to give it.

## Tagging System

### Design Philosophy
TMDB already provides genre metadata for movies and shows (Action, Comedy, Drama, Documentary, etc.). Users shouldn't have to re-enter what an API already knows. Tags should capture what genres *can't* — subjective qualities, viewing context, and cross-content vibes.

### Two-Layer Approach

**Layer 1: Auto-Genres (Movies/TV only)**
- Pulled from TMDB on content creation
- Displayed on content cards automatically
- Filterable in the feed and search
- Users don't touch these

**Layer 2: User-Applied Vibe Tags (All content types)**
- Curated dropdown list, applied per-review (optional, multi-select)
- These capture subjective or contextual qualities that APIs can't provide
- Required for YouTube videos (at least one) since YouTube has no structured genre data
- Optional for movies/TV (genres already cover the basics)

### Suggested Vibe Tag List (Hardcoded v1)

| Tag | Intent |
|---|---|
| Feel-Good | Light, uplifting, comfort watch |
| Mind-Bending | Makes you think, plot twists, surreal |
| Slow Burn | Patience required, big payoff |
| Binge-Worthy | Hard to stop watching |
| Watch With Kids | Family-appropriate, genuinely enjoyable for adults too |
| Date Night | Good shared viewing for couples |
| Background Noise | Doesn't demand full attention |
| Visually Stunning | Worth watching for the cinematography/production alone |
| Hidden Gem | Underrated, not well-known |
| Overhyped | Popular but didn't live up to expectations |
| Emotional | Will make you cry or feel deeply |
| Educational | You'll learn something real |
| Sports | Sports-related content across all types |
| True Crime | True crime content across all types |
| Comfort Rewatch | Something you'd happily rewatch |

This list should be opinionated and kept short (15–25 tags max). If it gets too long, people won't use it. Can be expanded in future versions based on actual usage patterns.

### Filtering
Users can filter the feed by:
- Genre (TMDB-sourced, movies/TV only)
- Vibe tag (user-applied, all content)
- Content type (movie, TV, YouTube)
- Person
- Rating range
- Combinations of the above (e.g., "show me YouTube videos tagged Educational that Alex rated 4+")

## User Profile / Ratings by Person

Clicking a user's name anywhere in the app opens their profile view:

- **Stats at a glance:** total watched, average rating, most-used tags, most active month
- **Full rating history:** every piece of content they've logged, sorted by date (default) or rating
- **Filterable:** by content type, genre, tag, rating range
- **Taste comparison (v2):** "You and [person] have both rated 12 things. Your average difference is 0.8 stars." This creates an organic compatibility signal without building a recommendation engine.

This view is the core social value of the app. If you tend to agree with someone's taste, their future ratings become a reliable signal for what you should watch next.

## YouTube Handling

YouTube videos are first-class citizens. Same rating system, same feed placement, same filtering. The differences are purely in metadata sourcing:

### When a user pastes a YouTube URL:
1. Extract video ID from URL
2. Hit YouTube Data API v3 for: title, thumbnail, channel name, duration, publish date, description
3. Create content item with `content_type: youtube_video`
4. No streaming availability lookup (it's YouTube)
5. Auto-genres are NOT available — user must apply at least one vibe tag

### What YouTube content lacks vs. movies/TV:
- No structured genre data (vibe tags fill this gap)
- No cast/crew information
- No streaming availability (irrelevant)
- No season/episode structure

### What YouTube content has that movies/TV don't:
- Channel name (useful for browsing — "show me everything from Channel 5")
- Direct link to watch (always available, no platform fragmentation)

## Features — MVP (v1)

1. **Search & log.** Search TMDB for movies/shows or paste a YouTube URL. One tap to mark as watched.
2. **Rate & review.** Optional 0.5–5 star rating + optional short take (~280 chars) + optional vibe tags.
3. **Group feed.** Reverse-chronological feed of all reviews. Filter by person, content type, genre, tag, or rating.
4. **Streaming availability.** "Where to watch" badges on movie/show cards, powered by TMDB/JustWatch data.
5. **User profiles.** Click a person → see their full rating history with filters.
6. **User auth + invite flow.** Supabase Auth, single group, admin-controlled invites.
7. **Tagging.** Auto-genres for movies/TV + curated vibe tags for all content.

## Features — v2 (Post-MVP)

- **"Want to Watch" list.** Personal wishlist visible to the group. If someone reviews something on your list, you get a nudge.
- **Taste comparison.** "You and [person] agree on X% of ratings" with a breakdown.
- **Spoiler tags.** Toggle to hide/reveal spoiler content in short takes.
- **Reactions to reviews.** Emoji reacts (not full comments — keep it lightweight).
- **Notifications.** Configurable — new review posted, someone watched something on your list, etc.
- **Search across reviews.** Full-text search within short takes ("who mentioned that scene with the helicopter?").
- **Content recommendations.** Claude API integration — "Based on what your group likes, you might enjoy..." Synthesis of group taste, not just collaborative filtering.
- **CSV export.** Download your full watch history. Low effort, high trust signal.

## Features — Explicitly NOT Building (For Now)

- **Public profiles or social discovery.** Privacy is the point.
- **Episode-level tracking.** Too much friction. Track at the show level. If someone wants to note the season, they can mention it in their short take.
- **Auto-detect what you watched.** Streaming platforms don't offer APIs for this. Not feasible.
- **Native mobile apps.** PWA first. If the app is responsive and installable, native apps are unnecessary at this scale.
- **Full-length written reviews.** Short takes keep the barrier low. If someone wants to write more, they can — but the UI shouldn't encourage it by default.
- **Comment threads on reviews.** Opens a moderation and notification can of worms. Reactions are enough for v1–v2.

## Open Questions

- [ ] **Minimum rating of 0.5 vs. 1.0:** Is there a meaningful difference between "this was terrible" (1 star) and "this was beyond terrible" (0.5 stars)? Half-star at the bottom mostly just lets people express frustration. Might be fine, might add noise. Consider whether 1.0–5.0 in half-step increments (9 options) is enough vs. 0.5–5.0 (10 options).
- [ ] **YouTube channel-level browsing:** Should the app let you filter by YouTube channel? Useful if someone logs several videos from the same creator. Low effort to implement — just filter on channel name from metadata.
- [ ] **Review editing vs. versioning:** Can users update their rating later? (They should.) Should the old rating be preserved as history? Probably not for MVP — just overwrite. But interesting for v2 ("I rewatched this and changed my mind").
- [ ] **Admin approval flow:** Auto-approve via invite link (simpler, slight abuse risk) vs. manual approval after signup (more friction, more control)? Given the small trusted group, auto-approve via unique invite link is probably fine.
- [ ] **Content deduplication edge cases:** What if someone logs a movie via TMDB search and someone else pastes a YouTube link to the same movie uploaded to YouTube? These are technically different content items. Probably fine — they *are* different viewing experiences. Don't over-engineer dedup.
- [ ] **TV show vs. TV season:** TMDB has both. Should logging be at the show level ("I watched Breaking Bad") or season level ("I watched Breaking Bad Season 3")? Show-level is simpler but loses nuance. Season-level adds friction. Recommendation: show-level for MVP with an optional "season" text field.

## TMDB Attribution Requirement

TMDB's API is free but **requires visible attribution**. Every view that displays TMDB data must include the TMDB logo and a link. This is contractually non-negotiable. Plan the UI to accommodate this — a footer badge or small attribution line on content cards. Don't bury it; don't fight it.

## Cost Estimates

### MVP (Realistic Starting Costs)

| Component | Provider | Cost |
|---|---|---|
| Hosting | Vercel / Netlify / GitHub Pages | Free |
| Database + Auth | Supabase Free Tier (500MB, 50k MAU) | Free |
| Movie/TV Metadata + Streaming Availability | TMDB API (via JustWatch) | Free |
| YouTube Metadata | YouTube Data API v3 (10k units/day) | Free |
| Domain (optional) | Namecheap / Cloudflare | ~$12/year |
| **Total** | | **$0 – $12/year** |

### Growth / Premium Upgrades (Only If Needed)

| Upgrade | Provider | Cost | When You'd Need It |
|---|---|---|---|
| Better streaming availability data | Watchmode API | $10–50/month | If TMDB/JustWatch data proves too stale or incomplete |
| AI-powered recommendations | Claude API (Sonnet) | ~$1–5/month | v2 feature, hobby-scale usage |
| Database scaling | Supabase Pro | $25/month | Exceeding 500MB or need backups/branching |
| Push notifications | OneSignal / Firebase Cloud Messaging | Free tier | v2 notification features |

### Realistic Assessment
A group of 10–30 people logging a few reviews per week will stay well within every free tier listed. You'd need hundreds of active users or thousands of API calls per day to hit any paid thresholds. **Budget $0–12/year for the first year, revisit if usage surprises you.**

## Development Phases

### Phase 1: Foundation (1–2 weeks)
- Supabase project: tables, RLS policies, auth configuration
- TMDB search integration (movie + TV)
- Core flow: search → log as watched → rate → short take
- Single hardcoded group, invite by link
- Basic feed (reverse chronological, all reviews)

### Phase 2: Full Content Support (1–2 weeks)
- YouTube URL paste → metadata extraction → log/rate flow
- Auto-genre population from TMDB
- Vibe tag system (curated dropdown, multi-select)
- Streaming availability badges on movie/TV cards
- Feed filtering (person, content type, genre, tag, rating)

### Phase 3: Social Layer (1 week)
- User profile pages (rating history, stats, filters)
- Group average ratings on content cards
- "Watched but not rated" distinct from "not watched"
- Mobile-responsive polish, PWA setup (installable)

### Phase 4: Refinement & v2 Features (Ongoing)
- Want to Watch list
- Taste comparison between users
- Spoiler tags, emoji reactions
- Notification system
- AI recommendation integration (Claude API)
- CSV export
