const myGamesData = {
    games: [
        {
            id: 1,
            name: "مسابقة الثقافة العامة",
            date: "2023-10-15",
            team1: {
                name: "الفريق الأحمر",
                score: 1200,
                players: ["علي الشمري", "أحمد محمد", "فاطمة عبدالله"]
            },
            team2: {
                name: "الفريق الأزرق",
                score: 1500,
                players: ["خالد سعد", "نورة علي", "محمد إبراهيم"]
            },
            categories: ["ثقافة عامة", "جغرافيا", "تاريخ"],
            duration: "45 دقيقة",
            winner: "team2"
        },
        {
            id: 2,
            name: "تحدي الرياضيات",
            date: "2023-10-10",
            team1: {
                name: "الفريق الذهبي",
                score: 1800,
                players: ["علي الشمري", "سارة أحمد", "ياسر محمد"]
            },
            team2: {
                name: "الفريق الفضي",
                score: 1600,
                players: ["مريم خالد", "عبدالله سعد", "نوف عبدالرحمن"]
            },
            categories: ["رياضيات", "ألغاز", "ذكاء"],
            duration: "30 دقيقة",
            winner: "team1"
        }
    ]
};

// تهيئة الصفحة عند التحميل
document.addEventListener('DOMContentLoaded', function() {
    renderGamesList();
    setupEventListeners();
});

// عرض قائمة الألعاب
function renderGamesList() {
    const gamesGrid = document.querySelector('.games-grid');
    gamesGrid.innerHTML = '';
    
    myGamesData.games.forEach(game => {
        const gameCard = document.createElement('div');
        gameCard.className = 'game-card';
        gameCard.dataset.gameId = game.id;
        
        gameCard.innerHTML = `
            <div class="game-header">
                <h3>${game.name}</h3>
                <span class="game-date">${game.date}</span>
            </div>
            <div class="game-teams">
                <div class="team team1 ${game.winner === 'team1' ? 'winner' : ''}">
                    <span class="team-name">${game.team1.name}</span>
                    <span class="team-score">${game.team1.score} نقطة</span>
                </div>
                <div class="vs-circle">VS</div>
                <div class="team team2 ${game.winner === 'team2' ? 'winner' : ''}">
                    <span class="team-name">${game.team2.name}</span>
                    <span class="team-score">${game.team2.score} نقطة</span>
                </div>
            </div>
            <div class="game-details">
                <div class="detail">
                    <i class="fas fa-tags"></i>
                    <span>الفئات: ${game.categories.join('، ')}</span>
                </div>
                <div class="detail">
                    <i class="fas fa-users"></i>
                    <span>${game.team1.players.length} لاعبين ضد ${game.team2.players.length} لاعبين</span>
                </div>
                <div class="detail">
                    <i class="fas fa-clock"></i>
                    <span>مدة اللعبة: ${game.duration}</span>
                </div>
            </div>
            <div class="game-actions">
                <button class="action-btn view-btn"><i class="fas fa-eye"></i> عرض التفاصيل</button>
                <button class="action-btn share-btn"><i class="fas fa-share-alt"></i> مشاركة</button>
            </div>
        `;
        
        gamesGrid.appendChild(gameCard);
    });
}

// إعداد معالجات الأحداث
function setupEventListeners() {
    // تصفية الألعاب عند البحث
    document.getElementById('gameSearch').addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const gameCards = document.querySelectorAll('.game-card');
        
        gameCards.forEach(card => {
            const gameName = card.querySelector('h3').textContent.toLowerCase();
            card.style.display = gameName.includes(searchTerm) ? 'block' : 'none';
        });
    });
    
    // تصفية الألعاب حسب النوع
    document.getElementById('gameFilter').addEventListener('change', function() {
        const filterValue = this.value;
        const gameCards = document.querySelectorAll('.game-card');
        
        gameCards.forEach(card => {
            const isWinner = card.querySelector('.team.winner').classList.contains('team1');
            
            switch(filterValue) {
                case 'win':
                    card.style.display = isWinner ? 'block' : 'none';
                    break;
                case 'lose':
                    card.style.display = !isWinner ? 'block' : 'none';
                    break;
                default:
                    card.style.display = 'block';
            }
        });
    });
    
    // فتح نافذة تفاصيل اللعبة
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const gameCard = this.closest('.game-card');
            const gameId = parseInt(gameCard.dataset.gameId);
            showGameDetails(gameId);
        });
    });
    
    // إغلاق نافذة التفاصيل
    document.querySelector('.close-modal-btn').addEventListener('click', closeGameDetailsModal);
    
    // مشاركة النتائج
    document.querySelectorAll('.share-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const gameCard = this.closest('.game-card');
            const gameName = gameCard.querySelector('h3').textContent;
            shareGameResults(gameName);
        });
    });
}

