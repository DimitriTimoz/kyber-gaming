#!/usr/bin/env python3
"""
Kyber Cloud Gaming - Interactive Launcher Selector Menu
Provides an on-screen graphical launcher dashboard in Tkinter.
Supports keyboard shortcuts (1, 2, 3, 4, Esc) and mouse clicks.
"""

import sys
import os
import subprocess
import tkinter as tk
from tkinter import font

BG_COLOR = "#16161e"
CARD_BG = "#1f2335"
CARD_HOVER = "#292e42"
ACCENT_BLUE = "#7aa2f7"
ACCENT_PURPLE = "#bb9af7"
ACCENT_GREEN = "#73daca"
TEXT_COLOR = "#c0caf5"
TEXT_MUTED = "#787c99"
BORDER_COLOR = "#3b4261"

class LauncherMenu:
    def __init__(self, root, wait_mode=False):
        self.root = root
        self.wait_mode = wait_mode
        self.selected = None

        self.root.title("Kyber Cloud Gaming")
        self.root.configure(bg=BG_COLOR)
        self.root.attributes("-type", "dialog")
        
        # Center window (720x580)
        w, h = 740, 600
        sw = self.root.winfo_screenwidth()
        sh = self.root.winfo_screenheight()
        x = max(0, (sw - w) // 2)
        y = max(0, (sh - h) // 2)
        self.root.geometry(f"{w}x{h}+{x}+{y}")
        self.root.resizable(False, False)

        # Bring to front
        self.root.lift()
        self.root.attributes("-topmost", True)
        self.root.after_idle(self.root.attributes, "-topmost", False)

        self._build_ui()
        self._bind_keys()

    def _build_ui(self):
        # Header frame
        header = tk.Frame(self.root, bg=BG_COLOR, pady=18)
        header.pack(fill="x")

        title = tk.Label(
            header,
            text="KYBER CLOUD GAMING",
            font=("DejaVu Sans", 20, "bold"),
            fg=ACCENT_BLUE,
            bg=BG_COLOR
        )
        title.pack()

        subtitle = tk.Label(
            header,
            text="Sélectionnez un launcher pour lancer votre session de jeu",
            font=("DejaVu Sans", 11),
            fg=TEXT_MUTED,
            bg=BG_COLOR
        )
        subtitle.pack(pady=(4, 0))

        # Cards container
        container = tk.Frame(self.root, bg=BG_COLOR, padx=30)
        container.pack(fill="both", expand=True)

        self._create_card(
            container,
            icon="🚀",
            title="Steam (Mode Bureau)",
            desc="Interface standard Steam — Bibliothèque, Magasin & Communauté",
            badge="[ Touche 1 ]",
            color=ACCENT_BLUE,
            command=lambda: self.launch("steam")
        )

        self._create_card(
            container,
            icon="🎮",
            title="Steam Big Picture",
            desc="Interface TV plein écran conçue pour la manette",
            badge="[ Touche 2 ]",
            color=ACCENT_PURPLE,
            command=lambda: self.launch("steam-bigpicture")
        )

        self._create_card(
            container,
            icon="🦸",
            title="Heroic Games Launcher",
            desc="Vos jeux Epic Games Store et GOG",
            badge="[ Touche 3 ]",
            color=ACCENT_GREEN,
            command=lambda: self.launch("heroic")
        )

        # Footer actions
        footer = tk.Frame(self.root, bg=BG_COLOR, padx=30, pady=15)
        footer.pack(fill="x", side="bottom")

        btn_desktop = tk.Button(
            footer,
            text="🖥️ Mode Bureau (Échap)",
            font=("DejaVu Sans", 10, "bold"),
            fg=TEXT_COLOR,
            bg=CARD_BG,
            activebackground=CARD_HOVER,
            activeforeground=TEXT_COLOR,
            relief="flat",
            bd=0,
            padx=14,
            pady=8,
            cursor="hand2",
            command=lambda: self.launch("desktop")
        )
        btn_desktop.pack(side="left")

        btn_refresh_steam = tk.Button(
            footer,
            text="🔄 Recharger Steam",
            font=("DejaVu Sans", 10),
            fg=TEXT_COLOR,
            bg=CARD_BG,
            activebackground=CARD_HOVER,
            activeforeground=TEXT_COLOR,
            relief="flat",
            bd=0,
            padx=14,
            pady=8,
            cursor="hand2",
            command=lambda: self.launch("restart-steam")
        )
        btn_refresh_steam.pack(side="left", padx=10)

        hint = tk.Label(
            footer,
            text="💡 Clic-droit sur le bureau ou [Alt+Espace] pour rouvrir ce menu",
            font=("DejaVu Sans", 9),
            fg=TEXT_MUTED,
            bg=BG_COLOR
        )
        hint.pack(side="right")

    def _create_card(self, parent, icon, title, desc, badge, color, command):
        card = tk.Frame(
            parent,
            bg=CARD_BG,
            highlightbackground=BORDER_COLOR,
            highlightthickness=1,
            padx=16,
            pady=12,
            cursor="hand2"
        )
        card.pack(fill="x", pady=6)

        # Icon
        lbl_icon = tk.Label(
            card,
            text=icon,
            font=("DejaVu Sans", 22),
            bg=CARD_BG,
            fg=color
        )
        lbl_icon.pack(side="left", padx=(0, 14))

        # Text column
        text_col = tk.Frame(card, bg=CARD_BG)
        text_col.pack(side="left", fill="both", expand=True)

        lbl_title = tk.Label(
            text_col,
            text=title,
            font=("DejaVu Sans", 12, "bold"),
            fg=TEXT_COLOR,
            bg=CARD_BG,
            anchor="w"
        )
        lbl_title.pack(fill="x")

        lbl_desc = tk.Label(
            text_col,
            text=desc,
            font=("DejaVu Sans", 9),
            fg=TEXT_MUTED,
            bg=CARD_BG,
            anchor="w"
        )
        lbl_desc.pack(fill="x", pady=(2, 0))

        # Badge
        lbl_badge = tk.Label(
            card,
            text=badge,
            font=("DejaVu Sans", 9, "bold"),
            fg=color,
            bg=CARD_BG
        )
        lbl_badge.pack(side="right")

        # Hover and click bindings across all child widgets
        widgets = [card, lbl_icon, text_col, lbl_title, lbl_desc, lbl_badge]
        def on_enter(e):
            card.configure(bg=CARD_HOVER, highlightbackground=color)
            for w in [lbl_icon, text_col, lbl_title, lbl_desc, lbl_badge]:
                w.configure(bg=CARD_HOVER)
        def on_leave(e):
            card.configure(bg=CARD_BG, highlightbackground=BORDER_COLOR)
            for w in [lbl_icon, text_col, lbl_title, lbl_desc, lbl_badge]:
                w.configure(bg=CARD_BG)
        def on_click(e):
            command()

        for w in widgets:
            w.bind("<Enter>", on_enter)
            w.bind("<Leave>", on_leave)
            w.bind("<Button-1>", on_click)

    def _bind_keys(self):
        self.root.bind("<Key-1>", lambda e: self.launch("steam"))
        self.root.bind("<Key-2>", lambda e: self.launch("steam-bigpicture"))
        self.root.bind("<Key-3>", lambda e: self.launch("heroic"))
        self.root.bind("<Key-4>", lambda e: self.launch("desktop"))
        self.root.bind("<Escape>", lambda e: self.launch("desktop"))

    def launch(self, target):
        self.selected = target
        if self.wait_mode:
            print(target, flush=True)
            self.root.destroy()
        else:
            # Execute switch_launcher.sh in background
            cmd = ["/usr/local/bin/switch_launcher.sh", target]
            try:
                subprocess.Popen(cmd)
            except Exception as e:
                print(f"[launcher-menu] Error launching {target}: {e}", file=sys.stderr)
            self.root.destroy()

def main():
    wait_mode = "--wait" in sys.argv
    root = tk.Tk()
    app = LauncherMenu(root, wait_mode=wait_mode)
    root.mainloop()

if __name__ == "__main__":
    main()
