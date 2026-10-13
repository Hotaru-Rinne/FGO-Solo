# 一骑千筹：GitHub 上传、双平台发布与邮箱隐私

适用版本：0.4.3；核对日期：2026-10-13。当前尚未建立作者仓库，下面由你登录自己的账号操作；准备好的文件均在本地。

## 先理解要上传的两类内容

只需要一个公开仓库，例如 FGO-Solo，就能放 Android 和 Windows 两版。两版共享计算核心与界面。

- 仓库的 Code 页面：存放源码，根目录直接显示 README.md、src、public、android、windows 等。
- 仓库的 Releases 页面：给普通用户下载安装。每次正式发布同时上传 APK 和 Windows ZIP。
- GitHub 的 Source code (zip) 是自动生成的源码压缩包，不是安装包。
- Windows ZIP 约 156 MB，放 Release 附件；网页提交源码单文件限 25 MiB，普通 Git 文件限 100 MiB，Release 单个附件须小于 2 GiB。

## 一、注册账号，先保护邮箱

1. 打开 https://github.com/ ，选择 Sign up 注册。可以用 QQ 邮箱，按提示完成邮箱验证。用户名可以和应用名、作者名不同。
2. 登录后点右上角头像 → Settings → Emails，或直接打开 https://github.com/settings/emails 。
3. 勾选 Keep my email addresses private（保持邮箱私密）。
4. 勾选 Block command line pushes that expose my email（阻止可能暴露邮箱的命令行推送）。
5. 在该页找到 GitHub 分配的 noreply 地址并复制保存。新账号一般形如 数字ID+用户名@users.noreply.github.com，必须复制你账号页面提供的完整地址。
6. 在 Settings → Public profile 中确认 Public email 不显示 QQ 邮箱；如果显示，改为不公开并保存。

QQ 邮箱是注册信息，不会因为仓库设成 Public 就自动展示给访客。真正容易暴露的是：个人资料的公开邮箱、Git 提交记录中的作者/提交者邮箱、上传文件或自己发布的内容。若暴露的是数字@qq.com，也就暴露了对应 QQ 号码。

打开邮箱隐私后，通过 GitHub 网页提交文件会使用 noreply。以后使用本机 Git 或 GitHub Desktop 时，还要在首次提交前单独设置提交邮箱，不能只依靠网页隐私开关。命令行推送拦截不是完整历史扫描，不能代替正确的邮箱配置。

已经提交并公开过的真实邮箱，不会因后来改设置而从历史消失；别人可能已复制。使用同一昵称、头像等也可能被关联，所以不能保证绝对匿名。

## 二、新建一个公开仓库

1. 打开 https://github.com/new 。
2. Owner 选自己的账号。
3. Repository name 填 FGO-Solo（也可以自行取英文仓库名）。
4. Description 可填：一骑千筹：面向 FGO 单挑玩家的 Android / Windows 战斗计算器。
5. 可见性选 Public（公开）。
6. 不预建 README、.gitignore 或许可证：准备好的源码已有前两项。许可证等明确授权意愿后再选。
7. 点击 Create repository。

仓库建好后，地址为 https://github.com/你的用户名/FGO-Solo 。任何人都可以访问公开源码；发布后的 Release 附件可供下载。

“公开源码”和“授予开源许可证”是两回事。如果要允许别人按明确条款修改、分发，之后再选择合适许可证；不要随手选一个不符合自己意愿的授权。

## 三、上传两版源码

使用已经整理好的源码目录：

C:\计算器项目\FGO-Solo\dist\FGO-Solo-Windows-0.4.3-source

名字虽含 Windows，里面同时包含安卓与 Windows 源码；不要把原工程整个上传，也不需要建两个仓库。

1. 打开刚建好的仓库。空仓库点 uploading an existing file；已有文件则点 Add file → Upload files。
2. 在资源管理器打开上面的 source 文件夹，选中里面的文件和文件夹，拖进上传区域。拖的是里面的内容，不是外层 source 文件夹，也不是 source.zip。
3. 等所有文件上传完成。在提交说明填写：发布一骑千筹 0.4.3 双平台源码。
4. 点击 Commit changes。若显示分支选择，首次直接提交 main 即可。
5. 确认仓库根目录直接有 README.md、package.json、index.html、.gitignore、src、public、android、windows、scripts、tests、docs。
6. 本次整理包不足 100 个文件；GitHub 网页单批上限为 100 个文件。日后超过上限可分批上传，保持文件相对路径。

