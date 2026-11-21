/**
 * JanSeva Voice - Entitlement Stoppage & Pension Recovery Engine
 * Diagnoses DBT / PFMS failures (Account dormancy, NPCI decoupling, Life certificate expiry)
 */

export const BENEFICIARIES = {
  "BEN_PARVATI_DEVI_01": {
    name: "Parvati Devi (पार्वती देवी)",
    age: 67,
    village: "Chandanpur, Block Maner, Patna",
    scheme: "Indira Gandhi National Widow Pension (NSAP)",
    monthly_amount: 1000,
    phone_number: "9876500001",
    aadhaar_last4: "7193",
    ration_card_last4: "4812",
    current_status: "DISBURSAL_BOUNCED",
    error_code: "ERR_504_BANK_DORMANT",
    months_pending: 3,
    bank_name: "State Bank of India (Maner Branch)",
    account_last4: "6021",
    root_cause_tech: "Account inactive under RBI KYC dormancy rule: 0 transactions in 14 months.",
    dialect_explanation: {
      bhojpuri: "पार्वती दादी, घबराईं मत। रउआ पेंशन रद्दी नइखे भइल। सरकार हर महीना ₹1000 भेजले रहे, बाकी रउआ स्टेट बैंक वाला खाता 1 साल से बंद पड़ल रहे, एहसे बैंक पईसा लौटा दिहलस। रउआ ब्लॉक ऑफिस जाए के कवनो जरूरत नइखे। काल्ह सबेरे गाँव के पोस्ट ऑफिस या बैंक जाके सिरिफ ₹10 जमा कऽ दीं। खाता फेर चालू हो जाई आ पिछलका ₹3000 अगिला हफ्ता आ जाई। हम मुखिया जी के सोचना भेज देले बानी।",
      hindi: "पार्वती दादी, घबराइए मत। आपका पेंशन रद्द नहीं हुआ है। सरकार ने हर महीने ₹1,000 भेजा था, लेकिन आपका स्टेट बैंक खाता 1 साल से बंद पड़ा था, इसलिए बैंक ने पैसा लौटा दिया। आपको ब्लॉक ऑफिस जाने की कोई ज़रूरत नहीं है। कल सुबह गाँव के डाकघर या बैंक जाकर सिर्फ ₹10 जमा कर दीजिए। खाता दोबारा चालू हो जाएगा और पिछला रुका हुआ ₹3,000 अगले हफ्ते खाते में आ जाएगा।",
      bengali: "পার্বতী দিদিমা, ভয় পাবেন না। আপনার বিধবা ভাতা বাতিল হয়নি। সরকার প্রতি মাসে টাকা পাঠাচ্ছিল, কিন্তু স্টেট ব্যাংকের অ্যাকাউন্ট এক বছর বন্ধ থাকার কারণে টাকা ফেরত গেছে। ব্লক অফিসে যাওয়ার দরকার নেই। কাল সকালে পোস্ট অফিসে গিয়ে মাত্র ১০ টাকা জমা দিন। অ্যাকাউন্ট চালু হয়ে যাবে এবং বকেয়া ৩,০০০ টাকা আগামী সপ্তাহে জমা পড়বে।"
    },
    action_required: "गाँव के डाकघर (IPPB) या बैंक शाखा में ₹10 जमा करके खाता दोबारा चालू कराएं।",
    panchayat_escalation: "मनेर पंचायत वार्ड 4 के ग्राम रोजगार सेवक को अलर्ट भेजा गया।"
  },
  "BEN_RAMU_MANJHI_02": {
    name: "Ramu Manjhi (रामू मांझी)",
    age: 42,
    village: "Pipra, Block Danapur, Patna",
    scheme: "MGNREGA Rural Wage Guarantee",
    monthly_amount: 3200,
    phone_number: "9876500002",
    aadhaar_last4: "3841",
    ration_card_last4: "9921",
    current_status: "CREDIT_HELD",
    error_code: "ERR_302_NPCI_MAPPER_DECOUPLED",
    months_pending: 1,
    bank_name: "Dakshin Bihar Gramin Bank",
    account_last4: "1198",
    root_cause_tech: "Aadhaar Payment Bridge System (APBS) mapped to inactive mobile wallet.",
    dialect_explanation: {
      hindi: "रामू भाई, आपकी 14 दिन की मनरेगा मजदूरी ₹3,200 कटी नहीं है। सरकारी सिस्टम में आपका आधार ग्रामीण बैंक के बदले पुराने मोबाइल खाते से लिंक हो गया था। कल पंचायत भवन में जाकर आधार डीबीटी मैपिंग ग्रामीण बैंक पर सेट करवा लें। 4 दिन में पैसा आ जाएगा।",
      bhojpuri: "रामू भाई, रउआ मनरेगा के ₹3,200 कटल नइखे। आधार लिंक ग्रामीण बैंक के बदला पुराना मोबाइल खाता पर सेट हो गइल रहे। काल्ह पंचायत भवन जाके आधार मैपिंग सुधार करवा लीं। पईसा 4 दिन में आ जाई।"
    },
    action_required: "पंचायत केंद्र पर आधार ऑपरेटर से मिलकर डीबीटी मैपिंग प्राथमिक बैंक खाते पर सेट करवाएं।",
    panchayat_escalation: "दानापुर ब्लॉक कार्यक्रम अधिकारी को अलर्ट भेजा गया।"
  },
  "BEN_SAKINA_BIBI_03": {
    name: "Sakina Bibi (সাকিনা বিবি)",
    age: 64,
    village: "Ghatakpukur, South 24 Parganas, West Bengal",
    scheme: "National Social Assistance Programme (NSAP Widow Pension)",
    monthly_amount: 1000,
    phone_number: "9876500003",
    aadhaar_last4: "6205",
    ration_card_last4: "1049",
    current_status: "DISBURSAL_PAUSED",
    error_code: "ERR_401_LIFE_CERTIFICATE_EXPIRED",
    months_pending: 2,
    bank_name: "Bangiya Gramin Vikash Bank",
    account_last4: "4490",
    root_cause_tech: "Annual Digital Life Certificate (Jeevan Pramaan) not renewed.",
    dialect_explanation: {
      bengali: "সাকিনা বিবি, আপনার বিধবা ভাতা বন্ধ হয়নি। প্রতি বছর যে জীবন প্রমাণপত্র জমা দিতে হয়, সেটি জমা পড়েনি। ব্লক অফিসে দৌড়ানোর দরকার নেই। আপনার গ্রামের ডাকপিয়ন বা পঞ্চায়েত কেন্দ্রে আঙুলের ছাপ দিয়ে আধারে জীবন প্রমাণ জমা দিন। আগামী সপ্তাহেই টাকা ব্যাংকে চলে আসবে।",
      hindi: "सकीना बीबी, आपकी पेंशन बंद नहीं हुई है। वार्षिक जीवन प्रमाण पत्र जमा नहीं हुआ था। गाँव के डाकिया या पंचायत केंद्र में फिंगरप्रिंट लगाकर ई-केवाईसी करवा लें। पैसा अगले हफ्ते सीधे खाते में आ जाएगा।"
    },
    action_required: "गाँव के डाकिया या सीएससी केंद्र पर जाकर बायोमेट्रिक जीवन प्रमाण पत्र (e-KYC) पूरा करें।",
    panchayat_escalation: "घटकपुकुर ग्राम पंचायत प्रधान को अलर्ट भेजा गया।"
  }
};

