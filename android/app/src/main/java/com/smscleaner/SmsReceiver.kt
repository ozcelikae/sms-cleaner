package com.smscleaner

import android.util.Log
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * SmsReceiver — Android BroadcastReceiver for incoming SMS
 * Analyzes sender number and aborts broadcast if spam.
 */
class SmsReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        val grouped = mutableMapOf<String, StringBuilder>()
        for (msg in messages) {
            val number = msg.originatingAddress ?: continue
            grouped.getOrPut(number) { StringBuilder() }.append(msg.messageBody)
        }

        for ((number, body) in grouped) {
            if (isSpam(number)) {
                showSpamNotification(context, number, body.toString())

                // JS tarafına bildir (Ayrıntılar ekranı sayacı güncellesin)
                SmsReceiverModule.reactContext?.let { ctx ->
                    val params = com.facebook.react.bridge.Arguments.createMap().apply {
                        putString("number", number)
                        putString("body", body.toString())
                        putBoolean("blocked", true)
                    }
                    ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                        .emit("onSmsReceived", params)
                }
                continue
            }

            // Spam değil — sadece bilgi amaçlı gönder
            SmsReceiverModule.reactContext?.let { ctx ->
                val params = com.facebook.react.bridge.Arguments.createMap().apply {
                    putString("number", number)
                    putString("body", body.toString())
                    putBoolean("blocked", false)
                }
                ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("onSmsReceived", params)
            }
        }
    }

    private fun isSpam(raw: String): Boolean {
        val number = raw.trim()

        // Uluslararası format (+) — her zaman geçir
        if (number.startsWith("+")) return false

        val digits = number.filter { it.isDigit() }

        // Sadece rakamdan oluşmuyor (operatör adı vb.) — geçir
        if (digits.length != number.length) return false

        // 850 ile başlayan ücretli hat
        if (number.startsWith("850") && number.length >= 10) return true

        // Kısa kod (4-6 rakam)
        if (digits.length in 4..6) return true

        // Tekrar eden rakamlar: 111111, 999999
        if (digits.length >= 4 && digits.all { it == digits[0] }) return true

        // Sıralı rakamlar: 123456, 234567
        if (digits.length >= 4) {
            val isAsc = digits.zipWithNext().all { (a, b) -> b - a == 1 }
            val isDesc = digits.zipWithNext().all { (a, b) -> a - b == 1 }
            if (isAsc || isDesc) return true
        }

        return false
    }

    private fun showSpamNotification(context: Context, number: String, body: String) {
        val channelId = "spam_alerts"
        val notifManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Spam Uyarıları",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Spam SMS tespit edildiğinde bildirim gösterir"
                enableVibration(true)
            }
            notifManager.createNotificationChannel(channel)
        }

        // Uygulamayı açan intent
        val openIntent = context.packageManager
            .getLaunchIntentForPackage(context.packageName)
            ?.apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP }
        val pendingIntent = PendingIntent.getActivity(
            context, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val preview = if (body.length > 60) body.take(60) + "…" else body

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("🚫 Spam SMS Tespit Edildi")
            .setContentText("$number: $preview")
            .setStyle(NotificationCompat.BigTextStyle()
                .bigText("Gönderen: $number\n\n$body\n\nBu mesajı Mesajlar uygulamasından silebilirsiniz."))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        notifManager.notify(number.hashCode(), notification)
    }
}

/**
 * SmsReceiverModule — Native Module that exposes the emitter to JS
 */
class SmsReceiverModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    init {
        Companion.reactContext = reactContext
    }

    override fun getName() = "SmsReceiverModule"

    // Required for addListener / removeListeners (NativeEventEmitter)
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    companion object {
        var reactContext: ReactApplicationContext? = null
    }
}
