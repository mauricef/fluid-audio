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

import sys

# Check if user wants HTTP or HTTPS
use_https = "--https" in sys.argv or "-s" in sys.argv

PORT = find_available_port(5000)
handler = NoCacheHTTPRequestHandler

if use_https:
    # Generate certificate if it doesn't exist
    generate_self_signed_cert()
    
    # Create regular HTTP server
    httpd = socketserver.TCPServer(("", PORT), handler)
    
    # Create SSL context
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile="localhost.crt", keyfile="localhost.key")
    
    # Wrap socket with SSL context
    httpd.socket = context.wrap_socket(httpd.socket, server_side=True)
    protocol = "https"
else:
    # Create plain HTTP server
    httpd = socketserver.TCPServer(("", PORT), handler)
    protocol = "http"

# Get local IP address
try:
    # Try to get the local IP by connecting to a remote address
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        # Connect to Google's DNS server (doesn't actually send data)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
except Exception:
    # Fallback to localhost if we can't determine the local IP
    local_ip = "127.0.0.1"

print(f"Serving at:")
print(f"Local: {protocol}://localhost:{PORT}?mode=server {protocol}://localhost:{PORT}?mode=hud")
print(f"Network: {protocol}://{local_ip}:{PORT}?mode=server {protocol}://{local_ip}:{PORT}?mode=hud")
if use_https:
    print("Note: You will need to accept the self-signed certificate warning in your browser")
else:
    print("Running in HTTP mode (no SSL)")

httpd.serve_forever() 