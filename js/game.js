const gameData = {
    categories: [
        { id: 1, name: "الكويت", image: "images/categories/kuwait.webp" },
        { id: 2, name: "كرة الكويت", image: "images/categories/kuwait-football.webp" },
        { id: 3, name: "الافنيوز", image: "images/categories/kuwait-evenus.webp" },
        { id: 4, name: "وزارة الداخليه", image: "images/categories/police-kuwait.webp" },
        { id: 5, name: "مطاعم الكويت", image: "images/categories/kuwait-marts.webp" },
        { id: 6, name: "أهل البحر", image: "images/categories/sea.png" },
        { id: 7, name: "عالم الساعات", image: "images/categories/watches.png" },
        { id: 8, name: "بلاك ليست", image: "images/categories/misbaha.webp" },
        { id: 9, name: "رؤساء الدول", image: "images/categories/presidents.png" },
        { id: 10, name: "أعلام", image: "images/categories/flags.png" }
    ],
    
    questions: {
        1: {
            200: [
                { text: "ما هي الكلمة المعكوسة لـ 'مدرسة'؟", answer: "اردسم", image: null },
                { text: "ما عكس كلمة 'سعيد'؟", answer: "دياس", image: null }
            ],
            400: [
                { text: "ما هو عكس جملة 'الطالب مجتهد'؟", answer: "دتهجم بلاطلا", image: null }
            ],
            600: [
                { text: "ما هو عكس 'العلم نور' مع الحفاظ على المعنى؟", answer: "رون ملعلا", image: null }
            ]
        },
        2: {
            200: [
                { text: "ما هي هذه الصورة؟", answer: "برج خليفة", image: "images/questions/burj-khalifa.jpg" }
            ],
            400: [
                { text: "من هو هذا الشخص؟", answer: "كريستيانو رونالدو", image: "images/questions/ronaldo.jpg" }
            ],
            600: [
                { text: "ما اسم هذا الاختراع؟", answer: "الطابعة ثلاثية الأبعاد", image: "images/questions/3d-printer.jpg" }
            ]
        }
    },
    
    currentGame: {
        name: "",
        team1: { name: "", players: 0, score: 0 },
        team2: { name: "", players: 0, score: 0 },
        selectedCategories: [],
        currentPlayer: 0,
        usedHelps: { team1: [], team2: [] }
    },
    
    gameState: "board",
    timerInterval: null,
    timeLeft: 30,
    currentQuestion: null
};

// متغير لتتبع الأسئلة المجابة
let answeredQuestions = [];

// تهيئة الصفحة عند التحميل
document.addEventListener('DOMContentLoaded', function() {
    if (document.querySelector('.home-page')) {
        initHomePage();
    } else if (document.querySelector('.create-game-page')) {
        initCreateGamePage();
    } else if (document.querySelector('.game-board-container')) {
        initGamePage();
    }
});

// وظائف الصفحة الرئيسية
function initHomePage() {
    const currencyOptions = document.querySelectorAll('.currency-option');
    currencyOptions.forEach(option => {
        option.addEventListener('click', function() {
            currencyOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            localStorage.setItem('selectedCurrency', this.dataset.currency);
        });
    });
    
    const savedCurrency = localStorage.getItem('selectedCurrency');
    if (savedCurrency) {
        document.querySelector(`.currency-option[data-currency="${savedCurrency}"]`).classList.add('selected');
    }
}

