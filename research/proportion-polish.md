# Proportion and tiredness preview

Review branch: `preview/proportion-polish`. Target release: v0.29.5. The user explicitly requested publication after the fixes and verification.

This revision reuses the existing original-game character atlases. It is a desktop
registration/timing adaptation, not newly recovered official animation frames.
Sources and hashes remain in `public/assets/original/{grounded,drag,slumber}/`
and `ASSETS.md`; the full original motion review is documented in
`skills/mole-classic-art/references/animation-guide.md`.

## Corrections

- A shared proportions layer scales the seed to 90%, junior to 82%, and middle
  to 94%. Body, flowerpot, foliage, clothes, contact props and sleep particles
  stay together; the native drag area and window remain stable.
- Junior calm/sleep/care frames were 127 source pixels high, versus the canonical
  107px animated body. Fixed registration about the original baseline removes
  the silhouette jump on entering/leaving these actions.
- Middle drag uses a junior-source performance. Its 153px first-frame body now
  fits middle's 122px resting body, with the resting baseline retained. The same
  fixed transform applies to all source frames, crown and clothing. It does not
  refit each frame, so the original squash/stretch and turns remain intact.
- Junior and middle side-walking rows use a fixed height/baseline registration
  rather than shrinking to their differently exported atlas coordinates.
- Care contact and snore emission points use the body's registration too.
- Seed tiredness response lasts 2.4s instead of 4.3s. Sleep mouth opening lasts
  1.4s instead of 3.3s per 6.4s breath. Sleep remains continuous until waking;
  food consumption and growth timing are unchanged.
- Edge hide/peek offsets account for the revised body size.

## Reproduce review

```sh
npm test
npm run build
node scripts/proportion-regression.cjs
python3 /workspace/.ramu-env/regression.py browser
dbus-run-session -- python3 /workspace/.ramu-env/regression.py desktop
```

The new visual review uses the real React/CSS/canvas renderer, eight forms and
four colors at actual 100px size, registered clothing, reduced motion, and
full-rate recorded animations. Outputs and check results are generated into
ignored `artifacts/proportion-review/`. Existing screenshots overwritten by the
older smoke tests are preserved by the local cloud helper above.

The release workflow builds and runs modern Windows x64, legacy Windows x64/ia32, and both Mac architectures before publishing. Windows 7/8/8.1 hardware/VM acceptance remains a separate unexecuted check; see `docs/WINDOWS.md`.

Visual measurements passed 288 active cases, 128 reduced-motion cases and 16 outfit cases, with maximum registered body-width deviation 1.04px. Six 24fps clips contain 809 frames. The production Linux desktop smoke passed native cursor/four-edge checks, transparent hover and both native update-cancel dialogs. Electron 22.3.27/Node16/Chromium108 independently passed production care/settings and the CSP probe.

Release CI also exposed a host-architecture leak in the Windows lifecycle test fixture on Apple Silicon. The fixture now explicitly simulates x64 Windows, with separate ia32 coverage; all 25 lifecycle tests pass with an emulated ARM64 host. The blocked v0.29.3 tag was never published; v0.29.4 then reached actual platform packaging checks.

The v0.29.4 packaging gate caught parallel NSIS/ZIP payload divergence and a legitimate welcome bubble in the Mac transparency fixture. Windows packaging now completes NSIS before archiving the same prepackaged directory; exact-file validation remains strict. The transparency check dismisses visible bubbles through the normal UI before measuring unused alpha. Publication targets v0.29.5 with 278 frontend and 92 Node tests.
