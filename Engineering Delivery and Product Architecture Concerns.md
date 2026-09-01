# Engineering Delivery and Product Architecture Concerns

## Summary

I want to document several recurring concerns I have observed during development of the grain market pricing product. My concern is not about individual style preferences; it is about a pattern of technical and process decisions that have created product limitations, rework, implementation inconsistency, and avoidable delivery risk.

The most significant issue is that the current implementation appears to have been optimized around the initial MVP happy path rather than the known lifecycle of the product.

The product is not simply a one-time pricing calculator. Merchants create market scenarios, compute bids for roughly 10,000 producers, publish those bids, return to scenarios later, observe changes in competitor bids, receive accept/reject feedback, recompute against newer market conditions, and republish over time.

Those behaviors were discussed repeatedly during product development.

## 1. Scenario State and Persistence

The current implementation keeps computed producer bids client-side after compute and persists them later during publish.

This creates several problems:

- The browser temporarily owns critical business state.
- Publish performs substantial work and can take approximately one minute.
- Reopening a scenario requires invoking the compute service rather than simply restoring the previously computed state.
- Historical state is difficult to preserve and reason about.
- Future workflows involving competitor bid changes, accept/reject feedback, comparison, and recomputation become more difficult to implement.
- The architecture does not cleanly distinguish “reopen the previous scenario” from “recompute the scenario using current data.”

A more appropriate model would be to persist each compute result server-side as a durable or temporary computation version, including the approximately 10,000 producer bids.

The lifecycle would then be:

Create Scenario → Compute Version → Review → Publish Version → Market Changes / Outcomes → Reopen Existing Version → Recompute New Version → Republish

In this model, publish becomes primarily a state transition rather than the first point at which the computed result becomes durable.

Principal-level engineers who have recently become involved have independently raised or agreed with similar concerns.

## 2. Requirements and Product Lifecycle Investigation

A recurring concern has been insufficient investigation of the product lifecycle before implementation decisions were locked in.

During early development, there was significant pressure to produce a “final” design within a very short period and resistance to subsequent changes.

This was difficult because many of the changes were the result of legitimate product discovery rather than arbitrary design churn.

Examples of behaviors that were known or discussed include:

- merchants returning to previously created scenarios
- competitor bids changing over time
- automatically identifying competitor bid changes
- farmer accept/reject feedback becoming available after publication
- recomputing scenarios against updated market conditions
- maintaining the distinction between previously published state and current market state

These behaviors have significant implications for persistence, versioning, historical state, and system architecture.

For a senior engineering role, I would expect these implications to be surfaced during technical discovery and refinement rather than relying on UI designs to explicitly specify backend persistence behavior.

## 3. MVP Tradeoffs

The explanation provided for some of the architectural decisions was that the team was working under a tight MVP timeline.

Making technical compromises for an MVP can be reasonable. However, there is an important distinction between:

- deferring nonessential functionality, and
- choosing an architecture that conflicts with already-known core product behavior.

If an architectural shortcut is intentionally taken for MVP, I would expect the team to:

1. document the limitation,
2. identify the future architecture,
3. establish when the technical debt must be addressed, and
4. avoid allowing the temporary implementation to become the permanent product model.

The current situation suggests that temporary MVP assumptions remained in place long enough to constrain later development.

## 4. Design and Engineering Collaboration

There has also been friction around how design work is communicated and consumed.

Engineering requested that product states be fully represented in Figma and pushed strongly for Figma-based handoff rather than coded prototypes.

For this product, many important states are highly dynamic and depend on:

- thousands of producer locations,
- competitor distributions,
- changing market bids,
- map density,
- clustering,
- viewport and zoom,
- computed pricing results,
- and historical market changes.

I proposed coded prototypes as a way to validate these behaviors more realistically. That approach was resisted in favor of Figma.

At the same time, structured Figma data and tooling have not always been used consistently during implementation. In at least one case, available SVG assets were converted into PNGs, and screenshots were used as implementation references even though structured design specifications were available directly from Figma.

This creates unnecessary fidelity issues and weakens the value of requiring detailed design handoff in the first place.

## 5. Front-End Architecture and UI System

The implementation of the component and styling system has also been inconsistent.

The team moved between company styling approaches, MUI considerations, and eventually shadcn/Tailwind during development.

Changing direction can be reasonable, but a midstream change requires a clear migration and component strategy.

The resulting implementation has shown signs of:

- inconsistent component usage,
- one-off styling decisions,
- weak alignment with design tokens and reusable patterns,
- and unnecessary implementation divergence from design intent.

For a shared enterprise product, I would expect stronger ownership of the UI architecture and clearer conventions.

## 6. Bespoke Engineering and Tool Ownership

There have also been cases where custom solutions were created for problems that could potentially have been addressed through standard libraries or shared tooling.

Examples include custom map-marker behavior and a testing/agent harness that has not been broadly accessible or understood by the team.

Custom engineering is sometimes justified, but shared infrastructure should generally be:

- accessible,
- documented,
- reproducible,
- reviewable,
- and owned by the team rather than by one individual.

Opaque tooling creates maintainability and continuity risk.

## 7. AI-Generated Engineering Communication

The team has also repeatedly discussed the readability of AI-generated PR descriptions and technical comments.

Using AI to assist with engineering communication is not itself a concern.

The issue is that PR descriptions and comments have at times been excessively long, difficult to review, and insufficiently distilled into the engineer’s own explanation of what changed and why.

For senior engineers, I expect communication to make systems easier to understand, not introduce another layer of abstraction between the implementation and reviewers.

A useful PR should make it easy to answer:

- What changed?
- Why was it changed?
- What tradeoffs were made?
- What should reviewers focus on?
- What risks remain?

## Overall Concern

Taken individually, none of these issues necessarily indicates a serious problem.

Taken together, however, they suggest a recurring pattern:

- implementation decisions being made before the domain is fully understood,
- premature pressure to freeze product behavior,
- insufficient consideration of lifecycle and state,
- technical shortcuts without clear exit plans,
- unnecessary bespoke implementation,
- inconsistent adoption of shared tooling,
- and significant rework being required later to correct foundational decisions.

My concern is that the team has sometimes optimized for short-term implementation certainty rather than long-term product correctness.

For a product centered on dynamic market modeling, this creates significant risk because the underlying state model and lifecycle are more important than the apparent simplicity of the UI.

## Recommendation

I recommend that we use the current principal-engineering involvement as an opportunity to reset several foundations:

1. Establish a clear scenario domain model and lifecycle.
2. Persist compute results server-side and version them.
3. Separate historical published state from current market state.
4. Define the expected contract between the compute service and application backend.
5. Establish clear frontend component and design-system conventions.
6. Define when Figma, coded prototypes, and implementation prototypes should each be used.
7. Require shared ownership and documentation for internal engineering tooling.
8. Improve architecture review and technical discovery before major implementation decisions are committed.

I also think it would be useful to clarify expectations for senior engineering ownership on this team. In particular, senior engineers should be expected to challenge incomplete requirements, investigate lifecycle implications, surface technical risks early, and distinguish legitimate product discovery from uncontrolled scope change.

My goal in raising these concerns is to reduce rework and improve the quality of technical decision-making as the product evolves.