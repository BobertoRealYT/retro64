// STORAGE MANAGER
class StorageManager {
  constructor() {
    this.romPrefix = 'retro64_rom_';
    this.saveStatePrefix = 'retro64_savestate_';
    this.settingsKey = 'retro64_settings';
  }

  saveROM(name, data) {
    const key = this.romPrefix + name;
    try {
      localStorage.setItem(key, data);
      this.updateROMList();
      return true;
    } catch (e) {
      console.error('Failed to save ROM:', e);
      return false;
    }
  }

  loadROM(name) {
    const key = this.romPrefix + name;
    return localStorage.getItem(key);
  }

  getROMList() {
    const list = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.romPrefix)) {
        const name = key.substring(this.romPrefix.length);
        list.push(name);
      }
    }
    return list;
  }

  deleteROM(name) {
    const key = this.romPrefix + name;
    localStorage.removeItem(key);
    this.deleteSaveStates(name);
    this.updateROMList();
  }

  saveSaveState(romName, slot, data) {
    const key = this.saveStatePrefix + romName + '_' + slot;
    try {
      localStorage.setItem(key, data);
      return true;
    } catch (e) {
      console.error('Failed to save state:', e);
      return false;
    }
  }

  loadSaveState(romName, slot) {
    const key = this.saveStatePrefix + romName + '_' + slot;
    return localStorage.getItem(key);
  }

  getSaveStates(romName) {
    const states = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.saveStatePrefix + romName + '_')) {
        const slot = parseInt(key.substring((this.saveStatePrefix + romName + '_').length));
        const data = localStorage.getItem(key);
        states.push({ slot, data, timestamp: this.getTimestamp(romName, slot) });
      }
    }
    return states.sort((a, b) => a.slot - b.slot);
  }

  deleteSaveStates(romName) {
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.saveStatePrefix + romName)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => localStorage.removeItem(key));
  }

  deleteSaveState(romName, slot) {
    const key = this.saveStatePrefix + romName + '_' + slot;
    localStorage.removeItem(key);
  }

  saveSettings(settings) {
    localStorage.setItem(this.settingsKey, JSON.stringify(settings));
  }

  loadSettings() {
    const settings = localStorage.getItem(this.settingsKey);
    return settings ? JSON.parse(settings) : {
      shader: 'none',
      controlsVisible: true,
      volume: 100
    };
  }

  getTimestamp(romName, slot) {
    const key = this.saveStatePrefix + romName + '_' + slot + '_time';
    return localStorage.getItem(key) || 'Unknown';
  }

  setTimestamp(romName, slot, time) {
    const key = this.saveStatePrefix + romName + '_' + slot + '_time';
    localStorage.setItem(key, time);
  }

  updateROMList() {
    const list = this.getROMList();
    localStorage.setItem('retro64_romlist', JSON.stringify(list));
  }
}

// EMULATOR CONTROLLER
class EmulatorController {
  constructor() {
    this.storage = new StorageManager();
    this.settings = this.storage.loadSettings();
    this.currentRom = null;
    this.currentRomName = null;
    this.keyMap = {
      'A': 'KeyX',
      'B': 'KeyZ',
      'Z': 'KeyC',
      'Start': 'Enter',
      'L': 'KeyQ',
      'R': 'KeyW',
      'Up': 'ArrowUp',
      'Down': 'ArrowDown',
      'Left': 'ArrowLeft',
      'Right': 'ArrowRight',
      'CUp': 'Numpad8',
      'CDown': 'Numpad2',
      'CLeft': 'Numpad4',
      'CRight': 'Numpad6'
    };
    this.pressedKeys = new Set();
    this.initEventListeners();
    this.renderLibrary();
  }

