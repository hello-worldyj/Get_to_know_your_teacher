// view.js — modular Firebase v9 usage
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getFirestore, collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

// TODO: Replace with your Firebase config
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const mediaListEl = document.getElementById('mediaList');
const folderSelect = document.getElementById('folderSelect');

let allMedia = [];

async function loadMedia(){
  mediaListEl.innerHTML = 'Loading...';
  const q = query(collection(db, 'media'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  allMedia = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderFolderOptions();
  renderMedia('__all__');
}

function renderFolderOptions(){
  const folders = Array.from(new Set(allMedia.map(m => m.folder || 'Unsorted')));
  folderSelect.innerHTML = '<option value="__all__">All</option>' + folders.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
  folderSelect.onchange = () => renderMedia(folderSelect.value);
}

function renderMedia(folder){
  mediaListEl.innerHTML = '';
  const filtered = folder === '__all__' ? allMedia : allMedia.filter(m => (m.folder||'Unsorted')===folder);
  if(!filtered.length) { mediaListEl.innerHTML = '<p>No media found.</p>'; return; }
  for(const m of filtered){
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3>${escapeHtml(m.title || 'Untitled')}</h3>
      <p>${escapeHtml(m.description || '')}</p>`;
    if(m.mediaType && m.mediaURL){
      if(m.mediaType.startsWith('video')){
        const v = document.createElement('video');
        v.controls = true;
        v.src = m.mediaURL;
        card.appendChild(v);
      } else {
        const a = document.createElement('audio');
        a.controls = true;
        a.src = m.mediaURL;
        card.appendChild(a);
      }
    }
    mediaListEl.appendChild(card);
  }
}

function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }

loadMedia().catch(err => {
  mediaListEl.innerHTML = '<p>Error loading media (check console)</p>';
  console.error(err);
});
