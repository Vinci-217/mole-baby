# 初级身体原帧 + 逐帧绑定的中级叶片 · 未发布

> 本页为v37历史记录；用户指出叶片位置不自然，当前修订见[v38：中央叶柄、课程与小屋](v38-school-room.md)。本页原效果可在[历史提交](https://github.com/Vinci-217/mole-baby/blob/0ccd09173245e1bd944715e81a85c3e7270e3f63/README.md)查看。

本轮按用户最新指定的方法实现：提取初级拖动的身体序列，把中级叶片序列绑定到同一身体，再生成完整PNG帧序列。此前v36的中级贴地压缩方案被替换，v35缩小、裁切叶片的拼接也不复用。

## 直接查看

- [实际应用录制：左初级，右中级，同步拖动与松手](../artifacts/animation-gallery/drag-young.gif)
- [合成帧循环：原身体 / 同一身体加叶片](../artifacts/v37-bound/bound-sequence.gif)
- [PNG逐帧下载：五方向各15帧，共75帧](../artifacts/v37-bound/frames-red.zip)
- [五方向抽帧图](../artifacts/v37-bound/frames.png)
- [中级单独实录](../artifacts/animation-gallery/middle-bound.gif)

原帧循环显示生成的贴图；实际应用实录另外包含鼠标输入、转向、惯性、松手和回待机，不能把两者混为同一段录像。

## 身体与叶片怎样结合

身体、眼睛、嘴和颜色遮罩直接复用已有初级75帧，PNG原文件不变。两个阶段也共用初级的取帧、速度、方向切换、挤压和回弹参数，不再给中级另写一套压缩动画。左右拖动不叠加独立的上下跳跃，身体形变保留初级原帧。

叶片纹理来自原中级五个朝向的初始姿态。先在原SWF中隐藏身体放置层，保持原始画布边界，导出完整双叶；以原叶柄与身体的接点作为根部关节。然后从原纹理生成17档根部固定、外侧叶尖弯曲的姿态，按初级身体形变量选帧。用初级头顶高光及身体轮廓追踪绑定位置，叶片角度增加短暂延迟，表现拉扯后的跟随回摆。没有混合两张叶片轮廓造成重影。

每帧将叶片画在身体之后，原身体已有像素的位置完全保留。最后离线合成75张中级完整PNG，打包为中性色图集与颜色遮罩，客户端直接取帧。**叶片弯曲、关节绑定及桌面拖动编排属于本项目适配，不称为官方完整拖拽动作。**

初级格子仍是192×208。中级透明格子扩展为320×272，原点偏移为−64、−56，身体仍按192×208坐标和原尺寸显示；扩展的是透明留白，叶片没有为了塞进格子而缩小或裁掉。装扮仍按原身体坐标跟随。中级拖动和松手期间，桌面气泡收成一行，给上方叶片留出空间。

## 来源

原页游文件为[社区存档的lamubone.swf](https://raw.githubusercontent.com/Miigon/RecMoleRes/master/root/resource/NPC/lamubone.swf)，SHA-256：

`01abf65f3e8db098068a830268bd7a7cefefc1edc93a44565788783d23f8a0cf`

初级主Sprite936，中级主Sprite1532。中级叶片导出只隐藏方向Sprite958、978、980的身体放置层depth3。各帧原始来源、叶柄关节、目标关节、角度、比例、姿态档位和可见比例记录在[source.json](../public/assets/original/drag/source.json)，运行布局见[runtime.json](../public/assets/original/drag/runtime.json)，图集哈希见[checksums.json](../public/assets/original/drag/checksums.json)。

## 验证范围

- 75帧中，初级身体可见RGBA和颜色遮罩逐像素一致；初级原PNG与修改前字节一致。中级叶片在身体遮挡之后保留97%以上，未触及格子裁切边界。
- 实际应用录制比较102帧：身体像素差为0，帧号、拖拽弹性变换、源像素显示比例相同。记录见[young-drag-checks.json](../artifacts/animation-gallery/young-drag-checks.json)。
- 四种颜色、两件原素材装扮、双向拖拽、松手回待机通过浏览器检查；生产构建另覆盖全部八种形态、装扮、道具图片及中级拖拽气泡留白。
- 232项Vitest、54项Node测试通过。710张图片84.80 MB → 无损WebP 50.32 MB，透明度及可见RGBA逐张一致。离线生成工具、预览GIF和PNG序列ZIP不进入客户端安装目录。
- 本轮未运行Windows/macOS实机或安装包构建；未改变睡眠、摸摸、足球及其他阶段的画面。

## 重现

准备好原SWF的XML及FFDec后，先导出五方向的原动作与颜色探针。以下路径均为本地生成缓存，不提交原始大文件：

```sh
python3 -m pip install numpy pillow opencv-python-headless==4.11.0.86
python3 scripts/art/prepare-original-actions.py --ordinary-xml /path/lamubone.xml --sources /path/source-xml --work /path/original-export --ffdec /path/ffdec-cli.jar --forms ordinary --actions down,leftdown,left,rightdown,right --omit-middle-insect
java -jar /path/ffdec-cli.jar -selectid 1532 -zoom 12 -ignorebackground -export sprite /path/highres-original/frames /path/original-export/reference.swf
java -jar /path/ffdec-cli.jar -selectid 1532 -zoom 12 -ignorebackground -export sprite /path/highres-original/probe /path/original-export/ordinary-probe.swf
python3 scripts/art/export-bound-crown.py --reference /path/original-export/reference.xml --ffdec /path/ffdec-cli.jar --output /path/crown
python3 scripts/art/author-bound-crown.py --original /path/highres-original --leaves /path/crown/leaves --clips /path/original-export/clips.json --output /path/authored --review artifacts/v37-bound
python3 scripts/art/pack-bound-crown.py --authored /path/authored
npm test
npm run build
node scripts/record-horizontal-drag.cjs --young
node scripts/record-horizontal-drag.cjs --middle
node scripts/record-horizontal-drag.cjs
node scripts/young-drag-regression.cjs
node scripts/compact-production-check.cjs
node scripts/render-animation-readme.cjs
```

生成器读取仓库已有的初级原帧、经典中级图集和运行元数据。重新导出叶片的80张原图已经与本轮输入逐一核对一致。

仅提交预览分支`preview/ramu-drag-study`。没有修改main、版本号、标签、Release或自动更新渠道；待用户审阅本轮效果。