源码目录已排除应用签名密钥、运行环境、构建缓存和安装文件。请单独妥善备份原工程的 android/signing/local-development.p12；后续安卓正式更新必须继续使用原签名。不要把该文件或个人计算备份传到公开仓库。

可选：以后用 GitHub Desktop 管理增量修改时，先克隆已有仓库（File → Clone repository），再把修改的源码放进去。在 File → Options → Git 中选择 GitHub 提供的 noreply 邮箱或手动填写它，再 Commit 和 Push origin。不要填 QQ 邮箱。使用命令行 Git 的话，在该仓库目录运行 git config user.email "复制的完整noreply地址"。

## 四、发布安卓和 Windows 下载文件

1. 在仓库右侧找到 Releases，点 Create a new release 或进入后点 Draft a new release。
2. Choose a tag 填 v0.4.3，并创建该标签。Target 选刚上传完整源码的 main。
3. Release title 填：一骑千筹 0.4.3。
4. 说明可复制 docs/发布说明-0.4.3.md。
5. 在附件区依次上传下面四个文件，等上传完成：
   - dist/FGO-Solo-0.4.3.apk
   - dist/FGO-Solo-Windows-0.4.3-x64.zip
   - dist/SHA256.txt
   - dist/SHA256-Windows.txt
6. 若希望额外提供整理过的源码包，可再上传 dist/FGO-Solo-Windows-0.4.3-source.zip。
7. 不勾选 This is a pre-release。若有 Set as latest release，勾选它。
8. 点击 Publish release。不要只 Save draft；草稿不会成为公开的正式更新。
9. 发布后用未登录浏览器打开仓库的 Releases，确认 APK、Windows ZIP 都能看见、下载。

Windows 用户需要完整解压 ZIP，再运行里面的“一骑千筹.exe”，不能只下载或单独复制 exe。Android 用户下载 APK 安装。Release 页面自动出现的 Source code (zip) 只给需要源码的人。

## 五、让应用连接你的更新仓库

当前两版的官方仓库字段留空，因为你还没有提供实际仓库地址。

- 现有应用：开始界面 → 检查更新，输入 你的用户名/FGO-Solo 或完整仓库地址，再检查。这个输入只保存到当前设备。
- 发布前建议把实际仓库地址交给开发者，写入 src/release-config.js 的 repository 并重新构建两版；作者页也会显示链接，普通用户无需手填。
- 程序读取该仓库最新正式 Release，依据 v0.4.3 这样的版本标签比较。只提交代码、只改标题或保留草稿都不构成正式新版。
- 同一个 Release 必须同时附加两个平台的文件。Android 检查 APK，Windows 检查对应 Windows ZIP/EXE。
- 当前应用是 0.4.3，因此发布 v0.4.3 后检查结果为当前已是最新版；旧版 0.4.2 才会提示有更新。
- 更新按钮打开默认浏览器中的发布页，由用户下载和安装/解压，不是后台静默安装。

## 六、下次更新

1. 修改并验证源码，同时递增应用版本及 Android 版本序号。0.4.3 / 7 之后例如使用 node scripts/set-version.mjs 0.4.4 8。
2. 更新文档，再运行 scripts/build-android.ps1 和 node scripts/build-windows.mjs。
3. 运行 scripts/archive-windows.ps1 生成桌面 ZIP，校验文件会随构建更新。
4. 将新版源码提交到 GitHub，再创建与实际程序相同版本号的新标签和正式 Release。
5. 上传新版 APK、Windows ZIP 和两份校验文件；继续使用原 Android 签名。
6. 用旧版应用检查更新，完成真实下载、覆盖升级验证。

若刚发布首版后才决定内置仓库地址，建议用下一版本发布这个变更，不要让相同版本号指向不同正式构建。

## 官方参考

核对于 2026-10-13：

- 提交邮箱与 noreply：https://docs.github.com/en/account-and-profile/how-tos/email-preferences/setting-your-commit-email-address
- 阻止暴露邮箱的推送：https://docs.github.com/en/account-and-profile/how-tos/email-preferences/blocking-command-line-pushes-that-expose-your-personal-email-address
- noreply 格式：https://docs.github.com/en/account-and-profile/reference/email-addresses-reference
- 新建仓库：https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository
- 网页上传文件：https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- 文件大小限制：https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github
- Release 附件限制：https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- 发布步骤：https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository
