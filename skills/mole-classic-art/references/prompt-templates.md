# 可复用生成提示词

调用前先按 `SKILL.md` 看图并选择参考；以下内容需要带着对应原图一起使用。尺寸写入提示词；透明设置同时通过图片工具参数明确指定。提示词是起点，生成后仍须与原图、原角色同屏复核。

## 场景：晨光树洞书桌

参考图片 1：`public/assets/original/scenes/ramu-home.png`，负责平面树洞画法与留白。
参考图片 2：`public/assets/original/scenes/lake-cabin.png`，负责简化木板结构与轻俯视。
参考图片 3：`public/assets/original/scenes/ramu-school.png`，负责绿植和天空的色面。

```text
Create a new wide background illustration for a desktop pet application, 16:10 composition. Study the attached original early Chinese Flash browser-game references for drawing language, then design a different room; do not reproduce any one reference layout.

Scene: a cheerful morning study nook inside a hollow tree. A large honey-yellow wooden desk fills the foreground and lower half, viewed from a gentle elevated angle. A slightly uneven round window at upper left shows clear cyan sky and chunky yellow-green treetops. At the back right are three oversized simple books and one broad-leaf plant. A small plain leaf-shaped wall ornament is optional. Keep the number of objects low and their silhouettes large.

Drawing language: clean flat Flash-era game illustration, warm dark-brown continuous outlines, slightly irregular curves and short angular cuts, playful hand-built proportions, only two to four broad hard-edged color shapes per material. Indicate wood grain with a few long triangular patches, not realistic texture. Use honey yellow, apricot, warm brown, bright leaf green and clear cyan. Morning light is one or two pale-yellow flat patches, with short simple hard-edged shadows. Depth comes mainly from overlap, relative size and a gentle toy-stage perspective.

Composition: central lower desk area must be spacious, simple and light enough to read a red, yellow, blue or pink pet. Keep roughly the bottom 16 percent low in detail for the application toolbar. Place decorative details at the sides and back. Fill the entire rectangular image edge to edge with opaque artwork.

No characters, no pets, no animals, no faces, no text, no letters, no logos, no buttons, no interface frame. Avoid watercolor, paper grain, painterly brushes, realistic wood texture, detailed fantasy tavern decoration, Western storybook rendering, 3D rendering, photographic lighting, volumetric sunbeams, blur, depth of field, heavy gradients and dense small props. This is background art to sit behind the unchanged original Ram character sprites.
```

工具设置：`transparent_background: false`。生成后不要仅以“可爱”通过审核；重点看线条、色面、家具数量和角色站位。

## UI：原创同系面板与按钮底图

参考：`public/assets/original/ui/reference-pet-panel.png`、`button-orange.png`、`button-blue.png`。一次只生成一个完整控件；需要多态时用同一控件编辑，避免模型把一张不规则素材表当成可直接切割的精灵图。

```text
Design one original [panel / orange capsule button / blue capsule button] for a friendly Chinese Flash-era pet game interface, using the attached UI images as visual references. Keep its shape and detail simple enough to read at small desktop sizes. Use a clean white interior, a bright golden-yellow inner rim and warm orange outer contour where appropriate. Rounded but slightly playful proportions. Buttons may have one short pale highlight band and one narrow dark lower edge, like a small illustrated plastic toy, not a rendered 3D object.

The new design may have its own silhouette; do not duplicate labels or copy an entire reference interface. Leave the content area blank for HTML text. Center the complete isolated component, with generous transparent padding and no clipping. No words, letters, numbers, logo, checkerboard, scenic background, wood grain, leather, metal rivets, thick carved border, soft ambient shadow or realistic material texture. Output true transparency.
```

工具设置：`transparent_background: true`。如果要九宫格拉伸，优先保持四角与边带清楚、中心纯净；实际切片参数由接入时测量，不让模型代写 CSS。

## 道具：原创单个库存图标

参考：`public/assets/original/items/180017.png`、`180027.png`、`180008.png`，按食物/植物果实/容器选相关的至少两张，并加看完整 UI 的格子比例。

```text
Draw one new [describe the food, drink, toy or care item] as an inventory icon that fits the attached early Chinese Flash pet-game item references. A strong, slightly exaggerated silhouette, warm dark-brown or darker-local-color outline, a few broad flat color areas, one short hard-edged highlight and a small simple shadow shape. Use a gentle three-quarter view only if it makes the item easier to recognize. Keep small internal details sparse so the item remains clear at 48 pixels.

Center the entire object with transparent padding on all sides. No scene, no plate or container unless specified in the item design, no text, no sticker label, no border, no watermark, no fake checkerboard, no photorealism, no watercolor or paper texture, no soft 3D lighting. Do not add a Ram face as decoration. This is one isolated original item, not a sprite sheet or a collection.
```

工具设置：`transparent_background: true`。新图应取新名称；复用“可可果”等现有道具时优先直接使用已有 PNG，避免不同外观共用同一原名称。

## 迭代指令示例

```text
Edit the new candidate while keeping its room layout and empty central desk. Compare the attached original room again: replace the realistic wood grain with three large flat color patches, make the main dark-brown contours clearer, remove the soft lighting and lens blur, and reduce the books to three large simple silhouettes. Keep the background opaque. Do not add characters or interface elements.
```

每轮只记录实际修正的问题和结果，不声称提示词足以保证一致，也不声称通过这种参考工作流完成了模型训练。
