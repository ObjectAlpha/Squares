/* Diagonal Squares — Web (end-on-no-enhanced-move) */
(() => {
  const ORTHO_DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
  const DIAG_DIRS = [[1,1],[1,-1],[-1,1],[-1,-1]];
  const AI_VS_AI_DELAY_MS = 700;
  const HUMAN_AI_DELAY_MS = 120;

  window.addEventListener("error", (e) => {
    const bar = document.createElement("div");
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;background:#fee2e2;color:#7f1d1d;padding:6px 10px;font:12px/1.2 monospace;z-index:9999;border-top:1px solid #fecaca;";
    bar.textContent = "JS error: " + (e.message || "unknown");
    document.body.appendChild(bar);
  });

  class Player {
    constructor(pid, name, isComputer=false){ this.pid = pid; this.name = name; this.isComputer = isComputer; }
    otherId(){ return this.pid === 1 ? 2 : 1; }
  }

  class Board {
    constructor(size=15){
      this.size = size;
      this.grid = Array.from({length:size}, () => Array(size).fill(0));
    }
    inBounds(x,y){ return x>=0 && y>=0 && x<this.size && y<this.size; }
    isEmpty(x,y){ return this.grid[y][x] === 0; }
    hasDiagOccupied(x,y){
      for (const [dx,dy] of DIAG_DIRS){
        const nx=x+dx, ny=y+dy;
        if(this.inBounds(nx,ny) && this.grid[ny][nx]!==0) return true;
      }
      return false;
    }
    hasOrthOccupied(x,y){
      for (const [dx,dy] of ORTHO_DIRS){
        const nx=x+dx, ny=y+dy;
        if(this.inBounds(nx,ny) && this.grid[ny][nx]!==0) return true;
      }
      return false;
    }
    orthogonalNeighborsCount(x,y){
      let c=0;
      for(const [dx,dy] of ORTHO_DIRS){
        const nx=x+dx, ny=y+dy;
        if(this.inBounds(nx,ny) && this.grid[ny][nx]!==0) c++;
      }
      return c;
    }
    legalEmpties(){
      const res=[];
      for(let y=0;y<this.size;y++){
        for(let x=0;x<this.size;x++){
          if(this.grid[y][x]===0) res.push([x,y]);
        }
      }
      return res;
    }
    placeAndScore(playerId, x, y){
      if(!this.inBounds(x,y) || !this.isEmpty(x,y)) throw new Error("Недопустимый ход");
      this.grid[y][x] = playerId;
      return 1 + this.orthogonalNeighborsCount(x,y);
    }
    clone(){
      const b = new Board(this.size);
      for(let y=0;y<this.size;y++){ b.grid[y] = this.grid[y].slice(); }
      return b;
    }
  }

  class Game {
    constructor(board, p1, p2){
      this.board = board || new Board(15);
      this.p1 = p1 || new Player(1,"Игрок 1",false);
      this.p2 = p2 || new Player(2,"Игрок 2",false);
      this.current = this.p1;
      this.scores = {1:0, 2:0};
      this._consecutivePasses = 0;
      this.p1HasMoved = false;
      this.p2HasMoved = false;
      this.p1FirstMove = null;
      // periodic rule
      this.ruleIntervalSec = 5;
      this.ruleActive = false;
      this.ruleForPid = null;
      this.nextRuleTs = null;
      this.enhancedImpossible = false;
      // custom rules
      this.maxLineLen = this.board.size;
      this.diagEnabled = true;
    }
    currentPlayer(){ return this.current; }
    otherPlayer(){ return this.current.pid===1 ? this.p2 : this.p1; }
    setLineLimit(n){ this.maxLineLen = Math.max(1, Math.min(this.board.size, n|0)); }
    setDiagEnabled(flag){ this.diagEnabled = !!flag; }
    isOrthAdj(a,b){ return a && b && ((Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1])) === 1); }

    _exceedsLineLimit(x,y){
      const g = this.board.grid, S = this.board.size, L = this.maxLineLen;
      let len = 1;
      for(let xx=x-1; xx>=0 && g[y][xx]!==0; xx--) len++;
      for(let xx=x+1; xx<S && g[y][xx]!==0; xx++) len++;
      if(len > L) return true;
      len = 1;
      for(let yy=y-1; yy>=0 && g[yy][x]!==0; yy--) len++;
      for(let yy=y+1; yy<S && g[yy][x]!==0; yy++) len++;
      return len > L;
    }
    _violatesP2FirstAdjacency(playerId, x, y){
      if(playerId !== 2) return false;
      if(this.p2HasMoved) return false;
      if(!this.p1HasMoved || !this.p1FirstMove) return false;
      return this.isOrthAdj([x,y], this.p1FirstMove);
    }
    _violatesPeriodicRule(playerId, x, y){
      if(!this.ruleActive) return false;
      if(this.ruleForPid !== playerId) return false;
      return this.board.hasOrthOccupied(x,y);
    }
    isValidMoveFor(playerId, x, y){
      if(!(this.board.inBounds(x,y) && this.board.isEmpty(x,y))) return false;
      if(this.diagEnabled && this.board.hasDiagOccupied(x,y)) return false;
      if(this._violatesPeriodicRule(playerId, x, y)) return false;
      if(this._violatesP2FirstAdjacency(playerId, x, y)) return false;
      if(this._exceedsLineLimit(x, y)) return false;
      return true;
    }
    legalMovesFor(playerId){
      let moves = this.board.legalEmpties();
      if(this.diagEnabled){
        moves = moves.filter(([x,y]) => !this.board.hasDiagOccupied(x,y));
      }
      if(this.ruleActive && this.ruleForPid === playerId){
        moves = moves.filter(([x,y]) => !this.board.hasOrthOccupied(x,y));
      }
      if(playerId===2 && !this.p2HasMoved && this.p1HasMoved && this.p1FirstMove){
        const [fx,fy] = this.p1FirstMove;
        moves = moves.filter(([x,y]) => (Math.abs(x-fx)+Math.abs(y-fy)) !== 1);
      }
      moves = moves.filter(([x,y]) => !this._exceedsLineLimit(x,y));
      return moves;
    }
    // Moves that satisfy enhancement (when active). If diag is OFF, require also no diag adjacency.
    enhancedMovesFor(playerId){
      if(!this.ruleActive || this.ruleForPid !== playerId) return this.legalMovesFor(playerId);
      let moves = this.legalMovesFor(playerId);
      if(!this.diagEnabled){
        moves = moves.filter(([x,y]) => !this.board.hasDiagOccupied(x,y));
      }
      return moves;
    }
    hasLegalMoves(player){ return this.legalMovesFor(player.pid).length>0; }

    makeMove(x,y){
      const pid = this.current.pid;
      const pts = this.board.placeAndScore(pid, x, y);
      if(pid===1 && !this.p1HasMoved){ this.p1HasMoved = true; this.p1FirstMove = [x,y]; }
      else if(pid===2 && !this.p2HasMoved){ this.p2HasMoved = true; }
      this.scores[pid] += pts;
      this._consecutivePasses = 0;
      let ruleReset = false;
      if(this.ruleActive && this.ruleForPid === pid){
        this.ruleActive = false; this.ruleForPid = null;
        ruleReset = true;
      }
      this.current = this.otherPlayer();
      this.enhancedImpossible = false; // будет пересчитано при следующем срабатывании
      return { pts, ruleReset };
    }

    tryPassIfNeeded(){
      if(!this.hasLegalMoves(this.current)){
        this._consecutivePasses += 1;
        this.current = this.otherPlayer();
        return true;
      }
      return false;
    }
    isGameOver(){ return this._consecutivePasses >= 2; }
    winner(){
      if(!this.isGameOver()) return null;
      if(this.scores[1] > this.scores[2]) return 1;
      if(this.scores[2] > this.scores[1]) return 2;
      return null;
    }
    setRuleIntervalSec(sec){ this.ruleIntervalSec = sec; }
    scheduleNextRule(nowMs){ this.nextRuleTs = nowMs + this.ruleIntervalSec*1000; }
    pollRule(nowMs){
      if(!this.ruleActive && this.nextRuleTs!==null && nowMs >= this.nextRuleTs){
        this.ruleActive = true;
        this.ruleForPid = this.current.pid;
        // Проверяем немедленно: есть ли вообще ходы, удовлетворяющие усилению
        const em = this.enhancedMovesFor(this.current.pid);
        this.enhancedImpossible = (em.length === 0);
      }
    }
    clone(){
      const g2 = new Game(this.board.clone(), new Player(1,this.p1.name,this.p1.isComputer), new Player(2,this.p2.name,this.p2.isComputer));
      g2.current = (this.current.pid===1) ? g2.p1 : g2.p2;
      g2.scores = {1:this.scores[1], 2:this.scores[2]};
      g2._consecutivePasses = this._consecutivePasses;
      g2.p1HasMoved = this.p1HasMoved;
      g2.p2HasMoved = this.p2HasMoved;
      g2.p1FirstMove = this.p1FirstMove ? [this.p1FirstMove[0], this.p1FirstMove[1]] : null;
      g2.ruleIntervalSec = this.ruleIntervalSec;
      g2.ruleActive = this.ruleActive;
      g2.ruleForPid = this.ruleForPid;
      g2.nextRuleTs = this.nextRuleTs;
      g2.maxLineLen = this.maxLineLen;
      g2.diagEnabled = this.diagEnabled;
      g2.enhancedImpossible = this.enhancedImpossible;
      return g2;
    }
  }

  class AI {
    constructor(rng=Math){ this.rng = rng; }
    immediatePoints(board,x,y){ return 1 + board.orthogonalNeighborsCount(x,y); }
    _oppMovesAfter(game, me, x, y){
      const sim = game.clone();
      sim.board.grid[y][x] = me.pid;
      if(me.pid===1 && !sim.p1HasMoved){ sim.p1HasMoved = true; sim.p1FirstMove = [x,y]; }
      if(me.pid===2 && !sim.p2HasMoved){ sim.p2HasMoved = true; }
      if(sim.ruleActive && sim.ruleForPid === me.pid){ sim.ruleActive = false; sim.ruleForPid = null; }
      sim.current = (me.pid===1) ? sim.p2 : sim.p1;
      return sim.legalMovesFor(sim.current.pid).length;
    }
    chooseMove(game, me, level){
      const legal = game.legalMovesFor(me.pid);
      if(legal.length===0) return null;
      if(level === 1){
        const i = Math.floor(this.rng.random()*legal.length);
        return legal[i];
      } else if(level === 2){
        let best = []; let bestPts = -1;
        for(const [x,y] of legal){
          const p = this.immediatePoints(game.board,x,y);
          if(p > bestPts){ bestPts = p; best = [[x,y]]; }
          else if(p === bestPts){ best.push([x,y]); }
        }
        const i = Math.floor(this.rng.random()*best.length);
        return best[i];
      } else {
        const center = (n)=> (n-1)/2;
        const cx = center(game.board.size), cy = center(game.board.size);
        let bestScore = -1e9; let best = [];
        for(const [x,y] of legal){
          const pts = this.immediatePoints(game.board,x,y);
          const oppMoves = this._oppMovesAfter(game, me, x, y);
          let score = pts*10 - oppMoves;
          const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
          score += -0.01*(dx+dy);
          if(score > bestScore){ bestScore = score; best = [[x,y]]; }
          else if(score === bestScore){ best.push([x,y]); }
        }
        const i = Math.floor(this.rng.random()*best.length);
        return best[i];
      }
    }
  }

  // DOM
  const elBoard = document.getElementById("board");
  const elScoreP1 = document.getElementById("scoreP1");
  const elScoreP2 = document.getElementById("scoreP2");
  const elTimer = document.getElementById("timer");
  const elTurnWho = document.getElementById("turnWho");
  const elModeChip = document.getElementById("modeChip");
  const elCountChip = document.getElementById("countChip");
  const elCountdown = document.getElementById("countdown");

  const elNew   = document.getElementById("btnNew");
  const elEnd   = document.getElementById("btnEnd");
  const elPass  = document.getElementById("btnPass");
  const elSize  = document.getElementById("sizeInput");
  const elMode  = document.getElementById("modeSelect");
  const elL1    = document.getElementById("aiLevelP1");
  const elL2    = document.getElementById("aiLevelP2");
  const elInt   = document.getElementById("ruleInterval");
  const elLim   = document.getElementById("lineLimit");
  const elDiag  = document.getElementById("diagRule");

  let game = new Game(new Board(parseInt(elSize.value,10) || 15));
  game.p1.name = "Игрок 1";
  game.p2.name = "Игрок 2";

  let ai = new AI();
  let aiLoopId = null;
  let startTimeMs = null;
  let uiTimerId = null;

  function formatDuration(ms){
    const total = Math.floor(ms/1000);
    const s = total % 60;
    const m = Math.floor(total/60) % 60;
    const h = Math.floor(total/3600);
    const pad = (n)=> (n<10? "0"+n : ""+n);
    return h>0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }

  function startUITimers(){
    stopUITimers();
    startTimeMs = Date.now();
    elTimer.textContent = "00:00";
    game.scheduleNextRule(Date.now());
    uiTimerId = setInterval(() => {
      const now = Date.now();
      elTimer.textContent = formatDuration(now - startTimeMs);
      game.pollRule(now);
      // Автозавершение: усиление активно и нет ни одного «усиленного» хода
      if(game.ruleActive && game.ruleForPid === game.current.pid && game.enhancedImpossible){
        finishGame();
        return;
      }
      updateCountdown(now);
    }, 100);
  }
  function stopUITimers(){
    if(uiTimerId){ clearInterval(uiTimerId); uiTimerId = null; }
  }

  function updateCountdown(nowMs){
    if(game.ruleActive){
      elCountdown.textContent = "0.0с";
      elCountChip.classList.add("red");
    } else if(game.nextRuleTs!==null){
      const rem = Math.max(0, game.nextRuleTs - nowMs);
      const secs = Math.ceil(rem/100) / 10;
      elCountdown.textContent = secs.toFixed(1) + "с";
      if(rem <= 0) elCountChip.classList.add("red");
      else elCountChip.classList.remove("red");
    } else {
      elCountdown.textContent = "—";
      elCountChip.classList.remove("red");
    }
  }

  function buildGrid(){
    const S = game.board.size;
    elBoard.style.gridTemplateColumns = `repeat(${S+1}, var(--cell-size))`;
    elBoard.innerHTML = "";
    for(let y=0;y<=S;y++){
      for(let x=0;x<=S;x++){
        const div = document.createElement("div");
        if(x===0 && y===0){
          div.className = "label corner";
        } else if(y===0){
          div.className = "label";
          div.textContent = x-1>=0 ? (x-1) : "";
        } else if(x===0){
          div.className = "label";
          div.textContent = y-1>=0 ? (y-1) : "";
        } else {
          div.className = "cell";
          div.dataset.x = String(x-1);
          div.dataset.y = String(y-1);
          div.addEventListener("click", onCellClick);
        }
        elBoard.appendChild(div);
      }
    }
  }

  
  function renderCells(){
    const S = game.board.size;
    // Собираем множество «усиленных» допустимых ходов для подсветки
    let enhSet = null;
    if(game.ruleActive && game.ruleForPid === game.current.pid){
      try{
        const moves = game.enhancedMovesFor(game.current.pid);
        enhSet = new Set(moves.map(([x,y]) => `${x},${y}`));
      }catch(e){ enhSet = null; }
    }

    const nodes = elBoard.children;
    for(let y=0;y<S;y++){
      for(let x=0;x<S;x++){
        const idx = (y+1)*(S+1) + (x+1);
        const el = nodes[idx];
        if(!el.classList.contains("cell")) continue;
        el.classList.remove("p1","p2","enh");
        const pid = game.board.grid[y][x];
        if(pid===1) el.classList.add("p1");
        else if(pid===2) el.classList.add("p2");
        else if(enhSet && enhSet.has(`${x},${y}`)){
          el.classList.add("enh");
        }
      }
    }
    elScoreP1.textContent = game.scores[1];
    elScoreP2.textContent = game.scores[2];
    elTurnWho.textContent = game.currentPlayer().name;
    const mode = currentMode();
    elModeChip.textContent = (mode==="HH")? "Человек↔Человек" : (mode==="HCPU")? "Человек↔Компьютер" : "Компьютер↔Компьютер";
  }
}

  function clampSize(n){ if(Number.isNaN(n)) return 15; n|=0; return Math.max(5, Math.min(40,n)); }
  function clampInt(n){ if(Number.isNaN(n)) return 5; n|=0; return Math.max(5, Math.min(10,n)); }
  function desiredSize(){ const c = clampSize(parseInt(elSize.value,10)); elSize.value = String(c); return c; }
  function desiredInterval(){ const c = clampInt(parseInt(elInt.value,10)); elInt.value = String(c); return c; }
  function desiredLineLimit(){
    const size = clampSize(parseInt(elSize.value,10));
    let v = parseInt(elLim.value,10);
    if(Number.isNaN(v)) v = size;
    v = Math.max(1, Math.min(size, v|0));
    if(v !== parseInt(elLim.value,10)) elLim.value = String(v);
    return v;
  }
  function currentMode(){ return elMode.value; }
  function p1Level(){ return parseInt(elL1.value, 10) || 1; }
  function p2Level(){ return parseInt(elL2.value, 10) || 1; }

  function stopAiLoop(){ if(aiLoopId !== null){ clearTimeout(aiLoopId); aiLoopId = null; } }

  function finishGame(manual=false){
    renderCells();
    stopAiLoop();
    stopUITimers();
    const elapsed = startTimeMs ? formatDuration(Date.now() - startTimeMs) : "00:00";
    const w = game.winner();
    let head = manual ? "Партия завершена досрочно. " : "";
    let msg;
    if(w===null){
      msg = `${head}Ничья! Итоговый счёт: Игрок 1=${game.scores[1]}  Игрок 2=${game.scores[2]}\nДлительность партии: ${elapsed}`;
    } else {
      msg = `${head}Победил Игрок ${w}! Итоговый счёт: Игрок 1=${game.scores[1]}  Игрок 2=${game.scores[2]}\nДлительность партии: ${elapsed}`;
    }
    alert(msg);
    setControlsEnabled(true);
  }

  function maybeAutoPlay(){
    if(game.isGameOver()){ finishGame(); return; }
    const mode = currentMode();

    if(mode==="HCPU"){
      const cur = game.currentPlayer();
      if(cur.pid!==2){ renderCells(); return; }
      const lvl = p2Level();
      if(game.tryPassIfNeeded()){
        if(game.isGameOver()) return finishGame();
        renderCells();
        return;
      }
      setTimeout(() => {
        const move = ai.chooseMove(game, game.p2, lvl);
        if(!move){
          if(game.tryPassIfNeeded()){
            if(game.isGameOver()) return finishGame();
          }
          renderCells();
          return;
        }
        const res = game.makeMove(...move);
        if(res.ruleReset) game.scheduleNextRule(Date.now());
        renderCells();
        if(game.tryPassIfNeeded()){
          if(game.isGameOver()) return finishGame();
        }
        renderCells();
      }, HUMAN_AI_DELAY_MS);
      return;
    }

    if(mode==="CPUCPU"){
      stopAiLoop();
      aiLoopId = setTimeout(() => {
        if(game.isGameOver()) return finishGame();
        const cur = game.currentPlayer();
        const lvl = (cur.pid===1) ? p1Level() : p2Level();
        if(game.tryPassIfNeeded()){
          if(game.isGameOver()) return finishGame();
          renderCells();
          return maybeAutoPlay();
        }
        const move = ai.chooseMove(game, cur, lvl);
        if(!move){
          if(game.tryPassIfNeeded()){
            if(game.isGameOver()) return finishGame();
            renderCells();
          }
          return maybeAutoPlay();
        }
        const res = game.makeMove(...move);
        if(res.ruleReset) game.scheduleNextRule(Date.now());
        renderCells();
        if(game.tryPassIfNeeded()){
          if(game.isGameOver()) return finishGame();
          renderCells();
        }
        return maybeAutoPlay();
      }, AI_VS_AI_DELAY_MS);
    }
  }

  function onCellClick(e){
    if(game.isGameOver()) return;
    if(currentMode()==="CPUCPU") return;
    const x = parseInt(e.currentTarget.dataset.x,10);
    const y = parseInt(e.currentTarget.dataset.y,10);

    if(currentMode()==="HCPU"){
      game.p2 = new Player(2,"Компьютер 2",true);
      game.p1 = new Player(1,"Игрок 1",false);
    } else {
      game.p2.isComputer = false;
      game.p1.isComputer = false;
      game.p2.name = "Игрок 2"; game.p1.name = "Игрок 1";
    }
    const cur = game.currentPlayer();
    if(currentMode()==="HCPU" && cur.pid===2) return;

    if(!game.isValidMoveFor(cur.pid, x, y)){
      document.getElementById("btnPass").animate([{transform:"scale(1)"},{transform:"scale(1.05)"},{transform:"scale(1)"}], {duration:220});
      return;
    }
    const res = game.makeMove(x,y);
    if(res.ruleReset) game.scheduleNextRule(Date.now());
    renderCells();

    if(game.tryPassIfNeeded()){
      if(game.isGameOver()) return finishGame();
    }
    maybeAutoPlay();
  }

  function setControlsEnabled(enabled){
    elSize.disabled = !enabled;
    elMode.disabled = !enabled;
    elL1.disabled = !enabled;
    elL2.disabled = !enabled;
    elInt.disabled = !enabled;
    elLim.disabled = !enabled;
    elDiag.disabled = !enabled;
  }

  function refreshLineLimitMax(){
    const size = clampSize(parseInt(elSize.value,10));
    elLim.max = String(size);
    if(parseInt(elLim.value,10) > size) elLim.value = String(size);
  }

  function newGame(){
    stopAiLoop();
    stopUITimers();
    const S = desiredSize();
    refreshLineLimitMax();
    const interval = desiredInterval();
    const limit = desiredLineLimit();
    const diag = elDiag.checked;

    game = new Game(new Board(S));
    game.setRuleIntervalSec(interval);
    game.setLineLimit(limit);
    game.setDiagEnabled(diag);

    const mode = currentMode();
    if(mode==="HCPU"){
      game.p1 = new Player(1, "Игрок 1", false);
      game.p2 = new Player(2, "Компьютер 2", true);
    } else if(mode==="CPUCPU"){
      game.p1 = new Player(1, "Компьютер 1", true);
      game.p2 = new Player(2, "Компьютер 2", true);
    } else {
      game.p1 = new Player(1, "Игрок 1", false);
      game.p2 = new Player(2, "Игрок 2", false);
    }
    buildGrid();
    renderCells();
    setControlsEnabled(false);
    startUITimers();
    maybeAutoPlay();
  }

  // Events
  document.getElementById("btnNew").addEventListener("click", newGame);
  document.getElementById("btnEnd").addEventListener("click", () => finishGame(true));
  document.getElementById("btnPass").addEventListener("click", () => {
    if(game.isGameOver()) return;
    const mode = currentMode();
    if(mode==="CPUCPU"){ alert("В режиме ИИ↔ИИ пас делает сам ИИ."); return; }
    if(game.hasLegalMoves(game.currentPlayer())){
      alert("Пас невозможен: у вас есть легальные ходы.");
      return;
    }
    if(game.tryPassIfNeeded()){
      if(game.isGameOver()) return finishGame();
      renderCells();
      maybeAutoPlay();
    }
  });
  document.getElementById("sizeInput").addEventListener("change", () => { desiredSize(); refreshLineLimitMax(); });
  document.getElementById("modeSelect").addEventListener("change", () => { stopAiLoop(); renderCells(); });
  document.getElementById("aiLevelP1").addEventListener("change", renderCells);
  document.getElementById("aiLevelP2").addEventListener("change", renderCells);
  document.getElementById("ruleInterval").addEventListener("change", desiredInterval);
  document.getElementById("lineLimit").addEventListener("change", desiredLineLimit);
  document.getElementById("diagRule").addEventListener("change", () => {});

  // First render
  buildGrid();
  renderCells();
})();