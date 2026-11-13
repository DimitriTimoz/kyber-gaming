use base64::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::Instant;
use tauri::Manager;

static HTTP_CLIENT: OnceLock<reqwest::Client> = OnceLock::new();

fn get_http_client() -> &'static reqwest::Client {
    HTTP_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .danger_accept_invalid_certs(true)
            .tcp_nodelay(true)
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(std::time::Duration::from_secs(90))
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .expect("Failed to create shared HTTP client")
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerEntry {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub control_port: Option<u16>,
    pub icon: Option<String>,
    pub auth_user: Option<String>,
    pub auth_password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamSettings {
    pub resolution: String,
    pub refresh_rate: String,
    pub bitrate: String,
    pub codec: String,
    pub kymux_video: String,
    pub kymux_audio: String,
    pub audio_buffer: String,
    pub tls_skip: bool,
    pub force_xbox: bool,
    pub keyboard_grab: bool,
    pub player_mode: Option<String>,
    pub hud_overlay: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub servers: Vec<ServerEntry>,
    pub settings: StreamSettings,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PingResult {
    pub online: bool,
    pub latency_ms: f64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            servers: Vec::new(),
            settings: StreamSettings {
                resolution: "native".into(),
                refresh_rate: "60".into(),
                bitrate: "40000000".into(),
                codec: "h264".into(),
                kymux_video: "gopstream".into(),
                kymux_audio: "unreliable_fec".into(),
                audio_buffer: "80".into(),
                tls_skip: true,
                force_xbox: true,
                keyboard_grab: true,
                player_mode: Some("auto".into()),
                hud_overlay: Some(true),
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredServer {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub control_port: u16,
    pub version: String,
}

fn get_config_path() -> PathBuf {
    let mut dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("kyber");
    let _ = fs::create_dir_all(&dir);
    dir.push("config.json");
    dir
}

#[tauri::command]
fn get_config() -> AppConfig {
    let path = get_config_path();
    if let Ok(content) = fs::read_to_string(&path) {
        if let Ok(config) = serde_json::from_str(&content) {
            return config;
        }
    }
    AppConfig::default()
}

#[tauri::command]
fn save_config(config: AppConfig) -> Result<(), String> {
    let path = get_config_path();
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn ping_server(host: String, port: u16) -> Result<PingResult, String> {
    let client = get_http_client();

    let url = format!("https://{}:{}/capabilities", host, port);
    let start = Instant::now();

    match client.get(&url).send().await {
        Ok(res) if res.status().is_success() || res.status().is_redirection() || res.status().as_u16() == 401 => {
            let latency_ms = start.elapsed().as_secs_f64() * 1000.0;
            Ok(PingResult {
                online: true,
                latency_ms: (latency_ms * 10.0).round() / 10.0,
            })
        }
        _ => {
            // Fallback check on Kyber control port 8081
            let fallback_url = format!("https://{}:8081/api/system", host);
            let start2 = Instant::now();
            match client.get(&fallback_url).send().await {
                Ok(_) => {
                    let latency_ms = start2.elapsed().as_secs_f64() * 1000.0;
                    Ok(PingResult {
                        online: true,
                        latency_ms: (latency_ms * 10.0).round() / 10.0,
                    })
                }
                Err(_) => Ok(PingResult {
                    online: false,
                    latency_ms: 0.0,
                }),
            }
        }
    }
}

#[tauri::command]
async fn scan_local_servers() -> Result<Vec<DiscoveredServer>, String> {
    tokio::task::spawn_blocking(|| {
        let mut discovered: Vec<DiscoveredServer> = Vec::new();
        let socket = std::net::UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
        let _ = socket.set_broadcast(true);
        let _ = socket.set_read_timeout(Some(std::time::Duration::from_millis(1500)));

        let msg = b"KYBER_DISCOVER";
        let _ = socket.send_to(msg, "255.255.255.255:8082");

        let mut buf = [0u8; 2048];
        let start = Instant::now();
        while start.elapsed() < std::time::Duration::from_millis(1500) {
            if let Ok((len, addr)) = socket.recv_from(&mut buf) {
                if let Ok(text) = std::str::from_utf8(&buf[..len]) {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(text) {
                        if val.get("type").and_then(|t| t.as_str()) == Some("kyber_server_announce") {
                            let ip = addr.ip().to_string();
                            let name = val.get("name").and_then(|n| n.as_str()).unwrap_or("Kyber Host").to_string();
                            let port = val.get("port").and_then(|p| p.as_u64()).unwrap_or(8080) as u16;
                            let control_port = val.get("control_port").and_then(|p| p.as_u64()).unwrap_or(8081) as u16;
                            let version = val.get("version").and_then(|v| v.as_str()).unwrap_or("1.0.0").to_string();

                            if !discovered.iter().any(|s| s.host == ip && s.port == port) {
                                discovered.push(DiscoveredServer {
                                    name,
                                    host: ip,
                                    port,
                                    control_port,
                                    version,
                                });
                            }
                        }
                    }
                }
            }
        }

        Ok(discovered)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn find_kyclient_binary(app_handle: Option<&tauri::AppHandle>) -> Option<PathBuf> {
    let bin_name = if cfg!(windows) { "kyclient.exe" } else { "kyclient" };

    // 1. Check in Tauri's resolved resource directory (bundled sidecar)
    if let Some(app) = app_handle {
        if let Ok(resource_dir) = app.path().resource_dir() {
            let in_binaries = resource_dir.join("binaries").join(bin_name);
            if in_binaries.is_file() {
                return Some(in_binaries);
            }
            let direct = resource_dir.join(bin_name);
            if direct.is_file() {
                return Some(direct);
            }
        }
    }

    // 2. Check relative to current executable
    if let Ok(mut exe) = std::env::current_exe() {
        exe.pop();
        let candidate = exe.join(bin_name);
        if candidate.is_file() {
            return Some(candidate);
        }
        let in_binaries = exe.join("binaries").join(bin_name);
        if in_binaries.is_file() {
            return Some(in_binaries);
        }
        let macos_resources = exe.join("../Resources/binaries").join(bin_name);
        if macos_resources.is_file() {
            return Some(macos_resources);
        }
    }

    // 3. Common platform search paths
    let paths: &[&str] = if cfg!(windows) {
        &[
            "kyclient.exe",
            "C:\\Program Files\\Kyber\\kyclient.exe",
            "C:\\Kyber\\kyclient.exe",
        ]
    } else if cfg!(target_os = "macos") {
        &[
            "/Applications/Kyber-Client.app/Contents/MacOS/kyclient",
            "/usr/local/bin/kyclient",
            "/opt/homebrew/bin/kyclient",
            "kyclient",
        ]
    } else {
        // Linux
        &[
            "/usr/bin/kyclient",
            "/usr/local/bin/kyclient",
            "~/.local/bin/kyclient",
            "kyclient",
        ]
    };

    for &p in paths {
        let pb = PathBuf::from(p);
        if pb.is_file() {
            return Some(pb);
        }
    }

    // 4. Fallback: check PATH via command lookup
    Some(PathBuf::from(bin_name))
}

#[tauri::command]
async fn launch_session(
    server: ServerEntry,
    settings: StreamSettings,
    window: tauri::Window,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // 1. Send resolution update to host Kyber control plane API
    let [w, h]: [&str; 2] = match settings.resolution.split('x').collect::<Vec<&str>>().as_slice() {
        [w, h] if !w.is_empty() && !h.is_empty() && *w != "native" => [*w, *h],
        _ => ["1920", "1080"],
    };

    let client = get_http_client();
    let u = server.auth_user.as_deref().unwrap_or("gamer");
    let p = server.auth_password.as_deref().unwrap_or("kybergaming");
    let control_port = server.control_port.unwrap_or(8081);
    let resize_url = format!(
        "https://{}:{}/api/resize?width={}&height={}&rate={}&auth_user={}&auth_pass={}",
        server.host, control_port, w, h, settings.refresh_rate, u, p
    );
    let _ = client.get(&resize_url).send().await;

    // 2. Determine player mode: check if user requested in-app or if native kyclient is unavailable
    let mode = settings.player_mode.as_deref().unwrap_or("auto");

    if mode == "browser" {
        println!("[kyber-desktop] Opening external browser streaming session for {}", server.name);
        let u = server.auth_user.as_deref().unwrap_or("gamer");
        let p = server.auth_password.as_deref().unwrap_or("kybergaming");
        let hud = if settings.hud_overlay.unwrap_or(true) { "1" } else { "0" };
        let stream_url = format!(
            "https://{}:{}/webclient/?auto_connect=true&host={}&port={}&auth_user={}&auth_pass={}&res={}&fps={}&bitrate={}&video_codec={}&hud={}&gamepad_force_xbox360=true",
            server.host, server.port, server.host, server.port, u, p, settings.resolution, settings.refresh_rate, settings.bitrate, settings.codec, hud
        );

        #[cfg(target_os = "macos")]
        {
            let candidates = [
                "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            ];
            let mut launched = false;
            for bin in candidates {
                if std::path::Path::new(bin).exists() {
                    let _ = std::process::Command::new(bin)
                        .arg(format!("--app={}", stream_url))
                        .spawn();
                    launched = true;
                    break;
                }
            }
            if !launched {
                let _ = std::process::Command::new("open").arg(&stream_url).spawn();
            }
        }
        #[cfg(target_os = "windows")]
        let _ = std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &stream_url])
            .spawn();
        #[cfg(target_os = "linux")]
        let _ = std::process::Command::new("xdg-open").arg(&stream_url).spawn();

        return Ok(());
    }

    let is_native_usable = if mode == "in_app" {
        false
    } else {
        match find_kyclient_binary(Some(&app)) {
            Some(bin) => {
                if let Ok(content) = fs::read(&bin) {
                    !content.starts_with(b"#!") && content.len() > 1024
                } else {
                    false
                }
            }
            None => false,
        }
    };

    if mode == "in_app" || (!is_native_usable && mode == "auto") {
        println!("[kyber-desktop] Spawning in-app Webview streaming window for {}", server.name);
        let u = server.auth_user.as_deref().unwrap_or("gamer");
        let p = server.auth_password.as_deref().unwrap_or("kybergaming");
        let hud = if settings.hud_overlay.unwrap_or(true) { "1" } else { "0" };
        let stream_url = format!(
            "https://{}:{}/webclient/?auto_connect=true&host={}&port={}&auth_user={}&auth_pass={}&res={}&fps={}&bitrate={}&video_codec={}&hud={}&gamepad_force_xbox360=true",
            server.host, server.port, server.host, server.port, u, p, settings.resolution, settings.refresh_rate, settings.bitrate, settings.codec, hud
        );

        let parsed_url: tauri::Url = stream_url.parse().map_err(|e| format!("{}", e))?;
        let window_label = "kyber-stream-player";

        if let Some(existing) = app.get_webview_window(window_label) {
            let _ = existing.navigate(parsed_url);
            let _ = existing.show();
            let _ = existing.set_focus();
        } else {
            tauri::WebviewWindowBuilder::new(
                &app,
                window_label,
                tauri::WebviewUrl::External(parsed_url),
            )
            .title(format!("Kyber Stream - {}", server.name))
            .inner_size(1280.0, 720.0)
            .min_inner_size(800.0, 480.0)
            .resizable(true)
            .fullscreen(false)
            .build()
            .map_err(|e| e.to_string())?;
        }

        return Ok(());
    }

    // 3. Fallback to native kyclient process
    let kyclient_bin = find_kyclient_binary(Some(&app)).ok_or_else(|| {
        "Unable to locate kyclient executable on this system.".to_string()
    })?;

    // 4. Build command arguments
    let mut args: Vec<String> = vec![
        server.host.clone(),
        "--port".into(),
        server.port.to_string(),
    ];

    if let Some(user) = &server.auth_user {
        if !user.is_empty() {
            args.push("--auth-username".into());
            args.push(user.clone());
        }
    }
    if let Some(pass) = &server.auth_password {
        if !pass.is_empty() {
            args.push("--auth-password".into());
            args.push(pass.clone());
        }
    }

    if !settings.bitrate.is_empty() {
        args.push("--bitrate".into());
        args.push(settings.bitrate.clone());
    }
    if !settings.codec.is_empty() {
        args.push("--video-codec".into());
        args.push(settings.codec.clone());
    }
    if !settings.kymux_video.is_empty() {
        args.push("--kymux-video".into());
        args.push(settings.kymux_video.clone());
    }
    if !settings.kymux_audio.is_empty() {
        args.push("--kymux-audio".into());
        args.push(settings.kymux_audio.clone());
    }
    if !settings.audio_buffer.is_empty() {
        args.push("--audio-buffer".into());
        args.push(settings.audio_buffer.clone());
    }
    if settings.tls_skip {
        args.push("--tls-skip-verification".into());
    }
    if settings.force_xbox {
        args.push("--gamepad-force-xbox360".into());
        args.push("true".into());
    }
    if settings.keyboard_grab {
        args.push("--keyboard-grab".into());
        args.push("true".into());
    }

    println!("[kyber-desktop] Spawning {:?} with {:?}", kyclient_bin, args);

    // 4. Minimize launcher window while streaming
    let _ = window.minimize();

    // 5. Spawn streaming process in background thread
    let win_clone = window.clone();
    std::thread::spawn(move || {
        let mut child = match std::process::Command::new(kyclient_bin)
            .args(&args)
            .spawn()
        {
            Ok(c) => c,
            Err(e) => {
                eprintln!("[kyber-desktop] Failed to start kyclient: {:?}", e);
                let _ = win_clone.unminimize();
                let _ = win_clone.show();
                let _ = win_clone.set_focus();
                return;
            }
        };

        let _ = child.wait();

        // 6. Restore launcher window once gaming session ends
        let _ = win_clone.unminimize();
        let _ = win_clone.show();
        let _ = win_clone.set_focus();
    });

    Ok(())
}

fn clean_host(host: &str) -> String {
    let mut h = host.trim();
    if let Some(stripped) = h.strip_prefix("https://") {
        h = stripped;
    } else if let Some(stripped) = h.strip_prefix("http://") {
        h = stripped;
    }
    if let Some(idx) = h.find('/') {
        h = &h[..idx];
    }
    if let Some(idx) = h.rfind(':') {
        if !h.starts_with('[') || h.contains("]:") {
            h = &h[..idx];
        }
    }
    h.to_string()
}

#[tauri::command]
async fn rom_browse(
    host: String,
    port: u16,
    path: String,
    auth_user: Option<String>,
    auth_password: Option<String>,
) -> Result<serde_json::Value, String> {
    let host = clean_host(&host);
    let client = get_http_client();

    let mut query = vec![("path", path)];
    if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
        if !u.is_empty() && !p.is_empty() {
            query.push(("auth_user", u.clone()));
            query.push(("auth_pass", p.clone()));
        }
    }

    let https_url = format!("https://{}:{}/api/roms/browse", host, port);
    let mut req = client.get(&https_url).query(&query);
    if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
        if !u.is_empty() && !p.is_empty() {
            req = req.basic_auth(u, Some(p));
        }
    }

    match req.send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
            } else {
                Err(format!("HTTP error {}", resp.status()))
            }
        }
        Err(_) => {
            let http_url = format!("http://{}:{}/api/roms/browse", host, port);
            let mut req2 = client.get(&http_url).query(&query);
            if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
                if !u.is_empty() && !p.is_empty() {
                    req2 = req2.basic_auth(u, Some(p));
                }
            }
            let resp2 = req2.send().await.map_err(|e| e.to_string())?;
            if resp2.status().is_success() {
                resp2.json::<serde_json::Value>().await.map_err(|e| e.to_string())
            } else {
                Err(format!("HTTP error {}", resp2.status()))
            }
        }
    }
}

#[tauri::command]
async fn rom_create_folder(
    host: String,
    port: u16,
    path: String,
    folder_name: String,
    auth_user: Option<String>,
    auth_password: Option<String>,
) -> Result<serde_json::Value, String> {
    let host = clean_host(&host);
    let client = get_http_client();

    let mut query = Vec::new();
    if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
        if !u.is_empty() && !p.is_empty() {
            query.push(("auth_user", u.clone()));
            query.push(("auth_pass", p.clone()));
        }
    }

    let payload = serde_json::json!({
        "path": path,
        "folder_name": folder_name
    });

    let https_url = format!("https://{}:{}/api/roms/create_folder", host, port);
    let mut req = client.post(&https_url).query(&query).json(&payload);
    if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
        if !u.is_empty() && !p.is_empty() {
            req = req.basic_auth(u, Some(p));
        }
    }

    match req.send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
            } else {
                let status = resp.status();
                let err_text = resp.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                Err(format!("Server returned HTTP {}: {}", status, err_text))
            }
        }
        Err(_) => {
            let http_url = format!("http://{}:{}/api/roms/create_folder", host, port);
            let mut req2 = client.post(&http_url).query(&query).json(&payload);
            if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
                if !u.is_empty() && !p.is_empty() {
                    req2 = req2.basic_auth(u, Some(p));
                }
            }
            let resp2 = req2.send().await.map_err(|e| e.to_string())?;
            if resp2.status().is_success() {
                resp2.json::<serde_json::Value>().await.map_err(|e| e.to_string())
            } else {
                let status2 = resp2.status();
                let err_text2 = resp2.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                Err(format!("Server returned HTTP {}: {}", status2, err_text2))
            }
        }
    }
}

