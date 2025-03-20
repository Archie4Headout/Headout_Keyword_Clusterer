from http.server import HTTPServer, SimpleHTTPRequestHandler
import os
from urllib.parse import parse_qs
import json

class EnvAwareHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/.env':
            # Only return the API key if requested from localhost
            if self.client_address[0] in ['127.0.0.1', '::1']:
                self.send_response(200)
                self.send_header('Content-type', 'text/plain')
                self.end_headers()
                
                # Read from .env file
                try:
                    with open('.env', 'r') as f:
                        env_content = f.read()
                    self.wfile.write(env_content.encode())
                except:
                    self.wfile.write(b'OPENAI_API_KEY=')
            else:
                self.send_error(403, "Access Denied")
        else:
            return SimpleHTTPRequestHandler.do_GET(self)

if __name__ == '__main__':
    port = 8000
    print(f'Starting server at http://localhost:{port}')
    httpd = HTTPServer(('', port), EnvAwareHandler)
    httpd.serve_forever() 