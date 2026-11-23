# ClipClip Product Insights

## Why this exists

ClipClip combines three jobs that usually live in separate tools:

- fast browser-based handoff between devices
- immutable text sharing
- lightweight local file transfer

## Product references

### PairDrop

What it gets right:

- The first screen is the product, not an explanation page.
- The user understands the action model immediately.
- Sharing actions stay close to the main surface.

What ClipClip adopts:

- The first screen should always be usable.
- Sharing actions should be one step away from the main surface.
- Results should be actionable right away, with direct open and copy controls.

### PrivateBin

What it gets right:

- Immutable content feels trustworthy.
- Expiration is part of the mental model, not hidden metadata.
- Read-only pages are clear and copy-friendly.

What ClipClip adopts:

- Fixed paste links should feel stable after creation.
- Expiration should be visible near the created result.
- The paste view should keep focus on reading and copying.

### Etherpad

What it gets right:

- Real-time collaboration is obvious.
- Connection state is visible.
- The editor area is central and persistent.

What ClipClip adopts:

- The live clipboard is the primary surface.
- Sync state should be visible without looking technical.
- The shared text area should dominate the layout.

### LocalSend

What it gets right:

- File transfer is framed as a simple action rather than a workflow.
- The selected file is visible before sending.
- Transfer surfaces avoid unnecessary clutter.

What ClipClip adopts:

- File upload should show selected file context before upload.
- File results should give a direct next step.
- The file panel should stay compact and easy to scan.

## Interaction principles for ClipClip

1. The main clipboard stays primary.
2. Link sharing and file drop stay secondary, but immediately available.
3. Every successful action should return a result with an obvious next step.
4. Internal-tool UI beats marketing UI.
5. Bilingual copy should stay short and operational.
6. Advanced network setup belongs in docs, not in the critical path.

## Principles from the UI/UX simplification round

The精简 (simplification) refactor added these interaction principles:

7. **Never show a dead shell.** UI controls bind independently of initial data loads; any failed request still leaves the interface operable with a retry path, and an expired/missing paste gets its own clear error page rather than a frozen app.
8. **Don't let the network fight the user.** Local in-progress typing is never overwritten by a remote SSE update; changes are saved automatically (debounced), with an explicit "remote updated — apply/discard" prompt on conflict instead of silent text loss.
9. **Lean by default.** Fewer DOM layers, no duplicated first-screen elements, modular UI code, and no render-blocking work — speed and clarity over decoration.
10. **Accessible is not optional.** Adequate color contrast in both light and dark themes, ≥44px touch targets, no horizontal scrolling at narrow widths, and screen-reader status announcements (aria-live).
11. **Security adapts to context, not to friction.** Local use stays zero-friction with no login prompt; the login screen appears only in public mode, so safety never intrudes on the trusted-LAN experience.
