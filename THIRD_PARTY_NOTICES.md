# Third-party notices

## Hype-yolo Claude Motion renderer

`scripts/render.mjs` is adapted from the Canvas renderer in
[`Hype-yolo/claude-motion-skill`](https://github.com/Hype-yolo/claude-motion-skill),
fixed at commit
[`607fe9801529bb493b1968cd967a3e8a959d42c1`](https://github.com/Hype-yolo/claude-motion-skill/tree/607fe9801529bb493b1968cd967a3e8a959d42c1).
The source was obtained from `research/upstream/scripts/render.mjs` in this
workspace. The local adaptation adds output collision protection and keeps the
renderer usable with a project-local or explicitly supplied Playwright module.

The original project code is distributed under the MIT License. The complete
license text is preserved in
[`licenses/HYPE_YOLO_CLAUDE_MOTION_MIT.txt`](licenses/HYPE_YOLO_CLAUDE_MOTION_MIT.txt).

## Playwright

The package depends on `playwright` 1.63.0, which in turn depends on
`playwright-core` 1.63.0. Both packages are Apache License 2.0 software; their
exact package URLs, integrity values, and versions are recorded in
`package-lock.json`. The Playwright distribution includes its own license and
notice files when installed.
