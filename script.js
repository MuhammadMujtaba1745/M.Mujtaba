/* ---------- Case study dialogs (append to the END of script.js) ---------- */
(function () {
  'use strict';

  Array.prototype.forEach.call(document.querySelectorAll('.cs-open'), function (btn) {
    btn.addEventListener('click', function () {
      var dialog = document.getElementById(btn.getAttribute('data-target'));
      if (dialog && dialog.showModal) dialog.showModal();
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('.cs-dialog'), function (dialog) {
    var close = dialog.querySelector('.cs-close');
    if (close) close.addEventListener('click', function () { dialog.close(); });
    // A click on the dark backdrop closes it
    dialog.addEventListener('click', function (e) {
      if (e.target === dialog) dialog.close();
    });
  });
})();
