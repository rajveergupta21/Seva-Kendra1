/**
 * JanSeva Voice - Entitlement Stoppage & Payment Triage Engine
 * Zero fake demo records (Parvati/Ramu/Sakina removed).
 * Provides general, realistic DBT / PFMS diagnostic checks and citizen-friendly steps.
 */

export function diagnoseStoppage(queryText = "", userProfile = {}, language = "hi") {
  const lang = (language === "bn" || language === "bengali") ? "bn" :
               (language === "en" || language === "english") ? "en" : "hi";

  const checklist = [
    {
      step: 1,
      title: {
        en: "Check Aadhaar-Bank Seeding (NPCI Mapper)",
        bn: "আধার-ব্যাংক সিডিং (NPCI ম্যাপিং) পরীক্ষা করুন",
        hi: "आधार-बैंक डीबीटी सीडिंग (NPCI मैपर) जांचें"
      }[lang],
      description: {
        en: "Ensure your primary bank account is actively seeded with Aadhaar for DBT transfers, not decoupled or mapped to an old wallet.",
        bn: "নিশ্চিত করুন যে আপনার প্রধান ব্যাংক অ্যাকাউন্টটি ডিবিটি পাওয়ার জন্য আধারের সাথে সক্রিয়ভাবে যুক্ত রয়েছে।",
        hi: "सुनिश्चित करें कि आपका बैंक खाता डीबीटी के लिए आधार से सक्रिय रूप से लिंक है, किसी पुराने या निष्क्रिय खाते पर नहीं।"
      }[lang]
    },
    {
      step: 2,
      title: {
        en: "Verify Bank Account Activity (Dormancy Rule)",
        bn: "ব্যাংক অ্যাকাউন্ট সক্রিয় আছে কিনা যাচাই করুন",
        hi: "बैंक खाता सक्रिय है या निष्क्रिय (Dormancy) जांचें"
      }[lang],
      description: {
        en: "If no transactions occurred in the last 12–24 months, the bank temporarily freezes credits under RBI KYC rules. Deposit a nominal amount (e.g., Rs 10) to reactivate it.",
        bn: "গত ১২-২৪ মাসে কোনো লেনদেন না হলে অ্যাকাউন্ট নিষ্ক্রিয় হতে পারে। ব্যাংকে গিয়ে সামান্য টাকা জমা দিয়ে অ্যাকাউন্ট পুনরায় চালু করুন।",
        hi: "यदि पिछले 12-24 महीनों में कोई लेन-देन नहीं हुआ है, तो बैंक खाता निष्क्रिय हो सकता है। बैंक या डाकघर में ₹10 जमा करके उसे पुनः चालू कराएं।"
      }[lang]
    },
    {
      step: 3,
      title: {
        en: "Submit Annual Life Certificate (Jeevan Pramaan)",
        bn: "বার্ষিক জীবন প্রমাণপত্র (Jeevan Pramaan) জমা দিন",
        hi: "वार्षिक डिजिटल जीवन प्रमाण पत्र (Jeevan Pramaan) जमा करें"
      }[lang],
      description: {
        en: "Pensions require an annual biometric or facial life certificate submission. Visit your local Post Office, CSC, or Gram Panchayat to renew it.",
        bn: "পেনশন অব্যাহত রাখতে প্রতি বছর ডিজিটাল জীবন প্রমাণপত্র জমা দেওয়া আবশ্যক। ডাকঘর বা পঞ্চায়েতে আঙুলের ছাপ দিয়ে এটি জমা দিন।",
        hi: "पेंशन जारी रखने के लिए प्रतिवर्ष जीवन प्रमाण पत्र देना आवश्यक होता है। डाकघर, सीएससी या पंचायत में बायोमेट्रिक ई-केवाईसी करवाएं।"
      }[lang]
    },
    {
      step: 4,
      title: {
        en: "Check Name & Demographics Match",
        bn: "আধার ও ব্যাংক রেকর্ডে নামের মিল পরীক্ষা করুন",
        hi: "आधार और बैंक रिकॉर्ड में नाम की जांच करें"
      }[lang],
      description: {
        en: "Spelling discrepancies between your Aadhaar card and bank passbook can bounce PFMS transactions.",
        bn: "আধার কার্ড এবং ব্যাংক পাসবইয়ের নামের বানানে অমিল থাকলে সরকারি টাকা আটকে যেতে পারে।",
        hi: "आधार कार्ड और बैंक पासबुक में नाम की स्पेलिंग में अंतर होने पर पीएफएमएस ट्रांसफर रुक सकता है।"
      }[lang]
    },
    {
      step: 5,
      title: {
        en: "Visit Local Office / CSC for DBT Status Printout",
        bn: "স্থানীয় বিডিও অফিস বা সিএসসি-তে স্ট্যাটাস যাচাই করুন",
        hi: "नजदीकी जन सेवा केंद्र या ब्लॉक कार्यालय में स्थिति जांचें"
      }[lang],
      description: {
        en: "Ask the operator or Panchayat assistant to check the Public Financial Management System (PFMS) rejection reason for your pension or wage ID.",
        bn: "পঞ্চায়েত বা সিএসসি অপারেটরকে দিয়ে পিএফএমএস পোর্টালে আপনার টাকা আটকে যাওয়ার সঠিক কারণ যাচাই করিয়ে নিন।",
        hi: "पंचायत सहायक या सीएससी ऑपरेटर से पीएफएमएस पोर्टल पर अपनी पेंशन या मजदूरी भुगतान की रिजेक्शन वजह पता करें।"
      }[lang]
    }
  ];

  const spokenMessages = {
    hi: "आपकी पेंशन या भुगतान रुकने के मुख्य कारण बैंक खाते का निष्क्रिय होना, आधार डीबीटी लिंक न होना, या वार्षिक जीवन प्रमाण पत्र लंबित होना हो सकते हैं। अपने बैंक या नजदीकी पंचायत केंद्र में जाकर आधार सीडिंग और ई-केवाईसी जांच लें।",
    bn: "আপনার পেনশন বা টাকা আটকে যাওয়ার প্রধান কারণ হতে পারে ব্যাংক অ্যাকাউন্ট নিষ্ক্রিয় থাকা, আধার ডিবিটি লিঙ্ক বিচ্ছিন্ন হওয়া বা জীবন প্রমাণপত্র জমা না দেওয়া। ব্যাংকে বা পঞ্চায়েত কেন্দ্রে গিয়ে আধার লিঙ্কিং ও ই-কেওয়াইসি পরীক্ষা করান।",
    en: "If your pension or wage payment has stopped, the most common reasons are an inactive bank account, decoupled Aadhaar DBT mapping, or a pending annual Life Certificate. Please check your Aadhaar seeding and biometric e-KYC at your bank or Panchayat office."
  };

  return {
    flow: "payment_triage",
    language: lang,
    spoken_reply: spokenMessages[lang] || spokenMessages.hi,
    checklist
  };
}

export function listGrievances() {
  return [
    {
      id: "TKT-GEN-01",
      scheme: "सामाजिक सुरक्षा पेंशन (Social Security Pension)",
      issue: "बैंक खाता निष्क्रिय / जीवन प्रमाण पत्र लंबित",
      remediation: "बैंक या डाकघर में खाता सक्रिय करें अथवा बायोमेट्रिक जीवन प्रमाण पत्र जमा करें"
    },
    {
      id: "TKT-GEN-02",
      scheme: "मनरेगा ग्रामीण मजदूरी (MGNREGA Wages)",
      issue: "आधार डीबीटी मैपिंग (NPCI Decoupled)",
      remediation: "बैंक शाखा में आधार डीबीटी मैपिंग अपडेट करवाएं"
    }
  ];
}