export function diagnoseStoppage(queryText = "", identifier = "", preferredLanguage = "bhojpuri") {
  let matchedId = "BEN_PARVATI_DEVI_01";

  if (identifier) {
    const clean = identifier.trim();
    for (const [id, ben] of Object.entries(BENEFICIARIES)) {
      if (ben.phone_number.includes(clean) || ben.aadhaar_last4.includes(clean) || ben.ration_card_last4.includes(clean)) {
        matchedId = id;
        break;
      }
    }
  } else {
    const lower = queryText.toLowerCase();
    if (lower.includes("मनरेगा") || lower.includes("mgnrega") || lower.includes("मजदूरी") || lower.includes("ramu")) {
      matchedId = "BEN_RAMU_MANJHI_02";
    } else if (lower.includes("বিধবা") || lower.includes("সাকিনা") || lower.includes("sakina") || lower.includes("বাংলা")) {
      matchedId = "BEN_SAKINA_BIBI_03";
    }
  }

  const record = BENEFICIARIES[matchedId];
  const explanations = record.dialect_explanation;
  const script = explanations[preferredLanguage] || explanations.hindi || Object.values(explanations)[0];
  const ticketToken = `JP-${record.aadhaar_last4}-${(record.months_pending * 17) + 21}`;

  return {
    status: "DIAGNOSIS_COMPLETE",
    ticket_token: ticketToken,
    beneficiary: {
      name: record.name,
      age: record.age,
      village: record.village,
      scheme: record.scheme,
      monthly_entitlement: `₹${record.monthly_amount}`,
      pending_recovery_amount: `₹${record.monthly_amount * record.months_pending}`,
      bank_account: `${record.bank_name} (A/C **${record.account_last4})`
    },
    diagnosis: {
      error_code: record.error_code,
      disbursal_status: record.current_status,
      technical_root_cause: record.root_cause_tech,
      action_required: record.action_required,
      citizen_friendly_script: script,
      panchayat_escalation: record.panchayat_escalation
    },
    network_telemetry: {
      payload_size_kb: 4.8,
      protocol: "HTTP/3 over QUIC",
      codec: "Opus Narrowband @ 8 kbps",
      first_audio_render_ms: 380
    }
  };
}
