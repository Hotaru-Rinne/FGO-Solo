$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$environmentRoot=Join-Path (Split-Path $projectRoot -Parent) '开发安装\环境'
$electronRoot=Join-Path $environmentRoot 'electron-44.7.0'
$resourceRoot=Join-Path $environmentRoot 'rcedit-5.0.2'
New-Item -ItemType Directory -Force -Path $electronRoot,$resourceRoot | Out-Null
function Get-CheckedFile {
 param([string]$Url,[string]$File,[string]$Hash,[string]$Mirror='')
 if((Test-Path -LiteralPath $File) -and (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash -eq $Hash){return}
 & curl.exe -L --fail --max-time 180 -o $File $Url
 if($LASTEXITCODE -ne 0 -and $Mirror){& curl.exe -L --fail --max-time 180 -o $File $Mirror}
 if($LASTEXITCODE -ne 0){throw '下载失败，请检查网络后重试。'}
 if((Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash -ne $Hash){throw '下载文件校验失败。'}
}
# Pinned official Electron release checksum.
Get-CheckedFile -Url 'https://github.com/electron/electron/releases/download/v44.7.0/electron-v44.7.0-win32-x64.zip' -File (Join-Path $electronRoot 'electron-mirror.zip') -Hash 'EEE30DC8FA1F5EA95490E59F44E46EA68DD24C6E93D22FACF70FE5C2D4C2665C' -Mirror 'https://npmmirror.com/mirrors/electron/44.7.0/electron-v44.7.0-win32-x64.zip'
Expand-Archive -LiteralPath (Join-Path $electronRoot 'electron-mirror.zip') -DestinationPath (Join-Path $electronRoot 'runtime') -Force
& curl.exe -L --fail --max-time 60 -o (Join-Path $resourceRoot 'rcedit.tgz') 'https://registry.npmjs.org/rcedit/-/rcedit-5.0.2.tgz'
if($LASTEXITCODE -ne 0){throw '资源工具下载失败'}
$sha=[Security.Cryptography.SHA512]::Create()
try{$integrity=[Convert]::ToBase64String($sha.ComputeHash([IO.File]::ReadAllBytes((Join-Path $resourceRoot 'rcedit.tgz'))))}finally{$sha.Dispose()}
if($integrity -ne 'dgysxaeXZ4snLpPjn8aVtHvZDCx+aRcvZbaWBgl1poU6OPustMvOkj9a9ZqASQ6i5Y5szJ13LSvglEOwrmgUxA=='){throw '资源工具校验失败'}
& tar -xf (Join-Path $resourceRoot 'rcedit.tgz') -C $resourceRoot
if($LASTEXITCODE -ne 0){throw '资源工具解压失败'}
Write-Output 'Windows 开发依赖已准备。需要 Node.js 22.12 或以上运行构建脚本。'
