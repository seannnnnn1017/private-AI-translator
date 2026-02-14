# pip install requests pyttsx3
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

import pyttsx3

HOST = "127.0.0.1"
PORT = 5005
RATE = 180
VOLUME = 1.0


def speak(text: str):
    engine = pyttsx3.init()
    engine.setProperty("rate", RATE)
    engine.setProperty("volume", VOLUME)
    engine.say(text)
    engine.runAndWait()


class TTSHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def do_POST(self):
        if self.path != "/tts":
            self.send_error(404, "Not Found")
            return

        length = int(self.headers.get("content-length", "0"))
        if length <= 0:
            self.send_error(400, "Empty body")
            return

        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        text = str(payload.get("text", "")).strip()
        if not text:
            self.send_error(400, "Empty text")
            return

        try:
            speak(text)
        except Exception as exc:
            self.send_error(500, f"TTS error: {exc}")
            return

        data = json.dumps({"ok": True}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    server = HTTPServer((HOST, PORT), TTSHandler)
    print(f"pyttsx3 TTS server on http://{HOST}:{PORT}/tts")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
