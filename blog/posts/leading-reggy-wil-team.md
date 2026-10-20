This year I've been the team lead for **REGGY**, a student registration platform we're building for an institutional client as part of Work-Integrated Learning at Emeris. Six of us split the work across four streams: the API, the staff website, the mobile app and the database. I also took primary responsibility for the shared ASP.NET Core Web API that everything else talks to.

Here are the things I'd tell myself if I were starting again.

## The API is the contract, so agree on it early

REGGY has two very different clients: a Flutter app for students and an ASP.NET Core MVC portal for staff. Both depend on the same Web API (.NET 10). When the web and mobile teams are building in parallel, the fastest way to lose a week is for each side to guess what an endpoint returns.

What helped most was writing down the request and response shapes *before* implementing them, then treating changes as something we discussed rather than something that just happened in a pull request.

> If two teams depend on one API, the API's shape is a team decision, not one developer's.

## Put the rules in one place

Validation, identity and role-based authorisation are all enforced at the API level. That was a deliberate choice: if the mobile app and the website each implemented their own checks, they would drift apart. Keeping the rules on the server means:

- one source of truth for who can do what,
- clients can stay thinner and simpler,
- and a bug in authorisation gets fixed once, for everyone.

## Feature branches plus integration testing

Everyone worked on GitHub feature branches. The harder part was integration: components that worked perfectly on their own sometimes broke when they met. We got better results when we tested the real flows end to end (student submits documents, staff verifies them, status notification goes out) rather than only testing pieces in isolation.

## Leading is mostly communication

The technical work was the part I expected. What surprised me was how much of the role was coordination: breaking work into milestones, checking in on blockers, and translating between what the client asked for and what the team needed to build.

Demonstrating progress to the client regularly mattered a lot. Showing working features early gave us feedback while it was still cheap to change direction, and the client approved the work we presented.

## What I'd do differently

- Write the API contract down even earlier, before the first sprint.
- Set up shared test data from day one so every stream tests against the same scenarios.
- Schedule integration days on purpose, instead of waiting until features "feel done".

Leading REGGY has made me a better developer, not just a better organiser. Understanding how every part of a system depends on the others changes how you write the piece you own.
