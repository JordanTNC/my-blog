// Sets up the Quill rich-text editor on the new/edit post page: custom
// toolbar, image uploads (posted to the server, not embedded as base64),
// drag-to-resize on images, and wiring the editor's HTML into the hidden
// form field before submit.

(function () {
  var editorEl = document.getElementById('editor');
  if (!editorEl || typeof Quill === 'undefined') return;

  var Font = Quill.import('formats/font');
  Font.whitelist = ['sans-serif', 'serif', 'monospace'];
  Quill.register(Font, true);

  // Links to one of your own articles (an address starting with "/post/")
  // should navigate normally, like any link on the site. Everything else --
  // outside websites, and file attachments like PDFs -- opens in a new tab,
  // so readers don't lose their place on the page they were reading.
  var Link = Quill.import('formats/link');
  class InternalAwareLink extends Link {
    static create(value) {
      var node = super.create(value);
      if (/^\/post\//.test(value)) {
        node.removeAttribute('target');
        node.removeAttribute('rel');
      }
      return node;
    }
  }
  Quill.register(InternalAwareLink, true);

  var quill = new Quill('#editor', {
    theme: 'snow',
    modules: {
      toolbar: '#editor-toolbar',
      imageResize: {
        modules: ['Resize', 'DisplaySize'],
      },
    },
    placeholder: 'Write your article...',
  });

  // Custom "insert image" behavior: upload the file to the server and
  // insert a normal <img src="..."> pointing at it, instead of Quill's
  // default of embedding a giant base64 string in the page.
  quill.getModule('toolbar').addHandler('image', function () {
    var input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = function () {
      var file = input.files[0];
      if (!file) return;

      var range = quill.getSelection(true);
      var formData = new FormData();
      formData.append('image', file);

      fetch('/admin/upload-image', { method: 'POST', body: formData })
        .then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) throw new Error(data.error || 'Upload failed');
            return data;
          });
        })
        .then(function (data) {
          quill.insertEmbed(range.index, 'image', data.url, 'user');
          quill.setSelection(range.index + 1);
        })
        .catch(function (err) {
          alert('Could not upload image: ' + err.message);
        });
    };
  });

  // "Attach PDF" button: uploads a PDF and inserts a clickable link (using
  // the file's own name as the link text) at the cursor. Clicking it in the
  // published post opens the PDF in a new tab, using the reader's normal
  // browser PDF viewer -- no extra software needed on your end or theirs.
  var attachBtn = document.getElementById('attach-pdf-btn');
  if (attachBtn) {
    attachBtn.addEventListener('click', function () {
      var input = document.createElement('input');
      input.setAttribute('type', 'file');
      input.setAttribute('accept', 'application/pdf');
      input.click();

      input.onchange = function () {
        var file = input.files[0];
        if (!file) return;

        var range = quill.getSelection(true);
        var formData = new FormData();
        formData.append('file', file);

        fetch('/admin/upload-file', { method: 'POST', body: formData })
          .then(function (res) {
            return res.json().then(function (data) {
              if (!res.ok) throw new Error(data.error || 'Upload failed');
              return data;
            });
          })
          .then(function (data) {
            var linkText = data.filename || 'View PDF';
            quill.insertText(range.index, linkText, { link: data.url }, 'user');
            quill.insertText(range.index + linkText.length, ' ', 'user');
            quill.setSelection(range.index + linkText.length + 1);
          })
          .catch(function (err) {
            alert('Could not upload PDF: ' + err.message);
          });
      };
    });
  }

  // Before the form submits, copy the editor's HTML into the hidden
  // textarea that actually gets sent to the server.
  var form = document.getElementById('post-form');
  var contentInput = document.getElementById('content-input');
  if (form && contentInput) {
    form.addEventListener('submit', function () {
      contentInput.value = quill.root.innerHTML;
    });
  }
})();
