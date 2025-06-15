import http.server
import socketserver
import socket
import ssl
import os

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

def find_available_port(start_port):
    port = start_port
    while True:
        try:
            # Test if port is available
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('', port))
                return port
        except OSError:
            print(f"Port {port} is in use, trying {port + 1}")
            port += 1

def generate_self_signed_cert():
    if not (os.path.exists('localhost.crt') and os.path.exists('localhost.key')):
        print("Generating self-signed certificate...")
        os.system('openssl req -x509 -nodes -days 365 -newkey rsa:2048 '
                 '-keyout localhost.key -out localhost.crt '
                 '-subj "/C=US/ST=State/L=City/O=Organization/OU=Unit/CN=localhost" '
                 '-addext "subjectAltName=DNS:localhost,IP:127.0.0.1"')

PORT = find_available_port(5000)
handler = NoCacheHTTPRequestHandler

# Generate certificate if it doesn't exist
generate_self_signed_cert()

# Create regular HTTP server
httpd = socketserver.TCPServer(("", PORT), handler)

# Create SSL context
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(certfile="localhost.crt", keyfile="localhost.key")

# Wrap socket with SSL context
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

# Get local IP address
hostname = socket.gethostname()
local_ip = socket.gethostbyname(hostname)

print(f"Serving at:")
print(f"Local: https://localhost:{PORT}?mode=server https://localhost:{PORT}?mode=hud")
print(f"Network: https://{local_ip}:{PORT}?mode=server https://{local_ip}:{PORT}?mode=hud")
print("Note: You will need to accept the self-signed certificate warning in your browser")

httpd.serve_forever() 