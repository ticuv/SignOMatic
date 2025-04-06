// SignOMatic/script.js
// Script principal pentru Landing Page Haotică

// --- Global State & Config ---
let clickCount = 0;
let score = 0;
let audioContext;
let originalAlienSrc = 'assets/images/img_alien_original.gif'; // Hardcodat initial, poate fi suprascris
let originalTitle;
let originalFaviconHref;
let gameData = {}; // Stochează data.json
let effectConfig = {}; // Stochează effects_config.json
const effectCooldowns = {}; // { effectName: lastClickCount }
let domElements = {}; // Cache pentru elemente DOM
let copyFeedbackTimeout; // Timeout pentru mesajul 'Copied!'
let activeTimeouts = []; // Array to keep track of timeouts for cleanup

// --- Constante ---
const MAX_CLICKS_BEFORE_UNLOCK = 5;
const SOLANA_ADDRESS = "2Vv3QHAJxZvViaY1HaWvJ5kbnNeUdN1MrZcRYog4ezHE"; // Adresele pot fi mutate in data.json eventual
const ETHEREUM_ADDRESS = "0xbD0dDE4175d8e854306a09dE4c184392b33a6d9C";
const X_PROFILE_URL = "https://twitter.com/ticuv_"; // Asigură-te că e corect

