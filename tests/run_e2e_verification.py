import http.server
import socketserver
import threading
import json
import subprocess

PORT = 8099
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
<html><head>
  <script src="../libs/face-api.min.js"></script>
  <script src="../scripts/vision-detector.js"></script>
</head><body>
<script>
async function runVerification() {
  try {
    const detector = new window.VisionDetector();
    // Wait for model to load
    for (let i = 0; i < 40; i++) {
      if (detector.isModelLoaded) break;
      await new Promise(r => setTimeout(r, 100));
    }

    const testImages = [
      { name: 'hubners_clean.png', expectFemale: true },
      { name: 'male_daffa.png', expectFemale: false },
      { name: 'game_thumb.png', expectFemale: false }
    ];

    const outcomes = [];

    for (const item of testImages) {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = item.name; });

      const t0 = performance.now();
      const res = await detector.analyzeThumbnailElement(img);
      const elapsed = Math.round(performance.now() - t0);

      outcomes.push({
        name: item.name,
        res,
        elapsedMs: elapsed,
        isFemale: res ? res.isFemale : false,
        pass: (item.expectFemale ? (res && res.isFemale) : (!res || !res.isFemale))
      });
    }

    await fetch('/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, backend: faceapi.tf.getBackend(), outcomes })
    });
  } catch (err) {
    await fetch('/results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: err.message })
    });
  }
}
runVerification();
</script></body></html>"""

with open(r'D:\01_Development\Extension\WomanDefender\tests\test_e2e_detector.html', 'w') as f:
    f.write(html)

proc = subprocess.Popen([
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    '--headless=new',
    '--use-gl=angle',
    f'http://localhost:{PORT}/tests/test_e2e_detector.html'
])

if done_event.wait(timeout=25):
    print('VERIFICATION RESULTS:', json.dumps(results, indent=2))
else:
    print('TIMEOUT')

try: proc.terminate()
except: pass
httpd.shutdown()
