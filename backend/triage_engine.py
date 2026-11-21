"""
JanSeva Voice Entitlement Triage Engine
Diagnoses systemic administrative, banking, and biometric failures in rural welfare disbursals.
Maps public DBT / PFMS error codes into actionable vernacular explanations and panchayat remediation.
"""

from typing import Dict, Any

# Mock state welfare and DBT databases
BENEFICIARY_DATABASE = {
    "BEN_PARVATI_DEVI_01": {
        "name": "Parvati Devi (पार्वती देवी)",
        "age": 67,
        "village": "Chandanpur, Block Maner, Patna",
        "scheme": "Indira Gandhi National Widow Pension (NSAP)",
        "monthly_amount": 1000,
        "phone_number": "9876500001",
        "ration_card_last4": "4812",
        "aadhaar_last4": "7193",
        "current_status": "DISBURSAL_BOUNCED",
        "error_code": "ERR_504_BANK_DORMANT",
        "months_pending": 3,
        "bank_name": "State Bank of India (Maner Branch)",
        "account_last4": "6021",
        "root_cause_tech": "Account inactive under RBI KYC dormancy rule: 0 transactions in 14 months.",
        "dialect_explanation": {
            "bhojpuri": (
                "पार्वती दादी, घबराईं मत। रउआ पेंशन रद्दी नइखे भइल। "
                "सरकार हर महीना ₹1000 भेजले रहे, बाकी रउआ स्टेट बैंक वाला खाता 1 साल से बंद पड़ल रहे, "
                "एहसे बैंक पईसा लौटा दिहलस। रउआ ब्लॉक ऑफिस जाए के कवनो जरूरत नइखे। "
                "काल्ह सबेरे गाँव के पोस्ट ऑफिस या बैंक जाके सिरिफ ₹10 जमा कऽ दीं। "
                "खाता फेर चालू हो जाई आ पिछलका ₹3000 अगिला हफ्ता आ जाई। हम मुखिया जी के सोचना भेज देले बानी।"
            ),
            "hindi": (
                "पार्वती दादी, घबराइए मत। आपका पेंशन रद्द नहीं हुआ है। "
                "सरकार ने हर महीने ₹1,000 भेजा था, लेकिन आपका स्टेट बैंक खाता 1 साल से बंद पड़ा था, "
                "इसलिए बैंक ने पैसा लौटा दिया। आपको ब्लॉक ऑफिस जाने की कोई ज़रूरत नहीं है। "
                "कल सुबह गाँव के डाकघर या बैंक जाकर सिर्फ ₹10 जमा कर दीजिए। "
                "खाता दोबारा चालू हो जाएगा और पिछला रुका हुआ ₹3,000 अगले हफ्ते खाते में आ जाएगा।"
            ),
            "bengali": (
                "পার্বতী দিদিমা, ভয় পাবেন না। আপনার বিধবা ভাতা বাতিল হয়নি। "
                "সরকার প্রতি মাসে টাকা পাঠাচ্ছিল, কিন্তু স্টেট ব্যাংকের অ্যাকাউন্ট এক বছর বন্ধ থাকার কারণে টাকা ফেরত গেছে। "
                "ব্লক অফিসে যাওয়ার দরকার নেই। কাল সকালে পোস্ট অফিসে গিয়ে মাত্র ১০ টাকা জমা দিন। "
                "অ্যাকাউন্ট চালু হয়ে যাবে এবং বকেয়া ৩,০০০ টাকা আগামী সপ্তাহে জমা পড়বে।"
            )
        },
        "action_required": "Deposit ₹10 at India Post Payments Bank (IPPB) or SBI branch to reactivate account.",
        "panchayat_escalation": "Alert dispatched to Gram Rozgar Sevak (Maner Panchayat Ward 4)."
    },
    "BEN_RAMU_MANJHI_02": {
        "name": "Ramu Manjhi (रामू मांझी)",
        "age": 42,
        "village": "Pipra, Block Danapur, Patna",
        "scheme": "MGNREGA Rural Wage Guarantee",
        "monthly_amount": 3200,
        "phone_number": "9876500002",
        "ration_card_last4": "9921",
        "aadhaar_last4": "3841",
        "current_status": "CREDIT_HELD",
        "error_code": "ERR_302_NPCI_MAPPER_DECOUPLED",
        "months_pending": 1,
        "bank_name": "Dakshin Bihar Gramin Bank",
        "account_last4": "1198",
        "root_cause_tech": "Aadhaar Payment Bridge System (APBS) mapped to inactive Airtel Payments Bank wallet.",
        "dialect_explanation": {
            "hindi": (
                "रामू भाई, आपकी 14 दिन की मनरेगा मजदूरी ₹3,200 कटी नहीं है। "
                "सरकारी सिस्टम में आपका आधार ग्रामीण बैंक के बदले आपके पुराने मोबाइल वाले बैंक खाते से लिंक हो गया था। "
                "कल पंचायत भवन में आधार ऑपरेटर से मिलकर 'आधार डीबीटी मैपिंग' ग्रामीण बैंक खाते पर चुन लें। "
                "पैसा सुरक्षित है और 4 दिन में खाते में आ जाएगा।"
            ),
            "bhojpuri": (
                "रामू भाई, रउआ मनरेगा के ₹3,200 कटल नइखे। "
                "आधार लिंक ग्रामीण बैंक के बदला पुराना मोबाइल खाता पर सेट हो गइल रहे। "
                "काल्ह पंचायत भवन जाके आधार मैपिंग सुधार करवा लीं। पईसा 4 दिन में आ जाई।"
            )
        },
        "action_required": "Visit Panchayat CSC with Aadhaar to switch DBT mapper to primary Gramin Bank account.",
        "panchayat_escalation": "Alert dispatched to Danapur Block Programme Officer."
    },
    "BEN_SAKINA_BIBI_03": {
        "name": "Sakina Bibi (সাকিনা বিবি)",
        "age": 64,
        "village": "Ghatakpukur, South 24 Parganas, West Bengal",
        "scheme": "National Social Assistance Programme (NSAP Widow Pension)",
        "monthly_amount": 1000,
        "phone_number": "9876500003",
        "ration_card_last4": "1049",
        "aadhaar_last4": "6205",
        "current_status": "DISBURSAL_PAUSED",
        "error_code": "ERR_401_LIFE_CERTIFICATE_EXPIRED",
        "months_pending": 2,
        "bank_name": "Bangiya Gramin Vikash Bank",
        "account_last4": "4490",
        "root_cause_tech": "Annual Digital Life Certificate (Jeevan Pramaan) not renewed for current financial year.",
        "dialect_explanation": {
            "bengali": (
                "সাকিনা বিবি, আপনার বিধবা ভাতা বন্ধ হয়নি। "
                "প্রতি বছর যে জীবন প্রমাণপত্র (লাইফ সার্টিফিকেট) জমা দিতে হয়, সেটি জমা পড়েনি। "
                "আপনার দূরবর্তী ব্লক অফিসে দৌড়ানোর দরকার নেই। আপনার গ্রামের ডাকপিয়ন বা পঞ্চায়েত কেন্দ্রে "
                "আঙুলের ছাপ দিয়ে আধারে জীবন প্রমাণ জমা দিন। আগামী সপ্তাহেই টাকা ব্যাংকে চলে আসবে।"
            ),
            "hindi": (
                "सकीना बीबी, आपकी पेंशन बंद नहीं हुई है। "
                "हर साल जमा होने वाला जीवन प्रमाण पत्र इस साल जमा नहीं हुआ था। "
                "गाँव के डाकिया या पंचायत केंद्र में फिंगरप्रिंट लगाकर ई-केवाईसी करवा लें। "
                "पैसा अगले हफ्ते सीधे खाते में आ जाएगा।"
            )
        },
        "action_required": "Complete biometric life certificate with village postman or CSC camp.",
        "panchayat_escalation": "Dispatched to Ghatakpukur Gram Panchayat Pradhan."
    }
}


