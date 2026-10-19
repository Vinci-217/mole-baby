# macOS 签名、公证与首次打开

v0.7.0 的 Mac 下载使用本地 ad-hoc 签名，没有 Apple Developer ID 签名或公证。`codesign --verify` 通过只能证明包内签名一致，不能证明 Gatekeeper 会接受从互联网下载的应用。macOS 因此会显示“Apple 无法验证‘拉姆’是否包含……恶意软件”。

## 当前版本先打开

确认安装包来自本项目的 GitHub Release，把“拉姆.app”拖到“应用程序”，尝试打开一次。在“系统设置 → 隐私与安全”下找到拉姆被阻止的提示，选择“仍要打开”，再按系统要求确认。这是针对当前应用的一次允许，不需要关闭 Gatekeeper 或执行清除隔离标记的命令。

## 发布免手动允许的版本

需要 Apple Developer 团队签发的 **Developer ID Application** 证书及私钥，并通过 Apple 公证。普通 Apple ID、本地签名、Apple Development 证书和单独的 `.cer` 不能替代这一步。

在 [本仓库的 GitHub Actions Secrets](https://github.com/Vinci-217/mole-baby/settings/secrets/actions) 配置：

| Secret 名称 | 内容 |
| --- | --- |
| `MACOS_CERTIFICATE` | 含私钥的 Developer ID Application `.p12`，以 Base64 编码；也兼容已有 `CSC_LINK` |
| `MACOS_CERTIFICATE_PASSWORD` | 导出 `.p12` 时设置的密码；也兼容已有 `CSC_KEY_PASSWORD` |
| `APPLE_ID` | 有权为该团队公证的 Apple 账号 |
| `APPLE_APP_SPECIFIC_PASSWORD` | Apple 账号生成的专用密码，不能使用账号登录密码 |
| `APPLE_TEAM_ID` | 对应开发者团队的 Team ID |

这些内容只填写在 GitHub Secrets，不要发送到聊天、提交到仓库或贴到构建日志。可在自己的 Mac 上用 `base64 -i /path/to/DeveloperIDApplication.p12 | pbcopy` 将证书编码复制到剪贴板，再粘贴到 Secret。

配置完整后，构建会自动选择 Developer ID distribution、启用 Hardened Runtime，提交 `.app` 给 Apple 公证并装订票据，然后创建签名 DMG、再次公证并装订 DMG。ZIP 内包含已装订的 `.app`。下载校验值在最终装订完成后计算。

发布前会检查 Developer ID 身份、`.app` 和 DMG 的票据以及两种容器对应的 Gatekeeper 策略结果；任一失败都不能标为已公证。Apple 芯片和 Intel 两个包必须达到同一信任状态。发布页顶部会根据实际验证记录写明“已公证”或“本地签名”，同时提供 `macos-trust-arm64.json`、`macos-trust-x64.json`。

完全没有凭据时，本地构建仍可使用原来的 ad-hoc 签名并明确提示。只配置了一部分凭据会报错，不会悄悄降级。需要强制公证时，可在本机环境指定 `MOLE_MAC_DISTRIBUTION=notarized`；缺少任何凭据将直接失败。

新增流程的本地测试使用虚构凭据和模拟 Apple 调用；只有真实 Developer ID、Apple 接受结果、stapler 和 Gatekeeper 检查都通过，才能证明某个下载已经公证。更改源码或文档不会改变已经下载的 v0.7.0 的信任状态。
