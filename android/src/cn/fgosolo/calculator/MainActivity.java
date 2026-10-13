package cn.fgosolo.calculator;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.net.URL;
import javax.net.ssl.HttpsURLConnection;
import java.util.HashMap;
import java.util.Map;
import java.util.ArrayList;
import java.util.List;
import java.util.HashSet;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final int OPEN_FILE = 21, SAVE_BACKUP = 22;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private String pendingBackup;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        applyOrientation(getPreferences(MODE_PRIVATE).getString("orientation", "portrait"));
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(0xfff4f5ef);
        web = new WebView(this);
        web.setBackgroundColor(0xfff4f5ef);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setTextZoom(100);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !HOST.equals(request.getUrl().getHost());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && "api.atlasacademy.io".equals(uri.getHost()) && uri.getPath()!=null && uri.getPath().matches("/(export/JP/basic_servant[.]json|nice/JP/servant/[0-9]+)")) return null;
                if ("https".equals(uri.getScheme()) && "api.github.com".equals(uri.getHost()) && uri.getPath()!=null && uri.getPath().matches("/repos/[A-Za-z0-9-]+/[A-Za-z0-9_.-]+/releases/latest")) return null;
                if ("https".equals(uri.getScheme()) && "fgo.wiki".equals(uri.getHost()) && "/api.php".equals(uri.getPath()) && ("query".equals(uri.getQueryParameter("action")) || "ask".equals(uri.getQueryParameter("action")))) return mooncellResponse(uri);
                if (!HOST.equals(uri.getHost()) || !"https".equals(uri.getScheme())) return missing();
                String path = uri.getPath();
                if (path == null || !path.startsWith("/assets/") || path.contains("..")) return missing();
                String asset = path.substring(8);
                String mime = asset.endsWith(".js") ? "text/javascript" : asset.endsWith(".css") ? "text/css" : asset.endsWith(".json") ? "application/json" : asset.endsWith(".svg") ? "image/svg+xml" : asset.endsWith(".txt") ? "text/plain" : "text/html";
                try { return new WebResourceResponse(mime, "UTF-8", 200, "OK", Collections.singletonMap("Cache-Control", "no-cache"), getAssets().open(asset)); }
                catch (Exception e) { return missing(); }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                String[] types = params.getAcceptTypes();
                intent.setType(types.length > 0 && types[0].startsWith("image/") ? "image/*" : "*/*");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { startActivityForResult(intent, OPEN_FILE); }
                catch (Exception e) { fileCallback.onReceiveValue(null); fileCallback = null; toast("无法打开文件选择器"); }
                return true;
            }
            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("确认", (d,w) -> result.confirm()).setNegativeButton("取消", (d,w) -> result.cancel()).setOnCancelListener(d -> result.cancel()).show();
                return true;
            }
        });
        web.addJavascriptInterface(new LocalBridge(), "Android");
        web.loadUrl("https://" + HOST + "/assets/index.html");
    }
    private WebResourceResponse missing() { return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0])); }
    // Keep public name queries on the native HTTPS stack; some WebView/Chromium
    // versions cannot connect to Mooncell even though the server permits CORS.
    // This callback runs on WebView's request thread, never on the UI thread.
    private WebResourceResponse mooncellResponse(Uri uri) {
        HttpsURLConnection connection = null;
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");
        headers.put("Cache-Control", "no-store");
        try {
            if (uri.toString().length() > 4096) throw new IllegalArgumentException();
            connection = (HttpsURLConnection) new URL(uri.toString()).openConnection();
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(15000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", "FGO-Solo/0.4.2 (Android; public servant names)");
            int status = connection.getResponseCode();
            if (status != 200) throw new IllegalStateException("Mooncell HTTP " + status);
            try (InputStream stream = connection.getInputStream(); ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                byte[] chunk = new byte[8192];
                int count;
                while ((count = stream.read(chunk)) != -1) {
                    if (buffer.size() + count > 3 * 1024 * 1024) throw new IllegalStateException("Response too large");
                    buffer.write(chunk, 0, count);
                }
                return new WebResourceResponse("application/json", "UTF-8", 200, "OK", headers, new ByteArrayInputStream(buffer.toByteArray()));
            }
        } catch (Exception error) {
            return new WebResourceResponse("application/json", "UTF-8", 502, "Bad Gateway", headers, new ByteArrayInputStream("{}".getBytes(StandardCharsets.UTF_8)));
        } finally { if (connection != null) connection.disconnect(); }
    }
    private void toast(String text) { runOnUiThread(() -> Toast.makeText(this, text, Toast.LENGTH_LONG).show()); }
    private void applyOrientation(String mode) {
        int requested = "landscape".equals(mode) ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE :
            "auto".equals(mode) ? ActivityInfo.SCREEN_ORIENTATION_USER : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
        setRequestedOrientation(requested);
    }
    public final class LocalBridge {
        @JavascriptInterface public void openExternal(String value) {
            if (value == null || value.length() > 4096) return;
            Uri uri = Uri.parse(value);
            if (!("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) || uri.getHost() == null || uri.getUserInfo() != null) {
                toast("无效的外部链接"); return;
            }
            runOnUiThread(() -> openInBrowser(uri));
        }
        @JavascriptInterface public void setOrientation(String mode) {
            if (!"portrait".equals(mode) && !"landscape".equals(mode) && !"auto".equals(mode)) return;
            runOnUiThread(() -> {
                getPreferences(MODE_PRIVATE).edit().putString("orientation", mode).apply();
                applyOrientation(mode);
            });
        }
        @JavascriptInterface public void exportBackup(String name, String json) {
            if (json == null || json.length() > 20 * 1024 * 1024) { toast("备份过大"); return; }
            runOnUiThread(() -> {
                pendingBackup = json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE, "FGO-Solo-backup.json");
                try { startActivityForResult(intent, SAVE_BACKUP); }
                catch (Exception e) { pendingBackup = null; toast("无法打开保存位置"); }
            });
        }
    }
    private void openInBrowser(Uri uri) {
        PackageManager packages = getPackageManager();
        // Resolve a generic web address so verified Bilibili app links cannot
        // redirect this action into a native social app instead of the browser.
        Intent probe = new Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com/"));
        probe.addCategory(Intent.CATEGORY_BROWSABLE);
        List<ResolveInfo> browsers = packages.queryIntentActivities(probe, PackageManager.MATCH_DEFAULT_ONLY);
        ResolveInfo preferred = packages.resolveActivity(probe, PackageManager.MATCH_DEFAULT_ONLY);
        boolean knownBrowser = preferred != null && preferred.activityInfo != null && browsers.stream().anyMatch(
            candidate -> candidate.activityInfo != null && candidate.activityInfo.packageName.equals(preferred.activityInfo.packageName));
        try {
            if (knownBrowser && !"android".equals(preferred.activityInfo.packageName)
                    && !getPackageName().equals(preferred.activityInfo.packageName)) {
                Intent intent = new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE);
                intent.setPackage(preferred.activityInfo.packageName);
                startActivity(intent); return;
            }
            List<Intent> choices = new ArrayList<>();
            HashSet<String> seen = new HashSet<>();
            for (ResolveInfo candidate : browsers) {
                if (candidate.activityInfo == null) continue;
                String pkg = candidate.activityInfo.packageName;
                if (getPackageName().equals(pkg) || "android".equals(pkg) || !seen.add(pkg)) continue;
                choices.add(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE).setPackage(pkg));
            }
            if (choices.isEmpty()) { toast("未找到可用浏览器，请先设置手机默认浏览器"); return; }
            Intent chooser = Intent.createChooser(choices.remove(0), "选择浏览器");
            chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, choices.toArray(new Intent[0]));
            startActivity(chooser);
        } catch (Exception error) { toast("无法打开默认浏览器，请检查手机浏览器设置"); }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == OPEN_FILE && fileCallback != null) {
            fileCallback.onReceiveValue(result == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null);
            fileCallback = null;
        } else if (request == SAVE_BACKUP) {
            String content = pendingBackup; pendingBackup = null;
            if (result == RESULT_OK && data != null && data.getData() != null && content != null) {
                Uri uri = data.getData();
                new Thread(() -> { try (OutputStream stream = getContentResolver().openOutputStream(uri, "wt")) {
                    if (stream == null) throw new IllegalStateException();
                    stream.write(content.getBytes(StandardCharsets.UTF_8));
                    toast("备份已保存");
                } catch (Exception e) { toast("备份保存失败"); } }).start();
            }
        }
    }
    @Override public void onBackPressed() { web.evaluateJavascript("window.handleNativeBack ? window.handleNativeBack() : false", handled -> { if (!"true".equals(handled)) super.onBackPressed(); }); }
    @Override protected void onDestroy() { if (fileCallback != null) fileCallback.onReceiveValue(null); if (web != null) { web.removeJavascriptInterface("Android"); web.destroy(); } super.onDestroy(); }
}
