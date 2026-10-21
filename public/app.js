
const modals = document.querySelectorAll('.modal');
const toast = document.getElementById('toast');

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 3500);
}

async function apiRequest(url, options = {}) {
  const response = await fetch(url, options);
  let data = {};

  try {
    data = await response.json();
  } catch (_) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || 'Có lỗi xảy ra. Cậu thử lại nhé.');
  }

  return data;
}

function postJSON(url, body, method = 'POST') {
  return apiRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function safeDate(value) {
  if (!value) return 'Vừa xong';

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Vừa xong'
    : date.toLocaleString('vi-VN');
}

function getCreatedAt(item) {
  return item.createdAt || item.created_at || item.created_at;
}

document.querySelectorAll('[data-open]').forEach(button => {
  button.addEventListener('click', () => {
    const modal = document.getElementById(button.dataset.open);
    if (modal) modal.classList.add('open');

    if (button.dataset.open === 'gardenModal') loadNotes();

    if (button.dataset.open === 'letterModal') {
      loadLetters();
      const opened = document.getElementById('openedLetter');
      if (opened) opened.hidden = true;
    }

    if (button.dataset.open === 'noticeModal') loadCustomMoods();

    if (button.dataset.open === 'historyModal') loadMoodHistory();
  });
});

document.querySelectorAll('.close').forEach(button => {
  button.addEventListener('click', () => {
    button.closest('.modal')?.classList.remove('open');
  });
});

modals.forEach(modal => {
  modal.addEventListener('click', event => {
    if (event.target === modal) modal.classList.remove('open');
  });
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    modals.forEach(modal => modal.classList.remove('open'));
  }
});

/* =========================
   CẢM XÚC CÓ SẴN
========================= */

const levelConfigs = {
  'bực mình': {
    input: 'angerLevel',
    label: 'angerLabel',
    levels: [
      'Hơi hơi bực',
      'Hơi khó chịu',
      'Bực khá nhiều',
      'Rất rất bực',
      'Sắp nổ tung'
    ]
  },
  'muốn ôm': {
    input: 'hugLevel',
    label: 'hugLabel',
    levels: [
      'Ôm nhẹ một cái',
      'Muốn ôm một chút',
      'Cần một cái ôm lâu',
      'Cần ôm ngay',
      'Ôm ngay đi mà'
    ]
  },
  'nhớ cậu': {
    input: 'missLevel',
    label: 'missLabel',
    levels: [
      'Nhớ một chút',
      'Hơi nhớ rồi',
      'Nhớ kha khá',
      'Nhớ nhiều lắm',
      'Nhớ cậu muốn xỉu'
    ]
  }
};

Object.values(levelConfigs).forEach(config => {
  const input = document.getElementById(config.input);
  const label = document.getElementById(config.label);

  if (!input || !label) return;

  const update = () => {
    label.textContent =
      config.levels[Number(input.value) - 1] || config.levels[0];
  };

  input.addEventListener('input', update);
  update();
});

const defaultMoodIcons = {
  'bực mình': '☁️',
  'muốn ôm': '🫂',
  'nhớ cậu': '💌'
};

const defaultMoodResponses = {
  'bực mình': 'Đã gửi tâm trạng của cậu rồi ☁️',
  'muốn ôm': 'Đã gửi một cái ôm từ xa rồi 🫂',
  'nhớ cậu': 'Đã gửi nỗi nhớ đến cậu ấy rồi 💌'
};

document.querySelectorAll('[data-notice]').forEach(button => {
  button.addEventListener('click', async () => {
    const mood = button.dataset.notice;
    const config = levelConfigs[mood];
    if (!config) return;

    const input = document.getElementById(config.input);
    const box = document.getElementById('noticeResponse');
    if (!input || !box) return;

    const level = Number(input.value);
    const intensity = config.levels[level - 1] || config.levels[0];

    box.textContent = 'Đang lưu cảm xúc…';

    try {
      await postJSON('/api/mood', {
        mood,
        level,
        intensity,
        emoji: defaultMoodIcons[mood]
      });

      box.textContent =
        (defaultMoodResponses[mood] || 'Đã gửi cảm xúc rồi ♡') +
        ' Mức độ: ' + intensity + '.';

      showToast('Đã gửi rồi ♡');
    } catch (error) {
      box.textContent = 'Chưa lưu được cảm xúc. Cậu thử lại nhé.';
      showToast(error.message);
    }
  });
});