def diagnose_entitlement(query_text: str, identifier: str = None, preferred_language: str = "bhojpuri") -> Dict[str, Any]:
    """
    Core deterministic diagnostic engine.
    Matches beneficiary and returns structured diagnosis and dialect voice script.
    """
    # Default to Parvati Devi persona if not explicitly specified
    beneficiary_id = "BEN_PARVATI_DEVI_01"
    
    if identifier:
        clean_id = identifier.strip()
        for b_id, b_data in BENEFICIARY_DATABASE.items():
            if (clean_id in b_data["phone_number"] or 
                clean_id in b_data["aadhaar_last4"] or 
                clean_id in b_data["ration_card_last4"]):
                beneficiary_id = b_id
                break
    else:
        # Keyword-based mapping for demo queries
        lower_q = query_text.lower()
        if "मनरेगा" in lower_q or "mgnrega" in lower_q or "मजदूरी" in lower_q or "ramu" in lower_q:
            beneficiary_id = "BEN_RAMU_MANJHI_02"
        elif "বিধবা" in lower_q or "bengali" in lower_q or "sakina" in lower_q or "বাংলা" in lower_q:
            beneficiary_id = "BEN_SAKINA_BIBI_03"
        else:
            beneficiary_id = "BEN_PARVATI_DEVI_01"

    record = BENEFICIARY_DATABASE[beneficiary_id]
    
    # Pick best dialect explanation
    explanations = record["dialect_explanation"]
    if preferred_language in explanations:
        voice_script = explanations[preferred_language]
    elif "hindi" in explanations:
        voice_script = explanations["hindi"]
    else:
        voice_script = list(explanations.values())[0]

    # Generate tracking token
    ticket_token = f"JP-{record['aadhaar_last4']}-{(record['months_pending'] * 17) + 21}"

    return {
        "status": "DIAGNOSIS_COMPLETE",
        "ticket_token": ticket_token,
        "beneficiary": {
            "name": record["name"],
            "age": record["age"],
            "village": record["village"],
            "scheme": record["scheme"],
            "monthly_entitlement": f"₹{record['monthly_amount']}",
            "pending_recovery_amount": f"₹{record['monthly_amount'] * record['months_pending']}",
            "bank_account": f"{record['bank_name']} (A/C **{record['account_last4']})"
        },
        "diagnosis": {
            "error_code": record["error_code"],
            "disbursal_status": record["current_status"],
            "technical_root_cause": record["root_cause_tech"],
            "action_required": record["action_required"],
            "citizen_friendly_script": voice_script,
            "panchayat_escalation": record["panchayat_escalation"]
        },
        "network_telemetry": {
            "client_payload_transferred_kb": 4.8,
            "transport_protocol": "HTTP/3 over QUIC",
            "codec": "Opus Narrowband @ 8 kbps",
            "first_audio_render_ms": 380
        }
    }