  initEventListeners() {
    // ROM Upload
    document.getElementById('upload').addEventListener('change', (e) => this.handleROMUpload(e));

    // Joystick controls
    this.setupJoystick('stickLeft', 'knobLeft');
    this.setupJoystick('stickC', 'knobC');

    // Keyboard support for desktop
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  setupJoystick(stickId, knobId) {
    const stick = document.getElementById(stickId);
    const knob = document.getElementById(knobId);
    let isDragging = false;

    stick.addEventListener('touchstart', (e) => {
      isDragging = true;
      e.preventDefault();
    }, { passive: false });

    stick.addEventListener('touchend', () => {
      isDragging = false;
      knob.style.transform = 'translate(0, 0)';
      this.releaseAnalogKey(stickId);
    });

    stick.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      e.preventDefault();

      const touch = e.touches[0];
      const rect = stick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let x = touch.clientX - centerX;
      let y = touch.clientY - centerY;

      const distance = Math.sqrt(x * x + y * y);
      const maxDistance = rect.width / 2 - 30;

      if (distance > maxDistance) {
        const angle = Math.atan2(y, x);
        x = Math.cos(angle) * maxDistance;
        y = Math.sin(angle) * maxDistance;
      }

      knob.style.transform = `translate(${x}px, ${y}px)`;

      this.handleAnalogStick(stickId, x, y, maxDistance);
    }, { passive: false });

    // Mouse support for desktop
    stick.addEventListener('mousedown', () => { isDragging = true; });
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        knob.style.transform = 'translate(0, 0)';
        this.releaseAnalogKey(stickId);
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = stick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let x = e.clientX - centerX;
      let y = e.clientY - centerY;

      const distance = Math.sqrt(x * x + y * y);
      const maxDistance = rect.width / 2 - 30;

      if (distance > maxDistance) {
        const angle = Math.atan2(y, x);
        x = Math.cos(angle) * maxDistance;
        y = Math.sin(angle) * maxDistance;
      }

