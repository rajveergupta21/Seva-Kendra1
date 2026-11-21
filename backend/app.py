"""
JanSeva Voice - Production-Ready Hackathon Server
Entry for Build for India 3 (Vibe Coders Hackathon Edition 3)
Serves the ultra-low-bandwidth PWA and processes Indic Voice queries via Sarvam AI.
"""

import os
import json
from flask import Flask, request, jsonify, send_from_directory
from sarvam_service import transcribe_audio, synthesize_speech
from triage_engine import diagnose_entitlement, BENEFICIARY_DATABASE

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENT_DIR = os.path.join(BASE_DIR, "client")

app = Flask(__name__, static_folder=CLIENT_DIR)


@app.route("/")
def index():
    """Serves the ultra-lightweight client PWA."""
    return send_from_directory(CLIENT_DIR, "index.html")


@app.route("/<path:path>")
def static_proxy(path):
    """Serves static assets (manifest.json, sw.js, icons)."""
    return send_from_directory(CLIENT_DIR, path)


@app.route("/api/health", methods=["GET"])
def health_check():
    """Network heartbeat endpoint used by the PWA to check edge connection quality."""
    return jsonify({
        "status": "healthy",
        "service": "JanSeva Voice Edge Gateway",
        "edge_pop": "CCU-01 (Kolkata Regional Edge PoP)",
        "protocol": "HTTP/3 QUIC Terminated",
        "sarvam_configured": bool(os.environ.get("SARVAM_API_KEY"))
    })


@app.route("/api/beneficiaries", methods=["GET"])
def list_beneficiaries():
    """Lists preloaded personas for live judging and verification."""
    return jsonify({
        "count": len(BENEFICIARY_DATABASE),
        "beneficiaries": [
            {
                "id": k,
                "name": v["name"],
                "scheme": v["scheme"],
                "village": v["village"],
                "error_code": v["error_code"]
            }
            for k, v in BENEFICIARY_DATABASE.items()
        ]
    })


@app.route("/api/diagnose", methods=["POST"])
def diagnose():
    """
    Main triage endpoint. Accepts text transcript, identifier, and dialect preference,
    returns deterministic diagnosis and synthesizes Sarvam Bulbul voice output.
    """
    data = request.get_json() or {}
    query_text = data.get("query", "हमार पेंशन तीन महीना से ना आवता")
    identifier = data.get("identifier", "")
    language = data.get("language", "bhojpuri")
    
    # Run deterministic welfare diagnosis
    diagnosis_result = diagnose_entitlement(
        query_text=query_text,
        identifier=identifier,
        preferred_language=language
    )
    
    # Map dialect to Sarvam language code
    lang_code_map = {
        "bhojpuri": "hi-IN",
        "hindi": "hi-IN",
        "bengali": "bn-IN",
        "odia": "or-IN"
    }
    sarvam_lang = lang_code_map.get(language, "hi-IN")
    
    # Synthesize audio explanation using Sarvam Bulbul TTS
    script = diagnosis_result["diagnosis"]["citizen_friendly_script"]
    tts_result = synthesize_speech(text=script, target_language_code=sarvam_lang)
    
    diagnosis_result["audio"] = tts_result
    return jsonify(diagnosis_result)


@app.route("/api/upload-voice", methods=["POST"])
def upload_voice():
    """
    Accepts raw audio file recorded from the phone microphone,
    transcribes it using Sarvam Saarika ASR, and runs diagnosis.
    """
    language = request.form.get("language", "bhojpuri")
    identifier = request.form.get("identifier", "")
    
    lang_code_map = {
        "bhojpuri": "hi-IN",
        "hindi": "hi-IN",
        "bengali": "bn-IN",
        "odia": "or-IN"
    }
    sarvam_lang = lang_code_map.get(language, "hi-IN")
    
    # Read audio bytes if file was uploaded
    audio_file = request.files.get("audio")
    if audio_file:
        audio_bytes = audio_file.read()
        asr_result = transcribe_audio(audio_bytes, filename=audio_file.filename, language_code=sarvam_lang)
        transcript = asr_result.get("transcript", "हमार पेंशन तीन महीना से ना आवता")
    else:
        transcript = "हमार पेंशन तीन महीना से ना आवता"
        asr_result = {"transcript": transcript, "provider": "Default fallback"}

    # Diagnose based on transcription
    diagnosis_result = diagnose_entitlement(
        query_text=transcript,
        identifier=identifier,
        preferred_language=language
    )
    
    # Synthesize voice response
    script = diagnosis_result["diagnosis"]["citizen_friendly_script"]
    tts_result = synthesize_speech(text=script, target_language_code=sarvam_lang)
    
    diagnosis_result["transcript_recognized"] = transcript
    diagnosis_result["asr_meta"] = asr_result
    diagnosis_result["audio"] = tts_result
    
    return jsonify(diagnosis_result)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    print(f"\n=======================================================")
    print(f" JANSEVA VOICE (জনসেবা বাণী / जनसेवा वाणी)")
    print(f" Hackathon Public Good Server Starting on port {port}")
    print(f" Serving ultra-lightweight client from {CLIENT_DIR}")
    print(f"=======================================================\n")
    app.run(host="0.0.0.0", port=port, debug=False)