#[tauri::command]
async fn rom_delete(
    host: String,
    port: u16,
    path: String,
    auth_user: Option<String>,
    auth_password: Option<String>,
) -> Result<serde_json::Value, String> {
    let host = clean_host(&host);
    let client = get_http_client();

    let mut query = vec![("path", path.clone())];
    if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
        if !u.is_empty() && !p.is_empty() {
            query.push(("auth_user", u.clone()));
            query.push(("auth_pass", p.clone()));
        }
    }

    let payload = serde_json::json!({ "path": path });

    let https_url = format!("https://{}:{}/api/roms/delete", host, port);
    let mut req = client.post(&https_url).query(&query).json(&payload);
    if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
        if !u.is_empty() && !p.is_empty() {
            req = req.basic_auth(u, Some(p));
        }
    }

    match req.send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
            } else {
                let status = resp.status();
                let err_text = resp.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                Err(format!("Server returned HTTP {}: {}", status, err_text))
            }
        }
        Err(_) => {
            let http_url = format!("http://{}:{}/api/roms/delete", host, port);
            let mut req2 = client.post(&http_url).query(&query).json(&payload);
            if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
                if !u.is_empty() && !p.is_empty() {
                    req2 = req2.basic_auth(u, Some(p));
                }
            }
            let resp2 = req2.send().await.map_err(|e| e.to_string())?;
            if resp2.status().is_success() {
                resp2.json::<serde_json::Value>().await.map_err(|e| e.to_string())
            } else {
                let status2 = resp2.status();
                let err_text2 = resp2.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                Err(format!("Server returned HTTP {}: {}", status2, err_text2))
            }
        }
    }
}