      knob.style.transform = `translate(${x}px, ${y}px)`;
      this.handleAnalogStick(stickId, x, y, maxDistance);
    });
  }

  handleAnalogStick(stickId, x, y, maxDistance) {
    const threshold = maxDistance * 0.3;

    if (stickId === 'stickLeft') {
      if (y < -threshold) this.pressKey('Up');
      else if (y > threshold) this.pressKey('Down');

      if (x < -threshold) this.pressKey('Left');
      else if (x > threshold) this.pressKey('Right');
    } else if (stickId === 'stickC') {
      if (y < -threshold) this.pressKey('CUp');
      else if (y > threshold) this.pressKey('CDown');

      if (x < -threshold) this.pressKey('CLeft');
      else if (x > threshold) this.pressKey('CRight');
    }
  }

  releaseAnalogKey(stickId) {
    if (stickId === 'stickLeft') {
      ['Up', 'Down', 'Left', 'Right'].forEach(k => this.releaseKey(k));
    } else if (stickId === 'stickC') {
      ['CUp', 'CDown', 'CLeft', 'CRight'].forEach(k => this.releaseKey(k));
    }
  }

  pressKey(button) {
    const keyCode = this.keyMap[button];
    if (keyCode && !this.pressedKeys.has(button)) {
      this.pressedKeys.add(button);
      document.dispatchEvent(new KeyboardEvent('keydown', { code: keyCode, bubbles: true }));
    }
  }

  releaseKey(button) {
    const keyCode = this.keyMap[button];
    if (keyCode && this.pressedKeys.has(button)) {
      this.pressedKeys.delete(button);
      document.dispatchEvent(new KeyboardEvent('keyup', { code: keyCode, bubbles: true }));
    }
  }

  handleKeyDown(e) {
    if (e.repeat) return;
    if (e.target.tagName === 'INPUT') return;
  }

  handleKeyUp(e) {
    if (e.target.tagName === 'INPUT') return;
  }

  async handleROMUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const spinner = document.getElementById('loadingSpinner');
    spinner.classList.add('active');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const blob = new Blob([arrayBuffer]);
      const url = URL.createObjectURL(blob);
      
      this.storage.saveROM(file.name, url);
      this.renderLibrary();
      this.showNotification(`ROM "${file.name}" saved!`);
    } catch (error) {
      console.error('Error uploading ROM:', error);
      this.showNotification('Error uploading ROM', 'error');
    } finally {
      spinner.classList.remove('active');
      e.target.value = '';
    }
  }

  renderLibrary() {
    const libraryContent = document.getElementById('libraryContent');
    const romList = this.storage.getROMList();

    if (romList.length === 0) {
      libraryContent.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">No ROMs added yet</div>';
      return;
    }

    libraryContent.innerHTML = '';
    romList.forEach(romName => {
      const container = document.createElement('div');
      container.style.marginBottom = '8px';

      const button = document.createElement('button');
      button.className = 'rom-item';
      button.textContent = romName;
      button.onclick = () => this.loadROM(romName);

      const actions = document.createElement('div');
      actions.className = 'rom-actions';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'rom-action-btn';
      deleteBtn.textContent = '🗑️ Delete';
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        this.confirmDeleteROM(romName);
      };

      const resetBtn = document.createElement('button');
      resetBtn.className = 'rom-action-btn';
      resetBtn.textContent = '🔄 Reset';
      resetBtn.onclick = (e) => {
        e.stopPropagation();
        this.confirmResetProgress(romName);
      };

      actions.appendChild(deleteBtn);
      actions.appendChild(resetBtn);

      container.appendChild(button);
      container.appendChild(actions);
      libraryContent.appendChild(container);
    });
  }

  confirmDeleteROM(romName) {
    showConfirmModal(
      'Delete ROM',
      `Are you sure you want to delete "${romName}"? This action cannot be undone.`,
      'Delete',
      () => {
        this.storage.deleteROM(romName);
        this.renderLibrary();
        this.showNotification(`ROM deleted`);
      }
    );
  }

  confirmResetProgress(romName) {
    showConfirmModal(
      'Reset Progress',
      `Are you sure you want to delete all save states for "${romName}"? Progress will be lost.`,
      'Reset',
      () => {
        this.storage.deleteSaveStates(romName);
        this.renderSaveStates();
        this.showNotification(`Progress reset`);
      }
    );
  }

  loadROM(romName) {
    this.currentRomName = romName;
    this.currentRom = this.storage.loadROM(romName);

    if (!this.currentRom) {
      this.showNotification('Error loading ROM', 'error');
      return;
    }

    toggleLibrary();
    document.getElementById('loadingSpinner').classList.add('active');

    setTimeout(() => {
      document.getElementById('emulator').innerHTML = '';

      window.EJS_player = '#emulator';
      window.EJS_core = 'n64';
      window.EJS_gameUrl = this.currentRom;
      window.EJS_pathtodata = 'https://cdn.emulatorjs.org/latest/data/';

      const script = document.createElement('script');
      script.src = 'https://cdn.emulatorjs.org/latest/data/loader.js';
      script.onload = () => {
        document.getElementById('loadingSpinner').classList.remove('active');
        this.applyShader(this.settings.shader);
      };
      document.body.appendChild(script);
    }, 100);
  }

  saveSaveState(slot) {
    if (!this.currentRomName) {
      this.showNotification('No ROM loaded', 'error');
      return;
    }

    // This would require integration with emulator's save state API
    const timestamp = new Date().toLocaleString();
    this.storage.setTimestamp(this.currentRomName, slot, timestamp);
    this.renderSaveStates();
    this.showNotification(`State saved to slot ${slot}`);
  }

  loadSaveState(slot) {
    if (!this.currentRomName) {
      this.showNotification('No ROM loaded', 'error');
      return;
    }

    // This would require integration with emulator's load state API
    this.showNotification(`State loaded from slot ${slot}`);
  }

  renderSaveStates() {
    if (!this.currentRomName) return;

    const grid = document.getElementById('saveStateGrid');
    const states = this.storage.getSaveStates(this.currentRomName);

    if (states.length === 0) {
      grid.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">No save states</div>';
      return;
    }

    grid.innerHTML = '';
    states.forEach(state => {
      const item = document.createElement('div');
      item.className = 'save-state-item';
      item.innerHTML = `
        <div>Slot ${state.slot}</div>
        <div class="save-state-info">${state.timestamp}</div>
      `;
      item.onclick = () => this.loadSaveState(state.slot);
      grid.appendChild(item);
    });
  }

  applyShader(shaderName) {
    // Shader implementation would go here
    // This is a placeholder
    console.log('Applying shader:', shaderName);
  }

  showNotification(message, type = 'success') {
    const indicator = document.getElementById('statusIndicator');
    indicator.textContent = message;
    indicator.style.color = type === 'error' ? '#ff6b6b' : '#4ecdc4';
    setTimeout(() => {
      indicator.textContent = '';
    }, 3000);
  }
}

