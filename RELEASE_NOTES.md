拉姆 v0.7.0 · Windows + macOS

- 新增 macOS 原生版本，分别提供 Apple 芯片 arm64 和 Intel x64 的 DMG、ZIP；Windows 继续提供安装器与 ZIP。
- Mac 双叶图标常驻菜单栏，不占 Dock；关闭与最小化隐藏，菜单退出或 Command+Q 真正结束。桌宠支持跨桌面空间，小屋留在当前空间。
- 适配 Mac 原生复制、粘贴等编辑快捷键。DeepSeek、存档、记忆、照料、商店、背景音乐与小游戏共用现有实现。
- Mac 语音输入采用系统听写，回复可选系统中文朗读；Windows 保留原有中文离线语音识别。
- CI 分别启动 Windows、Apple 芯片和 Intel 的实际成品，Mac 额外检查原生架构、本地签名、DMG 挂载和包内资源，所有平台通过后统一发布。

Mac 最低系统要求 macOS 12。打开 DMG 后把“拉姆”拖到 Applications。Apple 芯片下载 mac-arm64，Intel 下载 mac-x64。当前 Mac 包采用本地签名，未进行 Apple 开发者公证；若被系统拦截，到“系统设置 → 隐私与安全”核对并选择“仍要打开”。

附件包含六个安装/压缩包及 SHA256SUMS.txt。兼容旧存档；真实听写与朗读依赖用户本机系统设置，DeepSeek 需用户自行填写 Key。
