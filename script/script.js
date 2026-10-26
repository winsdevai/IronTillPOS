// ========================================
// DATA - Initialize all variables first
// ========================================
let productsData = [];
let viewMode = 'grid'; // Opciones: 'grid' (Cuadrícula) o 'list' (Lista)
let adminAttempts = 0;
let allowNegativeStock = false; // Por defecto NO se permite vender sin stock
let currencyLabel = localStorage.getItem('pos_currency_label') || 'M.Local'; // Por defecto M.Local
let exchangeRate = 36.50;
let taxRate = 16; // Por defecto 16%
let categoriesData = []; // Array para gestionar categorías manualmente
let taxMode = 'included'; // Opciones: 'included' (Por defecto) o 'added'
let adminPassword = '1234';
let nextNoteNumber = parseInt(localStorage.getItem('pos_next_note_number')) || 1;
let clientsData = [];
let currentClientId = null; // null = Cliente Genérico
let clientSearchQuery = '';
let editingClientId = null;
let rateMode = 'auto'; // 'auto' o 'manual'
let lastBcvUpdate = null; // Timestamp de la última actualización
let bcvInterval = null; // Referencia al intervalo
let lastFocusedElementBeforeConfirm = null;
// --- CONFIGURACIÓN DE SEGURIDAD POR ACCIÓN ---
let requirePassToDeleteProduct = false;   // ¿Pedir clave para borrar productos?
let requirePassToClearCart = false;      // ¿Pedir clave para vaciar carrito?
let requirePassToDeleteInvoice = false;  // ¿Pedir clave para borrar notas?
let requirePassToRemoveCartItem = false;  // <--- NUEVA: Protección para quitar del carrito
let pendingSecurityAction = null;        // Para guardar qué hacer después de poner la clave
// ---------------------------------------
// ========================================
// VARIABLES DE CONTROL DE SCROLL (NUEVO)
// ========================================
let isScrolledDown = false;

let cart = [];
let securityQuestion = localStorage.getItem('pos_security_question') || '';
let securityAnswer = localStorage.getItem('pos_security_answer') || '';
let taxExemptCategories = []; // Array para guardar nombres de categorías exentas
let activeCategory = 'Todos';
let searchQuery = '';
let adminSearchQuery = ''; // Variable para búsqueda en admin
let closedDays = []; // Aquí guardaremos los registros de cada vez que cierras caja
let salesHistory = [];
let savedInvoices = [];
let editingProductId = null;
let checkoutTotal = 0;
let checkoutCost = 0;
let lastCloseTime = null;
let periodTotal = 0;      // <--- AGREGA ESTO
let periodSales = [];     // <--- AGREGA ESTO
let adminCurrentPage = 1;      // Página actual en el admin
const itemsPerPage = 50;       // Cuántos productos mostrar por página (puedes cambiarlo a 20 o 100)
let voidingSaleId = null;
let selectedChangeMethod = 'efectivo_usd';
let showExpiringOnly = false;
let currentPeriod = {
  openTime: null,
  openingBalance: {} // Ej: { efectivo_usd: 50, efectivo_bs: 200000 }
};
// Métodos de pago por defecto
// type: 'bs' (Bolívares) o 'usd' (Dólares)
// fixed: true significa que NO se puede borrar ni editar (como USD)
let paymentMethods = [
  { id: 'biopago', name: 'Biopago', type: 'bs', icon: 'phone', color: 'purple' },
  { id: 'pagomovil', name: 'Pago Movil', type: 'bs', icon: 'mobile', color: 'blue' },
  { id: 'tarjeta', name: 'Tarjeta (Punto)', type: 'bs', icon: 'credit-card', color: 'orange' },
  { id: 'efectivo_bs', name: 'Efectivo BS', type: 'bs', icon: 'banknote', color: 'green' },
  // El USD y Vuelto se manejan aparte en la lógica, no en esta lista editable
];

// Variables globales para los modales personalizados
let pendingConfirmAction = null;
let pendingInputAction = null;

// --- FUNCIONES PARA MODALES PERSONALIZADOS ---


function saveSecuritySettings() {
  const qInput = document.getElementById('securityQuestionInput');
  const aInput = document.getElementById('securityAnswerInput');

  if (!qInput.value || !aInput.value) {
    showToast('Completa ambos campos', 'error');
    return;
  }

  securityQuestion = qInput.value.trim();
  securityAnswer = aInput.value.trim().toLowerCase(); // Guardamos en minúsculas para comparar fácil

  localStorage.setItem('pos_security_question', securityQuestion);
  localStorage.setItem('pos_security_answer', securityAnswer);

  showToast('Seguridad actualizada correctamente');
}

function showConfirm(message, action) {
  // 1. Guardamos qué elemento tenía el foco antes de abrir el modal
  lastFocusedElementBeforeConfirm = document.activeElement;

  const modal = document.getElementById('customConfirmModal');
  const msgEl = document.getElementById('confirmMessage');
  if (msgEl) msgEl.textContent = message;
  pendingConfirmAction = action;
  if (modal) modal.classList.add('active');

  setTimeout(() => {
    const cancelBtn = modal.querySelector('.btn-secondary');
    if (cancelBtn) cancelBtn.focus();
  }, 100);
}

function closeConfirmModal() {
  const modal = document.getElementById('customConfirmModal');
  if (modal) modal.classList.remove('active');
  pendingConfirmAction = null;

  // 2. Restauramos el foco automáticamente al cerrar
  if (lastFocusedElementBeforeConfirm) {
    setTimeout(() => {
      lastFocusedElementBeforeConfirm.focus();
      lastFocusedElementBeforeConfirm = null; // Limpiamos para la próxima
    }, 50); // Pequeño delay para asegurar que el modal ya se cerró visualmente
  }
}

function executeConfirmAction() {
  if (pendingConfirmAction) {
    pendingConfirmAction();
  }
  closeConfirmModal();
}

function toggleExpiringFilter() {
  showExpiringOnly = !showExpiringOnly;
  const btn = document.getElementById('btnExpiringFilter');

  if (showExpiringOnly) {
    btn.classList.add('bg-[--warning]', 'text-white'); // Estilo activo
    btn.classList.remove('text-[--warning]');
  } else {
    btn.classList.remove('bg-[--warning]', 'text-white'); // Estilo normal
    btn.classList.add('text-[--warning]');
  }

  renderProductsTable(); // Refrescar tabla
}

// --- FUNCIÓN PARA CAMBIAR VISUALMENTE Y GUARDAR LOS TOGGLES ---
function toggleSecuritySetting(type) {
  let isActive = false;
  let btnId = '';
  let circleId = '';
  let storageKey = '';
  let msg = '';

  // Identificar cuál toggle se presionó
  if (type === 'product') {
    requirePassToDeleteProduct = !requirePassToDeleteProduct;
    isActive = requirePassToDeleteProduct;
    btnId = 'togglePassProduct';
    circleId = 'circlePassProduct';
    storageKey = 'pos_security_delete_product';
    msg = isActive ? 'Protección de productos: ACTIVA' : 'Protección de productos: INACTIVA';
  }
  else if (type === 'cart') {
    requirePassToClearCart = !requirePassToClearCart;
    isActive = requirePassToClearCart;
    btnId = 'togglePassCart';
    circleId = 'circlePassCart';
    storageKey = 'pos_security_clear_cart';
    msg = isActive ? 'Protección de carrito: ACTIVA' : 'Protección de carrito: INACTIVA';
  }
  else if (type === 'invoice') {
    requirePassToDeleteInvoice = !requirePassToDeleteInvoice;
    isActive = requirePassToDeleteInvoice;
    btnId = 'togglePassInvoice';
    circleId = 'circlePassInvoice';
    storageKey = 'pos_security_delete_invoice';
    msg = isActive ? 'Protección de notas: ACTIVA' : 'Protección de notas: INACTIVA';
  }
  else if (type === 'cartItem') {
    requirePassToRemoveCartItem = !requirePassToRemoveCartItem;
    isActive = requirePassToRemoveCartItem;
    btnId = 'togglePassCartItem';
    circleId = 'circlePassCartItem';
    storageKey = 'pos_security_remove_cart_item';
    msg = isActive ? 'Protección ítem carrito: ACTIVA' : 'Protección ítem carrito: INACTIVA';
  }

  // Actualizar visual
  const btn = document.getElementById(btnId);
  const circle = document.getElementById(circleId);
  if (btn && circle) {
    if (isActive) {
      btn.classList.add('bg-[--accent]');
      btn.classList.remove('bg-gray-600');
      circle.classList.add('translate-x-5');
      circle.classList.remove('translate-x-0');
    } else {
      btn.classList.remove('bg-[--accent]');
      btn.classList.add('bg-gray-600');
      circle.classList.remove('translate-x-5');
      circle.classList.add('translate-x-0');
    }
  }

  // Guardar en LocalStorage
  localStorage.setItem(storageKey, isActive);
  showToast(msg);
}

// Función auxiliar para pedir clave antes de una acción
function verifySecurityBeforeAction(actionCallback) {
  // Preparamos la acción pendiente
  pendingSecurityAction = actionCallback;

  // Abrimos el modal de clave (reutilizamos el de admin)
  const input = document.getElementById('adminPasswordInput');
  const title = document.getElementById('adminAuthTitle'); // Asegúrate que tu HTML tenga este ID en el modal

  if (input) input.value = '';
  // Cambiamos el título para que sepa que es seguridad, no login
  if (title) title.textContent = "Verificación de Seguridad";

  const modal = document.getElementById('adminAuthModal');
  if (modal) {
    modal.classList.add('active');
    setTimeout(() => { if (input) input.focus(); }, 100);
  }
}

// Función envoltorio para decidir si pedir clave al borrar del carrito
function confirmRemoveCartItem(id) {
  if (requirePassToRemoveCartItem) {
    // Si la protección está activa, pedimos clave y pasamos la acción de borrar
    verifySecurityBeforeAction(() => {
      removeFromCart(id);
    });
  } else {
    // Si está desactivada, borramos directo como siempre
    removeFromCart(id);
  }
}

function setupDelegatedEvents() {
  // Productos Grid/List
  document.getElementById('productsGrid')?.addEventListener('keydown', (e) => {
    if (e.target.matches('.qty-input-grid, .qty-input-list') && e.key === 'Enter') {
      e.preventDefault();
      const id = parseInt(e.target.id.match(/qty-(\d+)/)?.[1]);
      if (id) addToCartFromGrid(id);
    }
  });

  // Carrito
  document.getElementById('cartItems')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.increase-qty, .decrease-qty, .remove-item');
    if (!btn) return;
    e.stopPropagation();
    const id = parseInt(btn.dataset.id);
    if (btn.classList.contains('increase-qty')) updateQuantity(id, 1);
    else if (btn.classList.contains('decrease-qty')) updateQuantity(id, -1);
    else if (btn.classList.contains('remove-item')) removeFromCart(id);
  });
}

// --- FUNCIÓN NUEVA: Generar botones de paginación (1 ... 18 19 20) ---
function getPaginationPages(current, total) {
  // Si hay pocas páginas, mostramos todas sin puntos suspensivos
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = [];

  // Siempre mostrar la primera página
  pages.push(1);

  // Lógica para puntos suspensivos al inicio (...)
  if (current > 4) {
    pages.push('...');
  }

  // Determinar rango de páginas alrededor de la actual
  let start = Math.max(2, current - 2);
  let end = Math.min(total - 1, current + 2);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  // Lógica para puntos suspensivos al final (...)
  if (current < total - 3) {
    pages.push('...');
  }

  // Siempre mostrar la última página
  pages.push(total);

  return pages;
}


// 2. FUNCIÓN PRINCIPAL: DIBUJAR GRÁFICO Y TOP 10
function renderAdvancedStats() {

  // ============================================================
  // 1. GRÁFICO (SIEMPRE ÚLTIMOS 7 DÍAS REALES)
  // ============================================================
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const salesForChart = salesHistory.filter(s => {
    const saleDate = new Date(s.date);
    return saleDate >= sevenDaysAgo && !s.voided;
  });

  // --- RENDERIZAR GRÁFICO ---
  const ctx = document.getElementById('salesChart');
  if (ctx && typeof Chart !== 'undefined') {
    const salesByDate = {};

    salesForChart.forEach(sale => {
      const dateObj = new Date(sale.date);
      const dateKey = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      if (!salesByDate[dateKey]) salesByDate[dateKey] = 0;
      salesByDate[dateKey] += sale.total;
    });

    const labels = Object.keys(salesByDate).slice(-7);
    const data = labels.map(l => salesByDate[l]);

    if (window.mySalesChart) window.mySalesChart.destroy();

    window.mySalesChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ventas ($)',
          data: data,
          borderColor: '#00c896',
          backgroundColor: 'rgba(0, 200, 150, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#0c1015',
          pointBorderColor: '#00c896',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: '#253040' }, ticks: { color: '#b8c5d4' } },
          x: { grid: { display: false }, ticks: { color: '#b8c5d4' } }
        }
      }
    });
  }

  // ============================================================
  // 2. TOP 10 (HISTORIA TOTAL - INFINITO)
  // ============================================================
  const topContainer = document.getElementById('topProductsList');
  if (!topContainer) return;

  // Filtramos SOLO las anuladas, el resto se queda todo
  const salesForTop10 = salesHistory.filter(s => !s.voided);

  const productCounts = {};
  salesForTop10.forEach(sale => {
    sale.items.forEach(item => {
      if (!productCounts[item.name]) productCounts[item.name] = { count: 0, total: 0 };
      productCounts[item.name].count += item.qty;
      productCounts[item.name].total += (item.price * item.qty);
    });
  });

  const sortedProducts = Object.entries(productCounts)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 10);

  if (sortedProducts.length === 0) {
    topContainer.innerHTML = '<p class="text-xs text-center text-[--fg-muted] py-4">Sin datos</p>';
    return;
  }

  topContainer.innerHTML = sortedProducts.map(([name, data], index) => `
    <div class="flex items-center justify-between p-2 rounded-lg bg-[--bg-tertiary]/50 hover:bg-[--bg-tertiary] transition-colors">
      <div class="flex items-center gap-3">
        <div class="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] 
                    ${index === 0 ? 'bg-yellow-500 text-black' : index === 1 ? 'bg-gray-400 text-black' : index === 2 ? 'bg-orange-600 text-white' : 'bg-[--bg-card] text-[--fg-muted]'}">
          ${index + 1}
        </div>
        <div class="flex flex-col">
          <span class="text-xs font-semibold text-[--fg-primary] truncate max-w-[120px]">${name}</span>
          <span class="text-[10px] text-[--fg-muted]">${data.count} Despachados</span>
        </div>
      </div>
      <div class="text-right">
        <span class="text-xs font-mono text-[--accent] font-bold">${formatUSD(data.total)}</span>
      </div>
    </div>
  `).join('');
}

function toggleViewMode() {
  // Cambiamos el estado
  viewMode = (viewMode === 'grid') ? 'list' : 'grid';

  // Guardar preferencia
  localStorage.setItem('pos_view_mode', viewMode);

  // Refrescar vista
  renderProducts();
  showToast(`Vista cambiada a: ${viewMode === 'grid' ? 'Cuadrícula' : 'Lista'}`);

  // Actualizar visuales del botón en Configuración (si existe en pantalla)
  updateViewModeVisuals();
}

// Función nueva para pintar el botón correctamente
function updateViewModeVisuals() {
  const btn = document.getElementById('btnViewModeControl');
  const circle = document.getElementById('btnViewModeCircle');

  if (!btn || !circle) return;

  if (viewMode === 'list') {
    // Modo Lista (Activado) -> Verde
    btn.classList.add('bg-[--accent]');
    btn.classList.remove('bg-gray-600');
    circle.classList.add('translate-x-5');
    circle.classList.remove('translate-x-0');
  } else {
    // Modo Grid (Inactivo) -> Gris
    btn.classList.remove('bg-[--accent]');
    btn.classList.add('bg-gray-600');
    circle.classList.remove('translate-x-5');
    circle.classList.add('translate-x-0');
  }
}

function showInput(title, currentValue, action) {
  const modal = document.getElementById('customInputModal');
  const titleEl = document.getElementById('inputModalTitle');
  const inputEl = document.getElementById('customModalInput');

  if (titleEl) titleEl.textContent = title;
  if (inputEl) {
    inputEl.value = currentValue;
    inputEl.type = "number";
  }

  pendingInputAction = action;
  if (modal) modal.classList.add('active');

  setTimeout(() => {
    if (inputEl) inputEl.focus();
    if (inputEl) inputEl.select();
  }, 100);
}

function closeInputModal() {
  const modal = document.getElementById('customInputModal');
  if (modal) modal.classList.remove('active');
  pendingInputAction = null;
}

function executeInputAction() {
  const inputEl = document.getElementById('customModalInput');
  if (inputEl && pendingInputAction) {
    pendingInputAction(inputEl.value);
  }
  closeInputModal();
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

// ========================================
// ALMACENAMIENTO SEGURO (EVITA QUOTA EXCEEDED)
// ========================================
function safeSetStorage(key, data) {
  try {
    // Stringificamos aquí para evitar errores si 'data' es undefined o inválido
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
  } catch (e) {
    // Detectamos específicamente el error de cuota llena
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      showToast('⚠️ Almacenamiento lleno. Exporta datos y limpia historial.', 'error');
      console.warn(`[Storage] Cuota excedida en clave: ${key}`);
    } else {
      console.error(`[Storage] Error inesperado en ${key}:`, e);
    }
    // La app NO se cierra, solo omite el guardado y mantiene los datos en memoria RAM
  }
}

// Función auxiliar para saber si un método es USD
function isMethodUSD(methodId) {
  if (methodId === 'efectivo_usd') return true;
  const method = paymentMethods.find(m => m.id === methodId);
  return method && method.type === 'usd';
}

function getCategories() {
  // Si hay categorías definidas en Admin, usamos esas. Si no, solo 'Todos'.
  if (categoriesData && categoriesData.length > 0) {
    return ['Todos', ...categoriesData];
  }
  return ['Todos'];
}

// Función dedicada a actualizar el filtro desplegable en Admin
function renderAdminCategoryFilter() {
  const catFilter = document.getElementById('adminCategoryFilter');
  if (!catFilter) return;

  // 1. Guardamos qué valor estaba seleccionado antes de borrar
  const currentSelection = catFilter.value;

  // 2. Limpiamos y volvemos a llenar el select
  catFilter.innerHTML = '<option value="">Todas</option>';

  getCategories().forEach(c => {
    if (c === 'Todos') return; // No agregar "Todos" como opción, es el default
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    catFilter.appendChild(opt);
  });

  // 3. Restaurar la selección inteligente
  // Si la categoría que estaba seleccionada sigue existiendo (ej: si solo renombraste), la dejamos.
  // Si fue borrada, regresamos a "Todas" automáticamente.
  if (currentSelection && getCategories().includes(currentSelection)) {
    catFilter.value = currentSelection;
  } else {
    catFilter.value = ""; // Esto selecciona "Todas"
  }
}

function formatUSD(amount) {
  const num = parseFloat(amount) || 0;
  return 'REF ' + num.toFixed(2);
}

function forceFocusToSearch() {
  const mainView = document.getElementById('mainView');
  const adminView = document.getElementById('adminView');
  const tabProducts = document.getElementById('tabProducts');

  const mainSearchInput = document.getElementById('searchInput');
  const adminSearchInput = document.getElementById('adminSearchInput');

  // ============================================================
  // 1. DETECTAR VISTA ADMIN
  // ============================================================
  // Si la vista Admin está visible, no debemos intentar llevar el foco 
  // al buscador del POS bajo NINGUNA circunstancia.
  if (adminView && !adminView.classList.contains('hidden')) {
    // Estamos en Admin. Continuamos con la lógica interna de Admin abajo.
  } else {
    // Si no estamos en admin, seguimos el flujo normal del POS (que no tocaremos aquí)
    // (Nota: Mantuve tu lógica original de POS intacta implícitamente al no tocarla, 
    // pero dado que el problema es en Admin, nos enfocamos ahí).
  }

  // 1. Si hay un modal abierto, no hacemos nada
  const openModal = document.querySelector('.modal-overlay.active');
  if (openModal) return;

  const activeElement = document.activeElement;

  // 2. Si estamos escribiendo en un input, textarea o select, respetamos
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName)) return;

  const tagName = activeElement.tagName;

  // 3. Si estamos navegando en tarjetas (GRID), en el carrito o en una TABLA (LISTA), respetamos
  const isTableRow = activeElement.tagName === 'TR' && activeElement.closest('#productsGrid');

  if (activeElement.closest('.product-card') || activeElement.closest('.cart-item') || isTableRow) return;

  // ==========================================
  // 4. CORRECCIÓN PRINCIPAL: RESPETAR TABLA ADMIN
  // ==========================================
  // Si el elemento activo (el botón que acabas de tocar) está DENTRO de la tabla 
  // de administración (#productsTable), detener la función aquí.
  // Esto evita que te robe el foco al darle a Editar o Borrar.
  const adminTable = document.getElementById('productsTable');
  if (adminTable && adminTable.contains(activeElement)) {
    return;
  }
  // ==========================================

  // --- LÓGICA DE ASIGNACIÓN ---

  // A. ESTAMOS EN EL POS (Vista Principal)
  if (mainView && !mainView.classList.contains('hidden')) {

    // ============================================================
    // PROTECCIÓN SCROLL
    // ============================================================
    const productsGrid = document.getElementById('productsGrid');
    if (productsGrid && productsGrid.scrollTop > 50) {
      return; // No interrumpir si estás mirando productos abajo
    }
    // ============================================================

    if (mainSearchInput) mainSearchInput.focus();
  }

  // B. ESTAMOS EN ADMIN -> PESTAÑA PRODUCTOS (Buscador interno de Admin)
  else if (adminView && !adminView.classList.contains('hidden')) {
    if (tabProducts && !tabProducts.classList.contains('hidden')) {
      // Aquí es donde ocurría el salto forzado.
      // Ahora, gracias al chequeo de arriba (punto 4), si tocas un botón,
      // esto nunca se ejecutará para ese clic específico.
      if (adminSearchInput) adminSearchInput.focus();
    }
  }
}

// Función para decidir el color del precio (Rojo si hay perdida)
function getPriceColor(price, cost) {
  const p = parseFloat(price) || 0;
  const c = parseFloat(cost) || 0;

  // Si el precio de venta es MENOR al coste -> Rojo
  if (p < c) {
    return 'text-[--danger]';
  }
  // Si es normal o mayor -> Verde (Accent)
  return 'text-[--accent]';
}

function getExpiryStatus(expiryDateStr) {
  if (!expiryDateStr) return null; // Si no hay fecha, no ponemos color

  // ... (código de parseo de fecha se mantiene igual) ...
  const parts = expiryDateStr.split('/');
  if (parts.length !== 3) return null;

  let day = parseInt(parts[0]);
  let month = parseInt(parts[1]) - 1;
  let year = parseInt(parts[2]);

  if (year < 100) year += 2000;
  const expiryDate = new Date(year, month, day);
  const today = new Date();

  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);

  const diffTime = expiryDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { color: 'text-[--danger]', label: 'Vencido' }; // Ya venció

  // ==========================================
  // CAMBIO AQUÍ: De 14 a 15
  // Esto hará que se ponga ROJO cuando falten 15 días
  // ==========================================
  if (diffDays <= 15) return { color: 'text-[--danger]', label: `Vence en ${diffDays} días` };

  // ==========================================
  // OPCIONAL: Cambiar el Amarillo
  // Si quieres que empiece a avisar en AMARILLO a los 15 días, cambia el 30 por 15 abajo:
  // if (diffDays <= 30) ...
  // ==========================================
  if (diffDays <= 30) return { color: 'text-[--warning]', label: `Vence en ${diffDays} días` }; // Amarillo: 1 mes o menos

  return { color: 'text-[--success]', label: 'OK' }; // Verde
}

function getExpiringProductsCount() {
  let count = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!productsData || productsData.length === 0) return 0;

  productsData.forEach(p => {

    if (!p.expiry) return;

    const parts = p.expiry.split('/');
    if (parts.length !== 3) return;

    const d = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    let y = parseInt(parts[2], 10);
    if (y < 100) y += 2000;

    if (isNaN(d) || isNaN(m) || isNaN(y)) return;

    const expDate = new Date(y, m, d);
    expDate.setHours(0, 0, 0, 0);

    const diffTime = expDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // ✅ LÓGICA CORREGIDA: TODO DENTRO DEL LOOP
    if (diffDays <= 30) {
      count++;
    }
  });

  return count;
}

function updateExpiringBanner() {
  const count = getExpiringProductsCount();
  const box = document.getElementById('expiringWarningBox');
  const text = document.getElementById('expiringCountText');

  if (text) text.textContent = count;

  if (box) {
    if (count > 0) {
      box.classList.remove('hidden');
      box.style.display = 'flex'; // 🔑 Fuerza visibilidad si el CSS de Tailwind tarda en Electron
    } else {
      box.classList.add('hidden');
      box.style.display = ''; // Restaura comportamiento normal
    }
  }
}


function formatBS(amount) {
  const num = parseFloat(amount) || 0;
  // Eliminamos Math.max(0, num) para permitir negativos
  return currencyLabel + ' ' + num.toFixed(2);
}

function toBS(usdAmount) {
  const num = parseFloat(usdAmount) || 0;
  return Math.max(0, num) * exchangeRate;
}

function saveProducts() {
  safeSetStorage('pos_products', productsData);
}

function saveCart() {
  safeSetStorage('pos_cart', cart);
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  if (!toast || !toastMessage) return;

  toastMessage.textContent = message;
  toast.className = 'toast show ' + type;
  const icon = toast.querySelector('.toast-icon');
  if (icon) {
    if (type === 'success') {
      icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>';
    } else {
      icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>';
    }
  }
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function updateDateTime() {
  const now = new Date();
  const dateEl = document.getElementById('currentDate');
  const timeEl = document.getElementById('currentTime');
  if (dateEl) dateEl.textContent = now.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'short' });
  if (timeEl) timeEl.textContent = now.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
}

function updateTaxLabel() {
  const label = document.getElementById('taxRateLabel');
  if (label) {
    label.textContent = `IVA (${taxRate}%)`;
  }
}

function updateRateDisplay() {
  // 1. Actualizar el encabezado superior (Header)
  const rateEl = document.getElementById('rateDisplay');
  if (rateEl) rateEl.textContent = `1$ = ${exchangeRate.toFixed(2)} ${currencyLabel}`;

  // 2. Actualizar el valor del input
  const adminRateInput = document.getElementById('adminRateInput');
  if (adminRateInput) adminRateInput.value = exchangeRate;

  // 3. ACTUALIZAR LA ETIQUETA "BS" DEL INPUT (NUEVO)
  const rateLabelSpan = document.getElementById('rateLabelSpan');
  if (rateLabelSpan) rateLabelSpan.textContent = currencyLabel;
}

function updateSavedInvoicesCount() {
  const countEl = document.getElementById('savedInvoicesCount');
  if (!countEl) return;

  if (savedInvoices.length > 0) {
    countEl.textContent = savedInvoices.length;
    countEl.style.display = 'flex';
  } else {
    countEl.style.display = 'none';
  }
}

// ========================================
// RENDER FUNCTIONS
// ========================================

