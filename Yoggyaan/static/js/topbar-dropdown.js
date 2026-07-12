
(function () {
  function closeAll(except) {
    document.querySelectorAll('.topbar-dropdown.open').forEach(function (el) {
      if (el !== except) {
        el.classList.remove('open');
        var trigger = el.querySelector('[data-dropdown-trigger]');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var dropdowns = document.querySelectorAll('.topbar-dropdown');

    dropdowns.forEach(function (dropdown) {
      var trigger = dropdown.querySelector('[data-dropdown-trigger]');
      if (!trigger) return;

      trigger.addEventListener('click', function (e) {
        e.stopPropagation();
        var isOpen = dropdown.classList.contains('open');
        closeAll(isOpen ? null : dropdown);
        dropdown.classList.toggle('open', !isOpen);
        trigger.setAttribute('aria-expanded', String(!isOpen));
      });
    });

    document.addEventListener('click', function () {
      closeAll(null);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAll(null);
    });
  });
})();