/* =========================
   CẢM XÚC TỰ TẠO
========================= */

const customMoodForm = document.getElementById('customMoodForm');
const customMoodList = document.getElementById('customMoodList');
const customMoodName = document.getElementById('customMoodName');
const customMoodEmoji = document.getElementById('customMoodEmoji');

let customMoods = [];

function getMoodName(mood) {
  return mood.name || mood.mood || '';
}

function getMoodEmoji(mood) {
  return mood.emoji || '♡';
}

function renderCustomMoods() {
  if (!customMoodList) return;

  customMoodList.replaceChildren();

  if (!customMoods.length) {
    const message = document.createElement('p');
    message.className = 'empty-notes';
    message.textContent = 'Chưa có cảm xúc tự tạo. Cậu có thể thêm một cái ♡';
    customMoodList.append(message);
    return;
  }

  customMoods.forEach(mood => {
    const name = getMoodName(mood);
    if (!name) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'custom-mood-item';
    button.textContent = `${getMoodEmoji(mood)} ${name}`;
    button.title = `Gửi cảm xúc: ${name}`;

    button.addEventListener('click', () => sendCustomMood(mood));

    customMoodList.append(button);
  });
}

async function loadCustomMoods() {
  if (!customMoodList) return;

  try {
    const data = await apiRequest('/api/custom-moods');
    customMoods = data.moods || data.customMoods || [];
    renderCustomMoods();
  } catch (error) {
    customMoodList.textContent = 'Chưa tải được danh sách cảm xúc.';
  }
}

if (customMoodForm) {
  customMoodForm.addEventListener('submit', async event => {
    event.preventDefault();

    const name = customMoodName?.value.trim() || '';
    const emoji = customMoodEmoji?.value.trim() || '♡';

    if (!name) {
      showToast('Cậu nhập tên cảm xúc trước nhé.');
      return;
    }

    if (name.length > 32) {
      showToast('Tên cảm xúc tối đa 32 ký tự nhé.');
      return;
    }

    if (
      Object.keys(defaultMoodIcons).some(
        existing => existing.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi')
      ) ||
      customMoods.some(
        mood => getMoodName(mood).toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi')
      )
    ) {
      showToast('Cảm xúc này đã có rồi ♡');
      return;
    }

    const submitButton = customMoodForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const data = await postJSON('/api/custom-moods', { name, emoji });

      if (Array.isArray(data.moods)) {
        customMoods = data.moods;
      } else if (Array.isArray(data.customMoods)) {
        customMoods = data.customMoods;
      } else {
        customMoods.push(data.mood || { name, emoji });
      }

      renderCustomMoods();
      customMoodForm.reset();

      if (customMoodEmoji) customMoodEmoji.value = '♡';

      showToast('Đã thêm cảm xúc mới ♡');
    } catch (error) {
      showToast(error.message || 'Chưa thêm được cảm xúc.');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

async function sendCustomMood(mood) {
  const name = getMoodName(mood);
  const emoji = getMoodEmoji(mood);
  const box = document.getElementById('noticeResponse');

  if (!name) return;
  if (box) box.textContent = 'Đang gửi cảm xúc…';

  try {
    await postJSON('/api/mood', {
      mood: name,
      level: 1,
      intensity: name,
      emoji
    });

    if (box) box.textContent = `Đã gửi cảm xúc "${name}" ${emoji}`;
    showToast('Đã gửi cảm xúc rồi ♡');
  } catch (error) {
    if (box) box.textContent = 'Chưa gửi được cảm xúc. Cậu thử lại nhé.';
    showToast(error.message);
  }
}

/* =========================
   NHẬT KÝ CẢM XÚC
========================= */

const historyBox = document.getElementById('moodHistory');
let allMoods = [];
let currentMoodFilter = 'all';

function renderMoodHistory() {
  if (!historyBox) return;

  historyBox.replaceChildren();

  const filtered = allMoods.filter(item => {
    return currentMoodFilter === 'all' || item.mood === currentMoodFilter;
  });

  if (!filtered.length) {
    const message = document.createElement('p');
    message.className = 'empty-notes';
    message.textContent = 'Chưa có cảm xúc nào ở mục này ♡';
    historyBox.append(message);
    return;
  }

  filtered.forEach(item => {
    const card = document.createElement('article');
    card.className = 'mood-history-item';

    const icon = document.createElement('span');
    icon.className = 'history-icon';
    icon.textContent = item.emoji || defaultMoodIcons[item.mood] || '♡';

    const content = document.createElement('div');
    content.className = 'history-copy';

    const title = document.createElement('strong');

    const defaultTitles = {
      'bực mình': 'Đang bực mình',
      'muốn ôm': 'Đang muốn ôm',
      'nhớ cậu': 'Đang nhớ cậu'
    };

    title.textContent = defaultTitles[item.mood] || item.mood || 'Một cảm xúc nhỏ';

    const detail = document.createElement('p');
    detail.textContent = item.intensity || '';

    const date = document.createElement('small');
    date.textContent = safeDate(getCreatedAt(item));

    content.append(title, detail, date);
    card.append(icon, content);
    historyBox.append(card);
  });
}

async function loadMoodHistory() {
  if (!historyBox) return;

  historyBox.textContent = 'Đang tải nhật ký…';

  try {
    const data = await apiRequest('/api/moods');
    allMoods = data.moods || [];
    renderMoodHistory();
  } catch (error) {
    historyBox.textContent = 'Chưa mở được nhật ký lúc này. Thử tải lại trang nhé.';
    showToast(error.message || 'Chưa tải được nhật ký.');
  }
}

document.querySelectorAll('.history-filter').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.history-filter').forEach(item => {
      item.classList.remove('active');
    });

    button.classList.add('active');
    currentMoodFilter = button.dataset.filter || 'all';
    renderMoodHistory();
  });
});

