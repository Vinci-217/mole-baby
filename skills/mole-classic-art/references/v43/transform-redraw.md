# 变身造型重绘记录

- 日期：2026-10-27；用途：预览分支静态概念图，尚未接入应用，也不是变身动画。
- 工具：`image_gen.imagegen`；独立透明背景：`true`。没有用程序绘制或修改角色图片。
- 参考：`public/assets/original/pets/middle-red-idle.png`（拉姆身体与眼睛）、`skills/mole-classic-art/references/v41/original-form-colours.png`（不同形态与配色）；各形态原候选 `artifacts/transform-concepts/*.png` 仅用于标识目标物种。小树修订另以本轮被否定的小树草图为编辑输入。
- 风格观察：身体为扁圆色块；相邻白色椭圆眼和黑瞳位于身体下部；叶片为绿色大色面；高光短而简单；角色四周留透明边距。
- 四图是新绘改编，不是官方原帧；原有候选文件保留。

## 小鸟、小树第一稿和小猫的共用提示词

```text
Draw ONE newly illustrated transformation of the EXACT original Ram in FIRST reference image. The same Ram's original red one-piece flattened rounded body and two adjacent LARGE WHITE OVAL EYEBALLS with small black oval pupils must stay clearly recognizable; the low facial position, red body color, green leaves, flat Flash-game finish and short highlights are the core identity. Do NOT replace the white eyes with plain black generic cartoon eyes, do not give it a separate head and torso or human-like limbs, and do not redesign it as an unrelated animal. Add a small number of natural species features while preserving the original Ram face and body and a compact well-balanced silhouette. The SECOND reference depicts prior rejected target only to identify the species, don't copy its character design; THIRD reference shows exact Ram forms, eyes and colors, do not copy the grid or labels. One complete isolated subject in the center with generous margins, true transparent background. Clean simple flat 2D game artwork with clear colored outlines and restrained highlights, readable at 100px, no heavy black outer stroke, no photographic lighting, no gradients/3D, no random detached pixels, text, background, border, smoke, props, shadow, or checkerboard. 新绘改编，不是官方原帧。
```

各形态附加要求：

```text
变身为小鸟：圆润的一体红色拉姆身体自然生出两只小红翅膀、极小的暖黄色鸟喙和两只简洁小脚，保留绿色双叶，并有一个小尾羽。造型是一只拉姆变成的鸟，翅膀是身体的一部分，不是穿戴装扮。
变身为小树：拉姆的一体红色身体向上自然长出短树干和圆润的绿色树冠，底部自然延伸成短树根，白色椭圆眼睛仍位于拉姆身体上；绿色双叶融合在树冠里。形状应像一只拉姆变化成的小树，有舒展自然的树冠和接点，而不是一个红色球顶着孤立盆栽。
变身为小猫：一体红色拉姆身体自然生出两只短小尖猫耳、一个自然弯曲的红色猫尾和两只小猫爪，保留绿色双叶；眼睛与原拉姆一致。猫耳和尾巴是身体的一部分，不是头套或衣服，避免拟人化四肢。
```

## 小树修订提示词

```text
Redraw the FIRST image as a Ram transformed into a little TREE, based on the original Ram in the SECOND image. The previous tree is wrong because it looks like an unrelated tree sitting on a red ball. Instead create ONE unified little tree creature: its trunk itself is the Ram's body, transitioning naturally from the original rounded red base into a warm reddish-brown trunk, the pair of large original white oval eyes with black pupils sits on the trunk itself, the trunk spreads into short roots at ground level. Its iconic green two-leaf sprout grows into a modest rounded leafy canopy seamlessly attached to this same trunk, not a tree balanced on a separate blob. Preserve the original Ram's simple flat 2D Flash game style and face, not generic animal eyes. Compact balanced silhouette, no separate pet head or unrelated tree. Isolated single full character, transparent background, no text, no props, no shadows, clean edges, modest highlights. The image is a new fan-made design, not an official frame.
```

## 兔子

使用原版红色拉姆和原兔子候选作为参考生成：要求保留一体红色身体、白色椭圆眼睛、黑瞳和绿色双叶，加入兔耳、短尾与小脚，透明背景。该次调用的完整原始提示词未保存，此处只记录可核实的要点。

## 输出尺寸与检查

兔子 1306 × 1205，小鸟 1312 × 1199，小树 1312 × 1199，小猫 1375 × 1144，均为透明 PNG。小鸟、小树和小猫边缘存在少量最大透明度为 1/255 的像素；没有不透明边缘像素。在浅色和深色背景下以 100 × 100 画布检查了缩略显示；该检查不代表游戏内动画或实际窗口已测试。
