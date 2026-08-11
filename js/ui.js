// ============================================================
// FindShow — utilidades de UI compartidas: toasts y modal de detalle
// Se cargan antes de app.js / demo.js. Exponen:
//   showToast(mensaje, tipo, duracionMs)   tipo: 'info' | 'success' | 'error'
//   openModal(htmlInterno)
//   closeModal()
// ============================================================

(function() {
  var toastContainer = null;

  function getToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  window.showToast = function(mensaje, tipo, duracionMs) {
    tipo = tipo || 'info';
    duracionMs = duracionMs || 3500;

    var container = getToastContainer();
    var toast = document.createElement('div');
    toast.className = 'toast ' + tipo;
    toast.innerHTML = '<span class="toast-msg"></span><button class="toast-close" aria-label="Cerrar">&times;</button>';
    toast.querySelector('.toast-msg').textContent = mensaje;

    var timer;
    function quitar() {
      toast.classList.add('leaving');
      setTimeout(function() { toast.remove(); }, 180);
    }

    toast.querySelector('.toast-close').addEventListener('click', quitar);
    toast.addEventListener('mouseenter', function() { clearTimeout(timer); });
    toast.addEventListener('mouseleave', function() { timer = setTimeout(quitar, 1200); });

    container.appendChild(toast);
    timer = setTimeout(quitar, duracionMs);
  };
})();

(function() {
  var overlay = null;

  function crearOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal-card">' +
        '<button class="modal-close" aria-label="Cerrar">&times;</button>' +
        '<div class="modal-content"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });
    overlay.querySelector('.modal-close').addEventListener('click', closeModal);
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  window.openModal = function(html) {
    if (!overlay) crearOverlay();
    overlay.querySelector('.modal-content').innerHTML = html;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { overlay.classList.add('open'); });
    });
  };

  window.closeModal = function() {
    if (!overlay) return;
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  };
})();