/* =========================
   THƯ RIÊNG TƯ
========================= */

const letterForm = document.getElementById('letterForm');
const letterList = document.getElementById('letterList');
const openedLetter = document.getElementById('openedLetter');

let letters = [];

function renderLetters() {
  if (!letterList) return;

  letterList.replaceChildren();

  if (!letters.length) {
    const message = document.createElement('p');
    message.className = 'empty-notes';
    message.textContent = 'Chưa có bức thư nào. Hai cậu có thể viết bức đầu tiên ở trên ♡';
    letterList.append(message);
    return;
  }

  letters.forEach(letter => {
    const card = document.createElement('article');
    card.className = 'letter-list-item';

    const info = document.createElement('div');
    info.className = 'letter-list-info';

    const title = document.createElement('strong');
    title.textContent = letter.subject || 'Một bức thư';

    const meta = document.createElement('small');
    meta.textContent =
      'Từ ' + (letter.sender || 'Một người bạn') +
      ' · ' + safeDate(getCreatedAt(letter));

    info.append(title, meta);

    const actions = document.createElement('div');
    actions.className = 'letter-actions';

    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.className = 'small-action';
    openButton.textContent = 'Mở thư 🔒';
    openButton.addEventListener('click', () => openLetter(letter));

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'small-action delete-action';
    deleteButton.textContent = 'Xóa';
    deleteButton.addEventListener('click', () => deleteLetter(letter));

    actions.append(openButton, deleteButton);
    card.append(info, actions);
    letterList.append(card);
  });
}

async function loadLetters() {
  if (!letterList) return;

  letterList.textContent = 'Đang tải thư…';

  try {
    const data = await apiRequest('/api/letters');
    letters = data.letters || [];
    renderLetters();
  } catch (error) {
    letterList.textContent = error.message || 'Không tải được thư.';
  }
}

document.getElementById('refreshLetters')?.addEventListener('click', loadLetters);

if (letterForm) {
  letterForm.addEventListener('submit', async event => {
    event.preventDefault();

    const sender = document.getElementById('letterSender').value.trim();
    const subject = document.getElementById('letterSubject').value.trim();
    const body = document.getElementById('letterBody').value.trim();
    const password = document.getElementById('letterPassword').value;
    const passwordConfirm = document.getElementById('letterPasswordConfirm').value;

    if (password.length < 4) {
      showToast('Mật khẩu cần ít nhất 4 ký tự.');
      return;
    }

    if (password !== passwordConfirm) {
      showToast('Hai lần nhập mật khẩu chưa khớp.');
      return;
    }

    const button = letterForm.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    try {
      const data = await postJSON('/api/letters', {
        sender,
        subject,
        body,
        password
      });

      if (data.letters) letters = data.letters;
      else await loadLetters();

      renderLetters();
      letterForm.reset();
      showToast('Đã lưu bức thư. Nhớ mật khẩu để mở lại nhé ♡');
    } catch (error) {
      showToast(error.message || 'Không lưu được thư.');
    } finally {
      if (button) button.disabled = false;
    }
  });
}

