# SMS Cleaner 🛡️

**LLM-Based Intelligent SMS Scam Detection System**  
React Native · iOS + Android

> BA Degree Project II — Istinye University, MIS Department  
> Student: Ahmet Emir Özçelik | Advisor: Şebnem Özdemir

---

## What It Does

SMS Cleaner automatically detects and blocks spam/scam SMS messages on both iOS and Android using rule-based number analysis and content filtering.

- **iOS** — Uses Apple's IdentityLookup framework (SMS Filter Extension). Analyzes sender number only (Apple restriction). 3-state verification system ensures the extension is genuinely active.
- **Android** — Uses BroadcastReceiver to intercept SMS before other apps. Analyzes both sender number and message content.

---

## How It Detects Spam

| Rule | Score |
|------|-------|
| No country code (digits only) | +40 |
| Starts with 850 (premium rate) | +40 |
| Repeating digits (111111) | +35 |
| Sequential digits (123456) | +30 |
| Unknown country code | +20 |
| Number too long (15+ digits) | +25 |
| **Score ≥ 70** | → **BLOCK** |
| **Score 40–69** | → **JUNK** |
| **Score < 40** | → **ALLOW** |

Numbers starting with `+90` (Turkish format) are always allowed.

---

## Tech Stack

- React Native 0.73.0
- Apple IdentityLookup (iOS)
- Android BroadcastReceiver
- SQLite (react-native-sqlite-storage)
- React Navigation
- App Groups (iOS extension bridge)

---

## Project Structure
```
src/
├── screens/
│   ├── DashboardScreen.js    # Protection status (3-state)
│   └── DetailsScreen.js      # Blocking stats + methodology
├── services/
│   ├── filterService.js      # Core filtering logic
│   └── spamDatabase.js       # SQLite blacklist/whitelist
├── utils/
│   └── numberAnalyzer.js     # Rule-based scoring engine
└── hooks/
    └── useSmsFilter.js       # Android SMS listener

ios/SMSFilterExtension/       # iOS IdentityLookup Extension
android/.../SmsReceiver.kt    # Android BroadcastReceiver
```

---

## How to Run
```bash
npm install
cd ios && pod install && cd ..

# iOS
npx react-native run-ios

# Android
npx react-native run-android
```

---

*Created by Ahmet Emir Özçelik — Istinye University, 2025*
