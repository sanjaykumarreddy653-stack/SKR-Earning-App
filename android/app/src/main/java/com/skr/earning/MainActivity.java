package com.skr.earning;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private WebView webView;
    private AndroidApi api;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        api = new AndroidApi(this);

        webView = new WebView(this);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidAPI");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(
                    WebView view,
                    WebResourceRequest request) {

                String url = request.getUrl().toString();

                if (url.contains("/api/")) {
                    try {
                        String path = url.substring(url.indexOf("/api/"));

                        JSONObject result =
                                api.api(path, new JSONObject());

                        return new WebResourceResponse(
                                "application/json",
                                "UTF-8",
                                200,
                                "OK",
                                null,
                                new ByteArrayInputStream(
                                        result.toString()
                                                .getBytes(StandardCharsets.UTF_8)
                                )
                        );
                    } catch (Exception e) {
                        return new WebResourceResponse(
                                "application/json",
                                "UTF-8",
                                500,
                                "Error",
                                null,
                                new ByteArrayInputStream(
                                        "{\"error\":\"Android API error\"}"
                                                .getBytes(StandardCharsets.UTF_8)
                                )
                        );
                    }
                }

                return super.shouldInterceptRequest(view, request);
            }
        });

        webView.loadUrl("file:///android_asset/index.html");

        setContentView(webView);
    }

    public class AndroidBridge {

        @JavascriptInterface
        public String request(String path, String body) {
            try {
                JSONObject jsonBody = new JSONObject(
                        body == null ? "{}" : body
                );

                return api.api(path, jsonBody).toString();

            } catch (Exception e) {
                return "{\"error\":\"Android API error\"}";
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (api != null) {
            api.close();
        }

        if (webView != null) {
            webView.destroy();
        }

        super.onDestroy();
    }
}