async function openLetter(letter) {
  const password = prompt('Nhập mật khẩu do người viết đặt cho thư này:');
  if (password === null) return;

  try {
    const data = await postJSON(
      `/api/letters/${encodeURIComponent(letter.id)}/open`,
      { password }
    );

    const opened = data.letter;

    if (!openedLetter || !opened) return;

    openedLetter.replaceChildren();

    const title = document.createElement('h3');
    title.textContent = opened.subject || 'Một bức thư';

    const meta = document.createElement('small');
    meta.textContent =
      'Từ ' + (opened.sender || 'Một người bạn') +
      ' · ' + safeDate(getCreatedAt(opened));

    const body = document.createElement('p');
    body.className = 'opened-letter-body';
    body.textContent = opened.body || '';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'small-action';
    closeButton.textContent = 'Đóng thư';
    closeButton.addEventListener('click', () => {
      openedLetter.hidden = true;
    });

    openedLetter.append(title, meta, body, closeButton);
    openedLetter.hidden = false;
    openedLetter.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    showToast(error.message || 'Không mở được thư.');
  }
}

async function deleteLetter(letter) {
  const password = prompt('Nhập mật khẩu của bức thư để xác nhận xóa:');
  if (password === null) return;

  if (!confirm(`Xóa bức thư “${letter.subject}”? Không thể khôi phục sau khi xóa.`)) {
    return;
  }

  try {
    await apiRequest(`/api/letters/${encodeURIComponent(letter.id)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    if (openedLetter) openedLetter.hidden = true;
    await loadLetters();
    showToast('Đã xóa bức thư.');
  } catch (error) {
    showToast(error.message || 'Không xóa được thư.');
  }
}

/* =========================
   NOTE VÀ CÂY GHI CHÚ
========================= */

const noteForm = document.getElementById('noteForm');
const noteText = document.getElementById('noteText');
const noteCount = document.getElementById('noteCount');
const noteTree = document.getElementById('noteTree');

const noteImage = document.getElementById('noteImage');
const noteImagePreview = document.getElementById('noteImagePreview');
const noteImagePreviewImg = document.getElementById('noteImagePreviewImg');
const removeNoteImage = document.getElementById('removeNoteImage');

let selectedNoteImage = null;
const MAX_IMAGE_SIZE = 3 * 1024 * 1024;

if (noteText && noteCount) {
  noteText.addEventListener('input', () => {
    noteCount.textContent = noteText.value.length + '/280';
  });
}

function clearNoteImage() {
  selectedNoteImage = null;

  if (noteImage) noteImage.value = '';
  if (noteImagePreviewImg) noteImagePreviewImg.removeAttribute('src');
  if (noteImagePreview) noteImagePreview.hidden = true;
}

if (noteImage) {
  noteImage.addEventListener('change', () => {
    const file = noteImage.files?.[0];

    if (!file) {
      clearNoteImage();
      return;
    }

    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif'
    ];

    if (!allowedTypes.includes(file.type)) {
      showToast('Cậu chọn ảnh PNG, JPG, WEBP hoặc GIF nhé.');
      clearNoteImage();
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      showToast('Ảnh hơi lớn rồi. Cậu chọn ảnh dưới 3 MB nhé.');
      clearNoteImage();
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      selectedNoteImage = reader.result;

      if (noteImagePreviewImg) noteImagePreviewImg.src = reader.result;
      if (noteImagePreview) noteImagePreview.hidden = false;
    };

    reader.onerror = () => {
      showToast('Không đọc được ảnh này. Cậu thử chọn ảnh khác nhé.');
      clearNoteImage();
    };

    reader.readAsDataURL(file);
  });
}

if (removeNoteImage) {
  removeNoteImage.addEventListener('click', clearNoteImage);
}

function getNoteImageURL(note) {
  return note.image_url || note.imageUrl || note.imageURL || '';
}

function renderNotes(notes) {
  if (!noteTree) return;

  noteTree.replaceChildren();

  if (!notes.length) {
    const message = document.createElement('p');
    message.className = 'empty-notes';
    message.textContent = 'Cây đang chờ những mảnh giấy đầu tiên…';
    noteTree.append(message);
    return;
  }

  notes.slice().reverse().forEach(note => {
    const card = document.createElement('article');
    card.className = 'sticky-note';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'note-delete';
    deleteButton.textContent = '×';
    deleteButton.title = 'Xóa note này';

    deleteButton.addEventListener('click', async () => {
      const password = prompt('Nhập mật khẩu xóa đã đặt khi viết note:');
      if (password === null) return;

      if (!confirm('Xóa note này nhé?')) return;

      try {
        await apiRequest(`/api/notes/${encodeURIComponent(note.id)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });

        await loadNotes();
        showToast('Đã xóa note.');
      } catch (error) {
        showToast(error.message || 'Không xóa được note.');
      }
    });

    const text = document.createElement('p');
    text.textContent = note.text || '';

    const imageURL = getNoteImageURL(note);

    if (imageURL) {
      const image = document.createElement('img');
      image.className = 'note-attached-image';
      image.src = imageURL;
      image.alt = 'Ảnh đính kèm trong note';
      image.loading = 'lazy';

      image.addEventListener('error', () => {
        image.alt = 'Ảnh này hiện chưa tải được';
      });

      card.append(deleteButton);

      if (note.text) card.append(text);
      card.append(image);
    } else {
      card.append(deleteButton, text);
    }

    const author = document.createElement('small');
    author.textContent =
      (note.author || 'Một người bạn') +
      ' · ' + safeDate(getCreatedAt(note));

    card.append(author);
    noteTree.append(card);
  });
}

