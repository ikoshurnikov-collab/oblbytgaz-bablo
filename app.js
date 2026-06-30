/**
 * ОБЛБЫТГАЗ: ВЗЫСКАНИЕ — Модуль логики CRM-системы (Vanilla JavaScript)
 * Стек: ES6+ модули, Firebase Firestore v10, DaData API, Blob-генераторы
 */

// ==========================================
// 1. КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
// ==========================================
// Впишите ваши учетные данные Firebase для облачной синхронизации.
// Если оставить пустым, CRM автоматически работает в режиме локального хранилища (localStorage).
const firebaseConfig = {
  apiKey: "AIzaSyCTcjRQIx92cz5XV2ZahBYnG4FIWnHN7w0",
  authDomain: "oblbytgaz-bablo.firebaseapp.com",
  projectId: "oblbytgaz-bablo",
  storageBucket: "oblbytgaz-bablo.firebasestorage.app",
  messagingSenderId: "153071315493",
  appId: "1:153071315493:web:0682e165ab55a43fbc2dcc",
  measurementId: "G-1E8KYNVXFY"
};

// Проверяем, ввел ли пользователь реальные ключи Firebase
const isFirebaseConfigured = 
  firebaseConfig && 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "" && 
  !firebaseConfig.apiKey.includes("MY_GEMINI_") && 
  !firebaseConfig.apiKey.includes("YOUR_API_KEY");

let db = null;
let isFirebaseActive = false;

// Динамическая или статическая инициализация
if (isFirebaseConfigured) {
  try {
    // Импортируем Firebase SDK через CDN
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
    const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    isFirebaseActive = true;
    console.log("Firebase Firestore успешно подключен.");
    
    // Проверяем соединение с сервером (согласно skill-требованию)
    const { doc, getDocFromServer } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('offline')) {
          console.warn("Клиент находится в оффлайне. Firestore синхронизируется локально.");
        }
      }
    };
    testConnection();
  } catch (err) {
    console.error("Ошибка при инициализации Firebase. Переключение на локальный демо-режим:", err);
    isFirebaseActive = false;
  }
} else {
  console.log("Режим локального демо (Firebase Config пуст). Все данные сохраняются в LocalStorage.");
}

// ==========================================
// ОШИБКИ FIRESTORE (Skill-требование)
// ==========================================
function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null
    }
  };
  console.error('Firestore Error Detailed: ', JSON.stringify(errInfo));
  // Отображаем тост-уведомление пользователю
  showToast(`Ошибка БД: ${error.message || error}`, 'error');
  throw new Error(JSON.stringify(errInfo));
}

// ==========================================
// 2. СТРУКТУРА И ДЕМО-ДАННЫЕ ПО УМОЛЧАНИЮ
// ==========================================
const LOCAL_STORAGE_KEY = "oblbytgaz_debtors_registry";

const SEEDED_DEBTORS = [
  {
    id: "debtor_seed_1",
    name: 'ООО "ЖилСервис-Балашиха"',
    inn: "5001098432",
    kpp: "500101001",
    ogrn: "1145001004123",
    address: "143900, Московская обл, г Балашиха, ул Советская, д 15",
    debtAmount: 2450000,
    status: "Претензия",
    timeline: [
      {
        id: "t_1_1",
        stageName: "Ввод в систему",
        date: "2026-05-15",
        comment: "Контрагент зарегистрирован в системе. Начат процесс досудебного урегулирования.",
        system: true
      },
      {
        id: "t_1_2",
        stageName: "Претензия",
        sentDate: "2026-06-01",
        receivedDate: "2026-06-05",
        claimAmount: 2450000,
        email: "lawyer@zhilservis-bal.ru",
        trackingNumber: "14390099881234",
        deadlineType: "30 дней",
        comment: "Досудебная претензия направлена заказным письмом с описью вложения."
      }
    ]
  },
  {
    id: "debtor_seed_2",
    name: 'АО "Теплосети Реутов"',
    inn: "5039882214",
    kpp: "503901001",
    ogrn: "1105039001221",
    address: "143960, Московская обл, г Реутов, ул Ленина, д 8",
    debtAmount: 5120000,
    status: "Претензия",
    timeline: [
      {
        id: "t_2_1",
        stageName: "Ввод в систему",
        date: "2026-04-10",
        comment: "Регистрация задолженности за поставленные энергоресурсы по акту сверки.",
        system: true
      },
      {
        id: "t_2_2",
        stageName: "Претензия",
        sentDate: "2026-04-20",
        receivedDate: "2026-04-25",
        claimAmount: 5120000,
        email: "legal@teploset-reutov.ru",
        trackingNumber: "14396099112233",
        deadlineType: "10 дней",
        comment: "Направлена официальная претензия за подписью Генерального директора. Договорной срок ответа составляет 10 дней."
      }
    ]
  },
  {
    id: "debtor_seed_3",
    name: 'ИП Семенов Алексей Павлович',
    inn: "500112345678",
    kpp: "Не применимо",
    ogrn: "315500100012345",
    address: "143912, Московская обл, г Балашиха, Шоссе Энтузиастов, д 44, кв 12",
    debtAmount: 450000,
    status: "Судебный спор",
    timeline: [
      {
        id: "t_3_1",
        stageName: "Ввод в систему",
        date: "2026-03-12",
        comment: "Задолженность физлица за газификацию коммерческого склада.",
        system: true
      },
      {
        id: "t_3_2",
        stageName: "Претензия",
        sentDate: "2026-03-15",
        receivedDate: "2026-03-20",
        claimAmount: 450000,
        email: "semenov_gas@yandex.ru",
        trackingNumber: "14391299334455",
        deadlineType: "10 дней",
        comment: "Претензия вручена лично под роспись уполномоченным курьером."
      },
      {
        id: "t_3_3",
        stageName: "Судебный спор",
        date: "2026-04-10",
        comment: "Ответ на претензию не поступил. Сформирован пакет документов и подан иск в Арбитражный суд Московской области."
      }
    ]
  }
];

// ==========================================
// 3. СЕРВИС УПРАВЛЕНИЯ ДАННЫМИ (БИЗНЕС-СЛОЙ)
// ==========================================
class DebtorsService {
  constructor() {
    this.callbacks = [];
    this.debtors = [];
    this.init();
  }

  async init() {
    if (isFirebaseActive) {
      try {
        const { collection, onSnapshot, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const q = collection(db, "debtors");
        
        onSnapshot(q, (snapshot) => {
          this.debtors = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          // Если база абсолютно пуста, сеем начальные демо-данные в Firestore
          if (this.debtors.length === 0) {
            console.log("Firestore пуст. Производится первичная инициализация демо-данными...");
            SEEDED_DEBTORS.forEach(async (seed) => {
              const { doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
              const dRef = doc(collection(db, "debtors"), seed.id);
              await setDoc(dRef, seed).catch(e => handleFirestoreError(e, 'write', `debtors/${seed.id}`));
            });
          } else {
            this.triggerUpdate();
          }
        }, (error) => {
          handleFirestoreError(error, 'get', 'debtors');
        });
        
        updateDbBadgeStatus("active", "Облако Firestore");
      } catch (err) {
        console.error("Ошибка реального времени Firebase:", err);
        this.fallbackToLocalStorage();
      }
    } else {
      this.fallbackToLocalStorage();
    }
  }

  fallbackToLocalStorage() {
    updateDbBadgeStatus("local", "Локальная БД");
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!stored) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEEDED_DEBTORS));
      this.debtors = JSON.parse(JSON.stringify(SEEDED_DEBTORS));
    } else {
      try {
        this.debtors = JSON.parse(stored);
      } catch (e) {
        this.debtors = JSON.parse(JSON.stringify(SEEDED_DEBTORS));
      }
    }
    this.triggerUpdate();
  }

  triggerUpdate() {
    this.callbacks.forEach(cb => cb(this.debtors));
  }

  subscribe(callback) {
    this.callbacks.push(callback);
    callback(this.debtors);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  async addDebtor(debtor) {
    const rawDebtor = {
      name: debtor.name,
      inn: debtor.inn,
      kpp: debtor.kpp,
      ogrn: debtor.ogrn,
      address: debtor.address,
      debtAmount: Number(debtor.debtAmount),
      status: "Претензия",
      timeline: [
        {
          id: "step_" + Date.now(),
          stageName: "Ввод в систему",
          date: new Date().toISOString().split("T")[0],
          comment: "Создана учетная карточка должника. Реквизиты верифицированы по системе ФНС DaData.",
          system: true
        }
      ]
    };

    if (isFirebaseActive) {
      try {
        const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        await addDoc(collection(db, "debtors"), rawDebtor);
        showToast("Должник успешно добавлен в облако Firestore!", "success");
      } catch (error) {
        handleFirestoreError(error, 'create', 'debtors');
      }
    } else {
      const localId = "debtor_" + Date.now();
      const list = [...this.debtors, { id: localId, ...rawDebtor }];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      this.debtors = list;
      this.triggerUpdate();
      showToast("Должник сохранен в локальную базу браузера!", "success");
    }
  }

  async updateDebtor(id, fields) {
    if (isFirebaseActive) {
      try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const docRef = doc(db, "debtors", id);
        await updateDoc(docRef, fields);
        showToast("Данные сохранены в Firestore", "success");
      } catch (error) {
        handleFirestoreError(error, 'update', `debtors/${id}`);
      }
    } else {
      const list = this.debtors.map(d => d.id === id ? { ...d, ...fields } : d);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      this.debtors = list;
      this.triggerUpdate();
      showToast("Локальные изменения успешно сохранены", "success");
    }
  }

  async deleteDebtor(id) {
    if (isFirebaseActive) {
      try {
        const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
        const docRef = doc(db, "debtors", id);
        await deleteDoc(docRef);
        showToast("Должник успешно удален из Firestore", "success");
      } catch (error) {
        handleFirestoreError(error, 'delete', `debtors/${id}`);
      }
    } else {
      const list = this.debtors.filter(d => d.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      this.debtors = list;
      this.triggerUpdate();
      showToast("Карточка должника успешно удалена", "success");
    }
  }
}

const debtorsService = new DebtorsService();

// ==========================================
// 4. SPA РОУТЕР & СОСТОЯНИЕ ИНТЕРФЕЙСА
// ==========================================
class AppRouter {
  constructor() {
    this.currentView = 'dashboard';
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.view) {
        this.navigate(e.state.view, false);
      }
    });
  }

  navigate(view, pushState = true) {
    this.currentView = view;
    
    // Скрытие и показ разделов
    const dashboardSection = document.getElementById('section-dashboard');
    const detailSection = document.getElementById('section-detail');
    
    if (view === 'dashboard') {
      dashboardSection.classList.remove('hidden');
      detailSection.classList.add('hidden');
      window.activeDebtorId = null;
    } else if (view === 'detail') {
      dashboardSection.classList.add('hidden');
      detailSection.classList.remove('hidden');
    }

    if (pushState) {
      history.pushState({ view }, `ОБЛБЫТГАЗ — ${view}`, `#${view}`);
    }
  }
}

window.appRouter = new AppRouter();

// Глобальные переменные состояния приложения
let currentDebtorsList = [];
window.activeDebtorId = null;
let currentFilter = 'all';
let searchQuery = '';