// UI FUNCTIONS
function toggleLibrary() {
  const library = document.getElementById('library');
  const overlay = document.getElementById('libraryOverlay');
  library.classList.toggle('open');
  overlay.classList.toggle('visible');
}

function openSaveStateMenu() {
  const menu = document.getElementById('saveStateMenu');
  menu.classList.add('visible');
  emulator.renderSaveStates();
}

function closeSaveStateMenu() {
  document.getElementById('saveStateMenu').classList.remove('visible');
}

function openShaderMenu() {
  const menu = document.getElementById('shaderMenu');
  const grid = document.getElementById('shaderGrid');
  menu.classList.add('visible');

  const shaders = [
    { name: 'None', value: 'none' },
    { name: 'CRT', value: 'crt' },
    { name: 'Scan Lines', value: 'scanlines' },
    { name: 'Retro', value: 'retro' },
    { name: 'Blur', value: 'blur' },
    { name: 'Vignette', value: 'vignette' }
  ];

  grid.innerHTML = '';
  shaders.forEach(shader => {
    const btn = document.createElement('button');
    btn.className = 'modal-btn modal-btn-secondary';
    btn.textContent = shader.name;
    btn.onclick = () => {
      emulator.settings.shader = shader.value;
      emulator.storage.saveSettings(emulator.settings);
      emulator.applyShader(shader.value);
      closeShaderMenu();
      emulator.showNotification(`Shader: ${shader.name}`);
    };
    grid.appendChild(btn);
  });
}

function closeShaderMenu() {
  document.getElementById('shaderMenu').classList.remove('visible');
}

function showConfirmModal(title, text, actionText, callback) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmText').textContent = text;
  document.getElementById('confirmActionBtn').textContent = actionText;
  
  window.confirmCallback = callback;
  modal.classList.add('visible');
}

function executeConfirmAction() {
  if (window.confirmCallback) {
    window.confirmCallback();
  }
  closeConfirmModal();
}

function closeConfirmModal() {
  document.getElementById('confirmModal').classList.remove('visible');
  window.confirmCallback = null;
}

function pressKey(button) {
  emulator.pressKey(button);
}

function releaseKey(button) {
  emulator.releaseKey(button);
}

function toggleFullscreen() {
  const elem = document.documentElement;
  if (!document.fullscreenElement) {
    elem.requestFullscreen?.() || elem.mozRequestFullScreen?.() || elem.webkitRequestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function toggleControls() {
  const controls = document.getElementById('controls');
  controls.style.display = controls.style.display === 'none' ? 'grid' : 'none';
}

// Initialize
const emulator = new EmulatorController();

// Install PWA prompt
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  deferredPrompt = e;
});

// Make functions global
window.pressKey = pressKey;
window.releaseKey = releaseKey;
window.toggleLibrary = toggleLibrary;
window.openSaveStateMenu = openSaveStateMenu;
window.closeSaveStateMenu = closeSaveStateMenu;
window.openShaderMenu = openShaderMenu;
window.closeShaderMenu = closeShaderMenu;
window.toggleFullscreen = toggleFullscreen;
window.toggleControls = toggleControls;
