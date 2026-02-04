// upload.js — Firebase storage + firestore upload + MediaRecorder
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

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
const storage = getStorage(app);
const db = getFirestore(app);

const fileInput = document.getElementById('fileInput');
const uploadForm = document.getElementById('uploadForm');
const titleInput = document.getElementById('title');
const descInput = document.getElementById('description');
const folderSelect = document.getElementById('folderSelect');
const newFolderInput = document.getElementById('newFolder');
const statusEl = document.getElementById('status');
const previewEl = document.getElementById('preview');

const startAudioBtn = document.getElementById('startAudioRecord');
const startVideoBtn = document.getElementById('startVideoRecord');
const stopBtn = document.getElementById('stopRecord');

let mediaRecorder = null;
let recordedChunks = [];
let currentStream = null;

startAudioBtn.onclick = () => startRecording({ audio: true, video: false });
startVideoBtn.onclick = () => startRecording({ audio: true, video: true });
stopBtn.onclick = stopRecording;

async function startRecording(constraints){
  try{
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch(e){
    alert('Could not access devices: ' + (e.message||e));
    return;
  }
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(currentStream);
  mediaRecorder.ondataavailable = e => { if(e.data && e.data.size) recordedChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: recordedChunks[0]?.type || (constraints.video ? 'video/webm' : 'audio/webm') });
    showPreviewBlob(blob);
    // stop all tracks
    currentStream.getTracks().forEach(t=>t.stop());
    currentStream = null;
  };
  mediaRecorder.start();
  statusEl.textContent = 'Recording...';
  stopBtn.disabled = false;
}

function stopRecording(){
  if(mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  statusEl.textContent = 'Recording stopped. Preview below.';
  stopBtn.disabled = true;
}

function showPreviewBlob(blob){
  previewEl.innerHTML = '';
  const url = URL.createObjectURL(blob);
  if(blob.type.startsWith('video')){
    const v = document.createElement('video');
    v.controls = true; v.src = url; v.width = 320;
    previewEl.appendChild(v);
  } else {
    const a = document.createElement('audio');
    a.controls = true; a.src = url;
    previewEl.appendChild(a);
  }
  // attach the blob to fileInput via a DataTransfer so upload uses it
  const dt = new DataTransfer();
  const f = new File([blob], blob.type.startsWith('video') ? 'recording.webm' : 'recording.webm', { type: blob.type });
  dt.items.add(f);
  fileInput.files = dt.files;
}

uploadForm.onsubmit = async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if(!file){ alert('Choose or record a media file first'); return; }
  const title = titleInput.value.trim() || 'Untitled';
  const description = descInput.value.trim();
  const folder = (newFolderInput.value.trim() || folderSelect.value || 'Unsorted');

  statusEl.textContent = 'Uploading file...';
  try {
    const ext = file.name.split('.').pop();
    const fname = `media/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const sRef = storageRef(storage, fname);
    const uploadTask = uploadBytesResumable(sRef, file);

    await new Promise((res, rej) => {
      uploadTask.on('state_changed',
        snapshot => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          statusEl.textContent = `Uploading: ${pct}%`;
        },
        error => rej(error),
        () => res()
      );
    });

    const url = await getDownloadURL(sRef);
    // save metadata
    const docRef = await addDoc(collection(db, 'media'), {
      title,
      description,
      folder,
      mediaURL: url,
      mediaType: file.type,
      createdAt: serverTimestamp()
    });
    statusEl.textContent = 'Upload complete.';
    // clear form for next upload
    uploadForm.reset();
    previewEl.innerHTML = '';
    loadFolders(); // refresh folder list
  } catch(err){
    console.error(err);
    statusEl.textContent = 'Upload failed (see console)';
  }
};

// optional: load existing folders to fill folderSelect
import { getDocs, query, orderBy, collection as colRef } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';
async function loadFolders(){
  folderSelect.innerHTML = '<option value="">-- choose --</option>';
  const q = query(colRef(db, 'media'), orderBy('createdAt', 'desc'));
  try {
    const snap = await getDocs(q);
    const folders = Array.from(new Set(snap.docs.map(d => d.data().folder || 'Unsorted')));
    folders.forEach(f => folderSelect.appendChild(Object.assign(document.createElement('option'), { value: f, textContent: f })));
  } catch(e){ console.warn('Could not load folders', e); }
}
loadFolders();