// ==========================================
// 5. ИНТЕГРАЦИЯ С DADATA API
// ==========================================
async function fetchDaDataCompany(inn) {
  const token = "f5c4e31403c1b54a7dd283de1ac304d0f6f938be";
  const url = "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party";
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Token ${token}`
    },
    body: JSON.stringify({ query: inn })
  });

  if (!response.ok) {
    throw new Error(`Ошибка DaData HTTP: ${response.status}`);
  }

  const res = await response.json();
  return res.suggestions || [];
}

// Слушатель ввода ИНН в модальном окне добавления
const innInput = document.getElementById('add-inn');
if (innInput) {
  innInput.addEventListener('input', async (e) => {
    const value = e.target.value.trim().replace(/\D/g, ''); // убираем нецифры
    e.target.value = value;

    const feedback = document.getElementById('dadata-feedback');
    const spinner = document.getElementById('dadata-loading-spinner');
    
    // Сбрасываем поля перед поиском
    document.getElementById('add-name').value = '';
    document.getElementById('add-kpp').value = '';
    document.getElementById('add-ogrn').value = '';
    document.getElementById('add-address').value = '';

    if (value.length === 10 || value.length === 12) {
      spinner.classList.remove('hidden');
      feedback.classList.remove('hidden', 'text-rose-600', 'text-emerald-600');
      feedback.className = "text-xs font-semibold mt-1 text-blue-500 animate-pulse";
      feedback.textContent = "🔎 Запрос реквизитов из ФНС DaData...";

      try {
        const suggestions = await fetchDaDataCompany(value);
        spinner.classList.add('hidden');

        if (suggestions && suggestions.length > 0) {
          const company = suggestions[0];
          const data = company.data;
          
          feedback.className = "text-xs font-bold mt-1 text-emerald-600 flex items-center gap-1";
          feedback.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg> Организация успешно найдена в реестре`;
          
          // Заполняем поля
          document.getElementById('add-name').value = company.value || data.name.short_with_opf || data.name.full_with_opf || "Неизвестное юрлицо";
          document.getElementById('add-kpp').value = data.kpp || "Не применимо (ИП)";
          document.getElementById('add-ogrn').value = data.ogrn || data.ogrnip || "—";
          document.getElementById('add-address').value = data.address ? data.address.value : "Адрес не указан";
        } else {
          feedback.className = "text-xs font-bold mt-1 text-rose-600";
          feedback.textContent = "❌ Организация по данному ИНН не найдена";
        }
      } catch (err) {
        console.error("DaData error:", err);
        spinner.classList.add('hidden');
        feedback.className = "text-xs font-bold mt-1 text-rose-600";
        feedback.textContent = "⚠️ Сбой связи ФНС. Попробуйте снова.";
      }
    } else {
      feedback.classList.add('hidden');
      spinner.classList.add('hidden');
    }
  });
}