// وظائف صفحة إنشاء اللعبة
function initCreateGamePage() {
    renderCategories();
    
    const countryCards = document.querySelectorAll('.country-card');
    countryCards.forEach(card => {
        card.addEventListener('click', function() {
            countryCards.forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            gameData.currentGame.country = this.dataset.country;
        });
    });
    
    document.querySelector('.categories-grid').addEventListener('click', function(e) {
        if (e.target.closest('.category-card')) {
            const categoryCard = e.target.closest('.category-card');
            const categoryId = parseInt(categoryCard.dataset.categoryId);
            
            if (categoryCard.classList.contains('selected')) {
                categoryCard.classList.remove('selected');
                gameData.currentGame.selectedCategories = gameData.currentGame.selectedCategories.filter(id => id !== categoryId);
            } else {
                if (gameData.currentGame.selectedCategories.length < 6) {
                    categoryCard.classList.add('selected');
                    gameData.currentGame.selectedCategories.push(categoryId);
                } else {
                    alert('لقد وصلت إلى الحد الأقصى (6 فئات). يجب إلغاء تحديد إحدى الفئات أولاً.');
                }
            }
            
            checkStartGameConditions();
        }
    });
    
    document.getElementById('gameName').addEventListener('input', checkStartGameConditions);
    document.getElementById('team1Name').addEventListener('input', checkStartGameConditions);
    document.getElementById('team2Name').addEventListener('input', checkStartGameConditions);
    
    document.getElementById('startGameBtn').addEventListener('click', startNewGame);
    
    document.getElementById('categorySearch').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const categoryCards = document.querySelectorAll('.category-card');
        
        categoryCards.forEach(card => {
            const categoryName = card.dataset.categoryName.toLowerCase();
            card.style.display = categoryName.includes(searchTerm) ? 'block' : 'none';
        });
    });
}

// وظائف صفحة اللعبة
function initGamePage() {
    loadGameData();
    renderGameBoard();
    
    document.getElementById('timerControlBtn').addEventListener('click', toggleTimer);
    
    document.querySelector('.team1-answer-btn').addEventListener('click', () => answerQuestion('team1'));
    document.querySelector('.team2-answer-btn').addEventListener('click', () => answerQuestion('team2'));
    document.querySelector('.no-answer-btn').addEventListener('click', () => answerQuestion('none'));
    
    document.querySelectorAll('.help-option-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const helpType = this.dataset.help;
            const team = this.closest('.team1-panel') ? 'team1' : 'team2';
            useHelp(helpType, team);
        });
    });
    
    document.querySelector('.close-modal-btn').addEventListener('click', closeHelpModal);
    document.querySelector('.play-again-btn').addEventListener('click', resetGame);
    document.querySelector('.new-game-btn').addEventListener('click', () => {
        window.location.href = 'create-game.html';
    });
    document.querySelector('.exit-btn').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    // إضافة معالجات أحداث لأزرار التحكم بالنقاط
    document.querySelectorAll('.plus-btn, .minus-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const team = this.dataset.team;
            const isPlus = this.classList.contains('plus-btn');
            const points = isPlus ? 100 : -100;
            
            gameData.currentGame[team].score += points;
            updateScores();
            localStorage.setItem('currentQuizGame', JSON.stringify(gameData.currentGame));
        });
    });

    // إضافة معالجات أحداث لأزرار إعادة التعيين
    document.querySelectorAll('.score-reset-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const team = this.dataset.team;
            if (confirm(`هل تريد إعادة تعيين نقاط ${team === 'team1' ? 'الفريق الأول' : 'الفريق الثاني'} إلى الصفر؟`)) {
                gameData.currentGame[team].score = 0;
                updateScores();
                localStorage.setItem('currentQuizGame', JSON.stringify(gameData.currentGame));
            }
        });
    });
}

function updateScores() {
    document.getElementById('team1Score').textContent = gameData.currentGame.team1.score;
    document.getElementById('team2Score').textContent = gameData.currentGame.team2.score;
    document.getElementById('team1ControlScore').textContent = gameData.currentGame.team1.score;
    document.getElementById('team2ControlScore').textContent = gameData.currentGame.team2.score;
}

// عرض الفئات في صفحة الإنشاء
function renderCategories() {
    const categoriesGrid = document.querySelector('.categories-grid');
    categoriesGrid.innerHTML = '';
    
    gameData.categories.forEach(category => {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.dataset.categoryId = category.id;
        categoryCard.dataset.categoryName = category.name;
        
        categoryCard.innerHTML = `
            <img src="${category.image}" alt="${category.name}">
            <h3>${category.name}</h3>
            <div class="category-check"><i class="fas fa-check"></i></div>
        `;
        
        categoriesGrid.appendChild(categoryCard);
    });
}