#[tauri::command]
async fn rom_cancel_upload(
    host: String,
    port: u16,
    upload_id: String,
    auth_user: Option<String>,
    auth_password: Option<String>,
) -> Result<serde_json::Value, String> {
    let host = clean_host(&host);
    let client = get_http_client();

    let mut query = vec![("upload_id", upload_id.clone())];
    if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
        if !u.is_empty() && !p.is_empty() {
            query.push(("auth_user", u.clone()));
            query.push(("auth_pass", p.clone()));
        }
    }

    let payload = serde_json::json!({ "upload_id": upload_id });

    let https_url = format!("https://{}:{}/api/roms/cancel_upload", host, port);
    let mut req = client.post(&https_url).query(&query).json(&payload);
    if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
        if !u.is_empty() && !p.is_empty() {
            req = req.basic_auth(u, Some(p));
        }
    }

    match req.send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
            } else {
                let status = resp.status();
                let err_text = resp.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                Err(format!("Server returned HTTP {}: {}", status, err_text))
            }
        }
        Err(_) => {
            let http_url = format!("http://{}:{}/api/roms/cancel_upload", host, port);
            let mut req2 = client.post(&http_url).query(&query).json(&payload);
            if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
                if !u.is_empty() && !p.is_empty() {
                    req2 = req2.basic_auth(u, Some(p));
                }
            }
            let resp2 = req2.send().await.map_err(|e| e.to_string())?;
            if resp2.status().is_success() {
                resp2.json::<serde_json::Value>().await.map_err(|e| e.to_string())
            } else {
                let status2 = resp2.status();
                let err_text2 = resp2.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                Err(format!("Server returned HTTP {}: {}", status2, err_text2))
            }
        }
    }
}