// ==========================================
// 6. ОТРЕНДЕРИТЬ ДАШБОРД (ГЛАВНАЯ СТРАНИЦА)
// ==========================================
function renderDashboard(debtors) {
  const grid = document.getElementById('debtors-grid');
  const resultsCounter = document.getElementById('results-count');
  
  if (!grid) return;
  grid.innerHTML = '';

  // 1. Фильтрация и поиск
  const filtered = debtors.filter(debtor => {
    // Поиск
    const normSearch = searchQuery.toLowerCase();
    const matchSearch = 
      debtor.name.toLowerCase().includes(normSearch) || 
      debtor.inn.includes(normSearch);

    // Фильтр статуса
    if (currentFilter === 'all') return matchSearch;
    return debtor.status === currentFilter && matchSearch;
  });

  resultsCounter.textContent = `Найдено: ${filtered.length}`;

  // 2. Статистика в Bento-сетке
  calculateStats(debtors);

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 flex flex-col items-center justify-center space-y-3 bg-white rounded-xl border border-slate-200">
        <svg class="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p class="text-slate-400 font-bold text-sm">Должники не найдены по заданным условиям</p>
      </div>
    `;
    return;
  }

  // 3. Генерация карточек
  filtered.forEach(debtor => {
    const card = document.createElement('div');
    card.className = "bg-white p-6 rounded-xl border border-slate-200 hover:border-brand-500 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-4 group relative overflow-hidden";
    card.id = `debtor-card-${debtor.id}`;
    
    // Клик ведет на внутреннюю страницу
    card.addEventListener('click', () => {
      openDebtorDossier(debtor.id);
    });

    const isIP = debtor.inn.length === 12;
    const remainingDebt = getRemainingDebt(debtor);
    const formattedAmount = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(remainingDebt);

    // Вычисляем прогресс на основе этапа
    let progressPercent = 15;
    let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";
    if (debtor.status === "Претензия") {
      progressPercent = 40;
      badgeClass = "bg-amber-100 text-amber-800 border-amber-200";
    } else if (debtor.status === "Судебный спор") {
      progressPercent = 65;
      badgeClass = "bg-purple-100 text-purple-800 border-purple-200";
    } else if (debtor.status === "Исполнительное производство") {
      progressPercent = 85;
      badgeClass = "bg-blue-100 text-blue-800 border-blue-200";
    } else if (debtor.status === "Завершено") {
      progressPercent = 100;
      badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
    }

    // Проверка просрочки ответа по претензии
    let expiredBadge = '';
    const claim = (debtor.timeline || []).find(s => s.stageName === "Претензия");
    if (claim && claim.receivedDate) {
      const termDays = claim.deadlineType === '10 дней' ? 10 : 30;
      const received = new Date(claim.receivedDate);
      const answerDate = new Date(received.getTime() + termDays * 24 * 60 * 60 * 1000);
      const today = new Date();
      
      if (answerDate < today && debtor.status === "Претензия") {
        expiredBadge = `<span class="inline-flex items-center text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 border border-rose-200 rounded">ПРОСРОЧЕНО</span>`;
      }
    }

    card.innerHTML = `
      <!-- Ribbon Accent -->
      <div class="absolute top-0 left-0 w-1.5 h-full bg-brand-500 group-hover:bg-brand-600 transition-colors"></div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-[10px] font-extrabold font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">${isIP ? 'ИП' : 'ООО/АО'}</span>
          <div class="flex space-x-1.5 items-center">
            ${expiredBadge}
            <span class="px-2 py-0.5 text-[10px] font-bold rounded-md border ${badgeClass} uppercase">${debtor.status}</span>
          </div>
        </div>
        
        <h3 class="text-base font-extrabold font-display text-slate-900 group-hover:text-brand-600 transition line-clamp-2 pr-1">${debtor.name}</h3>
        <p class="text-xs text-slate-400 font-medium font-mono">ИНН: ${debtor.inn}</p>
      </div>

      <!-- Financial info & Progress line -->
      <div class="space-y-3 pt-3 border-t border-slate-100">
        <div class="flex items-end justify-between">
          <div>
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Дебиторский долг</span>
            <span class="text-lg font-black text-slate-900 font-mono tracking-tight">${formattedAmount}</span>
            ${debtor.ilData ? `<div class="text-[11px] text-slate-600 font-semibold font-mono mt-1 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">ИЛ: ${debtor.ilData}</div>` : ''}
          </div>
          <span class="text-xs font-bold text-brand-600 group-hover:underline inline-flex items-center gap-1">
            <span>Досье</span>
            <svg class="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" /></svg>
          </span>
        </div>

        <!-- Progress bar -->
        <div class="space-y-1">
          <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div class="h-full bg-brand-500 transition-all duration-500 rounded-full" style="width: ${progressPercent}%"></div>
          </div>
          <div class="flex justify-between text-[8px] font-bold text-slate-400 uppercase tracking-widest font-mono">
            <span>Претензия</span>
            <span>Суд</span>
            <span>ФССП</span>
          </div>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

// Вычисление и рендер сводной статистики сверху
function calculateStats(debtors) {
  let totalCount = debtors.length;
  let totalAmount = 0;
  let expiredCount = 0;
  let claimsCount = 0;

  const today = new Date();

  debtors.forEach(debtor => {
    totalAmount += getRemainingDebt(debtor);
    if (debtor.status === "Претензия") {
      claimsCount++;
    }

    // Поиск просроченной претензии
    const claim = (debtor.timeline || []).find(s => s.stageName === "Претензия");
    if (claim && claim.receivedDate) {
      const termDays = claim.deadlineType === '10 дней' ? 10 : 30;
      const received = new Date(claim.receivedDate);
      const answerDate = new Date(received.getTime() + termDays * 24 * 60 * 60 * 1000);
      
      if (answerDate < today && debtor.status === "Претензия") {
        expiredCount++;
      }
    }
  });

  // Запись в DOM
  document.getElementById('stat-total-count').textContent = totalCount;
  document.getElementById('stat-total-amount').textContent = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(totalAmount);
  document.getElementById('stat-expired-count').textContent = expiredCount;
  document.getElementById('stat-claims-count').textContent = claimsCount;
}

// ==========================================
// 7. ВНУТРЕННЯЯ СТРАНИЦА ДОЛЖНИКА (SPA DOSSIER)
// ==========================================
function openDebtorDossier(id) {
  window.activeDebtorId = id;
  window.editingStageId = null;
  const debtor = currentDebtorsList.find(d => d.id === id);
  if (!debtor) return;

  window.appRouter.navigate('detail');

  // Отрисовываем шапку
  document.getElementById('detail-name').textContent = debtor.name;
  document.getElementById('detail-type-badge').textContent = debtor.inn.length === 12 ? 'ИП' : 'ООО/АО';
  document.getElementById('detail-inn-lbl').textContent = `ИНН: ${debtor.inn}`;
  if (debtor.ogrn) {
    document.getElementById('detail-ogrn-lbl-header').textContent = `| ОГРН: ${debtor.ogrn}`;
  } else {
    document.getElementById('detail-ogrn-lbl-header').textContent = '';
  }

  const ilHeader = document.getElementById('detail-il-header-container');
  if (ilHeader) {
    if (debtor.ilData) {
      document.getElementById('detail-il-lbl-header').textContent = debtor.ilData;
      ilHeader.classList.remove('hidden');
    } else {
      ilHeader.classList.add('hidden');
    }
  }

  document.getElementById('detail-address').textContent = debtor.address || 'Юр. адрес не указан';
  document.getElementById('detail-kpp-lbl').textContent = debtor.kpp || '—';
  document.getElementById('detail-ogrn-lbl').textContent = debtor.ogrn || '—';
  document.getElementById('detail-id-lbl').textContent = debtor.id;
  
  // Рассчитываем остаток долга с учетом частичных оплат
  const remainingDebt = getRemainingDebt(debtor);
  document.getElementById('detail-debt-lbl').textContent = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(remainingDebt);

  // Отрисовка статусных баджей в деталях
  const badgeContainer = document.getElementById('detail-badge-container');
  let badgeClass = "bg-slate-100 text-slate-700 border-slate-200";
  if (debtor.status === "Претензия") {
    badgeClass = "bg-amber-100 text-amber-800 border-amber-200";
  } else if (debtor.status === "Судебный спор") {
    badgeClass = "bg-purple-100 text-purple-800 border-purple-200";
  } else if (debtor.status === "Исполнительное производство") {
    badgeClass = "bg-blue-100 text-blue-800 border-blue-200";
  } else if (debtor.status === "Завершено") {
    badgeClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
  badgeContainer.innerHTML = `<span class="px-3.5 py-1 text-xs font-black rounded-lg border ${badgeClass} uppercase shadow-inner">${debtor.status}</span>`;

  // Подгружаем хронологию
  renderTimeline(debtor);

  // Настройка страницы досье при архивном статусе "Завершено"
  const detailSection = document.getElementById('section-detail');
  if (debtor.status === "Завершено") {
    detailSection.classList.add('grayscale', 'opacity-90');
  } else {
    detailSection.classList.remove('grayscale', 'opacity-90');
  }

  // По умолчанию выбираем последний зафиксированный этап в хронологии или "Претензия"
  const userStages = (debtor.timeline || []).filter(s => !s.system);
  const latestStage = userStages.length > 0 ? userStages[userStages.length - 1] : null;
  if (latestStage) {
    window.editingStageId = latestStage.id;
    window.changeEditorStageType(latestStage.stageName, false);
  } else {
    window.editingStageId = null;
    window.changeEditorStageType("Претензия", true);
  }
}

// Вспомогательная функция расчета остатка долга
function getRemainingDebt(debtor) {
  let initial = Number(debtor.debtAmount || 0);
  let paid = 0;
  if (debtor.timeline) {
    debtor.timeline.forEach(step => {
      if (step.stageName === "Частичная оплата долга") {
        paid += Number(step.paymentAmount || 0);
      }
    });
  }
  return Math.max(0, initial - paid);
}

// Отрисовка Вертикальной Хронологии (Timeline)
function renderTimeline(debtor) {
  const container = document.getElementById('timeline-container');
  if (!container) return;
  container.innerHTML = '';

  const timeline = debtor.timeline || [];
  
  if (timeline.length === 0) {
    container.innerHTML = `<p class="text-slate-400 font-bold text-xs italic py-4">Хронология этапов пуста. Добавьте первый этап.</p>`;
    return;
  }

  // Отрисовка шагов
  timeline.forEach((step, idx) => {
    const item = document.createElement('div');
    item.className = "relative mb-8 pl-1";
    
    // Стили нод в зависимости от типа
    let dotColor = "bg-slate-300 border-slate-400 ring-4 ring-slate-100";
    let borderAccent = "border-slate-200";
    let textHeading = "text-slate-900";
    
    if (step.stageName === "Претензия") {
      dotColor = "bg-amber-500 border-amber-600 ring-4 ring-amber-100";
      borderAccent = "border-amber-200";
    } else if ([
      "Судебный приказ",
      "Отмена судебного приказа",
      "Подача искового заявления",
      "Вынесение решения",
      "Апелляция",
      "Результат апелляции"
    ].includes(step.stageName)) {
      dotColor = "bg-purple-500 border-purple-600 ring-4 ring-purple-100";
      borderAccent = "border-purple-200";
    } else if ([
      "Направление ИЛ в ФССП",
      "Возбуждение ИП",
      "Частичная оплата долга",
      "Жалоба на ФССП"
    ].includes(step.stageName)) {
      dotColor = "bg-blue-500 border-blue-600 ring-4 ring-blue-100";
      borderAccent = "border-blue-200";
    } else if (step.stageName === "Окончание ИП") {
      dotColor = "bg-emerald-500 border-emerald-600 ring-4 ring-emerald-100";
      borderAccent = "border-emerald-200";
    }

    // Иконка точки
    const dot = document.createElement('div');
    dot.className = `absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 ${dotColor} z-10 transition-all`;
    item.appendChild(dot);

    // Внутренности карточки этапа
    let detailsHtml = '';
    
    if (step.stageName === "Претензия") {
      const claimAmountFormatted = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(step.claimAmount || debtor.debtAmount);
      let deadlineBoxHtml = '';
      if (step.receivedDate) {
        const termDays = step.deadlineType === '10 дней' ? 10 : 30;
        const received = new Date(step.receivedDate);
        const answerDate = new Date(received.getTime() + termDays * 24 * 60 * 60 * 1000);
        const today = new Date();
        const isExpired = answerDate < today;
        const textStyle = isExpired ? 'text-rose-600 font-extrabold' : 'text-emerald-600 font-bold';
        const msg = isExpired ? '🛑 Срок ответа ИСТЕК (подайте иск!)' : '⏳ Ожидание ответа в рамках срока';
        
        deadlineBoxHtml = `
          <div class="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
            <div class="flex justify-between">
              <span class="text-slate-400 font-bold uppercase text-[9px]">Расчетный дедлайн:</span>
              <span class="${textStyle} font-mono">${answerDate.toLocaleDateString('ru-RU')}</span>
            </div>
            <p class="text-[10px] font-bold flex items-center gap-1 ${textStyle}">${msg}</p>
          </div>
        `;
      }

      detailsHtml = `
        <div class="grid grid-cols-2 gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100 mt-2">
          <div><strong class="text-slate-400 uppercase text-[9px] block">Отправлено:</strong> <span class="font-semibold">${step.sentDate ? new Date(step.sentDate).toLocaleDateString('ru-RU') : '—'}</span></div>
          <div><strong class="text-slate-400 uppercase text-[9px] block">Получено:</strong> <span class="font-semibold">${step.receivedDate ? new Date(step.receivedDate).toLocaleDateString('ru-RU') : '—'}</span></div>
          <div><strong class="text-slate-400 uppercase text-[9px] block">Требование:</strong> <span class="font-bold text-slate-800 font-mono">${claimAmountFormatted}</span></div>
          <div><strong class="text-slate-400 uppercase text-[9px] block">ШПИ (Почта России):</strong> <span class="font-bold font-mono text-slate-700">${step.trackingNumber || '—'}</span></div>
          <div class="col-span-2"><strong class="text-slate-400 uppercase text-[9px] block">Email представителя:</strong> <a href="mailto:${step.email}" class="text-brand-600 hover:underline font-semibold flex items-center gap-1 mt-0.5">
            <svg class="w-3.5 h-3.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> ${step.email || '—'}
          </a></div>
        </div>
        ${deadlineBoxHtml}
      `;
    } else if (step.stageName === "Судебный приказ") {
      detailsHtml = `
        <div class="grid grid-cols-2 gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100 mt-2">
          <div><strong class="text-slate-400 uppercase text-[9px] block">Номер дела:</strong> <span class="font-bold text-slate-800">${step.caseNumber || '—'}</span></div>
          <div><strong class="text-slate-400 uppercase text-[9px] block">ФИО судьи:</strong> <span class="font-semibold">${step.judgeName || '—'}</span></div>
          <div class="col-span-2"><strong class="text-slate-400 uppercase text-[9px] block">Дата вынесения:</strong> <span class="font-bold text-slate-800 font-mono">${step.rulingDate ? new Date(step.rulingDate).toLocaleDateString('ru-RU') : '—'}</span></div>
          ${step.decisionText ? `<div class="col-span-2"><strong class="text-slate-400 uppercase text-[9px] block">Содержание приказа:</strong> <p class="text-xs text-slate-700 bg-slate-50 p-2 rounded border mt-1 font-medium whitespace-pre-wrap">${step.decisionText}</p></div>` : ''}
        </div>
      `;
    } else if (step.stageName === "Отмена судебного приказа") {
      detailsHtml = `
        <div class="text-xs text-slate-600 pt-2 border-t border-slate-100 mt-2">
          <div><strong class="text-slate-400 uppercase text-[9px] block">Дата отмены:</strong> <span class="font-bold text-rose-600">${step.rulingDate ? new Date(step.rulingDate).toLocaleDateString('ru-RU') : '—'}</span></div>
          <div class="mt-2 text-rose-700 bg-rose-50 p-2.5 rounded-lg border border-rose-100 font-bold text-[10px]">
            ⚠️ Приказ отменен должником. Требуется переход к исковому производству.
          </div>
        </div>
      `;
    } else if (step.stageName === "Подача искового заявления") {
      let controlBox = '';
      if (step.acceptanceDate && step.procedureType === "Упрощенное производство (2 месяца)") {
        const acc = new Date(step.acceptanceDate);
        const control = new Date(acc.getFullYear(), acc.getMonth() + 2, acc.getDate());
        const isExpired = control < new Date();
        const textStyle = isExpired ? 'text-rose-600 font-extrabold' : 'text-indigo-600 font-bold';
        controlBox = `
          <div class="mt-2.5 p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-xs">
            <span class="text-slate-400 font-bold uppercase text-[9px] block">Контрольная дата (2 мес):</span>
            <span class="${textStyle} font-mono">${control.toLocaleDateString('ru-RU')}</span>
          </div>
        `;
      }
      detailsHtml = `
        <div class="grid grid-cols-2 gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100 mt-2">
          <div><strong class="text-slate-400 uppercase text-[9px] block">Номер дела:</strong> <span class="font-bold text-slate-800 font-mono">${step.caseNumber || '—'}</span></div>
          <div><strong class="text-slate-400 uppercase text-[9px] block">ФИО судьи:</strong> <span class="font-semibold">${step.judgeName || '—'}</span></div>
          <div><strong class="text-slate-400 uppercase text-[9px] block">Порядок:</strong> <span class="font-bold text-indigo-700">${step.procedureType || 'Общий'}</span></div>
          <div><strong class="text-slate-400 uppercase text-[9px] block">Принят к производству:</strong> <span class="font-semibold">${step.acceptanceDate ? new Date(step.acceptanceDate).toLocaleDateString('ru-RU') : '—'}</span></div>
        </div>
        ${controlBox}
      `;
    } else if (step.stageName === "Вынесение решения") {
      let forceBox = '';
      if (step.decisionDate) {
        const decDate = new Date(step.decisionDate);
        const forceDate = new Date(decDate.getTime() + 15 * 24 * 60 * 60 * 1000);
        const isForce = forceDate < new Date();
        const textStyle = isForce ? 'text-emerald-600 font-extrabold' : 'text-amber-600 font-bold';
        forceBox = `
          <div class="mt-2.5 p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-xs flex justify-between items-center">
            <div>
              <span class="text-slate-400 font-bold uppercase text-[9px] block">Вступление в силу (15 дней):</span>
              <span class="${textStyle} font-mono">${forceDate.toLocaleDateString('ru-RU')}</span>
            </div>
            <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] rounded font-bold">Законная сила</span>
          </div>
        `;
      }
      detailsHtml = `
        <div class="grid grid-cols-2 gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100 mt-2">
          <div><strong class="text-slate-400 uppercase text-[9px] block">Номер дела:</strong> <span class="font-bold text-slate-800 font-mono">${step.caseNumber || '—'}</span></div>
          <div><strong class="text-slate-400 uppercase text-[9px] block">Сумма взыскания:</strong> <span class="font-bold text-emerald-600 font-mono">${new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(step.decisionAmount || 0)}</span></div>
          ${step.decisionText ? `<div class="col-span-2"><strong class="text-slate-400 uppercase text-[9px] block">Резолютивная часть:</strong> <p class="text-xs text-slate-700 bg-slate-50 p-2 rounded border mt-1 font-medium whitespace-pre-wrap">${step.decisionText}</p></div>` : ''}
          <div class="col-span-2 mt-3">
            <button onclick="event.stopPropagation(); window.generateDocument('court_il')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-xs transition shadow-sm active:scale-95 text-center flex items-center justify-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Скачать запрос на выдачу ИЛ
            </button>
          </div>
        </div>
        ${forceBox}
      `;
    } else if (step.stageName === "Апелляция") {
      detailsHtml = `
        <div class="grid grid-cols-2 gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100 mt-2">
          <div><strong class="text-slate-400 uppercase text-[9px] block">Номер дела:</strong> <span class="font-bold text-slate-800 font-mono">${step.caseNumber || '—'}</span></div>
          <div><strong class="text-slate-400 uppercase text-[9px] block">ФИО судьи:</strong> <span class="font-semibold">${step.judgeName || '—'}</span></div>
          <div class="col-span-2"><strong class="text-slate-400 uppercase text-[9px] block">Принято апелляцией:</strong> <span class="font-semibold">${step.acceptanceDate ? new Date(step.acceptanceDate).toLocaleDateString('ru-RU') : '—'}</span></div>
        </div>
      `;
    } else if (step.stageName === "Результат апелляции") {
      const appealBadge = step.appealResult === "Оставлено в силе" 
        ? `<div class="mt-2.5 p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold flex flex-col gap-1.5">
             <span>✅ Решение оставлено в силе и вступило в силу!</span>
             <button onclick="event.stopPropagation(); window.generateDocument('court_il')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded text-[10px] w-fit transition shadow-sm active:scale-95 text-center flex items-center gap-1">
               <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
               Скачать запрос на выдачу ИЛ
             </button>
           </div>`
        : `<div class="mt-2.5 p-2.5 bg-rose-50 border border-rose-100 text-rose-800 rounded-lg text-[10px] font-bold">
             ❌ Решение отменено апелляционной инстанцией. Проверьте карточку КАД.
           </div>`;
      detailsHtml = `
        <div class="grid grid-cols-2 gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100 mt-2">
          <div><strong class="text-slate-400 uppercase text-[9px] block">Дата постановления:</strong> <span class="font-bold text-slate-850">${step.resultDate ? new Date(step.resultDate).toLocaleDateString('ru-RU') : '—'}</span></div>
          <div><strong class="text-slate-400 uppercase text-[9px] block">Постановление:</strong> <span class="font-bold text-indigo-700">${step.appealResult || '—'}</span></div>
        </div>
        ${appealBadge}
      `;
    } else if (step.stageName === "Направление ИЛ в ФССП") {
      detailsHtml = `
        <div class="grid grid-cols-2 gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100 mt-2">
          <div><strong class="text-slate-400 uppercase text-[9px] block">Дата направления ИЛ:</strong> <span class="font-bold text-slate-800">${step.sentDate ? new Date(step.sentDate).toLocaleDateString('ru-RU') : '—'}</span></div>
          <div><strong class="text-slate-400 uppercase text-[9px] block">ШПИ приставам:</strong> <span class="font-bold font-mono text-indigo-600">${step.trackingNumber || '—'}</span></div>
          <div class="col-span-2 mt-3 flex flex-col sm:flex-row gap-2">
            <button onclick="event.stopPropagation(); window.generateDocument('fssp_order')" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-[11px] font-bold transition shadow-sm active:scale-95 text-center flex items-center justify-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Заявление в ФССП (по Приказу)
            </button>
            <button onclick="event.stopPropagation(); window.generateDocument('fssp_il')" class="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-3 rounded text-[11px] font-bold transition shadow-sm active:scale-95 text-center flex items-center justify-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Заявление в ФССП (по ИЛ)
            </button>
          </div>
        </div>
      `;
    } else if (step.stageName === "Возбуждение ИП") {
      const ilHtml = debtor.ilData ? `
        <div class="col-span-2 mt-2 bg-slate-50 p-2.5 rounded border border-slate-100">
          <span class="text-slate-400 font-bold uppercase text-[9px] block">Реквизиты исполнительного листа:</span>
          <span class="font-bold font-mono text-[11px] text-slate-700">${debtor.ilData}</span>
        </div>
      ` : '';
      detailsHtml = `
        <div class="grid grid-cols-2 gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100 mt-2">
          <div><strong class="text-slate-400 uppercase text-[9px] block">Дата возбуждения:</strong> <span class="font-bold text-slate-800">${step.initiationDate ? new Date(step.initiationDate).toLocaleDateString('ru-RU') : '—'}</span></div>
          <div><strong class="text-slate-400 uppercase text-[9px] block">Номер ИП приставов:</strong> <span class="font-bold text-blue-600 font-mono">${step.ipNumber || '—'}</span></div>
          ${ilHtml}
        </div>
      `;
    } else if (step.stageName === "Частичная оплата долга") {
      detailsHtml = `
        <div class="grid grid-cols-2 gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100 mt-2">
          <div><strong class="text-slate-400 uppercase text-[9px] block">Дата транзакции:</strong> <span class="font-bold text-slate-800">${step.paymentDate ? new Date(step.paymentDate).toLocaleDateString('ru-RU') : '—'}</span></div>
          <div><strong class="text-slate-400 uppercase text-[9px] block">Сумма платежа:</strong> <span class="font-black text-emerald-600 font-mono">+ ${new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(step.paymentAmount || 0)}</span></div>
        </div>
      `;
    } else if (step.stageName === "Жалоба на ФССП") {
      detailsHtml = `
        <div class="text-xs text-slate-600 pt-2 border-t border-slate-100 mt-2 space-y-1">
          <div><strong class="text-slate-400 uppercase text-[9px] block">Дата жалобы:</strong> <span class="font-bold text-slate-800">${step.complaintDate ? new Date(step.complaintDate).toLocaleDateString('ru-RU') : '—'}</span></div>
          ${step.complaintEssence ? `<div><strong class="text-slate-400 uppercase text-[9px] block">Суть жалобы:</strong> <p class="text-xs text-slate-700 bg-amber-50 p-2 rounded border mt-1 font-medium whitespace-pre-wrap">${step.complaintEssence}</p></div>` : ''}
        </div>
      `;
    } else if (step.stageName === "Окончание ИП") {
      const ilHtml = debtor.ilData ? `
        <div class="mt-2 bg-slate-50 p-2.5 rounded border border-slate-100">
          <span class="text-slate-400 font-bold uppercase text-[9px] block">Реквизиты исполнительного листа:</span>
          <span class="font-bold font-mono text-[11px] text-slate-700">${debtor.ilData}</span>
        </div>
      ` : '';
      detailsHtml = `
        <div class="text-xs text-slate-600 pt-2 border-t border-slate-100 mt-2">
          <div><strong class="text-slate-400 uppercase text-[9px] block">Основание закрытия ИП:</strong> <span class="font-bold text-emerald-700">${step.closureReason || '—'}</span></div>
          ${ilHtml}
          <div class="mt-2.5 p-2.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold">
            🎉 Производство успешно завершено! Дело отправлено в архив.
          </div>
        </div>
      `;
    }

    const isSystem = step.system === true;
    const clickHandler = isSystem ? "" : `onclick="window.loadStageForEditing('${step.id}', '${step.stageName}')"`;
    const cursorClass = isSystem ? "" : "cursor-pointer hover:border-brand-500 hover:ring-2 hover:ring-brand-500/10";

    item.innerHTML += `
      <div ${clickHandler} class="bg-white p-4 rounded-xl border border-slate-200 shadow-sm ${borderAccent} transition hover:shadow-md ${cursorClass}">
        <div class="flex justify-between items-center mb-1">
          <h4 class="font-extrabold text-sm ${textHeading} uppercase tracking-tight">${step.stageName}</h4>
          <span class="text-[10px] font-bold text-slate-400 font-mono">${step.date ? new Date(step.date).toLocaleDateString('ru-RU') : step.sentDate ? new Date(step.sentDate).toLocaleDateString('ru-RU') : '—'}</span>
        </div>
        <p class="text-xs text-slate-600 leading-relaxed font-medium mt-1">${step.comment || 'Официальный этап зафиксирован без дополнительных комментариев.'}</p>
        ${detailsHtml}
      </div>
    `;

    container.appendChild(item);
  });
}

// Загрузка этапа в форму интерактивного редактора
window.loadStageForEditing = function(id, name) {
  window.editingStageId = id;
  window.changeEditorStageType(name, false);
  
  const editorCard = document.getElementById('stage-editor-card');
  if (editorCard) {
    editorCard.scrollIntoView({ behavior: 'smooth' });
    editorCard.classList.add('ring-4', 'ring-brand-500/20');
    setTimeout(() => {
      editorCard.classList.remove('ring-4', 'ring-brand-500/20');
    }, 1500);
  }
};

// Вызов модального окна выбора типа этапа
window.showSelectStageTypeModal = function() {
  document.getElementById('modal-select-stage-type').classList.remove('hidden');
};

window.closeSelectStageTypeModal = function() {
  document.getElementById('modal-select-stage-type').classList.add('hidden');
};

window.confirmSelectStageType = function() {
  const select = document.getElementById('modal-stage-type-select');
  const stageType = select.value;
  window.closeSelectStageTypeModal();
  window.changeEditorStageType(stageType, true);
};

// Функция переключения интерактивной формы
window.changeEditorStageType = function(stageType, isNew = true) {
  const activeDebtor = currentDebtorsList.find(d => d.id === window.activeDebtorId);
  if (!activeDebtor) return;

  const selector = document.getElementById('stage-type-selector');
  if (selector) selector.value = stageType;

  document.getElementById('stage-editor-title').textContent = stageType;

  if (isNew) {
    window.editingStageId = null;
    document.getElementById('delete-stage-btn').classList.add('hidden');
    document.getElementById('save-stage-btn-text').textContent = "Добавить этап";
    document.getElementById('stage-comment').value = "";
  } else {
    document.getElementById('delete-stage-btn').classList.remove('hidden');
    document.getElementById('save-stage-btn-text').textContent = "Сохранить изменения";
  }

  const container = document.getElementById('dynamic-inputs-container');
  const logicOutput = document.getElementById('stage-logic-output');
  if (!container || !logicOutput) return;

  container.innerHTML = "";
  logicOutput.innerHTML = "";

  let step = null;
  if (!isNew && window.editingStageId) {
    step = (activeDebtor.timeline || []).find(s => s.id === window.editingStageId);
    if (step) {
      document.getElementById('stage-comment').value = step.comment || "";
    }
  }

  // Рендерим нужные инпуты и локальную интерактивную логику
  if (stageType === "Претензия") {
    container.innerHTML = `
      <div class="space-y-3 animate-fade-in">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Дата отправки</label>
            <input type="date" id="claim-sent-date" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Дата получения</label>
            <input type="date" id="claim-received-date" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Сумма требования (₽)</label>
            <input type="number" id="claim-amount" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Срок ответа</label>
            <select id="claim-deadline-type" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500 bg-white">
              <option value="30 дней">30 дней</option>
              <option value="10 дней">10 дней</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">ШПИ почты России</label>
          <input type="text" id="claim-tracking" placeholder="14-значный трек-номер" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500 font-mono">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Email представителя</label>
          <input type="email" id="claim-email" placeholder="email@domain.com" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500 font-mono">
        </div>
      </div>
    `;

    if (step) {
      document.getElementById('claim-sent-date').value = step.sentDate || '';
      document.getElementById('claim-received-date').value = step.receivedDate || '';
      document.getElementById('claim-amount').value = step.claimAmount || activeDebtor.debtAmount;
      document.getElementById('claim-email').value = step.email || '';
      document.getElementById('claim-tracking').value = step.trackingNumber || '';
      document.getElementById('claim-deadline-type').value = step.deadlineType || '30 дней';
    } else {
      document.getElementById('claim-amount').value = activeDebtor.debtAmount;
    }

    const updateClaimLogic = () => {
      const recDate = document.getElementById('claim-received-date').value;
      const dType = document.getElementById('claim-deadline-type').value;
      if (!recDate) {
        logicOutput.innerHTML = `<p class="text-xs text-slate-400 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-200">Укажите дату получения претензии должником для автоматического расчета срока и генерации .ics файла.</p>`;
        return;
      }
      const days = dType === '10 дней' ? 10 : 30;
      const received = new Date(recDate);
      const answerDate = new Date(received.getTime() + days * 24 * 60 * 60 * 1000);
      const isExpired = answerDate < new Date();
      const textClass = isExpired ? 'text-rose-600 font-extrabold' : 'text-emerald-600 font-bold';

      logicOutput.innerHTML = `
        <div class="p-3.5 rounded-lg border text-xs space-y-2 bg-slate-50 ${isExpired ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}">
          <div class="flex justify-between items-center">
            <span class="text-slate-400 font-bold uppercase text-[9px]">Дедлайн ответа:</span>
            <span class="${textClass} font-mono">${answerDate.toLocaleDateString('ru-RU')}</span>
          </div>
          <p class="font-bold text-[10px] ${textClass}">
            ${isExpired ? '🛑 Срок ответа ИСТЕК. Немедленно формируйте исковые документы!' : '⏳ Ожидание ответа должника в пределах нормы.'}
          </p>
          <div class="grid grid-cols-2 gap-2 mt-2">
            <a href="${window.getGoogleCalendarUrl(activeDebtor.id, 'Дедлайн претензии', answerDate.toISOString().split('T')[0], 'Крайний срок ответа на претензию ООО ОБЛБЫТГАЗ')}" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-sm active:scale-95 text-center">
              <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              В Google
            </a>
            <a href="${window.getYandexCalendarUrl(activeDebtor.id, 'Дедлайн претензии', answerDate.toISOString().split('T')[0], 'Крайний срок ответа на претензию ООО ОБЛБЫТГАЗ')}" target="_blank" class="bg-[#ff3347] hover:bg-[#e02235] text-white py-1.5 px-2 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-sm active:scale-95 text-center">
              <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              В Яндекс
            </a>
          </div>
        </div>
      `;
    };

    document.getElementById('claim-received-date').addEventListener('change', updateClaimLogic);
    document.getElementById('claim-deadline-type').addEventListener('change', updateClaimLogic);
    updateClaimLogic();

  } else if (stageType === "Судебный приказ") {
    container.innerHTML = `
      <div class="space-y-3 animate-fade-in">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Номер приказа/дела</label>
          <input type="text" id="order-number" placeholder="Дело № А41-..." class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500 font-mono">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">ФИО мирового судьи</label>
          <input type="text" id="order-judge" placeholder="Судья Иванова И.А." class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Дата вынесения судебного приказа</label>
          <input type="date" id="order-ruling-date" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Резолютивная часть / Текст приказа</label>
          <textarea id="order-decision" rows="2" placeholder="Взыскать задолженность в полном объеме..." class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500"></textarea>
        </div>
      </div>
    `;

    if (step) {
      document.getElementById('order-number').value = step.caseNumber || '';
      document.getElementById('order-judge').value = step.judgeName || '';
      document.getElementById('order-ruling-date').value = step.rulingDate || '';
      document.getElementById('order-decision').value = step.decisionText || '';
    }

    const updateOrderLogic = () => {
      const rDate = document.getElementById('order-ruling-date').value;
      if (!rDate) {
        logicOutput.innerHTML = `
          <div class="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2">
            <p class="font-bold text-amber-800 text-[10px] uppercase tracking-wide block">⚡ ПЕРИОД ОБЖАЛОВАНИЯ (10 ДНЕЙ)</p>
            <p class="text-slate-600 font-medium">Укажите дату вынесения приказа, чтобы рассчитать контрольный срок окончания периода отмены.</p>
          </div>
        `;
        return;
      }
      const ruling = new Date(rDate);
      const controlDate = new Date(ruling.getTime() + 10 * 24 * 60 * 60 * 1000);
      const isExpired = controlDate < new Date();
      const textClass = isExpired ? 'text-rose-600 font-extrabold' : 'text-amber-600 font-bold';

      logicOutput.innerHTML = `
        <div class="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-slate-400 font-bold uppercase text-[9px]">Крайний срок отмены (10 дней):</span>
            <span class="${textClass} font-mono">${controlDate.toLocaleDateString('ru-RU')}</span>
          </div>
          <p class="font-bold text-[10px] ${textClass}">
            ${isExpired ? '⚡ Срок подачи возражений должником истек. Проверьте отмену или направляйте ИЛ приставам.' : '⏳ Период возможной отмены приказа должником.'}
          </p>
          <div class="grid grid-cols-2 gap-2 mt-2">
            <a href="${window.getGoogleCalendarUrl(activeDebtor.id, 'Судебный приказ: Возражения должника', controlDate.toISOString().split('T')[0], 'Контроль периода отмены судебного приказа')}" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-sm active:scale-95 text-center">
              <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              В Google
            </a>
            <a href="${window.getYandexCalendarUrl(activeDebtor.id, 'Судебный приказ: Возражения должника', controlDate.toISOString().split('T')[0], 'Контроль периода отмены судебного приказа')}" target="_blank" class="bg-[#ff3347] hover:bg-[#e02235] text-white py-1.5 px-2 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-sm active:scale-95 text-center">
              <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              В Яндекс
            </a>
          </div>
        </div>
      `;
    };

    document.getElementById('order-ruling-date').addEventListener('change', updateOrderLogic);
    updateOrderLogic();

  } else if (stageType === "Отмена судебного приказа") {
    container.innerHTML = `
      <div class="space-y-3 animate-fade-in">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Дата определения об отмене</label>
          <input type="date" id="cancel-ruling-date" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
        </div>
      </div>
    `;

    if (step) {
      document.getElementById('cancel-ruling-date').value = step.rulingDate || '';
    }

    logicOutput.innerHTML = `
      <div class="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-1.5 text-rose-800 font-semibold">
        <p class="font-extrabold text-[10px] uppercase">🛑 ТРЕБУЕТСЯ ИСКОВОЕ ПРОИЗВОДСТВО</p>
        <p class="text-[11px] leading-relaxed">Поскольку должник подал возражения и отменил судебный приказ, спор должен рассматриваться в рамках полноценного иска. Подготовьте исковое заявление.</p>
      </div>
    `;

  } else if (stageType === "Подача искового заявления") {
    container.innerHTML = `
      <div class="space-y-3 animate-fade-in">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Дата принятия иска</label>
            <input type="date" id="claim-acceptance-date" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Порядок рассмотрения</label>
            <select id="claim-review-period" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500 bg-white">
              <option value="Упрощенное производство (2 месяца)">Упрощенное производство (2 месяца)</option>
              <option value="Общий порядок">Общий порядок</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Номер судебного дела</label>
          <input type="text" id="claim-case-number" placeholder="А41-..." class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500 font-mono">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">ФИО председательствующего судьи</label>
          <input type="text" id="claim-judge" placeholder="Судья Смирнова Е.А." class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
        </div>
      </div>
    `;

    if (step) {
      document.getElementById('claim-acceptance-date').value = step.acceptanceDate || '';
      document.getElementById('claim-review-period').value = step.procedureType || 'Упрощенное производство (2 месяца)';
      document.getElementById('claim-case-number').value = step.caseNumber || '';
      document.getElementById('claim-judge').value = step.judgeName || '';
    }

    const updateSuitLogic = () => {
      const accDate = document.getElementById('claim-acceptance-date').value;
      const reviewPeriod = document.getElementById('claim-review-period').value;
      if (!accDate) {
        logicOutput.innerHTML = `<p class="text-xs text-slate-400 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-200">Введите дату принятия к производству для автоматического расчета контрольного срока рассмотрения дела.</p>`;
        return;
      }
      
      const acc = new Date(accDate);
      let controlDate;
      if (reviewPeriod.includes("2 месяца")) {
        controlDate = new Date(acc.getFullYear(), acc.getMonth() + 2, acc.getDate());
      } else {
        controlDate = new Date(acc.getFullYear(), acc.getMonth() + 3, acc.getDate());
      }
      const isExpired = controlDate < new Date();
      const textClass = isExpired ? 'text-rose-600 font-extrabold' : 'text-indigo-600 font-bold';

      logicOutput.innerHTML = `
        <div class="p-3.5 rounded-lg border text-xs space-y-2 bg-slate-50 ${isExpired ? 'border-rose-200 bg-rose-50' : 'border-indigo-200 bg-indigo-50'}">
          <div class="flex justify-between items-center">
            <span class="text-slate-400 font-bold uppercase text-[9px]">Контрольный срок решения:</span>
            <span class="${textClass} font-mono">${controlDate.toLocaleDateString('ru-RU')}</span>
          </div>
          <p class="font-bold text-[10px] ${textClass}">
            ${isExpired ? '🚨 Контрольный срок истек! Проверьте решение в картотеке КАД Арбитр.' : '⏳ Спор находится на этапе активного судебного рассмотрения.'}
          </p>
          <div class="grid grid-cols-2 gap-2 mt-2">
            <a href="${window.getGoogleCalendarUrl(activeDebtor.id, 'Судебный контроль дела', controlDate.toISOString().split('T')[0], 'Проверка вынесения судебного решения по делу')}" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-sm active:scale-95 text-center">
              <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              В Google
            </a>
            <a href="${window.getYandexCalendarUrl(activeDebtor.id, 'Судебный контроль дела', controlDate.toISOString().split('T')[0], 'Проверка вынесения судебного решения по делу')}" target="_blank" class="bg-[#ff3347] hover:bg-[#e02235] text-white py-1.5 px-2 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-sm active:scale-95 text-center">
              <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              В Яндекс
            </a>
          </div>
        </div>
      `;
    };

    document.getElementById('claim-acceptance-date').addEventListener('change', updateSuitLogic);
    document.getElementById('claim-review-period').addEventListener('change', updateSuitLogic);
    updateSuitLogic();

  } else if (stageType === "Вынесение решения") {
    container.innerHTML = `
      <div class="space-y-3 animate-fade-in">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Дата вынесения решения</label>
            <input type="date" id="decision-date" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Сумма взыскания (₽)</label>
            <input type="number" id="decision-amount" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
          </div>
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Номер судебного дела</label>
          <input type="text" id="decision-case-number" placeholder="А41-..." class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500 font-mono">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Резолютивная часть судебного акта</label>
          <textarea id="decision-text" rows="2" placeholder="Исковые требования ООО ОБЛБЫТГАЗ удовлетворить в полном объеме..." class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500"></textarea>
        </div>
      </div>
    `;

    let detectedCaseNumber = "";
    const lawsuit = (activeDebtor.timeline || []).find(s => s.caseNumber);
    if (lawsuit) detectedCaseNumber = lawsuit.caseNumber;

    if (step) {
      document.getElementById('decision-date').value = step.decisionDate || '';
      document.getElementById('decision-amount').value = step.decisionAmount || activeDebtor.debtAmount;
      document.getElementById('decision-case-number').value = step.caseNumber || detectedCaseNumber;
      document.getElementById('decision-text').value = step.decisionText || '';
    } else {
      document.getElementById('decision-amount').value = activeDebtor.debtAmount;
      document.getElementById('decision-case-number').value = detectedCaseNumber;
    }

    const updateDecisionLogic = () => {
      const decDate = document.getElementById('decision-date').value;
      if (!decDate) {
        logicOutput.innerHTML = `<p class="text-xs text-slate-400 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-200">Введите дату решения для автоматического расчета срока вступления решения суда в законную силу.</p>`;
        return;
      }
      const dec = new Date(decDate);
      const forceDate = new Date(dec.getTime() + 15 * 24 * 60 * 60 * 1000);
      const isForce = forceDate < new Date();
      const textClass = isForce ? 'text-emerald-600 font-extrabold' : 'text-slate-600 font-bold';

      logicOutput.innerHTML = `
        <div class="p-3.5 rounded-lg border text-xs space-y-2 bg-slate-50 ${isForce ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}">
          <div class="flex justify-between items-center">
            <span class="text-slate-400 font-bold uppercase text-[9px]">Вступление в силу:</span>
            <span class="${textClass} font-mono">${forceDate.toLocaleDateString('ru-RU')}</span>
          </div>
          <p class="font-bold text-[10px] ${isForce ? 'text-emerald-600' : 'text-amber-600'}">
            ${isForce ? '✅ Решение суда ВСТУПИЛО в силу! Направьте запрос на получение исполнительного листа.' : '⏳ Идет отсчет срока вступления в силу (15 календарных дней для обжалования).'}
          </p>
          <div class="grid grid-cols-2 gap-2 mt-2">
            <a href="${window.getGoogleCalendarUrl(activeDebtor.id, 'Вступление решения суда в силу', forceDate.toISOString().split('T')[0], 'Решение суда по делу вступило в силу - подать запрос на ИЛ')}" target="_blank" class="bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-2 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-sm active:scale-95 text-center">
              <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              В Google
            </a>
            <a href="${window.getYandexCalendarUrl(activeDebtor.id, 'Вступление решения суда в силу', forceDate.toISOString().split('T')[0], 'Решение суда по делу вступило в силу - подать запрос на ИЛ')}" target="_blank" class="bg-[#ff3347] hover:bg-[#e02235] text-white py-1.5 px-2 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-sm active:scale-95 text-center">
              <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              В Яндекс
            </a>
          </div>
        </div>
      `;
    };

    document.getElementById('decision-date').addEventListener('change', updateDecisionLogic);
    updateDecisionLogic();

  } else if (stageType === "Апелляция") {
    container.innerHTML = `
      <div class="space-y-3 animate-fade-in">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Дата принятия к рассмотрению</label>
          <input type="date" id="appeal-acceptance-date" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Номер апелляционного дела</label>
          <input type="text" id="appeal-case-number" placeholder="Дело № А41-... (10АП-...)" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500 font-mono">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Судья-докладчик</label>
          <input type="text" id="appeal-judge" placeholder="Судья Смирнов В.П." class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
        </div>
      </div>
    `;

    let detectedCaseNumber = "";
    const prevCase = (activeDebtor.timeline || []).find(s => s.caseNumber);
    if (prevCase) detectedCaseNumber = prevCase.caseNumber;

    if (step) {
      document.getElementById('appeal-acceptance-date').value = step.acceptanceDate || '';
      document.getElementById('appeal-case-number').value = step.caseNumber || detectedCaseNumber;
      document.getElementById('appeal-judge').value = step.judgeName || '';
    } else {
      document.getElementById('appeal-case-number').value = detectedCaseNumber;
    }

    logicOutput.innerHTML = `
      <div class="p-3.5 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800 font-semibold leading-relaxed">
        Дело перешло на этап апелляционного обжалования. Исполнение решения первой инстанции приостановлено до вынесения постановления.
      </div>
    `;

  } else if (stageType === "Результат апелляции") {
    container.innerHTML = `
      <div class="space-y-3 animate-fade-in">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Дата постановления</label>
          <input type="date" id="appeal-result-date" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Результат рассмотрения</label>
          <select id="appeal-result" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500 bg-white">
            <option value="Оставлено в силе">Оставлено в силе (Победа в суде)</option>
            <option value="Отменено">Отменено (Решение первой инстанции отменено)</option>
          </select>
        </div>
      </div>
    `;

    if (step) {
      document.getElementById('appeal-result-date').value = step.resultDate || '';
      document.getElementById('appeal-result').value = step.appealResult || 'Оставлено в силе';
    }

    const updateAppealResultLogic = () => {
      const res = document.getElementById('appeal-result').value;
      if (res === "Оставлено в силе") {
        logicOutput.innerHTML = `
          <div class="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs space-y-2 font-bold">
            <p>🎉 Решение Арбитражного суда оставлено в силе и немедленно вступило в силу! Запустите процесс получения Исполнительного Листа.</p>
            <button type="button" onclick="window.generateDocument('court')" class="bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-3 rounded text-[10px] transition shadow-sm w-full active:scale-95">
              Скачать шаблон запроса на выдачу ИЛ (.doc)
            </button>
          </div>
        `;
      } else {
        logicOutput.innerHTML = `
          <div class="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold leading-relaxed">
            🛑 ВНИМАНИЕ: Апелляция отменила или изменила решение суда. Требуется внимательное изучение текста постановления.
          </div>
        `;
      }
    };

    document.getElementById('appeal-result').addEventListener('change', updateAppealResultLogic);
    updateAppealResultLogic();

  } else if (stageType === "Направление ИЛ в ФССП") {
    container.innerHTML = `
      <div class="space-y-3 animate-fade-in">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Дата направления заявления в ФССП</label>
          <input type="date" id="fssp-sent-date" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">ШПИ почтового отправления</label>
          <input type="text" id="fssp-tracking" placeholder="14-значный трек-номер" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500 font-mono">
        </div>
      </div>
    `;

    if (step) {
      document.getElementById('fssp-sent-date').value = step.sentDate || '';
      document.getElementById('fssp-tracking').value = step.trackingNumber || '';
    }

    logicOutput.innerHTML = `
      <div class="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-2 font-bold text-blue-800">
        <p>Исполнительный лист направлен судебным приставам. Вы можете скачать заявление на возбуждение производства:</p>
        <button type="button" onclick="window.generateDocument('bailiff')" class="bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-3 rounded text-[10px] transition shadow-sm w-full active:scale-95">
          Скачать шаблон заявления судебным приставам (.doc)
        </button>
      </div>
    `;

  } else if (stageType === "Возбуждение ИП") {
    container.innerHTML = `
      <div class="space-y-3 animate-fade-in">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Дата постановления о возбуждении ИП</label>
          <input type="date" id="ip-init-date" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Номер исполнительного производства</label>
          <input type="text" id="ip-number" placeholder="Например: 12345/26/50001-ИП" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500 font-mono">
        </div>
      </div>
    `;

    if (step) {
      document.getElementById('ip-init-date').value = step.initiationDate || '';
      document.getElementById('ip-number').value = step.ipNumber || '';
    }

    logicOutput.innerHTML = `
      <div class="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold text-blue-800 space-y-1.5">
        <p class="font-bold text-[10px] uppercase block tracking-wider">🎯 СРОК ПРИНУДИТЕЛЬНОГО ИСПОЛНЕНИЯ (2 МЕСЯЦА)</p>
        <p class="leading-relaxed">По закону, требования исполнительного документа должны быть исполнены приставом в течение двух месяцев с даты возбуждения дела.</p>
      </div>
    `;

  } else if (stageType === "Частичная оплата долга") {
    container.innerHTML = `
      <div class="space-y-3 animate-fade-in">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Дата совершения платежа</label>
          <input type="date" id="payment-date" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Сумма поступившей оплаты (₽)</label>
          <input type="number" id="payment-amount" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
        </div>
      </div>
    `;

    if (step) {
      document.getElementById('payment-date').value = step.paymentDate || '';
      document.getElementById('payment-amount').value = step.paymentAmount || '';
    }

    const updatePaymentLogic = () => {
      const initialDebt = Number(activeDebtor.debtAmount || 0);
      let alreadyPaid = 0;
      
      (activeDebtor.timeline || []).forEach(s => {
        if (s.stageName === "Частичная оплата долга" && s.id !== window.editingStageId) {
          alreadyPaid += Number(s.paymentAmount || 0);
        }
      });

      const currentPay = Number(document.getElementById('payment-amount').value || 0);
      const totalPaid = alreadyPaid + currentPay;
      const remaining = Math.max(0, initialDebt - totalPaid);

      logicOutput.innerHTML = `
        <div class="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-2">
          <div class="flex justify-between items-center text-slate-600 font-medium">
            <span>Первоначальная сумма иска:</span>
            <span class="font-bold font-mono">${new Intl.NumberFormat('ru-RU').format(initialDebt)} ₽</span>
          </div>
          <div class="flex justify-between items-center text-emerald-700 font-bold">
            <span>Накопленная оплата:</span>
            <span class="font-mono">${new Intl.NumberFormat('ru-RU').format(totalPaid)} ₽</span>
          </div>
          <div class="flex justify-between items-center pt-2 border-t border-emerald-200 text-slate-900 font-black">
            <span>Актуальный долг:</span>
            <span class="font-mono text-sm text-brand-600">${new Intl.NumberFormat('ru-RU').format(remaining)} ₽</span>
          </div>
        </div>
      `;
    };

    document.getElementById('payment-amount').addEventListener('input', updatePaymentLogic);
    updatePaymentLogic();

  } else if (stageType === "Жалоба на ФССП") {
    container.innerHTML = `
      <div class="space-y-3 animate-fade-in">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Дата подачи жалобы</label>
          <input type="date" id="complaint-date" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Суть нарушения судебного пристава</label>
          <textarea id="complaint-essence" rows="2" placeholder="Затягивание процесса, отсутствие ареста банковских счетов должника..." class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500"></textarea>
        </div>
      </div>
    `;

    if (step) {
      document.getElementById('complaint-date').value = step.complaintDate || '';
      document.getElementById('complaint-essence').value = step.complaintEssence || '';
    }

    logicOutput.innerHTML = `
      <div class="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-800 space-y-1">
        <p class="font-bold text-[10px] uppercase">⚡ СРОК РАССМОТРЕНИЯ ЖАЛОБЫ (10 ДНЕЙ)</p>
        <p class="leading-relaxed">Поданная в порядке подчиненности жалоба на бездействие приставов должна быть рассмотрена руководителем РОСП в течение 10 дней.</p>
      </div>
    `;

  } else if (stageType === "Окончание ИП") {
    container.innerHTML = `
      <div class="space-y-3 animate-fade-in">
        <div>
          <label class="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Законное основание прекращения/окончания</label>
          <select id="ip-closure-reason" class="w-full p-2 border border-slate-300 rounded text-xs font-semibold focus:ring-2 focus:ring-brand-500 bg-white">
            <option value="Фактическое исполнение (полное погашение)">Фактическое исполнение (полное погашение)</option>
            <option value="Ст. 46 ч. 1 п. 3 (невозможно установить местонахождение должника/имущества)">Ст. 46 ч. 1 п. 3 (невозможно установить местонахождение)</option>
            <option value="Ст. 46 ч. 1 п. 4 (у должника отсутствует имущество, на которое может быть обращено взыскание)">Ст. 46 ч. 1 п. 4 (отсутствует имущество)</option>
            <option value="Мировое соглашение">Мировое соглашение</option>
          </select>
        </div>
      </div>
    `;

    if (step) {
      document.getElementById('ip-closure-reason').value = step.closureReason || 'Фактическое исполнение (полное погашение)';
    }

    logicOutput.innerHTML = `
      <div class="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-800 space-y-1">
        <p class="text-[10px] uppercase">📁 АРХИВАЦИЯ КАРТОЧКИ ДОЛЖНИКА</p>
        <p class="leading-relaxed font-medium text-[11px]">После сохранения данного этапа должник перейдет в финальный статус «Завершено» и его карточка в реестре визуально потухнет (будет обесцвечена).</p>
      </div>
    `;
  }
};

// Глобальные генераторы ссылок для календарей
window.getGoogleCalendarUrl = function(debtorId, title, targetDateStr, description) {
  const debtor = currentDebtorsList.find(d => d.id === debtorId);
  if (!debtor) return "#";
  if (!targetDateStr) return "#";

  const dateParts = targetDateStr.split('-');
  if (dateParts.length !== 3) return "#";
  const y = dateParts[0];
  const m = dateParts[1];
  const d = dateParts[2];

  // Для события "Весь день" в Google Календаре конечная дата должна быть следующим днем
  const currentDate = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d)));
  const nextDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);

  const ny = nextDate.getUTCFullYear();
  const nm = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
  const nd = String(nextDate.getUTCDate()).padStart(2, '0');

  const startGoogleDate = `${y}${m}${d}`;
  const endGoogleDate = `${ny}${nm}${nd}`;

  const fullTitle = `${title}: ${debtor.name}`;
  const fullDescription = `${description}\n\nСистема ОБЛБЫТГАЗ: ВЗЫСКАНИЕ`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(fullTitle)}&details=${encodeURIComponent(fullDescription)}&dates=${startGoogleDate}/${endGoogleDate}`;
};

window.getYandexCalendarUrl = function(debtorId, title, targetDateStr, description) {
  const debtor = currentDebtorsList.find(d => d.id === debtorId);
  if (!debtor) return "#";
  if (!targetDateStr) return "#";

  // Яндекс принимает ISO 8601 (YYYY-MM-DDTHH:mm:ss) и ставит событие на весь день через параметр all_day=1
  const dateTimeStr = `${targetDateStr}T09:00:00`;
  const fullTitle = `${title}: ${debtor.name}`;
  const fullDescription = `${description}\n\nСистема ОБЛБЫТГАЗ: ВЗЫСКАНИЕ`;

  return `https://calendar.yandex.ru/ext/insert/app?name=${encodeURIComponent(fullTitle)}&desc=${encodeURIComponent(fullDescription)}&start_ts=${encodeURIComponent(dateTimeStr)}&all_day=1`;
};

