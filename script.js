/* Diagonal Squares — Web
 * Секундомер партии + современный визуал.
 * Режимы: HH, HCPU, CPUCPU; AI уровни: 1..3; пауза CPUCPU=0.7с.
 */
(() => {
  const ORTHO_DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
  const DIAG_DIRS = [[1,1],[1,-1],[-1,1],[-1,-1]];
  const AI_VS_AI_DELAY_MS = 700;
  const HUMAN_AI_DELAY_MS = 120;

  // Показывать JS-ошибки баннером (для быстрой диагностики)
  window.addEventListener("error", (e) => {
    const bar = document.createElement("div");
    bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;background:#fee2e2;color:#7f1d1d;padding:6px 10px;font:12px/1.2 monospace;z-index:9999;border-top:1px solid #fecaca;";
    bar.textContent = "JS error: " + (e.message || "unknown");
    document.body.appendChild(bar);
  });

  class Player {
    constructor(pid, name, isComputer=false){
      this.pid = pid; this.name = name; this.isComputer = isComputer;
    }
    otherId(){ return this.pid === 1 ? 2 : 1; }
  }

  class Board {
    constructor(size=40){
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
    isValidMove(playerId, x, y){
      if(!this.inBounds(x,y)) return false;
      if(!this.isEmpty(x,y)) return false;
      if(this.hasDiagOccupied(x,y)) return false;
      return true;
    }
    orthogonalNeighborsCount(x,y){
      let c=0;
      for(const [dx,dy] of ORTHO_DIRS){
        const nx=x+dx, ny=y+dy;
        if(this.inBounds(nx,ny) && this.grid[ny][nx]!==0) c++;
      }
      return c;
    }
    legalMoves(playerId){
      const res=[];
      for(let y=0;y<this.size;y++){
        for(let x=0;x<this.size;x++){
          if(this.grid[y][x]===0 && !this.hasDiagOccupied(x,y)){
            res.push([x,y]);
          }
        }
      }
      return res;
    }
    placeAndScore(playerId, x, y){
      if(!this.isValidMove(playerId,x,y)) throw new Error("Недопустимый ход");
      this.grid[y][x] = playerId;
      return 1 + this.orthogonalNeighborsCount(x,y);
    }
    clone(){
      const b = new Board(this.size);
      for(let y=0;y<this.size;y++){
        b.grid[y] = this.grid[y].slice();
      }
      return b;
    }
  }

  class Game {
    constructor(board, p1, p2){
      this.board = board || new Board(40);
      this.p1 = p1 || new Player(1,"Игрок 1",false);
      this.p2 = p2 || new Player(2,"Игрок 2",false);
      this.current = this.p1;
      this.scores = {1:0, 2:0};
      this._consecutivePasses = 0;
    }
    currentPlayer(){ return this.current; }
    otherPlayer(){ return this.current.pid===1 ? this.p2 : this.p1; }
    hasLegalMoves(player){ return this.board.legalMoves(player.pid).length>0; }
    makeMove(x,y){
      const pts = this.board.placeAndScore(this.current.pid, x, y);
      this.scores[this.current.pid] += pts;
      this._consecutivePasses = 0;
      this.current = this.otherPlayer();
      return pts;
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
  }

  class AI {
    constructor(rng=Math){ this.rng = rng; }
    immediatePoints(board,x,y){ return 1 + board.orthogonalNeighborsCount(x,y); }
    chooseMove(board, me, level){
      const legal = board.legalMoves(me.pid);
      if(legal.length===0) return null;
      if(level === 1){
        const i = Math.floor(this.rng.random()*legal.length);
        return legal[i];
      } else if(level === 2){
        let best = []; let bestPts = -1;
        for(const [x,y] of legal){
          const p = this.immediatePoints(board,x,y);
          if(p > bestPts){ bestPts = p; best = [[x,y]]; }
          else if(p === bestPts){ best.push([x,y]); }
        }
        const i = Math.floor(this.rng.random()*best.length);
        return best[i];
      } else {
        const center = (n)=> (n-1)/2;
        const cx = center(board.size), cy = center(board.size);
        let bestScore = -1e9; let best = [];
        for(const [x,y] of legal){
          const pts = this.immediatePoints(board,x,y);
          const clone = board.clone();
          clone.grid[y][x] = me.pid;
          const oppMoves = clone.legalMoves(me.otherId()).length;
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

  const elNew   = document.getElementById("btnNew");
  const elPass  = document.getElementById("btnPass");
  const elSize  = document.getElementById("sizeInput");
  const elMode  = document.getElementById("modeSelect");
  const elL1    = document.getElementById("aiLevelP1");
  const elL2    = document.getElementById("aiLevelP2");

  let game = new Game();
  let ai = new AI();
  let aiLoopId = null;

  // Секундомер
  let startTimeMs = Date.now();
  let timerId = null;

  function clampSize(n){
    if(Number.isNaN(n)) return 40;
    n = Math.floor(n);
    if(n < 5) n = 5;
    if(n > 40) n = 40;
    return n;
  }
  function desiredSize(){
    const n = parseInt(elSize.value, 10);
    const c = clampSize(n);
    if(c !== n) elSize.value = String(c);
    return c;
  }
  function currentMode(){ return elMode.value; }
  function p1Level(){ return parseInt(elL1.value, 10) || 1; }
  function p2Level(){ return parseInt(elL2.value, 10) || 1; }

  function formatDuration(ms){
    const total = Math.floor(ms/1000);
    const s = total % 60;
    const m = Math.floor(total/60) % 60;
    const h = Math.floor(total/3600);
    const pad = (n)=> (n<10? "0"+n : ""+n);
    return h>0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
  function startTimer(){
    stopTimer();
    startTimeMs = Date.now();
    elTimer.textContent = "00:00";
    timerId = setInterval(() => {
      elTimer.textContent = formatDuration(Date.now() - startTimeMs);
    }, 1000);
  }
  function stopTimer(){
    if(timerId){ clearInterval(timerId); timerId = null; }
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
    const nodes = elBoard.children;
    for(let y=0;y<S;y++){
      for(let x=0;x<S;x++){
        const idx = (y+1)*(S+1) + (x+1);
        const el = nodes[idx];
        if(!el.classList.contains("cell")) continue;
        el.classList.remove("p1","p2");
        const pid = game.board.grid[y][x];
        if(pid===1) el.classList.add("p1");
        else if(pid===2) el.classList.add("p2");
      }
    }
    elScoreP1.textContent = game.scores[1];
    elScoreP2.textContent = game.scores[2];
    elTurnWho.textContent = "P"+game.currentPlayer().pid;
    const mode = currentMode();
    elModeChip.textContent = (mode==="HH")? "Человек↔Человек" : (mode==="HCPU")? "Человек↔Компьютер" : "Компьютер↔Компьютер";
  }

  function onCellClick(e){
    if(game.isGameOver()) return;
    if(currentMode()==="CPUCPU") return;
    const cell = e.currentTarget;
    const x = parseInt(cell.dataset.x,10);
    const y = parseInt(cell.dataset.y,10);

    if(currentMode()==="HCPU"){
      game.p2 = new Player(2,"Компьютер",true);
    } else {
      game.p2.isComputer = false;
      game.p1.isComputer = false;
    }
    const cur = game.currentPlayer();
    if(currentMode()==="HCPU" && cur.pid===2) return;

    if(!game.board.isValidMove(cur.pid, x, y)){
      document.getElementById("btnPass").animate([{transform:"scale(1)"},{transform:"scale(1.05)"},{transform:"scale(1)"}], {duration:220});
      return;
    }
    game.makeMove(x,y);
    renderCells();

    if(game.tryPassIfNeeded()){
      if(game.isGameOver()) return finishGame();
    }
    maybeAutoPlay();
  }

  function stopAiLoop(){
    if(aiLoopId !== null){ clearTimeout(aiLoopId); aiLoopId = null; }
  }

  function finishGame(){
    renderCells();
    stopTimer();
    const elapsed = formatDuration(Date.now() - startTimeMs);
    const w = game.winner();
    let msg;
    if(w===null){
      msg = `Ничья! Итоговый счёт: P1=${game.scores[1]}  P2=${game.scores[2]}\nДлительность партии: ${elapsed}`;
    }else{
      msg = `Победил P${w}! Итоговый счёт: P1=${game.scores[1]}  P2=${game.scores[2]}\nДлительность партии: ${elapsed}`;
    }
    alert(msg);
    stopAiLoop();
  }

  function maybeAutoPlay(){
    if(game.isGameOver()){ stopAiLoop(); return; }
    const mode = currentMode();

    if(mode==="HCPU"){
      const cur = game.currentPlayer();
      if(cur.pid!==2) { renderCells(); return; }
      const lvl = p2Level();
      if(game.tryPassIfNeeded()){
        if(game.isGameOver()) return finishGame();
        renderCells();
        return;
      }
      setTimeout(() => {
        const move = ai.chooseMove(game.board, game.p2, lvl);
        if(!move){
          if(game.tryPassIfNeeded()){
            if(game.isGameOver()) return finishGame();
          }
          renderCells();
          return;
        }
        game.makeMove(...move);
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
        if(game.isGameOver()){ stopAiLoop(); return; }
        const cur = game.currentPlayer();
        const lvl = (cur.pid===1) ? p1Level() : p2Level();
        if(game.tryPassIfNeeded()){
          if(game.isGameOver()) return finishGame();
          renderCells();
          return maybeAutoPlay();
        }
        const move = ai.chooseMove(game.board, cur, lvl);
        if(!move){
          if(game.tryPassIfNeeded()){
            if(game.isGameOver()) return finishGame();
            renderCells();
          }
          return maybeAutoPlay();
        }
        game.makeMove(...move);
        renderCells();
        if(game.tryPassIfNeeded()){
          if(game.isGameOver()) return finishGame();
          renderCells();
        }
        return maybeAutoPlay();
      }, AI_VS_AI_DELAY_MS);
    }
  }

  function newGame(){
    stopAiLoop();
    const S = desiredSize();
    game = new Game(new Board(S));
    const mode = currentMode();
    if(mode==="HCPU"){
      game.p2 = new Player(2, "Компьютер", true);
      game.p1 = new Player(1, "Игрок 1", false);
    } else if(mode==="CPUCPU"){
      game.p1 = new Player(1, "Компьютер 1", true);
      game.p2 = new Player(2, "Компьютер 2", true);
    } else {
      game.p1 = new Player(1, "Игрок 1", false);
      game.p2 = new Player(2, "Игрок 2", false);
    }
    buildGrid();
    renderCells();
    startTimer();
    maybeAutoPlay();
  }

  // События
  document.getElementById("btnNew").addEventListener("click", () => newGame());
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
  document.getElementById("sizeInput").addEventListener("change", () => desiredSize());
  document.getElementById("modeSelect").addEventListener("change", () => { stopAiLoop(); renderCells(); });
  document.getElementById("aiLevelP1").addEventListener("change", () => renderCells());
  document.getElementById("aiLevelP2").addEventListener("change", () => renderCells());

  // Первая отрисовка
  buildGrid();
  renderCells();
  startTimer(); // если пользователь начнёт сразу
})();