window.ENGINE_VERSION = "v3.4.0";

const Engine = (function() {
    let board = new Map();
    let turn = 1; 
    let scores = { 1: 0, 2: 0 };
    let selection = []; 
    let legalPaths = []; 
    let pathIndex = -1;

    const DIRS = [{q:1, r:0}, {q:1, r:-1}, {q:0, r:-1}, {q:-1, r:0}, {q:-1, r:1}, {q:0, r:1}];

    function init() {
        board.clear();
        for (let q = -4; q <= 4; q++) {
            for (let r = -4; r <= 4; r++) {
                if (Math.abs(q + r) <= 4) {
                    let val = 0;
                    if (q <= -3) val = 1; 
                    else if (q == -2 && r >= 0 && r <= 2) val = 1;
                    else if (q >= 3) val = 2;
                    else if (q == 2 && r <= 0 && r >= -2) val = 2;
                    board.set(`${q},${r}`, val);
                }
            }
        }
        turn = 1;
        scores = { 1: 0, 2: 0 };
        resetInteraction();
    }

    function resetInteraction() {
        selection = []; legalPaths = []; pathIndex = -1;
    }

    function traceSelection(q, r) {
        if (!board.has(`${q},${r}`) || board.get(`${q},${r}`) !== turn) return false;
        if (selection.some(s => s.q === q && s.r === r)) return false;

        if (selection.length === 0) {
            selection.push({q, r});
            return true;
        }

        const last = selection[selection.length - 1];
        if (Math.abs(q - last.q) > 1 || Math.abs(r - last.r) > 1 || Math.abs((q - last.q) + (r - last.r)) > 1) return false;

        if (selection.length >= 2) {
            const prev = selection[selection.length - 2];
            // 轉彎判定
            if ((q - last.q !== last.q - prev.q) || (r - last.r !== last.r - prev.r)) {
                selection = [{q: last.q, r: last.r}, {q, r}];
            } else {
                selection.push({q, r});
                if (selection.length > 3) selection.shift();
            }
        } else {
            selection.push({q, r});
        }
        return true;
    }

    function finalizeSelection() {
        if (selection.length === 0) return;
        legalPaths = [];
        DIRS.forEach(dir => {
            const path = validateMove(selection, dir);
            if (path) legalPaths.push(path);
        });
        // 依據類型排序：火車(in-line)優先
        legalPaths.sort((a, b) => a.type === 'in-line' ? -1 : 1);
        pathIndex = legalPaths.length > 0 ? 0 : -1;
    }

    function validateMove(sel, dir) {
        if (sel.length === 0) return null;
        let isInline = true;
        if (sel.length > 1) {
            const lineDir = { q: sel[1].q - sel[0].q, r: sel[1].r - sel[0].r };
            isInline = (lineDir.q === dir.q && lineDir.r === dir.r) || (lineDir.q === -dir.q && lineDir.r === -dir.r);
        }

        if (isInline) {
            const head = getHead(sel, dir);
            const targetQ = head.q + dir.q, targetR = head.r + dir.r;
            if (!board.has(`${targetQ},${targetR}`)) return null;
            const tVal = board.get(`${targetQ},${targetR}`);
            if (tVal === 0) return { type: 'in-line', dir, sel };
            if (tVal === turn) return null;
            let oppC = 1, nQ = targetQ + dir.q, nR = targetR + dir.r;
            while (board.get(`${nQ},${nR}`) === (3 - turn)) { oppC++; nQ += dir.q; nR += dir.r; }
            if (sel.length > oppC && (board.get(`${nQ},${nR}`) === 0 || !board.has(`${nQ},${nR}`))) {
                return { type: 'in-line', dir, sel, push: oppC };
            }
        } else {
            if (sel.every(s => board.get(`${s.q + dir.q},${s.r + dir.r}`) === 0)) return { type: 'broadside', dir, sel };
        }
        return null;
    }

    function getHead(sel, dir) {
        return sel.reduce((p, c) => ((c.q - p.q) * dir.q + (c.r - p.r) * dir.r) > 0 ? c : p);
    }

    return { 
        init, traceSelection, finalizeSelection, resetInteraction,
        cyclePath: (delta) => { if(legalPaths.length) pathIndex = (pathIndex + delta + legalPaths.length) % legalPaths.length; },
        execute: () => {
            if (pathIndex === -1) return false;
            const p = legalPaths[pathIndex];
            if (p.type === 'in-line' && p.push) {
                for (let i = p.push; i >= 1; i--) {
                    const h = getHead(p.sel, p.dir);
                    const oQ = h.q + p.dir.q * i, oR = h.r + p.dir.r * i;
                    const nQ = oQ + p.dir.q, nR = oR + p.dir.r;
                    if (board.has(`${nQ},${nR}`)) board.set(`${nQ},${nR}`, 3-turn);
                    else scores[turn]++;
                }
            }
            const newPos = p.sel.map(s => ({ q: s.q + p.dir.q, r: s.r + p.dir.r }));
            p.sel.forEach(s => board.set(`${s.q},${s.r}`, 0));
            newPos.forEach(np => board.set(`${np.q},${np.r}`, turn));
            turn = 3 - turn; resetInteraction(); return true;
        },
        getState: () => ({ board, turn, scores, selection, legalPaths, pathIndex }) 
    };
})();