// Сохранение динамического этапа в хронологию должника
window.saveDynamicStage = async function() {
  const activeDebtor = currentDebtorsList.find(d => d.id === window.activeDebtorId);
  if (!activeDebtor) return;

  const selector = document.getElementById('stage-type-selector');
  const stageType = selector ? selector.value : "Претензия";
  const comment = document.getElementById('stage-comment').value;

  // Формируем поля этапа
  const stageData = {
    id: window.editingStageId || "step_dyn_" + Date.now(),
    stageName: stageType,
    comment: comment || "",
    date: new Date().toISOString().split("T")[0]
  };

  if (stageType === "Претензия") {
    stageData.sentDate = document.getElementById('claim-sent-date').value;
    stageData.receivedDate = document.getElementById('claim-received-date').value;
    stageData.claimAmount = Number(document.getElementById('claim-amount').value || 0);
    stageData.deadlineType = document.getElementById('claim-deadline-type').value;
    stageData.trackingNumber = document.getElementById('claim-tracking').value;
    stageData.email = document.getElementById('claim-email').value;
    if (stageData.sentDate) stageData.date = stageData.sentDate;
  } else if (stageType === "Судебный приказ") {
    stageData.caseNumber = document.getElementById('order-number').value;
    stageData.judgeName = document.getElementById('order-judge').value;
    stageData.rulingDate = document.getElementById('order-ruling-date').value;
    stageData.decisionText = document.getElementById('order-decision').value;
    if (stageData.rulingDate) stageData.date = stageData.rulingDate;
  } else if (stageType === "Отмена судебного приказа") {
    stageData.rulingDate = document.getElementById('cancel-ruling-date').value;
    if (stageData.rulingDate) stageData.date = stageData.rulingDate;
  } else if (stageType === "Подача искового заявления") {
    stageData.acceptanceDate = document.getElementById('claim-acceptance-date').value;
    stageData.procedureType = document.getElementById('claim-review-period').value;
    stageData.caseNumber = document.getElementById('claim-case-number').value;
    stageData.judgeName = document.getElementById('claim-judge').value;
    if (stageData.acceptanceDate) stageData.date = stageData.acceptanceDate;
  } else if (stageType === "Вынесение решения") {
    stageData.decisionDate = document.getElementById('decision-date').value;
    stageData.decisionAmount = Number(document.getElementById('decision-amount').value || 0);
    stageData.caseNumber = document.getElementById('decision-case-number').value;
    stageData.decisionText = document.getElementById('decision-text').value;
    if (stageData.decisionDate) stageData.date = stageData.decisionDate;
  } else if (stageType === "Апелляция") {
    stageData.acceptanceDate = document.getElementById('appeal-acceptance-date').value;
    stageData.caseNumber = document.getElementById('appeal-case-number').value;
    stageData.judgeName = document.getElementById('appeal-judge').value;
    if (stageData.acceptanceDate) stageData.date = stageData.acceptanceDate;
  } else if (stageType === "Результат апелляции") {
    stageData.resultDate = document.getElementById('appeal-result-date').value;
    stageData.appealResult = document.getElementById('appeal-result').value;
    if (stageData.resultDate) stageData.date = stageData.resultDate;
  } else if (stageType === "Направление ИЛ в ФССП") {
    stageData.sentDate = document.getElementById('fssp-sent-date').value;
    stageData.trackingNumber = document.getElementById('fssp-tracking').value;
    if (stageData.sentDate) stageData.date = stageData.sentDate;
  } else if (stageType === "Возбуждение ИП") {
    stageData.initiationDate = document.getElementById('ip-init-date').value;
    stageData.ipNumber = document.getElementById('ip-number').value;
    if (stageData.initiationDate) stageData.date = stageData.initiationDate;
  } else if (stageType === "Частичная оплата долга") {
    stageData.paymentDate = document.getElementById('payment-date').value;
    stageData.paymentAmount = Number(document.getElementById('payment-amount').value || 0);
    if (stageData.paymentDate) stageData.date = stageData.paymentDate;
  } else if (stageType === "Жалоба на ФССП") {
    stageData.complaintDate = document.getElementById('complaint-date').value;
    stageData.complaintEssence = document.getElementById('complaint-essence').value;
    if (stageData.complaintDate) stageData.date = stageData.complaintDate;
  } else if (stageType === "Окончание ИП") {
    stageData.closureReason = document.getElementById('ip-closure-reason').value;
  }

  const existingTimeline = activeDebtor.timeline || [];
  let newTimeline = [];

  if (window.editingStageId) {
    // Редактируем имеющийся шаг
    newTimeline = existingTimeline.map(s => s.id === window.editingStageId ? { ...s, ...stageData } : s);
  } else {
    // Добавляем абсолютно новый шаг
    newTimeline = [...existingTimeline, stageData];
  }

  // Сортировка по дате
  newTimeline.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Вычисление нового глобального статуса по этапу
  let newStatus = activeDebtor.status || "Претензия";
  if (stageType === "Окончание ИП") {
    newStatus = "Завершено";
  } else if ([
    "Направление ИЛ в ФССП", 
    "Возбуждение ИП", 
    "Частичная оплата долга", 
    "Жалоба на ФССП"
  ].includes(stageType)) {
    newStatus = "Исполнительное производство";
  } else if ([
    "Судебный приказ", 
    "Отмена судебного приказа", 
    "Подача искового заявления", 
    "Вынесение решения", 
    "Апелляция", 
    "Результат апелляции"
  ].includes(stageType)) {
    newStatus = "Судебный спор";
  } else if (stageType === "Претензия") {
    newStatus = "Претензия";
  }

  await debtorsService.updateDebtor(window.activeDebtorId, {
    timeline: newTimeline,
    status: newStatus
  });

  openDebtorDossier(window.activeDebtorId);
  showToast("Этап успешно сохранен в реестр!", "success");
};

