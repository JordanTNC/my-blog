// Small shared admin behaviors: confirmation prompts on destructive
// buttons (delete post / delete category).
(function () {
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (form && form.dataset && form.dataset.confirm) {
      if (!window.confirm(form.dataset.confirm)) {
        e.preventDefault();
      }
    }
  });
})();
