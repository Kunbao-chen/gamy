window.UI_VERSION = "v3.5.0";

document.addEventListener("DOMContentLoaded", () => {
    const app = document.getElementById('game-app');
    if (window.innerWidth > window.innerHeight) app.classList.add('mode-h');

    const versionTag = document.getElementById('global-version-tag');
    if (versionTag) versionTag.innerText = `HTML:${window.HTML_VERSION} | ENG:${window.ENGINE_VERSION} | UI:${window.UI_VERSION}`;

    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    // --- 手術刀：CSS 變數讀取器 ---
    const getStyle = (prop) => getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
    // --- 手術刀結束 ---

    let CENTER = { x: 0, y: 0 }, HEX_SIZE = 0, isTracing = false;

    const resize = () => {
        const wrapper = document.getElementById('board-wrapper');
        const size = Math.min(wrapper.clientWidth, wrapper.clientHeight) - 60;
        canvas.width = size * window.devicePixelRatio;
        canvas.height = size * window.devicePixelRatio;
        canvas.style.width = `${size}px`; canvas.style.height = `${size}px`;
        ctx.resetTransform();
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        CENTER = { x: size / 2, y: size / 2 };
        HEX_SIZE = size / 16;
        render();
    };
    new ResizeObserver(resize).observe(document.getElementById('board-wrapper'));

    function hexToPixel(q, r) {
        if (app.classList.contains('mode-h')) {
            return { x: CENTER.x + HEX_SIZE * 1.5 * q, y: CENTER.y + HEX_SIZE * Math.sqrt(3) * (r + q / 2) };
        }
        return { x: CENTER.x + HEX_SIZE * Math.sqrt(3) * (r + q / 2), y: CENTER.y + HEX_SIZE * 1.5 * q };
    }

    function pixelToHex(px, py) {
        let q, r, x = (px - CENTER.x) / HEX_SIZE, y = (py - CENTER.y) / HEX_SIZE;
        if (app.classList.contains('mode-h')) {
            q = (2/3 * x); r = (-1/3 * x + Math.sqrt(3)/3 * y);
        } else {
            q = (2/3 * y); r = (-1/3 * y + Math.sqrt(3)/3 * x);
        }
        let s = -q - r, rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
        if (Math.abs(rq-q) > Math.abs(rr-r) && Math.abs(rq-q) > Math.abs(rs-s)) rq = -rr-rs;
        else if (Math.abs(rr-r) > Math.abs(rs-s)) rr = -rq-rs;
        return { q: rq, r: rr };
    }

    function render() {
        const state = Engine.getState();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        state.board.forEach((piece, key) => {
            const [q, r] = key.split(',').map(Number);
            const { x, y } = hexToPixel(q, r);
            
            // 繪製虛影格點 (v3.4.0 質感)
            ctx.beginPath(); ctx.arc(x, y, HEX_SIZE * 0.8, 0, Math.PI * 2);
            ctx.fillStyle = getStyle('--board-grid-color');
            ctx.fill();

            if (piece !== 0) {
                ctx.beginPath(); ctx.arc(x, y, HEX_SIZE * 0.7, 0, Math.PI * 2);
                ctx.fillStyle = piece === 1 ? getStyle('--piece-black') : getStyle('--piece-white');
                ctx.fill();
                if (piece === 2) { 
                    ctx.strokeStyle = getStyle('--piece-stroke'); 
                    ctx.lineWidth = 1; ctx.stroke(); 
                }
            }
            if (state.selection.some(s => s.q === q && s.r === r)) {
                ctx.strokeStyle = getStyle('--select-color'); ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(x, y, HEX_SIZE * 0.75, 0, Math.PI*2); ctx.stroke();
            }
        });

        if (state.pathIndex !== -1 && state.legalPaths[state.pathIndex]) {
            const path = state.legalPaths[state.pathIndex];
            const color = getStyle(path.type === 'in-line' ? '--path-inline-color' : '--path-broadside-color');
            const dash = parseInt(getStyle('--path-dash'));
            path.sel.forEach(s => {
                const start = hexToPixel(s.q, s.r), end = hexToPixel(s.q + path.dir.q, s.r + path.dir.r);
                ctx.setLineDash([dash, dash]); ctx.strokeStyle = color; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke();
                ctx.setLineDash([]);
            });
        }
        updateUI(state);
    }

    function updateUI(state) {
        const hasPaths = state.legalPaths.length > 0;
        document.querySelectorAll('.path-controls-inline').forEach(c => c.style.display = hasPaths ? "flex" : "none");
        const indText = `${state.pathIndex + 1} / ${Math.max(1, state.legalPaths.length)}`;
        document.querySelectorAll('.path-indicator').forEach(i => i.innerText = indText);
        document.getElementById('btn-execute-bottom').disabled = !(state.turn === 1 && state.pathIndex !== -1);
        document.getElementById('btn-execute-top').disabled = !(state.turn === 2 && state.pathIndex !== -1);
        document.getElementById('turn-display').innerText = state.turn === 1 ? "黑棋回合" : "白棋回合";
    }

    canvas.addEventListener('pointerdown', (e) => {
        isTracing = true;
        const rect = canvas.getBoundingClientRect();
        const p = pixelToHex(e.clientX - rect.left, e.clientY - rect.top);
        if (Engine.getState().board.get(`${p.q},${p.r}`) === Engine.getState().turn) Engine.resetInteraction();
        if (Engine.traceSelection(p.q, p.r)) render();
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!isTracing) return;
        const rect = canvas.getBoundingClientRect();
        const p = pixelToHex(e.clientX - rect.left, e.clientY - rect.top);
        if (Engine.traceSelection(p.q, p.r)) render();
    });

    window.addEventListener('pointerup', () => { if (isTracing) { isTracing = false; Engine.finalizeSelection(); render(); } });
    
    document.getElementById('btn-reset').onclick = () => { Engine.init(); render(); };
    const cycle = (d) => { Engine.cyclePath(d); render(); };
    document.querySelectorAll('[id^=btn-prev]').forEach(b => b.onclick = () => cycle(-1));
    document.querySelectorAll('[id^=btn-next]').forEach(b => b.onclick = () => cycle(1));
    const exec = () => { if (Engine.execute()) render(); };
    document.getElementById('btn-execute-top').onclick = exec;
    document.getElementById('btn-execute-bottom').onclick = exec;

    Engine.init();
});