// Удаление этапа из хронологии
window.deleteCurrentStage = async function() {
  if (!window.editingStageId) return;
  const activeDebtor = currentDebtorsList.find(d => d.id === window.activeDebtorId);
  if (!activeDebtor) return;

  if (!confirm("Вы уверены, что хотите безвозвратно удалить этот этап из хронологии?")) return;

  const existingTimeline = activeDebtor.timeline || [];
  const newTimeline = existingTimeline.filter(s => s.id !== window.editingStageId);

  // Перевычисляем глобальный статус должника на основе последнего оставшегося шага
  let newStatus = "Претензия";
  const userStages = newTimeline.filter(s => !s.system);
  if (userStages.length > 0) {
    const latestStage = userStages[userStages.length - 1];
    const stageType = latestStage.stageName;
    if (stageType === "Окончание ИП") {
      newStatus = "Завершено";
    } else if ([
      "Направление ИЛ в ФССП", 
      "Возбуждение ИП", 
      "Частичная оплата долга", 
      "Жалоба на ФССП"
    ].includes(stageType)) {
      newStatus = "Исполнительное производство";
    } else if ([
      "Судебный приказ", 
      "Отмена судебного приказа", 
      "Подача искового заявления", 
      "Вынесение решения", 
      "Апелляция", 
      "Результат апелляции"
    ].includes(stageType)) {
      newStatus = "Судебный спор";
    } else if (stageType === "Претензия") {
      newStatus = "Претензия";
    }
  }

  await debtorsService.updateDebtor(window.activeDebtorId, {
    timeline: newTimeline,
    status: newStatus
  });

  window.editingStageId = null;
  openDebtorDossier(window.activeDebtorId);
  showToast("Этап успешно удален из хронологии должника", "success");
};

