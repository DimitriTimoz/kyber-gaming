/**
 * Kyber Console OS - Data-Driven Console Hub & Emulator Frontend
 * Dynamically renders launchers and console emulators from configuration.
 * 100% controller-driven with synthesized audio and category filtering.
 */

(function () {
    'use strict';

    // SVG Icons Registry
    const ICONS = {
        steam: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/></svg>`,
        bigpicture: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/></svg>`,
        heroic: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.999 0 11.997 0a.891.891 0 0 0-.36.075C8.964 1.253 6.29 2.434 3.618 3.613A.893.893 0 0 0 3.1 4.619l3.146 14.646c.043.197.15.375.307.504l4.88 4.027a.895.895 0 0 0 1.131.006l5-4.031a.895.895 0 0 0 .315-.516L20.9 4.614a.895.895 0 0 0-.515-1L12.358.074A.892.892 0 0 0 12 0zm0 .35v.003c.114 0 .228.023.334.07l7.42 3.27a.827.827 0 0 1 .476.924l-2.793 13.535a.83.83 0 0 1-.289.478l-4.623 3.725a.826.826 0 0 1-1.045-.006l-4.513-3.723a.829.829 0 0 1-.281-.465L3.775 4.622a.83.83 0 0 1 .476-.931L11.665.42a.832.832 0 0 1 .334-.07zm-.045 1.954L10.28 5.202h-.002l1.211 11.301.512.409.512-.409 1.117-11.3zM9.003 16.261l-.584 1.068.584 1.07 2.295-.38.47-.69-.47-.671zm5.996 0-2.295.397-.47.671.47.69 2.295.38.584-1.07zm-2.998 1.488-.51.444-.281 2.168.789.55.793-.55-.295-2.168z"/></svg>`,
        switch: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.176 24h3.674c3.376 0 6.15-2.774 6.15-6.15V6.15C24 2.775 21.226 0 17.85 0H14.1c-.074 0-.15.074-.15.15v23.7c-.001.076.075.15.226.15zm4.574-13.199c1.351 0 2.399 1.125 2.399 2.398 0 1.352-1.125 2.4-2.399 2.4-1.35 0-2.4-1.049-2.4-2.4-.075-1.349 1.05-2.398 2.4-2.398zM11.4 0H6.15C2.775 0 0 2.775 0 6.15v11.7C0 21.226 2.775 24 6.15 24h5.25c.074 0 .15-.074.15-.149V.15c.001-.076-.075-.15-.15-.15zM9.676 22.051H6.15c-2.326 0-4.201-1.875-4.201-4.201V6.15c0-2.326 1.875-4.201 4.201-4.201H9.6l.076 20.102zM3.75 7.199c0 1.275.975 2.25 2.25 2.25s2.25-.975 2.25-2.25c0-1.273-.975-2.25-2.25-2.25s-2.25.977-2.25 2.25z"/></svg>`,
        browser: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z"/></svg>`,
        desktop: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.043c-.06-.003-.12 0-.18 0h-.016c.151-.467-.182-.825-1.065-1.224-.915-.4-1.646-.336-1.77.465-.008.043-.013.066-.018.135-.068.023-.139.053-.209.064-.43.268-.662.669-.793 1.187-.13.533-.17 1.156-.205 1.869v.003c-.02.334-.17.838-.319 1.35-1.5 1.072-3.58 1.538-5.348.334a2.645 2.645 0 00-.402-.533 1.45 1.45 0 00-.275-.333c.182 0 .338-.03.465-.067a.615.615 0 00.314-.334c.108-.267 0-.697-.345-1.163-.345-.467-.931-.995-1.788-1.521-.63-.4-.986-.87-1.15-1.396-.165-.534-.143-1.085-.015-1.645.245-1.07.873-2.11 1.274-2.763.107-.065.037.135-.408.974-.396.751-1.14 2.497-.122 3.854a8.123 8.123 0 01.647-2.876c.564-1.278 1.743-3.504 1.836-5.268.048.036.217.135.289.202.218.133.38.333.59.465.21.201.477.335.876.335.039.003.075.006.11.006.412 0 .73-.134.997-.268.29-.134.52-.334.74-.4h.005c.467-.135.835-.402 1.044-.7zm2.185 8.958c.037.6.343 1.245.882 1.377.588.134 1.434-.333 1.791-.765l.211-.01c.315-.007.577.01.847.268l.003.003c.208.199.305.53.391.876.085.4.154.78.409 1.066.486.527.645.906.636 1.14l.003-.007v.018l-.003-.012c-.015.262-.185.396-.498.595-.63.401-1.746.712-2.457 1.57-.618.737-1.37 1.14-2.036 1.191-.664.053-1.237-.2-1.574-.898l-.005-.003c-.21-.4-.12-1.025.056-1.69.176-.668.428-1.344.463-1.897.037-.714.076-1.335.195-1.814.12-.465.308-.797.641-.984l.045-.022zm-10.814.049h.01c.053 0 .105.005.157.014.376.055.706.333 1.023.752l.91 1.664.003.003c.243.533.754 1.064 1.189 1.637.434.598.77 1.131.729 1.57v.006c-.057.744-.48 1.148-1.125 1.294-.645.135-1.52.002-2.395-.464-.968-.536-2.118-.469-2.857-.602-.369-.066-.61-.2-.723-.4-.11-.2-.113-.602.123-1.23v-.004l.002-.003c.117-.334.03-.752-.027-1.118-.055-.401-.083-.71.043-.94.16-.334.396-.4.69-.533.294-.135.64-.202.915-.47h.002v-.002c.256-.268.445-.601.668-.838.19-.201.38-.336.663-.336zm7.159-9.074c-.435.201-.945.535-1.488.535-.542 0-.97-.267-1.28-.466-.154-.134-.28-.268-.373-.335-.164-.134-.144-.333-.074-.333.109.016.129.134.199.2.096.066.215.2.36.333.292.2.68.467 1.167.467.485 0 1.053-.267 1.398-.466.195-.135.445-.334.648-.467.156-.136.149-.267.279-.267.128.016.034.134-.147.332a8.097 8.097 0 01-.69.468zm-1.082-1.583V5.64c-.006-.02.013-.042.029-.05.074-.043.18-.027.26.004.063 0 .16.067.15.135-.006.049-.085.066-.135.066-.055 0-.092-.043-.141-.068-.052-.018-.146-.008-.163-.065zm-.551 0c-.02.058-.113.049-.166.066-.047.025-.086.068-.14.068-.05 0-.13-.02-.136-.068-.01-.066.088-.133.15-.133.08-.031.184-.047.259-.005.019.009.036.03.03.05v.02h.003z"/></svg>`,
        rom: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2zm2 5l5 3-5 3V9z"/></svg>`,
        gamepad: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>`
    };

    // Global State
    let categories = [];
    let allItems = [];
    let filteredItems = [];
    let currentCategoryIndex = 0;
    let currentItemIndex = 0;
    let isLaunching = false;
    let runningAppId = null;
    let runningAppName = null;

    // Elements
    const body = document.body;
    const categoryTabsEl = document.getElementById('categoryTabs');
    const carouselTrackEl = document.getElementById('carouselTrack');
    const headerTagEl = document.getElementById('headerTag');
    const headerTitleEl = document.getElementById('headerTitle');
    const headerDescEl = document.getElementById('headerDesc');
    const headerStatusEl = document.getElementById('headerStatus');
    const clockEl = document.getElementById('clock');
    const displayResEl = document.getElementById('displayRes');
    const gpuTextEl = document.getElementById('gpuText');
    const controllerPillEl = document.getElementById('controllerPill');
    const controllerTextEl = document.getElementById('controllerText');
    const launchOverlayEl = document.getElementById('launchOverlay');
    const launchTitleEl = document.getElementById('launchTitle');
    const launchSubEl = document.getElementById('launchSub');
    const launchLogoEl = document.getElementById('launchLogo');
    const toastModalEl = document.getElementById('toastModal');
    const toastTitleEl = document.getElementById('toastTitle');
    const toastDescEl = document.getElementById('toastDesc');
    const btnRestartSteamEl = document.getElementById('btnRestartSteam');
    const btnRomManagerEl = document.getElementById('btnRomManager');
    const romModalEl = document.getElementById('romModal');
    const btnRomModalCloseEl = document.getElementById('btnRomModalClose');
    const romSystemsBarEl = document.getElementById('romSystemsBar');
    const romBreadcrumbsEl = document.getElementById('romBreadcrumbs');
    const romSearchInputEl = document.getElementById('romSearchInput');
    const btnNewFolderEl = document.getElementById('btnNewFolder');
    const btnUploadFilesEl = document.getElementById('btnUploadFiles');
    const romFileInputEl = document.getElementById('romFileInput');
    const romFolderInputEl = document.getElementById('romFolderInput');
    const romUploadCardEl = document.getElementById('romUploadCard');
    const romUploadCardTitleEl = document.getElementById('romUploadCardTitle');
    const btnCancelUploadEl = document.getElementById('btnCancelUpload');
    const romUploadCardBarEl = document.getElementById('romUploadCardBar');
    const romUploadStatProgressEl = document.getElementById('romUploadStatProgress');
    const romUploadStatSpeedEl = document.getElementById('romUploadStatSpeed');
    const romUploadStatEtaEl = document.getElementById('romUploadStatEta');
    const romDropTargetEl = document.getElementById('romDropTarget');
    const romTableBodyEl = document.getElementById('romTableBody');
    const romEmptyStateEl = document.getElementById('romEmptyState');
    const romStorageHintEl = document.getElementById('romStorageHint');
    let isRomModalOpen = false;
    let currentBrowsePath = 'eglantine/games';
    let currentDirData = null;
    let isUploadCancelled = false;

    // ==========================================================================
    // Synthesized Web Audio API Sound Effects
    // ==========================================================================
    let audioCtx = null;

    function initAudio() {
        if (!audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) audioCtx = new AudioContext();
        }
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }

    // Tactile silky console focus tick + sub-bass pulse (PS5 / Switch 2 style)
    function playFocusSound() {
        try {
            initAudio();
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            // High metallic click
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(920, now);
            osc.frequency.exponentialRampToValueAtTime(410, now + 0.036);
            gain.gain.setValueAtTime(0.055, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.042);

            // Subtle physical sub-bass thump
            const sub = audioCtx.createOscillator();
            const subGain = audioCtx.createGain();
            sub.type = 'triangle';
            sub.frequency.setValueAtTime(105, now);
            sub.frequency.exponentialRampToValueAtTime(48, now + 0.055);
            subGain.gain.setValueAtTime(0.045, now);
            subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
            sub.connect(subGain);
            subGain.connect(audioCtx.destination);
            sub.start(now);
            sub.stop(now + 0.065);
        } catch (e) {}
    }

    // Resonant filter swoosh when switching category tabs
    function playTabSound() {
        try {
            initAudio();
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const filter = audioCtx.createBiquadFilter();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(300, now);
            filter.frequency.exponentialRampToValueAtTime(1400, now + 0.085);
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(690, now + 0.085);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.1);
        } catch (e) {}
    }

    // Rich harmonic console chord + sub drop on launch
    function playLaunchSound() {
        try {
            initAudio();
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = idx === 3 ? 'triangle' : 'sine';
                const startTime = now + idx * 0.038;
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.1, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.52);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.56);
            });
            const sub = audioCtx.createOscillator();
            const subGain = audioCtx.createGain();
            sub.type = 'sine';
            sub.frequency.setValueAtTime(130, now);
            sub.frequency.exponentialRampToValueAtTime(42, now + 0.45);
            subGain.gain.setValueAtTime(0.14, now);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
            sub.connect(subGain);
            subGain.connect(audioCtx.destination);
            sub.start(now);
            sub.stop(now + 0.5);
        } catch (e) {}
    }

    // Warning double-tap if uninstalled
    function playAlertSound() {
        try {
            initAudio();
            if (!audioCtx) return;
            const now = audioCtx.currentTime;
            [280, 220].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sawtooth';
                const startTime = now + idx * 0.08;
                osc.frequency.setValueAtTime(freq, startTime);
                gain.gain.setValueAtTime(0.07, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.06);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.07);
            });
        } catch (e) {}
    }

    // ==========================================================================
    // Fetch Configuration & System Metrics
    // ==========================================================================
    async function loadData() {
        // 1. Fetch Dynamic System Metrics
        try {
            const res = await fetch('/api/system');
            if (res.ok) {
                const sys = await res.json();
                if (sys.gpu) gpuTextEl.textContent = sys.gpu;
                if (sys.resolution) displayResEl.textContent = sys.resolution;
            }
        } catch (e) {
            console.warn('[hub] System API unavailable:', e);
        }

        // 2. Fetch Launchers & Emulators Configuration
        let config = null;
        try {
            const res = await fetch('/api/launchers');
            if (res.ok) config = await res.json();
        } catch (e) {}

        // Fallback to static launchers.json
        if (!config || !config.items || config.items.length === 0) {
            try {
                const res = await fetch('launchers.json');
                if (res.ok) config = await res.json();
            } catch (e) {}
        }

        if (config) {
            categories = config.categories || [{ id: 'all', name: 'All Experiences' }];
            allItems = config.items || [];
        }

        const urlParams = new URLSearchParams(window.location.search);
        const reqApp = urlParams.get('app');
        let initialIdx = 0;
        if (reqApp) {
            const foundIdx = allItems.findIndex(i => i.id === reqApp);
            if (foundIdx !== -1) initialIdx = foundIdx;
        }

        renderCategoryTabs();
        filterAndRenderCards(initialIdx);

        if (urlParams.get('open_roms') === '1') {
            setTimeout(openRomModal, 250);
        }
    }

    // ==========================================================================
    // Category Tabs Rendering & Switching
    // ==========================================================================
    function renderCategoryTabs() {
        categoryTabsEl.innerHTML = '';
        categories.forEach((cat, idx) => {
            const btn = document.createElement('button');
            btn.className = `tab-btn ${idx === currentCategoryIndex ? 'active' : ''}`;
            btn.textContent = cat.name;
            btn.addEventListener('click', () => {
                initAudio();
                setCategoryIndex(idx);
            });
            categoryTabsEl.appendChild(btn);
        });
    }

    function setCategoryIndex(index) {
        if (isLaunching) return;
        if (index < 0) index = categories.length - 1;
        if (index >= categories.length) index = 0;

        currentCategoryIndex = index;
        playTabSound();

        const tabs = categoryTabsEl.querySelectorAll('.tab-btn');
        tabs.forEach((tab, idx) => {
            tab.classList.toggle('active', idx === currentCategoryIndex);
        });

        filterAndRenderCards(0);
    }

    // ==========================================================================
    // Cards Rendering, 4-Layer 3D Parallax & Specular Sheen
    // ==========================================================================
    let ambImpulseX = 0;

    function filterAndRenderCards(selectIdx = 0) {
        const activeCatId = categories[currentCategoryIndex]?.id || 'all';

        if (activeCatId === 'all') {
            filteredItems = allItems;
        } else {
            filteredItems = allItems.filter(item => item.category === activeCatId);
        }

        carouselTrackEl.innerHTML = '';
        carouselTrackEl.classList.remove('entering');
        void carouselTrackEl.offsetWidth;
        carouselTrackEl.classList.add('entering');
        clearTimeout(carouselTrackEl._enterTimer);
        carouselTrackEl._enterTimer = setTimeout(() => {
            carouselTrackEl.classList.remove('entering');
        }, 700);

        filteredItems.forEach((item, idx) => {
            const card = document.createElement('div');
            const installed = item.installed !== false;
            card.className = `card ${!installed ? 'uninstalled' : ''}`;
            card.dataset.index = idx;
            card.dataset.id = item.id;
            card.tabIndex = 0;
            card.style.setProperty('--i', idx);

            const coverClass = `cover-${item.icon || 'steam'}`;
            const svgIcon = ICONS[item.icon] || ICONS.gamepad;
            const subText = installed
                ? (item.category === 'emulators' ? 'Emulator ready' : 'Ready to launch')
                : 'Not installed';

            card.innerHTML = `
                <div class="card-inner">
                    <div class="card-cover ${coverClass}">
                        <div class="card-sheen"></div>
                        <div class="card-tag">${item.tag || 'EXPERIENCE'}</div>
                        <div class="card-bg-icon">${svgIcon}</div>
                        <div class="card-icon">${svgIcon}</div>
                    </div>
                    <div class="card-meta">
                        <div class="meta-title">${item.name}</div>
                        <div class="meta-sub">${subText}</div>
                    </div>
                    <div class="card-badge">
                        <span class="badge-key">${item.badge_key || (idx + 1)}</span>
                        <span class="badge-pad">${item.badge_pad || 'A'}</span>
                    </div>
                </div>
                <div class="card-reflection"></div>
            `;

            // Real-time Apple TV / PS5 3D Tilt & Specular Sheen on pointer move
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const rx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
                const ry = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
                const tiltX = (-ry * 13).toFixed(2);
                const tiltY = (rx * 15).toFixed(2);
                const sheenX = ((0.5 - rx * 0.42) * 100).toFixed(1);
                const sheenY = ((0.4 - ry * 0.42) * 100).toFixed(1);
                card.style.setProperty('--tilt-x', `${tiltX}deg`);
                card.style.setProperty('--tilt-y', `${tiltY}deg`);
                card.style.setProperty('--sheen-x', `${sheenX}%`);
                card.style.setProperty('--sheen-y', `${sheenY}%`);
            });

            card.addEventListener('mouseleave', () => {
                card.style.setProperty('--tilt-x', '0deg');
                card.style.setProperty('--tilt-y', '0deg');
                card.style.setProperty('--sheen-x', '50%');
                card.style.setProperty('--sheen-y', '30%');
            });

            card.addEventListener('click', () => {
                initAudio();
                wakeDock();
                if (idx !== currentItemIndex) {
                    setItemIndex(idx);
                } else {
                    handleItemAction(item);
                }
            });

            carouselTrackEl.appendChild(card);
        });

        // Position track immediately on initial render
        updateTrackPosition();
        setItemIndex(selectIdx, false);
    }

    function updateTrackPosition() {
        if (!carouselTrackEl || filteredItems.length === 0) return;
        const cards = carouselTrackEl.querySelectorAll('.card');
        const n = cards.length;
        const cardW = Math.min(320, Math.max(230, window.innerWidth * 0.175));
        const spread = cardW * 0.92;

        cards.forEach((card, idx) => {
            let d = idx - currentItemIndex;
            if (n > 2) {
                if (d > n / 2) d -= n;
                else if (d < -n / 2) d += n;
            }
            const ad = Math.abs(d);
            card.classList.toggle('active', d === 0);
            card.style.zIndex = String(30 - ad);

            if (d === 0) {
                card.style.transform = 'translate3d(0px, -2.8vh, 65px) rotateY(0deg) scale(1.15)';
                card.style.opacity = '1';
                card.style.filter = 'none';
            } else if (ad <= 3) {
                const tx = d * spread + Math.sign(d) * (cardW * 0.14);
                const ty = ad * 10;
                const tz = Math.max(4, 38 - ad * 11);
                const ry = -Math.sign(d) * Math.min(28, 16 + ad * 4);
                const sc = Math.max(0.75, 1 - ad * 0.08);
                card.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty}px, ${tz}px) rotateY(${ry}deg) scale(${sc})`;
                card.style.opacity = String(Math.max(0.32, 0.92 - ad * 0.2));
                card.style.filter = `brightness(${Math.max(0.55, 0.9 - ad * 0.12)})`;
            } else {
                const tx = Math.sign(d) * spread * 3.6;
                card.style.transform = `translate3d(${tx.toFixed(1)}px, 30px, 0px) rotateY(${-Math.sign(d) * 32}deg) scale(0.7)`;
                card.style.opacity = '0';
            }
            card.style.pointerEvents = ad <= 3 ? 'auto' : 'none';
        });
    }

    function setItemIndex(index, playSound = true) {
        if (isLaunching || filteredItems.length === 0) return;

        const prevIndex = currentItemIndex;
        if (index < 0) index = filteredItems.length - 1;
        if (index >= filteredItems.length) index = 0;

        // Apply particle impulse on navigation
        if (playSound && index !== prevIndex) {
            const dir = index > prevIndex ? -1 : 1;
            ambImpulseX = dir * 4.2;
        }

        currentItemIndex = index;
        const currentItem = filteredItems[currentItemIndex];

        // Apply Dynamic Volumetric Palette
        const accentColor = currentItem.color || '#38bdf8';
        const secondaryColor = currentItem.color_secondary || '#1d4ed8';
        const glowColor = currentItem.color_glow || 'rgba(56, 189, 248, 0.48)';
        document.documentElement.style.setProperty('--active-accent', accentColor);
        document.documentElement.style.setProperty('--active-secondary', secondaryColor);
        document.documentElement.style.setProperty('--active-glow', glowColor);

        // Update Hero Stage Typography & Specs
        headerTagEl.textContent = currentItem.tag || currentItem.category.toUpperCase();
        headerTitleEl.textContent = currentItem.name.toUpperCase();
        headerDescEl.textContent = currentItem.desc;

        const specsEl = document.getElementById('headerSpecs');
        if (specsEl) {
            const specs = currentItem.specs || ['VULKAN', '60 FPS', 'LOW LATENCY'];
            specsEl.innerHTML = specs.map(s => `<span class="spec-pill">${s}</span>`).join('');
        }

        [headerTagEl, headerTitleEl, headerDescEl].forEach((el) => {
            if (el) {
                const cls = el === headerTitleEl ? 'title-reveal' : 'slide-enter';
                el.classList.remove('slide-enter', 'title-reveal');
                void el.offsetWidth;
                el.classList.add(cls);
            }
        });

        const isInstalled = currentItem.installed !== false;
        headerStatusEl.textContent = isInstalled ? 'READY TO PLAY' : 'NOT INSTALLED';
        headerStatusEl.className = `header-status-badge ${!isInstalled ? 'missing' : ''}`;

        // Monumental Watermark Text & Emblem Swap
        const watermarkEl = document.getElementById('heroWatermark');
        if (watermarkEl) {
            watermarkEl.classList.add('swap');
            clearTimeout(watermarkEl._t);
            watermarkEl._t = setTimeout(() => {
                watermarkEl.textContent = (currentItem.watermark || currentItem.name).toUpperCase();
                watermarkEl.classList.remove('swap');
            }, 160);
        }

        const heroIconEl = document.getElementById('heroIcon');
        if (heroIconEl) {
            heroIconEl.classList.add('swap');
            clearTimeout(heroIconEl._t);
            heroIconEl._t = setTimeout(() => {
                heroIconEl.innerHTML = ICONS[currentItem.icon] || ICONS.gamepad;
                heroIconEl.classList.remove('swap');
            }, 160);
        }

        updateTrackPosition();
        setDroneNote(currentItemIndex);

        if (playSound) playFocusSound();
    }

    // ==========================================================================
    // Launch Action, Warp Shockwave & Missing Item Toast
    // ==========================================================================
    let toastTimeout = null;

    function showToast(title, desc) {
        playAlertSound();
        toastTitleEl.textContent = title;
        toastDescEl.textContent = desc;
        toastModalEl.classList.add('visible');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toastModalEl.classList.remove('visible');
        }, 4000);
    }

    let launchStepTimer = null;
    let launchSafetyTimer = null;

    function cancelActiveLaunch() {
        clearInterval(launchStepTimer);
        clearTimeout(launchSafetyTimer);
        isLaunching = false;
        launchOverlayEl.classList.remove('active');
        const activeCard = carouselTrackEl.querySelector('.card.launching');
        if (activeCard) activeCard.classList.remove('launching');
        fetch('/api/launcher?app=kill-apps').catch(() => {});
    }

    const btnCancelLaunchEl = document.getElementById('btnCancelLaunch');
    if (btnCancelLaunchEl) {
        btnCancelLaunchEl.addEventListener('click', (e) => {
            e.stopPropagation();
            initAudio();
            cancelActiveLaunch();
        });
    }

    function handleItemAction(item) {
        if (isLaunching) return;

        if (item.id === 'rom-manager') {
            openRomModal();
            return;
        }

        if (item.installed === false) {
            showToast(
                `${item.name} is not installed`,
                `Install the corresponding package or binary inside the container to enable this platform.`
            );
            return;
        }

        isLaunching = true;
        playLaunchSound();

        // Trigger 3D Card Warp Zoom & Shockwave Ring
        const activeCard = carouselTrackEl.querySelector('.card.active');
        if (activeCard) activeCard.classList.add('launching');
        const warpRing = document.getElementById('launchWarpRing');
        if (warpRing) {
            warpRing.classList.remove('active');
            void warpRing.offsetWidth;
            warpRing.classList.add('active');
        }

        launchTitleEl.textContent = `LAUNCHING ${item.name.toUpperCase()}...`;
        launchSubEl.textContent = item.desc || 'Initializing high-performance gaming session...';
        launchLogoEl.innerHTML = ICONS[item.icon] || ICONS.gamepad;

        const stepEl = document.getElementById('launchStepStatus');
        const steps = [
            'Starting application process...',
            'Initializing Vulkan & X11 graphics context...',
            'Maximizing fullscreen viewport...',
            'Waiting for application window focus...'
        ];
        let stepIdx = 0;
        if (stepEl) stepEl.textContent = steps[0];
        clearInterval(launchStepTimer);
        launchStepTimer = setInterval(() => {
            stepIdx = Math.min(steps.length - 1, stepIdx + 1);
            if (stepEl) stepEl.textContent = steps[stepIdx];
        }, 1600);

        // Show fullscreen loading overlay immediately so there is zero blank gap
        launchOverlayEl.classList.add('active');

        const targetUrl = `/api/launcher?app=${encodeURIComponent(item.id)}`;
        console.log(`[hub] Launching session: ${item.id} via ${targetUrl}`);

        // Safety timer to auto-dismiss overlay if launch is delayed or fails
        clearTimeout(launchSafetyTimer);
        launchSafetyTimer = setTimeout(() => {
            clearInterval(launchStepTimer);
            isLaunching = false;
            launchOverlayEl.classList.remove('active');
            if (activeCard) activeCard.classList.remove('launching');
        }, 18000);

        // Allow 250ms for the browser to paint the loading overlay before signaling session manager
        setTimeout(() => {
            if (!isLaunching) return;
            fetch(targetUrl, { method: 'GET' })
                .then(res => {
                    if (!res.ok) {
                        clearInterval(launchStepTimer);
                        clearTimeout(launchSafetyTimer);
                        isLaunching = false;
                        launchOverlayEl.classList.remove('active');
                        if (activeCard) activeCard.classList.remove('launching');
                        showToast('Launch Error', `Unable to launch ${item.name} (HTTP ${res.status}).`);
                    }
                })
                .catch(err => {
                    console.warn('[hub] Fetch error, continuing fallback:', err);
                    clearInterval(launchStepTimer);
                    clearTimeout(launchSafetyTimer);
                    isLaunching = false;
                    launchOverlayEl.classList.remove('active');
                    if (activeCard) activeCard.classList.remove('launching');
                    showToast('Service Offline', 'The Kyber control service did not respond.');
                });
        }, 250);
    }

    // ==========================================================================
    // Ambiance Engine: Theater Dust, Rain, Neon Grid & Spatial Drone
    // ==========================================================================
    const AMBIANCES = [
        { id: 'theater',   name: 'Theater' },
        { id: 'particles', name: 'Cosmos' },
        { id: 'grid',      name: 'Neon Grid' },
        { id: 'rain',      name: 'Cyber Rain' },
        { id: 'minimal',   name: 'Minimal' }
    ];
    let savedAmb = localStorage.getItem('kyber_ambiance');
    let ambIndex = Math.max(0, AMBIANCES.findIndex(a => a.id === savedAmb));
    let ambSoundOn = localStorage.getItem('kyber_amb_sound') === '1';
    const ambCanvas = document.getElementById('ambientCanvas');
    const ambCtx = ambCanvas ? ambCanvas.getContext('2d') : null;
    const ambChipEl = document.getElementById('ambChip');
    let ambParticles = [];
    let ambColor = '56,189,248';
    let ambColorStamp = 0;
    let ambRaf = null;

    function resizeAmbCanvas() {
        if (!ambCanvas) return;
        const scale = 0.55;
        ambCanvas.width = Math.floor(window.innerWidth * scale);
        ambCanvas.height = Math.floor(window.innerHeight * scale);
        ambParticles = [];
    }

    function refreshAmbColor(now) {
        if (now - ambColorStamp < 200) return;
        ambColorStamp = now;
        const c = getComputedStyle(document.documentElement).getPropertyValue('--active-accent').trim();
        const m = c.match(/\d+(\.\d+)?/g);
        if (m && m.length >= 3 && c.startsWith('rgb')) ambColor = `${m[0]},${m[1]},${m[2]}`;
        else if (c.startsWith('#') && c.length === 7) {
            ambColor = `${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)}`;
        }
    }

    function ambFrame(now) {
        const mode = AMBIANCES[ambIndex].id;
        if (!ambCtx || (mode !== 'theater' && mode !== 'particles' && mode !== 'rain')) {
            ambRaf = null;
            return;
        }
        refreshAmbColor(now);
        const w = ambCanvas.width, h = ambCanvas.height;
        ambCtx.clearRect(0, 0, w, h);

        ambImpulseX *= 0.91;
        if (Math.abs(ambImpulseX) < 0.02) ambImpulseX = 0;

        const target = mode === 'rain' ? 75 : (mode === 'theater' ? 48 : 65);
        while (ambParticles.length < target) {
            ambParticles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                v: mode === 'rain' ? 3.2 + Math.random() * 4.8 : 0.18 + Math.random() * 0.48,
                r: mode === 'rain' ? 1 : 0.9 + Math.random() * 2.2,
                l: mode === 'rain' ? 16 + Math.random() * 28 : 0,
                a: 0.16 + Math.random() * 0.48,
                ph: Math.random() * 6.28
            });
        }

        for (const p of ambParticles) {
            if (mode === 'rain') {
                p.y += p.v;
                p.x += ambImpulseX * 0.5;
                if (p.y - p.l > h) { p.y = -10; p.x = Math.random() * w; }
                if (p.x < 0) p.x += w; else if (p.x > w) p.x -= w;
                const g = ambCtx.createLinearGradient(p.x, p.y - p.l, p.x, p.y);
                g.addColorStop(0, `rgba(${ambColor},0)`);
                g.addColorStop(1, `rgba(${ambColor},${p.a})`);
                ambCtx.fillStyle = g;
                ambCtx.fillRect(p.x, p.y - p.l, p.r, p.l);
            } else {
                p.y -= p.v;
                p.ph += 0.012;
                p.x += Math.sin(p.ph) * 0.35 + ambImpulseX * (0.4 + p.r * 0.25);
                if (p.y < -6) { p.y = h + 6; p.x = Math.random() * w; }
                if (p.x < -6) p.x += w + 12; else if (p.x > w + 6) p.x -= w + 12;
                ambCtx.beginPath();
                const alpha = p.a * (0.55 + 0.45 * Math.sin(p.ph * 2.5));
                ambCtx.fillStyle = `rgba(${ambColor},${alpha.toFixed(3)})`;
                ambCtx.arc(p.x, p.y, p.r, 0, 6.283);
                ambCtx.fill();
            }
        }

        // Subtle autonomous 3D sheen drift on the focused card when idle
        const activeCard = carouselTrackEl ? carouselTrackEl.querySelector('.card.active:not(:hover)') : null;
        if (activeCard) {
            const t = now * 0.0012;
            const bx = (Math.sin(t) * 3.2).toFixed(2);
            const by = (Math.cos(t * 0.8) * 4.0).toFixed(2);
            const sx = (50 + Math.sin(t) * 18).toFixed(1);
            const sy = (32 + Math.cos(t * 0.8) * 14).toFixed(1);
            activeCard.style.setProperty('--tilt-x', `${bx}deg`);
            activeCard.style.setProperty('--tilt-y', `${by}deg`);
            activeCard.style.setProperty('--sheen-x', `${sx}%`);
            activeCard.style.setProperty('--sheen-y', `${sy}%`);
        }

        ambRaf = requestAnimationFrame(ambFrame);
    }

    function applyAmbiance(showChip) {
        const mode = AMBIANCES[ambIndex].id;
        AMBIANCES.forEach(a => body.classList.toggle('amb-' + a.id, a.id === mode));
        if (ambCtx) ambCtx.clearRect(0, 0, ambCanvas.width, ambCanvas.height);
        ambParticles = [];
        if (!ambRaf && (mode === 'theater' || mode === 'particles' || mode === 'rain')) {
            ambRaf = requestAnimationFrame(ambFrame);
        }
        const nameEl = document.getElementById('ccAmbName');
        if (nameEl) nameEl.textContent = AMBIANCES[ambIndex].name;
        const hudAmbEl = document.getElementById('hudAmbLabel');
        if (hudAmbEl) hudAmbEl.textContent = AMBIANCES[ambIndex].name;
        localStorage.setItem('kyber_ambiance', mode);
        if (showChip && ambChipEl) {
            ambChipEl.textContent = 'ATMOSPHERE • ' + AMBIANCES[ambIndex].name.toUpperCase();
            ambChipEl.classList.add('show');
            clearTimeout(ambChipEl._t);
            ambChipEl._t = setTimeout(() => ambChipEl.classList.remove('show'), 1600);
        }
    }

    function cycleAmbiance() {
        ambIndex = (ambIndex + 1) % AMBIANCES.length;
        applyAmbiance(true);
        playTabSound();
    }

    // Generative drone: three soft oscillators through a breathing low-pass filter
    let drone = null;
    const DRONE_NOTES = [110, 123.47, 146.83, 164.81, 196, 220, 246.94, 293.66];

    function startDrone() {
        initAudio();
        if (!audioCtx || drone) return;
        const t = audioCtx.currentTime;
        const master = audioCtx.createGain();
        master.gain.setValueAtTime(0, t);
        master.gain.linearRampToValueAtTime(0.035, t + 3);
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 520;
        const lfo = audioCtx.createOscillator();
        const lfoGain = audioCtx.createGain();
        lfo.frequency.value = 0.07;
        lfoGain.gain.value = 260;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        const oscs = [1, 1.5, 2].map((mul, i) => {
            const o = audioCtx.createOscillator();
            o.type = i === 0 ? 'sine' : 'triangle';
            o.frequency.value = DRONE_NOTES[0] * mul;
            o.detune.value = (i - 1) * 6;
            o.connect(filter);
            o.start();
            return { o, mul };
        });
        filter.connect(master);
        master.connect(audioCtx.destination);
        lfo.start();
        drone = { master, oscs, lfo };
        setDroneNote(currentItemIndex);
    }

    function stopDrone() {
        if (!drone || !audioCtx) return;
        const d = drone;
        drone = null;
        const t = audioCtx.currentTime;
        d.master.gain.cancelScheduledValues(t);
        d.master.gain.setValueAtTime(d.master.gain.value, t);
        d.master.gain.linearRampToValueAtTime(0, t + 1);
        setTimeout(() => { d.oscs.forEach(x => x.o.stop()); d.lfo.stop(); }, 1200);
    }

    function setDroneNote(idx) {
        if (!drone || !audioCtx) return;
        const f = DRONE_NOTES[((idx % DRONE_NOTES.length) + DRONE_NOTES.length) % DRONE_NOTES.length];
        const t = audioCtx.currentTime;
        drone.oscs.forEach(x => x.o.frequency.setTargetAtTime(f * x.mul, t, 0.9));
    }

    function applySound() {
        const el = document.getElementById('ccSoundName');
        if (el) el.textContent = ambSoundOn ? 'On' : 'Off';
        localStorage.setItem('kyber_amb_sound', ambSoundOn ? '1' : '0');
        if (ambSoundOn) startDrone(); else stopDrone();
    }

    function toggleSound() {
        ambSoundOn = !ambSoundOn;
        applySound();
        playTabSound();
    }

    // Auto-fading bottom dock after 6 seconds of inactivity
    const bottomDockEl = document.getElementById('bottomDock');
    let dockIdleTimer = null;
    function wakeDock() {
        if (bottomDockEl) bottomDockEl.classList.remove('idle-dim');
        clearTimeout(dockIdleTimer);
        dockIdleTimer = setTimeout(() => {
            if (bottomDockEl && !ccOpen && !isRomModalOpen) {
                bottomDockEl.classList.add('idle-dim');
            }
        }, 6500);
    }

    // Mouse parallax & dock wake
    window.addEventListener('mousemove', (e) => {
        const mx = (e.clientX / window.innerWidth - 0.5) * 2;
        const my = (e.clientY / window.innerHeight - 0.5) * 2;
        document.documentElement.style.setProperty('--mx', mx.toFixed(3));
        document.documentElement.style.setProperty('--my', my.toFixed(3));
        wakeDock();
    }, { passive: true });

    // Wire Hero CTA & HUD Ambiance buttons
    const btnHeroLaunchEl = document.getElementById('btnHeroLaunch');
    if (btnHeroLaunchEl) {
        btnHeroLaunchEl.addEventListener('click', () => {
            initAudio();
            if (filteredItems[currentItemIndex]) handleItemAction(filteredItems[currentItemIndex]);
        });
    }
    const btnHeroOptionsEl = document.getElementById('btnHeroOptions');
    if (btnHeroOptionsEl) {
        btnHeroOptionsEl.addEventListener('click', () => {
            initAudio();
            openControlCenter();
        });
    }
    const btnHudAmbianceEl = document.getElementById('btnHudAmbiance');
    if (btnHudAmbianceEl) {
        btnHudAmbianceEl.addEventListener('click', () => {
            initAudio();
            cycleAmbiance();
        });
    }

    window.addEventListener('resize', resizeAmbCanvas);
    resizeAmbCanvas();
    applyAmbiance(false);
    wakeDock();

    // ==========================================================================
    // Control Center (always-available exit & session management)
    // ==========================================================================
    const ccEl = document.getElementById('controlCenter');
    const ccScrimEl = document.getElementById('ccScrim');
    const btnControlCenterEl = document.getElementById('btnControlCenter');
    let ccOpen = false;
    let ccIndex = 0;

    function ccItems() {
        return Array.from(ccEl.querySelectorAll('.cc-item:not(.hidden)'));
    }

    function ccRefreshFocus() {
        ccItems().forEach((el, i) => el.classList.toggle('focus', i === ccIndex));
    }

    function openControlCenter() {
        if (ccOpen || isRomModalOpen) return;
        ccOpen = true;
        const resumeBtn = ccEl.querySelector('[data-cc="resume"]');
        const closeBtn = ccEl.querySelector('[data-cc="closeapp"]');
        const hasApp = !!runningAppId;
        resumeBtn.classList.toggle('hidden', !hasApp);
        closeBtn.classList.toggle('hidden', !hasApp);
        const nameEl = document.getElementById('ccResumeName');
        if (nameEl) nameEl.textContent = runningAppName || '';
        ccIndex = 0;
        ccEl.classList.add('open');
        ccScrimEl.classList.add('open');
        ccEl.setAttribute('aria-hidden', 'false');
        ccRefreshFocus();
        playTabSound();
    }

    function closeControlCenter() {
        if (!ccOpen) return;
        ccOpen = false;
        ccEl.classList.remove('open');
        ccScrimEl.classList.remove('open');
        ccEl.setAttribute('aria-hidden', 'true');
        playFocusSound();
    }

    function ccMove(delta) {
        const items = ccItems();
        if (!items.length) return;
        ccIndex = (ccIndex + delta + items.length) % items.length;
        ccRefreshFocus();
        playFocusSound();
    }

    function ccActivate(action) {
        switch (action) {
            case 'resume': {
                closeControlCenter();
                const it = allItems.find(i => i.id === runningAppId);
                if (it) handleItemAction(it);
                break;
            }
            case 'closeapp':
                closeControlCenter();
                fetch('/api/launcher?app=kill-apps').catch(() => {});
                showToast('Closing Application', 'The active application has been stopped.');
                setTimeout(pollLauncherStatus, 600);
                break;
            case 'desktop': {
                closeControlCenter();
                handleItemAction({ id: 'desktop', name: 'Desktop Mode', desc: 'Full Linux desktop, taskbar, and window manager', icon: 'desktop' });
                break;
            }
            case 'rom':
                closeControlCenter();
                openRomModal();
                break;
            case 'steam':
                closeControlCenter();
                handleItemAction({ id: 'restart-steam', name: 'Steam Clean Reload', desc: 'Clearing cache and restarting Steam...' });
                break;
            case 'ambiance':
                cycleAmbiance();
                break;
            case 'sound':
                toggleSound();
                break;
            case 'reload':
                location.reload();
                break;
            default:
                closeControlCenter();
        }
    }

    ccEl.querySelectorAll('.cc-item').forEach(el => {
        el.addEventListener('click', () => { initAudio(); ccActivate(el.dataset.cc); });
    });
    ccScrimEl.addEventListener('click', closeControlCenter);
    if (btnControlCenterEl) {
        btnControlCenterEl.addEventListener('click', () => {
            initAudio();
            ccOpen ? closeControlCenter() : openControlCenter();
        });
    }

    // ==========================================================================
    // Gamepad API Navigation Loop
    // ==========================================================================
    let lastNavTime = 0;
    const NAV_COOLDOWN_MS = 220;
    let prevButtonsState = {};

    function updateGamepadStatus() {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        let activePad = null;
        for (let i = 0; i < gamepads.length; i++) {
            if (gamepads[i] && gamepads[i].connected) {
                activePad = gamepads[i];
                break;
            }
        }

        if (activePad) {
            controllerPillEl.classList.remove('disconnected');
            let name = activePad.id;
            if (name.includes('Xbox')) name = 'Xbox Controller';
            else if (name.includes('DualSense') || name.includes('054c')) name = 'DualSense PS5';
            else if (name.includes('DualShock') || name.includes('Sony')) name = 'PlayStation Pad';
            else if (name.length > 20) name = name.substring(0, 18) + '...';
            controllerTextEl.textContent = name;
        } else {
            controllerPillEl.classList.add('disconnected');
            controllerTextEl.textContent = 'Keyboard / Mouse';
        }

        return activePad;
    }

    function gamepadLoop() {
        const pad = updateGamepadStatus();
        const now = performance.now();

        if (pad && !isLaunching && ccOpen) {
            const pressedNow = (i) => pad.buttons[i] && pad.buttons[i].pressed;
            const just = (i) => { const p = pressedNow(i); const j = p && !prevButtonsState[i]; prevButtonsState[i] = p; return j; };
            const ay = pad.axes[1] || 0;
            if (now - lastNavTime > NAV_COOLDOWN_MS) {
                if (pressedNow(13) || ay > 0.5) { ccMove(1); lastNavTime = now; }
                else if (pressedNow(12) || ay < -0.5) { ccMove(-1); lastNavTime = now; }
            }
            if (just(0)) { const it = ccItems()[ccIndex]; if (it) ccActivate(it.dataset.cc); }
            if (just(1) || just(9)) closeControlCenter();
        } else if (pad && !isLaunching) {
            // Analog stick navigation (Axis 0)
            const axisX = pad.axes[0] || 0;
            if (now - lastNavTime > NAV_COOLDOWN_MS) {
                if (axisX > 0.4) {
                    setItemIndex(currentItemIndex + 1);
                    lastNavTime = now;
                } else if (axisX < -0.4) {
                    setItemIndex(currentItemIndex - 1);
                    lastNavTime = now;
                }
            }

            const btn = (index) => pad.buttons[index] && pad.buttons[index].pressed;
            const btnJustPressed = (index) => {
                const pressed = btn(index);
                const justPressed = pressed && !prevButtonsState[index];
                prevButtonsState[index] = pressed;
                return justPressed;
            };

            // D-Pad Left (14) / Right (15)
            if (now - lastNavTime > NAV_COOLDOWN_MS) {
                if (btn(15)) {
                    setItemIndex(currentItemIndex + 1);
                    lastNavTime = now;
                } else if (btn(14)) {
                    setItemIndex(currentItemIndex - 1);
                    lastNavTime = now;
                }
            }

            // Bumpers: LB (4) / RB (5) -> Cycle Category Tabs
            if (btnJustPressed(4)) setCategoryIndex(currentCategoryIndex - 1);
            if (btnJustPressed(5)) setCategoryIndex(currentCategoryIndex + 1);

            // Button 0 (A / Cross): Launch active item
            if (btnJustPressed(0) && filteredItems[currentItemIndex]) {
                wakeDock();
                handleItemAction(filteredItems[currentItemIndex]);
            }

            // Button 3 (Y / Triangle): Cycle Ambiance
            if (btnJustPressed(3)) {
                wakeDock();
                cycleAmbiance();
            }

            // Right stick (Axes 2 & 3): Manual 3D Card Tilt & Parallax
            const rx = pad.axes[2] || 0;
            const ry = pad.axes[3] || 0;
            if (Math.abs(rx) > 0.1 || Math.abs(ry) > 0.1) {
                wakeDock();
                document.documentElement.style.setProperty('--mx', rx.toFixed(3));
                document.documentElement.style.setProperty('--my', ry.toFixed(3));
                const activeCard = carouselTrackEl ? carouselTrackEl.querySelector('.card.active') : null;
                if (activeCard) {
                    activeCard.style.setProperty('--tilt-x', `${(-ry * 14).toFixed(2)}deg`);
                    activeCard.style.setProperty('--tilt-y', `${(rx * 16).toFixed(2)}deg`);
                    activeCard.style.setProperty('--sheen-x', `${((0.5 - rx * 0.4) * 100).toFixed(1)}%`);
                    activeCard.style.setProperty('--sheen-y', `${((0.4 - ry * 0.4) * 100).toFixed(1)}%`);
                }
            }

            // B / Circle and Start / Menu: Control Center
            if (btnJustPressed(1) || btnJustPressed(9)) {
                wakeDock();
                openControlCenter();
            }
        }

        requestAnimationFrame(gamepadLoop);
    }

    // ==========================================================================
    // Keyboard Navigation
    // ==========================================================================
    window.addEventListener('keydown', (e) => {
        // Prevent accidental closing of the Hub kiosk tab
        if ((e.ctrlKey || e.metaKey) && (e.key === 'w' || e.key === 'W')) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        initAudio();
        wakeDock();
        if (isLaunching) {
            if (e.key === 'Escape') {
                e.preventDefault();
                cancelActiveLaunch();
            }
            return;
        }

        if (ccOpen) {
            e.preventDefault();
            if (e.key === 'Escape' || e.key === 'Backspace') closeControlCenter();
            else if (e.key === 'ArrowDown' || e.key === 'Tab') ccMove(1);
            else if (e.key === 'ArrowUp') ccMove(-1);
            else if (e.key === 'Enter' || e.key === ' ') {
                const it = ccItems()[ccIndex];
                if (it) ccActivate(it.dataset.cc);
            }
            return;
        }

        switch (e.key) {
            case 'ArrowRight':
            case 'Tab':
                e.preventDefault();
                setItemIndex(currentItemIndex + 1);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                setItemIndex(currentItemIndex - 1);
                break;
            case 'q':
            case 'Q':
                e.preventDefault();
                setCategoryIndex(currentCategoryIndex - 1);
                break;
            case 'e':
            case 'E':
                e.preventDefault();
                setCategoryIndex(currentCategoryIndex + 1);
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (filteredItems[currentItemIndex]) handleItemAction(filteredItems[currentItemIndex]);
                break;
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                const matched = allItems.find(i => i.badge_key === e.key);
                if (matched) {
                    e.preventDefault();
                    handleItemAction(matched);
                }
                break;
            case 'Escape':
                e.preventDefault();
                if (isRomModalOpen) {
                    closeRomModal();
                    break;
                }
                openControlCenter();
                break;
            case 'v':
            case 'V':
                e.preventDefault();
                cycleAmbiance();
                break;
            case 'm':
            case 'M':
                e.preventDefault();
                if (isRomModalOpen) closeRomModal();
                else openRomModal();
                break;
            case 'r':
            case 'R':
                e.preventDefault();
                handleItemAction({ id: 'restart-steam', name: 'Steam Clean Reload', desc: 'Clearing cache and restarting Steam...' });
                break;
        }
    });

    // ==========================================================================
    // ROM & Game Library Explorer Controller (Hierarchical & Chunked Upload)
    // ==========================================================================
    const PRESET_FOLDERS = [
        { id: 'switch_games', name: 'Switch Games', path: 'eglantine/games' },
        { id: 'switch_updates', name: 'Updates', path: 'eglantine/updates' },
        { id: 'switch_dlc', name: 'DLC Packs', path: 'eglantine/dlc' },
        { id: 'switch_keys', name: 'Keys', path: 'eglantine/keys' },
        { id: 'switch_firmware', name: 'Firmware', path: 'eglantine/firmware' },
        { id: 'switch_mods', name: 'Mods', path: 'eglantine/mods' },
        { id: 'saves', name: 'Saves', path: 'saves' },
        { id: 'all', name: 'All Folders', path: '' }
    ];

    const FILE_ICONS = {
        folder: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`,
        rom: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7.7 2C3.4 2 0 5.4 0 9.7v4.6C0 18.6 3.4 22 7.7 22H9V2H7.7zM6 9.5c.8 0 1.5.7 1.5 1.5s-.7 1.5-1.5 1.5S4.5 11.8 4.5 11s.7-1.5 1.5-1.5zm10.3-7.5H15v20h1.3c4.3 0 7.7-3.4 7.7-7.7V9.7C24 5.4 20.6 2 16.3 2zM18 14.5c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/></svg>`,
        key: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M7 14c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5c0 .65-.13 1.26-.36 1.83L18 17.17V20h-3v-2h-2v-2h-2.17l-1.01-1.01C9.26 15.37 8.15 16 7 16zm0-8C5.34 6 4 7.34 4 9s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
        archive: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6 10h-4v-2h4v2zm0-3h-4v-2h4v2zm0-3h-4V8h4v2z"/></svg>`,
        save: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/></svg>`,
        file: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>`
    };

    function openRomModal() {
        initAudio();
        isRomModalOpen = true;
        romModalEl.classList.add('active');
        renderPresetPills();
        loadDirectory(currentBrowsePath);
    }

    function closeRomModal() {
        initAudio();
        isRomModalOpen = false;
        romModalEl.classList.remove('active');
    }

    function renderPresetPills() {
        romSystemsBarEl.innerHTML = '';
        PRESET_FOLDERS.forEach(preset => {
            const btn = document.createElement('button');
            const isActive = currentBrowsePath === preset.path || (preset.path !== '' && currentBrowsePath.startsWith(preset.path));
            btn.className = `rom-system-pill ${isActive ? 'active' : ''}`;
            btn.innerHTML = `<span>${preset.name}</span>`;
            btn.addEventListener('click', () => {
                initAudio();
                loadDirectory(preset.path);
            });
            romSystemsBarEl.appendChild(btn);
        });
    }

    async function loadDirectory(relPath) {
        currentBrowsePath = relPath || '';
        try {
            const res = await fetch(`/api/roms/browse?path=${encodeURIComponent(currentBrowsePath)}`);
            if (res.ok) {
                const data = await res.json();
                currentDirData = data;
                renderDirectoryView();
                renderPresetPills();
            } else {
                showToast('Browse Error', 'Failed to read directory');
            }
        } catch (e) {
            console.warn('[hub] Failed to browse directory:', e);
            showToast('Network Error', 'Unable to reach backend storage service');
        }
    }

    function renderDirectoryView() {
        if (!currentDirData) return;

        // 1. Breadcrumbs
        romBreadcrumbsEl.innerHTML = '';
        (currentDirData.breadcrumbs || []).forEach((crumb, idx, arr) => {
            const isLast = idx === arr.length - 1;
            const item = document.createElement('span');
            item.className = `rom-crumb-item ${isLast ? 'active' : ''}`;
            item.textContent = crumb.name;
            if (!isLast) {
                item.addEventListener('click', () => {
                    initAudio();
                    loadDirectory(crumb.path);
                });
            }
            romBreadcrumbsEl.appendChild(item);

            if (!isLast) {
                const sep = document.createElement('span');
                sep.className = 'rom-crumb-sep';
                sep.textContent = '/';
                romBreadcrumbsEl.appendChild(sep);
            }
        });

        // 2. Storage Hint
        const currentPath = currentDirData.current_path !== undefined ? currentDirData.current_path : (currentDirData.path || '');
        const storageRoot = currentDirData.storage_root || currentDirData.absolute_path || '/home/gamer/roms';
        const totalSize = currentDirData.total_size || currentDirData.total_size_formatted || '0 B';

        if (romStorageHintEl) {
            romStorageHintEl.textContent = `Location: ${storageRoot}/${currentPath} (${currentDirData.total_folders || 0} folders, ${currentDirData.total_files || 0} files, ${totalSize})`;
        }

        // 3. Search Filter
        const query = (romSearchInputEl ? romSearchInputEl.value : '').trim().toLowerCase();

        const folders = (currentDirData.folders || []).filter(f => !query || f.name.toLowerCase().includes(query));
        const files = (currentDirData.files || []).filter(f => !query || f.name.toLowerCase().includes(query));

        romTableBodyEl.innerHTML = '';

        // Parent Directory row if not at root
        if (currentBrowsePath !== '') {
            const parentParts = currentBrowsePath.split('/').filter(Boolean);
            parentParts.pop();
            const parentPath = parentParts.join('/');

            const trParent = document.createElement('tr');
            trParent.className = 'rom-folder-row';
            trParent.innerHTML = `
                <td class="rom-filename-cell">
                    <span class="rom-item-icon" style="color:var(--text-muted);">${FILE_ICONS.folder}</span>
                    <span class="rom-folder-link">.. [Up one directory]</span>
                </td>
                <td><span class="rom-sys-badge">PARENT</span></td>
                <td class="rom-size-cell">--</td>
                <td class="rom-date-cell">--</td>
                <td style="text-align:right;"></td>
            `;
            trParent.addEventListener('click', () => {
                initAudio();
                loadDirectory(parentPath);
            });
            romTableBodyEl.appendChild(trParent);
        }

        if (folders.length === 0 && files.length === 0) {
            romEmptyStateEl.style.display = 'block';
        } else {
            romEmptyStateEl.style.display = 'none';

            // Render folders
            folders.forEach(folder => {
                const tr = document.createElement('tr');
                tr.className = 'rom-folder-row';
                const count = folder.item_count !== undefined ? folder.item_count : (folder.items_count || 0);
                tr.innerHTML = `
                    <td class="rom-filename-cell">
                        <span class="rom-item-icon" style="color:#60a5fa;">${FILE_ICONS.folder}</span>
                        <span class="rom-folder-link">${escapeHtml(folder.name)}</span>
                    </td>
                    <td><span class="rom-sys-badge" style="background:rgba(59,130,246,0.12);color:#93c5fd;">FOLDER</span></td>
                    <td class="rom-size-cell">${folder.size_formatted} (${count} items)</td>
                    <td class="rom-date-cell">${formatTimestamp(folder.modified)}</td>
                    <td style="text-align:right;">
                        <button class="rom-del-btn" title="Delete Folder">Delete</button>
                    </td>
                `;

                tr.querySelector('.rom-folder-link').addEventListener('click', (e) => {
                    e.stopPropagation();
                    initAudio();
                    loadDirectory(folder.path);
                });

                tr.addEventListener('click', () => {
                    initAudio();
                    loadDirectory(folder.path);
                });

                const delBtn = tr.querySelector('.rom-del-btn');
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    initAudio();
                    deleteStorageItem(folder.path, folder.name, true);
                });

                romTableBodyEl.appendChild(tr);
            });

            // Render files
            files.forEach(file => {
                const fileType = file.type || file.kind || 'file';
                const fileExt = file.extension || file.ext || '';
                const iconSvg = FILE_ICONS[fileType] || FILE_ICONS.file;
                const tr = document.createElement('tr');
                tr.className = 'rom-file-row';

                let kindBadge = 'FILE';
                let kindBadgeStyle = '';
                if (fileType === 'rom') {
                    kindBadge = fileExt.replace('.', '').toUpperCase() || 'ROM';
                    kindBadgeStyle = 'background:rgba(239,68,68,0.12);color:#fca5a5;';
                } else if (fileType === 'key') {
                    kindBadge = 'KEY';
                    kindBadgeStyle = 'background:rgba(234,179,8,0.12);color:#fde047;';
                } else if (fileType === 'archive') {
                    kindBadge = 'ARCHIVE';
                    kindBadgeStyle = 'background:rgba(168,85,247,0.12);color:#d8b4fe;';
                }

                tr.innerHTML = `
                    <td class="rom-filename-cell">
                        <span class="rom-item-icon">${iconSvg}</span>
                        <span class="rom-file-name">${escapeHtml(file.name)}</span>
                    </td>
                    <td><span class="rom-sys-badge" style="${kindBadgeStyle}">${kindBadge}</span></td>
                    <td class="rom-size-cell">${file.size_formatted}</td>
                    <td class="rom-date-cell">${formatTimestamp(file.modified)}</td>
                    <td style="text-align:right;">
                        <div class="rom-row-actions">
                            ${(fileType === 'archive' || fileExt === '.iso') ? `<button class="rom-extract-btn" style="background:rgba(168,85,247,0.15);color:#d8b4fe;border:1px solid rgba(168,85,247,0.3);padding:2px 8px;font-size:0.7rem;font-weight:600;border-radius:4px;cursor:pointer;margin-right:6px;" title="Extract Disc Image or Archive">EXTRACT</button>` : ''}
                            <a href="/api/roms/download?path=${encodeURIComponent(file.path)}" class="rom-action-icon-btn" title="Download File" download>
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                            </a>
                            <button class="rom-del-btn" title="Delete File">Delete</button>
                        </div>
                    </td>
                `;

                const extractBtn = tr.querySelector('.rom-extract-btn');
                if (extractBtn) {
                    extractBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        initAudio();
                        extractStorageArchive(file.path, file.name);
                    });
                }

                const delBtn = tr.querySelector('.rom-del-btn');
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    initAudio();
                    deleteStorageItem(file.path, file.name, false);
                });

                romTableBodyEl.appendChild(tr);
            });
        }
    }

    async function extractStorageArchive(relPath, filename) {
        showToast('Extracting Archive', `Extracting ${filename}...`);
        try {
            const res = await fetch('/api/roms/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: relPath, delete_archive: false })
            });
            const data = await res.json();
            if (data && data.status === 'ok') {
                showToast('Extraction Complete', `Successfully extracted ${filename}`);
                loadDirectory(currentBrowsePath);
            } else {
                showToast('Extraction Failed', `${(data && data.error) || 'Archive error'}`);
            }
        } catch (err) {
            showToast('Extraction Error', `${err}`);
        }
    }

    function formatTimestamp(ts) {
        if (!ts) return '--';
        if (typeof ts === 'number') {
            const d = new Date(ts * 1000);
            return d.toISOString().slice(0, 16).replace('T', ' ');
        }
        return String(ts);
    }

    function escapeHtml(str) {
        return (str || '').replace(/[&<>"']/g, function(m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }

    // Create New Folder
    async function promptCreateFolder() {
        const folderName = window.prompt(`Create new folder inside "${currentBrowsePath || 'root'}":`);
        if (!folderName || !folderName.trim()) return;

        try {
            const res = await fetch('/api/roms/create_folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: currentBrowsePath,
                    folder_name: folderName.trim()
                })
            });
            const data = await res.json();
            if (res.ok && data.status === 'ok') {
                showToast('Folder Created', `Created folder "${data.folder_name}"`);
                loadDirectory(data.created_path);
            } else {
                showToast('Folder Error', data.error || 'Failed to create folder');
            }
        } catch (e) {
            showToast('Network Error', 'Failed to reach server');
        }
    }

    // Delete item (file or folder)
    async function deleteStorageItem(relPath, displayName, isFolder) {
        const label = isFolder ? `folder "${displayName}" and all its contents` : `file "${displayName}"`;
        if (!confirm(`Are you sure you want to delete ${label}?`)) return;

        try {
            const res = await fetch('/api/roms/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: relPath })
            });
            const data = await res.json();
            if (res.ok && data.status === 'ok') {
                showToast('Deleted', `Removed ${displayName}`);
                loadDirectory(currentBrowsePath);
            } else {
                showToast('Delete Error', data.error || 'Failed to delete item');
            }
        } catch (e) {
            showToast('Delete Error', 'Network error occurred');
        }
    }

    // ==========================================================================
    // Chunked High-Performance File Uploader Engine (10 MB chunks with telemetry)
    // ==========================================================================
    const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB chunks

    async function uploadFilesChunked(files) {
        if (!files || files.length === 0) return;
        const fileArr = Array.from(files);
        isUploadCancelled = false;

        romUploadCardEl.style.display = 'block';

        let totalBytesAllFiles = fileArr.reduce((sum, f) => sum + f.size, 0);
        let uploadedBytesOverall = 0;
        let overallStartTime = performance.now();

        for (let fileIdx = 0; fileIdx < fileArr.length; fileIdx++) {
            if (isUploadCancelled) {
                showToast('Upload Cancelled', 'File upload was aborted.');
                break;
            }

            const file = fileArr[fileIdx];
            const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;
            const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

            romUploadCardTitleEl.textContent = `Uploading ${file.name} (${fileIdx + 1} of ${fileArr.length})...`;

            for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
                if (isUploadCancelled) break;

                const start = chunkIdx * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunkBlob = file.slice(start, end);
                const chunkSize = end - start;

                const chunkStartTime = performance.now();

                try {
                    const uploadUrl = `/api/roms/upload_chunk?upload_id=${encodeURIComponent(uploadId)}&filename=${encodeURIComponent(file.name)}&target_path=${encodeURIComponent(currentBrowsePath)}&chunk_index=${chunkIdx}&total_chunks=${totalChunks}&total_size=${file.size}`;

                    await new Promise((resolve, reject) => {
                        const xhr = new XMLHttpRequest();
                        xhr.open('POST', uploadUrl, true);
                        xhr.setRequestHeader('Content-Type', 'application/octet-stream');

                        xhr.upload.onprogress = (e) => {
                            if (e.lengthComputable) {
                                const currentChunkLoaded = e.loaded;
                                const currentTotalUploaded = uploadedBytesOverall + currentChunkLoaded;
                                const pct = Math.min(100, Math.round((currentTotalUploaded / totalBytesAllFiles) * 100));

                                const elapsedSec = (performance.now() - overallStartTime) / 1000;
                                const speedBytesPerSec = elapsedSec > 0 ? (currentTotalUploaded / elapsedSec) : 0;
                                const speedMBps = (speedBytesPerSec / (1024 * 1024)).toFixed(1);

                                const remainingBytes = Math.max(0, totalBytesAllFiles - currentTotalUploaded);
                                const etaSec = speedBytesPerSec > 0 ? Math.round(remainingBytes / speedBytesPerSec) : 0;
                                const etaFormatted = formatSeconds(etaSec);

                                romUploadCardBarEl.style.width = `${pct}%`;
                                romUploadStatProgressEl.textContent = `${pct}% (${formatBytes(currentTotalUploaded)} / ${formatBytes(totalBytesAllFiles)})`;
                                romUploadStatSpeedEl.textContent = `${speedMBps} MB/s`;
                                romUploadStatEtaEl.textContent = `ETA: ${etaFormatted}`;
                            }
                        };

                        xhr.onload = () => {
                            if (xhr.status === 200) {
                                resolve();
                            } else {
                                reject(new Error(`Server returned HTTP ${xhr.status}`));
                            }
                        };

                        xhr.onerror = () => reject(new Error('Network transport error'));
                        xhr.send(chunkBlob);
                    });

                    uploadedBytesOverall += chunkSize;
                } catch (err) {
                    romUploadCardEl.style.display = 'none';
                    showToast('Upload Error', `Failed on ${file.name}: ${err.message}`);
                    loadDirectory(currentBrowsePath);
                    return;
                }
            }
        }

        romUploadCardEl.style.display = 'none';
        if (!isUploadCancelled) {
            showToast('Upload Finished', `Successfully saved ${fileArr.length} file(s) into ${currentBrowsePath || 'root'}.`);
            loadDirectory(currentBrowsePath);
        }
    }

    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const dm = 1;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function formatSeconds(secs) {
        if (secs < 60) return `${secs}s`;
        const mins = Math.floor(secs / 60);
        const remSecs = secs % 60;
        return `${mins}m ${remSecs}s`;
    }

    // Event Bindings
    if (btnRomManagerEl) btnRomManagerEl.addEventListener('click', openRomModal);
    if (btnRomModalCloseEl) btnRomModalCloseEl.addEventListener('click', closeRomModal);
    if (btnNewFolderEl) btnNewFolderEl.addEventListener('click', promptCreateFolder);
    if (btnUploadFilesEl) btnUploadFilesEl.addEventListener('click', () => romFileInputEl.click());
    if (romFileInputEl) romFileInputEl.addEventListener('change', (e) => uploadFilesChunked(e.target.files));

    if (btnCancelUploadEl) {
        btnCancelUploadEl.addEventListener('click', () => {
            isUploadCancelled = true;
            romUploadCardEl.style.display = 'none';
        });
    }

    if (romSearchInputEl) {
        romSearchInputEl.addEventListener('input', () => {
            renderDirectoryView();
        });
    }

    if (romDropTargetEl) {
        romDropTargetEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            romDropTargetEl.classList.add('dragover');
        });
        romDropTargetEl.addEventListener('dragleave', () => {
            romDropTargetEl.classList.remove('dragover');
        });
        romDropTargetEl.addEventListener('drop', (e) => {
            e.preventDefault();
            romDropTargetEl.classList.remove('dragover');
            if (e.dataTransfer && e.dataTransfer.files) {
                uploadFilesChunked(e.dataTransfer.files);
            }
        });
    }

    btnRestartSteamEl.addEventListener('click', () => {
        initAudio();
        handleItemAction({ id: 'restart-steam', name: 'Steam Clean Reload', desc: 'Clearing cache and restarting Steam...' });
    });

    const btnDesktopModeEl = document.getElementById('btnDesktopMode');
    if (btnDesktopModeEl) {
        btnDesktopModeEl.addEventListener('click', () => {
            initAudio();
            handleItemAction({ id: 'desktop', name: 'Linux Desktop Mode', desc: 'Full desktop and window manager access' });
        });
    }

    // Running Application Polling & Indicators
    let currentRunningApps = {};
    async function pollLauncherStatus() {
        try {
            const res = await fetch('/api/launcher/status');
            if (res.ok) {
                currentRunningApps = await res.json();
                updateRunningAppBadges();
            }
        } catch (e) {}
    }

    function updateRunningAppBadges() {
        const cards = carouselTrackEl.querySelectorAll('.card');
        let activeTitle = null;
        let activeId = null;

        cards.forEach(card => {
            const id = card.dataset.id;
            let isRunning = false;
            if ((id === 'steam' || id === 'steam-bigpicture') && currentRunningApps.steam) isRunning = true;
            if (id === 'heroic' && currentRunningApps.heroic) isRunning = true;
            if (id === 'browser' && currentRunningApps.browser) isRunning = true;
            if (id === 'eglantine' && currentRunningApps.eglantine) isRunning = true;

            const cover = card.querySelector('.card-cover');
            let badge = card.querySelector('.running-badge');
            if (isRunning) {
                activeTitle = card.querySelector('.meta-title')?.textContent || id;
                activeId = id;
                if (!badge && cover) {
                    badge = document.createElement('div');
                    badge.className = 'running-badge';
                    badge.innerHTML = '<span class="pulse-dot"></span> RUNNING';
                    cover.appendChild(badge);
                }
            } else if (badge) {
                badge.remove();
            }
        });

        runningAppId = activeId;
        runningAppName = activeTitle;
        const pill = document.getElementById('runningAppPill');
        const text = document.getElementById('runningAppText');
        if (pill && text) {
            if (activeTitle) {
                text.textContent = `${activeTitle}`;
                pill.style.display = 'flex';
                pill.onclick = (e) => {
                    if (e.target.id === 'btnKillRunningApp') return;
                    handleItemAction({ id: activeId, name: activeTitle });
                };
            } else {
                pill.style.display = 'none';
            }
        }
    }

    const btnKillRunningAppEl = document.getElementById('btnKillRunningApp');
    if (btnKillRunningAppEl) {
        btnKillRunningAppEl.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await fetch('/api/launcher?app=kill-apps');
                showToast('Closing Application', 'The active application has been stopped.');
                setTimeout(pollLauncherStatus, 600);
            } catch (err) {}
        });
    }

    // Window Resize Handling for Transform Centering
    window.addEventListener('resize', () => {
        updateTrackPosition();
    });

    // Clock
    function updateClock() {
        const now = new Date();
        clockEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    setInterval(updateClock, 1000);
    updateClock();

    // Start
    loadData();
    if (ambSoundOn) applySound();
    setInterval(pollLauncherStatus, 3000);
    pollLauncherStatus();

    window.addEventListener('gamepadconnected', () => {
        updateGamepadStatus();
        playFocusSound();
    });
    window.addEventListener('gamepaddisconnected', updateGamepadStatus);
    requestAnimationFrame(gamepadLoop);
    window.focus();
})();
