/**
 * ナイトワーク店舗向けCRM - フロントエンドアプリケーション
 * Mobile-first SPA with Vanilla JS
 */

// ========================================
// State Management
// ========================================
const AppState = {
  user: null,
  customers: [],
  todos: [],
  templates: [],
  currentView: 'login',
  currentCustomer: null,
  sessionId: null, // Store session ID from cookie
};

// ========================================
// API Client
// ========================================
const API = {
  baseURL: '',
  
  async request(method, path, body = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important: Include cookies
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    try {
      const response = await fetch(`${this.baseURL}${path}`, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },
  
  // Auth
  async login(email, password) {
    return this.request('POST', '/api/auth/login', { email, password });
  },
  
  async logout() {
    return this.request('POST', '/api/auth/logout');
  },
  
  async getMe() {
    return this.request('GET', '/api/auth/me');
  },
  
  // Customers
  async getCustomers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request('GET', `/api/customers${query ? '?' + query : ''}`);
  },
  
  async getCustomer(id) {
    return this.request('GET', `/api/customers/${id}`);
  },
  
  async updateCustomer(id, data) {
    return this.request('PATCH', `/api/customers/${id}`, data);
  },
  
  async addVisit(customerId, visitData) {
    return this.request('POST', `/api/customers/${customerId}/visits`, visitData);
  },
  
  // Todos
  async getTodos(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request('GET', `/api/todos${query ? '?' + query : ''}`);
  },
  
  async updateTodo(id, data) {
    return this.request('PATCH', `/api/todos/${id}`, data);
  },
  
  // Messages
  async sendMessage(data) {
    return this.request('POST', '/api/messages/send', data);
  },
  
  async getDraft(data) {
    return this.request('POST', '/api/messages/draft', data);
  },
  
  // Templates
  async getTemplates() {
    return this.request('GET', '/api/templates');
  },
  
  // Registration Codes
  async createRegistrationCode() {
    return this.request('POST', '/api/registration-codes');
  },
  
  async getActiveCodes() {
    return this.request('GET', '/api/registration-codes/active');
  },
};

// ========================================
// Router
// ========================================
const Router = {
  routes: {},
  
  register(name, renderFn) {
    this.routes[name] = renderFn;
  },
  
  navigate(viewName, params = {}) {
    AppState.currentView = viewName;
    const renderFn = this.routes[viewName];
    
    if (!renderFn) {
      console.error(`Route not found: ${viewName}`);
      return;
    }
    
    const html = renderFn(params);
    document.getElementById('app').innerHTML = html;
    
    // Scroll to top
    window.scrollTo(0, 0);
  },
};

// ========================================
// Views
// ========================================

// --- Login View ---
Router.register('login', () => {
  return `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-400 to-purple-600 px-4">
      <div class="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
          <i class="fas fa-glass-martini-alt text-5xl text-pink-500 mb-4"></i>
          <h1 class="text-3xl font-bold text-gray-800">ナイトワークCRM</h1>
          <p class="text-gray-600 mt-2">顧客管理システム</p>
        </div>
        
        <form id="loginForm" class="space-y-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-envelope mr-2"></i>メールアドレス
            </label>
            <input 
              type="email" 
              id="email" 
              required
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="email@example.com"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              <i class="fas fa-lock mr-2"></i>パスワード
            </label>
            <input 
              type="password" 
              id="password" 
              required
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>
          
          <button 
            type="submit"
            class="w-full bg-pink-500 text-white py-3 rounded-lg font-semibold hover:bg-pink-600 transition duration-200 shadow-lg"
          >
            <i class="fas fa-sign-in-alt mr-2"></i>ログイン
          </button>
          
          <div id="loginError" class="hidden bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            <i class="fas fa-exclamation-circle mr-2"></i>
            <span id="loginErrorMessage"></span>
          </div>
        </form>
        
        <div class="mt-6 text-center text-sm text-gray-600">
          <p>テストアカウント:</p>
          <p class="mt-2">cast1@example.com / password123</p>
        </div>
      </div>
    </div>
  `;
});

// --- Cast Home View ---
Router.register('cast-home', () => {
  const user = AppState.user;
  const todos = AppState.todos.filter(t => t.status === 'pending');
  const todayVisits = AppState.customers.filter(c => {
    // Simplified: just show recent customers
    return true;
  }).slice(0, 5);
  
  return `
    <div class="min-h-screen bg-gray-50">
      <!-- Header -->
      <header class="bg-pink-500 text-white shadow-lg">
        <div class="px-4 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-xl font-bold">
                <i class="fas fa-home mr-2"></i>${user.displayName}さん
              </h1>
              <p class="text-pink-100 text-sm">ホーム画面</p>
            </div>
            <button onclick="handleLogout()" class="text-white hover:text-pink-200">
              <i class="fas fa-sign-out-alt text-xl"></i>
            </button>
          </div>
        </div>
      </header>
      
      <!-- Stats Cards -->
      <div class="px-4 py-4 grid grid-cols-2 gap-4">
        <div class="bg-white rounded-lg shadow p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-600 text-sm">未完了ToDo</p>
              <p class="text-2xl font-bold text-pink-500">${todos.length}</p>
            </div>
            <i class="fas fa-tasks text-3xl text-pink-200"></i>
          </div>
        </div>
        
        <div class="bg-white rounded-lg shadow p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-gray-600 text-sm">総顧客数</p>
              <p class="text-2xl font-bold text-purple-500">${AppState.customers.length}</p>
            </div>
            <i class="fas fa-users text-3xl text-purple-200"></i>
          </div>
        </div>
      </div>
      
      <!-- Todo List -->
      <div class="px-4 py-2">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-bold text-gray-800">
            <i class="fas fa-bell mr-2 text-pink-500"></i>今日のToDo
          </h2>
          <span class="text-sm text-gray-500">${todos.length}件</span>
        </div>
        
        <div class="space-y-3">
          ${todos.length === 0 ? `
            <div class="bg-white rounded-lg shadow p-6 text-center text-gray-500">
              <i class="fas fa-check-circle text-4xl text-green-400 mb-2"></i>
              <p>すべてのToDoが完了しました！</p>
            </div>
          ` : todos.map(todo => {
            const customer = AppState.customers.find(c => c.id === todo.customerId);
            return `
              <div class="bg-white rounded-lg shadow p-4" onclick="handleTodoClick('${todo.id}')">
                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <p class="font-semibold text-gray-800">
                      ${customer ? customer.callName || customer.lineDisplayName : '顧客不明'}
                    </p>
                    <p class="text-sm text-gray-600 mt-1">${todo.reason || 'フォローアップ'}</p>
                    <p class="text-xs text-gray-400 mt-1">
                      <i class="far fa-clock mr-1"></i>${new Date(todo.scheduledFor).toLocaleDateString('ja-JP')}
                    </p>
                  </div>
                  <button 
                    class="bg-pink-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-pink-600"
                    onclick="event.stopPropagation(); handleSendMessage('${customer.id}')"
                  >
                    <i class="fas fa-paper-plane mr-1"></i>送信
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      
      <!-- Bottom Navigation -->
      ${renderBottomNav('home')}
    </div>
  `;
});

// --- Customer List View ---
Router.register('customers', () => {
  const customers = AppState.customers;
  
  return `
    <div class="min-h-screen bg-gray-50 pb-20">
      <!-- Header -->
      <header class="bg-pink-500 text-white shadow-lg sticky top-0 z-10">
        <div class="px-4 py-4">
          <h1 class="text-xl font-bold">
            <i class="fas fa-users mr-2"></i>顧客一覧
          </h1>
        </div>
        
        <!-- Search Bar -->
        <div class="px-4 pb-4">
          <div class="relative">
            <input 
              type="text" 
              id="customerSearch"
              placeholder="顧客名で検索..."
              class="w-full px-4 py-2 pl-10 rounded-lg text-gray-800"
              oninput="handleCustomerSearch(this.value)"
            />
            <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
          </div>
        </div>
      </header>
      
      <!-- Customer List -->
      <div class="px-4 py-4">
        ${customers.length === 0 ? `
          <div class="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            <i class="fas fa-user-plus text-5xl text-gray-300 mb-4"></i>
            <p class="text-lg font-semibold">顧客がいません</p>
            <p class="text-sm mt-2">登録コードを発行して顧客を招待しましょう</p>
            <button 
              onclick="Router.navigate('registration-code')"
              class="mt-4 bg-pink-500 text-white px-6 py-2 rounded-lg hover:bg-pink-600"
            >
              <i class="fas fa-qrcode mr-2"></i>登録コードを発行
            </button>
          </div>
        ` : `
          <div class="space-y-3">
            ${customers.map(customer => {
              const lastVisit = customer.lastVisitDate 
                ? new Date(customer.lastVisitDate).toLocaleDateString('ja-JP')
                : '未来店';
              const daysSince = customer.lastVisitDate
                ? Math.floor((Date.now() - new Date(customer.lastVisitDate)) / (1000 * 60 * 60 * 24))
                : null;
              
              return `
                <div 
                  class="bg-white rounded-lg shadow p-4 hover:shadow-md transition"
                  onclick="handleCustomerClick('${customer.id}')"
                >
                  <div class="flex items-start justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-2">
                        <h3 class="font-semibold text-gray-800">
                          ${customer.callName || customer.lineDisplayName}
                        </h3>
                        ${customer.messagingStatus === 'BLOCKED' ? `
                          <span class="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                            ブロック中
                          </span>
                        ` : ''}
                      </div>
                      
                      <div class="mt-2 text-sm text-gray-600 space-y-1">
                        <p>
                          <i class="far fa-calendar mr-1"></i>
                          最終来店: ${lastVisit}
                          ${daysSince !== null ? `<span class="text-gray-400">(${daysSince}日前)</span>` : ''}
                        </p>
                        <p>
                          <i class="far fa-clock mr-1"></i>
                          登録日: ${new Date(customer.createdAt).toLocaleDateString('ja-JP')}
                        </p>
                      </div>
                      
                      ${customer.tags && customer.tags.length > 0 ? `
                        <div class="mt-2 flex gap-1 flex-wrap">
                          ${customer.tags.map(tag => `
                            <span class="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">
                              ${tag}
                            </span>
                          `).join('')}
                        </div>
                      ` : ''}
                    </div>
                    
                    <i class="fas fa-chevron-right text-gray-400 mt-2"></i>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
      
      <!-- Bottom Navigation -->
      ${renderBottomNav('customers')}
    </div>
  `;
});

// --- Customer Detail View ---
Router.register('customer-detail', (params) => {
  const customer = AppState.currentCustomer;
  
  if (!customer) {
    return `<div class="p-4">顧客が見つかりません</div>`;
  }
  
  const lastVisit = customer.lastVisitDate 
    ? new Date(customer.lastVisitDate).toLocaleDateString('ja-JP')
    : '未来店';
  const daysSince = customer.lastVisitDate
    ? Math.floor((Date.now() - new Date(customer.lastVisitDate)) / (1000 * 60 * 60 * 24))
    : null;
  
  return `
    <div class="min-h-screen bg-gray-50 pb-20">
      <!-- Header -->
      <header class="bg-pink-500 text-white shadow-lg">
        <div class="px-4 py-4">
          <button onclick="Router.navigate('customers')" class="mb-2">
            <i class="fas fa-arrow-left mr-2"></i>戻る
          </button>
          <h1 class="text-xl font-bold">顧客詳細</h1>
        </div>
      </header>
      
      <!-- Customer Info Card -->
      <div class="px-4 py-4">
        <div class="bg-white rounded-lg shadow-lg p-6">
          <div class="text-center mb-6">
            <div class="w-20 h-20 bg-gradient-to-br from-pink-400 to-purple-500 rounded-full mx-auto mb-3 flex items-center justify-center text-white text-3xl font-bold">
              ${(customer.callName || customer.lineDisplayName).charAt(0)}
            </div>
            <h2 class="text-2xl font-bold text-gray-800">
              ${customer.callName || customer.lineDisplayName}
            </h2>
            ${customer.messagingStatus === 'BLOCKED' ? `
              <span class="inline-block mt-2 text-sm bg-red-100 text-red-600 px-3 py-1 rounded-full">
                <i class="fas fa-ban mr-1"></i>ブロック中
              </span>
            ` : ''}
          </div>
          
          <div class="space-y-3 text-sm">
            <div class="flex items-center justify-between py-2 border-b">
              <span class="text-gray-600"><i class="far fa-calendar mr-2"></i>最終来店</span>
              <span class="font-semibold">${lastVisit}</span>
            </div>
            ${daysSince !== null ? `
              <div class="flex items-center justify-between py-2 border-b">
                <span class="text-gray-600"><i class="far fa-clock mr-2"></i>経過日数</span>
                <span class="font-semibold">${daysSince}日</span>
              </div>
            ` : ''}
            <div class="flex items-center justify-between py-2 border-b">
              <span class="text-gray-600"><i class="far fa-clock mr-2"></i>登録日</span>
              <span class="font-semibold">${new Date(customer.createdAt).toLocaleDateString('ja-JP')}</span>
            </div>
          </div>
          
          ${customer.memo ? `
            <div class="mt-4 p-3 bg-yellow-50 rounded-lg">
              <p class="text-sm text-gray-700">
                <i class="fas fa-sticky-note text-yellow-500 mr-2"></i>${customer.memo}
              </p>
            </div>
          ` : ''}
        </div>
        
        <!-- Action Buttons -->
        <div class="mt-4 grid grid-cols-2 gap-3">
          <button 
            onclick="handleAddVisit('${customer.id}')"
            class="bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 shadow-lg"
          >
            <i class="fas fa-plus mr-2"></i>来店登録
          </button>
          <button 
            onclick="handleSendMessage('${customer.id}')"
            class="bg-pink-500 text-white py-3 rounded-lg font-semibold hover:bg-pink-600 shadow-lg"
            ${customer.messagingStatus === 'BLOCKED' ? 'disabled' : ''}
          >
            <i class="fas fa-paper-plane mr-2"></i>メッセージ
          </button>
        </div>
        
        <!-- Edit Button -->
        <button 
          onclick="handleEditCustomer('${customer.id}')"
          class="mt-3 w-full bg-white text-gray-700 py-3 rounded-lg font-semibold border-2 border-gray-300 hover:bg-gray-50"
        >
          <i class="fas fa-edit mr-2"></i>顧客情報を編集
        </button>
      </div>
      
      <!-- Bottom Navigation -->
      ${renderBottomNav()}
    </div>
  `;
});

// --- Registration Code View ---
Router.register('registration-code', () => {
  return `
    <div class="min-h-screen bg-gray-50 pb-20">
      <!-- Header -->
      <header class="bg-pink-500 text-white shadow-lg">
        <div class="px-4 py-4">
          <button onclick="Router.navigate('cast-home')" class="mb-2">
            <i class="fas fa-arrow-left mr-2"></i>戻る
          </button>
          <h1 class="text-xl font-bold">
            <i class="fas fa-qrcode mr-2"></i>登録コード
          </h1>
        </div>
      </header>
      
      <div class="px-4 py-6">
        <div class="bg-white rounded-lg shadow-lg p-6 text-center">
          <i class="fas fa-user-plus text-5xl text-pink-500 mb-4"></i>
          <h2 class="text-xl font-bold text-gray-800 mb-2">新規顧客登録</h2>
          <p class="text-gray-600 text-sm mb-6">
            登録コードを発行して、お客様にLINEで送信してください。<br/>
            有効期限は24時間です。
          </p>
          
          <button 
            onclick="handleGenerateCode()"
            class="bg-pink-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-pink-600 shadow-lg"
          >
            <i class="fas fa-plus-circle mr-2"></i>登録コードを発行
          </button>
          
          <div id="codeDisplay" class="hidden mt-6">
            <div class="bg-gradient-to-br from-pink-50 to-purple-50 border-2 border-pink-300 rounded-lg p-6">
              <p class="text-sm text-gray-600 mb-2">発行されたコード:</p>
              <div class="text-3xl font-mono font-bold text-pink-600 mb-4" id="generatedCode"></div>
              <p class="text-xs text-gray-500 mb-4">
                <i class="far fa-clock mr-1"></i>有効期限: <span id="codeExpiry"></span>
              </p>
              <button 
                onclick="handleCopyCode()"
                class="bg-white text-pink-500 px-6 py-2 rounded-lg border-2 border-pink-500 hover:bg-pink-50 text-sm font-semibold"
              >
                <i class="fas fa-copy mr-2"></i>コードをコピー
              </button>
            </div>
            
            <div class="mt-6 text-left bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <p class="font-semibold text-blue-800 mb-2">
                <i class="fas fa-info-circle mr-1"></i>お客様への案内文例:
              </p>
              <p class="text-blue-700 whitespace-pre-line" id="registrationMessage"></p>
            </div>
          </div>
        </div>
        
        <!-- Active Codes List -->
        <div class="mt-6">
          <h3 class="text-lg font-bold text-gray-800 mb-3">
            <i class="fas fa-list mr-2"></i>有効な登録コード
          </h3>
          <div id="activeCodesList" class="space-y-2">
            <div class="text-center text-gray-500 py-4">読み込み中...</div>
          </div>
        </div>
      </div>
      
      <!-- Bottom Navigation -->
      ${renderBottomNav()}
    </div>
  `;
});

// --- Bottom Navigation Component ---
function renderBottomNav(active = '') {
  const navItems = [
    { id: 'home', icon: 'fas fa-home', label: 'ホーム', view: 'cast-home' },
    { id: 'customers', icon: 'fas fa-users', label: '顧客', view: 'customers' },
    { id: 'code', icon: 'fas fa-qrcode', label: '登録', view: 'registration-code' },
  ];
  
  return `
    <nav class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
      <div class="flex justify-around items-center h-16">
        ${navItems.map(item => `
          <button 
            onclick="Router.navigate('${item.view}')"
            class="flex flex-col items-center justify-center flex-1 h-full ${active === item.id ? 'text-pink-500' : 'text-gray-400'} hover:text-pink-500 transition"
          >
            <i class="${item.icon} text-xl mb-1"></i>
            <span class="text-xs">${item.label}</span>
          </button>
        `).join('')}
      </div>
    </nav>
  `;
}

// ========================================
// Event Handlers
// ========================================

async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('loginError');
  const errorMessage = document.getElementById('loginErrorMessage');
  
  try {
    errorDiv.classList.add('hidden');
    
    const response = await API.login(email, password);
    AppState.user = response.user;
    
    // Load initial data
    await loadInitialData();
    
    // Navigate to home
    Router.navigate('cast-home');
  } catch (error) {
    errorDiv.classList.remove('hidden');
    errorMessage.textContent = error.message || 'ログインに失敗しました';
  }
}

async function handleLogout() {
  if (!confirm('ログアウトしますか？')) return;
  
  try {
    await API.logout();
    AppState.user = null;
    AppState.customers = [];
    AppState.todos = [];
    Router.navigate('login');
  } catch (error) {
    alert('ログアウトに失敗しました: ' + error.message);
  }
}

async function loadInitialData() {
  try {
    // Load customers and todos in parallel
    const [customersData, todosData, templatesData] = await Promise.all([
      API.getCustomers(),
      API.getTodos({ status: 'pending' }),
      API.getTemplates(),
    ]);
    
    AppState.customers = customersData.customers || [];
    AppState.todos = todosData.todos || [];
    AppState.templates = templatesData.templates || [];
  } catch (error) {
    console.error('Failed to load initial data:', error);
  }
}

function handleCustomerSearch(query) {
  // TODO: Implement client-side filtering or API search
  console.log('Search:', query);
}

async function handleCustomerClick(customerId) {
  try {
    const data = await API.getCustomer(customerId);
    AppState.currentCustomer = data.customer;
    Router.navigate('customer-detail', { id: customerId });
  } catch (error) {
    alert('顧客情報の取得に失敗しました: ' + error.message);
  }
}

function handleTodoClick(todoId) {
  const todo = AppState.todos.find(t => t.id === todoId);
  if (todo) {
    handleSendMessage(todo.customerId, todoId);
  }
}

function handleAddVisit(customerId) {
  // TODO: Implement visit registration modal
  alert('来店登録機能は実装中です');
}

function handleSendMessage(customerId, todoId = null) {
  // TODO: Implement message sending modal
  alert('メッセージ送信機能は実装中です');
}

function handleEditCustomer(customerId) {
  // TODO: Implement customer edit modal
  alert('顧客編集機能は実装中です');
}

async function handleGenerateCode() {
  try {
    const response = await API.createRegistrationCode();
    const code = response.code;
    
    document.getElementById('generatedCode').textContent = code.code;
    document.getElementById('codeExpiry').textContent = 
      new Date(code.expiresAt).toLocaleString('ja-JP');
    
    const message = `ご来店ありがとうございました！\n次回もぜひお越しください✨\n\n以下の登録コードをLINEで送信してください：\n${code.code}\n\n※有効期限: ${new Date(code.expiresAt).toLocaleString('ja-JP')}`;
    document.getElementById('registrationMessage').textContent = message;
    
    document.getElementById('codeDisplay').classList.remove('hidden');
    
    // Reload active codes
    loadActiveCodes();
  } catch (error) {
    alert('登録コードの発行に失敗しました: ' + error.message);
  }
}

function handleCopyCode() {
  const code = document.getElementById('generatedCode').textContent;
  const message = document.getElementById('registrationMessage').textContent;
  
  navigator.clipboard.writeText(message).then(() => {
    alert('案内文をコピーしました！');
  }).catch(() => {
    alert('コピーに失敗しました');
  });
}

async function loadActiveCodes() {
  try {
    const response = await API.getActiveCodes();
    const codes = response.codes || [];
    
    const listDiv = document.getElementById('activeCodesList');
    if (codes.length === 0) {
      listDiv.innerHTML = '<div class="text-center text-gray-500 py-4">有効なコードはありません</div>';
      return;
    }
    
    listDiv.innerHTML = codes.map(code => `
      <div class="bg-white rounded-lg shadow p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="font-mono font-bold text-lg text-pink-600">${code.code}</p>
            <p class="text-xs text-gray-500 mt-1">
              <i class="far fa-clock mr-1"></i>${new Date(code.expiresAt).toLocaleString('ja-JP')}まで
            </p>
          </div>
          <span class="text-xs ${code.used ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-600'} px-3 py-1 rounded-full">
            ${code.used ? '使用済み' : '有効'}
          </span>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Failed to load active codes:', error);
  }
}

// ========================================
// App Initialization
// ========================================

async function initApp() {
  // Check if already logged in
  try {
    const response = await API.getMe();
    AppState.user = response.user;
    await loadInitialData();
    Router.navigate('cast-home');
  } catch (error) {
    // Not logged in, show login page
    Router.navigate('login');
  }
}

// Setup login form handler
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  
  // Setup form delegation
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'loginForm') {
      handleLogin(e);
    }
  });
});