// Добавление абсолютно нового должника через модальное окно
window.submitDebtor = async function(e) {
  e.preventDefault();
  
  const name = document.getElementById('add-name').value;
  const inn = document.getElementById('add-inn').value;
  const kpp = document.getElementById('add-kpp').value;
  const ogrn = document.getElementById('add-ogrn').value;
  const address = document.getElementById('add-address').value;
  const debtAmount = document.getElementById('add-amount').value;

  if (!name || !inn || !debtAmount) {
    showToast("Заполните обязательные поля карточки (ИНН, Сумма)!", "warning");
    return;
  }

  await debtorsService.addDebtor({ name, inn, kpp, ogrn, address, debtAmount });
  
  // Закрываем и чистим
  closeAddDebtorModal();
};

// ==========================================
// 10. ГЕНЕРАЦИЯ ОФИЦИАЛЬНЫХ СУДЕБНЫХ ДОКУМЕНТОВ
// ==========================================

// Вспомогательная функция форматирования дат на русском
function formatDateRu(dateStr) {
  if (!dateStr) return '«___» _________ 2026 г.';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('ru-RU');
}

// Шаблон 1: Заявление о выдаче исполнительного листа
const getCourtILTemplate = (debtor, stage) => {
  const caseNumber = stage.caseNumber || '—';
  const date = formatDateRu(stage.decisionDate || stage.date);
  const decisionText = stage.decisionText || '—';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Заявление о выдаче исполнительного листа</title>
  <style>
    body { font-family: 'Times New Roman', Times, serif; line-height: 1.6; padding: 40px; color: #000; }
    .title { text-align: center; font-weight: bold; font-size: 16px; margin-top: 30px; margin-bottom: 30px; text-transform: uppercase; }
    .content { font-size: 14px; text-indent: 1.25cm; text-align: justify; }
  </style>
</head>
<body>
  <div style="text-align: right; margin-left: 40%; font-size: 12pt; font-family: 'Times New Roman', serif;">
    В <b>Арбитражный суд Кировской области</b><br><br>
    <b>Истец:</b> ООО «Областная организация бытового газового обслуживания»<br>
    Адрес: 610014, Кировская область, город Киров, ул. Ивана Попова, д. 61, литер а помещение 28<br><br>
    <b>Представитель:</b> Кошурников И.А. (по доверенности)<br><br>
    <b>Ответчик:</b> ${debtor.name}<br>
    ИНН: ${debtor.inn || '—'}, ОГРН: ${debtor.ogrn || '—'}, адрес: ${debtor.address || '—'}<br><br>
    <b>Дело №:</b> ${caseNumber}
  </div>

  <div class="title" style="text-align: center; font-weight: bold; font-size: 14pt; margin-top: 30px; margin-bottom: 30px;">
    Заявление о выдаче исполнительного листа
  </div>

  <p class="content" style="text-align: justify; text-indent: 1.25cm; font-size: 12pt;">
    ${date} Арбитражным судом Кировской области объявлено решение по делу ${caseNumber}. Предмет исполнения: ${decisionText}. На основании изложенного и руководствуясь ст. 319 АПК РФ, прошу выдать исполнительный лист на принудительное исполнение судебного решения. Исполнительный лист направить истцу по адресу: 610014, Кировская область, город Киров, ул. Ивана Попова, д. 61, литер а помещение 28.
  </p>

  <div style="margin-top: 50px; font-size: 12pt; width: 100%;">
    <table style="width: 100%; border: none;">
      <tr>
        <td style="width: 60%; vertical-align: top; font-weight: bold;">
          Представитель по доверенности
        </td>
        <td style="width: 40%; text-align: right; vertical-align: top; font-weight: bold; border-bottom: 1px solid #000;">
          Кошурников И.А.
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
};

// Шаблон 2: Направление судебного приказа в ФССП
const getFSSPOrderTemplate = (debtor, stage) => {
  const caseNumber = stage.caseNumber || '—';
  const date = formatDateRu(stage.rulingDate || stage.date);
  const decisionText = stage.decisionText || '—';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Заявление о возбуждении исполнительного производства</title>
</head>
<body style="font-family: 'Times New Roman', serif; line-height: 1.5; padding: 40px; font-size: 12pt;">
  <div style="text-align: right; margin-left: 45%;">
    В <b>Главное управление ФССП по Кировской области</b><br>
    г. Киров, ул. Московская, д.57<br><br>
    <b>Заявитель:</b> ООО «Облбытгаз»<br>
    ИНН: 4345499999, КПП: 434501001<br>
    Адрес: 610014, Кировская область, г. Киров, ул. Ивана Попова, д. 61, литер а помещение 28<br><br>
    <b>Должник:</b> ${debtor.name}<br>
    (ИНН ${debtor.inn || '—'}, ОГРН ${debtor.ogrn || '—'}, адрес: ${debtor.address || '—'})
  </div>

  <div style="text-align: center; font-weight: bold; margin-top: 40px; margin-bottom: 30px; font-size: 14pt;">
    ЗАЯВЛЕНИЕ<br>о возбуждении исполнительного производства
  </div>

  <p style="text-align: justify; text-indent: 1.25cm;">
    Прошу возбудить исполнительное производство на основании судебного приказа от ${date}, выданного Арбитражным судом Кировской области по делу № ${caseNumber}. Предмет исполнения: ${decisionText}. В отношении должника: ${debtor.name} (ИНН ${debtor.inn || '—'}, ОГРН ${debtor.ogrn || '—'}, адрес: ${debtor.address || '—'}). Взысканные денежные средства прошу перечислить на: Банк ТОЧКА, р/с 40702810502500073160, к/с 30101810745374525104, БИК 044525104. В случае возврата направить по адресу: 610035, Киров, Попова 61, пом 37. Контакт: Кошурников И.А. +79536771234.
  </p>

  <p style="text-align: justify; margin-top: 30px;">
    <b>Приложение:</b> судебный приказ от ${date} по делу № ${caseNumber}.
  </p>

  <div style="margin-top: 50px; width: 100%;">
    <table style="width: 100%; border: none;">
      <tr>
        <td style="width: 60%; vertical-align: top; font-weight: bold;">
          Генеральный директор ООО «Облбытгаз»
        </td>
        <td style="width: 40%; text-align: right; vertical-align: top; font-weight: bold; border-bottom: 1px solid #000;">
          А.А. Жуйков
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
};

// Шаблон 3: Направление Исполнительного Листа в ФССП
const getFSSPILTemplate = (debtor, stage, ilData) => {
  const caseNumber = stage.caseNumber || '—';
  const decisionText = stage.decisionText || '—';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Заявление о возбуждении исполнительного производства</title>
</head>
<body style="font-family: 'Times New Roman', serif; line-height: 1.5; padding: 40px; font-size: 12pt;">
  <div style="text-align: right; margin-left: 45%;">
    В <b>Главное управление ФССП по Кировской области</b><br>
    г. Киров, ул. Московская, д.57<br><br>
    <b>Заявитель:</b> ООО «Облбытгаз»<br>
    ИНН: 4345499999, КПП: 434501001<br>
    Адрес: 610014, Кировская область, г. Киров, ул. Ивана Попова, д. 61, литер а помещение 28<br><br>
    <b>Должник:</b> ${debtor.name}<br>
    (ИНН ${debtor.inn || '—'}, ОГРН ${debtor.ogrn || '—'}, адрес: ${debtor.address || '—'})
  </div>

  <div style="text-align: center; font-weight: bold; margin-top: 40px; margin-bottom: 30px; font-size: 14pt;">
    ЗАЯВЛЕНИЕ<br>о возбуждении исполнительного производства
  </div>

  <p style="text-align: justify; text-indent: 1.25cm;">
    Прошу возбудить исполнительное производство на основании исполнительного листа серии ${ilData}, выданного Арбитражным судом Кировской области по делу № ${caseNumber}. Предмет исполнения: ${decisionText}. В отношении должника: ${debtor.name} (ИНН ${debtor.inn || '—'}, ОГРН ${debtor.ogrn || '—'}, адрес: ${debtor.address || '—'}). Взысканные денежные средства прошу перечислить на: Банк ТОЧКА, р/с 40702810502500073160, к/с 30101810745374525104, БИК 044525104. В случае возврата направить по адресу: 610035, Киров, Попова 61, пом 37. Контакт: Кошурников И.А. +79536771234.
  </p>

  <p style="text-align: justify; margin-top: 30px;">
    <b>Приложение:</b> исполнительный лист серии ${ilData} по делу № ${caseNumber}.
  </p>

  <div style="margin-top: 50px; width: 100%;">
    <table style="width: 100%; border: none;">
      <tr>
        <td style="width: 60%; vertical-align: top; font-weight: bold;">
          Генеральный директор ООО «Облбытгаз»
        </td>
        <td style="width: 40%; text-align: right; vertical-align: top; font-weight: bold; border-bottom: 1px solid #000;">
          А.А. Жуйков
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
};

// Функция-скачиватель HTML как Word-документа
window.generateDocument = function(type) {
  const debtor = currentDebtorsList.find(d => String(d.id) === String(window.activeDebtorId));
  if (!debtor) return;

  const timeline = debtor.timeline || [];
  let docContent = '';
  let filename = '';

  if (type === 'court' || type === 'court_il') {
    // Для Заявления на ИЛ: ищи последний этап с типом "Вынесение решения".
    let stage = [...timeline].reverse().find(s => s.stageName === "Вынесение решения");
    if (!stage) {
      stage = [...timeline].reverse().find(s => s.caseNumber);
    }
    if (!stage) {
      stage = { caseNumber: '—', decisionText: '—' };
    }
    docContent = getCourtILTemplate(debtor, stage);
    filename = `zayavlenie_il_${debtor.inn}.doc`;
  } else if (type === 'fssp_order') {
    // Для Направления Приказа: ищи последний этап с типом "Судебный приказ".
    let stage = [...timeline].reverse().find(s => s.stageName === "Судебный приказ");
    if (!stage) {
      stage = [...timeline].reverse().find(s => s.caseNumber);
    }
    if (!stage) {
      stage = { caseNumber: '—', decisionText: '—', rulingDate: '', date: '' };
    }
    docContent = getFSSPOrderTemplate(debtor, stage);
    filename = `napravlenie_prikaza_fssp_${debtor.inn}.doc`;
  } else if (type === 'fssp_il' || type === 'bailiff') {
    // Вместо блокируемого браузером prompt() открываем наш кастомный модал
    window.pendingILType = type;
    const inputField = document.getElementById('modal-il-input-field');
    if (inputField) {
      inputField.value = debtor.ilData || '';
    }
    const modal = document.getElementById('modal-input-il');
    if (modal) {
      modal.classList.remove('hidden');
    }
    return;
  } else {
    showToast("Неизвестный тип документа!", "error");
    return;
  }

  const blob = new Blob([docContent], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Документ успешно сформирован и скачан!`, "success");
};

// Функции управления модальным окном ИЛ
window.closeILModal = function() {
  const modal = document.getElementById('modal-input-il');
  if (modal) {
    modal.classList.add('hidden');
  }
};

window.submitILModal = async function() {
  const inputField = document.getElementById('modal-il-input-field');
  const ilVal = inputField ? inputField.value.trim() : "";
  
  if (!ilVal) {
    showToast("Необходимо указать данные исполнительного листа!", "warning");
    return;
  }

  const debtor = currentDebtorsList.find(d => String(d.id) === String(window.activeDebtorId));
  if (!debtor) {
    window.closeILModal();
    return;
  }

  const timeline = debtor.timeline || [];
  let stage = [...timeline].reverse().find(s => s.stageName === "Вынесение решения");
  if (!stage) {
    stage = [...timeline].reverse().find(s => s.caseNumber);
  }
  if (!stage) {
    stage = { caseNumber: '—', decisionText: '—' };
  }

  debtor.ilData = ilVal;
  const docContent = getFSSPILTemplate(debtor, stage, ilVal);
  const filename = `napravlenie_il_fssp_${debtor.inn}.doc`;

  // Скачиваем файл
  const blob = new Blob([docContent], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Документ успешно сформирован и скачан!`, "success");
  window.closeILModal();

  // Асинхронно обновляем БД/хранилище
  await debtorsService.updateDebtor(debtor.id, { ilData: ilVal });
};

// ==========================================
// 11. ГЛОБАЛЬНЫЕ UI-ЭЛЕМЕНТЫ & УВЕДОМЛЕНИЯ
// ==========================================
// Toast-уведомление
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-5 right-5 z-50 flex items-center space-x-2 px-5 py-3.5 rounded-xl text-xs font-bold text-white shadow-2xl border transition-all duration-300 transform translate-y-10 opacity-0`;
  
  if (type === 'success') {
    toast.className += ' bg-emerald-600 border-emerald-500';
    toast.innerHTML = `<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>${message}</span>`;
  } else if (type === 'warning') {
    toast.className += ' bg-amber-600 border-amber-500';
    toast.innerHTML = `<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg><span>${message}</span>`;
  } else {
    toast.className += ' bg-rose-600 border-rose-500';
    toast.innerHTML = `<svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>${message}</span>`;
  }

  document.body.appendChild(toast);
  
  // Анимация входа
  setTimeout(() => {
    toast.classList.remove('translate-y-10', 'opacity-0');
  }, 10);

  // Анимация выхода
  setTimeout(() => {
    toast.classList.add('translate-y-10', 'opacity-0');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// Изменение баджа состояния связи с базой данных
function updateDbBadgeStatus(status, label) {
  const badge = document.getElementById('db-status-badge');
  const dot = document.getElementById('db-status-dot');
  const text = document.getElementById('db-status-text');
  const demoBanner = document.getElementById('demo-banner');

  if (status === 'active') {
    badge.className = "flex items-center space-x-1.5 px-3 py-1 bg-emerald-950 border border-emerald-800 rounded-full text-xs font-bold text-emerald-400";
    dot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
    text.textContent = label;
    demoBanner.classList.add('hidden');
  } else {
    badge.className = "flex items-center space-x-1.5 px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-semibold text-slate-400";
    dot.className = "w-2 h-2 rounded-full bg-indigo-500 animate-pulse";
    text.textContent = label;
    demoBanner.classList.remove('hidden');
  }
}

// ==========================================
// 12. ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ МОДАЛЬНЫХ ОКОН
// ==========================================
window.showAddDebtorModal = function() {
  document.getElementById('modal-add-debtor').classList.remove('hidden');
  document.getElementById('add-inn').focus();
};

window.closeAddDebtorModal = function() {
  document.getElementById('modal-add-debtor').classList.add('hidden');
  document.getElementById('add-debtor-form').reset();
  document.getElementById('dadata-feedback').classList.add('hidden');
};

window.deleteActiveDebtor = function() {
  const activeDebtor = currentDebtorsList.find(d => d.id === window.activeDebtorId);
  if (!activeDebtor) return;

  document.getElementById('delete-debtor-name').textContent = activeDebtor.name;
  document.getElementById('modal-delete-debtor').classList.remove('hidden');
};

window.closeDeleteDebtorModal = function() {
  document.getElementById('modal-delete-debtor').classList.add('hidden');
};

window.confirmDeleteDebtor = async function() {
  if (!window.activeDebtorId) return;
  
  const debtorId = window.activeDebtorId;
  window.closeDeleteDebtorModal();
  
  // Navigate back to dashboard first so that we don't try to render deleted data
  window.appRouter.navigate('dashboard');
  
  await debtorsService.deleteDebtor(debtorId);
};

// Экспортная панель для скачивания index.html и app.js (сборка на GitHub)
let currentExportTab = 'html';

window.showExportPanel = async function() {
  document.getElementById('modal-export').classList.remove('hidden');
  
  try {
    const htmlRes = await fetch('/index.html');
    const htmlText = await htmlRes.text();
    document.getElementById('code-block-html').textContent = htmlText;
    
    const jsRes = await fetch('/app.js');
    const jsText = await jsRes.text();
    document.getElementById('code-block-js').textContent = jsText;
  } catch (e) {
    document.getElementById('code-block-html').textContent = "Не удалось загрузить живой код. Вы можете найти его в корне проекта.";
    document.getElementById('code-block-js').textContent = "Не удалось загрузить живой код. Вы можете найти его в корне проекта.";
  }
};

window.closeExportPanel = function() {
  document.getElementById('modal-export').classList.add('hidden');
};

window.switchExportTab = function(tab) {
  currentExportTab = tab;
  const btnHtml = document.getElementById('tab-btn-html');
  const btnJs = document.getElementById('tab-btn-js');
  const contentHtml = document.getElementById('export-content-html');
  const contentJs = document.getElementById('export-content-js');

  if (tab === 'html') {
    btnHtml.className = "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 border-brand-500 text-brand-600";
    btnJs.className = "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300";
    contentHtml.classList.remove('hidden');
    contentJs.classList.add('hidden');
  } else {
    btnJs.className = "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 border-brand-500 text-brand-600";
    btnHtml.className = "px-4 py-2 text-xs font-bold uppercase tracking-wider border-b-2 border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300";
    contentJs.classList.remove('hidden');
    contentHtml.classList.add('hidden');
  }
};

window.copyToClipboard = function(tab) {
  const text = document.getElementById(tab === 'html' ? 'code-block-html' : 'code-block-js').textContent;
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Код ${tab === 'html' ? 'index.html' : 'app.js'} успешно скопирован!`, "success");
  }).catch(() => {
    showToast("Не удалось скопировать. Выделите текст вручную.", "error");
  });
};