// التحقق من إمكانية بدء اللعبة
function checkStartGameConditions() {
    const startBtn = document.getElementById('startGameBtn');
    const gameName = document.getElementById('gameName').value.trim();
    const team1Name = document.getElementById('team1Name').value.trim();
    const team2Name = document.getElementById('team2Name').value.trim();
    
    startBtn.disabled = !(gameData.currentGame.selectedCategories.length === 6 && 
                         gameName && team1Name && team2Name);
}

// بدء لعبة جديدة
function startNewGame() {
    gameData.currentGame.name = document.getElementById('gameName').value.trim();
    gameData.currentGame.team1.name = document.getElementById('team1Name').value.trim();
    gameData.currentGame.team2.name = document.getElementById('team2Name').value.trim();
    gameData.currentGame.team1.players = parseInt(document.getElementById('team1Players').value);
    gameData.currentGame.team2.players = parseInt(document.getElementById('team2Players').value);
    gameData.currentGame.team1.score = 0;
    gameData.currentGame.team2.score = 0;
    gameData.currentGame.currentPlayer = 1;
    
    localStorage.setItem('currentQuizGame', JSON.stringify(gameData.currentGame));
    window.location.href = 'game.html';
}

// تحميل بيانات اللعبة
function loadGameData() {
    const savedGame = localStorage.getItem('currentQuizGame');
    if (savedGame) {
        gameData.currentGame = JSON.parse(savedGame);
        
        document.getElementById('currentGameName').textContent = gameData.currentGame.name;
        document.getElementById('team1NameDisplay').textContent = gameData.currentGame.team1.name;
        document.getElementById('team2NameDisplay').textContent = gameData.currentGame.team2.name;
        document.getElementById('team1Score').textContent = gameData.currentGame.team1.score;
        document.getElementById('team2Score').textContent = gameData.currentGame.team2.score;
        document.getElementById('team1ControlScore').textContent = gameData.currentGame.team1.score;
        document.getElementById('team2ControlScore').textContent = gameData.currentGame.team2.score;
        updateCurrentPlayerDisplay();
    }
}

function updateCurrentPlayerDisplay() {
    const team = gameData.currentGame.currentPlayer <= gameData.currentGame.team1.players ? 
                 gameData.currentGame.team1.name : gameData.currentGame.team2.name;
    document.getElementById('currentPlayerName').textContent = 
        `الفريق ${gameData.currentGame.currentPlayer} من ${team}`;
}

