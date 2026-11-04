#!/usr/bin/env python3
"""
Kyber Cloud Gaming - Modern Fullscreen Launcher Hub
Provides an immersive, console-grade dashboard for selecting game launchers.
Supports mouse clicks, arrow key navigation + Enter, and hotkeys (1, 2, 3, 4, Esc).
"""

import sys
import os
import subprocess
import tkinter as tk

BG_COLOR = "#0c0f17"
PANEL_BG = "#151926"
CARD_BG = "#1c2236"
CARD_HOVER = "#27304c"
TEXT_PRIMARY = "#f1f5f9"
TEXT_SECONDARY = "#94a3b8"
TEXT_MUTED = "#64748b"

COLOR_STEAM = "#38bdf8"
COLOR_BIGPICTURE = "#a855f7"
COLOR_HEROIC = "#22c55e"
COLOR_DESKTOP = "#cbd5e1"
COLOR_RELOAD = "#f43f5e"

ITEMS = [
    {
        "id": "steam",
        "key": "1",
        "badge": "[ TOUCHE 1 ]",
        "title": "STEAM (MODE BUREAU)",
        "desc": "Bibliothèque de jeux Steam, Magasin, Amis et Téléchargements",
        "color": COLOR_STEAM,
    },
    {
        "id": "steam-bigpicture",
        "key": "2",
        "badge": "[ TOUCHE 2 ]",
        "title": "STEAM BIG PICTURE",
        "desc": "Interface console plein écran conçue pour manette et TV",
        "color": COLOR_BIGPICTURE,
    },
    {
        "id": "heroic",
        "key": "3",
        "badge": "[ TOUCHE 3 ]",
        "title": "HEROIC GAMES LAUNCHER",
        "desc": "Vos jeux Epic Games Store et GOG",
        "color": COLOR_HEROIC,
    },
    {
        "id": "desktop",
        "key": "4",
        "badge": "[ TOUCHE 4 ]",
        "title": "BUREAU LINUX (ÉCHAP)",
        "desc": "Accéder directement au bureau libre et au gestionnaire de fenêtres",
        "color": COLOR_DESKTOP,
    },
]