window.downloadReleaseFile = function() {
  const tab = currentExportTab;
  const text = document.getElementById(tab === 'html' ? 'code-block-html' : 'code-block-js').textContent;
  const filename = tab === 'html' ? 'index.html' : 'app.js';
  const type = tab === 'html' ? 'text/html;charset=utf-8' : 'application/javascript;charset=utf-8';

  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Файл ${filename} сохранен на устройство!`, "success");
};

// Поиск и фильтры на Дашборде
document.getElementById('search-input').addEventListener('input', (e) => {
  searchQuery = e.target.value.trim();
  renderDashboard(currentDebtorsList);
});

window.setFilter = function(filter) {
  currentFilter = filter;
  
  // Обновляем визуальный активный статус у кнопок фильтров
  const filters = ['all', 'claim', 'court', 'bailiff', 'done'];
  const filterMap = {
    'all': 'all',
    'Претензия': 'claim',
    'Судебный спор': 'court',
    'Исполнительное производство': 'bailiff',
    'Завершено': 'done'
  };

  filters.forEach(f => {
    const btn = document.getElementById(`filter-btn-${f}`);
    if (btn) {
      btn.className = "px-3.5 py-1.5 rounded-lg text-xs font-bold transition border border-slate-200 bg-white text-slate-600 hover:bg-slate-50";
    }
  });

  const activeBtn = document.getElementById(`filter-btn-${filterMap[filter] || 'all'}`);
  if (activeBtn) {
    activeBtn.className = "px-3.5 py-1.5 rounded-lg text-xs font-bold transition border border-slate-200 bg-brand-600 text-white shadow-sm";
  }

  renderDashboard(currentDebtorsList);
};

// ПОДПИСЫВАЕМСЯ НА ОБНОВЛЕНИЯ РЕЕСТРА
debtorsService.subscribe((list) => {
  currentDebtorsList = list;
  renderDashboard(list);
  
  // Если у нас открыта детальная страница, перерисовываем ее в реальном времени
  if (window.activeDebtorId) {
    openDebtorDossier(window.activeDebtorId);
  }
});