async function loadNotes() {
  if (!noteTree) return;

  try {
    const data = await apiRequest('/api/notes');
    renderNotes(data.notes || []);
  } catch (error) {
    noteTree.textContent = error.message || 'Chưa tải được note. Kiểm tra máy chủ nhé.';
  }
}

if (noteForm) {
  noteForm.addEventListener('submit', async event => {
    event.preventDefault();

    const text = noteText?.value.trim() || '';
    const author = document.getElementById('noteAuthor')?.value.trim() || '';
    const deletePassword =
      document.getElementById('noteDeletePassword')?.value || '';

    if (!text && !selectedNoteImage) {
      showToast('Cậu viết vài dòng hoặc chọn một tấm ảnh nhé ♡');
      return;
    }

    if (!author) {
      showToast('Cậu nhập tên trước nhé.');
      return;
    }

    if (text.length > 280) {
      showToast('Note tối đa 280 ký tự nhé.');
      return;
    }

    if (deletePassword.length < 4) {
      showToast('Mật khẩu xóa note cần ít nhất 4 ký tự.');
      return;
    }

    const button = noteForm.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    try {
      const data = await postJSON('/api/notes', {
        text,
        author,
        deletePassword,
        imageData: selectedNoteImage
      });

      if (noteText) noteText.value = '';
      const passwordInput = document.getElementById('noteDeletePassword');
      if (passwordInput) passwordInput.value = '';

      if (noteCount) noteCount.textContent = '0/280';

      clearNoteImage();

      if (data.notes) {
        renderNotes(data.notes);
      } else {
        await loadNotes();
      }

      showToast('Đã lưu note ♡');
    } catch (error) {
      showToast(error.message || 'Không lưu được note.');
    } finally {
      if (button) button.disabled = false;
    }
  });
}

/* =========================
   HIỆU ỨNG HOA RƠI
========================= */

const petalLayer = document.getElementById('petals');

function makePetal() {
  if (!petalLayer) return;

  const petal = document.createElement('span');
  petal.className = 'petal';
  petal.textContent = Math.random() > 0.5 ? '✿' : '❀';
  petal.style.left = Math.random() * 100 + 'vw';
  petal.style.fontSize = (10 + Math.random() * 13) + 'px';
  petal.style.setProperty('--drift', (Math.random() * 150 - 75) + 'px');
  petal.style.animationDuration = (8 + Math.random() * 8) + 's';

  petalLayer.append(petal);

  setTimeout(() => petal.remove(), 17000);
}

setInterval(() => {
  if (document.visibilityState === 'visible') makePetal();
}, 900);

document.getElementById('petalBtn')?.addEventListener('click', () => {
  for (let i = 0; i < 18; i++) {
    setTimeout(makePetal, i * 65);
  }

  showToast('Một cơn mưa hoa tím dành cho cậu ✿');
});