// --- DOM Element Getters ---
function cacheDOMElements() {
    domElements = {
        doNotClickBtn: document.getElementById("doNotClickBtn"),
        realOptions: document.getElementById("realOptions"),
        crazyTextEl: document.getElementById("crazyText"),
        createSignBtn: document.getElementById("createSignBtn"), // Butonul de navigare din pagina haotica
        galleryBtn: document.getElementById("galleryBtn"),   // Butonul de navigare din pagina haotica
        messageBox: document.getElementById("messageBox"),
        consoleOutput: document.getElementById("consoleOutput"),
        bodyEl: document.body,
        titleEl: document.querySelector('h1'),
        alienImage: document.getElementById('alienImage'),
        scoreDisplay: document.getElementById('scoreDisplay'),
        jumpscareVisualEl: document.getElementById('jumpscareVisual'),
        imageFlashOverlay: document.getElementById("imageFlashOverlay"),
        loadingBarContainer: document.getElementById("fakeLoadingBarContainer"),
        loadingBarProgress: document.getElementById("fakeLoadingBarProgress"),
        centerStage: document.getElementById("centerStage"),
        rootEl: document.documentElement,
        favicon: document.getElementById('favicon'),
        dynamicTextOverlay: document.getElementById('dynamicTextOverlay'),
        attribution: document.getElementById('attribution'),
        supportModalOverlay: document.getElementById('supportModalOverlay'),
        supportModal: document.getElementById('supportModal'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        twitterShareButton: document.getElementById('twitterShareButton'), // Redenumit din followXBtn in HTML? Daca nu, ajusteaza ID-ul
        buyCoffeeBtn: document.getElementById('buyCoffeeBtn'),
        cryptoOptions: document.getElementById('cryptoOptions'),
        solanaBtn: document.getElementById('solanaBtn'),
        ethereumBtn: document.getElementById('ethereumBtn'),
        addressDisplay: document.getElementById('addressDisplay'),
        cryptoAddressInput: document.getElementById('cryptoAddressInput'),
        copyAddressBtn: document.getElementById('copyAddressBtn'),
        copyFeedback: document.getElementById('copyFeedback'),
        shareModalTitle: document.getElementById('shareModalTitle'), // Adaugat pentru text modal
        shareMessage: document.getElementById('shareMessage')     // Adaugat pentru text modal
    };
    // Preia valorile initiale DUPA ce elementele sunt garantat in DOM
    if (domElements.alienImage) originalAlienSrc = domElements.alienImage.src;
    originalTitle = document.title;
    if (domElements.favicon) originalFaviconHref = domElements.favicon.href;

    // Verificare elemente esentiale
     Object.keys(domElements).forEach(key => {
         if (!domElements[key] && key !== 'jumpscareVisualEl' && key !== 'imageFlashOverlay' /* Permit lipsa unor overlay-uri */) {
             // Permitem si lipsa elementelor modale initial, le verificam in functiile lor
             const modalElements = ['supportModalOverlay', 'supportModal', 'closeModalBtn', 'twitterShareButton', 'buyCoffeeBtn', 'cryptoOptions', 'solanaBtn', 'ethereumBtn', 'addressDisplay', 'cryptoAddressInput', 'copyAddressBtn', 'copyFeedback', 'shareModalTitle', 'shareMessage'];
             if(!modalElements.includes(key)) {
                 console.warn(`Warning: DOM element '${key}' not found during caching.`);
                 // Poate afisa eroare critica doar pt elemente absolut necesare
                 if(['doNotClickBtn', 'messageBox', 'consoleOutput', 'bodyEl', 'titleEl'].includes(key)) {
                     console.error(`CRITICAL ERROR: Essential element '${key}' is missing!`);
                     // Potential stop execution or show UI error
                 }
             }
         }
     });
}

// --- Funcții Utilitare ---
function updateConsole(message) {
    if (!domElements.consoleOutput) return;
    // Evita erori daca innerText e null/undefined
    domElements.consoleOutput.innerText = (domElements.consoleOutput.innerText || '') + message + "\n";
    const lines = domElements.consoleOutput.innerText.split("\n");
    if (lines.length > 150) {
        domElements.consoleOutput.innerText = lines.slice(lines.length - 150).join("\n");
    }
    domElements.consoleOutput.scrollTop = domElements.consoleOutput.scrollHeight;
}

function updateScoreDisplay() {
    if (!domElements.scoreDisplay) return;
    domElements.scoreDisplay.innerText = `Score: ${score}`;
}

function addScore(change) {
    score = Math.max(0, score + change); // Prevent negative score
    updateScoreDisplay();
    if (!domElements.scoreDisplay) return;
    domElements.scoreDisplay.classList.remove('score-pulse', 'score-penalty');
    void domElements.scoreDisplay.offsetWidth;
    if (change > 0) domElements.scoreDisplay.classList.add('score-pulse');
    else if (change < 0) domElements.scoreDisplay.classList.add('score-penalty');
    // Folosim un timeout gestionat
    registerTimeout(() => {
        if (domElements.scoreDisplay) {
           domElements.scoreDisplay.classList.remove('score-pulse', 'score-penalty');
        }
    }, 350);
}

function getRandomInRange(min, max) { return Math.random() * (max - min) + min; }
function getRandomIntInRange(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function getRandomElement(arr) { if (!arr || arr.length === 0) return null; return arr[Math.floor(Math.random() * arr.length)]; }
function getRandomWord() { return getRandomElement(gameData.words || ['random']); }
function getRandomColor() { return `hsl(${getRandomInRange(0, 360)}, ${getRandomInRange(30, 100)}%, ${getRandomInRange(25, 75)}%)`; }
function getElement(targetId) { return domElements[targetId] || document.getElementById(targetId); } // Foloseste cache daca e disponibil

// Helper pentru gestionarea timeout-urilor (util pentru cleanup)
function registerTimeout(callback, delay) {
    const timeoutId = setTimeout(() => {
        callback();
        // Elimina timeout-ul din lista dupa executie
        activeTimeouts = activeTimeouts.filter(id => id !== timeoutId);
    }, delay);
    activeTimeouts.push(timeoutId);
    return timeoutId; // Returneaza ID-ul in caz ca e nevoie sa fie anulat manual
}

function clearAllActiveTimeouts() {
    activeTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    activeTimeouts = [];
    // console.log("Cleared active timeouts."); // Optional debug log
}

// --- Audio ---
function initAudioContext() {
    if (!audioContext && (window.AudioContext || window.webkitAudioContext)) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => { updateConsole(">> AudioContext Resumed."); })
                 .catch(e => updateConsole(`>> AudioContext Resume failed: ${e.message}`));
            }
            updateConsole(">> AudioContext Initialized.");
        } catch (e) {
            updateConsole(">> Warning: Could not create AudioContext: " + e.message);
            audioContext = null;
        }
    }
}

function playSimpleSound({ frequency = 440, duration = 0.1, type = 'sine', volume = 0.3 }) {
    if (!audioContext || audioContext.state === 'suspended') return; // Nu reda daca contextul nu e gata/activ
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration); // Ramp to very small value
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration + 0.05); // Stop slightly after ramp
    } catch (e) { updateConsole(">> Audio Error: " + e.message); }
}

