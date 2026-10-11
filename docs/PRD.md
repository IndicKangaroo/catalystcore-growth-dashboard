## CatalystCore Growth Analytics Dashboard

Product Requirements Document (PRD) • Internal Growth & Social Analytics Platform

## 1. Purpose

Build an internal web dashboard that connects CatalystCore app analytics with social-media activity so the team can understand whether content is contributing to app growth. The dashboard should move the team beyond views and likes toward measurable outcomes such as traffic, acquisition, engagement, retention and revenue.

Core question: Which content and campaigns are contributing to real product growth?

## 2. Core Growth Funnel

Content Traffic Acquisition Users Engagement Retention Revenue

## 3. High-Level Architecture

| Layer | Responsibility |
| --- | --- |
| CatalystCore Apps | Grind Quest, PDF & Image Toolkit, ID Photo Maker, Bulk File Renamer and future products |
| Firebase Analytics | Users, events, sessions, engagement, retention and available acquisition data |
| Backend / Data Processing | Fetch, normalize and prepare analytics data for the dashboard |
| Firestore | Apps, campaigns, social posts, tracking links, notes, users and configuration |
| Dashboard | Overview, app analytics, acquisition, social impact, comparisons and reports |

## 4. Main Dashboard

- Global metrics: Total Apps, Total Active Users, New Users, Sessions, Total Installs (when reliable), Average Retention, Total Revenue (when connected), Social-attributed Users (when attribution is available).

- Time ranges: Today, 7 days, 30 days, 90 days and Custom.

- Charts: Users over time, new users, sessions, revenue and social-attributed users.

## 5. App Management

- Each app should have: name, package name, icon, Firebase project/property ID, Play Store link, launch date, category, current version and status (Development / Testing / Production).

## 6. App Detail Analytics

- Users: DAU, WAU, MAU, new users, returning users, sessions, sessions/user and average engagement time.

- Growth: users, new users, sessions and engagement over time.

- Retention: Day 1, Day 7, Day 14 and Day 30; cohort visualization where practical.

## 7. Acquisition Analytics

- Show available acquisition sources such as Organic, Social, Google, Referral and Other.

- Clearly distinguish measured attribution from inferred or manually entered information.

## 8. Social Media Analytics


- Allow the team to record/import Instagram posts, Reels, Pinterest posts, YouTube Shorts, Reddit posts and other campaign content.

- Content fields: platform, content type, promoted app, campaign, publish date, URL, views, likes, comments, shares, saves and clicks when available.

## 9. Campaign & Attribution Tracking

- This is a core requirement. Firebase Analytics alone should not be treated as proof that a particular social post caused an install. Support campaign-specific tracking links/parameters.

- Example: utm_source=instagram; utm_medium=social; utm_campaign=grindquest_launch; utm_content=reel_01.

- Where supported, show clicks attributed users engaged users retained users.

## 10. Social App Comparison

- Provide app-level comparison of social posts, views, clicks, new users and retained users. Filters: app, platform, campaign, content type and date.

## 11. Growth Timeline

- Overlay product growth with social posts, campaigns, app updates, feature launches, advertising campaigns and other important events.

- Use the timeline for investigation; do not automatically claim that an event caused a growth spike.

## 12. Content Performance

- Each social post gets a detail view containing views, likes, shares, comments, saves, clicks, attributed users and retained users where available.

## 13. Content Categories

- Allow tags such as Product Demo, Feature, Educational, Behind the Scenes, Founder Story, Update, Meme, Tutorial, User Problem, Launch and Promotional.

- Compare categories by posts, clicks and users.


## 14. App Comparison

• Allow selection of 2–5 apps and compare new users, DAU/WAU/MAU, sessions, engagement, retention, acquisition sources, social traffic, attributed users, revenue and growth over the selected period.

## 15. Revenue Analytics

• When reliable integrations are available, show ad revenue, purchase revenue, total revenue, revenue by app, revenue over time and revenue per user. Future integrations may include AdMob and Google Play Billing.

## 16. Global Filters

• Use consistent filters across screens: Date Range, App, Platform, Campaign and Content Type.

## 17. Weekly Reports

• Generate a weekly CatalystCore Growth Report containing new users, growth changes, social-attributed users where measured, campaign activity, retention, revenue where available and notable events. Export PDF and CSV.

## 18. Campaign Notes

• Allow the social team to add notes to campaigns and the growth timeline, e.g. when a Reel or Pinterest campaign was published.

## 19. Authentication & Roles

• Use Firebase Authentication. Admin: full access. Growth/Social: analytics, campaigns, content and reports. Developer: app analytics and technical metrics.

## 20. Recommended Technology Stack

• Frontend: React + TypeScript. UI: Tailwind CSS. Charts: Recharts or equivalent. Backend: Node.js + Express. Database: Firebase Firestore. Authentication: Firebase Authentication. Analytics: Google Analytics for Firebase / Firebase Analytics. Hosting: Firebase Hosting, Vercel or Render.

## 21. V1 Scope

- App management and Firebase connections; DAU/WAU/MAU/new users/sessions; engagement and retention; basic acquisition; manual social campaign/content entry; tracking links/campaign parameters; app and campaign comparison; growth timeline; weekly report; CSV/PDF export; authentication and role-based access.

## 22. V2 / Future Scope

- Instagram API, YouTube API, Pinterest API, automatic social metrics, Google Play Console, AdMob, Google Play Billing, automated reports, cohort analysis, anomaly detection and growth alerts.

## 23. Important Product Principle

- This is not just a Firebase Analytics viewer. The goal is to connect content activity with measurable product outcomes: Content Traffic Acquisition Users Engagement Retention Revenue.

## 24. Attribution Caveat

- The system must distinguish measured attribution from correlation or inference. Firebase Analytics by itself does not establish that a specific social post caused an install. Use campaign parameters, tracking links and available attribution data wherever possible.


## 25. Definition of Done — V1

• Admin can add/manage apps; authenticated users can access by role; Firebase data displays for configured apps; app/date filters work; social campaigns can be recorded; tracking information is supported; app/campaign comparison works; growth timeline works; weekly reports export; illustrative/inferred numbers are never presented as confirmed attribution; architecture leaves room for Play Console, AdMob and social APIs.

CatalystCore Studios • Internal Product Requirements • Growth Analytics Dashboard
