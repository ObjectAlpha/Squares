/* Diagonal Squares — Web (HTML/CSS/JS)
 * Теперь поддерживается выбор размера поля 5..40.
 * Размер применяется при нажатии «Новая игра».
 */

(() => {
  const ORTHO_DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
  const DIAG_DIRS = [[1,1],[1,-1],[-1,1],[-1,-1]];

  // Баннер ошибок для быстрой диагностики
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

  class SimpleAI {
    constructor(rng=Math){ this.rng = rng; }
    immediatePoints(board,x,y){ return 1 + board.orthogonalNeighborsCount(x,y); }
    chooseMove(board, me){
      const legal = board.legalMoves(me.pid);
      if(legal.length===0) return null;
      let bestScore = null;
      let bestMoves = [];
      for(const [x,y] of legal){
        const immediate = this.immediatePoints(board,x,y);
        const clone = board.clone();
        clone.grid[y][x] = me.pid;
        const oppMovesCount = clone.legalMoves(me.otherId()).length;
        const score = immediate*10 - oppMovesCount;
        if(bestScore===null || score>bestScore){
          bestScore = score;
          bestMoves = [[x,y]];
        }else if(score===bestScore){
          bestMoves.push([x,y]);
        }
      }
      const i = Math.floor(this.rng.random()*bestMoves.length);
      return bestMoves[i];
    }
  }

  // --- UI elements ---
  const elBoard = document.getElementById("board");
  const elInfo  = document.getElementById("info");
  const elNew   = document.getElementById("btnNew");
  const elPass  = document.getElementById("btnPass");
  const elAI    = document.getElementById("chkAI");
  const elSize  = document.getElementById("sizeInput");

  let game = new Game();       // стартуем с 40×40 по умолчанию
  let ai = new SimpleAI();
  let vsAI = true;

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
  }

  function updateInfo(extra=""){
    const p = game.currentPlayer();
    let txt = `Поле: ${game.board.size}×${game.board.size}    Ход: ${p.name} (P${p.pid})    Счёт — P1: ${game.scores[1]} | P2: ${game.scores[2]}`;
    txt += vsAI ? "    Режим: Человек vs Компьютер (P2)" : "    Режим: Человек vs Человек";
    if(extra) txt += "    " + extra;
    elInfo.textContent = txt;
  }

  function onCellClick(e){
    if(game.isGameOver()) return;
    const cell = e.currentTarget;
    const x = parseInt(cell.dataset.x,10);
    const y = parseInt(cell.dataset.y,10);

    if(vsAI) game.p2 = new Player(2,"Компьютер",true);
    const cur = game.currentPlayer();
    if(cur.pid===2 && cur.isComputer){
      return;
    }
    if(!game.board.isValidMove(cur.pid, x, y)){
      updateInfo("Недопустимый ход (проверьте правило диагонали / пустоту клетки).");
      return;
    }
    const pts = game.makeMove(x,y);
    renderCells();
    updateInfo(`Ход принят (+${pts}).`);

    if(game.tryPassIfNeeded()){
      if(game.isGameOver()) return finishGame();
      updateInfo("Пас. Ход передан.");
    }
    maybeAIMove();
  }

  function maybeAIMove(){
    if(!vsAI) return;
    if(game.isGameOver()) return;
    const cur = game.currentPlayer();
    if(cur.pid!==2) return;
    if(!cur.isComputer) game.p2 = new Player(2,"Компьютер",true);

    if(game.tryPassIfNeeded()){
      if(game.isGameOver()) return finishGame();
      updateInfo("Компьютер пасует. Ход передан.");
      return;
    }
    setTimeout(() => {
      const move = ai.chooseMove(game.board, game.p2);
      if(!move){
        if(game.tryPassIfNeeded()){
          if(game.isGameOver()) return finishGame();
          updateInfo("Компьютер пасует. Ход передан.");
        }
        return;
      }
      const [x,y] = move;
      const pts = game.makeMove(x,y);
      renderCells();
      updateInfo(`Компьютер ходит в (${x},${y}) (+${pts}).`);
      if(game.tryPassIfNeeded()){
        if(game.isGameOver()) return finishGame();
        updateInfo("Пас. Ход передан.");
      }
    }, 120);
  }

  function finishGame(){
    renderCells();
    const w = game.winner();
    let msg;
    if(w===null){
      msg = `Ничья! Итоговый счёт: P1=${game.scores[1]}  P2=${game.scores[2]}`;
    }else{
      msg = `Победил P${w}! Итоговый счёт: P1=${game.scores[1]}  P2=${game.scores[2]}`;
    }
    updateInfo("Игра завершена.");
    alert(msg);
  }

  function newGame(){
    const S = desiredSize();
    game = new Game(new Board(S));
    buildGrid();
    renderCells();
    updateInfo("Новая партия начата.");
    if(vsAI && game.currentPlayer().pid===2) maybeAIMove();
  }

  // События
  elNew.addEventListener("click", () => newGame());
  elPass.addEventListener("click", () => {
    if(game.isGameOver()) return;
    if(game.hasLegalMoves(game.currentPlayer())){
      alert("Пас невозможен: у вас есть легальные ходы.");
      return;
    }
    if(game.tryPassIfNeeded()){
      if(game.isGameOver()) return finishGame();
      updateInfo("Пас. Ход передан.");
      maybeAIMove();
    }
  });
  elAI.addEventListener("change", (e) => {
    vsAI = !!e.target.checked;
    updateInfo();
  });
  elSize.addEventListener("change", () => {
    // Ничего не перерисовываем до «Новая игра», только валидируем ввод
    desiredSize();
  });

  // Первая отрисовка (40×40 по умолчанию)
  buildGrid();
  renderCells();
  updateInfo();
})();