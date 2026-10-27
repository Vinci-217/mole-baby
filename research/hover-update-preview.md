# Floating hover and consent-based update preview

This preview continues the proportion/timing work on `preview/proportion-polish`.
No release, version tag or update-channel publication was performed.

## Floating white strip

The existing native caption/resize guards remain in place. Two browser-native
hover sources remained in floating panels: multiline `CarePocket` item titles
and the redundant `PetInvitation` call-name title. A tooltip is a separate native
window and can remain after the transparent host is resized or its panel closes.
Compact inventory now uses bounded, accessible DOM hints within the existing
panel. Pointer leave, keyboard blur, category/page/visit changes, consumption and
unmount clear the hint. Room-only inventory tooltips remain available.

The floating regression checks idle/food/play have no native title tooltips,
hover for longer than the native tooltip delay, close/reopen panels and verify
unused space above the pet remains alpha-transparent. Windows package smoke also
checks process-owned visible HWNDs after hovering and closing the inventory,
alongside the existing caption/style/client-inset checks. A renderer screenshot
alone cannot see a separate native tooltip window.

## Update consent

Startup/wake checks only discover a newer release. A native dialog asks before
downloading; a second dialog asks before opening an installer or updating and
restarting. Both default to deferring, and Escape/closing never grants consent.
Settings and tray actions use the same coordinator. Repeated startup callbacks
are deduplicated per version; manual retry remains possible. Stale dialog answers
cannot authorize a different version. `autoInstallOnAppQuit` remains false;
turning startup checks on does not authorize download or installation. Checksum,
architecture and save-checkpoint validation remain in place.

## Validation

- `npm test`: 260 Vitest tests and 65 Node tests passed.
- Production application/CSS rebuilt and typechecked, reusing the unchanged738
  atlases previously compressed with full pixel/alpha verification.
- Full production browser and Linux Electron cloud regression: passed.
- Real Linux native download/install dialogs displayed and captured; Escape
  deferred both with zero downloads, installations or restarts.
- Hover hint screenshots and clear-top alpha checks: passed.
- Previous proportion review: 288 active visual combinations, reduced motion,
  wardrobe and six full24fps recordings remain available.

Review output: `artifacts/transparent-hover/`, `artifacts/update-consent/`, and
`artifacts/proportion-review/index.html`. Update-dialog version0.30.0 is a local
simulated test version; no release was fetched or published by that check.

This workspace is Linux. Actual Windows HWND/hover and NSIS update tests were
added/updated but have not been executed here. GitHub Actions API access was
forbidden from this environment, so no Windows CI result is claimed. Run the
Windows package workflow before publishing; the user's screenshot is not yet
confirmed fixed on a Windows machine.