function renderProducts() {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  let filtered = productsData;

  // --- FILTRO DE STOCK (Condicional) ---
  if (!allowNegativeStock) {
    filtered = filtered.filter(p => (p.stock > 0 || p.stock === 999));
  }

  if (activeCategory !== 'Todos') {
    filtered = filtered.filter(p => p.category === activeCategory);
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(p => {
      if (p.name && p.name.toLowerCase().includes(query)) return true;
      if (p.code && p.code.toLowerCase().includes(query)) return true;
      if (p.codes && Array.isArray(p.codes)) {
        return p.codes.some(c => c.toLowerCase().includes(query));
      }
      return false;
    });
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
          <div class="flex flex-col items-center justify-center py-16 text-[--fg-muted]">
            <svg class="w-14 h-14 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <p class="text-sm">No se encontraron productos</p>
          </div>`;
    return;
  }

  // ==========================================
  // LÓGICA DE DIBUJO: GRID O LISTA
  // ==========================================
  if (viewMode === 'list') {
    // --- VISTA LISTA (TABLA) ---
    grid.innerHTML = `
      <div class="w-full overflow-x-auto">
        <table class="w-full text-sm text-left">
          <thead class="bg-[--bg-tertiary] text-[--fg-muted] sticky top-0 z-10">
            <tr>
              <th class="p-3 font-medium border-b border-[--border]">Producto</th>
              <th class="p-3 font-medium text-right border-b border-[--border]">Precio</th>
              <th class="p-3 font-medium text-center border-b border-[--border] hidden sm:table-cell">Stock</th>
              <th class="p-3 font-medium text-center border-b border-[--border]">Cant.</th>
              <th class="p-3 font-medium text-right border-b border-[--border]">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[--border]">
            ${filtered.map(product => {

      let precioDisplay = product.price;
      if (taxMode === 'added') {
        precioDisplay = product.price * (1 + (taxRate / 100));
      }

      const isExempt = taxExemptCategories.includes(product.category);

      return `
              <tr class="hover:bg-[--bg-tertiary]/50 transition-colors group focus:ring-2 focus:ring-[--accent] outline-none" 
                  data-id="${product.id}"
                  tabindex="0">
                <!-- ELIMINAMOS onclick PARA QUE EL CLICK SOLO SELECCIONE (FOCO) -->
                <td class="p-3">
                  <div class="font-medium text-[--fg-primary] text-sm">${product.name || 'Producto'}</div>
                  <div class="text-xs text-[--fg-muted] flex gap-2 items-center mt-1">
                    <span class="font-mono">${product.code || 'N/A'}</span>
                    ${isExempt ? '<span class="bg-[--success]/10 text-[--success] text-[9px] font-bold border border-[--success]/20 px-1.5 py-0.5 rounded">E</span>' : ''}
                    <span class="badge badge-category text-[9px]">${product.category || 'Sin categoria'}</span>
                  </div>
                </td>
                <td class="p-3 text-right font-mono">
                  <div class="${getPriceColor(precioDisplay, product.cost)} text-base font-semibold">${formatUSD(precioDisplay)}</div>
                  <div class="text-xs text-white">${formatBS(toBS(precioDisplay))}</div>
                </td>
                <td class="p-3 text-center hidden sm:table-cell">
                  <span class="badge ${(product.stock || 0) <= 4 ? 'badge-critical' : 'badge-stock'}">${product.stock || 0}</span>
                </td>
                <!-- INPUT CANTIDAD LISTA -->
                <td class="p-3 text-center">
                  <input type="number" id="qty-${product.id}" class="qty-input-list w-16 text-center border border-[--border] rounded bg-[--bg-card] text-sm py-1" value="1" min="1" onclick="event.stopPropagation()">
                </td>
                <!-- FIN INPUT -->
                <td class="p-3 text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button class="text-[--accent] hover:bg-[--accent]/10 p-1.5 rounded-lg transition-colors group-hover:scale-110" onclick="event.stopPropagation(); addToCart(${product.id})">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4m8 0l8 8"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>
    `;

  } else {
    // --- VISTA GRID (CUADRÍCULA) ---
    grid.innerHTML = `<div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
        ${filtered.map(product => {

      let precioDisplay = product.price;
      if (taxMode === 'added') {
        precioDisplay = product.price * (1 + (taxRate / 100));
      }

      const isExempt = taxExemptCategories.includes(product.category);

      return `
          <div class="product-card p-3 focus:ring-2 focus:ring-[--accent] outline-none" data-id="${product.id}" tabindex="0">
            <div class="flex justify-between items-start mb-2">
              <span class="badge badge-category">${product.category || 'Sin categoria'}</span>
              <span class="badge badge-code">${product.code || 'N/A'}</span>
              ${isExempt ? '<span class="badge bg-[--success]/10 text-[--success] text-[9px] font-bold border border-[--success]/20">E</span>' : ''}
            </div>
            <h3 class="font-medium text-sm mb-1 leading-tight">${product.name || 'Producto'}</h3>
            <div class="mt-auto pt-2">
              <div class="flex justify-between items-end">
                <div>
                  <span class="font-mono text-lg text-base ${getPriceColor(precioDisplay, product.cost)} font-bold">${formatUSD(precioDisplay)}</span>
                  <p class="font-mono text-lg text-white">${formatBS(toBS(precioDisplay))}</p>
                </div>
                <!-- INPUT CANTIDAD GRID -->
                <div class="flex flex-col items-end">
                   <input type="number" id="qty-${product.id}" class="qty-input-grid w-14 text-center border border-[--border] rounded bg-[--bg-card] text-xs font-bold py-0.5 mb-1" value="1" min="1" onclick="event.stopPropagation()">
                   <span class="text-[10px] ${(product.stock || 0) <= 4 ? 'text-[--danger] font-bold' : 'text-[--fg-muted]'}">Stock: ${product.stock || 0}</span>
                </div>
                <!-- FIN INPUT -->
              </div>
            </div>
          </div>
        `}).join('')}
      </div>`;
  }

  // ==========================================
  // EVENT LISTENERS (Lógica unificada)
  // ==========================================

  // 1. Manejo del INPUT de cantidad (Para ambos modos)
  document.querySelectorAll('.qty-input-grid, .qty-input-list').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation(); // IMPORTANTE: Evita que el evento suba a la fila/tarjeta
        const idMatch = input.id.match(/qty-(\d+)/);
        if (idMatch) addToCartFromGrid(parseInt(idMatch[1]));
      }
    });
  });

  // 2. Manejo de la FILA (Lista / Excel)
  if (viewMode === 'list') {
    const rows = grid.querySelectorAll('tbody tr');
    rows.forEach(row => {
      row.addEventListener('keydown', (e) => {
        // Si presionamos Enter y NO estamos escribiendo en el input
        if ((e.key === 'Enter' || e.key === ' ') && e.target.tagName !== 'INPUT') {
          e.preventDefault();
          const id = parseInt(row.dataset.id);
          addToCart(id); // Agrega cantidad por defecto (1) o suma

          // Limpieza y foco (opcional, similar al grid)
          const searchInput = document.getElementById('searchInput');
          const productsSection = document.getElementById('productsSection');
          if (searchInput) { searchInput.value = ''; searchQuery = ''; }
          if (productsSection) productsSection.classList.add('hidden');
          renderProducts();
          if (searchInput) searchInput.focus();
        }
      });
    });
  }
  // 3. Manejo de la TARJETA (Grid)
  else {
    grid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('keydown', (e) => {
        // Si presionamos Enter y NO estamos escribiendo en el input
        if ((e.key === 'Enter' || e.key === ' ') && e.target.tagName !== 'INPUT') {
          e.preventDefault();
          addToCart(parseInt(card.dataset.id));

          const searchInput = document.getElementById('searchInput');
          const productsSection = document.getElementById('productsSection');
          if (searchInput) { searchInput.value = ''; searchQuery = ''; }
          if (productsSection) productsSection.classList.add('hidden');
          renderProducts();
          if (searchInput) searchInput.focus();
        }
      });
    });
  }
}

