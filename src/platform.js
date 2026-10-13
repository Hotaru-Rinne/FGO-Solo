export const IS_WINDOWS = globalThis.Desktop?.platform === "windows";
export const PLATFORM = IS_WINDOWS ? "windows" : "android";
export const DEVICE_NAME = IS_WINDOWS ? "电脑" : "手机";
export const DOWNLOAD_LABEL = IS_WINDOWS ? "Windows 安装文件" : "APK";
export function platformText(text) {
  if (!IS_WINDOWS) return text;
  return text
    .replaceAll("手机默认浏览器", "系统默认浏览器")
    .replaceAll("从手机", "从电脑")
    .replaceAll("手机内", "电脑内")
    .replace(
      "以及选择竖屏、横屏或跟随手机方向设置",
      "窗口大小可自由调整，支持最大化和 F11 全屏",
    )
    .replaceAll(
      "下载 APK 并由系统确认安装",
      "下载 Windows 压缩包，完整解压后运行",
    )
    .replaceAll("APK 是否已提供", "Windows 安装文件是否已提供")
    .replaceAll("下载 APK", "下载 Windows 版本")
    .replaceAll("下载和安装由浏览器与系统处理", "下载由系统默认浏览器处理");
}