// --- Funcții Modal (Adaptate pentru Pagina Principală) ---
function openSupportModal() {
    const modalOverlay = getElement('supportModalOverlay');
    const modal = getElement('supportModal');
    const cryptoOpts = getElement('cryptoOptions');
    const addressDisp = getElement('addressDisplay');
    const addressInput = getElement('cryptoAddressInput');
    const feedbackEl = getElement('copyFeedback');
    const modalTitleEl = getElement('shareModalTitle');
    const shareMessageEl = getElement('shareMessage');
    const twitterButton = getElement('twitterShareButton');

    if (!modal || !modalOverlay) { console.error("Support Modal elements missing!"); return; }

    // Reset
    if (cryptoOpts) cryptoOpts.style.display = 'none';
    if (addressDisp) addressDisp.style.display = 'none';
    if (addressInput) addressInput.value = '';
    if (feedbackEl) feedbackEl.textContent = '';
    clearTimeout(copyFeedbackTimeout);

    // Setează Texte (Engleză)
    if(modalTitleEl) modalTitleEl.textContent = "Enjoying the Chaos?";
    if(shareMessageEl) shareMessageEl.textContent = "If you like this weird experiment, consider sharing it or supporting its creator!";

    const currentPageUrl = window.location.href;
    const tweetText = `Check out this chaotic sign creator by @ticu_v ! `;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(currentPageUrl)}`;
    if(twitterButton) twitterButton.href = twitterUrl;

    modalOverlay.style.display = 'flex';
    modal.style.display = 'block'; // Sau 'flex' daca CSS-ul foloseste asta
    requestAnimationFrame(() => { // For transition
        modalOverlay.classList.add('visible');
        modal.classList.add('visible');
    });
    updateConsole(">> Support modal opened.");
    playSimpleSound({ frequency: 500, duration: 0.05, type: 'sine', volume: 0.3 });
}

function closeSupportModal() {
    const modalOverlay = getElement('supportModalOverlay');
    const modal = getElement('supportModal');
    if (!modal || !modalOverlay) return;
    modalOverlay.classList.remove('visible');
    modal.classList.remove('visible');
    registerTimeout(() => { // Use managed timeout
        modalOverlay.style.display = 'none';
        modal.style.display = 'none';
        updateConsole(">> Support modal closed.");
    }, 300);
    playSimpleSound({ frequency: 400, duration: 0.05, type: 'sine', volume: 0.2 });
}

function displayCryptoAddress(type) {
    const addressInput = getElement('cryptoAddressInput');
    const addressDisp = getElement('addressDisplay');
    const feedbackEl = getElement('copyFeedback');
    if (!addressInput || !addressDisp || !feedbackEl) return;
    const address = (type === 'SOL') ? SOLANA_ADDRESS : ETHEREUM_ADDRESS;
    addressInput.value = address;
    addressDisp.style.display = 'block';
    feedbackEl.textContent = '';
    clearTimeout(copyFeedbackTimeout);
    updateConsole(`>> Displaying ${type} address.`);
    playSimpleSound({ frequency: 600, duration: 0.04, type: 'triangle', volume: 0.25 });
}

function copyAddressToClipboard() {
    const addressInput = getElement('cryptoAddressInput');
    const feedbackEl = getElement('copyFeedback');
    const copyBtn = getElement('copyAddressBtn'); // Get button for feedback styling
    if (!addressInput || !feedbackEl) return;
    const address = addressInput.value;

    if (!navigator.clipboard) { // Fallback
        try {
            addressInput.select();
            document.execCommand('copy');
            feedbackEl.textContent = 'Address copied (fallback)!';
            if(copyBtn) copyBtn.textContent = 'Copied!';
            updateConsole(">> Address copied (fallback).");
        } catch (err) {
            feedbackEl.textContent = 'Copy failed!';
             if(copyBtn) copyBtn.textContent = 'Error!';
            updateConsole(">> ERROR: Fallback copy failed."); console.error(err);
        }
    } else { // Modern API
        navigator.clipboard.writeText(address).then(() => {
            feedbackEl.textContent = 'Address copied!';
             if(copyBtn) copyBtn.textContent = 'Copied!';
            updateConsole(">> Address copied.");
            playSimpleSound({ frequency: 1200, duration: 0.1, type: 'triangle', volume: 0.3 });
        }).catch(err => {
            feedbackEl.textContent = 'Copy failed!';
             if(copyBtn) copyBtn.textContent = 'Error!';
            updateConsole(">> ERROR: Could not copy address."); console.error(err);
            playSimpleSound({ frequency: 200, duration: 0.2, type: 'square', volume: 0.3 });
        });
    }
    clearTimeout(copyFeedbackTimeout);
    copyFeedbackTimeout = registerTimeout(() => { // Use managed timeout
        if (feedbackEl) feedbackEl.textContent = '';
        if(copyBtn) copyBtn.textContent = 'Copy Address'; // Reset button text
    }, 3000);
}

// --- Efectele Haotice (Definiții Funcții - Prescurtat, trebuie extinse) ---
// Adauga TOATE functiile effect_... definite anterior aici
// Exemplu:
function effect_SmallShake({ intensity = 5, duration = 100 }) {
    if (!domElements.bodyEl) return;
    domElements.bodyEl.style.setProperty('--shake-intensity', `${intensity}px`);
    const animationName = `screenShake-${Date.now()}`;
    domElements.bodyEl.style.animation = `${animationName} ${duration}ms ease-in-out`;
    registerTimeout(() => { // Folosim timeout gestionat
        if (domElements.bodyEl && domElements.bodyEl.style.animation.includes(animationName)) {
            domElements.bodyEl.style.animation = '';
        }
    }, duration);
}

function effect_FlashMsgBox() {
     const msgBox = domElements.messageBox;
     if (!msgBox) return;
     const originalBorderStyle = msgBox.style.border; // Salveaza stilul complet
     msgBox.style.transition = 'all 0.04s ease-in-out';
     const flashColor = `hsl(${getRandomInRange(0, 360)}, 100%, 75%)`;
     msgBox.style.border = `3px dashed ${flashColor}`; // Ajusteaza grosimea/stilul daca vrei
     msgBox.style.transform = 'scale(1.12) rotate(2.5deg)';
     registerTimeout(() => {
         msgBox.style.border = originalBorderStyle || '2px dashed var(--slime-green)'; // Revine la original sau default
         msgBox.style.transform = 'scale(1) rotate(0deg)';
         registerTimeout(() => {
            msgBox.style.border = `3px dashed ${flashColor}`;
            msgBox.style.transform = 'scale(1.12) rotate(-2.5deg)';
            registerTimeout(() => {
                 msgBox.style.border = originalBorderStyle || '2px dashed var(--slime-green)';
                 msgBox.style.transform = 'scale(1) rotate(0deg)';
            }, 40);
         }, 60);
     }, 40);
}

function effect_ChangeElementStyle({ targetId, property, values, valuesKey }) {
    const element = getElement(targetId);
    if (!element) return;
    let valuePool = values || gameData[valuesKey] || [];
     if (valuesKey === 'randomHexColors') {
        valuePool = [getRandomColor(), '#FF1111', '#11FF11', '#1111FF', '#FFFF11', '#FF11FF', '#11FFFF', '#FFFFFF', '#222222', '#FF8800', '#8800FF'];
    } else if (valuesKey === 'buttonTexts') {
         valuePool = ["CLICK", "WHY?", "ROT", "BRAIN", "???", "YES", "NO", "GO", "STOP", "HELP", "MORE", "LESS", "404", "SKIBIDI", "SIGMA", "SIGN?", "OHIO", "EXPLODE?", "FAKE?", "FONT?", "COLOR?", "{word}"];
     } else if (valuesKey === 'fonts') {
         valuePool = gameData.fonts || [];
     }

    let randomValue = getRandomElement(valuePool);
    if (typeof randomValue === 'string' && randomValue.includes('{word}')) {
        randomValue = randomValue.replace('{word}', getRandomWord().toUpperCase());
    }

    if (randomValue !== null) {
        updateConsole(`   -> Setting ${element.id || element.tagName} ${property} to ${randomValue}`);
        element.style[property] = randomValue;
    }
}
// ... !!! Adaugă definițiile COMPLETE pentru TOATE celelalte funcții effect_... AICI !!! ...
// (effect_RandomSound, effect_ChangeCursor, effect_SingleEmoji, effect_EmojiRain,
//  effect_CrazyButton, effect_ChangeBgColor, effect_ScrambleText, effect_DistortElement,
//  effect_ShiftElementLayout, effect_WordSalad, effect_PlayMemeSound, etc...)
// Asigură-te că folosești `registerTimeout` în loc de `setTimeout` unde e cazul.


// --- Funcția Principală de Declanșare Efecte ---
function triggerRandomEffects() {
    cleanupPersistentEffects(); // Curăță întâi

    const settings = effectConfig.effectSettings || {};
    const minEffects = settings.minEffectsPerClick || 3;
    const maxEffects = settings.maxEffectsPerClick || 9;
    const numEffects = getRandomIntInRange(minEffects, maxEffects);

    updateConsole(`>> Triggering ${numEffects} BRAIN ROT effect(s)... (Click ${clickCount})`);

    const triggeredNames = new Set();
    const allEffects = effectConfig.effects || {};
    const effectNames = Object.keys(allEffects);
    if (effectNames.length === 0) {
        updateConsole(">> ERROR: No effects defined in config!");
        return;
    }
    const totalWeight = effectNames.reduce((sum, name) => sum + (allEffects[name].weight || 0), 0);
    if (totalWeight <= 0) {
         updateConsole(">> ERROR: Total effect weight is zero!");
         return; // Evita impartirea la zero sau bucla infinita
    }


    const disruptiveEffects = settings.disruptiveEffects || [];
    const popupEffects = settings.popupEffects || [];

    let effectsToTrigger = []; // Stochează efectele alese

    for (let i = 0; i < numEffects; i++) {
        let chosenEffectName = null;
        let attempts = 0;
        const MAX_PICK_ATTEMPTS = 20; // Mărit numărul de încercări

        while (!chosenEffectName && attempts < MAX_PICK_ATTEMPTS) {
            attempts++;
            let rand = Math.random() * totalWeight;
            let cumulativeWeight = 0;
            let candidateName = null;

            for (const name of effectNames) {
                cumulativeWeight += (allEffects[name].weight || 0);
                if (rand <= cumulativeWeight) { // Folosim <= pentru a include si ultima sansa
                    candidateName = name;
                    break;
                }
            }
             if (!candidateName) candidateName = getRandomElement(effectNames); // Fallback mai robust

            const candidateEffect = allEffects[candidateName];
            if (!candidateEffect) continue;

            // --- Verificare Cooldown ---
            const cooldownKey = candidateEffect.cooldownKey;
            const cooldownDuration = cooldownKey ? (settings[cooldownKey] || settings.defaultCooldown || 0) : (candidateEffect.cooldown || settings.defaultCooldown || 0);
            let isOnCooldown = false;
            if (cooldownDuration > 0 && effectCooldowns[candidateName]) {
                const clicksSinceLast = clickCount - effectCooldowns[candidateName];
                if (clicksSinceLast < cooldownDuration) isOnCooldown = true;
            }
            if (isOnCooldown) continue; // Sari la următoarea încercare

            // --- Verificare Repetitie / Stacking ---
            const isDisruptive = disruptiveEffects.includes(candidateName);
            const isPopup = popupEffects.includes(candidateName);
            const isFilter = !!candidateEffect.filterClass;

            // Verifica daca efectul (sau unul similar disruptiv/popup) e deja in *lista curenta* de declansat
            let alreadyTriggeredThisBurst = false;
            effectsToTrigger.forEach(effName => {
                 if (effName === candidateName) alreadyTriggeredThisBurst = true;
                 if (isDisruptive && disruptiveEffects.includes(effName)) alreadyTriggeredThisBurst = true; // Evita 2 disruptive diferite
                 if (isPopup && popupEffects.includes(effName)) alreadyTriggeredThisBurst = true; // Evita 2 popupuri diferite
                 if (isFilter && allEffects[effName]?.filterClass) alreadyTriggeredThisBurst = true; // Evita 2 filtre diferite
             });

             // Verifica si elementele active din DOM (pentru popup-uri)
             const popupActiveDOM = isPopup && (document.querySelector('.fake-error.visible') || document.querySelector('.fake-warning-popup.visible'));

            // Sanse mari sa sarim peste duplicate disruptive/popup/filter in acelasi burst
            if (alreadyTriggeredThisBurst && Math.random() < 0.85) continue;
            if (popupActiveDOM) continue; // Nu adauga popup daca unul e deja vizibil

            // Daca a trecut toate verificarile
            chosenEffectName = candidateName;

        } // End while

        if (chosenEffectName) {
            effectsToTrigger.push(chosenEffectName); // Adauga in lista de executat
        } else {
            // updateConsole(` -> Failed to pick valid effect ${i+1}/${numEffects}, skipping slot.`);
        }

    } // End for (selectare efecte)

    // --- Executa Efectele Alese ---
     updateConsole(` -> Executing: ${effectsToTrigger.join(', ') || 'None'}`);
     effectsToTrigger.forEach((effectName, index) => {
         const effectData = allEffects[effectName];
         const functionName = `effect_${effectName}`; // Numele funcției JS corespunzătoare

         // Verifică dacă funcția există
         if (typeof window[functionName] === 'function') {
            // Construieste parametrii din config JSON
            let params = {};
            if (effectData.params) {
                 Object.keys(effectData.params).forEach(key => {
                     const value = effectData.params[key];
                     if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number') {
                        params[key] = getRandomInRange(value[0], value[1]); // Range numeric
                     } else if (Array.isArray(value)) {
                        params[key] = getRandomElement(value); // Array de opțiuni
                     } else {
                        params[key] = value; // Valoare literală
                     }
                 });
             }
             // Adauga target/targets/filterClass/etc direct din obiectul effectData
             ['target', 'targets', 'filterClass', 'count'].forEach(prop => {
                 if(effectData[prop]) params[prop] = effectData[prop];
             });
             // Ajustează count dacă e range
             if (params.count && Array.isArray(params.count)) {
                 params.count = getRandomIntInRange(params.count[0], params.count[1]);
             }

             // Execută funcția
             try {
                 // Introdu o mică întârziere variabilă între efecte pentru a nu fi toate perfect sincrone
                 registerTimeout(() => {
                     window[functionName](params);
                     // Setează cooldown DUPĂ execuție
                     const cooldownKey = effectData.cooldownKey;
                     const cooldownDuration = cooldownKey ? (settings[cooldownKey] || settings.defaultCooldown || 0) : (effectData.cooldown || settings.defaultCooldown || 0);
                     if (cooldownDuration > 0) {
                         effectCooldowns[effectName] = clickCount;
                     }
                 }, index * getRandomIntInRange(10, 50)); // Stagger

             } catch (e) {
                 updateConsole(`>> ERROR executing effect ${effectName}: ${e.message}`);
                 console.error(`Effect Error (${effectName}):`, e);
             }
         } else {
             updateConsole(`>> WARNING: Effect function ${functionName} not found!`);
         }
     });

    addScore(1); // Adaugă scorul de bază
}


// --- Funcția de Curățare ---
function cleanupPersistentEffects() {
    updateConsole(">> Cleaning up previous persistent effects...");
    clearAllActiveTimeouts(); // Anulează timeout-urile vechi neexecutate

    // Filtre Body
    const filterClasses = ['filter-invert', 'filter-blur', 'filter-sepia', 'filter-contrast', 'filter-hue', 'filter-pixelate', 'bg-flicker'];
    filterClasses.forEach(cls => domElements.bodyEl?.classList.remove(cls));
    if (domElements.bodyEl) domElements.bodyEl.style.backgroundImage = '';

    // Transformări și Efecte Vizuale Elemente
    const transformTargets = [domElements.titleEl, domElements.doNotClickBtn, domElements.alienImage, domElements.messageBox, domElements.scoreDisplay, domElements.createSignBtn, domElements.galleryBtn, domElements.consoleOutput, domElements.crazyTextEl, domElements.centerStage, domElements.realOptions];
    transformTargets.forEach(el => {
        if (el) {
            el.classList.remove('glitch-effect', 'element-distorted', 'layout-shifted');
            if(el.style.transform) el.style.transform = ''; // Reset doar daca a fost setat inline
        }
    });

    // Elemente Ascunse
    document.querySelectorAll('.hidden-by-chaos').forEach(el => {
        el.classList.remove('hidden-by-chaos');
    });

    // Stiluri Specifice Text/Border (Resetare simplificată)
    const styledElements = [domElements.messageBox, domElements.consoleOutput, domElements.titleEl];
     styledElements.forEach(el => {
        if(el) {
            el.classList.remove('border-style-random', 'text-spacing-wide', 'text-spacing-narrow', 'text-reversed', 'text-weird-case');
            // Reseteaza stilurile inline adaugate de aceste clase daca e necesar
            el.style.removeProperty('--random-border-style');
            el.style.removeProperty('--random-border-width');
            el.style.removeProperty('--random-border-color');
            if (el.style.letterSpacing) el.style.letterSpacing = '';
            if (el.style.wordSpacing) el.style.wordSpacing = '';
            if (el.style.direction) el.style.direction = '';
            if (el.style.unicodeBidi) el.style.unicodeBidi = '';
            // Resetare font/stil mesaj box daca a fost modificat specific
            if (el === domElements.messageBox && el.style.fontFamily !== "'Roboto', sans-serif") {
                el.style.fontFamily = "'Roboto', sans-serif";
                el.style.fontStyle = 'italic';
                el.style.fontWeight = 'normal';
                el.style.color = 'var(--dumb-pink)';
                el.style.border = '2px dashed var(--slime-green)';
                 updateConsole("   - Resetting msgBox specific styles");
            }
        }
     });

    // Cursor
    if (domElements.bodyEl && domElements.bodyEl.style.cursor !== 'auto' && domElements.bodyEl.style.cursor !== '') {
        domElements.bodyEl.style.cursor = 'auto';
    }
    // Reset Title/Favicon/Alien (mai rar sau la nevoie)
    if (document.title !== originalTitle && Math.random() < 0.1) document.title = originalTitle;
    if (domElements.favicon && domElements.favicon.href !== originalFaviconHref && Math.random() < 0.15) domElements.favicon.href = originalFaviconHref;
    if (domElements.alienImage && domElements.alienImage.src !== originalAlienSrc && Math.random() < 0.3) domElements.alienImage.src = originalAlienSrc;

    // Elimină elementele dinamice create
    document.querySelectorAll('.fake-error, .fake-warning-popup, .crazy-spawned-button, .fake-status-text, .fake-spinner, .dynamic-text-item').forEach(el => el.remove());
    // Reset Variabile CSS (rar)
     if (Math.random() < 0.03) {
         updateConsole("   - Resetting all CSS color variables (rare chance)");
         if(domElements.rootEl) domElements.rootEl.style.cssText = '';
     }
}


// --- Setare Event Listeneri ---
function setupEventListeners() {
    // Butonul Principal
    domElements.doNotClickBtn?.addEventListener("click", () => {
        initAudioContext();
        clickCount++;
        if (clickCount < MAX_CLICKS_BEFORE_UNLOCK) {
            updateConsole(`>> Button clicked ${clickCount} times (Initial Phase)`);
            if(domElements.messageBox) domElements.messageBox.innerText = gameData.phrases?.[clickCount - 1] || "Keep Clicking...";
            playSimpleSound({ frequency: 200 + clickCount * 60, duration: 0.06, type: 'triangle' });
            if (clickCount > 1 && typeof effect_FlashMsgBox === 'function') effect_FlashMsgBox();
            if (clickCount > 2 && typeof effect_SmallShake === 'function') effect_SmallShake({intensity: clickCount * 1.5, duration: clickCount * 30});
        } else if (clickCount === MAX_CLICKS_BEFORE_UNLOCK) {
            updateConsole(">> THRESHOLD REACHED! Unlocking options...");
            if(domElements.messageBox) domElements.messageBox.innerText = gameData.phrases?.[MAX_CLICKS_BEFORE_UNLOCK - 1] || "IT HAPPENED!";
            if(domElements.realOptions) domElements.realOptions.style.display = "block";
            if(domElements.doNotClickBtn) {
                 domElements.doNotClickBtn.innerText = "KEEP CLICKING?";
                 domElements.doNotClickBtn.style.animation = 'none';
                 void domElements.doNotClickBtn.offsetWidth;
                 domElements.doNotClickBtn.style.animation = 'shake 0.04s infinite alternate';
            }
            if(domElements.scoreDisplay) domElements.scoreDisplay.classList.add('visible');
            updateScoreDisplay();
            updateConsole(">> MAXIMUM BRAIN ROT ENGAGED! SCORE ONLINE! OPTIONS AVAILABLE!");
            console.warn("Chaos Mode Activated!");
            playSimpleSound({ frequency: 1400, duration: 0.6, type: 'sawtooth', volume: 0.7 });
            if (typeof effect_SmallShake === 'function') effect_SmallShake({intensity: 25, duration: 600});
            if (typeof effect_FlashMsgBox === 'function') effect_FlashMsgBox();
            if (typeof effect_ChangeBgColor === 'function') effect_ChangeBgColor();
            if (typeof effect_SingleEmoji === 'function') effect_SingleEmoji({count: 2});
        } else {
            updateConsole(` `); // Linie goală
            if (typeof triggerRandomEffects === 'function') triggerRandomEffects(); // Declanseaza haosul
        }
    });

    // Butoane Navigare (din pagina haotică)
    domElements.createSignBtn?.addEventListener("click", () => {
        updateConsole(">> Navigating to Create Sign section...");
        playSimpleSound({ frequency: 800, duration: 0.1, type: 'sine', volume: 0.4 });
        window.location.href = 'create-sign/index.html'; // Navigare
    });
    domElements.galleryBtn?.addEventListener("click", () => { // Butonul "Choose Sign"
        updateConsole(">> Navigating to Choose Sign section...");
        playSimpleSound({ frequency: 700, duration: 0.1, type: 'square', volume: 0.3 });
        window.location.href = 'choose-sign/index.html'; // Navigare
    });

    // Listeneri Modal Suport
    domElements.attribution?.addEventListener('click', openSupportModal);
    domElements.closeModalBtn?.addEventListener('click', closeSupportModal);
    domElements.supportModalOverlay?.addEventListener('click', (event) => {
        if (event.target === domElements.supportModalOverlay) closeSupportModal();
    });
    domElements.twitterShareButton?.addEventListener('click', (e) => { // Folosim click ca sa nu deschida link gol daca JS esueaza
        e.preventDefault(); // Previne navigarea default
        const targetUrl = domElements.twitterShareButton.href;
        if(targetUrl && targetUrl !== '#') {
            window.open(targetUrl, '_blank');
            updateConsole(">> Opened X share link.");
            playSimpleSound({ frequency: 900, duration: 0.05, type: 'sine', volume: 0.3 });
            // closeSupportModal(); // Optional
        } else {
            console.error("Twitter share URL not set correctly.");
        }
    });
    domElements.buyCoffeeBtn?.addEventListener('click', () => {
        if(domElements.cryptoOptions) domElements.cryptoOptions.style.display = 'block';
        updateConsole(">> Showing crypto donation options.");
        playSimpleSound({ frequency: 750, duration: 0.08, type: 'triangle', volume: 0.3 });
    });
    domElements.solanaBtn?.addEventListener('click', () => displayCryptoAddress('SOL'));
    domElements.ethereumBtn?.addEventListener('click', () => displayCryptoAddress('ETH'));
    domElements.copyAddressBtn?.addEventListener('click', copyAddressToClipboard);
}

// --- Încărcare Asincronă Date ---
async function loadData() {
    try {
        const [dataRes, configRes] = await Promise.all([
            fetch('data.json'), // Cale relativă la rădăcină
            fetch('effects_config.json') // Cale relativă la rădăcină
        ]);
        // Verificare răspunsuri
        if (!dataRes.ok) throw new Error(`Failed to load data.json: ${dataRes.statusText}`);
        if (!configRes.ok) throw new Error(`Failed to load effects_config.json: ${configRes.statusText}`);

        gameData = await dataRes.json();
        effectConfig = await configRes.json();
        updateConsole(">> Game data and effect config loaded.");
        console.log("Loaded Data:", gameData);
        console.log("Loaded Config:", effectConfig);
        return true; // Succes
    } catch (error) {
        updateConsole(`>> FATAL ERROR: Could not load config: ${error.message}`);
        console.error("Load Error:", error);
        // Setări de avarie minime
        gameData = { phrases: ["Click?"], words: ["error"] };
        effectConfig = {
             effectSettings: { minEffectsPerClick: 1, maxEffectsPerClick: 1 },
             effects: { SmallShake: { weight: 1, cooldown: 0, params: {intensity: 5, duration: 100} } }
        };
        return false; // Eșec
    }
}

// --- Inițializare ---
async function init() {
    // Cache DOM elements first
    cacheDOMElements();
    updateConsole(">> System Initializing...");
    updateConsole(">> Loading config and data...");
    const loadedOk = await loadData(); // Incarca JSON
    initAudioContext(); // Init audio dupa interactiune user, dar pregatim contextul
    setupEventListeners(); // Setup listeners
    if (loadedOk) {
         updateConsole(">> System Online. WARNING: HIGH CHANCE OF INCURABLE BRAIN ROT.");
         updateConsole(">> Dimensional Stability: ACTIVELY DETERIORATING.");
         updateConsole(">> Cooldown System: Engaged.");
         updateConsole(">> The Big Red Button whispers sweet nothings... or maybe threats?");
    } else {
         updateConsole(">> SYSTEM FAILED TO LOAD CONFIGURATION. Limited functionality.");
         // Maybe disable the main button or show a permanent error
         if(domElements.doNotClickBtn) domElements.doNotClickBtn.disabled = true;
         if(domElements.messageBox) domElements.messageBox.innerText = "FATAL ERROR LOADING CONFIGURATION FILES!";
    }
    console.log("Page loaded. Abandon hope, all ye who click here.");
}

// Start
document.addEventListener('DOMContentLoaded', init);

// !!! ============================================================ !!!
// !!! ASIGURĂ-TE CĂ ADAUGI DEFINIȚIILE PENTRU TOATE FUNCȚIILE   !!!
// !!! effect_... (ca effect_ChangeCursor, effect_CreateEmoji, etc.) !!!
// !!! ÎN SECȚIUNEA "Efectele Haotice" DE MAI SUS.                  !!!
// !!! ============================================================ !!!
