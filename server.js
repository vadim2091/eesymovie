const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ========== НАСТРОЙКИ ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Сессии для входа
app.use(session({
    secret: 'easy-movie-secret',
    resave: false,
    saveUninitialized: true
}));

// ========== БАЗА ДАННЫХ (JSON) ==========
const DB_PATH = './database.json';

function loadDB() {
    if (!fs.existsSync(DB_PATH)) {
        // Создаём базу с админом
        const defaultDB = {
            users: [
                {
                    id: '1',
                    name: 'Админ',
                    email: 'admin@gmail.com',
                    password: bcrypt.hashSync('123456', 10),
                    role: 'admin',
                    balance: 10000,
                    tasksDone: 0
                }
            ],
            tasks: [],
            withdraws: []
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(defaultDB, null, 2));
        return defaultDB;
    }
    return JSON.parse(fs.readFileSync(DB_PATH));
}

function saveDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ========== API МАРШРУТЫ ==========

// Проверка авторизации
function isAuth(req) {
    return req.session.user ? true : false;
}

function isAdmin(req) {
    return req.session.user && req.session.user.role === 'admin';
}

// Регистрация
app.post('/api/register', (req, res) => {
    const db = loadDB();
    const { name, email, password } = req.body;

    if (db.users.find(u => u.email === email)) {
        return res.json({ success: false, error: 'Email уже используется' });
    }

    const newUser = {
        id: Date.now().toString(),
        name,
        email,
        password: bcrypt.hashSync(password, 10),
        role: 'user',
        balance: 100,
        tasksDone: 0
    };

    db.users.push(newUser);
    saveDB(db);

    req.session.user = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        balance: newUser.balance
    };

    res.json({ 
        success: true, 
        user: req.session.user 
    });
});

// Вход
app.post('/api/login', (req, res) => {
    const db = loadDB();
    const { email, password } = req.body;

    const user = db.users.find(u => u.email === email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.json({ success: false, error: 'Неверный email или пароль' });
    }

    req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        balance: user.balance,
        tasksDone: user.tasksDone
    };

    res.json({ 
        success: true, 
        user: req.session.user 
    });
});

// Выход
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Получить текущего пользователя
app.get('/api/me', (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.json({ user: null });
    }
});

// Получить всех пользователей (только админ)
app.get('/api/users', (req, res) => {
    if (!isAdmin(req)) {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }
    const db = loadDB();
    const users = db.users.map(({ password, ...u }) => u);
    res.json(users);
});

// Добавить баланс пользователю (только админ)
app.post('/api/user/:id/add-balance', (req, res) => {
    if (!isAdmin(req)) {
        return res.status(403).json({ error: 'Доступ запрещён' });
    }
    const db = loadDB();
    const user = db.users.find(u => u.id === req.params.id);
    if (user) {
        user.balance += req.body.amount;
        saveDB(db);
        res.json({ success: true, balance: user.balance });
    } else {
        res.status(404).json({ error: 'Пользователь не найден' });
    }
});

// Статистика
app.get('/api/stats', (req, res) => {
    const db = loadDB();
    res.json({
        users: db.users.length,
        tasks: db.tasks.length,
        withdraws: db.withdraws.filter(w => w.status === 'approved').length
    });
});

// ========== ЗАПУСК ==========
app.listen(PORT, () => {
    console.log(`\n🚀 Сервер запущен!`);
    console.log(`📡 http://localhost:${PORT}`);
    console.log(`👑 Админ: admin@gmail.com / 123456\n`);
});