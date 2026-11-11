import json
import logging
import os
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS


ROOT = Path(__file__).resolve().parent
DATABASE = Path(os.environ.get("ASSISTANT_DATABASE", str(ROOT / "assistant_history.db")))
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:1.5b")
PORT = int(os.environ.get("PORT", "8788"))
MAX_MESSAGE_LENGTH = 4000
HISTORY_LIMIT = 12
SYSTEM_PROMPT = (
    "You are the helpful assistant on Tahir Iqbal's personal portfolio. Answer "
    "questions about the portfolio using these facts: Tahir is a web developer and "
    "BS Computer Science student at the University of Central Punjab in Pakistan. "
    "He is learning and practicing HTML, CSS, and JavaScript and has 6 months to 1 "
    "year of web-development learning and practice. Swift Cart is his online "
    "shopping project for men's and women's clothing and watches. AutoCoverX is "
    "his project combining Arduino software and physical hardware; he wrote the "
    "Arduino software and assembled the hardware. The portfolio lists these "
    "services: web development, front-end development, back-end development, "
    "UI/UX design, JavaScript help, Node.js support, Angular guidance, React "
    "component help, HTML/CSS teaching, and web security. Project artwork on the "
    "portfolio is illustrative, not a screenshot or photo of the actual projects. "
    "The site does not specify the projects' exact technology stacks, dates, "
    "clients, or additional features; do not invent them. Answer a broad range of "
    "other questions clearly and concisely. Respond in the language the user uses "
    "or requests, including English, Urdu, or Roman Urdu. Be honest about "
    "uncertainty and never claim to perform actions outside this chat."
)
DEFAULT_ORIGINS = (
    "http://127.0.0.1:8000,http://localhost:8000,"
    "http://127.0.0.1:5500,http://localhost:5500,"
    "http://127.0.0.1:3000,http://localhost:3000"
)

app = Flask(__name__)
allowed_origins = [
    origin.strip()
    for origin in os.environ.get("ASSISTANT_ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",")
    if origin.strip()
]
CORS(app, resources={r"/api/*": {"origins": allowed_origins}})
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))


@contextmanager
def database():
    connection = sqlite3.connect(DATABASE)
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database():
    DATABASE.parent.mkdir(parents=True, exist_ok=True)
    with database() as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id TEXT NOT NULL DEFAULT '',
                role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
                content TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )"""
        )
        columns = {
            row[1] for row in connection.execute("PRAGMA table_info(messages)")
        }
        if "conversation_id" not in columns:
            connection.execute(
                "ALTER TABLE messages ADD COLUMN conversation_id TEXT NOT NULL DEFAULT ''"
            )


initialize_database()


def read_recent_messages(conversation_id):
    with database() as connection:
        rows = connection.execute(
            """SELECT role, content FROM messages
               WHERE conversation_id = ? ORDER BY id DESC LIMIT ?""",
            (conversation_id, HISTORY_LIMIT),
        ).fetchall()
    return [{"role": role, "content": content} for role, content in reversed(rows)]


def save_message(role, content, conversation_id):
    with database() as connection:
        connection.execute(
            "INSERT INTO messages(conversation_id, role, content) VALUES (?, ?, ?)",
            (conversation_id, role, content),
        )


def validated_conversation_id(value):
    try:
        parsed = uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        return None
    return str(parsed)


@app.get("/health")
def health():
    return jsonify({"ok": True, "model": OLLAMA_MODEL})


@app.get("/api/chat/history")
def chat_history():
    conversation_id = validated_conversation_id(request.args.get("conversation_id"))
    if not conversation_id:
        return jsonify({"error": "A valid conversation_id is required."}), 400
    with database() as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """SELECT role, content, created_at FROM messages
               WHERE conversation_id = ? ORDER BY id DESC LIMIT 40""",
            (conversation_id,),
        ).fetchall()
    return jsonify({"messages": [dict(row) for row in reversed(rows)]})


@app.post("/api/chat")
def chat():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Send a JSON object containing a message."}), 400

    message = str(data.get("message", "")).strip()
    language = str(data.get("language", "Auto Detect")).strip()
    conversation_id = validated_conversation_id(data.get("conversation_id"))
    if not conversation_id:
        return jsonify({"error": "A valid conversation_id is required."}), 400
    if not message:
        return jsonify({"error": "Write a message first."}), 400
    if len(message) > MAX_MESSAGE_LENGTH:
        return jsonify({"error": f"Messages must be {MAX_MESSAGE_LENGTH} characters or fewer."}), 413
    if language not in {"Auto Detect", "English", "Urdu"}:
        return jsonify({"error": "Language must be Auto Detect, English, or Urdu."}), 400

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(read_recent_messages(conversation_id))
    messages.append({
        "role": "user",
        "content": f"Preferred response language: {language}.\n\n{message}",
    })

    try:
        response = requests.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": OLLAMA_MODEL,
                "messages": messages,
                "stream": False,
                "keep_alive": "10m",
                "options": {
                    "temperature": 0.3,
                    "num_ctx": 2048,
                    "num_predict": 192,
                    "num_batch": 128,
                },
            },
            timeout=120,
        )
    except requests.Timeout:
        app.logger.warning("Ollama chat request timed out.")
        return jsonify({"error": "The local AI model timed out. Try again shortly."}), 504
    except requests.ConnectionError:
        app.logger.warning("Could not connect to Ollama at %s.", OLLAMA_URL)
        return jsonify({"error": "Ollama is offline. Start Ollama and try again."}), 503
    except requests.RequestException:
        app.logger.exception("Ollama chat request failed.")
        return jsonify({"error": "Could not contact the local AI model."}), 502

    if not response.ok:
        app.logger.error("Ollama returned HTTP %s: %s", response.status_code, response.text[:500])
        return jsonify({"error": "The local AI model rejected the request. Check the model name."}), 502
    try:
        answer = response.json().get("message", {}).get("content", "").strip()
    except (ValueError, AttributeError):
        app.logger.exception("Ollama returned an invalid chat response.")
        return jsonify({"error": "The local AI returned an unreadable response."}), 502
    if not answer:
        return jsonify({"error": "The local AI returned an empty response. Try again."}), 502

    save_message("user", message, conversation_id)
    save_message("assistant", answer, conversation_id)
    return jsonify({"answer": answer, "source": "ollama_local"})


if __name__ == "__main__":
    app.run(host=os.environ.get("HOST", "127.0.0.1"), port=PORT, debug=False)
