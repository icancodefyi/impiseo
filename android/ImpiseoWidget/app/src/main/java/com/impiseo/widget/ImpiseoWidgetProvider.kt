package com.impiseo.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.widget.RemoteViews
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class ImpiseoWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        refreshAll(context, appWidgetManager)
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: Bundle?
    ) {
        refreshAll(context, appWidgetManager)
    }

    private fun refreshAll(context: Context, manager: AppWidgetManager) {
        val ids = manager.getAppWidgetIds(
            ComponentName(context, ImpiseoWidgetProvider::class.java)
        )
        if (ids.isEmpty()) return

        val pending = goAsync()
        Thread {
            try {
                val state = fetchState()
                val views = render(context, state)
                for (id in ids) manager.updateAppWidget(id, views)
            } catch (e: Exception) {
                val views = renderError(context, e.message ?: "network error")
                for (id in ids) manager.updateAppWidget(id, views)
            } finally {
                pending.finish()
            }
        }.start()
    }

    private data class WidgetState(
        val headline: String,
        val subline: String,
        val subColor: Int,
        val updatedLine: String,
        val isError: Boolean = false
    )

    private fun fetchState(): WidgetState {
        val url = URL("${BASE_URL}/api/widget/${TOKEN}")
        val conn = url.openConnection() as HttpURLConnection
        conn.connectTimeout = 8000
        conn.readTimeout = 20000
        try {
            val code = conn.responseCode
            val body = (
                conn.inputStream.takeIf { code in 200..299 } ?: conn.errorStream
            )?.bufferedReader()?.use { it.readText() } ?: ""

            if (code != 200) return WidgetState("—", "server $code", Color.RED, "", true)
            val json = JSONObject(body)

            if (!json.optBoolean("ok", false)) {
                val err = json.optString("error", "unknown")
                val msg = when (err) {
                    "gsc_not_connected" -> "open dashboard once to connect"
                    else -> err
                }
                return WidgetState("—", msg, Color.parseColor("#FBBF24"), "", true)
            }

            val clicks = json.optLong("clicks", 0)
            val impressions = json.optLong("impressions", 0)
            val deltaPct: Int? =
                if (json.has("deltaPct") && !json.isNull("deltaPct")) json.getInt("deltaPct")
                else null

            val deltaText: String
            val deltaColor: Int
            if (deltaPct == null) {
                deltaText = "clicks · week vs prior"
                deltaColor = Color.parseColor("#9CA3AF")
            } else {
                val sign = if (deltaPct >= 0) "+" else ""
                deltaText = "$sign$deltaPct% clicks vs prior week · ${fmt(impressions)} impr"
                deltaColor =
                    if (deltaPct >= 0) Color.parseColor("#4ADE80")
                    else Color.parseColor("#F87171")
            }

            val time = SimpleDateFormat("HH:mm", Locale.US).format(Date())
            return WidgetState(fmt(clicks), deltaText, deltaColor, "updated $time")
        } finally {
            conn.disconnect()
        }
    }

    private fun fmt(n: Long): String = String.format(Locale.US, "%,d", n)

    private fun render(context: Context, s: WidgetState): RemoteViews {
        val views = RemoteViews(context.packageName, R.layout.widget_impiseo)
        views.setTextViewText(R.id.site_title, SITE_LABEL)
        views.setTextViewText(R.id.stat_value, s.headline)
        views.setTextViewText(R.id.stat_delta, s.subline)
        views.setTextColor(R.id.stat_delta, s.subColor)
        views.setTextViewText(R.id.stat_updated, s.updatedLine)
        return views
    }

    private fun renderError(context: Context, msg: String): RemoteViews {
        return render(
            context,
            WidgetState("—", msg, Color.parseColor("#F87171"), "", isError = true)
        )
    }

    companion object {
        private const val BASE_URL = "https://impiseo.vercel.app"
        private const val TOKEN = "988f8d0c90ff11f5852899e7e9352194"
        private const val SITE_LABEL = "upscprepnotes.in"
    }
}
