# Original Mole Manor Flash UI reference and exports

These PNGs are rasterizations of SWF DefineShape/DefineSprite/DefineButton assets, not community redraws or generated artwork. The SWFs come from a community archival mirror: Miigon/RecMoleRes, commit 7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff (2019). The archive README states “本仓库存储了 RecMole 所用到的官方资源文件”. This identifies provenance as archived official-client artwork; it does not imply the GitHub repository is operated by the game publisher.

## Source URLs

- Archive and provenance: https://github.com/Miigon/RecMoleRes
- Lahm care / inventory UI: https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/module/petUI/petUI.swf
- Global UI, expressions and toolbars: https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/ui/ui.swf
- Global dialogs, close button and speech bubbles: https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/ui/index.swf
- Top UI: https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/resource/ui/topUI.swf
- Mini-game UI: https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/module/gameUI/gameUI.swf
- Shared controls: https://raw.githubusercontent.com/Miigon/RecMoleRes/7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff/root/dll/ClientCommonDLL.swf

## Reproduction

JPEXS Free Flash Decompiler 26.3.0, headless Java. All exports are transparent PNG at 2x (except toolbar controls, 3x), without executing ActionScript.

- petUI-export/shapes: 91 original vector shapes rasterized to PNG.
- petUI-export/sprites/DefineSprite_182_petPanelMC/1.png: actual full care/inventory UI.
- ui-export/sprites/DefineSprite_4081_pet_panel_pet_panel/1.png: actual compact Lahm stats UI.
- index-export/sprites/DefineSprite_1110_Alert_simpleAlert/1.png: original generic dialog.
- ui-firstframe-contact.png and petUI-shapes-contact.png: inspection contact sheets assembled from exports.
- ready/: direct copies under semantic file names; manifest.json links each to its source character ID and hashes.

## Observed art direction

The actual archived Lahm panels are golden-orange, with a thick dark-gold outer line, an orange inset, white inner paper, rounded corners and tiny corner rivets. Primary buttons are red-orange glossy pills with a broad white outer contour. Secondary controls use blue-cyan pills. The close control is a golden round orange X. Status values use bright pink capsule fills. Care icons are tiny flat full-color drawings: toast, a heart mug, a water droplet, and a heart with music. Tabs and inventory cells use the same golden-orange outline. Avoid generated wooden planks, grain textures, pastel watercolor, complex painterly shading, and unrelated symbols.

Preserve icon meaning: cap/medal/ticket/book are genuine inventory tabs, not necessarily the semantic icons for every new application action. Use the original food item PNGs from the parallel item export for concrete feed choices.
