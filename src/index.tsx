import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serveStatic } from 'hono/cloudflare-workers';
import { createDb } from './db/client';
import type { Variables } from './middleware/auth';

// Routes  
import { createAuthRoutes } from './routes/auth';
import { createWebhookRoutes } from './routes/webhook';
import { createCustomersRoutes } from './routes/customers';
import { createRegistrationCodesRoutes } from './routes/registration-codes';
import { createTodosRoutes } from './routes/todos';
import { createMessagesRoutes } from './routes/messages';
import { createTemplatesRoutes } from './routes/templates';
import { createUsersRoutes } from './routes/users';

// Cron
import { generateTodosForAllStores } from './lib/cron-todo-generation';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ロガー
app.use('*', logger());

// CORS設定
app.use('/api/*', cors());

// 静的ファイル配信
app.use('/static/*', serveStatic({ root: './public' }));

// DBミドルウェア - すべてのルートでDBクライアントを利用可能にする
app.use('*', async (c, next) => {
  const db = createDb(c.env.DB);
  c.set('db', db);
  return next();
});

// Webhook Routes (認証不要)
const webhookApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
webhookApp.use('*', async (c, next) => {
  const db = c.get('db');
  const routes = createWebhookRoutes(db);
  // パスを調整してサブルートに渡す
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace('/webhook', '');
  const req = new Request(url.toString(), c.req.raw);
  return routes.fetch(req, c.env, c.executionCtx);
});
app.route('/webhook', webhookApp);

// Auth Routes
const authApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
authApp.use('*', async (c, next) => {
  const db = c.get('db');
  const routes = createAuthRoutes(db);
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace('/api/auth', '');
  const req = new Request(url.toString(), c.req.raw);
  return routes.fetch(req, c.env, c.executionCtx);
});
app.route('/api/auth', authApp);

// Customer Routes
const customersApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
customersApp.use('*', async (c, next) => {
  const db = c.get('db');
  const routes = createCustomersRoutes(db);
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace('/api/customers', '');
  const req = new Request(url.toString(), c.req.raw);
  return routes.fetch(req, c.env, c.executionCtx);
});
app.route('/api/customers', customersApp);

// Registration Codes Routes
const regCodesApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
regCodesApp.use('*', async (c, next) => {
  const db = c.get('db');
  const routes = createRegistrationCodesRoutes(db);
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace('/api/registration-codes', '');
  const req = new Request(url.toString(), c.req.raw);
  return routes.fetch(req, c.env, c.executionCtx);
});
app.route('/api/registration-codes', regCodesApp);

// Todos Routes
const todosApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
todosApp.use('*', async (c, next) => {
  const db = c.get('db');
  const routes = createTodosRoutes(db);
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace('/api/todos', '');
  const req = new Request(url.toString(), c.req.raw);
  return routes.fetch(req, c.env, c.executionCtx);
});
app.route('/api/todos', todosApp);

// Messages Routes
const messagesApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
messagesApp.use('*', async (c, next) => {
  const db = c.get('db');
  const routes = createMessagesRoutes(db);
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace('/api/messages', '');
  const req = new Request(url.toString(), c.req.raw);
  return routes.fetch(req, c.env, c.executionCtx);
});
app.route('/api/messages', messagesApp);

// Templates Routes
const templatesApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
templatesApp.use('*', async (c, next) => {
  const db = c.get('db');
  const routes = createTemplatesRoutes(db);
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace('/api/templates', '');
  const req = new Request(url.toString(), c.req.raw);
  return routes.fetch(req, c.env, c.executionCtx);
});
app.route('/api/templates', templatesApp);

// Users Routes
const usersApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
usersApp.use('*', async (c, next) => {
  const db = c.get('db');
  const routes = createUsersRoutes(db);
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace('/api/users', '');
  const req = new Request(url.toString(), c.req.raw);
  return routes.fetch(req, c.env, c.executionCtx);
});
app.route('/api/users', usersApp);

