package com.example.sangil // 실제 Android 프로젝트의 package 이름으로 변경하세요

import android.app.Activity
import android.speech.tts.TextToSpeech
import android.webkit.JavascriptInterface
import android.webkit.WebView
import java.util.Locale

/**
 * 기존 MainActivity의 WebView에 연결할 음성 브리지.
 * Activity.onDestroy()에서 close()를 호출하세요.
 */
class SangilSpeechBridge(private val activity: Activity) : TextToSpeech.OnInitListener {
    private var tts: TextToSpeech? = TextToSpeech(activity.applicationContext, this)
    @Volatile private var ready = false
    private var pending: String? = null

    override fun onInit(status: Int) {
        if (status != TextToSpeech.SUCCESS) return
        val result = tts?.setLanguage(Locale.KOREAN)
        ready = result != TextToSpeech.LANG_MISSING_DATA &&
            result != TextToSpeech.LANG_NOT_SUPPORTED
        if (ready) {
            pending?.let { message ->
                pending = null
                speak(message)
            }
        }
    }

    @JavascriptInterface
    fun speak(message: String) {
        if (message.length > 300) return
        activity.runOnUiThread {
            if (!ready) { pending = message; return@runOnUiThread }
            tts?.speak(message, TextToSpeech.QUEUE_FLUSH, null, "sangil-" + System.nanoTime())
        }
    }

    @JavascriptInterface
    fun closeApp() {
        activity.runOnUiThread { activity.finish() }
    }

    fun close() {
        tts?.stop()
        tts?.shutdown()
        tts = null
    }
}

// MainActivity 예시 (기존 WebView 초기화 부분에 추가):
// private lateinit var speechBridge: SangilSpeechBridge
// speechBridge = SangilSpeechBridge(this)
// webView.settings.javaScriptEnabled = true
// webView.addJavascriptInterface(speechBridge, "SangilAndroid")
// override fun onDestroy() {
//     speechBridge.close()
//     super.onDestroy()
// }
// 주의: addJavascriptInterface는 신뢰할 수 있는 페이지에만 노출하세요.
// 외부 사이트로 이동하지 않도록 WebView URL을 제한해야 합니다.
