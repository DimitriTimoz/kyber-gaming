import Cocoa
import WebKit
import Foundation

class SSLTrustDelegate: NSObject, URLSessionDelegate {
    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
            if let trust = challenge.protectionSpace.serverTrust {
                completionHandler(.useCredential, URLCredential(trust: trust))
                return
            }
        }
        completionHandler(.performDefaultHandling, nil)
    }
}

class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var clientProcess: Process?
    let sslDelegate = SSLTrustDelegate()

    var configFilePath: URL {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let kyberDir = appSupport.appendingPathComponent("Kyber", isDirectory: true)
        try? FileManager.default.createDirectory(at: kyberDir, withIntermediateDirectories: true)
        return kyberDir.appendingPathComponent("config.json")
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        let windowWidth: CGFloat = 1060
        let windowHeight: CGFloat = 680

        let screenSize = NSScreen.main?.visibleFrame.size ?? CGSize(width: 1920, height: 1080)
        let rect = NSRect(
            x: (screenSize.width - windowWidth) / 2,
            y: (screenSize.height - windowHeight) / 2,
            width: windowWidth,
            height: windowHeight
        )

        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )

        window.title = "Kyber Gaming Launcher"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.isMovableByWindowBackground = true
        window.backgroundColor = NSColor(calibratedRed: 0.043, green: 0.055, blue: 0.078, alpha: 1.0)
        window.minSize = NSSize(width: 900, height: 580)

        // WebKit Configuration
        let userContentController = WKUserContentController()
        userContentController.add(self, name: "kyber")

        let config = WKWebViewConfiguration()
        config.userContentController = userContentController
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.setValue(false, forKey: "drawsBackground") // Transparent background

        window.contentView!.addSubview(webView)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        loadUI()
    }

    func loadUI() {
        // Locate UI resources
        var htmlURL: URL?

        if let bundleResource = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "ui") {
            htmlURL = bundleResource
        } else if let directResource = Bundle.main.url(forResource: "index", withExtension: "html") {
            htmlURL = directResource
        } else {
            // Development fallback to current working directory
            let cwd = FileManager.default.currentDirectoryPath
            let devPath = URL(fileURLWithPath: cwd).appendingPathComponent("client-launcher/ui/index.html")
            if FileManager.default.fileExists(atPath: devPath.path) {
                htmlURL = devPath
            }
        }

        if let url = htmlURL {
            let directory = url.deletingLastPathComponent()
            webView.loadFileURL(url, allowingReadAccessTo: directory)
        } else {
            let errorHtml = "<html><body style='background:#0b0e14;color:#fff;font-family:sans-serif;padding:40px;'><h2>Erreur : Ressources UI introuvables.</h2></body></html>"
            webView.loadHTMLString(errorHtml, baseURL: nil)
        }
    }

    // ==========================================================================
    // JS -> Swift Message Handler
    // ==========================================================================
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let action = body["action"] as? String else { return }

        switch action {
        case "get_config":
            sendConfigToWeb()

        case "save_config":
            if let data = try? JSONSerialization.data(withJSONObject: body, options: .prettyPrinted) {
                try? data.write(to: configFilePath)
            }

        case "ping_server":
            guard let serverId = body["serverId"] as? String,
                  let host = body["host"] as? String,
                  let port = body["port"] as? Int else { return }
            pingServer(serverId: serverId, host: host, port: port)

        case "launch_session":
            guard let server = body["server"] as? [String: Any],
                  let host = server["host"] as? String,
                  let port = server["port"] as? Int else { return }
            let settings = body["settings"] as? [String: Any] ?? [:]
            launchStreamingSession(host: host, port: port, settings: settings)

        default:
            break
        }
    }

    func sendConfigToWeb() {
        guard FileManager.default.fileExists(atPath: configFilePath.path),
              let data = try? Data(contentsOf: configFilePath),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let jsonData = try? JSONSerialization.data(withJSONObject: json),
              let jsonString = String(data: jsonData, encoding: .utf8) else { return }

        let js = "window.onLoadNativeConfig(\(jsonString));"
        DispatchQueue.main.async {
            self.webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }

    // ==========================================================================
    // Server Ping Probe (Low-latency URLSession)
    // ==========================================================================
    func pingServer(serverId: String, host: String, port: Int) {
        guard let url = URL(string: "https://\(host):\(port)/capabilities") else { return }

        let startTime = DispatchTime.now()
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 2.0
        config.timeoutIntervalForResource = 2.0

        let session = URLSession(configuration: config, delegate: sslDelegate, delegateQueue: nil)
        var request = URLRequest(url: url)
        request.httpMethod = "GET"

        let task = session.dataTask(with: request) { _, response, error in
            let endTime = DispatchTime.now()
            let nanoTime = endTime.uptimeNanoseconds - startTime.uptimeNanoseconds
            let latencyMs = Double(nanoTime) / 1_000_000.0

            let isOnline = (error == nil && (response as? HTTPURLResponse)?.statusCode != nil)

            DispatchQueue.main.async {
                let js = "window.onServerPingResult('\(serverId)', \(isOnline), \(round(latencyMs * 10) / 10));"
                self.webView.evaluateJavaScript(js, completionHandler: nil)
            }
        }
        task.resume()
    }

    // ==========================================================================
    // Launch Streaming Session via kyclient
    // ==========================================================================
    func launchStreamingSession(host: String, port: Int, settings: [String: Any]) {
        // 1. Optionally notify remote resizer of desired resolution
        if let resolution = settings["resolution"] as? String,
           let fps = settings["refreshRate"] as? String {
            let parts = resolution.split(separator: "x")
            if parts.count == 2, let w = Int(parts[0]), let h = Int(parts[1]) {
                let resizerUrl = URL(string: "https://\(host):8081/api/resize?width=\(w)&height=\(h)&rate=\(fps)")
                if let rUrl = resizerUrl {
                    var req = URLRequest(url: rUrl)
                    req.httpMethod = "GET"
                    let config = URLSessionConfiguration.ephemeral
                    config.timeoutIntervalForRequest = 1.5
                    let sess = URLSession(configuration: config, delegate: sslDelegate, delegateQueue: nil)
                    sess.dataTask(with: req).resume()
                }
            }
        }

        // 2. Locate kyclient executable
        let possibleKyclientPaths = [
            "/Applications/Kyber-Client.app/Contents/MacOS/kyclient",
            "/usr/local/bin/kyclient",
            Bundle.main.bundleURL.appendingPathComponent("Contents/MacOS/kyclient").path
        ]

        var executablePath: String?
        for p in possibleKyclientPaths {
            if FileManager.default.isExecutableFile(atPath: p) {
                executablePath = p
                break
            }
        }

        guard let kyclient = executablePath else {
            let alert = NSAlert()
            alert.messageText = "Erreur Kyber Client"
            alert.informativeText = "Impossible de trouver l'exécutable kyclient dans /Applications/Kyber-Client.app/Contents/MacOS/kyclient."
            alert.alertStyle = .critical
            alert.runModal()
            return
        }

        // 3. Assemble arguments from settings
        var args: [String] = [host, "--port", String(port)]

        if let bitrate = settings["bitrate"] as? String, !bitrate.isEmpty {
            args += ["--bitrate", bitrate]
        }
        if let codec = settings["codec"] as? String, !codec.isEmpty {
            args += ["--video-codec", codec]
        }
        if let kymuxVideo = settings["kymuxVideo"] as? String, !kymuxVideo.isEmpty {
            args += ["--kymux-video", kymuxVideo]
        }
        if let kymuxAudio = settings["kymuxAudio"] as? String, !kymuxAudio.isEmpty {
            args += ["--kymux-audio", kymuxAudio]
        }
        if let audioBuffer = settings["audioBuffer"] as? String, !audioBuffer.isEmpty {
            args += ["--audio-buffer", audioBuffer]
        }
        if let tlsSkip = settings["tlsSkip"] as? Bool, tlsSkip {
            args += ["--tls-skip-verification"]
        }
        if let forceXbox = settings["forceXbox"] as? Bool, forceXbox {
            args += ["--gamepad-force-xbox360", "true"]
        }
        if let keyboardGrab = settings["keyboardGrab"] as? Bool, keyboardGrab {
            args += ["--keyboard-grab", "true"]
        }

        print("[launcher] Spawning: \(kyclient) \(args.joined(separator: " "))")

        // 4. Hide / minimize launcher window
        self.window.miniaturize(nil)

        // 5. Spawn kyclient process in background
        DispatchQueue.global(qos: .userInitiated).async {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: kyclient)
            process.arguments = args

            self.clientProcess = process

            do {
                try process.run()
                process.waitUntilExit()
            } catch {
                print("[launcher] Failed to start process: \(error)")
            }

            // Restore launcher window once gaming session ends
            DispatchQueue.main.async {
                self.clientProcess = nil
                self.window.deminiaturize(nil)
                self.window.makeKeyAndOrderFront(nil)
                NSApp.activate(ignoringOtherApps: true)
                self.pingServer(serverId: "lan-main", host: host, port: port)
            }
        }
    }
}

// Entrypoint
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
