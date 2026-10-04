import http.server
import socketserver
import threading
import json
import subprocess
import os

PORT = 8097
DIRECTORY = r'D:\01_Development\Extension\WomanDefender'
results = None
done_event = threading.Event()

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    def do_POST(self):
        global results
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        results = json.loads(post_data.decode('utf-8'))
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'OK')
        done_event.set()
    def log_message(self, *args): pass

httpd = socketserver.TCPServer(('', PORT), Handler)
t = threading.Thread(target=httpd.serve_forever)
t.daemon = True
t.start()

html = """<!DOCTYPE html>
<html><head><script src="../libs/face-api.min.js"></script></head><body>
<script>
async function test() {
  try {
    await faceapi.tf.setBackend('webgl');
    await faceapi.tf.ready();
    await faceapi.nets.tinyFaceDetector.loadFromUri('../models');

    // Test loading i.ytimg.com directly with crossOrigin = 'anonymous'
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const loadPromise = new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('img load failed'));
    });
    img.src = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg';
    await loadPromise;

    // Test drawing to canvas and getImageData (check if tainted!)
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 64, 64);
    const imgData = ctx.getImageData(0, 0, 64, 64);
    const notTainted = imgData.data.length > 0;

    // Test faceapi detection on direct image
    const t0 = performance.now();
    const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 }));
    const inferenceTime = performance.now() - t0;

    await fetch('/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, notTainted, detectionsCount: detections.length, inferenceTimeMs: Math.round(inferenceTime) })
    });
  } catch (err) {
    await fetch('/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: err.message })
    });
  }
}
test();
</script></body></html>"""

with open(r'D:\01_Development\Extension\WomanDefender\tests\test_direct_image.html', 'w') as f:
    f.write(html)

proc = subprocess.Popen([
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    '--headless=new',
    '--use-gl=angle',
    f'http://localhost:{PORT}/tests/test_direct_image.html'
])

if done_event.wait(timeout=15):
    print('RESULTS:', results)
else:
    print('TIMEOUT')

try:
    proc.terminate()
except:
    pass
httpd.shutdown()