// عرض لوحة اللعبة
// تعديل دالة renderGameBoard()
function renderGameBoard() {
    const categoriesBoard = document.querySelector('.categories-board');
    categoriesBoard.innerHTML = '';

    gameData.currentGame.selectedCategories.forEach(categoryId => {
        const category = gameData.categories.find(c => c.id === categoryId);

        const categoryColumn = document.createElement('div');
        categoryColumn.className = 'category-column';
        categoryColumn.style.display = 'grid';
        categoryColumn.style.gridTemplateColumns = 'auto 1fr auto';
        categoryColumn.style.alignItems = 'center';
        categoryColumn.style.gap = 'clamp(16px, 3vw, 40px)';

        /* ===== نقاط اليسار ===== */
        const leftPoints = document.createElement('div');
        leftPoints.className = 'points-column left';

        [200, 400, 600].forEach(points => {
            const pointOption = document.createElement('div');
            pointOption.className = 'point-option';
            pointOption.textContent = points;
            pointOption.dataset.categoryId = categoryId;
            pointOption.dataset.points = points;
            pointOption.addEventListener('click', selectQuestion);

            /* تكبير النقاط */
            pointOption.style.height = 'clamp(50px, 8vw, 100px)';
            pointOption.style.minWidth = 'clamp(50px, 8vw, 100px)';
            pointOption.style.fontSize = 'clamp(16px, 2.5vw, 28px)';

            const questionKey = `${categoryId}-${points}`;
            if (answeredQuestions.includes(questionKey)) {
                pointOption.style.opacity = '0.5';
                pointOption.style.cursor = 'not-allowed';
            }

            leftPoints.appendChild(pointOption);
        });

        /* ===== صورة الفئة ===== */
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.innerHTML = `
            <img src="${category.image}" alt="${category.name}" class="category-image">
            <div class="category-title">${category.name}</div>
        `;

        const img = categoryCard.querySelector('.category-image');
        img.style.width = 'clamp(100px, 15vw, 250px)';
        img.style.height = 'auto';
        img.style.objectFit = 'contain';

        /* ===== نقاط اليمين ===== */
        const rightPoints = document.createElement('div');
        rightPoints.className = 'points-column right';

        [200, 400, 600].forEach(points => {
            const pointOption = document.createElement('div');
            pointOption.className = 'point-option';
            pointOption.textContent = points;
            pointOption.dataset.categoryId = categoryId;
            pointOption.dataset.points = points;
            pointOption.addEventListener('click', selectQuestion);

            pointOption.style.height = 'clamp(50px, 8vw, 100px)';
            pointOption.style.minWidth = 'clamp(50px, 8vw, 100px)';
            pointOption.style.fontSize = 'clamp(16px, 2.5vw, 28px)';

            const questionKey = `${categoryId}-${points}`;
            if (answeredQuestions.includes(questionKey)) {
                pointOption.style.opacity = '0.5';
                pointOption.style.cursor = 'not-allowed';
            }

            rightPoints.appendChild(pointOption);
        });

        /* ===== الترتيب النهائي ===== */
        categoryColumn.appendChild(leftPoints);
        categoryColumn.appendChild(categoryCard);
        categoryColumn.appendChild(rightPoints);

        categoriesBoard.appendChild(categoryColumn);
    });
}


// اختيار سؤال
function selectQuestion(e) {
    const categoryId = parseInt(e.target.dataset.categoryId);
    const points = parseInt(e.target.dataset.points);
    
    // التحقق إذا كان السؤال قد تمت الإجابة عليه مسبقاً
    const questionKey = `${categoryId}-${points}`;
    if (answeredQuestions.includes(questionKey)) {
        alert('لقد تمت الإجابة على هذا السؤال مسبقاً');
        return;
    }
    
    if (gameData.timerInterval) {
        clearInterval(gameData.timerInterval);
        gameData.timerInterval = null;
    }
    
    const categoryQuestions = gameData.questions[categoryId][points];
    const randomIndex = Math.floor(Math.random() * categoryQuestions.length);
    gameData.currentQuestion = categoryQuestions[randomIndex];
    gameData.currentQuestion.categoryId = categoryId;
    gameData.currentQuestion.points = points;
    
    // عرض السؤال
    const category = gameData.categories.find(c => c.id === categoryId);
    document.getElementById('questionCategoryName').textContent = category.name;
    document.getElementById('questionCategoryImage').src = category.image;
    document.getElementById('questionPoints').textContent = points;
    document.getElementById('questionText').textContent = gameData.currentQuestion.text;
    
    const questionImageContainer = document.getElementById('questionImageContainer');
    if (gameData.currentQuestion.image) {
        document.getElementById('questionImage').src = gameData.currentQuestion.image;
        questionImageContainer.style.display = 'block';
    } else {
        questionImageContainer.style.display = 'none';
    }
    
    resetTimer();
    startTimer();
    
    document.querySelector('.categories-board').style.display = 'none';
    document.getElementById('questionDisplay').style.display = 'block';
    gameData.gameState = 'question';
    
    document.querySelectorAll('.help-option-btn[data-help="hole"]').forEach(btn => {
        btn.disabled = gameData.currentGame.usedHelps.team1.includes('hole') || 
                       gameData.currentGame.usedHelps.team2.includes('hole');
    });
}

