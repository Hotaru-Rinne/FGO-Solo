$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$version=(Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json).version
$destination=Join-Path $projectRoot "dist\FGO-Solo-Windows-$version-source"
if(Test-Path -LiteralPath $destination){throw '源码目录已存在，请检查旧目录后另存。'}
New-Item -ItemType Directory -Force -Path $destination | Out-Null
$allowed=@('src','public','index.html','package.json','.gitignore','README.md','windows/main.cjs','windows/preload.cjs','windows/policy.cjs','windows/icon.ico','windows/icon.png','android/src','android/res','android/AndroidManifest.xml','tests','scripts/build-android.ps1','scripts/verify-apk.ps1','scripts/serve.mjs','scripts/set-version.mjs','scripts/prepare-windows.ps1','scripts/build-windows.mjs','scripts/archive-windows.ps1','scripts/generate-windows-icon.mjs','scripts/package-windows-source.ps1','docs/MECHANICS.md','docs/GitHub上传与发布.md','docs/发布说明-0.4.3.md','docs/爬取识别范围.md','docs/Windows使用说明.md','docs/Windows开发说明.md','docs/Windows验证记录.md')
foreach($relative in $allowed){
 $target=Join-Path $destination $relative
 New-Item -ItemType Directory -Force -Path (Split-Path $target -Parent) | Out-Null
 Copy-Item -LiteralPath (Join-Path $projectRoot $relative) -Destination $target -Recurse
}
$files=Get-ChildItem -LiteralPath $destination -File -Recurse -Force
if($files | Where-Object {$_.Extension -in @('.p12','.jks','.keystore','.apk','.exe')}){throw '源码包含本地密钥或构建文件'}
Add-Type -AssemblyName System.IO.Compression.FileSystem
[IO.Compression.ZipFile]::CreateFromDirectory($destination,($destination+'.zip'))
Write-Output $destination