function renderCart() {
  const container = document.getElementById('cartItems');
  const clearBtn = document.getElementById('clearCartBtn');
  const checkoutBtn = document.getElementById('checkoutBtn');

  let focusedId = null;
  const activeElement = document.activeElement;
  if (activeElement && activeElement.classList.contains('cart-item')) {
    focusedId = parseInt(activeElement.dataset.id);
  }

  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
          <div class="flex flex-col items-center justify-center h-full text-[--fg-muted] py-10">
            <svg class="w-14 h-14 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
            </svg>
            <p class="text-sm">Carrito vacio</p>
            <p class="text-[10px] mt-1">Toca un producto para agregarlo</p>
          </div>`;
    if (clearBtn) clearBtn.disabled = true;
    if (checkoutBtn) checkoutBtn.disabled = true;
  } else {
    if (clearBtn) clearBtn.disabled = false;
    if (checkoutBtn) checkoutBtn.disabled = false;

    container.innerHTML = cart.map(item => {
      const product = productsData.find(p => p.id === item.id);
      const availableStock = product ? product.stock : 0;

      const isMiscItem = (item.code === 'MISC-BS' || item.code === 'MISC-USD');
      const isExempt = (product && taxExemptCategories.includes(product.category)) || isMiscItem;

      // ====== CORRECCIÓN IVA SUMADO ======
      // Precio unitario: si es modo "added" y NO es exento, le sumamos IVA
      let displayPrice = item.price;
      if (taxMode === 'added' && !isExempt) {
        displayPrice = item.price * (1 + (taxRate / 100));
      }
      // ===================================

      return `
          <div class="cart-item p-2.5 flex gap-2.5 focus:ring-2 focus:ring-[--accent] focus:bg-[--bg-tertiary]/30 outline-none rounded-lg transition-colors cursor-pointer" 
               data-id="${item.id}" 
               role="listitem" 
               tabindex="0">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="font-medium text-sm truncate">${item.name}</h4>
                <span class="badge badge-code text-[9px]">${item.code || 'N/A'}</span>
                
                ${isExempt ? '<span class="badge bg-[--success]/10 text-[--success] text-[9px] font-bold border border-[--success]/20">E</span>' : ''}
                
                <span class="text-[9px] text-[--fg-muted] font-mono bg-[--bg-tertiary] px-1.5 py-0.5 rounded border border-[--border]">
                  Stock: ${availableStock}
                </span>
              </div>
              <p class="text-sm text-white">${formatUSD(displayPrice)} / ${formatBS(toBS(displayPrice))} c/u</p>
            </div>
            <div class="flex items-center gap-1.5">
              <p class="font-mono text-[18px]" style="color:#98b3da;">(F8)</p>
              <button class="qty-btn decrease-qty" data-id="${item.id}" aria-label="Disminuir cantidad">-</button>
              <span class="font-mono w-10 text-center text-sm font-bold text-[--fg-primary]">${item.qty}</span>
              <button class="qty-btn increase-qty" data-id="${item.id}" aria-label="Aumentar cantidad">+</button>
            </div>
            <div class="flex flex-col items-end min-w-[80px]">
              <span class="font-mono text-lg text-white font-semibold">${formatUSD(displayPrice * item.qty)}</span>
              <span class="font-mono text-lg text-white">${formatBS(toBS(displayPrice * item.qty))}</span>
              <button onclick="confirmRemoveCartItem(${item.id})" class="text-[12px] text-[--danger] hover:underline" data-id="${item.id}">Del (Supr)</button>
            </div>
          </div>
        `;
    }).join('');

    container.querySelectorAll('.increase-qty').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateQuantity(parseInt(btn.dataset.id), 1);
      });
    });
    container.querySelectorAll('.decrease-qty').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        updateQuantity(parseInt(btn.dataset.id), -1);
      });
    });
    container.querySelectorAll('.remove-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromCart(parseInt(btn.dataset.id));
      });
    });
  }

  if (focusedId) {
    const newFocusedItem = container.querySelector(`.cart-item[data-id="${focusedId}"]`);
    if (newFocusedItem) {
      newFocusedItem.focus();
    }
  }

  updateCartTotals();
}

function updateCartTotals() {
  const totalItems = cart.reduce((sum, item) => sum + (item.qty || 0), 0);

  // Separamos el subtotal en: GRAVADO (con IVA) y EXENTO (sin IVA)
  let taxableSubtotal = 0; // Base imponible
  let exemptSubtotal = 0;  // Exento de IVA

  cart.forEach(item => {
    const product = productsData.find(p => p.id === item.id);
    const lineTotal = (item.price || 0) * (item.qty || 0);

    // --- NUEVA LÍNEA: Detectar si es un ítem manual ---
    const isMiscItem = (item.code === 'MISC-BS' || item.code === 'MISC-USD');
    // --------------------------------------------------

    // Verificamos si la categoría del producto está en la lista de exentas
    // --- AGREGAMOS " || isMiscItem" AL FINAL ---
    if ((product && taxExemptCategories.includes(product.category)) || isMiscItem) {
      exemptSubtotal += lineTotal;
    } else {
      taxableSubtotal += lineTotal;
    }
  });

  // --- CORRECCIÓN AQUÍ: Definimos el subtotal general ---
  const subtotal = taxableSubtotal + exemptSubtotal;
  // --------------------------------------------------

  let tax = 0;
  let total = 0;
  const rateFactor = taxRate / 100;

  if (taxMode === 'included') {
    // MODO INCLUIDO
    // Impuesto = Base * (tasa / (1 + tasa))
    tax = taxableSubtotal - (taxableSubtotal / (1 + rateFactor));
    total = taxableSubtotal + exemptSubtotal;
  } else {
    // MODO SUMADO
    // Impuesto solo sobre la parte gravada
    tax = taxableSubtotal * rateFactor;
    // Total es suma de todo + impuesto
    total = taxableSubtotal + exemptSubtotal + tax;
  }

  const countText = `${totalItems} producto${totalItems !== 1 ? 's' : ''}`;

  const cartCountEl = document.getElementById('cartCount');
  const cartCountMobileEl = document.getElementById('cartCountMobile');
  if (cartCountEl) cartCountEl.textContent = countText;
  if (cartCountMobileEl) cartCountMobileEl.textContent = countText;

  const subtotalUSDEl = document.getElementById('subtotalUSD');
  const subtotalBSEl = document.getElementById('subtotalBS');
  const taxUSDEl = document.getElementById('taxUSD');
  const taxBSEl = document.getElementById('taxBS');

  // Ahora la variable 'subtotal' sí existe y mostrará el valor correcto
  if (subtotalUSDEl) subtotalUSDEl.textContent = formatUSD(subtotal);
  if (subtotalBSEl) subtotalBSEl.textContent = formatBS(toBS(subtotal));

  if (taxUSDEl) taxUSDEl.textContent = formatUSD(tax);
  if (taxBSEl) taxBSEl.textContent = formatBS(toBS(tax));

  const totalUSDEl = document.getElementById('totalUSD');
  const totalBSEl = document.getElementById('totalBS');

  if (totalUSDEl) totalUSDEl.textContent = formatUSD(total);
  if (totalBSEl) totalBSEl.textContent = formatBS(toBS(total));
}

// ========================================
// CART FUNCTIONS
// ========================================
function addToCart(productId) {
  const product = productsData.find(p => p.id === productId);
  if (!product) return;

  const existingItem = cart.find(item => item.id === productId);

  if (existingItem) {
    // --- CORRECCIÓN AQUÍ ---
    // Si la opción "Permitir ventas sin stock" está ACTIVADA, 
    // ignoramos la validación de stock y sumamos directo.
    if (!allowNegativeStock) {
      // Comportamiento normal: Respetamos el límite de stock
      if (existingItem.qty < (product.stock || 0)) {
        existingItem.qty++;
      } else {
        showToast('Stock insuficiente', 'error');
        return;
      }
    } else {
      // Comportamiento "Sin Stock": Simplemente sumamos la cantidad sin importar el stock
      existingItem.qty++;
    }
    // --------------------
  } else {
    // Si es el PRIMER item que agregas al carrito
    if (!allowNegativeStock && (product.stock || 0) < 1) {
      showToast('Producto sin stock', 'error');
      return;
    }

    cart.unshift({
      id: product.id,
      name: product.name,
      price: product.price,
      cost: product.cost || 0,
      code: product.code,
      qty: 1
    });
  }

  saveCart();
  renderCart();
  showToast(`${product.name} agregado`);
}

function addByCode(code) {
  // Buscamos si el código existe en el array de códigos
  const product = productsData.find(p => {
    // Si el producto tiene el array 'codes' lo usamos, si no, usamos el 'code' viejo
    const productCodes = p.codes || [p.code];
    // Verificamos si ALGUNO de los códigos coincide (ignorando mayúsculas/minúsculas)
    return productCodes.some(c => c && c.toLowerCase() === code.toLowerCase());
  });

  if (product) {
    // 1. Agregar al carrito (SOLO UNA VEZ)
    addToCart(product.id);

    // 2. Limpiar el buscador
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    searchQuery = '';

    // --- LÓGICA: OCULTAR PANEL AL ESCANEAR ---
    const productsSection = document.getElementById('productsSection');
    if (productsSection) productsSection.classList.add('hidden');
    // ------------------------------------------------

    // 3. Actualizar vista
    renderProducts();
  } else {
    showToast('Producto no encontrado', 'error');
  }
}

function addMiscItem(value, key, codeType = 'MISC') {
  // 1. Determinar moneda
  const isUSD = (key === 'd');

  // 2. Conversión a USD (Base del sistema)
  let finalPrice = value;
  if (!isUSD) {
    finalPrice = value / exchangeRate;
  }

  const currentCurrencyLabel = isUSD ? 'USD' : (window.currencyLabel || 'M.Local');

  // 3. Definir el prefijo del código según el tipo
  // Si es 'CMIC' usará ese prefijo, si no, usa 'MISC' por defecto
  const codePrefix = codeType === 'CMIC' ? 'CMIC' : 'MISC';

  const miscItem = {
    id: Date.now(),
    // Puedes cambiar el nombre aquí si quieres distinguirlos visualmente en el ticket
    name: codeType === 'CMIC' ? `Venta General (${currentCurrencyLabel})` : `Varios Exento (${currentCurrencyLabel})`,
    code: isUSD ? `${codePrefix}-USD` : `${codePrefix}-BS`,
    price: finalPrice,
    cost: 0,
    qty: 1
  };

  // 4. Agregar al carrito
  cart.unshift(miscItem);
  saveCart();
  renderCart();

  showToast(`Ítem agregado: ${isUSD ? formatUSD(value) : formatBS(value)}`);

  // 5. Limpieza
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
    searchQuery = '';
    searchInput.focus();
  }

  const productsSection = document.getElementById('productsSection');
  if (productsSection) productsSection.classList.add('hidden');
}


function updateQuantity(productId, delta) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  const product = productsData.find(p => p.id === productId);
  const newQty = (item.qty || 0) + delta;

  if (newQty <= 0) {
    removeFromCart(productId);
    return;
  }
  if (!allowNegativeStock && product && newQty > (product.stock || 0)) {
    showToast('Stock insuficiente', 'error');
    return;
  }

  item.qty = newQty;
  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  // 1. Guardamos el índice (posición) del producto que vamos a borrar ANTES de borrarlo
  const deletedIndex = cart.findIndex(i => i.id === productId);

  const container = document.getElementById('cartItems');
  const itemEl = container ? container.querySelector(`[data-id="${productId}"]`) : null;

  if (itemEl) {
    itemEl.classList.add('removing');
    // Esperamos a la animación
    setTimeout(() => {
      performRemoval(deletedIndex);
    }, 200);
  } else {
    // Si no hay elemento visual (raro, pero posible), borramos directo
    performRemoval(deletedIndex);
  }

  // Función interna para ejecutar el borrado y manejar el foco
  function performRemoval(oldIndex) {
    // Borramos del array
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    renderCart();

    // --- NUEVA LÓGICA DE FOCO ---

    // Caso A: El carrito quedó vacío
    if (cart.length === 0) {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) {
        searchInput.focus();
        searchInput.value = ''; // Limpiamos por si acaso
      }
    }
    // Caso B: Quedan productos en el carrito
    else {
      // Intentamos poner el foco en el producto que ocupó el lugar.
      // Si borrabas el de la posición 3, ahora el que era 4 es el 3.
      // Si borrabas el último (ej. posición 5 de 5), ahora el nuevo último es la 4.

      let targetIndex = oldIndex;

      // Si el índice es mayor que el tamaño actual (porque borraste el último), ajustamos al último
      if (targetIndex >= cart.length) {
        targetIndex = cart.length - 1;
      }

      const targetProduct = cart[targetIndex];
      if (targetProduct) {
        const newFocusedItem = document.querySelector(`.cart-item[data-id="${targetProduct.id}"]`);
        if (newFocusedItem) {
          newFocusedItem.focus();
        }
      }
    }
    // --------------------------
  }
}

// Función para F8: Cambiar cantidad vía Modal
function promptQuantity(productId) {
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  showInput("Editar Cantidad", item.qty, (inputValue) => {
    const newQty = parseInt(inputValue);

    if (isNaN(newQty) || newQty < 0) {
      showToast('Cantidad inválida', 'error');
      return;
    }

    const product = productsData.find(p => p.id === productId);

    // --- AQUÍ ESTÁ EL CAMBIO: AGREGAR !allowNegativeStock ---
    if (!allowNegativeStock && product && newQty > (product.stock || 0)) {
      showToast(`Stock insuficiente. Máximo disponible: ${product.stock}`, 'error');
      return;
    }
    // ---------------------------------------------------------

    if (newQty === 0) {
      removeFromCart(productId);
    } else {
      item.qty = newQty;
      saveCart();
      renderCart();
      showToast(`Cantidad actualizada a ${newQty}`);

      setTimeout(() => {
        const itemEl = document.querySelector(`.cart-item[data-id="${productId}"]`);
        if (itemEl) itemEl.focus();
      }, 50);
    }
  });
}

function clearCart() {
  // CHEQUEO DE SEGURIDAD
  if (requirePassToClearCart) {
    verifySecurityBeforeAction(() => {
      // Lógica real de borrado
      cart = [];
      saveCart();
      renderCart();
      showToast('Carrito vaciado por autorización');
    });
  } else {
    // Si no hay protección, borramos directo (ya quitamos el confirm en el paso anterior)
    cart = [];
    saveCart();
    renderCart();
    showToast('Carrito vaciado');
  }
}

// ========================================
// CLIENTES FUNCTIONS
// ========================================

function openClientsModal() {
  const modal = document.getElementById('clientsModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('active');
  }

  clientSearchQuery = '';
  const searchInput = document.getElementById('clientSearchInput');
  if (searchInput) {
    searchInput.value = '';
    setTimeout(() => searchInput.focus(), 100);
  }

  renderClientsList();
  updateGenericBadge();
}

function closeClientsModal() {
  const modal = document.getElementById('clientsModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('active');
  }
  forceFocusToSearch();
}

function renderClientsList() {
  const container = document.getElementById('clientsList');
  if (!container) return;

  let filtered = clientsData;
  if (clientSearchQuery) {
    const q = clientSearchQuery.toLowerCase();
    filtered = clientsData.filter(c =>
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.cedula && c.cedula.includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="text-center text-[--fg-muted] py-10">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
        <p class="text-sm">${clientSearchQuery ? 'Sin resultados' : 'No hay clientes registrados aún'}</p>
        ${clientSearchQuery ? '<p class="text-[10px] mt-2">Presiona Enter para crear con esta cédula</p>' : ''}
      </div>`;
    return;
  }

  container.innerHTML = filtered.map(c => {
    const isSelected = c.id === currentClientId;
    return `
      <div class="p-3 rounded-lg border ${isSelected ? 'border-[--accent] bg-[--accent]/10' : 'border-[--border] hover:border-[--accent]'} transition-colors group">
        <div class="flex justify-between items-start">
          <button onclick="selectClient(${c.id})" class="flex-1 text-left">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-[--bg-tertiary] flex items-center justify-center text-[--fg-muted]">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p class="font-semibold text-[--fg-primary] text-sm">${c.name}</p>
                <p class="text-[10px] text-[--fg-muted] font-mono">CI: ${c.cedula || 'N/A'}</p>
                ${c.phone ? `<p class="text-[10px] text-[--fg-muted] font-mono">Tel: ${c.phone}</p>` : ''}
                ${isSelected ? '<span class="badge badge-category text-[9px] mt-1 inline-block">✓ Seleccionado</span>' : ''}
              </div>
            </div>
          </button>
          <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="openClientModal(${c.id})" class="text-[--fg-muted] hover:text-[--accent] p-1.5 rounded hover:bg-[--bg-tertiary]" title="Editar">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button onclick="deleteClient(${c.id})" class="text-[--fg-muted] hover:text-[--danger] p-1.5 rounded hover:bg-[--bg-tertiary]" title="Eliminar">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function handleClientSearch(query) {
  clientSearchQuery = query;
  renderClientsList();
}

function handleClientSearchEnter(query) {
  if (!query.trim()) return;

  // Buscar coincidencia exacta por cédula
  const exact = clientsData.find(c => c.cedula === query.trim());
  if (exact) {
    selectClient(exact.id);
    return;
  }

  // No existe → abrir modal de nuevo cliente con cédula pre-cargada
  openClientModal(null, query.trim());
}

function openClientModal(clientId = null, prefillCedula = '') {
  editingClientId = clientId;
  const modal = document.getElementById('clientModal');
  const title = document.getElementById('clientModalTitle');

  if (clientId) {
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;

    if (title) title.textContent = 'Editar Cliente';
    document.getElementById('clientNameInput').value = client.name || '';
    document.getElementById('clientCedulaInput').value = client.cedula || '';
    document.getElementById('clientPhoneInput').value = client.phone || '';
    document.getElementById('clientAddressInput').value = client.address || '';
  } else {
    if (title) title.textContent = 'Nuevo Cliente';
    document.getElementById('clientNameInput').value = '';
    document.getElementById('clientCedulaInput').value = prefillCedula;
    document.getElementById('clientPhoneInput').value = '';
    document.getElementById('clientAddressInput').value = '';
  }

  if (modal) modal.classList.add('active');
  setTimeout(() => {
    const nameInput = document.getElementById('clientNameInput');
    if (nameInput) nameInput.focus();
  }, 100);
}

function closeClientModal() {
  const modal = document.getElementById('clientModal');
  if (modal) modal.classList.remove('active');
  editingClientId = null;
}

function saveClient() {
  const name = document.getElementById('clientNameInput').value.trim();
  const cedula = document.getElementById('clientCedulaInput').value.trim();
  const phone = document.getElementById('clientPhoneInput').value.trim();
  const address = document.getElementById('clientAddressInput').value.trim();

  if (!name) {
    showToast('El nombre es obligatorio', 'error');
    return;
  }

  // ====== GUARDAR REFERENCIA ANTES DE QUE SE BORRE ======
  const isEditing = editingClientId;
  // ======================================================

  // Validar cédula duplicada
  if (cedula) {
    const duplicate = clientsData.find(c => c.cedula === cedula && c.id !== isEditing);
    if (duplicate) {
      showToast(`Cédula ya existe en: ${duplicate.name}`, 'error');
      return;
    }
  }

  if (isEditing) {
    // === MODO EDICIÓN ===
    const client = clientsData.find(c => c.id === isEditing);
    if (client) {
      client.name = name;
      client.cedula = cedula;
      client.phone = phone;
      client.address = address;
    }
    showToast('Cliente actualizado');

    // Si era el cliente seleccionado, refrescar el header
    if (currentClientId === isEditing) {
      updateCurrentClientDisplay();
    }

    saveClients();
    renderClientsList();
    closeClientModal();  // Cerrar al final, después de usar editingClientId
  } else {
    // === MODO NUEVO ===
    const newId = clientsData.length > 0 ? Math.max(...clientsData.map(c => c.id)) + 1 : 1;
    clientsData.push({
      id: newId,
      name: name,
      cedula: cedula,
      phone: phone,
      address: address,
      createdAt: new Date().toISOString()
    });

    saveClients();
    showToast('Cliente creado');
    closeClientModal();  // Cerrar al final
    selectClient(newId);  // Auto-seleccionar el nuevo (cierra la lista)
  }
}

function deleteClient(id) {
  if (currentClientId === id) {
    showToast('No puedes eliminar el cliente seleccionado. Selecciona otro primero.', 'error');
    return;
  }

  showConfirm('¿Eliminar este cliente?', () => {
    clientsData = clientsData.filter(c => c.id !== id);
    saveClients();
    renderClientsList();
    showToast('Cliente eliminado');
  });
}

function selectClient(id) {
  currentClientId = id;
  updateCurrentClientDisplay();
  closeClientsModal();

  const client = clientsData.find(c => c.id === id);
  if (client) {
    showToast(`Cliente: ${client.name}`);
  }
}

function selectGenericClient() {
  currentClientId = null;
  updateCurrentClientDisplay();
  closeClientsModal();
  showToast('Cliente Genérico seleccionado');
}

function updateCurrentClientDisplay() {
  const nameEl = document.getElementById('currentClientName');
  const cedulaEl = document.getElementById('currentClientCedula');

  if (currentClientId) {
    const client = clientsData.find(c => c.id === currentClientId);
    if (client) {
      if (nameEl) nameEl.textContent = client.name;
      if (cedulaEl) cedulaEl.textContent = client.cedula || '000000000';
    }
  } else {
    if (nameEl) nameEl.textContent = 'Cliente Genérico';
    if (cedulaEl) cedulaEl.textContent = '000000000';
  }
}

function updateGenericBadge() {
  const badge = document.getElementById('genericBadge');
  if (badge) {
    if (currentClientId === null) {
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }
}

function saveClients() {
  safeSetStorage('pos_clients', clientsData);
}

// ========================================
// ADMIN AUTH
// ========================================
function openAdminAuth() {
  // AGREGAR ESTO: Cerrar otros modales para que no se superpongan
  closeCheckout();
  closeOpenDayModal();
  closeProductModal();
  closeSaveInvoice(); // Por si acaso

  const input = document.getElementById('adminPasswordInput');
  const modal = document.getElementById('adminAuthModal');
  if (input) input.value = '';
  if (modal) {
    modal.classList.add('active');
    setTimeout(() => { if (input) input.focus(); }, 100);
  }
}

function closeAdminAuth() {
  const modal = document.getElementById('adminAuthModal');
  if (modal) modal.classList.remove('active');
}

function verifyAdminPassword() {
  const input = document.getElementById('adminPasswordInput');
  if (!input) return;

  if (input.value === adminPassword) {
    // --- CONTRASEÑA CORRECTA ---
    adminAttempts = 0;
    closeAdminAuth();

    // AQUÍ ESTÁ LA MAGIA:
    if (pendingSecurityAction) {
      // Si había una acción pendiente (borrar producto, etc), la ejecutamos
      pendingSecurityAction();
      pendingSecurityAction = null; // Limpiamos
    } else {
      // Si no, es el login normal para entrar al admin
      openAdminPanel();
    }
  } else {
    // --- CONTRASEÑA INCORRECTA ---
    adminAttempts++;
    input.value = '';
    input.focus();

    if (adminAttempts < 3) {
      const remaining = 3 - adminAttempts;
      showToast(`Clave incorrecta. Te quedan ${remaining} intento${remaining !== 1 ? 's' : ''}.`, 'error');
    } else {
      // Bloqueo y recovery (tu lógica actual)
      closeAdminAuth();
      openRecoveryModal();
      adminAttempts = 0;
    }
  }
}

function openRecoveryModal() {
  const modal = document.getElementById('recoveryModal');
  const step1 = document.getElementById('recoveryStep1');
  const step2 = document.getElementById('recoveryStep2');
  const questionDisplay = document.getElementById('displaySecurityQuestion');
  const answerInput = document.getElementById('recoveryAnswerInput');

  // Resetear vistas
  step1.classList.remove('hidden');
  step2.classList.add('hidden');
  answerInput.value = '';

  if (securityQuestion) {
    questionDisplay.textContent = securityQuestion;
  } else {
    questionDisplay.textContent = "No hay pregunta de seguridad configurada.";
    questionDisplay.classList.add('text-[--warning]');
  }

  if (modal) {
    modal.classList.remove('hidden'); // <--- AGREGA ESTO (Importante)
    modal.classList.add('active');
  }
}

function closeRecoveryModal() {
  const modal = document.getElementById('recoveryModal');
  if (modal) {
    modal.classList.remove('active');
    modal.classList.add('hidden'); // <--- AGREGA ESTO (Importante)
  }
}

function verifySecurityAnswer() {
  const input = document.getElementById('recoveryAnswerInput');
  const userAnswer = input.value.trim().toLowerCase();

  // Si NO hay pregunta configurada, ir directo al respaldo
  if (!securityQuestion || !securityAnswer) {
    showToast('No tienes pregunta de seguridad configurada. Descarga el respaldo y reinicia.', 'error');
    setTimeout(() => {
      showRecoveryBackupStep();
    }, 800);
    return;
  }

  if (userAnswer === securityAnswer) {
    closeRecoveryModal();
    showInput("Nueva Clave de Admin", "", (newPass) => {
      if (newPass.length < 4) {
        showToast('La clave debe tener al menos 4 caracteres', 'error');
        return;
      }
      adminPassword = newPass;
      localStorage.setItem('pos_admin_password', adminPassword);
      showToast('Clave restablecida con éxito. Inicia sesión.');
      openAdminAuth();
    });
  } else {
    showToast('Respuesta incorrecta', 'error');
    setTimeout(() => {
      // Reemplazo del confirm() nativo por tu modal personalizado
      showConfirm(
        "Respuesta incorrecta.\n\n¿Deseas descargar un respaldo de tus productos y reiniciar el sistema?",
        () => {
          showRecoveryBackupStep();
        }
      );
    }, 500);
  }
}


function changePassword() {
  const currentInput = document.getElementById('currentPasswordInput');
  const newPassInput = document.getElementById('newPasswordInput');

  if (!currentInput || !newPassInput) return;

  const current = currentInput.value;
  const newPass = newPassInput.value;

  if (current !== adminPassword) {
    showToast('Clave actual incorrecta', 'error');
    return;
  }
  if (!newPass || newPass.length < 4) {
    showToast('La nueva clave debe tener al menos 4 caracteres', 'error');
    return;
  }

  adminPassword = newPass;
  localStorage.setItem('pos_admin_password', adminPassword);
  currentInput.value = '';
  newPassInput.value = '';
  showToast('Clave actualizada');
}

// ========================================
// SAVED INVOICES
// ========================================
function openSavedInvoices() {
  const modal = document.getElementById('savedInvoicesModal');
  if (modal) {
    modal.classList.remove('hidden'); // 1. Quitar oculto
    modal.classList.add('active');   // 2. Activar
  }

  // 3. Dibujar la lista (Esto destruye y crea el HTML nuevo)
  renderSavedInvoicesList();

  // ==========================================
  // CORRECCIÓN DEFINITIVA DE FOCO
  // ==========================================
  // Usamos requestAnimationFrame para esperar al siguiente cuadro de pintura
  requestAnimationFrame(() => {
    // Y un pequeño setTimeout de seguridad para asegurar que el modal
    // y sus elementos son completamente visibles e interactivos para el teclado
    setTimeout(() => {
      if (savedInvoices.length > 0) {
        // Opción A: Usar la función lógica (que actualiza estilos)
        selectSavedInvoice(0);

        // Opción B: FORZAR EL FOCO MANUALMENTE (Backup)
        // Esto garantiza que el foco vaya al primer elemento aunque la lógica anterior falle
        const firstItem = document.querySelector('.saved-invoice-item');
        if (firstItem) {
          firstItem.focus();
        }
      } else {
        // Si no hay facturas, limpiamos
        renderInvoicePreview(null);
      }
    }, 50); // 20ms es un tiempo imperceptible para el humano pero suficiente para el navegador
  });
}

function closeSavedInvoices() {
  const modal = document.getElementById('savedInvoicesModal');
  if (modal) {
    modal.classList.add('hidden');  // <--- Volver a ocultar
    modal.classList.remove('active');
  }

  // Limpiar selección al cerrar para evitar conflictos
  selectedSavedInvoiceIndex = null;
  forceFocusToSearch();
}

// Variable global para saber qué índice está seleccionado actualmente
let selectedSavedInvoiceIndex = null;

function renderSavedInvoicesList() {
  const container = document.getElementById('savedInvoicesList');
  if (!container) return;

  if (savedInvoices.length === 0) {
    container.innerHTML = `<div class="text-center text-[--fg-muted] py-10 text-sm">No hay Notas guardadas</div>`;
    renderInvoicePreview(null);
    return;
  }

  container.innerHTML = savedInvoices.map((invoice, index) => {
    const isActive = (index === selectedSavedInvoiceIndex);
    const activeClass = isActive ? 'bg-[--accent]/10 border-[--accent] ring-1 ring-[--accent]/50' : 'bg-[--bg-card] border-[--border] hover:border-[--accent]';

    // Calcular total en BS para mostrar en la tarjeta
    const totalBS = toBS(invoice.total || 0);

    return `
      <div onclick="selectSavedInvoice(${index})" 
        class="saved-invoice-item cursor-pointer p-4 rounded-xl border transition-all duration-200 group ${activeClass}"
      tabindex="0" 
      role="button" 
      data-index="${index}">
        <div class="flex justify-between items-start mb-2">
          <div>
            <h4 class="font-bold text-[--fg-primary] ${isActive ? 'text-[--accent]' : ''}">${invoice.name || 'Nota #' + (index + 1)}</h4>
            <p class="text-xs text-[--fg-muted] mt-1">${new Date(invoice.date).toLocaleString('es-VE')}</p>
            <p class="text-xs text-[--fg-muted]">${invoice.items ? invoice.items.length : 0} producto(s)</p>
          </div>
          <div class="text-right">
            <!-- Total USD -->
            <p class="font-mono text-lg font-bold ${isActive ? 'text-[--accent]' : 'text-[--fg-primary]'}">${formatUSD(invoice.total || 0)}</p>
            <!-- Total BS -->
            <p class="font-mono text-xs text-[--fg-secondary]">${formatBS(totalBS)}</p>
            

        <button onclick="event.stopPropagation(); deleteInvoice(${index})" 
          class="text-[10px] text-[--danger] hover:underline mt-1 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
        Eliminar
        </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// --- NUEVA FUNCIÓN: Maneja la selección visual y la carga del detalle ---
function selectSavedInvoice(index) {
  // 1. Actualizar índice global
  selectedSavedInvoiceIndex = index;

  // 2. ACTUALIZACIÓN VISUAL INTELIGENTE (Sin redibujar todo el HTML)
  // Esto evita que el foco se pierda y que el botón desaparezca
  const items = document.querySelectorAll('.saved-invoice-item');

  items.forEach((item) => {
    const itemIndex = parseInt(item.dataset.index);

    // Clases base
    let classes = 'saved-invoice-item cursor-pointer p-4 rounded-xl border transition-all duration-200 group';

    // Clases activas vs inactivas
    if (itemIndex === index) {
      classes += ' bg-[--accent]/10 border-[--accent] ring-1 ring-[--accent]/50';
      item.focus(); // Enfocamos inmediatamente SIN timeout porque el elemento no se borró
    } else {
      classes += ' bg-[--bg-card] border-[--border] hover:border-[--accent]';
    }

    item.className = classes;
  });

  // 3. Renderizar solo el panel derecho (Detalles)
  renderInvoicePreview(index);
}

// --- NUEVA FUNCIÓN: Dibuja los productos en el panel derecho ---
function renderInvoicePreview(index) {
  const previewHeader = document.getElementById('previewHeader');
  const previewItems = document.getElementById('previewItems');
  const previewTotal = document.getElementById('previewTotal');
  const loadBtn = document.getElementById('btnLoadSelectedInvoice');

  // Si no hay índice seleccionado o es inválido
  if (index === null || !savedInvoices[index]) {
    previewHeader.innerHTML = '<span class="text-xs text-[--fg-secondary]">Selecciona una nota</span>';
    previewItems.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-[--fg-muted] opacity-50">
        <p class="text-sm">Sin selección</p>
      </div>`;
    previewTotal.innerHTML = '';
    if (loadBtn) loadBtn.disabled = true;
    return;
  }

  const invoice = savedInvoices[index];

  // Actualizar cabecera del detalle
  previewHeader.innerHTML = `
    <div>
      <h4 class="font-bold text-[--fg-primary] text-lg leading-tight">${invoice.name || 'Sin nombre'}</h4>
      <p class="text-xs text-[--fg-muted] mt-1">${new Date(invoice.date).toLocaleString('es-VE')}</p>
    </div>
  `;

  // Generar HTML de los items con TOTALES EN BS
  if (!invoice.items || invoice.items.length === 0) {
    previewItems.innerHTML = '<p class="text-sm text-center py-4 text-[--fg-muted]">Nota vacía</p>';
  } else {
    previewItems.innerHTML = invoice.items.map(item => {
      const lineTotalUSD = (item.price || 0) * (item.qty || 0);
      const lineTotalBS = toBS(lineTotalUSD); // <-- CÁLCULO EN BS

      return `
      <div class="flex justify-between items-center p-3 bg-[--bg-card] rounded-lg border border-[--border]">
        <div class="flex-1 min-w-0 pr-2">
          <p class="text-sm font-medium text-[--fg-primary] truncate">${item.name}</p>
          <p class="text-xs text-[--fg-muted]">${formatUSD(item.price)} x ${item.qty}</p>
        </div>
        <div class="text-right">
          <!-- Total en USD -->
          <p class="font-mono text-sm font-bold text-[--accent]">${formatUSD(lineTotalUSD)}</p>
          <!-- Total en Moneda Local (BS) -->
          <p class="font-mono text-xs text-[--fg-secondary]">${formatBS(lineTotalBS)}</p>
        </div>
      </div>
    `}).join('');
  }

  // Actualizar Total y Botón con TOTAL EN BS
  const totalUSD = invoice.total || 0;
  const totalBS = toBS(totalUSD); // <-- CÁLCULO EN BS

  previewTotal.innerHTML = `
    <div class="text-right">
        <p class="font-mono text-2xl font-bold text-[--accent]">${formatUSD(totalUSD)}</p>
        <p class="font-mono text-sm text-[--fg-secondary] font-semibold">${formatBS(totalBS)}</p>
    </div>
  `;

  if (loadBtn) loadBtn.disabled = false;
}

// --- NUEVA FUNCIÓN: Carga la nota seleccionada actualmente ---
function confirmLoadSelectedInvoice() {
  if (selectedSavedInvoiceIndex !== null && savedInvoices[selectedSavedInvoiceIndex]) {

    // ==========================================
    // LÓGICA DE RESPALDO AUTOMÁTICO
    // ==========================================
    let indexToLoad = selectedSavedInvoiceIndex; // Índice original

    if (cart.length > 0) {
      const currentTotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
      const currentTime = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

      const backupInvoice = {
        id: Date.now(),
        name: `Respaldo Auto ${currentTime}`,
        date: new Date().toISOString(),
        items: JSON.parse(JSON.stringify(cart)),
        subtotal: currentTotal,
        total: currentTotal
      };

      // Agregamos al inicio (esto desplaza todos los índices existentes +1)
      savedInvoices.unshift(backupInvoice);

      localStorage.setItem('pos_saved_invoices', JSON.stringify(savedInvoices));
      updateSavedInvoicesCount();

      renderSavedInvoicesList();

      // IMPORTANTE: Como agregamos uno al principio, el índice que queremos cargar ahora es +1
      indexToLoad = selectedSavedInvoiceIndex + 1;

      showToast('Carrito anterior guardado como respaldo');
    }
    // ==========================================

    // Ahora cargamos la factura usando el índice corregido
    loadInvoice(indexToLoad);
  }
}

function loadInvoice(index) {
  const invoice = savedInvoices[index];
  if (!invoice || !invoice.items) return;

  invoice.items.forEach(item => {
    const product = productsData.find(p => p.id === item.id);
    if (product) {
      product.stock = (product.stock || 0) + (item.qty || 0);
    }
  });
  saveProducts();

  cart = invoice.items;
  saveCart();
  savedInvoices.splice(index, 1);
  safeSetStorage('pos_saved_invoices', savedInvoices);
  updateSavedInvoicesCount();
  renderCart();

  // Resetear selección para evitar conflictos futuros
  selectedSavedInvoiceIndex = null;

  closeSavedInvoices();
  showToast('Nota cargada al carrito');
}

function openSaveInvoice() {
  closeCheckout();
  setTimeout(() => {
    const input = document.getElementById('invoiceNameInput');
    const modal = document.getElementById('saveInvoiceModal');
    const saveBtn = document.getElementById('confirmSaveInvoiceBtn');

    if (input) {
      // ====== AUTO-LLENAR CON NOMBRE DEL CLIENTE ======
      if (currentClientId) {
        const client = clientsData.find(c => c.id === currentClientId);
        if (client) {
          input.value = client.name;
        } else {
          input.value = '';
        }
      } else {
        input.value = ''; // Cliente genérico → campo vacío
      }

      // Seleccionar texto para que el usuario pueda sobreescribir fácil
      setTimeout(() => input.select(), 50);

      // Permitir Enter para guardar
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (saveBtn) saveBtn.click();
        }
      };
    }

    if (modal) modal.classList.add('active');
    setTimeout(() => {
      if (input) input.focus();
    }, 100);
  }, 200);
}

function confirmSaveInvoice() {
  const nameInput = document.getElementById('invoiceNameInput');
  const name = nameInput ? nameInput.value : '';
  const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);
  const totalCost = cart.reduce((sum, item) => sum + ((item.cost || 0) * (item.qty || 0)), 0);

  const total = subtotal;

  // ============================================================
  // NUEVO: RESERVA DE STOCK (Restar del inventario al guardar)
  // ============================================================
  cart.forEach(item => {
    const product = productsData.find(p => p.id === item.id);
    if (product) {
      // Restamos la cantidad para "reservarla" en la nota
      product.stock = (product.stock || 0) - (item.qty || 0);
    }
  });
  saveProducts(); // Guardamos el cambio en el inventario inmediatamente
  // ============================================================

  const invoice = {
    id: Date.now(),
    name: name || null,
    date: new Date().toISOString(),
    items: JSON.parse(JSON.stringify(cart)),
    subtotal: subtotal,
    totalCost: totalCost,
    total: total,
    exchangeRate: exchangeRate
  };

  savedInvoices.push(invoice);
  safeSetStorage('pos_saved_invoices', savedInvoices);
  updateSavedInvoicesCount();

  cart = [];
  saveCart();
  renderCart();
  closeSaveInvoice();
  showToast('Nota guardada y stock reservado');
}

// ========================================
// CHECKOUT
// ========================================
function openCheckout() {
  if (cart.length === 0) {
    showToast('Carrito vacio', 'error');
    return;
  }

  try {
    renderCheckoutPaymentMethods();
  } catch (e) {
    console.error("Error renderizando pagos:", e);
    showToast('Error cargando métodos de pago', 'error');
  }

  // ====== CÁLCULO DE TOTALES CON IVA SUMADO ======
  // Separamos en gravado y exento para calcular correctamente
  let taxableSubtotal = 0;
  let exemptSubtotal = 0;

  cart.forEach(item => {
    const product = productsData.find(p => p.id === item.id);
    const isMiscItem = (item.code === 'MISC-BS' || item.code === 'MISC-USD');
    const isExempt = (product && taxExemptCategories.includes(product.category)) || isMiscItem;
    const lineTotal = (item.price || 0) * (item.qty || 0);

    if (isExempt) {
      exemptSubtotal += lineTotal;
    } else {
      taxableSubtotal += lineTotal;
    }
  });

  const rateFactor = taxRate / 100;
  // En modo "added": total = subtotal + IVA de lo gravado
  // En modo "included": total = subtotal (ya viene con IVA dentro)
  const tax = (taxMode === 'added') ? taxableSubtotal * rateFactor : 0;
  const subtotal = taxableSubtotal + exemptSubtotal;
  const total = (taxMode === 'added') ? subtotal + tax : subtotal;
  // ===================================

  checkoutCost = cart.reduce((sum, item) => sum + ((item.cost || 0) * (item.qty || 0)), 0);
  checkoutTotal = total;

  const modalTotalUSD = document.getElementById('modalTotalUSD');
  const modalTotalBS = document.getElementById('modalTotalBS');

  if (modalTotalUSD) modalTotalUSD.textContent = formatUSD(checkoutTotal);
  if (modalTotalBS) modalTotalBS.textContent = formatBS(toBS(checkoutTotal));

  document.querySelectorAll('.payment-input').forEach(input => {
    input.value = '';
  });
  document.querySelectorAll('.payment-card').forEach(card => {
    card.classList.remove('active');
  });

  selectedChangeMethod = 'efectivo_usd';
  updatePaymentSummary();

  const modal = document.getElementById('checkoutModal');
  if (modal) modal.classList.add('active');

  setTimeout(() => {
    const firstInput = document.querySelector('.payment-input');
    if (firstInput) firstInput.focus();
  }, 100);
}


function selectChangeMethod(method) {
  selectedChangeMethod = method;
  const buttons = document.querySelectorAll('.change-method-btn');

  // Definimos los estilos directamente aquí para asegurar que se vean
  const baseStyle = "px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-all duration-200 border";
  const activeStyle = "bg-[--accent]/10 border-[--accent] text-[--accent] font-medium shadow-sm ring-1 ring-[--accent]/20";
  const inactiveStyle = "bg-[--bg-card] border-[--border] text-[--fg-primary] hover:bg-[--bg-tertiary] hover:border-[--fg-muted]";

  buttons.forEach(btn => {
    if (btn.dataset.change === method) {
      // Estilo cuando está seleccionado
      btn.className = `change-method-btn ${baseStyle} ${activeStyle}`;
    } else {
      // Estilo cuando NO está seleccionado (Aquí estaba el error: no tenía estilo)
      btn.className = `change-method-btn ${baseStyle} ${inactiveStyle}`;
    }
  });
}


function updatePaymentSummary() {
  let totalBS = 0;
  let totalUSD = 0;

  // 1. Calcular totales brutos (lo que escribes en los inputs)
  document.querySelectorAll('.payment-input').forEach(input => {
    const amount = parseFloat(input.value) || 0;
    const method = input.dataset.method;

    // Usamos la función auxiliar para separar USD de Moneda Local
    if (isMethodUSD(method)) {
      totalUSD += amount;
    } else {
      totalBS += amount;
    }

    const card = input.closest('.payment-card');
    if (card) {
      if (amount > 0) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    }
  });

  const paidBSEl = document.getElementById('paidBS');
  const paidUSDEl = document.getElementById('paidUSD');
  const paidTotalUSDEl = document.getElementById('paidTotalUSD');

  if (paidBSEl) paidBSEl.textContent = formatBS(totalBS);
  if (paidUSDEl) paidUSDEl.textContent = formatUSD(totalUSD);

  const totalPaidInUSD = totalUSD + (totalBS / exchangeRate);
  if (paidTotalUSDEl) paidTotalUSDEl.textContent = formatUSD(totalPaidInUSD);

  const diff = totalPaidInUSD - checkoutTotal;
  const statusEl = document.getElementById('paymentStatus');
  const confirmBtn = document.getElementById('confirmSaleBtn');
  const changeSection = document.getElementById('changeSection');

  if (!statusEl || !confirmBtn || !changeSection) return;

  // 2. Lógica de Falta / Completo / Cambio
  if (diff < -0.01) {
    const falta = Math.abs(diff);
    const faltaBS = toBS(falta);
    statusEl.innerHTML = `
          <div class="text-right">
            <span class="status-pending font-semibold text-md block">Falta: ${formatUSD(falta)}</span>
            <span class="text-md text-[--fg-secondary]">${formatBS(faltaBS)}</span>
          </div>`;
    confirmBtn.disabled = true;
    changeSection.classList.add('hidden');
  } else if (diff > 0.01) {
    const cambio = diff;
    const cambioBS = toBS(cambio);
    statusEl.innerHTML = `<span class="status-excess font-semibold text-md">Cambio: ${formatUSD(cambio)}</span>`;
    confirmBtn.disabled = false;
    changeSection.classList.remove('hidden');

    const changeAmountEl = document.getElementById('changeAmount');
    const changeAmountBSEl = document.getElementById('changeAmountBS');
    if (changeAmountEl) changeAmountEl.textContent = formatUSD(cambio);
    if (changeAmountBSEl) changeAmountBSEl.textContent = formatBS(cambioBS);
  } else {
    statusEl.innerHTML = `<span class="status-paid font-semibold text-sm">Pago Completo</span>`;
    confirmBtn.disabled = false;
    changeSection.classList.add('hidden');
  }

  // 3. MOSTRAR NETO EN CAJAS (EL ARREGLO DEFINITIVO)

  // A. Para USD (Lo dejamos en bruto por ahora)
  if (paidUSDEl) paidUSDEl.textContent = formatUSD(totalUSD);

  // B. Para BS (Aquí aplicamos la resta inteligente)
  if (paidBSEl) {
    // Paso 1: ¿Es el cambio en BS?
    // Es BS si (Hay cambio) Y (El botón seleccionado es BS O No pagaste nada en USD)
    let isChangeBS = false;
    if (diff > 0.01) {
      if (selectedChangeMethod && !isMethodUSD(selectedChangeMethod)) {
        isChangeBS = true;
      } else if (totalUSD === 0) {
        // DETECCIÓN AUTOMÁTICA: Si pagué 0 USD, el cambio TIENE que ser BS
        isChangeBS = true;
      }
    }

    // Paso 2: Calcular Neto
    if (isChangeBS) {
      // Restamos el valor del cambio convertido a BS al total pagado
      const changeValueBS = toBS(diff);
      paidBSEl.textContent = formatBS(totalBS - changeValueBS);
    } else {
      // No hay cambio en BS, o el cambio sale de los dólares pagados. Mostramos todo el BS.
      paidBSEl.textContent = formatBS(totalBS);
    }
  }
}

// ========================================
// FUNCIÓN PARA AGREGAR DESDE GRID/LISTA
// ========================================
function addToCartFromGrid(productId) {
  const product = productsData.find(p => p.id === productId);
  if (!product) return;

  // 1. Leer la cantidad del input
  const qtyInput = document.getElementById(`qty-${productId}`);
  let qty = 1;
  if (qtyInput) {
    qty = parseInt(qtyInput.value) || 1;
  }

  const existingItem = cart.find(item => item.id === productId);

  if (existingItem) {
    // ==========================================
    // CORRECCIÓN 1: SUMAR EN LUGAR DE REEMPLAZAR
    // ==========================================
    const newTotalQty = existingItem.qty + qty;

    // ==========================================
    // CORRECCIÓN 2: VALIDAR STOCK DEL TOTAL
    // ==========================================
    // Antes solo miraba 'qty', ahora miramos 'newTotalQty'
    if (!allowNegativeStock && newTotalQty > (product.stock || 0)) {
      showToast(`Stock insuficiente. Tienes ${existingItem.qty} y quieres agregar ${qty}. Máximo disponible: ${product.stock}`, 'error');
      return;
    }

    // Aplicamos la suma
    existingItem.qty = newTotalQty;
    // -----------------------------------------
  } else {
    // Si es nuevo, validamos normal
    if (!allowNegativeStock && qty > (product.stock || 0)) {
      showToast('Producto sin stock', 'error');
      return;
    }

    cart.unshift({
      id: product.id,
      name: product.name,
      price: product.price,
      cost: product.cost || 0,
      code: product.code,
      qty: qty
    });
  }

  // 3. Resetear el input a 1 (para la próxima vez)
  if (qtyInput) qtyInput.value = 1;

  // 4. Guardar y Renderizar
  saveCart();
  renderCart();

  // Mensaje informativo mostrando la suma
  const totalMsg = existingItem ? `Total actualizado a ${existingItem.qty}` : `${product.name} agregado`;
  showToast(totalMsg);

  // 5. CERRAR PANEL (Tu lógica existente)
  const productsSection = document.getElementById('productsSection');
  if (productsSection) productsSection.classList.add('hidden');

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
    searchQuery = '';
    searchInput.focus();
  }
}

function confirmSale() {
  const payments = {};
  let totalPaidBS = 0;
  let totalPaidUSD = 0;

  document.querySelectorAll('.payment-input').forEach(input => {
    const amount = parseFloat(input.value) || 0;
    const method = input.dataset.method;
    if (amount > 0) {
      payments[method] = amount;

      // CORRECCIÓN: Usar la función auxiliar
      if (isMethodUSD(method)) {
        totalPaidUSD += amount;
      } else {
        totalPaidBS += amount;
      }
    }
  });

  const totalPaidInUSD = totalPaidUSD + (totalPaidBS / exchangeRate);
  const changeAmount = Math.max(0, totalPaidInUSD - checkoutTotal);

  let changeUSD = 0;
  let changeBS = 0;

  if (changeAmount > 0.01) {
    if (selectedChangeMethod === 'efectivo_usd') {
      changeUSD = changeAmount;
      payments['efectivo_usd_change'] = -changeAmount;
    } else {
      // Si el método seleccionado para dar vuelto es USD (ej. Zelle USD), restamos en USD
      if (isMethodUSD(selectedChangeMethod)) {
        changeUSD = changeAmount;
        payments[selectedChangeMethod + '_change'] = -changeAmount;
      } else {
        // Si es moneda local, convertimos a BS
        changeBS = toBS(changeAmount);
        payments[selectedChangeMethod + '_change'] = -changeBS;
      }
    }
  }

  cart.forEach(item => {
    const product = productsData.find(p => p.id === item.id);
    if (product) {
      // CÓDIGO NUEVO
      product.stock = (product.stock || 0) - (item.qty || 0);
    }
  });
  saveProducts();

  const subtotal = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);

  const taxableSubtotal = cart.reduce((sum, item) => {
    const product = productsData.find(p => p.id === item.id);
    const isExempt = (product && taxExemptCategories.includes(product.category)) ||
      (item.code === 'MISC-BS' || item.code === 'MISC-USD');
    return isExempt ? sum : sum + (item.price * item.qty);
  }, 0);

  const rateFactor = taxRate / 100;
  const tax = taxMode === 'included'
    ? taxableSubtotal - (taxableSubtotal / (1 + rateFactor))
    : taxableSubtotal * rateFactor;
  const total = subtotal;

  // ====== GUARDAR CLIENTE EN LA VENTA ======
  const currentClient = currentClientId ? clientsData.find(c => c.id === currentClientId) : null;

  const sale = {
    id: Date.now(),
    noteNumber: nextNoteNumber,
    date: new Date().toISOString(),
    items: JSON.parse(JSON.stringify(cart)),
    subtotal: subtotal,
    totalCost: checkoutCost,
    profit: subtotal - checkoutCost,
    tax: tax,
    total: total,
    totalBS: toBS(total),
    exchangeRate: exchangeRate,
    payments: payments,
    totalPaidBS: totalPaidBS,
    totalPaidUSD: totalPaidUSD,
    change: changeAmount,
    changeBS: changeBS,
    changeUSD: changeUSD,
    changeMethod: selectedChangeMethod,
    voided: false,
    // Snapshot del cliente al momento de la venta
    client: currentClient ? {
      id: currentClient.id,
      name: currentClient.name,
      cedula: currentClient.cedula,
      phone: currentClient.phone,
      address: currentClient.address
    } : null
  };

  salesHistory.push(sale);
  safeSetStorage('pos_sales', salesHistory);
  nextNoteNumber++;
  localStorage.setItem('pos_next_note_number', nextNoteNumber);

  // ====== DESCARGAR PDF AUTOMÁTICAMENTE (síncrono para evitar pestaña nueva) ======
  generateDeliveryNotePDF(sale.id);


  cart = [];
  saveCart();
  renderCart();
  renderProducts();
  renderSalesHistory();
  closeCheckout();

  // ====== RESETEAR CLIENTE A "GENÉRICO" ======
  currentClientId = null;
  updateCurrentClientDisplay();
  // ===========================================

  if (changeAmount > 0.01) {
    showToast(`Operación completada. Vuelto: ${formatUSD(changeAmount)}`);
  } else {
    showToast('Operación completada');
  }
}


function openAdminPanel() {
  const mainView = document.getElementById('mainView');
  const adminView = document.getElementById('adminView');

  if (mainView) mainView.classList.add('hidden');
  if (adminView) {
    adminView.classList.remove('hidden');
    // Forzar scroll al inicio del contenedor de admin
    const adminContent = document.getElementById('adminContent');
    if (adminContent) adminContent.scrollTop = 0;
  }

  // === FORZAR PESTAÑA DE VENTAS ===
  // 1. Ocultar TODAS las pestañas primero
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
  // 2. Desactivar TODOS los items de navegación
  document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));

  // 3. Mostrar SOLO la pestaña de ventas
  const salesTab = document.getElementById('tabSales');
  if (salesTab) salesTab.classList.remove('hidden');

  // 4. Activar visualmente el item de navegación de ventas
  const salesNavItem = document.querySelector('.admin-nav-item[data-tab="sales"]');
  if (salesNavItem) salesNavItem.classList.add('active');

  // 5. Renderizar datos de ventas
  renderSalesHistory();

  // 6. Enfocar un elemento seguro (evita que el foco quede en un botón de la pestaña anterior)
  setTimeout(() => {
    const todayTotalEl = document.getElementById('todayTotal');
    if (todayTotalEl) todayTotalEl.focus?.();
  }, 100);
}

function closeAdminPanel() {
  const mainView = document.getElementById('mainView');
  const adminView = document.getElementById('adminView');
  if (adminView) adminView.classList.add('hidden');
  if (mainView) mainView.classList.remove('hidden');
  renderProducts();
}

function switchAdminTab(tab) {
  // 1. Ocultar todas las pestañas y desactivar navegación
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));

  // 2. Construir ID del tab (compatible con 'dashboard' → 'tabDashboard')
  const tabId = tab === 'dashboard'
    ? 'tabDashboard'
    : 'tab' + tab.charAt(0).toUpperCase() + tab.slice(1);

  const tabEl = document.getElementById(tabId);
  if (tabEl) tabEl.classList.remove('hidden');

  // 3. Activar item de navegación correspondiente
  const navItem = document.querySelector(`.admin-nav-item[data-tab="${tab}"]`);
  if (navItem) navItem.classList.add('active');

  // 4. Ejecutar lógica específica de cada pestaña
  if (tab === 'sales') {
    renderSalesHistory();
  }
  else if (tab === 'products') {
    renderProductsTable();
    updateExpiringBanner();
    renderAdminCategoryFilter();
  }
  else if (tab === 'dashboard') {
    renderAdvancedStats(); // ✅ Recarga gráfico y Top 10
  }
  else if (tab === 'history') {
    renderHistoryCycles(); // ✅ Caso que faltaba en la segunda versión
  }
  else if (tab === 'settings') {
    renderCategoriesListAdmin();
    updateSystemStatus(); // ✅ Actualiza barra de estado al entrar
  }

  // 5. Siempre actualizar métodos de pago (común a todos los tabs)
  renderPaymentMethodsList();
}

function renderProductsTable() {
  const tbody = document.getElementById('productsTable');
  if (!tbody) return;

  // 1. FILTRADO (Tu lógica original se mantiene igual)
  const catFilter = document.getElementById('adminCategoryFilter');
  const selectedCat = catFilter ? catFilter.value : '';

  // NO LLAMAR A renderAdminCategoryFilter() aquí para rendimiento

  let filteredProducts = productsData;

  // Filtro por búsqueda
  if (adminSearchQuery) {
    const query = adminSearchQuery.toLowerCase();

    filteredProducts = filteredProducts.filter(p => {
      // 1. Buscar en el nombre
      if (p.name && p.name.toLowerCase().includes(query)) return true;

      // 2. Buscar en el código principal
      if (p.code && p.code.toLowerCase().includes(query)) return true;

      // 3. Buscar en códigos secundarios (EL FIX)
      if (p.codes && Array.isArray(p.codes)) {
        return p.codes.some(c => c && c.toLowerCase().includes(query));
      }

      return false;
    });
  }

  // Filtro por categoría
  if (selectedCat) {
    filteredProducts = filteredProducts.filter(p => p.category === selectedCat);
  }

  // Filtro de Vencimiento
  if (showExpiringOnly) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    filteredProducts = filteredProducts.filter(p => {
      if (!p.expiry) return false;
      const parts = p.expiry.split('/');
      if (parts.length !== 3) return false;
      let d = parseInt(parts[0]), m = parseInt(parts[1]) - 1, y = parseInt(parts[2]);
      if (y < 100) y += 2000;
      const expDate = new Date(y, m, d);
      const diffDays = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
      return diffDays <= 30;
    });
  }

  // --- NUEVO: CÁLCULO DE TOTALES (Sobre TODO el inventario, no solo la página) ---
  let totalInvCost = 0;
  let totalInvProfit = 0;
  productsData.forEach(p => { // Nota: Usamos productsData completo para el inventario total
    totalInvCost += (p.cost || 0) * (p.stock || 0);
    totalInvProfit += ((p.price || 0) - (p.cost || 0)) * (p.stock || 0);
  });

  const invCostEl = document.getElementById('inventoryTotalCost');
  const invProfitEl = document.getElementById('inventoryTotalProfit');
  if (invCostEl) invCostEl.textContent = formatUSD(totalInvCost);
  if (invProfitEl) invProfitEl.textContent = formatUSD(totalInvProfit);

  // --- NUEVO: LÓGICA DE PAGINACIÓN ---
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Si estamos buscando o filtrando, resetear a página 1
  // (Opcional: puedes comentar esta línea si quieres mantener la página al filtrar)
  if (adminCurrentPage > totalPages) adminCurrentPage = 1;

  // Cortar el array para mostrar solo los de esta página
  const startIndex = (adminCurrentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);


  // --- DIBUJAR LA TABLA ---
  if (paginatedProducts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-[--fg-muted]">No se encontraron productos</td></tr>`;
  } else {
    tbody.innerHTML = paginatedProducts.map(p => `
      <tr class="hover:bg-[--bg-tertiary]/50">
        <td class="px-4 py-3 font-mono text-xs">${(p.codes && p.codes[0]) || p.code || 'N/A'}</td>
        <td class="px-4 py-3">${p.name || 'Sin nombre'}</td>
        <td class="px-4 py-3"><span class="badge badge-category">${p.category || 'Sin categoria'}</span></td>
        <td class="px-4 py-3 text-right font-mono text-[--warning]">${formatUSD(p.cost || 0)}</td>
        <td class="px-4 py-3 text-right">
          <div class="flex flex-col items-end">
             <span class="font-mono ${getPriceColor(p.price, p.cost)}">${formatUSD(p.price || 0)}</span>
             <span class="text-[10px] text-[--fg-muted] font-mono">
               (${formatBS((p.price || 0) * exchangeRate)})
             </span>
          </div>
        </td>
        <td class="px-4 py-3 text-center">
          <span class="badge ${(p.stock || 0) <= 4 ? 'badge-critical' : 'badge-stock'}">${p.stock || 0}</span>
        </td>
        <td class="px-4 py-3 text-center text-xs font-mono">
           ${(() => {
        const status = getExpiryStatus(p.expiry);
        if (!status) return '<span class="text-[--fg-muted]/50">--</span>';
        return `<span class="${status.color} font-semibold">${status.label}</span>`;
      })()}
        </td>
        <td class="px-4 py-3 text-center">
          <button onclick="editProduct(${p.id})" class="text-[--fg-muted] hover:text-[--accent] p-1" aria-label="Editar">✎</button>
          <button onclick="deleteProduct(${p.id})" class="text-[--fg-muted] hover:text-[--danger] p-1" aria-label="Eliminar">🗑</button>
        </td>
      </tr>
    `).join('');
  }

  // --- NUEVO: DIBUJAR LOS CONTROLES DE PAGINACIÓN ---
  updateExpiringBanner();
  renderPaginationControls(totalPages);
}

function attemptExit() {
  showConfirm("¿Deseas cerrar el programa?", () => {
    window.close();
  });
}

// Función separada para dibujar los botones abajo
function renderPaginationControls(totalPages) {
  const container = document.getElementById('adminPaginationContainer');
  if (!container) return; // Si no existe el div en el HTML, no hacer nada

  // Si solo hay 1 página o 0 resultados, ocultar controles
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const pages = getPaginationPages(adminCurrentPage, totalPages);

  let html = '<div class="flex justify-center items-center gap-2 mt-4 pb-2">';

  // Botón Anterior
  html += `<button onclick="changePage(${adminCurrentPage - 1})" 
                 class="px-3 py-1 rounded border border-[--border] text-sm hover:bg-[--bg-tertiary] disabled:opacity-50" 
                 ${adminCurrentPage === 1 ? 'disabled' : ''}>
           &lt;
           </button>`;

  // Botones Numéricos y ...
  pages.forEach(p => {
    if (p === '...') {
      html += `<span class="text-[--fg-muted] px-1">...</span>`;
    } else {
      const isActive = p === adminCurrentPage;
      html += `<button onclick="changePage(${p})" 
                     class="px-3 py-1 rounded border text-sm font-medium transition-colors 
                            ${isActive
          ? 'bg-[--accent] text-[--bg-primary] border-[--accent]'
          : 'border-[--border] hover:bg-[--bg-tertiary]'}">
               ${p}
               </button>`;
    }
  });

  // Botón Siguiente
  html += `<button onclick="changePage(${adminCurrentPage + 1})" 
                 class="px-3 py-1 rounded border border-[--border] text-sm hover:bg-[--bg-tertiary] disabled:opacity-50" 
                 ${adminCurrentPage === totalPages ? 'disabled' : ''}>
           &gt;
           </button>`;

  html += '</div>';
  container.innerHTML = html;
}

// Función auxiliar para cambiar de página
function changePage(newPage) {
  adminCurrentPage = newPage;
  renderProductsTable();
  // Opcional: Scroll suave hacia arriba de la tabla
  document.querySelector('table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function initStockControlVisuals() {
  const btn = document.getElementById('btnStockControl');
  const circle = document.getElementById('btnStockCircle');

  // Si no encuentra los botones (porque no estamos en settings), no hace nada
  if (!btn || !circle) return;

  if (allowNegativeStock) {
    // Está activo -> Verde
    btn.classList.add('bg-[--accent]');
    btn.classList.remove('bg-gray-600');
    circle.classList.add('translate-x-5');
    circle.classList.remove('translate-x-0');
  } else {
    // Está inactivo -> Gris
    btn.classList.remove('bg-[--accent]');
    btn.classList.add('bg-gray-600');
    circle.classList.remove('translate-x-5');
    circle.classList.add('translate-x-0');
  }
}

function renderCheckoutPaymentMethods() {
  const bsContainer = document.getElementById('bsPaymentMethodsContainer');
  const usdContainer = document.getElementById('usdPaymentContainer');
  const changeContainer = document.getElementById('changeMethodBtns');

  if (!bsContainer || !usdContainer) return;

  // Cargar métodos si está vacío
  if (!paymentMethods || paymentMethods.length === 0) {
    const stored = localStorage.getItem('pos_payment_methods');
    if (stored) {
      paymentMethods = JSON.parse(stored);
    } else {
      paymentMethods = [
        { id: 'biopago', name: 'Biopago', type: 'bs', icon: 'phone', color: 'purple' },
        { id: 'pagomovil', name: 'Pago Movil', type: 'bs', icon: 'mobile', color: 'blue' },
        { id: 'tarjeta', name: 'Tarjeta (Punto)', type: 'bs', icon: 'credit-card', color: 'orange' },
        { id: 'efectivo_bs', name: `Efectivo ${currencyLabel}`, type: 'bs', icon: 'banknote', color: 'green' },
      ];
      savePaymentMethods();
    }
  }

  let bsHtml = '';
  let usdCustomHtml = '';
  let changeHtml = '';

  // Separar métodos
  paymentMethods.forEach(method => {
    const isUSD = method.type === 'usd';
    const colorClass = isUSD ? 'text-[--accent]' : 'text-[--fg-primary]';
    const bgClass = isUSD ? 'bg-[--accent]/15' : 'bg-gray-500/15';

    let fondoInicio = 0;
    if (currentPeriod.openingBalance && currentPeriod.openingBalance[method.id]) {
      fondoInicio = currentPeriod.openingBalance[method.id];
    }
    let displayFondo = fondoInicio > 0 ? (isUSD ? formatUSD(fondoInicio) : formatBS(fondoInicio)) : '';
    let labelFondo = displayFondo ? `<span class="text-[10px] text-[--fg-muted] block truncate">${displayFondo}</span>` : '';

    // ==========================================
    // NUEVA ESTRUCTURA VISUAL (FILA HORIZONTAL)
    // ==========================================
    const cardHtml = `
    <div class="payment-card flex items-center justify-between p-2.5 gap-2 border border-[--border] rounded-lg bg-[--bg-card] hover:bg-[--bg-tertiary] transition-colors mb-[5px]" data-method="${method.id}">
      
      <!-- IZQUIERDA: Icono, Nombre y Datos -->
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <div class="w-9 h-9 rounded-lg ${bgClass} flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 ${colorClass}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
          </svg>
        </div>
        <div class="flex flex-col min-w-0">
          <span class="font-medium text-sm text-[--fg-primary] truncate">${method.name}</span>
          
          <div class="flex items-center gap-2 mt-0.5">
             <span class="badge badge-code text-[9px]" style="background: rgba(0, 200, 150, 0.15); color: ${isUSD ? 'var(--accent)' : 'var(--fg-primary)'};">
              ${isUSD ? 'USD' : currencyLabel}
            </span>
            ${labelFondo}
          </div>
        </div>
      </div>

      <!-- DERECHA: Input de Monto (Ancho fijo) -->
      <input type="number" class="payment-input w-28 px-2 py-1.5 text-sm font-mono text-right border border-[--border] rounded bg-[--bg-card] focus:ring-1 focus:ring-[--accent] outline-none" 
        placeholder="0.00"
        data-method="${method.id}" oninput="updatePaymentSummary()" aria-label="Monto ${method.name}">
    </div>`;

    if (isUSD) {
      usdCustomHtml += cardHtml;
    } else {
      bsHtml += cardHtml;
    }
  });

  // Renderizar Columna Izquierda (Local)
  bsContainer.innerHTML = bsHtml;
  const bsTitle = document.getElementById('bsPaymentTitle');
  if (bsTitle) bsTitle.textContent = `Metodos de Pago en ${currencyLabel}`;

  // Renderizar Columna Derecha (USD) - MISMA ESTRUCTURA PARA EL USD FIJO
  let fondoInicioUSD = 0;
  if (currentPeriod.openingBalance && currentPeriod.openingBalance['efectivo_usd']) {
    fondoInicioUSD = currentPeriod.openingBalance['efectivo_usd'];
  }
  let labelFondoUSD = fondoInicioUSD > 0 ? `<span class="text-[10px] text-[--fg-muted] block">${formatUSD(fondoInicioUSD)}</span>` : '';

  const usdFixedHtml = `
  <div class="payment-card flex items-center justify-between p-2.5 gap-2 border border-[--border] rounded-lg bg-[--bg-card] hover:bg-[--bg-tertiary] transition-colors mb-[5px]" data-method="efectivo_usd">
    
    <!-- IZQUIERDA -->
    <div class="flex items-center gap-3 flex-1 min-w-0">
      <div class="w-9 h-9 rounded-lg bg-[--accent]/15 flex items-center justify-center flex-shrink-0">
        <svg class="w-5 h-5 text-[--accent]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="flex flex-col min-w-0">
        <span class="font-medium text-sm text-[--fg-primary]">Efectivo USD</span>
        <div class="flex items-center gap-2 mt-0.5">
          <span class="badge badge-code text-[9px]" style="background: rgba(0, 200, 150, 0.15); color: var(--accent);">USD</span>
          ${labelFondoUSD}
        </div>
      </div>
    </div>

    <!-- DERECHA -->
    <input type="number" class="payment-input w-28 px-2 py-1.5 text-sm font-mono text-right border border-[--border] rounded bg-[--bg-card] focus:ring-1 focus:ring-[--accent] outline-none" 
      placeholder="0.00"
      data-method="efectivo_usd" oninput="updatePaymentSummary()" aria-label="Monto Efectivo USD">
  </div>`;

  usdContainer.innerHTML = usdFixedHtml + usdCustomHtml;

  // Botones de Vuelto (sin cambios visuales, pero los dejo por si acaso)
  if (changeContainer) {
    changeHtml = `
    <button class="change-method-btn px-3 py-1.5 rounded-lg text-sm bg-[--accent]/10 border border-[--accent] text-[--accent] font-medium shadow-sm" 
            data-change="efectivo_usd" 
            onclick="selectChangeMethod('efectivo_usd')">
      Efectivo USD
    </button>`;

    paymentMethods.forEach(method => {
      if (method.allowChange === false) return;
      changeHtml += `
      <button class="change-method-btn px-3 py-1.5 rounded-lg text-sm bg-[--bg-card] border border-[--border] text-[--fg-primary] hover:bg-[--bg-tertiary]" 
              data-change="${method.id}" 
              onclick="selectChangeMethod('${method.id}')">
        ${method.name}
      </button>`;
    });

    changeContainer.innerHTML = changeHtml;
    selectChangeMethod('efectivo_usd');
  }
}

function renderSalesHistory() {
  const container = document.getElementById('salesList');
  if (!container) return;



  const lastCloseEl = document.getElementById('lastCloseTime');
  if (lastCloseEl) {
    if (lastCloseTime) {
      lastCloseEl.textContent = new Date(lastCloseTime).toLocaleString('es-VE');
    } else {
      lastCloseEl.textContent = 'Nunca';
    }
  }

  let todaySales = salesHistory.filter(s => {
    const saleDate = new Date(s.date);
    if (lastCloseTime) {
      return saleDate >= new Date(lastCloseTime) && !s.voided;
    }
    const today = new Date().toDateString();
    return saleDate.toDateString() === today && !s.voided;
  });

  const todayTotal = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  const todayProfit = todaySales.reduce((sum, s) => sum + (s.profit || 0), 0);
  const expiringCount = getExpiringProductsCount();

  const todayTotalEl = document.getElementById('todayTotal');
  const todayProfitEl = document.getElementById('todayProfit');
  if (todayTotalEl) todayTotalEl.textContent = formatUSD(todayTotal);
  if (todayProfitEl) todayProfitEl.textContent = formatUSD(todayProfit);

  const expiringTextEl = document.getElementById('expiringCountText');
  const expiringBoxEl = document.getElementById('expiringWarningBox');

  if (expiringTextEl) expiringTextEl.textContent = expiringCount;

  // Ocultar la caja si no hay nada por vencer, mostrar si hay
  if (expiringBoxEl) {
    if (expiringCount > 0) {
      expiringBoxEl.classList.remove('hidden');
    } else {
      expiringBoxEl.classList.add('hidden');
    }
  }
  // --- CALCULO DE TOTALES POR MÉTODO ---
  const paymentTotals = {};
  todaySales.forEach(sale => {
    if (sale.payments) {
      for (const [method, amount] of Object.entries(sale.payments)) {
        let targetMethod = method;
        if (method.endsWith('_change')) targetMethod = method.replace('_change', '');
        if (!paymentTotals[targetMethod]) paymentTotals[targetMethod] = 0;
        paymentTotals[targetMethod] += amount;
      }
    }
  });

  // --- RENDERIZADO DEL BREAKDOWN (TARJETAS SUPERIORES) ---
  const breakdownContainer = document.getElementById('dailyPaymentBreakdown');
  if (breakdownContainer) {
    let breakdownHTML = '';
    const allMethods = ['efectivo_usd', ...paymentMethods.map(m => m.id)];

    // Variables para sumar SOLO ventas (sin apertura)
    let totalVentasUSD = 0;
    let totalVentasLocal = 0;

    allMethods.forEach(methodId => {
      const salesTotal = paymentTotals[methodId] || 0;
      const openingBal = (currentPeriod.openingBalance && currentPeriod.openingBalance[methodId])
        ? currentPeriod.openingBalance[methodId]
        : 0;

      if (Math.abs(salesTotal) < 0.01 && openingBal < 0.01) return;

      let isUSD = false;
      let name = methodId;
      if (methodId === 'efectivo_usd') {
        isUSD = true; name = 'Efectivo USD';
      } else {
        const config = paymentMethods.find(m => m.id === methodId);
        if (config) { name = config.name; isUSD = config.type === 'usd'; }
      }

      // ====== ACUMULAR TOTALES DE VENTAS (sin apertura) ======
      if (isUSD) {
        totalVentasUSD += salesTotal;
      } else {
        totalVentasLocal += salesTotal;
      }
      // =======================================================

      const totalInCashier = openingBal + salesTotal;
      const colorClass = isUSD ? 'text-[--accent]' : 'text-[--fg-primary]';

      let movementLabel = '';
      if (salesTotal > 0) {
        movementLabel = `<p class="text-[11px] text-[--info] font-semibold">Operaciones: ${isUSD ? formatUSD(salesTotal) : formatBS(salesTotal)}</p>`;
      } else if (salesTotal < 0) {
        movementLabel = `<p class="text-[11px] text-[--danger] font-semibold">Vuelto/cambio: ${isUSD ? formatUSD(Math.abs(salesTotal)) : formatBS(Math.abs(salesTotal))}</p>`;
      }

      breakdownHTML += `
        <div class="bg-[--bg-card] border border-[--border] rounded-lg p-3 flex flex-col justify-between h-full shadow-sm">
          <div>
            <p class="text-[10px] text-[--fg-muted] uppercase tracking-wider font-bold mb-2">${name}</p>
            ${openingBal > 0 ? `<p class="text-[11px] text-[--purple] font-semibold mb-0.5">Apertura: ${isUSD ? formatUSD(openingBal) : formatBS(openingBal)}</p>` : ''}
            ${movementLabel}
          </div>
          <p class="font-mono text-lg font-bold ${colorClass} mt-2">
            ${isUSD ? formatUSD(totalInCashier) : formatBS(totalInCashier)}
          </p>
          <p class="text-[9px] text-[--fg-muted] text-right">Total en Caja</p>
        </div>
      `;
    });

    // ====== NUEVO: BLOQUE DE TOTALES DE VENTAS (sin apertura) ======
    if (breakdownHTML !== '') {
      breakdownHTML += `
        <div class="col-span-full bg-[--bg-tertiary] border-2 border-[--accent]/30 rounded-xl p-4 mt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-[--accent]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <h4 class="font-bold text-sm uppercase tracking-wider text-[--fg-primary]">Totales de Ventas</h4>
          </div>
          <div class="flex flex-col sm:flex-row gap-3 sm:gap-6">
            <div class="text-right">
              <p class="text-[10px] text-[--fg-muted] uppercase tracking-wider">Moneda Local</p>
              <p class="font-mono text-lg font-bold text-[--fg-primary]">${formatBS(totalVentasLocal)}</p>
            </div>
            <div class="text-right">
              <p class="text-[10px] text-[--fg-muted] uppercase tracking-wider">Divisa (USD)</p>
              <p class="font-mono text-lg font-bold text-[--accent]">${formatUSD(totalVentasUSD)}</p>
            </div>
          </div>
        </div>
      `;
    } else {
      breakdownHTML = '<p class="text-xs text-[--fg-muted] col-span-full text-center py-4">Sin movimientos ni apertura en este periodo</p>';
    }
    // =============================================================

    breakdownContainer.innerHTML = breakdownHTML;
  }

  // --- LISTA DE VENTAS DETALLADA ---
  const allTodaySales = salesHistory.filter(s => {
    const saleDate = new Date(s.date);
    if (lastCloseTime) return saleDate >= new Date(lastCloseTime);
    const today = new Date().toDateString();
    return saleDate.toDateString() === today;
  });

  if (allTodaySales.length === 0) {
    container.innerHTML = `<div class="text-center text-[--fg-muted] py-10"><p class="text-sm">No hay operaciones en este periodo</p></div>`;
    return;
  }

  container.innerHTML = allTodaySales.slice().reverse().map(sale => {
    // Calcular NETO por método para el historial individual
    const netPayments = {};
    if (sale.payments) {
      for (const [method, amount] of Object.entries(sale.payments)) {
        let targetMethod = method;
        if (method.endsWith('_change')) targetMethod = method.replace('_change', '');
        if (!netPayments[targetMethod]) netPayments[targetMethod] = 0;
        netPayments[targetMethod] += amount;
      }
    }

    let paymentBadges = '';
    Object.entries(netPayments).forEach(([method, amount]) => {
      if (Math.abs(amount) < 0.01) return;

      const isUSD = method.includes('usd') || (paymentMethods.find(m => m.id === method)?.type === 'usd');
      const config = paymentMethods.find(m => m.id === method);
      let name = config ? config.name : (method === 'efectivo_usd' ? 'Efectivo USD' : method);

      let displayStr = '';
      let badgeClass = 'badge-category';

      if (amount < 0) {
        badgeClass = 'badge-voided'; // Rojo para restas
        if (isUSD) {
          displayStr = formatUSD(amount);
        } else {
          const num = Math.abs(amount).toFixed(2);
          displayStr = `- ${currencyLabel} ${num}`;
        }
      } else {
        if (config && config.color) {
          badgeClass = `payment-badge-${config.color}`;
        }
        if (isUSD) {
          displayStr = formatUSD(amount);
        } else {
          displayStr = formatBS(amount);
        }
      }
      paymentBadges += `<span class="badge ${badgeClass}">${name}: ${displayStr}</span>`;
    });

    return `
        <div class="sale-card p-4 ${sale.voided ? 'voided' : ''}">
          <div class="flex justify-between items-start mb-3">
            <div>
              <div class="flex items-center gap-2">
                <p class="text-xs text-[--fg-muted]">${new Date(sale.date).toLocaleString('es-VE')}</p>
                ${sale.voided ? `<span class="badge badge-voided">${sale.edited ? 'EDITADA' : 'ANULADA'}</span>` : ''}
              </div>
              <p class="text-xs text-[--fg-muted]">Tasa: ${(sale.exchangeRate || exchangeRate).toFixed(2)} Local/$</p>
            </div>
            <div class="text-right">
              <p class="font-mono text-lg ${sale.voided ? 'text-[--fg-muted] line-through' : 'text-[--accent]'} font-bold">${formatUSD(sale.total)}</p>
              <p class="font-mono text-xs text-[--fg-secondary]">${formatBS(sale.totalBS || toBS(sale.total))}</p>
            </div>
          </div>
          <div class="text-xs text-[--fg-muted] mb-3">
            ${sale.items && sale.items.length > 0 ? sale.items.map(i => `${i.name || 'Producto'} x${i.qty || 0}`).join(', ') : 'Sin items'}
          </div>
          <div class="pt-2 border-t border-[--border] flex justify-between items-end">
            <div>
              <p class="text-[10px] text-[--fg-muted] mb-2">Detalle del pago:</p>
              <div class="flex gap-2 flex-wrap">
                ${paymentBadges}
              </div>
            </div>
            <button onclick="generateDeliveryNotePDF(${sale.id})" class="btn btn-secondary px-3 py-1.5 text-xs">Ver Nota</button>
            ${!sale.voided ? `
              <button onclick="editSale(${sale.id})" class="btn btn-secondary px-3 py-1.5 text-xs">Editar</button>
              <button onclick="openVoidSaleModal(${sale.id})" class="btn btn-danger px-3 py-1.5 text-xs">Anular</button>
            ` : ''}
          </div>
        </div>
      `;
  }).join('');

  renderAdvancedStats();
  updateExpiringBanner();
}


// ========================================
// CLOSE DAY FUNCTIONALITY
// ========================================
function openCloseDayModal() {
  // 1. SELECCIONAMOS LOS ELEMENTOS DEL HTML AL PRINCIPIO
  const openDayTotalEl = document.getElementById('openDayTotal');
  const closeDayTotalEl = document.getElementById('closeDayTotal');
  const closeDayProfitEl = document.getElementById('closeDayProfit');
  const closeDayCountEl = document.getElementById('closeDayCount');
  const modal = document.getElementById('closeDayModal');

  // 2. CALCULAMOS LAS VENTAS DEL PERIODO

  periodSales = salesHistory.filter(s => {
    const saleDate = new Date(s.date);
    if (lastCloseTime) {
      return saleDate >= new Date(lastCloseTime) && !s.voided;
    }
    const today = new Date().toDateString();
    return saleDate.toDateString() === today && !s.voided;
  });

  periodTotal = periodSales.reduce((sum, s) => sum + (s.total || 0), 0);

  // 3. CALCULAMOS LA APERTURA DE CAJA (CON LA CONVERSIÓN CORREGIDA)
  if (openDayTotalEl) {
    let totalOpenUSD = (currentPeriod.openingBalance['efectivo_usd'] || 0);

    paymentMethods.forEach(m => {
      const amount = (currentPeriod.openingBalance[m.id] || 0);
      if (m.type === 'bs') {
        totalOpenUSD += (amount / exchangeRate);
      } else {
        totalOpenUSD += amount;
      }
    });

    openDayTotalEl.textContent = formatUSD(totalOpenUSD);
  }

  // 4. ACTUALIZAMOS LOS DEMÁS DATOS EN EL MODAL
  const periodProfit = periodSales.reduce((sum, s) => sum + (s.profit || 0), 0);

  if (closeDayTotalEl) closeDayTotalEl.textContent = formatUSD(periodTotal);
  if (closeDayProfitEl) closeDayProfitEl.textContent = formatUSD(periodProfit);
  if (closeDayCountEl) closeDayCountEl.textContent = periodSales.length;

  // 5. ABRIMOS EL MODAL
  if (modal) modal.classList.add('active');
}

function closeCloseDayModal() {
  const modal = document.getElementById('closeDayModal');
  if (modal) modal.classList.remove('active');
}

function confirmCloseDay() {
  lastCloseTime = new Date();
  localStorage.setItem('pos_last_close', lastCloseTime.toISOString());
  // --- NUEVO: Limpiar el fondo de caja para el próximo día ---
  // Reiniciamos el balance de apertura a cero
  currentPeriod.openingBalance = {};

  // --- GUARDAR EL CIERRE EN EL HISTORIAL ---
  const closeRecord = {
    id: Date.now(),
    date: new Date().toISOString(),
    total: periodTotal,
    salesCount: periodSales.length
  };
  closedDays.push(closeRecord);
  safeSetStorage('pos_closed_days', closedDays);
  safeSetStorage('pos_current_period', currentPeriod);
  // --------------------------------------------------------------
  closeCloseDayModal();
  renderSalesHistory();
  renderHistoryCycles();
  showToast('Cierre de caja realizado');
}

// Renderizar la lista de días (Cierres)
function renderHistoryCycles() {
  const container = document.getElementById('historyCyclesList');
  if (!container) return;

  // ==========================================
  // AGREGADO: Configuración de Scroll
  // ==========================================
  // Esto limita la altura y activa el scroll SOLO para la lista de reportes
  container.style.maxHeight = '65vh'; // Ocupa como máximo el 65% de la altura de la pantalla
  container.style.overflowY = 'auto';  // Activa la barra de desplazamiento vertical
  container.style.overflowX = 'hidden'; // Oculta scroll horizontal si existe
  container.style.paddingRight = '5px'; // Un pequeño margen a la derecha para que el texto no pegue al scroll
  // ==========================================

  if (closedDays.length === 0) {
    container.innerHTML = '<p class="text-sm text-[--fg-muted] col-span-full text-center py-10">No hay cierres registrados aún.</p>';
    return;
  }

  // Ordenar del más reciente al más viejo
  const sortedCycles = [...closedDays].reverse();

  container.innerHTML = sortedCycles.map((cycle) => {
    const dateObj = new Date(cycle.date);
    const dateStr = dateObj.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

    return `
      <div onclick="loadCycleDetail(${cycle.id})" 
           class="bg-[--bg-card] border border-[--border] rounded-xl p-4 cursor-pointer hover:border-[--accent] hover:shadow-lg transition-all group">
        <div class="flex justify-between items-start mb-2">
          <span class="text-xs text-[--fg-muted] font-mono">${timeStr}</span>
          <span class="badge badge-category">${cycle.salesCount} ops</span>
        </div>
        <div class="text-sm text-[--fg-secondary] mb-2 leading-tight">${dateStr}</div>
        <div class="text-xl font-mono font-bold text-[--accent]">${formatUSD(cycle.total)}</div>
      </div>
    `;
  }).join('');
}

// Función nueva para dibujar botones de categoría en el POS principal
function renderCategoryButtons() {
  const container = document.getElementById('categoryButtonsContainer');

  // 🛡️ Si el contenedor aún no existe en el DOM, reintentamos automáticamente
  // requestAnimationFrame es más preciso y seguro que setTimeout en Electron
  if (!container) {
    requestAnimationFrame(renderCategoryButtons);
    return;
  }

  const categories = getCategories();
  // Validación extra por si loadData() aún no corrió (raro pero seguro)
  if (!categories || categories.length === 0) {
    container.innerHTML = `<button onclick="selectCategory('Todos')" class="category-btn px-4 py-2 rounded-lg text-sm font-medium bg-[--accent] text-[--bg-primary] border border-[--accent]">Todos</button>`;
    return;
  }

  container.innerHTML = categories.map(cat => `
        <button onclick="selectCategory('${cat}')"
        class="category-btn px-4 py-2 rounded-lg text-sm font-medium transition-colors border
        ${activeCategory === cat
      ? 'bg-[--accent] text-[--bg-primary] border-[--accent]'
      : 'bg-[--bg-card] text-[--fg-secondary] border-[--border] hover:border-[--accent]'}">
        ${cat}
        </button>
    `).join('');
}

// Función para seleccionar categoría
function selectCategory(category) {
  activeCategory = category;
  renderCategoryButtons(); // Redibujar botones para actualizar el estilo activo
  renderProducts();        // Filtrar productos

  // Si estamos en móvil, asegurar que se vea la grilla
  const productsSection = document.getElementById('productsSection');
  if (productsSection) productsSection.classList.remove('hidden');
}

// Cargar el detalle de un día específico (SIMPLIFICADO - SOLO TOTALES)
function loadCycleDetail(cycleId) {
  const cycleIndex = closedDays.findIndex(c => c.id === cycleId);
  if (cycleIndex === -1) return;

  const cycle = closedDays[cycleIndex];

  // Definir fechas de inicio y fin de este periodo
  const startDate = (cycleIndex > 0) ? new Date(closedDays[cycleIndex - 1].date) : new Date(0);
  const endDate = new Date(cycle.date);

  // Mostrar título y contenedor
  const detailSection = document.getElementById('historyDayDetail');
  const titleEl = document.getElementById('historyDayTitle');
  const container = document.getElementById('historySalesList');

  if (detailSection) detailSection.classList.remove('hidden');
  if (titleEl) titleEl.textContent = `Resumen del cierre: ${endDate.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;

  if (!container) return;

  // Filtrar ventas NO anuladas ni editadas en el rango de fechas
  const daySales = salesHistory.filter(s => {
    const sDate = new Date(s.date);
    return sDate >= startDate && sDate <= endDate && !s.voided;
  });

  if (daySales.length === 0) {
    container.innerHTML = `
      <div class="text-center text-[--fg-muted] py-10">
        <svg class="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <p class="text-sm">No se encontraron operaciones válidas en este periodo.</p>
      </div>`;
    return;
  }

  // Calcular totales por moneda
  let totalUSD = 0;
  let totalLocal = 0;
  let totalOperaciones = daySales.length;
  let totalItems = 0;
  let totalGanancia = 0;

  daySales.forEach(sale => {
    totalUSD += (sale.total || 0);
    totalGanancia += (sale.profit || 0);

    // Sumar al total en local todos los pagos en BS
    if (sale.payments) {
      Object.entries(sale.payments).forEach(([method, amount]) => {
        if (method.endsWith('_change')) return;

        const methodConfig = paymentMethods.find(m => m.id === method);
        const isUSD = (method === 'efectivo_usd') || (methodConfig && methodConfig.type === 'usd');

        if (!isUSD) {
          totalLocal += amount;
        }
      });
    }

    // Contar items vendidos
    if (sale.items) {
      sale.items.forEach(item => {
        totalItems += (item.qty || 0);
      });
    }
  });

  const totalBS_fromUSD = toBS(totalUSD);
  const totalLocalMasBS = totalLocal + totalBS_fromUSD;

  // Dibujar resumen simplificado
  container.innerHTML = `
    <div class="bg-[--bg-card] border border-[--border] rounded-xl p-6 shadow-sm">

      <!-- Header con fecha y cantidad de operaciones -->
      <div class="flex justify-between items-start mb-6 pb-4 border-b border-[--border]">
        <div>
          <p class="text-xs text-[--fg-muted] uppercase tracking-wider mb-1">Fecha del cierre</p>
          <p class="text-sm font-bold text-[--fg-primary]">${endDate.toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p class="text-xs text-[--fg-muted] mt-1">Hora: ${endDate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-[--fg-muted] uppercase tracking-wider mb-1">Operaciones</p>
          <p class="text-2xl font-bold text-[--fg-primary]">${totalOperaciones}</p>
          <p class="text-[10px] text-[--fg-muted] mt-1">${totalItems} items vendidos</p>
        </div>
      </div>

      <!-- TOTALES -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <!-- TOTAL EN DIVISA -->
        <div class="bg-[--bg-tertiary] rounded-lg p-4 border border-[--accent]/20">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-5 h-5 text-[--accent]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-xs text-[--fg-muted] uppercase tracking-wider font-bold">Total en Divisa</p>
          </div>
          <p class="font-mono text-3xl font-bold text-[--accent]">${formatUSD(totalUSD)}</p>
          <p class="text-[10px] text-[--fg-muted] mt-1">Total de ventas en USD</p>
        </div>

        <!-- TOTAL EN MONEDA LOCAL -->
        <div class="bg-[--bg-tertiary] rounded-lg p-4 border border-[--purple]/20">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-5 h-5 text-[--purple]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <p class="text-xs text-[--fg-muted] uppercase tracking-wider font-bold">Total en Moneda Local</p>
          </div>
          <p class="font-mono text-3xl font-bold text-[--purple]">${formatBS(totalLocalMasBS)}</p>
          <p class="text-[10px] text-[--fg-muted] mt-1">Pagos locales + conversión de USD</p>
        </div>

      </div>

      <!-- GANANCIA ESTIMADA -->
      <div class="mt-4 bg-[--bg-tertiary] rounded-lg p-4 border border-[--border] flex justify-between items-center">
        <div class="flex items-center gap-2">
          <svg class="w-5 h-5 text-[--success]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <p class="text-sm text-[--fg-muted] uppercase tracking-wider font-bold">Ganancia Estimada</p>
        </div>
        <p class="font-mono text-xl font-bold text-[--success]">${formatUSD(totalGanancia)}</p>
      </div>

      <!-- Botón cerrar -->
      <div class="mt-6 flex justify-end">
        <button onclick="document.getElementById('historyDayDetail').classList.add('hidden')"
          class="btn btn-secondary px-4 py-2 text-sm">Cerrar detalle</button>
      </div>

    </div>
  `;
}

// ========================================
// VOID SALE FUNCTIONALITY
// ========================================
function openVoidSaleModal(saleId) {
  voidingSaleId = saleId;
  const sale = salesHistory.find(s => s.id === saleId);
  if (!sale) return;

  const voidPasswordInput = document.getElementById('voidPasswordInput');
  if (voidPasswordInput) voidPasswordInput.value = '';

  const voidSaleDetails = document.getElementById('voidSaleDetails');
  if (voidSaleDetails) {
    voidSaleDetails.innerHTML = `
          <div class="flex justify-between">
            <span class="text-[--fg-muted]">Total:</span>
            <span class="font-mono font-bold">${formatUSD(sale.total || 0)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[--fg-muted]">Productos:</span>
            <span>${sale.items ? sale.items.length : 0} item(s)</span>
          </div>
          <div class="flex justify-between">
            <span class="text-[--fg-muted]">Fecha:</span>
            <span class="text-xs">${new Date(sale.date).toLocaleString('es-VE')}</span>
          </div>
        `;
  }

  const modal = document.getElementById('voidSaleModal');
  if (modal) modal.classList.add('active');
}

function closeVoidSaleModal() {
  const modal = document.getElementById('voidSaleModal');
  if (modal) modal.classList.remove('active');
  voidingSaleId = null;
}

// ==========================================
// EDITAR VENTA (Reabrir en carrito)
// ==========================================

function editSale(saleId) {
  // Pedimos clave de admin (reutilizamos el sistema de seguridad)
  verifySecurityBeforeAction(() => {
    performEditSale(saleId);
  });
}

function performEditSale(saleId) {
  const sale = salesHistory.find(s => s.id === saleId);
  if (!sale) {
    showToast('Venta no encontrada', 'error');
    return;
  }

  // 1. Si el carrito actual tiene algo, preguntamos si quiere reemplazarlo
  if (cart.length > 0) {
    showConfirm(
      `Tienes ${cart.length} productos en el carrito actual.\nSi continúas, se reemplazarán por los productos de la venta que vas a editar.\n\n¿Deseas continuar?`,
      () => {
        proceedWithEdit(sale);
      }
    );
  } else {
    proceedWithEdit(sale);
  }
}

function proceedWithEdit(sale) {
  // 1. Devolver stock a los productos (igual que al anular)
  if (sale.items) {
    sale.items.forEach(item => {
      const product = productsData.find(p => p.id === item.id);
      if (product) {
        product.stock = (product.stock || 0) + (item.qty || 0);
      }
    });
    saveProducts();
  }

  // 2. Marcar la venta como editada (no cuenta en totales)
  sale.voided = true;
  sale.edited = true;
  sale.editedAt = new Date().toISOString();
  localStorage.setItem('pos_sales', JSON.stringify(salesHistory));

  // 3. Cargar los items en el carrito (copia profunda para evitar referencias)
  cart = JSON.parse(JSON.stringify(sale.items));
  saveCart();
  renderCart();

  // 4. Cerrar admin y volver al POS
  closeAdminPanel();

  // 5. Actualizar vistas
  renderSalesHistory();
  renderProductsTable();

  // 6. Mensaje informativo
  showToast(`Venta cargada en el carrito para editar. Total: ${formatUSD(sale.total)}`);
}

function confirmVoidSale() {
  const voidPasswordInput = document.getElementById('voidPasswordInput');
  const password = voidPasswordInput ? voidPasswordInput.value : '';

  if (password !== adminPassword) {
    showToast('Clave incorrecta', 'error');
    return;
  }

  const sale = salesHistory.find(s => s.id === voidingSaleId);
  if (!sale) return;

  if (sale.items) {
    sale.items.forEach(item => {
      const product = productsData.find(p => p.id === item.id);
      if (product) {
        product.stock = (product.stock || 0) + (item.qty || 0);
      }
    });
  }
  saveProducts();

  sale.voided = true;
  localStorage.setItem('pos_sales', JSON.stringify(salesHistory));

  closeVoidSaleModal();
  renderSalesHistory();
  renderProductsTable();
  renderProducts();
  showToast('Nota anulada - Stock devuelto');
}



function openProductModal(productId = null) {
  editingProductId = productId;
  const modal = document.getElementById('productModal');
  const title = document.getElementById('productModalTitle');
  const categorySelect = document.getElementById('productCategoryInput');

  // Referencias a los inputs
  const codeInput = document.getElementById('productCodeInput');
  const nameInput = document.getElementById('productNameInput');
  const priceInput = document.getElementById('productPriceInput');
  const costInput = document.getElementById('productCostInput');
  const stockInput = document.getElementById('productStockInput');
  const expiryInput = document.getElementById('productExpiryInput');

  // ============================================================
  // LIMPIAR BUSCADOR DE ADMIN AL ABRIR MODAL
  // ============================================================
  const adminSearchInput = document.getElementById('adminSearchInput');
  if (adminSearchInput) {
    adminSearchInput.value = '';
    adminSearchQuery = '';
    renderProductsTable();
  }

  // ❌ ELIMINÉ EL setTimeout() QUE FOCOABA SIEMPRE EN PRECIO AQUÍ ARRIBA

  if (!categorySelect) return;
  // Cargar categorías
  categorySelect.innerHTML = categoriesData.map(c => `<option value="${c}">${c}</option>`).join('');

  if (productId) {
    // --- MODO EDICIÓN ---
    const product = productsData.find(p => p.id === productId);
    if (product) {
      if (title) title.textContent = 'Editar Producto';
      if (codeInput) {
        codeInput.value = (product.codes && product.codes.length > 0)
          ? product.codes.join(', ')
          : (product.code || '');
      }
      if (nameInput) nameInput.value = product.name || '';
      if (priceInput) priceInput.value = product.price || '';
      if (costInput) costInput.value = product.cost || 0;
      if (stockInput) {
        // 1. Mostramos el stock actual en el texto nuevo
        const displayEl = document.getElementById('displayCurrentStock');
        if (displayEl) displayEl.textContent = product.stock || 0;

        // 2. Limpiamos el input de ajuste (ya no carga el stock absoluto aquí)
        stockInput.value = '';
      }
      if (categorySelect) categorySelect.value = product.category || categoriesData[0] || '';
      if (expiryInput) expiryInput.value = product.expiry || '';

      // Calcular margen actual
      const marginInput = document.getElementById('productMarginInput');
      if (marginInput) {
        const cost = parseFloat(product.cost) || 0;
        const price = parseFloat(product.price) || 0;
        if (cost > 0) {
          marginInput.value = ((price - cost) / cost * 100).toFixed(1);
        } else {
          marginInput.value = '';
        }
      }

      // ✅ EN EDICIÓN -> FOCO EN PRECIO
      setTimeout(() => { priceInput.focus(); }, 100);
    }
  } else {
    // --- MODO NUEVO PRODUCTO ---
    if (title) title.textContent = 'Nuevo Producto';
    if (codeInput) codeInput.value = '';
    if (nameInput) nameInput.value = '';
    if (priceInput) priceInput.value = '';
    if (costInput) costInput.value = '';

    const marginInput = document.getElementById('productMarginInput');
    if (marginInput) marginInput.value = '';

    if (stockInput) {
      stockInput.value = ''; // Limpiamos el input de ajuste

      // IMPORTANTE: Forzamos a 0 el texto visual para que no confunda
      const displayEl = document.getElementById('displayCurrentStock');
      if (displayEl) displayEl.textContent = '0';
    }
    if (expiryInput) expiryInput.value = '';
    if (categorySelect) categorySelect.value = categoriesData[0] || '';

    // ✅ EN NUEVO -> FOCO EN CÓDIGO
    setTimeout(() => { codeInput.focus(); }, 100);
  }

  if (modal) modal.classList.add('active');
}


function closeProductModal() {
  const modal = document.getElementById('productModal');
  if (modal) modal.classList.remove('active');
  editingProductId = null;
}

// ==========================================
// CÁLCULO AUTOMÁTICO (FÓRMULA MULTIPLICACIÓN)
// ==========================================

function calculatePriceFromMargin() {
  const costInput = document.getElementById('productCostInput');
  const marginInput = document.getElementById('productMarginInput');
  const priceInput = document.getElementById('productPriceInput');

  if (!costInput || !marginInput || !priceInput) return;

  const cost = parseFloat(costInput.value) || 0;
  const margin = parseFloat(marginInput.value) || 0;

  // FÓRMULA: Precio = Costo * (1 + Porcentaje / 100)
  // Ejemplo: 100 * (1 + 0.30) = 100 * 1.30 = 130
  const multiplier = 1 + (margin / 100);
  const finalPrice = cost * multiplier;

  priceInput.value = finalPrice.toFixed(2);
}

function requestEditAbsoluteStock() {
  if (!editingProductId) return; // Seguridad por si acaso

  // 1. Pedimos Clave de Admin (Reutilizando tu lógica de seguridad)
  verifySecurityBeforeAction(() => {

    // 2. Obtenemos el producto actual para mostrar el valor actual en el prompt
    const product = productsData.find(p => p.id === editingProductId);
    const currentVal = product ? (product.stock || 0) : 0;

    // 3. Pedimos el nuevo valor absoluto
    showInput("Nuevo Stock Total (Absoluto)", currentVal, (newValue) => {
      const newStock = parseInt(newValue);

      if (isNaN(newStock) || newStock < 0) {
        showToast('Valor de stock inválido', 'error');
        return;
      }

      // 4. Aplicar cambio directo
      if (product) {
        product.stock = newStock;
        saveProducts();

        // 5. Actualizar visualmente el modal sin cerrarlo (UX mejorada)
        const displayEl = document.getElementById('displayCurrentStock');
        if (displayEl) displayEl.textContent = newStock;

        // Limpiamos el input de ajuste para evitar confusión
        const stockInput = document.getElementById('productStockInput');
        if (stockInput) stockInput.value = '';

        // Actualizar tablas en el fondo
        renderProductsTable();
        updateExpiringBanner();

        showToast('Stock actualizado correctamente');
      }
    });
  });
}

function saveProduct() {
  // 1. SELECCIONAMOS LOS ELEMENTOS DEL HTML
  const codeInput = document.getElementById('productCodeInput');
  const nameInput = document.getElementById('productNameInput');
  const priceInput = document.getElementById('productPriceInput');
  const costInput = document.getElementById('productCostInput');
  const stockInput = document.getElementById('productStockInput');
  const categorySelect = document.getElementById('productCategoryInput');
  const expiryInput = document.getElementById('productExpiryInput'); // Asegúrate que este input exista en el HTML

  // 2. OBTENEMOS Y LIMPIAMOS LOS VALORES
  const codeValue = codeInput ? codeInput.value.trim() : '';
  const name = nameInput ? nameInput.value.trim() : '';
  const price = priceInput ? parseFloat(priceInput.value) : NaN;
  const cost = costInput ? parseFloat(costInput.value) || 0 : 0;
  const stock = stockInput ? parseInt(stockInput.value) : NaN; // Este valor es el AJUSTE (+/-)
  const category = categorySelect ? categorySelect.value : '';
  const expiry = expiryInput ? expiryInput.value.trim() : '';

  // 3. LÓGICA DE CÓDIGOS MÚLTIPLES
  // Si el usuario escribe "001, 002", lo convertimos en un array: ['001', '002']
  let codes = [];
  if (codeValue) {
    codes = codeValue.split(',').map(c => c.trim()).filter(c => c !== '');
  }

  // Validación: Debe haber al menos un código
  if (codes.length === 0) {
    showToast('Debes ingresar al menos un código', 'error');
    return;
  }

  // Validación: Campos obligatorios
  if (!name || isNaN(price)) {
    showToast('Completa todos los campos obligatorios', 'error');
    return;
  }

  // ======================================================
  // VALIDACIÓN: EVITAR CÓDIGOS DUPLICADOS (CASE INSENSITIVE)
  // ======================================================
  let codigoDuplicado = false;
  let nombreProductoConflicto = '';

  // Recorremos todos los productos existentes en la base de datos
  productsData.forEach(p => {
    // IMPORTANTE: Saltamos la comprobación si es el MISMO producto que estamos editando
    // (así puedes editar un producto sin que te diga que su propio código está duplicado)
    if (editingProductId && p.id === editingProductId) return;

    // Obtenemos los códigos del otro producto (manejamos compatibilidad con antiguos)
    const codigosExistentes = p.codes || [p.code];

    // Verificamos si hay coincidencia entre los nuevos códigos y los existentes
    // (Usamos toLowerCase para que "ROJO" y "rojo" se consideren iguales)
    const hayConflicto = codes.some(nuevoCodigo =>
      codigosExistentes.some(codigoViejo =>
        codigoViejo.toLowerCase() === nuevoCodigo.toLowerCase()
      )
    );

    if (hayConflicto) {
      codigoDuplicado = true;
      nombreProductoConflicto = p.name; // Guardamos el nombre para avisarte cuál es el conflicto
    }
  });

  // Si encontramos duplicado, mostramos la Tarjeta de Error y DETENEMOS el guardado
  if (codigoDuplicado) {
    showToast(`¡Error! El código ya existe en el producto "${nombreProductoConflicto}".`, 'error');
    return; // <--- ESTO HACE QUE NO SE GUARDE NADA Y SE SALGA DE LA FUNCIÓN
  }

  // 4. LOGICA DE GUARDADO (EDITAR O CREAR NUEVO)
  if (editingProductId) {
    // --- SI ESTAMOS EDITANDO ---
    const product = productsData.find(p => p.id === editingProductId);
    if (product) {
      product.code = codes[0];   // El primer código sigue siendo el "principal"
      product.codes = codes;     // Guardamos la lista completa
      product.name = name;
      product.price = price;
      product.cost = cost;

      // --- MODIFICADO: LÓGICA DE STOCK SUMA/RESTA ---
      // En modo edición, el input actúa como AJUSTE.
      // Si el input está vacío (NaN), el ajuste es 0.
      const stockAdjustment = isNaN(stock) ? 0 : stock;
      // Stock Actual + Ajuste (Si adjustment es -5, resta. Si es 5, suma).
      product.stock = (product.stock || 0) + stockAdjustment;
      // ---------------------------------------------

      product.category = category;
      product.expiry = expiry;   // Guardamos fecha vencimiento
    }
  } else {
    // --- SI ES UN PRODUCTO NUEVO ---
    const newId = productsData.length > 0 ? Math.max(...productsData.map(p => p.id)) + 1 : 1;

    productsData.unshift({
      id: newId,
      code: codes[0],     // Código principal (para compatibilidad visual)
      codes: codes,       // Lista de códigos (para el buscador)
      name: name,
      price: price,
      cost: cost,

      // --- MODIFICADO: En nuevo producto, el valor es el inicial ---
      stock: isNaN(stock) ? 0 : stock,
      // ---------------------------------------------------------

      category: category,
      expiry: expiry      // Guardamos fecha vencimiento
    });
  }

  // 5. GUARDAR EN MEMORIA Y ACTUALIZAR PANTALLA
  saveProducts();
  updateExpiringBanner();
  renderProductsTable();
  renderSalesHistory();

  // IMPORTANTE: Actualizar el texto visual del stock en el modal antes de cerrar
  // para que si el usuario sigue editando, vea el nuevo total.
  const displayEl = document.getElementById('displayCurrentStock');
  if (displayEl && editingProductId) {
    const product = productsData.find(p => p.id === editingProductId);
    if (product) displayEl.textContent = product.stock;
  }

  closeProductModal();
  showToast('Producto guardado correctamente');
}

function editProduct(id) {
  openProductModal(id);
}

function deleteProduct(id) {
  // CHEQUEO DE SEGURIDAD
  if (requirePassToDeleteProduct) {
    // Pedimos clave pasando la función de borrado como "callback"
    verifySecurityBeforeAction(() => {
      // Lo que está aquí adentro SOLO se ejecuta si la clave es correcta
      performDeleteProduct(id);
    });
  } else {
    // Si no hay protección, hacemos el "showConfirm" normal de antes
    showConfirm("¿Eliminar este producto?", () => {
      performDeleteProduct(id);
    });
  }
}

// Separamos la lógica de borrado real en una función auxiliar para no repetir código
function performDeleteProduct(id) {
  productsData = productsData.filter(p => p.id !== id);
  saveProducts();
  updateExpiringBanner();
  renderProductsTable();
  renderProducts();
  renderSalesHistory();
  showToast('Producto eliminado');
}

function saveRateFromAdmin() {
  const adminRateInput = document.getElementById('adminRateInput');
  const newRate = adminRateInput ? parseFloat(adminRateInput.value) : NaN;

  if (newRate && newRate > 0) {
    exchangeRate = newRate;
    localStorage.setItem('pos_rate', exchangeRate.toString());
    updateRateDisplay();
    renderProducts();
    updateCartTotals();
    showToast('Tasa manual guardada');
  } else {
    showToast('Ingresa una tasa válida', 'error');
  }
}

// ==========================================
// TASA AUTOMÁTICA BCV
// ==========================================

function setRateMode(mode) {
  rateMode = mode;
  localStorage.setItem('pos_rate_mode', rateMode);

  // Actualizar visuales
  const btnAuto = document.getElementById('btnRateAuto');
  const btnManual = document.getElementById('btnRateManual');
  const manualContainer = document.getElementById('manualRateContainer');
  const autoContainer = document.getElementById('autoRateContainer');

  if (mode === 'auto') {
    btnAuto.classList.add('bg-[--accent]/10', 'border-[--accent]', 'text-[--accent]');
    btnManual.classList.remove('bg-[--accent]/10', 'border-[--accent]', 'text-[--accent]');
    btnManual.classList.add('border-[--border]', 'text-[--fg-secondary]');
    btnAuto.classList.remove('border-[--border]', 'text-[--fg-secondary]');

    manualContainer.classList.add('hidden');
    autoContainer.classList.remove('hidden');

    // Forzar consulta inmediata al cambiar a auto
    refreshBcvRate();

    // Iniciar intervalo de 1 hora
    startBcvInterval();
    showToast('Modo automático activado');
  } else {
    btnManual.classList.add('bg-[--accent]/10', 'border-[--accent]', 'text-[--accent]');
    btnAuto.classList.remove('bg-[--accent]/10', 'border-[--accent]', 'text-[--accent]');
    btnAuto.classList.add('border-[--border]', 'text-[--fg-secondary]');
    btnManual.classList.remove('border-[--border]', 'text-[--fg-secondary]');

    manualContainer.classList.remove('hidden');
    autoContainer.classList.add('hidden');

    // Detener intervalo automático
    stopBcvInterval();

    // Cargar valor actual en el input
    const adminRateInput = document.getElementById('adminRateInput');
    if (adminRateInput) adminRateInput.value = exchangeRate;

    showToast('Modo manual activado');
  }
}

async function refreshBcvRate() {
  const display = document.getElementById('autoRateDisplay');
  const lastUpdateEl = document.getElementById('autoRateLastUpdate');

  if (display) display.textContent = 'Actualizando...';

  try {
    const res = await fetch('https://dolar-venezuela-three.vercel.app/api/rates', {
      cache: 'no-store'
    });
    const data = await res.json();

    if (data.ok && data.rates && data.rates.BCV) {
      const tasa = data.rates.BCV.ves;
      const formattedRate = new Intl.NumberFormat('es-VE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(tasa);

      // Guardar en variables y localStorage
      exchangeRate = tasa;
      lastBcvUpdate = new Date();
      localStorage.setItem('pos_rate', exchangeRate.toString());
      localStorage.setItem('pos_rate_last_bcv_update', lastBcvUpdate.toISOString());
      localStorage.setItem('pos_rate_mode', 'auto');

      // Actualizar visuales
      if (display) display.textContent = formattedRate + ' ' + currencyLabel;
      if (lastUpdateEl) lastUpdateEl.textContent = lastBcvUpdate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });

      // Actualizar otras partes de la UI
      updateRateDisplay();
      renderProducts();
      updateCartTotals();

      showToast('Tasa BCV actualizada');
    } else {
      if (display) display.textContent = 'No disponible';
      showToast('No se pudo obtener la tasa', 'error');
    }
  } catch (e) {
    console.error('Error al cargar la tasa BCV:', e);
    if (display) display.textContent = 'Error de conexión';

    // Si hay error, usar la última tasa guardada
    const savedRate = localStorage.getItem('pos_rate');
    if (savedRate) {
      exchangeRate = parseFloat(savedRate);
      updateRateDisplay();
      showToast('Sin conexión. Usando última tasa guardada', 'error');
    } else {
      showToast('Sin conexión y sin tasa guardada. Revisa tu internet.', 'error');
    }
  }
}

function startBcvInterval() {
  // Limpiar intervalo anterior si existe
  stopBcvInterval();
  // Cada 1 hora = 60 * 60 * 1000 ms
  bcvInterval = setInterval(refreshBcvRate, 60 * 60 * 1000);
}

function stopBcvInterval() {
  if (bcvInterval) {
    clearInterval(bcvInterval);
    bcvInterval = null;
  }
}

function saveCurrencyLabel() {
  const input = document.getElementById('currencyLabelInput');
  if (input) {
    const newLabel = input.value.trim();
    if (newLabel) {
      currencyLabel = newLabel;
      localStorage.setItem('pos_currency_label', currencyLabel);

      // Actualizar vista inmediatamente
      updateCartTotals();
      renderProducts(); // Por si se muestra precio en BS
      renderSalesHistory(); // Por si muestra ventas en BS
      showToast('Símbolo de moneda actualizado');
    }
  }
}

function setTaxMode(mode) {
  taxMode = mode;
  localStorage.setItem('pos_tax_mode', mode);

  // Actualizar visualmente los botones
  const btnIncluded = document.getElementById('btnTaxIncluded');
  const btnAdded = document.getElementById('btnTaxAdded');

  if (mode === 'included') {
    btnIncluded.classList.add('bg-[--accent]/10', 'border-[--accent]');
    btnIncluded.querySelector('span').classList.replace('text-[--fg-secondary]', 'text-[--accent]');

    btnAdded.classList.remove('bg-[--accent]/10', 'border-[--accent]');
    btnAdded.querySelector('span').classList.replace('text-[--accent]', 'text-[--fg-secondary]');
  } else {
    btnAdded.classList.add('bg-[--accent]/10', 'border-[--accent]');
    btnAdded.querySelector('span').classList.replace('text-[--fg-secondary]', 'text-[--accent]');

    btnIncluded.classList.remove('bg-[--accent]/10', 'border-[--accent]');
    btnIncluded.querySelector('span').classList.replace('text-[--accent]', 'text-[--fg-secondary]');
  }

  // Recalcular totales en pantalla
  renderCart();
  showToast(`Modo IVA: ${mode === 'included' ? 'Incluido' : 'Sumado'}`);
}

// ========================================
// MOBILE CART TOGGLE
// ========================================
function toggleCart() {
  const sidebar = document.querySelector('.sidebar-cart');
  const arrow = document.getElementById('cartArrow');
  if (sidebar) {
    sidebar.classList.toggle('expanded');
    if (arrow) {
      arrow.style.transform = sidebar.classList.contains('expanded') ? 'rotate(180deg)' : '';
    }
  }
}

function deleteInvoice(index) {
  // Función centralizada para evitar duplicar lógica
  const performDelete = () => {

    // ============================================================
    // NUEVO: RESTAURAR STOCK (Nota cancelada)
    // ============================================================
    // Obtenemos la nota ANTES de borrarla del array
    const invoice = savedInvoices[index];

    if (invoice && invoice.items) {
      invoice.items.forEach(item => {
        const product = productsData.find(p => p.id === item.id);
        if (product) {
          // Devolvemos el stock porque la reserva se canceló
          product.stock = (product.stock || 0) + (item.qty || 0);
        }
      });
      saveProducts(); // Guardamos el inventario actualizado
    }
    // ============================================================

    // 1. Eliminar del array y guardar
    savedInvoices.splice(index, 1);
    safeSetStorage('pos_saved_invoices', savedInvoices);
    updateSavedInvoicesCount();

    // 2. Calcular el nuevo índice inteligente
    let nextIndex = index;
    if (savedInvoices.length === 0) {
      nextIndex = -1; // Lista vacía
    } else if (index >= savedInvoices.length) {
      nextIndex = savedInvoices.length - 1; // Si borraste el último, ir al nuevo último
    } else {
      nextIndex = index; // Mantener posición (el de abajo sube)
    }

    // 3. Redibujar la lista
    renderSavedInvoicesList();

    // 4. Restaurar foco y estado visual
    if (nextIndex >= 0) {
      setTimeout(() => {
        selectedSavedInvoiceIndex = nextIndex;
        selectSavedInvoice(nextIndex);
      }, 20);
    } else {
      selectedSavedInvoiceIndex = null;
      renderInvoicePreview(null);
    }

    showToast('Nota eliminada y stock devuelto');
  };

  // 5. Ejecutar con o sin protección según tu configuración
  if (requirePassToDeleteInvoice) {
    verifySecurityBeforeAction(performDelete);
  } else {
    showConfirm("¿Eliminar esta nota guardada? (El stock será devuelto)", performDelete);
  }
}

// ========================================
// KEYBOARD NAVIGATION
// ========================================
function getGridCols() {
  if (window.innerWidth >= 1536) return 5;
  if (window.innerWidth >= 1280) return 4;
  if (window.innerWidth >= 640) return 3;
  return 2;
}
// ==========================================
// UTILIDAD: FORZAR SCROLL PARA MOSTRAR ELEMENTO COMPLETO
// ==========================================
function ensureVisible(element, container) {
  if (!element || !container) return;

  const elRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  // Si el elemento está más abajo de lo visible (cortado por abajo)
  if (elRect.bottom > containerRect.bottom - 10) {
    container.scrollTop += (elRect.bottom - containerRect.bottom) + 15;
  }
  // Si el elemento está más arriba de lo visible (cortado por arriba)
  else if (elRect.top < containerRect.top + 10) {
    container.scrollTop -= (containerRect.top - elRect.top) + 15;
  }
}

function factoryResetFromButton() {
  showConfirm(
    "⚠️ ¡ALERTA DE RESET DE FÁBRICA! ⚠️\n\nEsto borrará TODOS los datos del sistema.\nAsegúrate de haber descargado el respaldo primero.\n\n¿Estás 100% seguro?",
    () => {
      localStorage.clear();
      sessionStorage.clear();

      document.cookie.split(";").forEach(function (c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });

      if ('caches' in window) {
        caches.keys().then(names => names.forEach(name => caches.delete(name)));
      }

      showToast('Sistema reiniciado. Recargando...', 'success');
      setTimeout(() => {
        location.reload();
      }, 1000);
    }
  );
}

document.addEventListener('keydown', (e) => {

  if (e.ctrlKey && e.code === 'KeyR') {
    e.preventDefault();

    if (isElectron) {
      window.electronAPI.factoryReset();
    } else {
      showConfirm(
        "⚠️ ¡ALERTA DE RESET DE FÁBRICA! ⚠️\n\nEsto borrará TODOS los datos:\n- Ventas realizadas\n- Productos creados\n- Configuración\n- Clave de acceso\n\n¿Estás 100% seguro?",
        () => {
          // Limpiar TODO el almacenamiento del navegador
          localStorage.clear();
          sessionStorage.clear();

          // Limpiar cookies (por si acaso)
          document.cookie.split(";").forEach(function (c) {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
          });

          // Limpiar cachés del navegador si existen
          if ('caches' in window) {
            caches.keys().then(names => names.forEach(name => caches.delete(name)));
          }

          showToast('Sistema reiniciado. Recargando...', 'success');
          setTimeout(() => {
            location.reload();
          }, 1000);
        }
      );
      return;
    }
  }

  const activeEl = document.activeElement;
  const isTyping = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT';
  const isSearchFocused = activeEl.id === 'searchInput';
  const isCartItemFocused = !!activeEl.closest('.cart-item');

  const productCard = activeEl.closest('.product-card');
  const isProductFocused = !!productCard;

  // Verificar qué modales están abiertos
  const checkoutModal = document.getElementById('checkoutModal');
  const openDayModal = document.getElementById('openDayModal');
  const productModal = document.getElementById('productModal');
  const adminAuthModal = document.getElementById('adminAuthModal');

  const isCheckoutOpen = checkoutModal && checkoutModal.classList.contains('active');
  const isOpenDayOpen = openDayModal && openDayModal.classList.contains('active');
  const isProductOpen = productModal && productModal.classList.contains('active');
  const isAdminAuthOpen = adminAuthModal && adminAuthModal.classList.contains('active');
  const isSavedInvoiceFocused = activeEl.classList.contains('saved-invoice-item');


  // ==========================================
  // FLECHAS EN FACTURAS GUARDADAS (F1)
  // ==========================================

  // CORRECCIÓN: Buscamos la clase 'saved-invoice-item' que es la que realmente tiene el HTML
  if (activeEl.classList.contains('saved-invoice-item')) {

    // FLECHA ABAJO
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Buscar al hermano siguiente en el DOM
      const next = activeEl.nextElementSibling;

      // Verificar que el hermano siguiente también sea un item de factura
      if (next && next.classList.contains('saved-invoice-item')) {
        next.focus(); // Mover el foco visual

        // IMPORTANTE: Llamar manualmente a la función de selección para actualizar la vista previa
        const index = parseInt(next.dataset.index);
        selectSavedInvoice(index);
      }
      return;
    }

    // FLECHA ARRIBA
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      // Buscar al hermano anterior
      const prev = activeEl.previousElementSibling;

      if (prev && prev.classList.contains('saved-invoice-item')) {
        prev.focus(); // Mover el foco visual

        // IMPORTANTE: Llamar manualmente a la función de selección para actualizar la vista previa
        const index = parseInt(prev.dataset.index);
        selectSavedInvoice(index);
      } else {
        // Si estamos en el primero, podemos (opcionalmente) devolver el foco al buscador o hacer nada
        // activeEl.blur(); 
      }
      return;
    }

    // TECLA DELETE / SUPR: Eliminar la nota
    if (e.key === 'Delete') {
      e.preventDefault();
      // Llamamos a eliminar usando el índice global seleccionado
      deleteInvoice(selectedSavedInvoiceIndex);
      return;
    }
  }

  // ==========================================
  // 0. PRIORIDAD CALCULADORA (Va primero para evitar choques)
  // ==========================================
  const calcModal = document.getElementById('calculatorModal');
  const isCalcOpen = calcModal && calcModal.classList.contains('active');

  if (isCalcOpen) {
    // Si la calculadora está abierta, capturamos estas teclas:

    // Números y Punto
    if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
      calcAction(e.key);
      e.preventDefault(); // Evitar que escriba en otros inputs si los hubiera atrás
      return;
    }

    // Operadores
    if (['+', '-', '*', '/'].includes(e.key)) {
      calcAction(e.key);
      e.preventDefault();
      return;
    }

    // Enter es Igual
    if (e.key === 'Enter') {
      calcAction('=');
      e.preventDefault();
      return;
    }

    // Backspace o Delete es Borrar
    if (e.key === 'Backspace' || e.key === 'Delete') {
      calcAction('DEL');
      e.preventDefault();
      return;
    }

    // Escape ya lo maneja el bloque global de abajo, pero asegurar cierre:
    if (e.key === 'Escape') {
      closeCalculator();
      return;
    }

    // Cualquier otra tecla, prevenimos default para seguridad
    e.preventDefault();
    return;
  }



  // ==========================================
  // 1. TECLAS GLOBALES Y ESPECIALES
  // ==========================================

  // ESCAPE: Cerrar modales con Prioridad (Ya corregido antes)
  if (e.key === 'Escape') {
    // ============================================================
    // PRIORIDAD 1: Cerrar modal de confirmación (Borrar notas, etc)
    // ============================================================
    const confirmModal = document.getElementById('customConfirmModal');
    if (confirmModal && confirmModal.classList.contains('active')) {
      e.preventDefault();
      e.stopPropagation(); // IMPORTANTE: Evita que el evento "suba" y cierre el modal de F1
      closeConfirmModal();
      return;
    }

    // ============================================================
    // PRIORIDAD 2: Cerrar modales normales
    // ============================================================
    const openModal = document.querySelector('.modal-overlay.active');
    if (openModal) {
      const modalId = openModal.id;
      if (modalId === 'productModal') closeProductModal();
      else if (modalId === 'checkoutModal') closeCheckout();
      else if (modalId === 'savedInvoicesModal') closeSavedInvoices();
      else if (modalId === 'saveInvoiceModal') closeSaveInvoice();
      else if (modalId === 'adminAuthModal') closeAdminAuth();
      else if (modalId === 'closeDayModal') closeCloseDayModal();
      else if (modalId === 'voidSaleModal') closeVoidSaleModal();
      else if (modalId === 'openDayModal') closeOpenDayModal();
      else if (modalId === 'calculatorModal') closeCalculator();
      else if (modalId === 'customInputModal') closeInputModal();
      else if (modalId === 'clientsModal') closeClientsModal();
      else if (modalId === 'clientModal') closeClientModal();
      else if (modalId === 'donateModal') closeDonateModal();
      return;
    }

    // Si no hay modales, cerrar Admin si está abierto
    const adminView = document.getElementById('adminView');
    if (adminView && !adminView.classList.contains('hidden')) {
      closeAdminPanel();
    } else {
      // Cierre de seguridad por si acaso
      closeCheckout(); closeSavedInvoices(); closeSaveInvoice();
      closeProductModal(); closeAdminAuth(); closeCloseDayModal(); closeVoidSaleModal();
    }
    return;
  }

  // F7: Cobrar
  if (e.key === 'F7') {
    e.preventDefault();
    const checkoutBtn = document.getElementById('checkoutBtn');
    if (checkoutBtn && !checkoutBtn.disabled) openCheckout();
    return;
  }

  // F1: Abrir Facturas Guardadas
  if (e.key === 'F1') {
    e.preventDefault();
    openSavedInvoices();
    return;
  }

  // F2: Abrir Clientes
  if (e.key === 'F2') {
    e.preventDefault();
    openClientsModal();
    return;
  }

  // F12: Guardar Factura (Desde cualquier lado)
  if (e.key === 'F12') {
    e.preventDefault();
    // Solo permitir si estamos en venta o en admin, pero mejor global para rapidez
    openSaveInvoice();
    return;
  }

  // B: Buscador
  if ((e.key === 'b' || e.key === 'B') && !isTyping) {
    e.preventDefault();
    const searchInput = document.getElementById('searchInput');
    if (searchInput) { searchInput.focus(); searchInput.select(); }
    return;
  }

  // F3: Nuevo Producto (Funciona siempre, incluso escribiendo)
  if (e.key === 'F4') {
    e.preventDefault(); // Evita que abra la búsqueda del navegador
    const adminView = document.getElementById('adminView');
    const productsTab = document.getElementById('tabProducts');
    // Verificamos si estamos en Admin y en la pestaña productos
    if (adminView && !adminView.classList.contains('hidden') && productsTab && !productsTab.classList.contains('hidden')) {
      openProductModal();
      setTimeout(() => { const input = document.getElementById('productCodeInput'); if (input) input.focus(); }, 100);
    }
    return;
  }

  // CTRL + D: Abrir Admin Auth
  if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
    e.preventDefault();
    if (!isAdminAuthOpen) openAdminAuth();
    return;
  }

  // ==========================================
  // CTRL + Q: Salir / Reiniciar Sistema (Desde Input también)
  // ==========================================
  if (e.ctrlKey && (e.key === 'q' || e.key === 'Q')) {
    e.preventDefault(); // Importante: Evita que se escriba la letra 'q' en el input
    showConfirm("¿Deseas cerrar el programa?", () => {
      window.close();
    });
  }

  // ENTER: Confirmaciones y Envíos (Si NO estamos escribiendo en un input normal)
  if (e.key === 'Enter') {

    // A. Apertura de Caja (Permitir Enter aunque estés en el input)
    if (isOpenDayOpen) {
      e.preventDefault();
      confirmOpenDay();
      return;
    }

    // B. Producto (Permitir Enter aunque estés en el input)
    if (isProductOpen) {
      e.preventDefault();
      saveProduct();
      return;
    }

    // C. Cobro (Permitir Enter aunque estés en el input)
    if (isCheckoutOpen) {
      const confirmBtn = document.getElementById('confirmSaleBtn');
      if (confirmBtn && !confirmBtn.disabled) {
        e.preventDefault();
        confirmSale();
        return;
      }
    }

    // ... (parte anterior de Enter: OpenDay, Producto, Cobro) ...

    // ============================================================
    // 5. CARGAR NOTA GUARDADA (F1)
    // ============================================================
    // Usamos 'saved-invoice-item' porque es la clase que tiene el HTML
    if (activeEl.classList.contains('saved-invoice-item')) {
      e.preventDefault();

      // 1. Obtenemos el índice del elemento enfocado
      const index = parseInt(activeEl.dataset.index);

      if (!isNaN(index)) {
        // 2. Seleccionamos visualmente (esto pone el recuadro azul y actualiza la variable global)
        selectSavedInvoice(index);

        // 3. EJECUTAMOS LA CARGA DIRECTA AL CARRITO
        // Antes solo hacíamos click(), ahora llamamos a la función real.
        confirmLoadSelectedInvoice();
      }
      return;
    }
  }


  // CTRL + A: Limpiar Carrito (Sin confirmación)
  if (e.ctrlKey && (e.key === 'a' || e.key === 'A') && (!isTyping || isSearchFocused)) {
    e.preventDefault();
    const clearBtn = document.getElementById('clearCartBtn');
    if (clearBtn && !clearBtn.disabled) {
      clearCart(); // <--- EJECUCIÓN DIRECTA
      showToast('Carrito vaciado'); // <--- Aviso visual rápido
    }
    return;
  }


  // CTRL + C: Calculadora Inteligente
  if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
    // 1. Verificamos si el usuario ha seleccionado texto para copiar
    const selectedText = window.getSelection().toString();

    // 2. SI hay texto seleccionado, dejamos que el navegador haga "Copiar" normal
    if (selectedText.length > 0) {
      return;
    }

    // 3. SI NO hay texto seleccionado, abrimos la calculadora
    e.preventDefault(); // Evitamos el "Copiar" vacío
    openCalculator();
    return;
  }

  // ==========================================
  // 2. NAVEGACIÓN POR FLECHAS (Grid y Carrito)
  // ==========================================

  // NUEVA: Detectar si estamos en modo Lista y enfocado en una fila (tr)
  const currentRow = (viewMode === 'list') ? activeEl.closest('tbody tr') : null;
  const isProductListFocused = !!currentRow;

  // --- FLECHA ABAJO (DOWN) ---
  if (e.key === 'ArrowDown') {
    const searchInput = document.getElementById('searchInput');

    // A) Buscador -> Grid o Lista o Carrito
    if (isSearchFocused) {
      e.preventDefault();
      const productsSection = document.getElementById('productsSection');
      if (productsSection && !productsSection.classList.contains('hidden')) {
        if (viewMode === 'list') {
          const firstRow = document.querySelector('tbody tr');
          if (firstRow) firstRow.focus();
        } else {
          const firstCard = document.querySelector('.product-card');
          if (firstCard) firstCard.focus();
        }
      } else {
        const firstCartItem = document.querySelector('.cart-item');
        if (firstCartItem) firstCartItem.focus();
      }
    }
    // B) Navegación en Lista (Tu código actual)
    else if (isProductListFocused) {
      e.preventDefault();
      const nextRow = currentRow.nextElementSibling;
      if (nextRow) {
        nextRow.focus();
      }
    }

    // C) Navegación en Grid (AQUÍ ESTÁ LA CORRECCIÓN)
    else if (isProductFocused) {
      e.preventDefault();
      const cards = Array.from(document.querySelectorAll('.product-card'));
      const currentIndex = cards.indexOf(productCard);
      const cols = getGridCols();

      if (currentIndex === -1) return;

      let nextIndex = currentIndex + cols;

      // ============================================================
      // LÓGICA NUEVA: SALTAR A LA ÚLTIMA FILA SI NO HAY "DEBAJO"
      // ============================================================
      if (nextIndex >= cards.length) {

        // 1. Calculamos dónde empieza la última fila (ej: si hay 6 items y 4 cols, empieza en el índice 4)
        const lastRowStart = Math.floor((cards.length - 1) / cols) * cols;

        // 2. Intentamos mantener la columna relativa donde está el usuario
        // (Si estás en la columna 2, intentamos ir a la columna 2 de la fila de abajo)
        const relativeCol = currentIndex % cols;
        let targetInLastRow = lastRowStart + relativeCol;

        // 3. Si incluso en la última fila nos pasamos (porque la fila de abajo es muy corta),
        //    entonces vamos al último elemento existente (el extremo derecho)
        if (targetInLastRow >= cards.length) {
          nextIndex = cards.length - 1;
        } else {
          // 4. Si hay un producto en esa columna de la fila de abajo, vamos ahí
          nextIndex = targetInLastRow;
        }
      }
      // ============================================================

      if (nextIndex < cards.length) {
        cards[nextIndex].focus();
        const gridContainer = document.getElementById('productsGrid');
        ensureVisible(cards[nextIndex], gridContainer);
      }

    }
    // D) Carrito
    else if (isCartItemFocused) {
      e.preventDefault();
      const cartItems = Array.from(document.querySelectorAll('.cart-item'));
      const currentItem = activeEl.closest('.cart-item');
      const currentIndex = cartItems.indexOf(currentItem);
      if (currentIndex < cartItems.length - 1) cartItems[currentIndex + 1].focus();
    }
  }

  // ==========================================
  // NUEVO: NAVEGACIÓN CON FLECHAS EN PAGOS (COBRO)
  // ==========================================
  if (isCheckoutOpen) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const activeElement = document.activeElement;

      // Solo actuar si estamos parados en un input de pago (class="payment-input")
      if (activeElement.classList.contains('payment-input')) {
        e.preventDefault(); // IMPORTANTE: Evita que el modal haga scroll

        // 1. Obtener todos los inputs de pago en un array
        const allInputs = Array.from(document.querySelectorAll('.payment-input'));

        // 2. Saber en cuál estamos
        const currentIndex = allInputs.indexOf(activeElement);

        // 3. Calcular cuál es el siguiente
        let nextIndex;

        if (e.key === 'ArrowDown') {
          // Flecha Abajo: Siguiente. Si es el último, vuelve al primero (Loop)
          nextIndex = (currentIndex + 1) % allInputs.length;
        } else {
          // Flecha Arriba: Anterior. Si es el primero, va al último
          nextIndex = (currentIndex - 1 + allInputs.length) % allInputs.length;
        }

        // 4. Mover el foco y seleccionar todo el texto (para borrar y escribir rápido)
        allInputs[nextIndex].focus();
        allInputs[nextIndex].select();
      }
    }
  }

  // --- FLECHA ARRIBA (UP) ---
  if (e.key === 'ArrowUp') {
    const searchInput = document.getElementById('searchInput');

    // A) Buscador -> Grid o Lista o Carrito
    if (isSearchFocused) {
      e.preventDefault();
      const productsSection = document.getElementById('productsSection');
      if (productsSection && !productsSection.classList.contains('hidden')) {
        if (viewMode === 'list') {
          const firstRow = document.querySelector('tbody tr');
          if (firstRow) firstRow.focus();
        } else {
          const firstCard = document.querySelector('.product-card');
          if (firstCard) firstCard.focus();
        }
      } else {
        const firstCartItem = document.querySelector('.cart-item');
        if (firstCartItem) firstCartItem.focus();
      }
    }
    // B) Navegación en Lista (CORREGIDO)
    else if (isProductListFocused) {
      e.preventDefault();
      const prevRow = currentRow.previousElementSibling;
      if (prevRow) {
        prevRow.focus();
      } else {
        // Si estamos en la primera fila, volver al buscador
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    }
    // C) Productos Grid
    else if (isProductFocused) {
      e.preventDefault();
      const cards = Array.from(document.querySelectorAll('.product-card'));
      const currentIndex = cards.indexOf(productCard);
      const cols = getGridCols();

      if (currentIndex === -1) return;

      if (currentIndex < cols) {
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      } else if (currentIndex - cols >= 0) {
        cards[currentIndex - cols].focus();
        const gridContainer = document.getElementById('productsGrid');
        ensureVisible(cards[currentIndex - cols], gridContainer);
      }
    }
    // D) Carrito (CORREGIDO: Flecha arriba faltaba)
    else if (isCartItemFocused) {
      e.preventDefault();
      const cartItems = Array.from(document.querySelectorAll('.cart-item'));
      const currentItem = activeEl.closest('.cart-item');
      const currentIndex = cartItems.indexOf(currentItem);

      if (currentIndex > 0) {
        // Ir al item anterior
        cartItems[currentIndex - 1].focus();
      } else {
        // Si es el primer item, volver al buscador
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    }
  }

  // --- FLECHAS IZQUIERDA / DERECHA ---
  if (isProductFocused) {
    const cards = Array.from(document.querySelectorAll('.product-card'));
    const currentIndex = cards.indexOf(productCard);

    if (currentIndex === -1) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (currentIndex > 0) {
        cards[currentIndex - 1].focus();
        const gridContainer = document.getElementById('productsGrid');
        ensureVisible(cards[currentIndex - 1], gridContainer);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (currentIndex < cards.length - 1) {
        cards[currentIndex + 1].focus();
        const gridContainer = document.getElementById('productsGrid');
        ensureVisible(cards[currentIndex + 1], gridContainer);
      }
    }
  }

  // ==========================================
  // 3. ACCIONES ESPECÍFICAS CARRITO
  // ==========================================

  // F8: Editar Cantidad
  if (e.key === 'F8' && isCartItemFocused) {
    e.preventDefault();
    const id = parseInt(activeEl.dataset.id);
    promptQuantity(id);
    return;
  }

  // + / - : Cantidad
  if ((e.key === '+' || e.key === '=') && isCartItemFocused) {
    e.preventDefault();
    const id = parseInt(activeEl.dataset.id);
    updateQuantity(id, 1);
    return;
  }
  if (e.key === '-' && isCartItemFocused) {
    e.preventDefault();
    const id = parseInt(activeEl.dataset.id);
    updateQuantity(id, -1);
    return;
  }

  // SUPR / DEL : Eliminar Item
  if (e.key === 'Delete' && isCartItemFocused) {
    e.preventDefault();
    const id = parseInt(activeEl.dataset.id);
    confirmRemoveCartItem(id);
    return;
  } else if (e.key === 'Delete' && isSavedInvoiceFocused) {
    e.preventDefault();
    const index = parseInt(activeEl.dataset.index);
    if (!isNaN(index)) {
      // Opcional: Puedes poner una confirmación aquí si quieres
      // showConfirm("¿Eliminar esta factura guardada?", () => { deleteInvoice(index); });
      // O borrar directo como hace el botón:
      deleteInvoice(index);
    }
    return;
  }

  // ==========================================
  // ALT + L / ALT + D: Agregar ítem Varios (Fix de Valor)
  // ==========================================

});

// ========================================
// LOAD DATA
// ========================================
function loadData() {
  try {
    taxRate = parseFloat(localStorage.getItem('pos_tax_rate')) || 16;
    taxMode = localStorage.getItem('pos_tax_mode') || 'included';

    const storedPeriod = localStorage.getItem('pos_current_period');
    if (storedPeriod) {
      currentPeriod = JSON.parse(storedPeriod);
    }

    const storedClosedDays = localStorage.getItem('pos_closed_days');
    if (storedClosedDays) {
      closedDays = JSON.parse(storedClosedDays);
    }

    const storedStockSetting = localStorage.getItem('allow_negative_stock');
    if (storedStockSetting) {
      allowNegativeStock = (storedStockSetting === 'true');
    }

    // Cargar métodos de pago
    const storedMethods = localStorage.getItem('pos_payment_methods');
    if (storedMethods) {
      paymentMethods = JSON.parse(storedMethods);
      // MIGRACIÓN: Si los métodos antiguos no tienen la propiedad allowChange, se la ponemos en true
      paymentMethods.forEach(m => {
        if (m.allowChange === undefined) m.allowChange = true;
      });
      // Dentro de loadData()...
    } else {
      paymentMethods = [
        { id: 'biopago', name: 'Biopago', type: 'bs', icon: 'phone', color: 'purple' },
        { id: 'pagomovil', name: 'Pago Movil', type: 'bs', icon: 'mobile', color: 'blue' },
        { id: 'tarjeta', name: 'Tarjeta (Punto)', type: 'bs', icon: 'credit-card', color: 'orange' },
        // CAMBIO AQUÍ: Usamos currencyLabel en el nombre por defecto
        { id: 'efectivo_bs', name: `Efectivo ${currencyLabel}`, type: 'bs', icon: 'banknote', color: 'green' },
      ];
      savePaymentMethods();
    }

    // Dentro de loadData()
    const storedViewMode = localStorage.getItem('pos_view_mode');
    if (storedViewMode) {
      viewMode = storedViewMode; // Puede ser 'grid' o 'list'
    }

    // --- CARGAR SEGURIDAD ---
    requirePassToDeleteProduct = localStorage.getItem('pos_security_delete_product') === 'true';
    requirePassToClearCart = localStorage.getItem('pos_security_clear_cart') === 'true';
    requirePassToDeleteInvoice = localStorage.getItem('pos_security_delete_invoice') === 'true';
    requirePassToRemoveCartItem = localStorage.getItem('pos_security_remove_cart_item') === 'true';
    // ---------------------

    // Actualizar visuales de los toggles si estamos en settings
    // (Opcional, pero bueno para que se vean reflejados al entrar)
    setTimeout(() => {
      updateSecurityVisuals();
    }, 100);

    const storedProducts = localStorage.getItem('pos_products');
    productsData = storedProducts ? JSON.parse(storedProducts) : getDefaultProducts();

    exchangeRate = parseFloat(localStorage.getItem('pos_rate')) || 36.50;
    // Cargar modo de tasa (auto/manual)
    rateMode = localStorage.getItem('pos_rate_mode') || 'auto';
    const savedBcvUpdate = localStorage.getItem('pos_rate_last_bcv_update');
    if (savedBcvUpdate) {
      lastBcvUpdate = new Date(savedBcvUpdate);
    }

    // Aplicar visuales del modo guardado
    setTimeout(() => {
      setRateMode(rateMode);
    }, 100);
    adminPassword = localStorage.getItem('pos_admin_password') || '1234';

    const storedCart = localStorage.getItem('pos_cart');
    cart = storedCart ? JSON.parse(storedCart) : [];

    const storedSales = localStorage.getItem('pos_sales');
    salesHistory = storedSales ? JSON.parse(storedSales) : [];

    const storedInvoices = localStorage.getItem('pos_saved_invoices');
    savedInvoices = storedInvoices ? JSON.parse(storedInvoices) : [];

    // Cargar clientes
    const storedClients = localStorage.getItem('pos_clients');
    clientsData = storedClients ? JSON.parse(storedClients) : [];

    const storedCloseTime = localStorage.getItem('pos_last_close');
    lastCloseTime = storedCloseTime ? new Date(storedCloseTime) : null;

    // Cargar configuración de categorías exentas
    const storedExempt = localStorage.getItem('pos_tax_exempt');
    if (storedExempt) {
      taxExemptCategories = JSON.parse(storedExempt);
    }

    // En loadData(), después de cargar currentPeriod:
    if (!currentPeriod.openingBalance) {
      currentPeriod.openingBalance = {};
    }
    // Asegurar que todos los métodos de pago tengan entrada en openingBalance
    ['efectivo_usd', ...paymentMethods.map(m => m.id)].forEach(methodId => {
      if (currentPeriod.openingBalance[methodId] === undefined) {
        currentPeriod.openingBalance[methodId] = 0;
      }
    });
    localStorage.setItem('pos_current_period', JSON.stringify(currentPeriod));

    // Cargar categorías
    const storedCats = localStorage.getItem('pos_categories');
    if (storedCats) {
      categoriesData = JSON.parse(storedCats);
    } else {
      // Si no existe, crear una inicial por defecto
      categoriesData = ['Bebidas', 'Comida', 'Postres'];
      saveCategories();
    }
  } catch (e) {
    console.error('Error loading data:', e);
    productsData = getDefaultProducts();
    categoriesData = ['General', 'Otros', 'Servicios'];
  }
}

function updateSecurityVisuals() {
  const updateToggle = (id, circleId, isActive) => {
    const btn = document.getElementById(id);
    const circle = document.getElementById(circleId);
    if (!btn || !circle) return;

    if (isActive) {
      btn.classList.add('bg-[--accent]'); btn.classList.remove('bg-gray-600');
      circle.classList.add('translate-x-5'); circle.classList.remove('translate-x-0');
    } else {
      btn.classList.remove('bg-[--accent]'); btn.classList.add('bg-gray-600');
      circle.classList.remove('translate-x-5'); circle.classList.add('translate-x-0');
    }
  };

  updateToggle('togglePassProduct', 'circlePassProduct', requirePassToDeleteProduct);
  updateToggle('togglePassCart', 'circlePassCart', requirePassToClearCart);
  updateToggle('togglePassInvoice', 'circlePassInvoice', requirePassToDeleteInvoice);
  updateToggle('togglePassCartItem', 'circlePassCartItem', requirePassToRemoveCartItem);
}

function toggleStockControl() {
  allowNegativeStock = !allowNegativeStock;
  localStorage.setItem('allow_negative_stock', allowNegativeStock);

  // Actualizar visualmente el botón
  const btn = document.getElementById('btnStockControl');
  const circle = document.getElementById('btnStockCircle');

  if (allowNegativeStock) {
    btn.classList.add('bg-[--accent]');
    btn.classList.remove('bg-gray-600');
    circle.classList.add('translate-x-5');
    circle.classList.remove('translate-x-0');
    showToast('Ventas sin stock: HABILITADO');
  } else {
    btn.classList.remove('bg-[--accent]');
    btn.classList.add('bg-gray-600');
    circle.classList.remove('translate-x-5');
    circle.classList.add('translate-x-0');
    showToast('Ventas sin stock: DESHABILITADO');
  }
}

function savePaymentMethods() {
  safeSetStorage('pos_payment_methods', paymentMethods);
  renderPaymentMethodsList();
}

function renderPaymentMethodsList() {
  const container = document.getElementById('paymentMethodsList');
  if (!container) return;

  container.innerHTML = paymentMethods.map(method => {
    // Lógica para mostrar el nombre dinámico si es el método por defecto
    let displayName = method.name;
    if (method.name === 'Efectivo BS' || method.name === 'Efectivo Bs') {
      displayName = `Efectivo ${currencyLabel}`;
    }

    // Lógica para el Badge (Etiqueta) de moneda
    const displayType = method.type === 'bs' ? currencyLabel : 'USD';
    const typeBadgeColor = method.type === 'bs' ? 'badge-category' : 'badge-code';

    return `
    <div class="flex items-center justify-between p-2 rounded-lg border border-[--border] hover:bg-[--bg-tertiary] group">
      <div class="flex items-center gap-3">
        <!-- Botón de permitir vuelto (sin cambios) -->
        <button onclick="togglePaymentChange('${method.id}')" 
                class="w-7 h-7 rounded flex items-center justify-center transition-colors ${method.allowChange !== false ? 'bg-[--success]/15 text-[--success]' : 'bg-[--border] text-[--fg-muted]'}"
                title="${method.allowChange !== false ? 'Permite dar vuelto' : 'No da vuelto'}">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
          </svg>
        </button>
        
        <!-- CAMBIO AQUÍ: Mostramos displayType dinámico -->
        <span class="badge ${typeBadgeColor}">${displayType}</span>
        <span class="text-sm font-medium">${displayName}</span>
      </div>
      <button onclick="deletePaymentMethod('${method.id}')" class="p-1.5 rounded hover:bg-[--danger]/20 text-[--danger] opacity-0 group-hover:opacity-100 transition-opacity">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>
    </div>
  `}).join('');
}

function togglePaymentChange(id) {
  const method = paymentMethods.find(m => m.id === id);
  if (method) {
    // Si es undefined (antiguo) o true, lo ponemos en false. Si es false, lo ponemos en true.
    method.allowChange = (method.allowChange === false) ? true : false;
    savePaymentMethods();
    renderPaymentMethodsList(); // Redibujar para ver el cambio de color
    showToast(method.allowChange ? 'Vuelto habilitado' : 'Vuelto deshabilitado');
  }
}

function addPaymentMethod() {
  const nameInput = document.getElementById('newPaymentName');
  const typeInput = document.getElementById('newPaymentType');

  const name = nameInput.value.trim();
  const type = typeInput.value;

  if (!name) return;

  const newId = 'custom_' + Date.now();
  paymentMethods.push({
    id: newId,
    name: name,
    type: type, // 'bs' o 'usd'
    color: type === 'usd' ? 'accent' : 'secondary' // Color por defecto
  });

  savePaymentMethods();
  nameInput.value = '';
  showToast('Método de pago agregado');
}

function deletePaymentMethod(id) {
  showConfirm("¿Eliminar este método de pago?", () => {
    paymentMethods = paymentMethods.filter(m => m.id !== id);
    savePaymentMethods();
    showToast('Método eliminado');
  });
}

function saveTaxRate() {
  const input = document.getElementById('taxRateInput');
  if (!input) return;

  const newRate = parseFloat(input.value);

  if (isNaN(newRate) || newRate < 0) {
    showToast('Porcentaje inválido', 'error');
    return;
  }

  taxRate = newRate;
  localStorage.setItem('pos_tax_rate', taxRate);

  // Recalcular el carrito visualmente para que el usuario vea el cambio
  renderCart();
  showToast(`IVA actualizado al ${taxRate}%`);
  updateTaxLabel();
}



function saveCategories() {
  safeSetStorage('pos_categories', categoriesData);
  renderCategoriesListAdmin();
  renderCategoryButtons();
}

function getDefaultProducts() {
  return [
    { id: 1, name: "Producto Ejemplo 1", price: 1.00, cost: 0.50, category: "General", code: "001", stock: 10 },
    { id: 2, name: "Producto Ejemplo 2", price: 2.50, cost: 1.00, category: "General", code: "002", stock: 20 },
    { id: 3, name: "Servicio Basico", price: 5.00, cost: 0.00, category: "Servicios", code: "003", stock: 999 },
    { id: 4, name: "Combo Promo", price: 10.00, cost: 6.00, category: "Combos", code: "004", stock: 5 },
    { id: 5, name: "Articulo Especial", price: 15.50, cost: 8.00, category: "General", code: "005", stock: 8 }
  ];
}

// ========================================
// OPEN DAY FUNCTIONALITY
// ========================================

function openOpenDayModal() {
  const container = document.getElementById('openDayInputs');
  if (!container) return;

  let html = '';

  // 1. Input para USD
  const currentUSD = currentPeriod.openingBalance['efectivo_usd'] || 0;
  html += `
    <div class="flex items-center justify-between p-2 border border-[--border] rounded-lg">
      <span class="text-sm font-medium">Efectivo USD</span>
      <input type="number" id="open_usd" class="input-field w-32 px-3 py-2 text-right font-mono text-sm" 
             value="${currentUSD > 0 ? currentUSD : ''}" placeholder="0.00">
    </div>
  `;

  // 2. Inputs para Métodos
  paymentMethods.forEach(method => {
    const currentVal = currentPeriod.openingBalance[method.id] || 0;
    html += `
      <div class="flex items-center justify-between p-2 border border-[--border] rounded-lg">
        <span class="text-sm font-medium">${method.name}</span>
        <input type="number" id="open_${method.id}" class="input-field w-32 px-3 py-2 text-right font-mono text-sm" 
               value="${currentVal > 0 ? currentVal : ''}" placeholder="0.00">
      </div>
    `;
  });

  container.innerHTML = html;

  const modal = document.getElementById('openDayModal');
  if (modal) modal.classList.add('active');

  // Foco automático
  setTimeout(() => {
    const firstInput = document.querySelector('#openDayInputs input');
    if (firstInput) firstInput.focus();
  }, 100);
}

function closeOpenDayModal() {
  const modal = document.getElementById('openDayModal');
  if (modal) modal.classList.remove('active');
}

function confirmOpenDay() {
  // Guardar USD
  const usdInput = document.getElementById('open_usd');
  currentPeriod.openingBalance['efectivo_usd'] = usdInput ? parseFloat(usdInput.value) || 0 : 0;

  // Guardar Métodos
  paymentMethods.forEach(method => {
    const input = document.getElementById(`open_${method.id}`);
    if (input) {
      currentPeriod.openingBalance[method.id] = parseFloat(input.value) || 0;
    }
  });

  // Actualizar fecha de apertura (si es la primera vez del día o si queremos forzar re-apertura)
  // Si ya hay una apertura hoy, solo actualizamos los montos, si no, ponemos fecha nueva.
  const todayStr = new Date().toDateString();
  if (!currentPeriod.openTime || new Date(currentPeriod.openTime).toDateString() !== todayStr) {
    currentPeriod.openTime = new Date().toISOString();
  }

  safeSetStorage('pos_current_period', currentPeriod);
  closeOpenDayModal();
  showToast('Apertura de caja registrada');
  renderSalesHistory(); // Actualizar visualización si es necesario
}

// ========================================
// CATEGORY MANAGER FUNCTIONS
// ========================================

function renderCategoriesListAdmin() {
  const container = document.getElementById('categoriesListAdmin');
  if (!container) return;

  if (categoriesData.length === 0) {
    container.innerHTML = '<p class="text-center text-[--fg-muted] text-sm py-2">No hay categorías creadas.</p>';
    return;
  }

  container.innerHTML = categoriesData.map(cat => {
    // Verificamos si esta categoría es exenta
    const isExempt = taxExemptCategories.includes(cat);

    return `
    <div class="flex items-center justify-between p-2 rounded-lg border border-[--border] hover:bg-[--bg-tertiary] group">
      <span class="text-sm font-medium pl-2 flex-1">${cat}</span>
      
      <div class="flex items-center gap-3">
        <!-- ETIQUETA IVA -->
        <span class="text-[10px] uppercase font-bold ${isExempt ? 'text-[--success]' : 'text-[--fg-muted]'}">
          ${isExempt ? 'EXENTO IVA' : 'GRAVADO'}
        </span>

        <!-- SWITCH TOGGLE -->
        <button onclick="toggleCategoryTax('${cat}')" 
                class="w-9 h-5 rounded-full relative transition-colors duration-200 focus:outline-none ${isExempt ? 'bg-[--success]' : 'bg-[--border]'}">
          <span class="absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${isExempt ? 'translate-x-4' : 'translate-x-0'}"></span>
        </button>

        <!-- BOTÓN BORRAR -->
        <button onclick="deleteCategory('${cat}')" class="p-1.5 rounded hover:bg-[--danger]/20 text-[--danger] opacity-0 group-hover:opacity-100 transition-opacity">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>
    </div>
  `}).join('');
}

// Función nueva para cambiar el estado
function toggleCategoryTax(categoryName) {
  if (taxExemptCategories.includes(categoryName)) {
    // Si ya está, la quitamos (pasa a gravado)
    taxExemptCategories = taxExemptCategories.filter(c => c !== categoryName);
  } else {
    // Si no está, la agregamos (pasa a exento)
    taxExemptCategories.push(categoryName);
  }

  // Guardar en localStorage para que no se pierda
  localStorage.setItem('pos_tax_exempt', JSON.stringify(taxExemptCategories));

  renderCategoriesListAdmin(); // Redibujar para ver el cambio
  renderCart(); // Recalcular totales del carrito actual por si cambia algo
}

function addCategory() {
  const input = document.getElementById('newCategoryInput');
  const name = input ? input.value.trim() : '';

  if (!name) return;
  if (categoriesData.includes(name)) {
    showToast('Esa categoría ya existe', 'error');
    return;
  }

  categoriesData.push(name);
  saveCategories();
  if (input) input.value = '';
  showToast('Categoría agregada');

  // --- NUEVO: Actualizar filtros y botones ---
  renderAdminCategoryFilter(); // Actualiza el select de Admin
  renderCategoryButtons();      // Actualiza los botones del POS principal
  renderProductsTable();        // Refrescar la tabla por si acaso
}

function renameCategory(oldName) {
  const newName = prompt('Nuevo nombre para la categoría:', oldName);
  if (!newName || newName.trim() === '' || newName === oldName) return;

  // Actualizar lista
  const index = categoriesData.indexOf(oldName);
  if (index !== -1) {
    categoriesData[index] = newName.trim();

    // ACTUALIZAR PRODUCTOS EXISTENTES CON ESTA CATEGORÍA
    let count = 0;
    productsData.forEach(p => {
      if (p.category === oldName) {
        p.category = newName.trim();
        count++;
      }
    });

    if (count > 0) saveProducts();
    saveCategories();
    showToast(`Categoría renombrada. ${count} productos actualizados.`);
  }

  renderAdminCategoryFilter()
}

function deleteCategory(name) {
  showConfirm(`¿Eliminar categoría "${name}"?\nLos productos con esta categoría quedarán como "Sin categoría".`, () => {
    categoriesData = categoriesData.filter(c => c !== name);

    // --- CORRECCIÓN: Limpiar también de la lista de exentos de IVA ---
    taxExemptCategories = taxExemptCategories.filter(c => c !== name);
    localStorage.setItem('pos_tax_exempt', JSON.stringify(taxExemptCategories));
    // ---------------------------------------------------------------------

    // Actualizar productos
    let count = 0;
    productsData.forEach(p => {
      if (p.category === name) {
        p.category = '';
        count++;
      }
    });

    if (count > 0) saveProducts();
    saveCategories();

    // --- NUEVO: Actualizar filtros y botones ---
    renderAdminCategoryFilter(); // Importante: Si borramos la seleccionada, esto vuelve a "Todas"
    renderCategoriesListAdmin();  // Refrescar la lista lateral
    renderCategoryButtons();      // Refrescar botones POS
    renderProductsTable();        // Refrescar tabla

    showToast('Categoría eliminada');
  });
}

// ========================================
// EVENT LISTENERS
// ========================================
function setupEventListeners() {
  // ==========================================
  // BUSCADOR PRINCIPAL (STRICT CODE MODE)
  // ==========================================
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {

    // A. Al escribir (Mostrar/Ocultar Grilla) -> Esto sigue igual para ayudar visualmente
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderProducts();

      const productsSection = document.getElementById('productsSection');
      if (productsSection) {
        if (searchQuery.trim().length > 0) {
          productsSection.classList.remove('hidden');
        } else {
          productsSection.classList.add('hidden');
        }
      }
    });

    // B. Al presionar ENTER -> Aquí está el cambio
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (!query) return;

        e.preventDefault();

        // NUEVA LÓGICA: Buscar coincidencia EXACTA en CÓDIGO
        const product = productsData.find(p => {
          // Soportar array de códigos o código único
          const productCodes = p.codes || [p.code];
          // Verificamos si ALGÚN código coincide exactamente (ignorando mayúsculas)
          return productCodes.some(c => c && c.toLowerCase() === query.toLowerCase());
        });

        if (product) {
          // 1. Agregar al carrito
          addToCart(product.id);

          // 2. Limpiar y Ocultar
          searchInput.value = '';
          searchQuery = '';
          const productsSection = document.getElementById('productsSection');
          if (productsSection) productsSection.classList.add('hidden');

          // 3. Refrescar
          renderProducts();
          searchInput.focus(); // Devolver foco para seguir scaneando
        } else {
          // Si no hay código exacto, error.
          showToast('Código de producto no encontrado', 'error');
          // Opcional: Podrías temblar el input aquí
        }
      }
    });
  }


  // ========================================
  // LISTENER DE SCROLL (VERSIÓN ESTADO PERMANENTE - CORREGIDO)
  // ========================================
  document.addEventListener('scroll', function () {
    const adminView = document.getElementById('adminView');

    // --- CORRECCIÓN AQUÍ ---
    // Debemos obtener el elemento que realmente hace scroll (adminContent), no el padre (adminView).
    // En tu HTML, <main id="adminContent" class="flex-1 overflow-y-auto ..."> es el que se mueve.
    const adminContent = document.getElementById('adminContent');
    // -----------------------

    // Detectamos posición de la ventana general
    const windowScroll = window.scrollY;

    // Detectamos posición del contenedor de Admin (AHORA usando el elemento correcto)
    const adminScroll = adminContent ? adminContent.scrollTop : 0;

    // LÓGICA DEL INTERRUPTOR:
    // Si CUALQUIERA de los dos scrolls es mayor a 5px, asumimos que el usuario bajó.
    if (windowScroll > 5 || adminScroll > 5) {
      isScrolledDown = true;
    }

    // IMPORTANTE: Solo apagamos la protección si estamos SEGUROS de estar arriba del todo en ambos lados.
    if (windowScroll === 0 && adminScroll === 0) {
      isScrolledDown = false;
    }

  }, true); // 'true' para capturar scroll en contenedores internos también

  // ==========================================
  // 2. BUSCADOR EN ADMIN (PRODUCTOS)
  // ==========================================
  const adminSearchInput = document.getElementById('adminSearchInput');
  if (adminSearchInput) {

    // --- TU CÓDIGO ACTUAL (Esto filtra en tiempo real) ---
    adminSearchInput.addEventListener('input', (e) => {
      adminSearchQuery = e.target.value;
      renderProductsTable();
    });

    // --- NUEVO: AL PRESIONAR ENTER (Edición rápida) ---
    adminSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const query = e.target.value.trim().toLowerCase();
        if (!query) return; // Si está vacío, no hacer nada

        // 1. Buscamos si existe un producto con ese código EXACTO (Principal o Secundario)
        const exactProduct = productsData.find(p => {

          // Truco: Si tiene array de códigos lo usamos, si no, creamos uno temporal solo con el principal
          const productCodes = p.codes || [p.code];

          // Verificamos si ALGÚN código coincide (ignorando mayúsculas)
          return productCodes.some(c => c && c.toLowerCase() === query);
        });

        // 2. Si encontramos una coincidencia exacta...
        if (exactProduct) {
          e.preventDefault(); // Evitamos que el Enter recargue
          e.stopPropagation();

          editProduct(exactProduct.id); // ¡Abrimos el modal de edición!

          // Limpiamos el buscador
          e.target.value = '';
          adminSearchQuery = '';

          // Refrescamos la tabla para que se vean todos los productos de nuevo
          renderProductsTable();
        }
        // 3. Si NO es exacto, no hacemos nada y el usuario ve la lista filtrada.
      }
    });
  }

  // ==========================================
  // 3. BOTONES PRINCIPALES
  // ==========================================
  const clearCartBtn = document.getElementById('clearCartBtn');
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
  if (checkoutBtn) checkoutBtn.addEventListener('click', openCheckout);

  // ==========================================
  // 4. PASSWORD ADMIN (ENTER)
  // ==========================================
  const adminPasswordInput = document.getElementById('adminPasswordInput');
  if (adminPasswordInput) {
    adminPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') verifyAdminPassword();
    });
  }

  // ==========================================
  // 5. CERRAR MODALES AL HACER CLICK FUERA
  // ==========================================
  const modals = ['checkoutModal', 'savedInvoicesModal', 'saveInvoiceModal', 'productModal', 'adminAuthModal', 'closeDayModal', 'voidSaleModal', 'clientsModal', 'clientModal', 'donateModal'];
  modals.forEach(id => {
    const modal = document.getElementById(id);
    if (modal) {

      // --- AGREGA ESTE IF AQUÍ ---
      if (id === 'productModal') return;
      // ----------------------------

      modal.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) {
          const closeFn = {
            'checkoutModal': closeCheckout,
            'savedInvoicesModal': closeSavedInvoices,
            'saveInvoiceModal': closeSaveInvoice,
            'productModal': closeProductModal,
            'adminAuthModal': closeAdminAuth,
            'closeDayModal': closeCloseDayModal,
            'voidSaleModal': closeVoidSaleModal,
            'clientsModal': closeClientsModal,
            'clientModal': closeClientModal,
            'donateModal': closeDonateModal
          }[id];
          if (closeFn) closeFn();
        }
      });
    }
  });

  // ==========================================
  // 6. TOGGLE CARRITO EN MOVIL (ENTER)
  // ==========================================
  const cartToggle = document.querySelector('.cart-toggle');
  if (cartToggle) {
    cartToggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleCart();
      }
    });
  }

  // ==========================================
  // LISTENER EXCLUSIVO PARA EL BUSCADOR
  // ==========================================
  searchInput.addEventListener('keydown', (e) => {
    // Usamos SHIFT para evitar conflictos con el Sistema Operativo
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();

      // Leemos el valor "en vivo"
      const rawValue = e.target.value.trim();
      const numberValue = parseFloat(rawValue);

      // Validación
      if (isNaN(numberValue) || numberValue <= 0) {
        showToast('Ingresa un monto numérico', 'error');
        return;
      }

      // Shift + D -> USD
      if (e.code === 'KeyD') {
        addMiscItem(numberValue, 'd');
        return;
      }

      // Shift + M -> Local (Puedes usar M, L, o la que quieras)
      if (e.code === 'KeyS') {
        addMiscItem(numberValue, 'l'); // Le pasamos 'l' para que sepa que es Local
        return;
      }
    }

    // ==========================================
    // NUEVO: ALT KEY PARA AGREGAR CON IVA (CMIC)
    // ==========================================
    if (e.altKey) {
      e.preventDefault();
      e.stopPropagation();

      const rawValue = e.target.value.trim();
      const numberValue = parseFloat(rawValue);

      if (isNaN(numberValue) || numberValue <= 0) {
        showToast('Ingresa un monto numérico', 'error');
        return;
      }

      // Alt + D -> CMIC-USD (Con IVA)
      if (e.code === 'KeyD') {
        addMiscItem(numberValue, 'd', 'CMIC');
        return;
      }

      // Alt + S -> CMIC-BS (Con IVA)
      if (e.code === 'KeyS') {
        addMiscItem(numberValue, 'l', 'CMIC');
        return;
      }
    }
  });

  // ---------------------------------------------------------
  // CÁLCULO DE PRECIO (VIGILAR AMBOS CAMPOS)
  // ---------------------------------------------------------
  const marginInput = document.getElementById('productMarginInput');
  const costInput = document.getElementById('productCostInput');

  // 1. Si cambias el porcentaje, recalcula
  if (marginInput) {
    marginInput.addEventListener('input', calculatePriceFromMargin);
  }

  // 2. NUEVO: Si cambias el Costo, TAMBIÉN recalcula
  // Así si ya tenías un 30% escrito y cambias el costo de 100 a 200, 
  // el precio de venta salta automáticamente a 260.
  if (costInput) {
    costInput.addEventListener('input', calculatePriceFromMargin);
  }

  // ==========================================
  // BUSCADOR DE CLIENTES
  // ==========================================
  const clientSearchInput = document.getElementById('clientSearchInput');
  if (clientSearchInput) {
    clientSearchInput.addEventListener('input', (e) => {
      handleClientSearch(e.target.value);
    });

    clientSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleClientSearchEnter(e.target.value);
      }
    });
  }

  // Enter en el formulario de cliente (guardar)
  const clientNameInputEl = document.getElementById('clientNameInput');
  if (clientNameInputEl) {
    ['clientNameInput', 'clientCedulaInput', 'clientPhoneInput', 'clientAddressInput'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            saveClient();
          }
        });
      }
    });
  }


}


function resetSalesCycleOnly() {
  // Usamos el Modal Bonito
  showConfirm("¿Iniciar nuevo ciclo de operaciones?\n\nEsto borrará el historial de ventas y los reportes de cierre, pero conservará tus productos.", () => {

    // Borrado Selectivo
    const keysToDelete = [
      'pos_sales',
      'pos_saved_invoices',
      'pos_current_period',
      'pos_cart',
      'pos_last_close',
      'pos_closed_days' // Borra los reportes antiguos
    ];

    keysToDelete.forEach(key => {
      localStorage.removeItem(key);
    });

    // ==========================================
    // CAMBIO AQUÍ: En lugar de alert(), usamos showToast
    // ==========================================

    // 1. Mostramos mensaje bonito y no bloqueante
    showToast('Sistema reiniciado. Recargando...', 'success');

    // 2. Esperamos 1 segundo (1000ms) para que el usuario vea el mensaje 
    // y el sistema se "respire" antes de recargar
    setTimeout(() => {
      location.reload();
    }, 1000);
    // ==========================================
  });
}

// ========================================
// INIT
// ========================================

function updateSystemStatus() {
  const count = salesHistory ? salesHistory.length : 0;
  const limit = 7000;
  // Usar Math.max para evitar negativos y Math.min para topear en 100
  const percentage = Math.max(0, Math.min((count / limit) * 100, 100));

  const countEl = document.getElementById('systemStatusCount');
  const barEl = document.getElementById('systemStatusBar');
  const textEl = document.getElementById('systemStatusText');

  if (!countEl || !barEl || !textEl) return;

  // Actualizar números
  countEl.textContent = count;
  barEl.style.width = percentage + '%';

  // Lógica de Colores y Textos (corregida)
  if (count >= limit) {
    // ROJO (Límite Alcanzado - 7000 o más)
    barEl.style.backgroundColor = 'var(--danger)';
    textEl.innerHTML = `<span style="color:var(--danger); font-weight:bold;">¡LÍMITE ALCANZADO! DEBES REINICIAR.</span>`;
  } else if (percentage >= 80) {
    // AMARILLO (Advertencia - 80% o más, es decir ~5600 ventas)
    barEl.style.backgroundColor = 'var(--warning)';
    textEl.innerHTML = `<span style="color:var(--warning); font-weight:bold;">ADVERTENCIA: Acercándote al límite.</span>`;
  } else {
    // VERDE (Normal - menos de 80%)
    barEl.style.backgroundColor = 'var(--accent)';
    // Redondear a 1 decimal si es menor a 1%, si no, entero
    const safePercent = percentage < 1 ? percentage.toFixed(2) : Math.floor(percentage);
    textEl.textContent = `Sistema en orden (${safePercent}%)`;
  }
}


function closeCheckout() {
  const modal = document.getElementById('checkoutModal');
  if (modal) modal.classList.remove('active');
  forceFocusToSearch(); // <--- AGREGAR
}


function closeSaveInvoice() {
  const modal = document.getElementById('saveInvoiceModal');
  if (modal) modal.classList.remove('active');
  forceFocusToSearch(); // <--- AGREGAR
}

// ========================================
// CALCULADORA FUNCTIONS
// ========================================
let calcExpression = "";

function openCalculator() {
  const modal = document.getElementById('calculatorModal');
  const display = document.getElementById('calcDisplay');

  // Reiniciar
  calcExpression = "";
  if (display) display.value = "0";

  if (modal) modal.classList.add('active');
}

function closeCalculator() {
  const modal = document.getElementById('calculatorModal');
  if (modal) modal.classList.remove('active');
}

function calcAction(val) {
  const display = document.getElementById('calcDisplay');
  if (!display) return;

  if (val === 'C') {
    calcExpression = "";
    display.value = "0";
  } else if (val === 'DEL') {
    calcExpression = calcExpression.toString().slice(0, -1);
    display.value = calcExpression || "0";
  } else if (val === '=') {
    try {
      if (!/^[0-9+\-*/.() ]+$/.test(calcExpression)) { display.value = "Error"; return; }
      // Calculamos el resultado crudo
      const rawResult = new Function('return ' + calcExpression)();

      // Validamos que sea un número real
      if (isNaN(rawResult) || !isFinite(rawResult)) {
        display.value = "Error";
        calcExpression = "";
      } else {
        // ==========================================
        // LÓGICA DE REDONDEO (4 Decimales)
        // ==========================================
        // 1. .toFixed(4) fuerza 4 decimales (ej: 0.333333 -> "0.3333")
        // 2. parseFloat() convierte de vuelta a número, eliminando ceros extra (ej: "10.0000" -> 10)
        const finalResult = parseFloat(rawResult.toFixed(4));

        display.value = finalResult;
        calcExpression = finalResult.toString();
        // ==========================================
      }
    } catch (e) {
      display.value = "Error";
      calcExpression = "";
    }
  } else {
    // Evitar múltiples operadores seguidos
    const lastChar = calcExpression.slice(-1);
    const isOperator = ['+', '-', '*', '/'].includes(val);

    if (isOperator && ['+', '-', '*', '/'].includes(lastChar)) {
      // Reemplazar el operador anterior si pulsan otro
      calcExpression = calcExpression.slice(0, -1) + val;
    } else {
      if (calcExpression === "0" && !isOperator && val !== ".") {
        calcExpression = val;
      } else {
        calcExpression += val;
      }
    }
    display.value = calcExpression;
  }
  display.scrollLeft = display.scrollWidth;
}

function copyCalcResult() {
  const display = document.getElementById('calcDisplay');
  if (display) {
    navigator.clipboard.writeText(display.value).then(() => {
      showToast('Resultado copiado: ' + display.value);
    }).catch(err => {
      showToast('Error al copiar', 'error');
    });
  }
}

// ==========================================
// RESPALDO Y RESTAURACIÓN COMPLETO DEL SISTEMA
// ==========================================

function exportFullSystemBackup() {
  // 1. Recolectamos TODA la data importante
  const fullBackup = {
    version: "2.0", // Versión del formato de backup
    date: new Date().toISOString(),
    data: {
      products: productsData,
      sales: salesHistory,
      invoices: savedInvoices,
      paymentMethods: paymentMethods,
      categories: categoriesData,
      clients: clientsData,
      settings: {
        exchangeRate: exchangeRate,
        taxRate: taxRate,
        taxMode: taxMode,
        currencyLabel: currencyLabel,
        // Nota: No guardamos la clave de admin por seguridad, se restablece a la default o se pide de nuevo
        adminPassword: null
      },
      exemptCategories: taxExemptCategories
    }
  };

  // 2. Convertimos a JSON
  const dataStr = JSON.stringify(fullBackup, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  // 3. Descargamos
  const a = document.createElement('a');
  a.href = url;
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  a.download = `RESPALDO_TOTAL_POS_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Respaldo total guardado en Descargas/Escritorio');
}


function importFullSystemBackup(inputElement) {
  const file = inputElement.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const jsonContent = e.target.result;
      const parsedData = JSON.parse(jsonContent);

      // Verificación básica: ¿Tiene la estructura correcta?
      if (!parsedData.data || !parsedData.data.products) {
        throw new Error("El archivo no parece ser un respaldo válido de este sistema.");
      }

      // Preguntamos confirmación porque esto borrará lo que hay ahora
      // (Usamos tu función showConfirm que ya tienes)
      showConfirm(
        `Se va a RESTAURAR el sistema completo.\nEsto reemplazará tus productos, ventas y configuración actuales.\n\n¿Estás seguro?`,
        () => {
          // --- RESTAURACIÓN ---
          const data = parsedData.data;

          // 1. Restaurar Productos
          if (data.products) {
            productsData = data.products;
            saveProducts();
          }

          // 2. Restaurar Ventas
          if (data.sales) {
            salesHistory = data.sales;
            localStorage.setItem('pos_sales', JSON.stringify(salesHistory));
          }

          // 3. Restaurar Facturas Guardadas
          if (data.invoices) {
            savedInvoices = data.invoices;
            localStorage.setItem('pos_saved_invoices', JSON.stringify(savedInvoices));
          }

          // 4. Restaurar Configuraciones
          if (data.settings) {
            if (data.settings.exchangeRate) {
              exchangeRate = data.settings.exchangeRate;
              localStorage.setItem('pos_rate', exchangeRate);
            }
            if (data.settings.taxRate) {
              taxRate = data.settings.taxRate;
              localStorage.setItem('pos_tax_rate', taxRate);
            }
            if (data.settings.currencyLabel) {
              currencyLabel = data.settings.currencyLabel;
              localStorage.setItem('pos_currency_label', currencyLabel);
            }
            // Puedes agregar más campos aquí...
          }

          // 5. Restaurar Métodos de Pago y Categorías
          if (data.paymentMethods) {
            paymentMethods = data.paymentMethods;
            savePaymentMethods();
          }
          if (data.categories) {
            categoriesData = data.categories;
            saveCategories();
          }
          // ====== FIX: Restaurar clientes correctamente ======
          if (data.clients) {
            clientsData = data.clients;
            saveClients();
          }
          // ==================================================
          if (data.exemptCategories) {
            taxExemptCategories = data.exemptCategories;
            localStorage.setItem('pos_tax_exempt', JSON.stringify(taxExemptCategories));
          }

          // Recargar interfaz
          location.reload();
        }
      );

    } catch (error) {
      console.error(error);
      showToast('Error al leer el archivo de respaldo.', 'error');
      inputElement.value = '';
    }
  };

  reader.readAsText(file);
}

function confirmArchiveAndClean(days = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  // 1. Separar lo viejo de lo nuevo
  const oldSales = salesHistory.filter(s => new Date(s.date) < cutoffDate);
  const newSales = salesHistory.filter(s => new Date(s.date) >= cutoffDate);
  const oldInvoices = savedInvoices.filter(inv => new Date(inv.date) < cutoffDate);
  const newInvoices = savedInvoices.filter(inv => new Date(inv.date) >= cutoffDate);
  const oldClosures = closedDays.filter(c => new Date(c.date) < cutoffDate);
  const newClosures = closedDays.filter(c => new Date(c.date) >= cutoffDate);

  if (oldSales.length === 0 && oldInvoices.length === 0 && oldClosures.length === 0) {
    showToast(`✅ Sistema al día. No hay registros de más de ${days} días.`, 'success');
    return;
  }

  // 2. Modal de confirmación
  showConfirm(
    `📦 Se realizarán 2 acciones automáticas:
        1️⃣ Descargarás un .json con ${oldSales.length} ventas, ${oldInvoices.length} notas y ${oldClosures.length} cierres antiguos.
        2️⃣ El sistema eliminará estos registros para liberar espacio y evitar errores.
        ¿Deseas continuar?`,
    () => {
      // 3. Crear y descargar el archivo histórico
      const archiveData = {
        type: "POS_HISTORICAL_ARCHIVE",
        generatedAt: new Date().toISOString(),
        thresholdDays: days,
        archivedSales: oldSales,
        archivedInvoices: oldInvoices,
        archivedClosures: oldClosures
      };
      const blob = new Blob([JSON.stringify(archiveData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HISTORICO_POS_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 4. Limpiar memoria y LocalStorage (manteniendo solo lo reciente)
      salesHistory = newSales;
      savedInvoices = newInvoices;
      closedDays = newClosures;

      try {
        // Si ya implementaste safeSetStorage, úsalo aquí. Si no, esto funciona:
        localStorage.setItem('pos_sales', JSON.stringify(salesHistory));
        localStorage.setItem('pos_saved_invoices', JSON.stringify(savedInvoices));
        localStorage.setItem('pos_closed_days', JSON.stringify(closedDays));
      } catch (e) { console.error("Error al guardar limpieza:", e); }

      // 5. Actualizar toda la UI
      renderSalesHistory();
      renderHistoryCycles();
      updateSavedInvoicesCount();
      if (typeof updateSystemStatus === 'function') updateSystemStatus();

      showToast(`✅ Archivo descargado. ${oldSales.length} registros antiguos eliminados del sistema.`, 'success');
    }
  );
}

// ==========================================
// RESPALDO DE RECUPERACIÓN (Sin ventas, sin clave)
// ==========================================

function showRecoveryBackupStep() {
  document.getElementById('recoveryStep1').classList.add('hidden');
  document.getElementById('recoveryStep2').classList.remove('hidden');
}

function downloadRecoveryBackup() {
  // Backup con productos y configuraciones, SIN ventas ni clave
  const backup = {
    version: "2.0-recovery",
    type: "POS_RECOVERY_BACKUP",
    date: new Date().toISOString(),
    data: {
      products: productsData,
      categories: categoriesData,
      paymentMethods: paymentMethods,
      clients: clientsData,
      exemptCategories: taxExemptCategories,
      settings: {
        exchangeRate: exchangeRate,
        taxRate: taxRate,
        taxMode: taxMode,
        currencyLabel: currencyLabel,
        allowNegativeStock: allowNegativeStock,
        viewMode: viewMode,
        securityQuestion: securityQuestion,
        securityAnswer: securityAnswer
        // NO incluimos adminPassword - deben crear una nueva
      }
    }
  };

  const dataStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `RESPALDO_RECUPERACION_POS_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Respaldo descargado. Ahora presiona Ctrl+R para resetear.');
}

function restoreRecoveryBackup(inputElement) {
  const file = inputElement.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const jsonContent = e.target.result;
      const parsed = JSON.parse(jsonContent);

      if (!parsed.data || !parsed.data.products) {
        throw new Error("El archivo no es un respaldo válido.");
      }

      showConfirm(
        `Se restaurarán ${parsed.data.products.length} productos y configuraciones.\nLa clave de admin se mantendrá en "1234" (la默认).\n\n¿Continuar?`,
        () => {
          const data = parsed.data;

          // Restaurar productos
          if (data.products) {
            productsData = data.products;
            saveProducts();
          }

          // Restaurar categorías
          if (data.categories) {
            categoriesData = data.categories;
            saveCategories();
          }

          // Restaurar métodos de pago
          if (data.paymentMethods) {
            paymentMethods = data.paymentMethods;
            savePaymentMethods();
          }

          // ====== FIX: Restaurar clientes correctamente ======
          if (data.clients) {
            clientsData = data.clients;
            saveClients();
          }
          // ==================================================

          // Restaurar exentas
          if (data.exemptCategories) {
            taxExemptCategories = data.exemptCategories;
            localStorage.setItem('pos_tax_exempt', JSON.stringify(taxExemptCategories));
          }

          // Restaurar configuraciones
          if (data.settings) {
            if (data.settings.exchangeRate) {
              exchangeRate = data.settings.exchangeRate;
              localStorage.setItem('pos_rate', exchangeRate);
            }
            if (data.settings.taxRate) {
              taxRate = data.settings.taxRate;
              localStorage.setItem('pos_tax_rate', taxRate);
            }
            if (data.settings.taxMode) {
              taxMode = data.settings.taxMode;
              localStorage.setItem('pos_tax_mode', taxMode);
            }
            if (data.settings.currencyLabel) {
              currencyLabel = data.settings.currencyLabel;
              localStorage.setItem('pos_currency_label', currencyLabel);
            }
            if (data.settings.allowNegativeStock !== undefined) {
              allowNegativeStock = data.settings.allowNegativeStock;
              localStorage.setItem('allow_negative_stock', allowNegativeStock);
            }
            if (data.settings.viewMode) {
              viewMode = data.settings.viewMode;
              localStorage.setItem('pos_view_mode', viewMode);
            }
            if (data.settings.securityQuestion) {
              securityQuestion = data.settings.securityQuestion;
              localStorage.setItem('pos_security_question', securityQuestion);
            }
            if (data.settings.securityAnswer) {
              securityAnswer = data.settings.securityAnswer;
              localStorage.setItem('pos_security_answer', securityAnswer);
            }
          }

          // Resetear clave admin a default
          adminPassword = '1234';
          localStorage.setItem('pos_admin_password', adminPassword);

          showToast('Respaldo restaurado. Clave temporal: 1234');
          closeRecoveryModal();

          setTimeout(() => {
            location.reload();
          }, 1500);
        }
      );

    } catch (error) {
      console.error(error);
      showToast('Error al leer el archivo: ' + error.message, 'error');
      inputElement.value = '';
    }
  };

  reader.readAsText(file);
}

// ==========================================
// MODAL DE DONACIÓN
// ==========================================

function openDonateModal() {
  const modal = document.getElementById('donateModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('active');
  }
}

// ==========================================
// UTILIDAD: COPIAR AL PORTAPAPELES
// ==========================================

function copyToClipboard(text, btnElement) {
  navigator.clipboard.writeText(text).then(() => {
    // Cambiar el icono temporalmente a un check
    if (btnElement) {
      const originalHTML = btnElement.innerHTML;
      btnElement.innerHTML = `
        <svg class="w-3 h-3 text-[--success]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/>
        </svg>
      `;
      setTimeout(() => {
        btnElement.innerHTML = originalHTML;
      }, 1500);
    }
    showToast('Copiado: ' + text);
  }).catch(err => {
    showToast('Error al copiar', 'error');
  });
}

function closeDonateModal() {
  const modal = document.getElementById('donateModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('active');
  }
}

function init() {

  // ==========================================
  // NUEVO: DESACTIVAR SUGERENCIAS DEL NAVEGADOR
  // ==========================================
  // Esto evita que salga el cuadrito con historial al hacer clic en el buscador
  const inputsToDisableHistory = ['searchInput', 'adminSearchInput'];
  inputsToDisableHistory.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('autocomplete', 'off');
  });

  loadData();
  updateRateDisplay();
  updateSavedInvoicesCount();
  renderProducts();
  renderCart();
  updateDateTime();
  setupEventListeners();
  setupDelegatedEvents();
  setInterval(updateDateTime, 1000);
  updateTaxLabel();
  renderHistoryCycles();
  renderCategoryButtons();
  initStockControlVisuals();
  updateExpiringBanner();
  setInterval(forceFocusToSearch, 500);
  updateViewModeVisuals();
  updateCurrentClientDisplay();

  // Permitir Enter para confirmar
  document.getElementById('customModalInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') executeInputAction();
  });

  const expiryInput = document.getElementById('productExpiryInput');
  if (expiryInput) {
    expiryInput.addEventListener('input', function (e) {
      let valor = e.target.value.replace(/\D/g, ''); // Borra todo lo que no sea número
      if (valor.length > 8) valor = valor.slice(0, 8); // Máximo 8 dígitos

      // Agregamos las barras automáticamente
      let formateado = '';
      for (let i = 0; i < valor.length; i++) {
        if (i === 2 || i === 4) formateado += '/';
        formateado += valor[i];
      }
      e.target.value = formateado;
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();
});


// ==========================================
// PDF: NOTA DE ENTREGA
// ==========================================

function generateDeliveryNotePDF(saleId) {
  try {
    // Verificar que jsPDF esté cargado
    if (typeof window.jspdf === 'undefined') {
      showToast('Librería PDF no cargada. Revisa los script tags.', 'error');
      return;
    }

    const sale = salesHistory.find(s => s.id === saleId);
    if (!sale) {
      showToast('Venta no encontrada', 'error');
      return;
    }

    // ====== OBTENER DATOS DEL CLIENTE ======
    let clientName = 'Cliente Genérico';
    let clientCedula = '000000000';
    let clientPhone = '';
    let clientAddress = '';

    if (sale.client) {
      clientName = sale.client.name || 'Cliente Genérico';
      clientCedula = sale.client.cedula || '000000000';
      clientPhone = sale.client.phone || '';
      clientAddress = sale.client.address || '';
    }

    // ====== CREAR DOCUMENTO PDF A4 ======
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    // ====== HEADER ======
    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text('NOTA DE ENTREGA', 105, 20, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`N° ${String(sale.noteNumber || sale.id).padStart(6, '0')}`, 105, 28, { align: 'center' });

    const fechaObj = new Date(sale.date);
    const fechaStr = fechaObj.toLocaleDateString('es-VE') + ' - ' +
      fechaObj.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
    doc.text(fechaStr, 105, 34, { align: 'center' });

    // ====== CLIENTE ======
    doc.setDrawColor(220);
    doc.line(15, 42, 195, 42);

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('DATOS DEL CLIENTE', 15, 50);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Nombre: ${clientName}`, 15, 57);
    doc.text(`Cédula: ${clientCedula}`, 15, 63);
    if (clientPhone) doc.text(`Teléfono: ${clientPhone}`, 15, 69);
    if (clientAddress) doc.text(`Dirección: ${clientAddress}`, 15, 75);

    // ====== TABLA DE PRODUCTOS ======
    const tableStartY = clientAddress ? 82 : (clientPhone ? 76 : 70);

    const tableData = sale.items.map(item => [
      String(item.qty || 0),
      item.name || 'Producto',
      formatUSD(item.price),
      formatUSD((item.price || 0) * (item.qty || 0))
    ]);

    doc.autoTable({
      head: [['Cant.', 'Descripción', 'Precio Unit.', 'Total']],
      body: tableData,
      startY: tableStartY,
      theme: 'grid',
      headStyles: { fillColor: [0, 0, 0], textColor: [255, 255, 255], fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 35, halign: 'right' }
      }
    });

    // ====== TOTALES ======
    let finalY = doc.lastAutoTable.finalY + 10;

    const printTotal = (label, value, isBold = false, isBig = false) => {
      doc.setFontSize(isBig ? 14 : 10);
      doc.setFont(undefined, isBold ? 'bold' : 'normal');
      doc.text(label, 130, finalY);
      doc.text(value, 195, finalY, { align: 'right' });
      finalY += isBig ? 8 : 6;
    };

    printTotal('Subtotal:', formatUSD(sale.subtotal));
    if (sale.tax > 0) printTotal('IVA:', formatUSD(sale.tax));
    printTotal('TOTAL:', formatUSD(sale.total), true, true);

    // ====== DETALLE DEL PAGO ======
    finalY += 5;
    doc.setDrawColor(220);
    doc.line(15, finalY, 195, finalY);
    finalY += 8;

    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('DETALLE DEL PAGO', 15, finalY);
    finalY += 7;

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');

    if (sale.payments) {
      // Helper local para mostrar montos SIN el prefijo "M.Local"
      const fmtBS = (amt) => (parseFloat(amt) || 0).toFixed(2);

      const methodNames = {
        'efectivo_usd': 'Efectivo USD',
        'biopago': 'Biopago',
        'pagomovil': 'Pago Móvil',
        'tarjeta': 'Tarjeta (Punto)',
        'efectivo_bs': 'Efectivo Local'
      };

      Object.entries(sale.payments).forEach(([method, amount]) => {
        if (Math.abs(amount) < 0.01) return;

        let methodName = methodNames[method] || method;
        let prefix = '';

        if (method.endsWith('_change')) {
          methodName = 'Cambio entregado';
          prefix = '-';
        }

        const isUSD = method.includes('usd');
        const amountStr = isUSD ? formatUSD(Math.abs(amount)) : fmtBS(Math.abs(amount));

        doc.text(`• ${methodName}:`, 15, finalY);
        doc.text(`${prefix}${amountStr}`, 195, finalY, { align: 'right' });
        finalY += 6;
      });
    }

    // ====== TASA DE CAMBIO ======
    finalY += 5;
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    doc.text(`Tasa de cambio aplicada: 1$ = ${(sale.exchangeRate || exchangeRate).toFixed(2)} ${currencyLabel}`, 15, finalY);

    // ====== MENSAJE SI ESTÁ ANULADA/EDITADA ======
    if (sale.voided) {
      finalY += 10;
      doc.setTextColor(220, 38, 38);
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.text(sale.edited ? '*** NOTA EDITADA ***' : '*** NOTA ANULADA ***', 105, finalY, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    }

    // ====== GUARDAR ARCHIVO ======
    const safeName = clientName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
    const fileName = `Nota_Entrega_${safeName}_N${String(sale.noteNumber || sale.id).padStart(6, '0')}.pdf`;

    // ====== DESCARGAR SIN ABRIR PESTAÑA NUEVA ======
    // Método 1: jsPDF nativo (más confiable)
    doc.save(fileName);

    return true;

  } catch (error) {
    console.error('Error generando PDF:', error);
    showToast('Error al generar PDF: ' + error.message, 'error');
    return false;
  }
}

// Cerrar al salir
window.addEventListener('beforeunload');