// ヘルスチェック
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ホームページ
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ナイトワーク顧客管理CRM</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-900 text-white">
        <div class="min-h-screen flex items-center justify-center p-4">
            <div class="max-w-md w-full space-y-8">
                <div class="text-center">
                    <h1 class="text-4xl font-bold mb-2">
                        <i class="fas fa-users mr-2"></i>
                        顧客管理CRM
                    </h1>
                    <p class="text-gray-400">ナイトワーク店舗向けLINE連携システム</p>
                </div>
                
                <div class="bg-gray-800 rounded-lg p-8 space-y-6">
                    <div id="error-message" class="hidden bg-red-500 text-white p-3 rounded"></div>
                    
                    <form id="login-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium mb-2">メールアドレス</label>
                            <input 
                                type="email" 
                                name="email" 
                                required
                                class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                                placeholder="email@example.com"
                            />
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium mb-2">パスワード</label>
                            <input 
                                type="password" 
                                name="password" 
                                required
                                class="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
                                placeholder="••••••••"
                            />
                        </div>
                        
                        <button 
                            type="submit"
                            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition"
                        >
                            ログイン
                        </button>
                    </form>
                </div>
                
                <div class="text-center text-sm text-gray-400">
                    <p>キャスト・マネージャー専用システム</p>
                </div>
            </div>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            const form = document.getElementById('login-form');
            const errorDiv = document.getElementById('error-message');
            
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                errorDiv.classList.add('hidden');
                
                const formData = new FormData(form);
                const email = formData.get('email');
                const password = formData.get('password');
                
                try {
                    const response = await axios.post('/api/auth/login', {
                        email,
                        password
                    });
                    
                    // ログイン成功後、ダッシュボードへリダイレクト
                    window.location.href = '/dashboard';
                } catch (error) {
                    errorDiv.textContent = error.response?.data?.error || 'ログインに失敗しました';
                    errorDiv.classList.remove('hidden');
                }
            });
        </script>
    </body>
    </html>
  `);
});

// ダッシュボード（簡易版）
app.get('/dashboard', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ダッシュボード - CRM</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-900 text-white">
        <div class="min-h-screen">
            <!-- Header -->
            <header class="bg-gray-800 border-b border-gray-700 p-4">
                <div class="flex justify-between items-center">
                    <h1 class="text-xl font-bold">
                        <i class="fas fa-users mr-2"></i>
                        顧客管理CRM
                    </h1>
                    <button id="logout-btn" class="text-red-400 hover:text-red-300">
                        <i class="fas fa-sign-out-alt mr-1"></i>
                        ログアウト
                    </button>
                </div>
            </header>
            
            <!-- Main Content -->
            <main class="p-4 max-w-7xl mx-auto">
                <div id="loading" class="text-center py-8">
                    <i class="fas fa-spinner fa-spin text-3xl"></i>
                </div>
                
                <div id="content" class="hidden space-y-6">
                    <!-- User Info -->
                    <div class="bg-gray-800 rounded-lg p-6">
                        <h2 class="text-lg font-semibold mb-4">ユーザー情報</h2>
                        <div id="user-info" class="space-y-2"></div>
                    </div>
                    
                    <!-- Quick Actions -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="bg-blue-600 hover:bg-blue-700 rounded-lg p-6 text-center transition cursor-pointer">
                            <i class="fas fa-users text-3xl mb-2"></i>
                            <div class="font-semibold">顧客一覧</div>
                            <div class="text-sm text-gray-200">Coming Soon</div>
                        </div>
                        
                        <div class="bg-green-600 hover:bg-green-700 rounded-lg p-6 text-center transition cursor-pointer">
                            <i class="fas fa-tasks text-3xl mb-2"></i>
                            <div class="font-semibold">今日のToDo</div>
                            <div class="text-sm text-gray-200">Coming Soon</div>
                        </div>
                        
                        <div class="bg-purple-600 hover:bg-purple-700 rounded-lg p-6 text-center transition cursor-pointer">
                            <i class="fas fa-qrcode text-3xl mb-2"></i>
                            <div class="font-semibold">登録コード</div>
                            <div class="text-sm text-gray-200">Coming Soon</div>
                        </div>
                    </div>
                    
                    <!-- API Status -->
                    <div class="bg-gray-800 rounded-lg p-6">
                        <h2 class="text-lg font-semibold mb-4">システム状態</h2>
                        <div class="text-green-400">
                            <i class="fas fa-check-circle mr-2"></i>
                            正常稼働中
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
            async function loadUserInfo() {
                try {
                    const response = await axios.get('/api/auth/me');
                    const user = response.data.user;
                    
                    document.getElementById('user-info').innerHTML = \`
                        <div><strong>名前:</strong> \${user.displayName}</div>
                        <div><strong>役割:</strong> \${user.role === 'manager' ? 'マネージャー' : 'キャスト'}</div>
                        <div><strong>メール:</strong> \${user.email}</div>
                    \`;
                    
                    document.getElementById('loading').classList.add('hidden');
                    document.getElementById('content').classList.remove('hidden');
                } catch (error) {
                    // 未認証の場合はログインページへ
                    window.location.href = '/';
                }
            }
            
            document.getElementById('logout-btn').addEventListener('click', async () => {
                try {
                    await axios.post('/api/auth/logout');
                    window.location.href = '/';
                } catch (error) {
                    console.error('Logout error:', error);
                }
            });
            
            loadUserInfo();
        </script>
    </body>
    </html>
  `);
});

export default app;

// Cloudflare Cron Trigger
export const scheduled: ExportedHandler<Bindings>['scheduled'] = async (event, env, ctx) => {
  console.log('[Scheduled] Cron trigger started:', new Date().toISOString());
  
  const db = createDb(env.DB);
  
  try {
    await generateTodosForAllStores(db);
    console.log('[Scheduled] Cron trigger completed successfully');
  } catch (error) {
    console.error('[Scheduled] Cron trigger error:', error);
  }
};