function initGamePage() {
    loadGameData();
    renderGameBoard();
    
    document.getElementById('timerControlBtn').addEventListener('click', toggleTimer);
    
    document.querySelector('.team1-answer-btn').addEventListener('click', () => answerQuestion('team1'));
    document.querySelector('.team2-answer-btn').addEventListener('click', () => answerQuestion('team2'));
    document.querySelector('.no-answer-btn').addEventListener('click', () => answerQuestion('none'));
    
    document.querySelectorAll('.help-option-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const helpType = this.dataset.help;
            const team = this.closest('.team1-panel') ? 'team1' : 'team2';
            useHelp(helpType, team);
        });
    });
    
    document.querySelector('.close-modal-btn').addEventListener('click', closeHelpModal);
    document.querySelector('.play-again-btn').addEventListener('click', resetGame);
    document.querySelector('.new-game-btn').addEventListener('click', () => {
        window.location.href = 'create-game.html';
    });
    document.querySelector('.exit-btn').addEventListener('click', () => {
        window.location.href = 'index.html';
    });
    
    // إضافة معالجات أحداث لأزرار التحكم بالنقاط
    document.querySelectorAll('.plus-btn, .minus-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const team = this.dataset.team;
            const isPlus = this.classList.contains('plus-btn');
            const points = isPlus ? 100 : -100;
            
            gameData.currentGame[team].score += points;
            updateScores();
            localStorage.setItem('currentQuizGame', JSON.stringify(gameData.currentGame));
        });
    });

    // إضافة معالجات أحداث للأزرار الجديدة
    document.querySelector('.end-game-btn').addEventListener('click', endGame);
    document.querySelector('.back-to-board-btn').addEventListener('click', backToBoard);
    document.querySelector('.exit-game-btn').addEventListener('click', exitGame);
}

// إنهاء اللعبة وإظهار الفائز
function endGame() {
    if (confirm('هل أنت متأكد أنك تريد إنهاء اللعبة الآن؟ سيتم إعلان الفائز بناءً على النقاط الحالية.')) {
        showWinner();
    }
}

// الرجوع إلى لوحة اللعبة
function backToBoard() {
    if (gameData.gameState === 'question') {
        if (confirm('هل تريد حقاً العودة إلى اللوحة؟ سيتم فقدان السؤال الحالي.')) {
            pauseTimer();
            document.getElementById('questionDisplay').style.display = 'none';
            document.querySelector('.categories-board').style.display = 'grid';
            gameData.gameState = 'board';
        }
    }
}

// الخروج من اللعبة
function exitGame() {
    if (confirm('هل تريد الخروج من اللعبة؟ سيتم فقدان التقدم الحالي.')) {
        window.location.href = 'index.html';
    }
}

// الرجوع إلى لوحة اللعبة
function backToBoard() {
    if (gameData.gameState === 'question') {
        if (confirm('هل تريد حقاً العودة إلى اللوحة؟ سيتم فقدان السؤال الحالي.')) {
            // إيقاف المؤقت إذا كان يعمل
            pauseTimer();
            
            // إخفاء قسم عرض السؤال
            document.getElementById('questionDisplay').style.display = 'none';
            
            // إظهار لوحة الأسئلة
            document.querySelector('.categories-board').style.display = 'grid';
            
            // تغيير حالة اللعبة إلى اللوحة
            gameData.gameState = 'board';
            
            // تحديث واجهة المستخدم لإظهار أن السؤال لم يعد نشطاً
            document.querySelector('.current-player-display').style.opacity = '1';
        }
    } else {
        alert('أنت بالفعل في لوحة اللعبة الرئيسية');
    }
}

document.querySelector('.back-to-board-btn').addEventListener('click', backToBoard);

console.log('حالة اللعبة الحالية:', gameData.gameState);
console.log('عنصر لوحة الأسئلة:', document.querySelector('.categories-board'));
console.log('عنصر عرض السؤال:', document.getElementById('questionDisplay'));

// التحكم في المؤقت
function startTimer() {
    gameData.timeLeft = 30;
    document.getElementById('timerDisplay').textContent = gameData.timeLeft;
    
    gameData.timerInterval = setInterval(() => {
        gameData.timeLeft--;
        document.getElementById('timerDisplay').textContent = gameData.timeLeft;
        
        if (gameData.timeLeft <= 0) {
            pauseTimer();
            answerQuestion('none');
        }
    }, 1000);
}

