use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::Instant;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerEntry {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub icon: Option<String>,
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
            servers: vec![
                ServerEntry {
                    id: "lan-main".into(),
                    name: "Homelab Gaming (LAN)".into(),
                    host: "192.168.2.3".into(),
                    port: 8080,
                    icon: Some("⚡".into()),
                },
                ServerEntry {
                    id: "tailscale-remote".into(),
                    name: "Serveur Distant (Tailscale)".into(),
                    host: "100.73.113.43".into(),
                    port: 8080,
                    icon: Some("🌐".into()),
                },
            ],
            settings: StreamSettings {
                resolution: "1920x1080".into(),
                refresh_rate: "60".into(),
                bitrate: "40000000".into(),
                codec: "h264".into(),
                kymux_video: "gopstream".into(),
                kymux_audio: "unreliable_fec".into(),
                audio_buffer: "80".into(),
                tls_skip: true,
                force_xbox: true,
                keyboard_grab: true,
            },
        }
    }
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
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_millis(2000))
        .build()
        .map_err(|e| e.to_string())?;

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
            // Fallback check on resizer port 8081
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

fn find_kyclient_binary() -> Option<PathBuf> {
    // 1. Check relative to current executable
    if let Ok(mut exe) = std::env::current_exe() {
        exe.pop();
        let candidate = exe.join(if cfg!(windows) { "kyclient.exe" } else { "kyclient" });
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    // 2. Common platform search paths
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

    // 3. Fallback: check PATH via command lookup
    Some(PathBuf::from(if cfg!(windows) { "kyclient.exe" } else { "kyclient" }))
}

#[tauri::command]
async fn launch_session(
    server: ServerEntry,
    settings: StreamSettings,
    window: tauri::Window,
) -> Result<(), String> {
    // 1. Send resolution update to host resizer API
    let [w, h]: [&str; 2] = match settings.resolution.split('x').collect::<Vec<&str>>().as_slice() {
        [w, h] => [*w, *h],
        _ => ["1920", "1080"],
    };

    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_millis(1500))
        .build();

    if let Ok(c) = client {
        let resize_url = format!(
            "https://{}:8081/api/resize?width={}&height={}&rate={}",
            server.host, w, h, settings.refresh_rate
        );
        let _ = c.get(&resize_url).send().await;
    }

    // 2. Find kyclient binary
    let kyclient_bin = find_kyclient_binary().ok_or_else(|| {
        "Impossible de localiser l'exécutable kyclient sur ce système.".to_string()
    })?;

    // 3. Build command arguments
    let mut args: Vec<String> = vec![
        server.host.clone(),
        "--port".into(),
        server.port.to_string(),
    ];

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            ping_server,
            launch_session
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