#[tauri::command]
async fn rom_upload_chunk(
    host: String,
    port: u16,
    upload_id: String,
    filename: String,
    target_path: String,
    chunk_index: u32,
    chunk_offset: u64,
    total_chunks: u32,
    total_size: u64,
    chunk_base64: String,
    auth_user: Option<String>,
    auth_password: Option<String>,
) -> Result<serde_json::Value, String> {
    let host = clean_host(&host);
    let client = get_http_client();

    let binary_data = BASE64_STANDARD
        .decode(chunk_base64.trim())
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    let max_retries = 3;
    let mut last_err = String::from("Upload chunk failed");

    for attempt in 0..max_retries {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(300 * (1 << (attempt - 1)))).await;
        }

        let mut full_query = vec![
            ("upload_id", upload_id.clone()),
            ("filename", filename.clone()),
            ("target_path", target_path.clone()),
            ("chunk_index", chunk_index.to_string()),
            ("chunk_offset", chunk_offset.to_string()),
            ("total_chunks", total_chunks.to_string()),
            ("total_size", total_size.to_string()),
        ];
        if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
            if !u.is_empty() && !p.is_empty() {
                full_query.push(("auth_user", u.clone()));
                full_query.push(("auth_pass", p.clone()));
            }
        }

        let https_url = format!("https://{}:{}/api/roms/upload_chunk", host, port);
        let mut req = client
            .post(&https_url)
            .query(&full_query)
            .header("Content-Type", "application/octet-stream")
            .body(binary_data.clone());
        if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
            if !u.is_empty() && !p.is_empty() {
                req = req.basic_auth(u, Some(p));
            }
        }

        match req.send().await {
            Ok(resp) => {
                let status = resp.status();
                if status.is_success() {
                    return resp.json::<serde_json::Value>().await.map_err(|e| e.to_string());
                } else if status.is_client_error() {
                    let err_text = resp.text().await.unwrap_or_else(|_| "Client error".to_string());
                    return Err(format!("Server returned HTTP {}: {}", status, err_text));
                } else {
                    last_err = format!("Server returned HTTP {}", status);
                }
            }
            Err(e) => {
                let http_url = format!("http://{}:{}/api/roms/upload_chunk", host, port);
                let mut req2 = client
                    .post(&http_url)
                    .query(&full_query)
                    .header("Content-Type", "application/octet-stream")
                    .body(binary_data.clone());
                if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
                    if !u.is_empty() && !p.is_empty() {
                        req2 = req2.basic_auth(u, Some(p));
                    }
                }
                match req2.send().await {
                    Ok(resp2) => {
                        let status2 = resp2.status();
                        if status2.is_success() {
                            return resp2.json::<serde_json::Value>().await.map_err(|e| e.to_string());
                        } else if status2.is_client_error() {
                            let err_text2 = resp2.text().await.unwrap_or_else(|_| "Client error".to_string());
                            return Err(format!("Server returned HTTP {}: {}", status2, err_text2));
                        } else {
                            last_err = format!("Server returned HTTP {}", status2);
                        }
                    }
                    Err(e2) => {
                        last_err = format!("Network error: {} / {}", e, e2);
                    }
                }
            }
        }
    }

    Err(last_err)
}