class ModernLauncherHub:
    def __init__(self, root, wait_mode=False):
        self.root = root
        self.wait_mode = wait_mode
        self.current_idx = 0
        self.cards = []

        self.root.title("Kyber Cloud Gaming Hub")
        self.root.configure(bg=BG_COLOR)

        # Fullscreen borderless
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        self.root.geometry(f"{sw}x{sh}+0+0")
        self.root.overrideredirect(True)

        self._build_ui()
        self._bind_keys()
        self._select_index(0)

    def _build_ui(self):
        # Outer center container
        outer = tk.Frame(self.root, bg=BG_COLOR)
        outer.place(relx=0.5, rely=0.5, anchor="center")

        # Header
        header = tk.Frame(outer, bg=BG_COLOR)
        header.pack(fill="x", pady=(0, 28))

        lbl_logo = tk.Label(
            header,
            text="KYBER CLOUD GAMING",
            font=("DejaVu Sans", 28, "bold"),
            fg=COLOR_STEAM,
            bg=BG_COLOR
        )
        lbl_logo.pack()

        lbl_sub = tk.Label(
            header,
            text="Sélectionnez un launcher pour démarrer votre session",
            font=("DejaVu Sans", 13),
            fg=TEXT_SECONDARY,
            bg=BG_COLOR
        )
        lbl_sub.pack(pady=(6, 0))

        # Cards frame
        cards_frame = tk.Frame(outer, bg=BG_COLOR)
        cards_frame.pack()

        for idx, item in enumerate(ITEMS):
            card = self._create_card(cards_frame, idx, item)
            self.cards.append(card)

        # Footer
        footer = tk.Frame(outer, bg=BG_COLOR, pady=24)
        footer.pack(fill="x")

        btn_reload = tk.Button(
            footer,
            text="[R] Recharger Steam (sans mot de passe)",
            font=("DejaVu Sans", 11),
            fg="#fda4af",
            bg="#2c171e",
            activebackground="#4c1d27",
            activeforeground="#fff",
            relief="flat",
            bd=0,
            padx=16,
            pady=8,
            cursor="hand2",
            command=lambda: self.launch("restart-steam")
        )
        btn_reload.pack(side="left")

        lbl_hint = tk.Label(
            footer,
            text="Navigation : Fleches haut/bas + Entree  |  Touches 1 a 4  |  Clic souris",
            font=("DejaVu Sans", 11),
            fg=TEXT_MUTED,
            bg=BG_COLOR
        )
        lbl_hint.pack(side="right", padx=(20, 0))

    def _create_card(self, parent, idx, item):
        card = tk.Frame(
            parent,
            bg=CARD_BG,
            highlightthickness=2,
            highlightbackground="#2d3748",
            padx=28,
            pady=16,
            cursor="hand2",
            width=860
        )
        card.pack(fill="x", pady=8)

        # Left: Number / Key box
        num_box = tk.Label(
            card,
            text=f" {item['key']} ",
            font=("DejaVu Sans", 18, "bold"),
            fg=item["color"],
            bg=PANEL_BG,
            padx=10,
            pady=4
        )
        num_box.pack(side="left", padx=(0, 20))

        # Middle: Text
        text_frame = tk.Frame(card, bg=CARD_BG)
        text_frame.pack(side="left", fill="both", expand=True)

        lbl_title = tk.Label(
            text_frame,
            text=item["title"],
            font=("DejaVu Sans", 14, "bold"),
            fg=TEXT_PRIMARY,
            bg=CARD_BG,
            anchor="w"
        )
        lbl_title.pack(fill="x")

        lbl_desc = tk.Label(
            text_frame,
            text=item["desc"],
            font=("DejaVu Sans", 10),
            fg=TEXT_SECONDARY,
            bg=CARD_BG,
            anchor="w"
        )
        lbl_desc.pack(fill="x", pady=(3, 0))

        # Right: Badge
        lbl_badge = tk.Label(
            card,
            text=item["badge"],
            font=("DejaVu Sans", 10, "bold"),
            fg=item["color"],
            bg=CARD_BG
        )
        lbl_badge.pack(side="right")

        # Store widgets for styling
        card_data = {
            "card": card,
            "num_box": num_box,
            "text_frame": text_frame,
            "lbl_title": lbl_title,
            "lbl_desc": lbl_desc,
            "lbl_badge": lbl_badge,
            "item": item,
            "idx": idx,
        }

        # Event bindings
        def on_enter(e):
            self._select_index(idx)

        def on_click(e):
            self.launch(item["id"])

        for w in [card, num_box, text_frame, lbl_title, lbl_desc, lbl_badge]:
            w.bind("<Enter>", on_enter)
            w.bind("<Button-1>", on_click)

        return card_data

    def _select_index(self, idx):
        self.current_idx = idx % len(ITEMS)
        for i, c in enumerate(self.cards):
            item = c["item"]
            if i == self.current_idx:
                c["card"].configure(bg=CARD_HOVER, highlightbackground=item["color"])
                c["text_frame"].configure(bg=CARD_HOVER)
                c["lbl_title"].configure(bg=CARD_HOVER, fg="#ffffff")
                c["lbl_desc"].configure(bg=CARD_HOVER, fg="#e2e8f0")
                c["lbl_badge"].configure(bg=CARD_HOVER)
                c["num_box"].configure(bg="#111827")
            else:
                c["card"].configure(bg=CARD_BG, highlightbackground="#2d3748")
                c["text_frame"].configure(bg=CARD_BG)
                c["lbl_title"].configure(bg=CARD_BG, fg=TEXT_PRIMARY)
                c["lbl_desc"].configure(bg=CARD_BG, fg=TEXT_SECONDARY)
                c["lbl_badge"].configure(bg=CARD_BG)
                c["num_box"].configure(bg=PANEL_BG)

    def _bind_keys(self):
        self.root.bind("<Up>", lambda e: self._select_index(self.current_idx - 1))
        self.root.bind("<Down>", lambda e: self._select_index(self.current_idx + 1))
        self.root.bind("<Return>", lambda e: self.launch(ITEMS[self.current_idx]["id"]))
        self.root.bind("<space>", lambda e: self.launch(ITEMS[self.current_idx]["id"]))

        self.root.bind("<Key-1>", lambda e: self.launch("steam"))
        self.root.bind("<Key-2>", lambda e: self.launch("steam-bigpicture"))
        self.root.bind("<Key-3>", lambda e: self.launch("heroic"))
        self.root.bind("<Key-4>", lambda e: self.launch("desktop"))
        self.root.bind("<Escape>", lambda e: self.launch("desktop"))

    def launch(self, target):
        if self.wait_mode:
            print(target, flush=True)
            self.root.destroy()
        else:
            cmd = ["/usr/local/bin/switch_launcher.sh", target]
            try:
                subprocess.Popen(cmd)
            except Exception as e:
                print(f"[launcher-hub] Error launching {target}: {e}", file=sys.stderr)
            self.root.destroy()

def main():
    wait_mode = "--wait" in sys.argv
    root = tk.Tk()
    app = ModernLauncherHub(root, wait_mode=wait_mode)
    root.mainloop()

if __name__ == "__main__":
    main()
