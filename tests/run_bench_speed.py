import http.server
import socketserver
import threading
import json
import subprocess
import os

PORT = 8098
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
async function benchmark() {
  try {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = 'hubners_clean.png'; });

    await faceapi.nets.tinyFaceDetector.loadFromUri('../models');
    await faceapi.nets.ageGenderNet.loadFromUri('../models');
    await faceapi.tf.setBackend('webgl');
    await faceapi.tf.ready();

    // Warmup
    const optWarmup = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.22 });
    await faceapi.detectAllFaces(img, optWarmup).withAgeAndGender();

    // Test different input sizes: 224 vs 320 vs 416
    const sizes = [224, 320, 416];
    const sizeResults = {};

    for (const size of sizes) {
      const opt = new faceapi.TinyFaceDetectorOptions({ inputSize: size, scoreThreshold: 0.22 });
      const times = [];
      let detectedCount = 0;
      for (let i = 0; i < 4; i++) {
        const t0 = performance.now();
        const res = await faceapi.detectAllFaces(img, opt).withAgeAndGender();
        times.push(performance.now() - t0);
        detectedCount = res.length;
      }
      const avg = times.reduce((a,b)=>a+b, 0) / times.length;
      sizeResults[size] = { avgMs: Math.round(avg), detectedCount };
    }

    await fetch('/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sizeResults)
    });
  } catch(e) {
    await fetch('/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message })
    });
  }
}
benchmark();
</script></body></html>"""

with open(r'D:\01_Development\Extension\WomanDefender\tests\bench_speed.html', 'w') as f:
    f.write(html)

proc = subprocess.Popen([
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    '--headless=new',
    '--use-gl=angle',
    f'http://localhost:{PORT}/tests/bench_speed.html'
])

if done_event.wait(timeout=20):
    print('BENCHMARK RESULTS:', results)
else:
    print('TIMEOUT')

try: proc.terminate()
except: pass
httpd.shutdown()