#[tauri::command]
async fn rom_download_file(
    host: String,
    port: u16,
    path: String,
    filename: String,
    auth_user: Option<String>,
    auth_password: Option<String>,
) -> Result<String, String> {
    let host = clean_host(&host);
    let client = get_http_client();

    let raw_name = std::path::Path::new(&filename)
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid filename".to_string())?;
    let safe_name = raw_name.replace("..", "").replace(['/', '\\'], "_");
    if safe_name.is_empty() {
        return Err("Invalid filename".to_string());
    }

    let download_dir = dirs::download_dir().unwrap_or_else(|| PathBuf::from("."));
    let target_file_path = download_dir.join(&safe_name);

    let mut query = vec![("path", path)];
    if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
        if !u.is_empty() && !p.is_empty() {
            query.push(("auth_user", u.clone()));
            query.push(("auth_pass", p.clone()));
        }
    }

    let https_url = format!("https://{}:{}/api/roms/download", host, port);
    let mut req = client.get(&https_url).query(&query);
    if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
        if !u.is_empty() && !p.is_empty() {
            req = req.basic_auth(u, Some(p));
        }
    }

    let bytes = match req.send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                resp.bytes().await.map_err(|e| e.to_string())?
            } else {
                return Err(format!("Download failed with HTTP {}", resp.status()));
            }
        }
        Err(_) => {
            let http_url = format!("http://{}:{}/api/roms/download", host, port);
            let mut req2 = client.get(&http_url).query(&query);
            if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
                if !u.is_empty() && !p.is_empty() {
                    req2 = req2.basic_auth(u, Some(p));
                }
            }
            let resp2 = req2.send().await.map_err(|e| e.to_string())?;
            if resp2.status().is_success() {
                resp2.bytes().await.map_err(|e| e.to_string())?
            } else {
                return Err(format!("Download failed with HTTP {}", resp2.status()));
            }
        }
    };

    fs::write(&target_file_path, bytes).map_err(|e| e.to_string())?;
    Ok(target_file_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn rom_extract(
    host: String,
    port: u16,
    path: String,
    delete_archive: Option<bool>,
    auth_user: Option<String>,
    auth_password: Option<String>,
) -> Result<serde_json::Value, String> {
    let host = clean_host(&host);
    let client = get_http_client();

    let mut query = vec![("path", path.clone())];
    if delete_archive.unwrap_or(false) {
        query.push(("delete_archive", "true".into()));
    }
    if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
        if !u.is_empty() && !p.is_empty() {
            query.push(("auth_user", u.clone()));
            query.push(("auth_pass", p.clone()));
        }
    }

    let payload = serde_json::json!({
        "path": path,
        "delete_archive": delete_archive.unwrap_or(false)
    });

    let https_url = format!("https://{}:{}/api/roms/extract", host, port);
    let mut req = client.post(&https_url).query(&query).json(&payload);
    if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
        if !u.is_empty() && !p.is_empty() {
            req = req.basic_auth(u, Some(p));
        }
    }

    match req.send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                resp.json::<serde_json::Value>().await.map_err(|e| e.to_string())
            } else {
                let status = resp.status();
                let err_text = resp.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                Err(format!("Server returned HTTP {}: {}", status, err_text))
            }
        }
        Err(_) => {
            let http_url = format!("http://{}:{}/api/roms/extract", host, port);
            let mut req2 = client.post(&http_url).query(&query).json(&payload);
            if let (Some(u), Some(p)) = (&auth_user, &auth_password) {
                if !u.is_empty() && !p.is_empty() {
                    req2 = req2.basic_auth(u, Some(p));
                }
            }
            let resp2 = req2.send().await.map_err(|e| e.to_string())?;
            if resp2.status().is_success() {
                resp2.json::<serde_json::Value>().await.map_err(|e| e.to_string())
            } else {
                let status2 = resp2.status();
                let err_text2 = resp2.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                Err(format!("Server returned HTTP {}: {}", status2, err_text2))
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                if let Ok(menu) = tauri::menu::Menu::default(app.handle()) {
                    let _ = app.set_menu(menu);
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            ping_server,
            scan_local_servers,
            launch_session,
            rom_browse,
            rom_create_folder,
            rom_delete,
            rom_cancel_upload,
            rom_upload_chunk,
            rom_download_file,
            rom_extract
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_host_variants() {
        assert_eq!(clean_host("192.168.1.100"), "192.168.1.100");
        assert_eq!(clean_host("http://192.168.1.100"), "192.168.1.100");
        assert_eq!(clean_host("https://192.168.1.100"), "192.168.1.100");
        assert_eq!(clean_host("https://192.168.1.100:8080"), "192.168.1.100");
        assert_eq!(clean_host("https://192.168.1.100:8080/webclient"), "192.168.1.100");
        assert_eq!(clean_host("gaming.local:8081"), "gaming.local");
        assert_eq!(clean_host("  gaming.local  "), "gaming.local");
        assert_eq!(clean_host("http://gaming.local/api/system"), "gaming.local");
    }

    #[test]
    fn test_default_app_config() {
        let config = AppConfig::default();
        assert!(config.servers.is_empty());
        assert_eq!(config.settings.resolution, "native");
        assert_eq!(config.settings.refresh_rate, "60");
        assert_eq!(config.settings.codec, "h264");
        assert_eq!(config.settings.audio_buffer, "80");
        assert!(config.settings.tls_skip);
        assert!(config.settings.force_xbox);
        assert!(config.settings.keyboard_grab);
    }

    #[test]
    fn test_config_json_roundtrip() {
        let mut config = AppConfig::default();
        config.servers.push(ServerEntry {
            id: "srv1".into(),
            name: "Homelab Rig".into(),
            host: "10.0.0.50".into(),
            port: 8080,
            control_port: Some(8081),
            icon: None,
            auth_user: Some("gamer".into()),
            auth_password: Some("secret".into()),
        });

        let serialized = serde_json::to_string(&config).expect("serialization failed");
        let deserialized: AppConfig = serde_json::from_str(&serialized).expect("deserialization failed");

        assert_eq!(deserialized.servers.len(), 1);
        assert_eq!(deserialized.servers[0].name, "Homelab Rig");
        assert_eq!(deserialized.servers[0].host, "10.0.0.50");
        assert_eq!(deserialized.servers[0].port, 8080);
        assert_eq!(deserialized.servers[0].control_port, Some(8081));
    }

    #[test]
    fn test_filename_sanitization_defense() {
        let malicious_inputs = [
            "../../etc/passwd",
            "/etc/shadow",
            "..\\..\\Windows\\System32\\calc.exe",
            "../../../games/roms/secret.nsp",
            "/absolute/path/game.xci",
        ];

        for input in malicious_inputs {
            let raw_name = std::path::Path::new(input)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
            let safe_name = raw_name.replace("..", "").replace(['/', '\\'], "_");

            assert!(!safe_name.contains("/"));
            assert!(!safe_name.contains('\\'));
            assert!(!safe_name.contains(".."));
            assert!(!safe_name.is_empty());
        }
    }
}