function pauseTimer() {
    clearInterval(gameData.timerInterval);
    gameData.timerInterval = null;
}

function resetTimer() {
    pauseTimer();
    gameData.timeLeft = 30;
    document.getElementById('timerDisplay').textContent = gameData.timeLeft;
    document.getElementById('timerControlBtn').innerHTML = '<i class="fas fa-pause"></i>';
}

function toggleTimer() {
    if (gameData.timerInterval) {
        pauseTimer();
        document.getElementById('timerControlBtn').innerHTML = '<i class="fas fa-play"></i>';
    } else {
        startTimer();
        document.getElementById('timerControlBtn').innerHTML = '<i class="fas fa-pause"></i>';
    }
}

// استخدام وسيلة مساعدة
function useHelp(helpType, team) {
    if (gameData.currentGame.usedHelps[team].includes(helpType)) {
        alert('لقد استخدمت هذه الوسيلة بالفعل!');
        return;
    }
    
    gameData.currentGame.usedHelps[team].push(helpType);
    
    const helpModal = document.getElementById('helpModal');
    const helpModalTitle = document.getElementById('helpModalTitle');
    const helpModalContent = document.getElementById('helpModalContent');
    
    switch (helpType) {
        case 'doubleAnswer':
            helpModalTitle.textContent = 'جواب جوابين';
            helpModalContent.innerHTML = `
                <p>يمكنك اختيار إجابتين من الخيارات التالية:</p>
                <div class="double-answers">
                    <div class="answer-option">${gameData.currentQuestion.answer}</div>
                    <div class="answer-option">${getRandomAnswer()}</div>
                    <div class="answer-option">${getRandomAnswer()}</div>
                </div>
            `;
            break;
            
        case 'hole':
            helpModalTitle.textContent = 'الحفرة';
            helpModalContent.innerHTML = `
                <p>إذا أجبت إجابة صحيحة، سيتم خصم ${gameData.currentQuestion.points} نقطة من الفريق المنافس!</p>
                <div class="hole-animation">
                    <i class="fas fa-digging"></i>
                </div>
            `;
            break;
    }
    
    helpModal.style.display = 'block';
    document.querySelectorAll(`.${team}-panel .help-option-btn[data-help="${helpType}"]`).forEach(btn => {
        btn.disabled = true;
    });
}

// إغلاق نافذة المساعدة
function closeHelpModal() {
    document.getElementById('helpModal').style.display = 'none';
}

// الإجابة على السؤال
function answerQuestion(team) {
    pauseTimer();
    
    let points = gameData.currentQuestion.points;
    
    if (team !== 'none') {
        const opposingTeam = team === 'team1' ? 'team2' : 'team1';
        
        if (gameData.currentGame.usedHelps[team].includes('hole')) {
            gameData.currentGame[opposingTeam].score -= points;
            points *= 2;
        }
    }
    
    if (team === 'team1') {
        gameData.currentGame.team1.score += points;
    } else if (team === 'team2') {
        gameData.currentGame.team2.score += points;
    }
    
    updateScores();
    
    // إضافة السؤال إلى قائمة الأسئلة المجابة
    const questionKey = `${gameData.currentQuestion.categoryId}-${gameData.currentQuestion.points}`;
    answeredQuestions.push(questionKey);
    
    // الانتقال للاعب التالي
    gameData.currentGame.currentPlayer++;
    const totalPlayers = gameData.currentGame.team1.players + gameData.currentGame.team2.players;
    if (gameData.currentGame.currentPlayer > totalPlayers) {
        gameData.currentGame.currentPlayer = 1;
    }
    
    updateCurrentPlayerDisplay();
    checkGameEnd();
    
    document.getElementById('questionDisplay').style.display = 'none';
    document.querySelector('.categories-board').style.display = 'grid';
    gameData.gameState = 'board';
    
    localStorage.setItem('currentQuizGame', JSON.stringify(gameData.currentGame));
}

