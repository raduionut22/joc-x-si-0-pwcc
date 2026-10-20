// Joc X și 0 (Tic-Tac-Toe) Modern & Interactiv
document.addEventListener('DOMContentLoaded', () => {
  // Constante jucători
  const PLAYER_X = 'X';
  const PLAYER_O = '0'; // Folosim caracterul '0'

  // Starea jocului
  let boardState = Array(9).fill(null);
  let currentPlayer = PLAYER_X;
  let isGameActive = true;
  let isAiThinking = false;
  let gameMode = 'ai-hard'; // 'pvp', 'ai-easy', 'ai-hard'
  let soundEnabled = true;

  const WINNING_COMBOS = [
    { combo: [0, 1, 2], line: { x1: 20, y1: 50, x2: 280, y2: 50 } },
    { combo: [3, 4, 5], line: { x1: 20, y1: 150, x2: 280, y2: 150 } },
    { combo: [6, 7, 8], line: { x1: 20, y1: 250, x2: 280, y2: 250 } },
    { combo: [0, 3, 6], line: { x1: 50, y1: 20, x2: 50, y2: 280 } },
    { combo: [1, 4, 7], line: { x1: 150, y1: 20, x2: 150, y2: 280 } },
    { combo: [2, 5, 8], line: { x1: 250, y1: 20, x2: 250, y2: 280 } },
    { combo: [0, 4, 8], line: { x1: 30, y1: 30, x2: 270, y2: 270 } },
    { combo: [2, 4, 6], line: { x1: 270, y1: 30, x2: 30, y2: 270 } }
  ];

  // Scoruri
  let scores = {
    X: 0,
    O: 0,
    draws: 0
  };

  // Elemente DOM
  const cells = document.querySelectorAll('.cell');
  const statusMessage = document.getElementById('statusMessage');
  const scoreXEl = document.getElementById('scoreX');
  const scoreOEl = document.getElementById('scoreO');
  const scoreDrawsEl = document.getElementById('scoreDraws');
  const cardX = document.getElementById('cardX');
  const cardO = document.getElementById('cardO');
  const labelO = cardO.querySelector('.player-label');
  const gameModeSelect = document.getElementById('gameMode');
  const restartBtn = document.getElementById('restartBtn');
  const resetScoreBtn = document.getElementById('resetScoreBtn');
  const soundToggle = document.getElementById('soundToggle');
  const soundIcon = document.getElementById('soundIcon');
  const strikeLineSvg = document.getElementById('strikeLine');
  const lineEl = strikeLineSvg.querySelector('line');

  // Sincronizare selecție inițială mod joc
  if (gameModeSelect) {
    gameMode = gameModeSelect.value;
  }
  updatePlayerLabels();

  // Încărcare scoruri și setări
  loadSavedState();

  // Generator de sunete cu Web Audio API
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(freq, duration = 0.1, type = 'sine', gainVal = 0.15) {
    if (!soundEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  function playSound(name) {
    if (!soundEnabled) return;
    if (name === 'move-x') {
      playTone(520, 0.12, 'sine', 0.2);
    } else if (name === 'move-o') {
      playTone(380, 0.12, 'sine', 0.2);
    } else if (name === 'win') {
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        setTimeout(() => playTone(freq, 0.22, 'triangle', 0.2), idx * 110);
      });
    } else if (name === 'draw') {
      const notes = [360, 320, 280];
      notes.forEach((freq, idx) => {
        setTimeout(() => playTone(freq, 0.18, 'sawtooth', 0.08), idx * 100);
      });
    } else if (name === 'click') {
      playTone(300, 0.06, 'sine', 0.1);
    }
  }

  // Inițializare joc
  function initGame() {
    boardState = Array(9).fill(null);
    currentPlayer = PLAYER_X;
    isGameActive = true;
    isAiThinking = false;

    cells.forEach(cell => {
      cell.textContent = '';
      cell.className = 'cell';
      cell.removeAttribute('data-player');
      cell.disabled = false;
    });

    strikeLineSvg.classList.remove('visible');
    statusMessage.className = 'status-banner';
    updateTurnIndicator();
    updateStatusText();
  }

  function updatePlayerLabels() {
    if (labelO) {
      labelO.textContent = (gameMode === 'pvp') ? 'Jucător 0' : 'Calculator (0)';
    }
  }

  function updateStatusText(override = null) {
    if (override) {
      statusMessage.innerHTML = override;
      return;
    }
    const playerText = currentPlayer === PLAYER_X ? 'X' : '0';
    statusMessage.innerHTML = `Rândul lui <strong>${playerText}</strong>`;
  }

  function updateTurnIndicator() {
    if (!isGameActive) {
      cardX.classList.remove('active-turn');
      cardO.classList.remove('active-turn');
      return;
    }
    if (currentPlayer === PLAYER_X) {
      cardX.classList.add('active-turn');
      cardO.classList.remove('active-turn');
    } else {
      cardX.classList.remove('active-turn');
      cardO.classList.add('active-turn');
    }
  }

  // Gestionare click pe căsuță
  function handleCellClick(event) {
    const clickedCell = event.target.closest('.cell');
    if (!clickedCell) return;

    const cellIndex = parseInt(clickedCell.getAttribute('data-index'), 10);

    // Ignorăm click-ul dacă:
    // - celula e deja ocupată
    // - jocul s-a încheiat
    // - calculatorul gândește mutarea
    // - este rândul calculatorului în mod AI
    if (boardState[cellIndex] !== null || !isGameActive || isAiThinking) {
      return;
    }

    if (gameMode !== 'pvp' && currentPlayer !== PLAYER_X) {
      return;
    }

    // Mutarea jucătorului
    makeMove(cellIndex, currentPlayer);

    // Dacă jocul continuă și este modul vs Calculator
    if (isGameActive && gameMode !== 'pvp' && currentPlayer === PLAYER_O) {
      isAiThinking = true;
      updateStatusText(`Rândul lui <strong>0</strong> (gândește...)`);

      // Dezactivăm temporar tabla
      cells.forEach(c => c.disabled = true);

      setTimeout(() => {
        makeAiMove();
        isAiThinking = false;
      }, 350);
    }
  }

  // Executare mutare
  function makeMove(index, player) {
    boardState[index] = player;
    const cell = cells[index];

    // Afișare text și aplicare clase CSS
    cell.textContent = player;
    cell.setAttribute('data-player', player);
    
    // Aplicăm clasa corespunzătoare pentru culori (x sau o)
    cell.classList.remove('x', 'o', 'zero');
    cell.classList.add(player === PLAYER_X ? 'x' : 'o');
    cell.disabled = true;

    playSound(player === PLAYER_X ? 'move-x' : 'move-o');

    // Verificăm dacă jocul s-a terminat
    const winningInfo = checkWin(boardState, player);

    if (winningInfo) {
      handleGameOver('win', player, winningInfo);
    } else if (isBoardFull(boardState)) {
      handleGameOver('draw');
    } else {
      // Schimbăm tura
      currentPlayer = (currentPlayer === PLAYER_X) ? PLAYER_O : PLAYER_X;
      updateTurnIndicator();
      updateStatusText();
    }
  }

  // Verificare victorie
  function checkWin(board, player) {
    for (const item of WINNING_COMBOS) {
      const [a, b, c] = item.combo;
      if (board[a] === player && board[b] === player && board[c] === player) {
        return item;
      }
    }
    return null;
  }

  function isBoardFull(board) {
    return board.every(cell => cell !== null);
  }

  // Final de joc
  function handleGameOver(result, winner = null, winningInfo = null) {
    isGameActive = false;
    isAiThinking = false;
    updateTurnIndicator();

    if (result === 'win') {
      const isWinnerX = winner === PLAYER_X;
      let winnerLabel;
      if (isWinnerX) {
        winnerLabel = 'Jucătorul X';
      } else {
        winnerLabel = (gameMode === 'pvp') ? 'Jucătorul 0' : 'Calculatorul (0)';
      }

      statusMessage.innerHTML = `🎉 <strong>${winnerLabel}</strong> a câștigat!`;
      statusMessage.className = 'status-banner';
      statusMessage.classList.add(isWinnerX ? 'win-x' : 'win-o');

      // Evidențiere căsuțe câștigătoare
      const winClass = isWinnerX ? 'x' : 'o';
      winningInfo.combo.forEach(idx => {
        cells[idx].classList.add('winning', winClass);
      });

      // Desenare linie de victorie
      drawStrikeLine(winningInfo.line, winner);

      // Actualizare tabelă de scor
      if (isWinnerX) {
        scores.X++;
      } else {
        scores.O++;
      }
      saveScores();
      updateScoreboardDisplay();
      playSound('win');
    } else {
      statusMessage.innerHTML = `🤝 <strong>Egalitate!</strong> Meci foarte strâns.`;
      statusMessage.className = 'status-banner draw';
      scores.draws++;
      saveScores();
      updateScoreboardDisplay();
      playSound('draw');
    }

    // Dezactivăm toate căsuțele la final
    cells.forEach(c => c.disabled = true);
  }

  // Desenare linie de victorie SVG
  function drawStrikeLine(lineCoords, winner) {
    lineEl.setAttribute('x1', lineCoords.x1);
    lineEl.setAttribute('y1', lineCoords.y1);
    lineEl.setAttribute('x2', lineCoords.x2);
    lineEl.setAttribute('y2', lineCoords.y2);

    const color = (winner === PLAYER_X) ? '#38bdf8' : '#f43f5e';
    lineEl.setAttribute('stroke', color);

    strikeLineSvg.classList.remove('visible');
    void lineEl.offsetWidth; // trigger reflow
    strikeLineSvg.classList.add('visible');
  }

  // Mutarea Calculatorului
  function makeAiMove() {
    if (!isGameActive || currentPlayer !== PLAYER_O) return;

    let targetIndex;
    if (gameMode === 'ai-easy') {
      targetIndex = getEasyAiMove();
    } else {
      targetIndex = getBestMoveMinimax(boardState, PLAYER_O);
    }

    // Fallback de siguranță: dacă dintr-un motiv oarecare targetIndex nu e valid
    if (targetIndex === null || targetIndex === undefined || boardState[targetIndex] !== null) {
      const emptySpots = getEmptyIndices(boardState);
      if (emptySpots.length > 0) {
        targetIndex = emptySpots[0];
      }
    }

    if (targetIndex !== null && targetIndex !== undefined && boardState[targetIndex] === null) {
      makeMove(targetIndex, PLAYER_O);
    }

    // Deblocăm celulele libere dacă jocul încă continuă
    if (isGameActive) {
      cells.forEach((cell, idx) => {
        if (boardState[idx] === null) {
          cell.disabled = false;
        }
      });
    }
  }

  function getEmptyIndices(board) {
    const empty = [];
    board.forEach((val, idx) => {
      if (val === null) empty.push(idx);
    });
    return empty;
  }

  // AI Ușor: posibilitate de greșeală, dar blochează parțial
  function getEasyAiMove() {
    const emptyIndices = getEmptyIndices(boardState);
    if (emptyIndices.length === 0) return null;

    // Cu o șansă de 60%, caută victorie sau blocare imediată
    if (Math.random() < 0.6) {
      // 1. Verifică dacă AI-ul poate câștiga dintr-o mutare
      for (const idx of emptyIndices) {
        boardState[idx] = PLAYER_O;
        if (checkWin(boardState, PLAYER_O)) {
          boardState[idx] = null;
          return idx;
        }
        boardState[idx] = null;
      }
      // 2. Verifică dacă trebuie să blocheze jucătorul X
      for (const idx of emptyIndices) {
        boardState[idx] = PLAYER_X;
        if (checkWin(boardState, PLAYER_X)) {
          boardState[idx] = null;
          return idx;
        }
        boardState[idx] = null;
      }
    }

    // Altfel alege o căsuță aleatorie
    const randomIndex = Math.floor(Math.random() * emptyIndices.length);
    return emptyIndices[randomIndex];
  }

  // AI Imposibil: Minimax optimizat cu Alpha-Beta Pruning
  function getBestMoveMinimax(board, aiPlayer) {
    const humanPlayer = PLAYER_X;
    const emptySpots = getEmptyIndices(board);

    if (emptySpots.length === 0) return null;

    // Optimizare deschidere: dacă centrul e liber în prima mutare
    if (emptySpots.length >= 8 && board[4] === null) {
      return 4;
    }

    function minimax(currentBoard, depth, isMaximizing, alpha, beta) {
      if (checkWin(currentBoard, aiPlayer)) {
        return { score: 10 - depth };
      }
      if (checkWin(currentBoard, humanPlayer)) {
        return { score: depth - 10 };
      }
      const availSpots = getEmptyIndices(currentBoard);
      if (availSpots.length === 0) {
        return { score: 0 };
      }

      if (isMaximizing) {
        let maxScore = -Infinity;
        let bestIndex = availSpots[0];

        for (let i = 0; i < availSpots.length; i++) {
          const spot = availSpots[i];
          currentBoard[spot] = aiPlayer;
          const evaluation = minimax(currentBoard, depth + 1, false, alpha, beta);
          currentBoard[spot] = null;

          if (evaluation.score > maxScore) {
            maxScore = evaluation.score;
            bestIndex = spot;
          }
          alpha = Math.max(alpha, maxScore);
          if (beta <= alpha) {
            break; // Pruning
          }
        }
        return { score: maxScore, index: bestIndex };
      } else {
        let minScore = Infinity;
        let bestIndex = availSpots[0];

        for (let i = 0; i < availSpots.length; i++) {
          const spot = availSpots[i];
          currentBoard[spot] = humanPlayer;
          const evaluation = minimax(currentBoard, depth + 1, true, alpha, beta);
          currentBoard[spot] = null;

          if (evaluation.score < minScore) {
            minScore = evaluation.score;
            bestIndex = spot;
          }
          beta = Math.min(beta, minScore);
          if (beta <= alpha) {
            break; // Pruning
          }
        }
        return { score: minScore, index: bestIndex };
      }
    }

    const result = minimax(board, 0, true, -Infinity, Infinity);
    return (result && result.index !== undefined) ? result.index : emptySpots[0];
  }

  // Tabela de scor & stocare
  function updateScoreboardDisplay() {
    scoreXEl.textContent = scores.X;
    scoreOEl.textContent = scores.O;
    scoreDrawsEl.textContent = scores.draws;
  }

  function saveScores() {
    try {
      localStorage.setItem('tictactoe_scores', JSON.stringify(scores));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  function loadSavedState() {
    try {
      const savedScores = localStorage.getItem('tictactoe_scores');
      if (savedScores) {
        const parsed = JSON.parse(savedScores);
        scores.X = parsed.X || 0;
        scores.O = parsed.O || parsed['0'] || 0;
        scores.draws = parsed.draws || 0;
      }
      const savedSound = localStorage.getItem('tictactoe_sound');
      if (savedSound !== null) {
        soundEnabled = savedSound === 'true';
        updateSoundButton();
      }
    } catch (e) {
      console.warn('LocalStorage load error:', e);
    }
    updateScoreboardDisplay();
  }

  function updateSoundButton() {
    soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
    soundToggle.title = soundEnabled ? 'Dezactivează sunetul' : 'Activează sunetul';
  }

  // Ascultători evenimente
  cells.forEach(cell => {
    cell.addEventListener('click', handleCellClick);
  });

  restartBtn.addEventListener('click', () => {
    playSound('click');
    initGame();
  });

  resetScoreBtn.addEventListener('click', () => {
    playSound('click');
    scores = { X: 0, O: 0, draws: 0 };
    saveScores();
    updateScoreboardDisplay();
    initGame();
  });

  gameModeSelect.addEventListener('change', (e) => {
    playSound('click');
    gameMode = e.target.value;
    updatePlayerLabels();
    initGame();
  });

  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    updateSoundButton();
    try {
      localStorage.setItem('tictactoe_sound', soundEnabled.toString());
    } catch (e) {}
    if (soundEnabled) {
      playSound('click');
    }
  });

  // Pornire joc
  initGame();
});