// عرض تفاصيل اللعبة
function showGameDetails(gameId) {
    const game = myGamesData.games.find(g => g.id === gameId);
    if (!game) return;
    
    const modal = document.getElementById('gameDetailsModal');
    
    // تعبئة البيانات في النافذة
    document.getElementById('modalGameName').textContent = game.name;
    
    // تعبئة بيانات الفريق الأول
    const team1Members = document.querySelector('.modal-team.team1 .team-members');
    team1Members.innerHTML = '';
    game.team1.players.forEach(player => {
        team1Members.innerHTML += `
            <div class="member">
                <i class="fas fa-user"></i>
                <span>${player}</span>
            </div>
        `;
    });
    document.querySelector('.modal-team.team1 .team-score').textContent = `${game.team1.score} نقطة`;
    
    // تعبئة بيانات الفريق الثاني
    const team2Members = document.querySelector('.modal-team.team2 .team-members');
    team2Members.innerHTML = '';
    game.team2.players.forEach(player => {
        team2Members.innerHTML += `
            <div class="member">
                <i class="fas fa-user"></i>
                <span>${player}</span>
            </div>
        `;
    });
    document.querySelector('.modal-team.team2 .team-score').textContent = `${game.team2.score} نقطة`;
    
    // إزالة وإضافة فئة الفائز
    document.querySelector('.modal-team.team1').classList.remove('winner');
    document.querySelector('.modal-team.team2').classList.remove('winner');
    document.querySelector(`.modal-team.${game.winner}`).classList.add('winner');
    
    // تعبئة الإحصائيات
    document.querySelector('.modal-game-stats .stat-card:nth-child(1) p').textContent = 
        game.winner === 'team1' ? game.team1.name : game.team2.name;
    document.querySelector('.modal-game-stats .stat-card:nth-child(2) p').textContent = game.duration;
    document.querySelector('.modal-game-stats .stat-card:nth-child(3) p').textContent = game.date;
    
    // تعبئة الفئات
    const categoriesList = document.querySelector('.categories-list');
    categoriesList.innerHTML = '';
    game.categories.forEach(category => {
        categoriesList.innerHTML += `<span class="category-tag">${category}</span>`;
    });
    
    // عرض النافذة
    modal.style.display = 'flex';
}

// إغلاق نافذة التفاصيل
function closeGameDetailsModal() {
    document.getElementById('gameDetailsModal').style.display = 'none';
}

// مشاركة نتائج اللعبة
function shareGameResults(gameName) {
    // يمكن تطوير هذه الوظيفة لاستخدام واجهات مشاركة وسائل التواصل الاجتماعي
    alert(`تم نسخ رابط مشاركة لعبة "${gameName}" إلى الحافظة`);
    // هنا يمكن إضافة كود المشاركة الفعلي
}

// حفظ اللعبة عند الانتهاء منها (يتم استدعاؤها من game.js عند انتهاء اللعبة)
function saveGameToHistory(gameData) {
    // إنشاء معرف فريد للعبة
    const newId = myGamesData.games.length > 0 ? 
        Math.max(...myGamesData.games.map(g => g.id)) + 1 : 1;
    
    // تحديد الفائز
    let winner = 'none';
    if (gameData.team1.score > gameData.team2.score) {
        winner = 'team1';
    } else if (gameData.team2.score > gameData.team1.score) {
        winner = 'team2';
    }
    
    // إنشاء كائن اللعبة الجديدة
    const newGame = {
        id: newId,
        name: gameData.name,
        date: new Date().toISOString().split('T')[0], // تاريخ اليوم
        team1: {
            name: gameData.team1.name,
            score: gameData.team1.score,
            players: Array(gameData.team1.players).fill('لاعب') // يمكن استبدالها بأسماء حقيقية
        },
        team2: {
            name: gameData.team2.name,
            score: gameData.team2.score,
            players: Array(gameData.team2.players).fill('لاعب') // يمكن استبدالها بأسماء حقيقية
        },
        categories: gameData.selectedCategories.map(id => {
            const category = gameData.categories.find(c => c.id === id);
            return category ? category.name : 'غير معروف';
        }),
        duration: calculateGameDuration(), // تحتاج لتنفيذ هذه الوظيفة
        winner: winner
    };
    
    // إضافة اللعبة إلى القائمة
    myGamesData.games.unshift(newGame); // إضافة في البداية لعرض الأحدث أولاً
    
    // حفظ في localStorage
    localStorage.setItem('quizGamesHistory', JSON.stringify(myGamesData.games));
    
    // إعادة عرض القائمة
    renderGamesList();
}

// حساب مدة اللعبة (وظيفة مساعدة)
function calculateGameDuration() {
    // يمكن تطوير هذه الوظيفة لتتبع المدة الفعلية للعبة
    const minutes = Math.floor(Math.random() * 30) + 15; // قيمة عشوائية كمثال
    return `${minutes} دقيقة`;
}