// التحقق من نهاية اللعبة
function checkGameEnd() {
    const totalQuestions = gameData.currentGame.selectedCategories.length * 3; // 3 أسئلة لكل فئة
    if (answeredQuestions.length >= totalQuestions) {
        showWinner();
    }
}

// عرض الفائز
function showWinner() {
    const winnerModal = document.getElementById('winnerModal');
    const winnerTeamName = document.getElementById('winnerTeamName');
    const winnerScore = document.getElementById('winnerScore');
    
    if (gameData.currentGame.team1.score > gameData.currentGame.team2.score) {
        winnerTeamName.textContent = gameData.currentGame.team1.name;
        winnerScore.textContent = gameData.currentGame.team1.score;
        gameData.currentGame.winner = 'team1';
    } else if (gameData.currentGame.team2.score > gameData.currentGame.team1.score) {
        winnerTeamName.textContent = gameData.currentGame.team2.name;
        winnerScore.textContent = gameData.currentGame.team2.score;
        gameData.currentGame.winner = 'team2';
    } else {
        winnerTeamName.textContent = 'تعادل';
        winnerScore.textContent = gameData.currentGame.team1.score;
        gameData.currentGame.winner = 'none';
    }
    
    winnerModal.style.display = 'block';
    gameData.gameState = 'winner';
    
    // حفظ اللعبة في السجل بعد عرض الفائز
    saveGameToHistory(gameData.currentGame);
}

function saveGameToHistory(game) {
    // جلب السجل الحالي من localStorage أو إنشاء جديد
    let gamesHistory = JSON.parse(localStorage.getItem('quizGamesHistory')) || [];
    
    // إضافة اللعبة الحالية إلى السجل
    gamesHistory.unshift({
        id: gamesHistory.length + 1,
        name: game.name,
        date: new Date().toISOString().split('T')[0],
        team1: {
            name: game.team1.name,
            score: game.team1.score,
            players: Array(game.team1.players).fill('لاعب') // يمكن استبدالها بأسماء حقيقية
        },
        team2: {
            name: game.team2.name,
            score: game.team2.score,
            players: Array(game.team2.players).fill('لاعب') // يمكن استبدالها بأسماء حقيقية
        },
        categories: game.selectedCategories.map(id => {
            const category = gameData.categories.find(c => c.id === id);
            return category ? category.name : 'غير معروف';
        }),
        duration: '30 دقيقة', // يمكن حساب المدة الفعلية
        winner: game.winner || 'none'
    });
    
    // حفظ السجل المحدث في localStorage
    localStorage.setItem('quizGamesHistory', JSON.stringify(gamesHistory));
}


// إعادة تعيين اللعبة
function resetGame() {
    answeredQuestions = [];
    gameData.currentGame.team1.score = 0;
    gameData.currentGame.team2.score = 0;
    gameData.currentGame.currentPlayer = 1;
    gameData.currentGame.usedHelps = { team1: [], team2: [] };
    
    updateScores();
    updateCurrentPlayerDisplay();
    renderGameBoard();
    
    document.querySelectorAll('.help-option-btn').forEach(btn => {
        btn.disabled = false;
    });
    
    document.getElementById('winnerModal').style.display = 'none';
    gameData.gameState = 'board';
    
    localStorage.setItem('currentQuizGame', JSON.stringify(gameData.currentGame));
}

// وظائف مساعدة
function getRandomAnswer() {
    if (gameData.currentQuestion.image) {
        const imageAnswers = ["صورة مدينة", "مبنى شهير", "شخصية مشهورة", "اختراع حديث", "أثر تاريخي"];
        return imageAnswers[Math.floor(Math.random() * imageAnswers.length)];
    } else {
        const textAnswers = ["إجابة صحيحة", "إجابة خاطئة", "ربما هذا", "لا أعرف", "جرب مرة أخرى"];
        return textAnswers[Math.floor(Math.random() * textAnswers.length)];
    }
}