# Windows 桌面版开发

Windows 与安卓共用 src、public、index.html 和版本号，计算核心没有另写一份。

## 桌面容器
- Electron 44.7.0 Windows x64，运行环境打包随软件分发。
- windows/main.cjs 管理本地协议、窗口、文件保存、默认浏览器与受限 HTTPS 请求。
- windows/preload.cjs 只暴露明确的桥接操作。页面没有 Node 权限，启用 sandbox、contextIsolation 和 webSecurity，禁止远程导航及子窗口。
- 固定 fgosolo://app 本地地址保证 LocalStorage 和 IndexedDB 在重启及升级后延续。资源协议仅允许 index.html/src/public。
- windows/policy.cjs 限定原生请求为 Atlas、Mooncell 公开查询和 GitHub 最新发布接口；不允许任意 URL、文件或命令执行。
- 原生备份保存使用系统对话框；导入仍走现有格式校验。用户数据位于 %APPDATA%/FGO-Solo。
- 平台差异集中在 src/platform.js 与 src/data-fetch.js。安卓没有 Desktop 桥接时保持原有路径。
- 更新检测保留 hasApk 兼容字段，界面使用 hasDownload 判断当前平台的附件。

## 构建
使用 Node.js 22.12 以上、Windows PowerShell 7。依赖放在工程同级 开发安装/环境。

1. 运行 scripts/prepare-windows.ps1，下载固定版本的运行环境和资源工具并校验。
2. node scripts/build-windows.mjs。再次构建同一版本加 --refresh，仅重建 dist 下对应生成目录。
3. node tests/windows-smoke.mjs 可验证开发容器；指定环境变量 FGO_TEST_EXE 为打包 exe 的路径可直接测试发布程序。
4. 运行 scripts/archive-windows.ps1，生成 Windows ZIP 和 SHA256-Windows.txt。
5. 运行 scripts/package-windows-source.ps1 导出包含两端源代码的干净源码包。

图标已作为 windows/icon.ico 提供。只有更新图标时才需要 generate-windows-icon.mjs，它使用开发机器的 Playwright/Edge。
当前 UI 测试脚本使用开发机器已安装的 Playwright 路径，换机器时需调整 createRequire 路径；终端用户不需要任何这些工具。

## 版本与发布
使用现有 set-version.mjs 同步版本，Windows 构建从 package.json 读取。GitHub 正式 Release 同时附加 APK 和 FGO-Solo-Windows-版本-x64.zip。没有签名证书，当前 exe 未做作者代码签名。
不要上传 android/signing 或用户备份；源码导出脚本不会包含这些内容。Electron 自带的 LICENSE 和 LICENSES.chromium.html 保留在发布目录。
