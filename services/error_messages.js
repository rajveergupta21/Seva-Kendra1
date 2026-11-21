/**
 * Error Codes and User Messages for JanKalyan / Seva Kendra
 * Distinct error codes and empathetic, natural translations across all languages.
 * Note: Never blame the user for server/API errors.
 */

export const ERROR_CODES = {
  MIC_PERMISSION_DENIED: "MIC_PERMISSION_DENIED",
  NO_INPUT_DEVICE: "NO_INPUT_DEVICE",
  MIC_SILENT: "MIC_SILENT",
  STT_API_ERROR: "STT_API_ERROR",
  NETWORK_OFFLINE: "NETWORK_OFFLINE",
  TRULY_EMPTY_SPEECH: "TRULY_EMPTY_SPEECH",
  EMPTY_SPEECH: "EMPTY_SPEECH"
};

export const ERROR_MESSAGES = {
  [ERROR_CODES.MIC_PERMISSION_DENIED]: {
    hi: {
      screen: "माइक की अनुमति नहीं मिली। कृपया ब्राउज़र सेटिंग्स में जाकर माइक की अनुमति दें।",
      spoken: "माइक की अनुमति नहीं मिली। कृपया ब्राउज़र में माइक की अनुमति दें।"
    },
    bhojpuri: {
      screen: "माइक के अनुमति नइखे मिलल। कृपा कके ब्राउज़र सेटिंग्स में जाके माइक चालू करीं।",
      spoken: "माइक के अनुमति नइखे मिलल। कृपा कके माइक चालू करीं।"
    },
    bn: {
      screen: "মাইক ব্যবহারের অনুমতি পাওয়া যায়নি। দয়া করে ব্রাউজার সেটিংসে গিয়ে মাইক চালু করুন।",
      spoken: "মাইকের অনুমতি পাওয়া যায়নি। দয়া করে মাইক চালু করুন।"
    },
    maithili: {
      screen: "माइकक अनुमति नहि भेटल। कृपया ब्राउज़र सेटिंग्समे जाकए माइक चालू करू।",
      spoken: "माइकक अनुमति नहि भेटल। कृपया माइक चालू करू।"
    },
    en: {
      screen: "Microphone permission denied. Please allow microphone access in your browser settings.",
      spoken: "Microphone permission denied. Please allow microphone access."
    }
  },

  [ERROR_CODES.NO_INPUT_DEVICE]: {
    hi: {
      screen: "आपके डिवाइस में कोई माइक नहीं मिला। कृपया माइक या ईयरफोन कनेक्ट करें।",
      spoken: "आपके फोन या कंप्यूटर में कोई माइक नहीं मिला। कृपया माइक जोड़ें।"
    },
    bhojpuri: {
      screen: "राउर मोबाइल में कवनो माइक नइखे मिलल। ईयरफोन या माइक लगाईं।",
      spoken: "राउर मोबाइल में कवनो माइक नइखे मिलल। कृपा कके माइक लगाईं।"
    },
    bn: {
      screen: "আপনার ডিভাইসে কোনো মাইক পাওয়া যায়নি। দয়া করে মাইক বা ইয়ারফোন সংযুক্ত করুন।",
      spoken: "আপনার ডিভাইসে কোনো মাইক পাওয়া যায়নি।"
    },
    maithili: {
      screen: "अहाँक फोनमे कोनो माइक नहि भेटल। कृपया इयरफोन या माइक जोड़ू।",
      spoken: "अहाँक फोनमे कोनो माइक नहि भेटल।"
    },
    en: {
      screen: "No microphone detected on your device. Please connect a microphone or headset.",
      spoken: "No microphone detected. Please connect a microphone."
    }
  },

  [ERROR_CODES.MIC_SILENT]: {
    hi: {
      screen: "माइक से कोई आवाज़ नहीं आई। कृपया माइक के पास आकर थोड़ा तेज़ बोलें।",
      spoken: "कोई आवाज़ नहीं आई। कृपया माइक के पास आकर थोड़ा तेज़ बोलें।"
    },
    bhojpuri: {
      screen: "कवनो आवाज़ नइखे आइल। तनी माइक के लगे आके जोर से बोलीं।",
      spoken: "कवनो आवाज़ नइखे आइल। कृपा कके तनी जोर से बोलीं।"
    },
    bn: {
      screen: "মাইকে কোনো শব্দ ধরা পড়েনি। দয়া করে মাইকের কাছে এসে আরেকটু স্পষ্ট ও জোরে বলুন।",
      spoken: "কোনো শব্দ শোনা যায়নি। দয়া করে আরেকটু জোরে বলুন।"
    },
    maithili: {
      screen: "कोनो आवाज नहि आएल। कृपया माइकक लग आबि कए जोर सं बाहू।",
      spoken: "कोनो आवाज नहि आएल। कृपया जोर सं बाहू।"
    },
    en: {
      screen: "No sound detected from your microphone. Please speak closer to the mic.",
      spoken: "No sound detected. Please speak closer to the microphone."
    }
  },

  [ERROR_CODES.STT_API_ERROR]: {
    hi: {
      screen: "तकनीकी दिक्कत है, फिर से बोलिए",
      spoken: "तकनीकी दिक्कत है, फिर से बोलिए"
    },
    bhojpuri: {
      screen: "तकनीकी दिक्कत आ गइल बा, फिर से बोलीं",
      spoken: "तकनीकी दिक्कत आ गइल बा, फिर से बोलीं"
    },
    bn: {
      screen: "কারিগরি সমস্যা হয়েছে, আবার বলুন",
      spoken: "কারিগরি সমস্যা হয়েছে, আবার বলুন"
    },
    maithili: {
      screen: "तकनीकी समस्या भेल, पुनः बाहू",
      spoken: "तकनीकी समस्या भेल, पुनः बाहू"
    },
    en: {
      screen: "Technical issue, please speak again",
      spoken: "Technical issue on our end, please speak again"
    }
  },

  [ERROR_CODES.NETWORK_OFFLINE]: {
    hi: {
      screen: "इंटरनेट कनेक्शन बंद है। कृपया अपना मोबाइल डेटा या वाई-फाई चेक करें।",
      spoken: "इंटरनेट कनेक्शन बंद है। कृपया अपना नेटवर्क चेक करें।"
    },
    bhojpuri: {
      screen: "इंटरनेट बंद बा। आपन मोबाइल डेटा या वाई-फाई जांच करीं।",
      spoken: "इंटरनेट कनेक्शन बंद बा। कृपा कके नेटवर्क जांच करीं।"
    },
    bn: {
      screen: "ইন্টারনেট সংযোগ বিচ্ছিন্ন। দয়া করে মোবাইল ডেটা বা ওয়াই-ফাই পরীক্ষা করুন।",
      spoken: "ইন্টারনেট সংযোগ বন্ধ আছে। দয়া করে নেটওয়ার্ক পরীক্ষা করুন।"
    },
    maithili: {
      screen: "इंटरनेट बंद अछि। कृपया अपन मोबाइल डेटा वा वाई-फाई जांचू।",
      spoken: "इंटरनेट बंद अछि। कृपया नेटवर्क जांचू।"
    },
    en: {
      screen: "You appear to be offline. Please check your internet connection.",
      spoken: "Internet connection is offline. Please check your network."
    }
  },

  [ERROR_CODES.TRULY_EMPTY_SPEECH]: {
    hi: {
      screen: "आपकी आवाज़ साफ सुनाई नहीं दी। कृपया थोड़ा साफ और दोबारा बोलें।",
      spoken: "आपकी आवाज़ साफ सुनाई नहीं दी। कृपया दोबारा बोलें।"
    },
    bhojpuri: {
      screen: "राउर आवाज़ साफ नइखे बुझाइल। कृपा कके फिर से साफ-साफ बोलीं।",
      spoken: "राउर आवाज़ साफ नइखे बुझाइल। फिर से बोलीं।"
    },
    bn: {
      screen: "আপনার কথা স্পষ্ট শোনা যায়নি। দয়া করে আরেকবার পরিষ্কার করে বলুন।",
      spoken: "আপনার কথা স্পষ্ট শোনা যায়নি। দয়া করে আরেকবার বলুন।"
    },
    maithili: {
      screen: "अहाँक आवाज स्पष्ट नहि बुझायल। कृपया फेर सं साफ बाहू।",
      spoken: "अहाँक आवाज स्पष्ट नहि बुझायल। फेर सं बाहू।"
    },
    en: {
      screen: "Could not clearly understand your speech. Please try speaking again clearly.",
      spoken: "Could not clearly understand your speech. Please try speaking again."
    }
  }
};

ERROR_MESSAGES[ERROR_CODES.EMPTY_SPEECH] = ERROR_MESSAGES[ERROR_CODES.TRULY_EMPTY_SPEECH];

/**
 * Resolves user-facing error response by code and language
 */
export function getErrorMessage(code, language = "hi") {
  const normalizedCode = ERROR_CODES[code] || ERROR_CODES.TRULY_EMPTY_SPEECH;
  const langKey = (language || "hi").toLowerCase().startsWith("bn")
    ? "bn"
    : (language.includes("bhojpuri")
      ? "bhojpuri"
      : (language.startsWith("mai")
        ? "maithili"
        : (language.startsWith("en") ? "en" : "hi")));

  const codeEntry = ERROR_MESSAGES[normalizedCode] || ERROR_MESSAGES[ERROR_CODES.TRULY_EMPTY_SPEECH];
  const langEntry = codeEntry[langKey] || codeEntry.hi;

  return {
    code: normalizedCode,
    language: langKey,
    screenMessage: langEntry.screen,
    spokenText: langEntry.spoken
  };
}
