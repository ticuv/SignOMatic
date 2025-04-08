// --- Global Constants ---
const canvasWidth = 2048;
const canvasHeight = 2048;
// ENSURE KEYS MATCH <option value="..."> EXACTLY
const nftContracts = {
    "GHN": { address: "0xe6d48bf4ee912235398b96e16db6f310c21e82cb", name: "GHN" },
    "AHC": { address: "0x9370045ce37f381500ac7d6802513bb89871e076", name: "AHC" }
};
const nftAbi = ["function tokenURI(uint256 tokenId) public view returns (string)"];
const provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com");
const DEFAULT_FONT_SIZE = 15;
const MIN_FONT_SIZE = 8;
const FONT_SIZE_SENSITIVITY = 0.25;
const SIGNS_JSON_PATH = "signs.json"; // Path relative to index.html

// --- Global State ---
let baseImage = new Image();
let activeElement = null; // For custom mode overlays
let textInteractionState = { isDragging: false, isRotating: false, isResizingWidth: false, isResizingFontSize: false, startX: 0, startY: 0, startLeft: 0, startTop: 0, rotateCenterX: 0, rotateCenterY: 0, rotateStartAngle: 0, startWidth: 0, currentRotationRad: 0, startFontSize: DEFAULT_FONT_SIZE };
let imageInteractionState = { isDragging: false, isRotating: false, isResizing: false, startX: 0, startY: 0, startLeft: 0, startTop: 0, centerX: 0, centerY: 0, startAngle: 0, currentRotationRad: 0, startWidth: 0, startHeight: 0, aspectRatio: 1 };
let currentSignMode = null; // 'prefix' or 'custom'
let signConfigData = null;
let isSignConfigLoading = false;
let selectedSignItem = null; // Track selected sign DOM element in gallery
let appliedPrefixSignImage = null; // Keep track of the currently applied prefix sign Image object

// --- DOM Element References ---
let canvas, ctx, container, textInput, textColor, fontFamily, removeBtn, nftStatusEl,
    nftCollectionSelect, nftTokenIdInput, loadNftBtn, overlayColorInput,
    addTextBtn, addImageBtn, resetCanvasBtn, imageUpload,
    saveFullBtn, // Save button for Custom mode
    signTypeChoiceGroup, signTypePrefixRadio, signTypeCustomRadio,
    prefixOptionsGroup, customOptionsGroup,
    signGalleryContainer, savePrefixBtn, prefixFinalActions;

// --- Initialization ---
window.onload = () => {
    // Get Element References
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    container = document.getElementById("canvas-container");
    textInput = document.getElementById("textInput");
    textColor = document.getElementById("textColor");
    fontFamily = document.getElementById("fontFamily");
    removeBtn = document.getElementById("removeBtn");
    nftStatusEl = document.getElementById("nftStatus");
    nftCollectionSelect = document.getElementById("nftCollection");
    nftTokenIdInput = document.getElementById("nftTokenId");
    loadNftBtn = document.getElementById("loadNftBtn");
    overlayColorInput = document.getElementById("overlayColor");
    addTextBtn = document.getElementById("addTextBtn");
    imageUpload = document.getElementById("imageUpload");
    addImageBtn = document.getElementById("addImageBtn");
    resetCanvasBtn = document.getElementById("resetCanvas");
    saveFullBtn = document.getElementById("saveFullBtn"); // Custom Save
    signTypeChoiceGroup = document.getElementById("sign-type-choice-group");
    signTypePrefixRadio = document.getElementById("signTypePrefix");
    signTypeCustomRadio = document.getElementById("signTypeCustom");
    prefixOptionsGroup = document.getElementById("prefix-options-group");
    customOptionsGroup = document.getElementById("custom-options-group");
    signGalleryContainer = document.getElementById("sign-gallery-container");
    savePrefixBtn = document.getElementById("savePrefixBtn");
    prefixFinalActions = document.getElementById("prefix-final-actions"); // Container for prefix save button

    // Initial Setup
    setControlsDisabled(true);
    loadNftBtn.disabled = false;
    nftCollectionSelect.disabled = false;
    nftTokenIdInput.disabled = false;
    clearCanvas();
    setupEventListeners();
};

// ===========================================================
// MODIFICAT: setupEventListeners CU stopPropagation PENTRU DELETE
// ===========================================================
function setupEventListeners() {
    if (!loadNftBtn) { console.error("Load button not found!"); return; }

    // NFT Loading
    loadNftBtn.addEventListener('click', loadNftToCanvas);
    nftCollectionSelect.addEventListener("change", () => {
        if (baseImage.src && baseImage.complete) {
            if (currentSignMode === 'custom') {
                container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el => el.remove());
                setActiveElement(null);
                applyOverlay(false);
            } else if (currentSignMode === 'prefix') {
                appliedPrefixSignImage = null;
                if (selectedSignItem) {
                    selectedSignItem.classList.remove('selected');
                    selectedSignItem = null;
                }
                drawBaseImage();
                if(savePrefixBtn) savePrefixBtn.disabled = true;
                populateSignGallery();
            }
        }
    });

    // Sign Type Choice
    signTypePrefixRadio.addEventListener('change', () => setSignMode('prefix'));
    signTypeCustomRadio.addEventListener('change', () => setSignMode('custom'));

    // Custom Controls
    overlayColorInput.addEventListener('input', () => { if (currentSignMode === 'custom') applyOverlay(false); });
    addTextBtn.addEventListener('click', addText);
    textInput.addEventListener("input", handleTextControlChange);
    textColor.addEventListener("input", handleTextControlChange);
    fontFamily.addEventListener("input", handleTextControlChange);
    addImageBtn.addEventListener('click', addImage);

    // Atașează listener pentru delete, pasând event-ul
    removeBtn.addEventListener('click', (event) => removeActiveElement(event));

    // General Actions
    resetCanvasBtn.addEventListener('click', handleReset);
    saveFullBtn.addEventListener('click', saveImage); // Custom Save
    savePrefixBtn.addEventListener('click', saveImage); // Prefix Save (uses same function)

     // Deselect active element when clicking outside
     document.addEventListener('click', (event) => {
        const clickedInsideContainer = container.contains(event.target);
        const clickedOnContainerOrCanvas = event.target === container || event.target === canvas;
        const clickedOnButton = event.target.tagName === 'BUTTON' || event.target.closest('button'); // Include elemente din interiorul butonului

        // Condiție principală: NU e click pe buton ȘI (e în afara containerului SAU direct pe container/canvas)
        if (!clickedOnButton && (!clickedInsideContainer || clickedOnContainerOrCanvas)) {
             if (activeElement && currentSignMode === 'custom') {
                 setActiveElement(null);
             }
        // Condiție secundară: NU e click pe buton ȘI e IN container, dar NU pe elementul activ
        } else if (!clickedOnButton && activeElement && !activeElement.contains(event.target)) {
             const clickedOverlay = event.target.closest('.textOverlay, .imgOverlay');
             if (!clickedOverlay && currentSignMode === 'custom') {
                 // Click în container, dar nu pe un overlay
                 setActiveElement(null);
             }
        }
     }, true);
}

// --- Workflow Management ---
function setControlsDisabled(isDisabled) {
    const customControls = [overlayColorInput, textInput, textColor, fontFamily, addTextBtn, imageUpload, addImageBtn, removeBtn, saveFullBtn];
    const signChoiceRadios = [signTypePrefixRadio, signTypeCustomRadio];
    const prefixControls = [savePrefixBtn];

    customControls.forEach(el => { if(el) el.disabled = isDisabled; });
    prefixControls.forEach(el => { if(el) el.disabled = isDisabled; });
    signChoiceRadios.forEach(el => { if(el) el.disabled = isDisabled; });

    if (isDisabled) {
        if(removeBtn) removeBtn.disabled = true;
        if(saveFullBtn) saveFullBtn.disabled = true;
        if(savePrefixBtn) savePrefixBtn.disabled = true;
    }
}

// ===========================================================
// MODIFICAT: setSignMode pentru curățare robustă
// ===========================================================
function setSignMode(mode) {
    // --- Curățare specifică modului ANTERIOR ---
    if (mode === 'prefix' && currentSignMode === 'custom') {
        // La trecerea SPRE prefix, șterge TOATE elementele custom
        container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el => el.remove());
        setActiveElement(null); // Asigură deselectare și update butoane
    } else if (mode === 'custom' && currentSignMode === 'prefix') {
        // La trecerea SPRE custom, șterge starea semnului din galerie
        appliedPrefixSignImage = null;
        if (selectedSignItem) {
            selectedSignItem.classList.remove('selected');
            selectedSignItem = null;
        }
        // Redesenează doar baza (overlay-ul custom se va aplica mai jos dacă e cazul)
        if (baseImage.src && baseImage.complete) drawBaseImage();
    }

    // --- Setează noul mod și UI general ---
    currentSignMode = mode;
    nftStatusEl.textContent = `Mode selected: ${mode === 'prefix' ? 'Signs Gallery' : 'Custom Sign'}.`;
    nftStatusEl.className = '';

    prefixOptionsGroup.classList.toggle('hidden', mode !== 'prefix');
    customOptionsGroup.classList.toggle('hidden', mode !== 'custom');

    setControlsDisabled(true); // Dezactivează tot inițial
    signTypePrefixRadio.disabled = false; // Reactivează doar radio-urile
    signTypeCustomRadio.disabled = false;

    // --- Activează controalele pentru noul mod ---
    if (mode === 'prefix') {
         if (baseImage.src && baseImage.complete) {
             // Restore applied sign view if it exists (poate a revenit la prefix)
             if(appliedPrefixSignImage && appliedPrefixSignImage.complete) {
                 drawBaseImage();
                 ctx.drawImage(appliedPrefixSignImage, 0, 0, canvasWidth, canvasHeight);
                 if(savePrefixBtn) savePrefixBtn.disabled = false;
             } else {
                 drawBaseImage();
                 if(savePrefixBtn) savePrefixBtn.disabled = true;
             }
             populateSignGallery();
         } else {
             if(signGalleryContainer) signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--error-red);">Load NFT first.</p>';
             if(savePrefixBtn) savePrefixBtn.disabled = true;
         }
    } else if (mode === 'custom') {
         if (baseImage.src && baseImage.complete) {
            const customEditControls = [overlayColorInput, textInput, textColor, fontFamily, addTextBtn, imageUpload, addImageBtn];
            customEditControls.forEach(el => { if(el) el.disabled = false; });
            applyOverlay(false); // Redesenează baza + polygonul colorat
            // Butoanele de acțiune (delete/save) sunt actualizate de updateCustomActionButtons
         }
         // Actualizează întotdeauna starea butoanelor custom la intrarea în mod
         updateCustomActionButtons();
    }

    // Asigură-te că starea butoanelor non-active este corectă
     if (mode !== 'custom') { updateCustomActionButtons(); } // Dezactivează butoanele custom
     if (mode !== 'prefix') { if(savePrefixBtn) savePrefixBtn.disabled = true; } // Dezactivează butonul prefix
}

// Funcția actualizează TOATE butoanele de acțiune în funcție de mod și stare
function updateCustomActionButtons() {
    const isImageLoaded = baseImage.src !== "" && baseImage.complete && baseImage.naturalWidth > 0;
    const isElementActive = activeElement !== null && container.contains(activeElement);

    // Butoane CUSTOM
    const enableRemove = currentSignMode === 'custom' && isImageLoaded && isElementActive;
    const enableSaveFullCustom = currentSignMode === 'custom' && isImageLoaded;
    if (removeBtn) removeBtn.disabled = !enableRemove;
    if (saveFullBtn) saveFullBtn.disabled = !enableSaveFullCustom;

    // Buton PREFIX
    const enableSavePrefix = currentSignMode === 'prefix' && isImageLoaded && appliedPrefixSignImage;
    if (savePrefixBtn) savePrefixBtn.disabled = !enableSavePrefix;
}


// --- Event Handlers ---
function handleTextControlChange() {
    if (activeElement && activeElement.classList.contains('textOverlay') && currentSignMode === 'custom') {
        let textNode = activeElement.childNodes[0];
         while (textNode && textNode.nodeType !== Node.TEXT_NODE) { textNode = textNode.nextSibling; }

        if (textNode) {
            textNode.nodeValue = textInput.value || " ";
        } else {
             activeElement.insertBefore(document.createTextNode(textInput.value || " "), activeElement.querySelector('.handle'));
        }
        activeElement.style.color = textColor.value;
        activeElement.style.fontFamily = fontFamily.value;

        requestAnimationFrame(() => {
             if(activeElement && activeElement.classList.contains('textOverlay') && container.contains(activeElement)) {
                 const originalWidthStyle = activeElement.style.width;
                 const hadManualWidth = originalWidthStyle && originalWidthStyle !== 'auto';
                 activeElement.style.width = 'auto';
                 const naturalWidth = activeElement.offsetWidth;
                 activeElement.style.width = hadManualWidth ? originalWidthStyle : `${Math.max(30, naturalWidth)}px`;
             }
         });
    }
}

function handleReset() {
    if (confirm("Are you sure you want to clear the canvas and all added elements/signs? This cannot be undone.")) {
        clearCanvasAndOverlays();
        appliedPrefixSignImage = null;
        if (selectedSignItem) {
            selectedSignItem.classList.remove('selected');
            selectedSignItem = null;
        }
        if (textInput) textInput.value = '';
        if (imageUpload) imageUpload.value = '';

        if (baseImage.src && baseImage.complete && baseImage.naturalWidth > 0) {
            drawBaseImage();
            signTypeChoiceGroup.classList.remove('hidden');
            signTypePrefixRadio.disabled = false; signTypeCustomRadio.disabled = false;
            signTypePrefixRadio.checked = false; signTypeCustomRadio.checked = false;
            prefixOptionsGroup.classList.add('hidden'); customOptionsGroup.classList.add('hidden');
            currentSignMode = null;
            setControlsDisabled(true);
            signTypePrefixRadio.disabled = false; signTypeCustomRadio.disabled = false;
            nftStatusEl.textContent = "Canvas reset. Choose sign type."; nftStatusEl.className = '';
            if(signGalleryContainer) signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--portal-blue);">Loading gallery...</p>';
            if (!signConfigData) fetchSignConfig();

        } else {
            enableNftLoadControlsOnly();
            nftStatusEl.textContent = "Select collection and ID, then load NFT."; nftStatusEl.className = '';
        }
         // Asigură-te că butoanele sunt dezactivate după reset
         updateCustomActionButtons();
    }
}

// --- Canvas & Overlay Management ---
function clearCanvasAndOverlays() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el => el.remove());
    setActiveElement(null); // Important: this also calls updateCustomActionButtons
}
function clearCanvas() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}
function enableNftLoadControlsOnly() {
    setControlsDisabled(true);
    if(loadNftBtn) loadNftBtn.disabled = false;
    if(nftCollectionSelect) nftCollectionSelect.disabled = false;
    if(nftTokenIdInput) nftTokenIdInput.disabled = false;
    if(signTypeChoiceGroup) signTypeChoiceGroup.classList.add('hidden');
    if(prefixOptionsGroup) prefixOptionsGroup.classList.add('hidden');
    if(customOptionsGroup) customOptionsGroup.classList.add('hidden');
    currentSignMode = null;
    // Ensure buttons are disabled
    updateCustomActionButtons();
}

// --- NFT Loading & Drawing --- (Neschimbat - presupunem că e ok)
function getPolygonForSelectedCollection(){ const selectedCollection=nftCollectionSelect.value; if(selectedCollection==="AHC"){return[{x:1415,y:316},{x:2024,y:358},{x:1958,y:1324},{x:1358,y:1286}];}else{/* GHN default */ return[{x:1403,y:196},{x:2034,y:218},{x:1968,y:1164},{x:1358,y:1126}];} }
function resolveIpfsUrl(url) { if(url&&url.startsWith("ipfs://")){ return url.replace("ipfs://","https://ipfs.io/ipfs/"); } return url; }
async function loadNftToCanvas() { /* ... codul tău existent ... */
    const selectedCollection = nftCollectionSelect.value;
    const tokenId = nftTokenIdInput.value;
    if (!tokenId || parseInt(tokenId) < 0) { // Added check for negative ID
         nftStatusEl.textContent = "Please enter a valid, non-negative Token ID."; nftStatusEl.className = 'error'; return;
    }
    if (!nftContracts[selectedCollection]) { console.error(`Selected collection "${selectedCollection}" not found.`); nftStatusEl.textContent = `Error: Collection definition "${selectedCollection}" not found.`; nftStatusEl.className = 'error'; return; }

    clearCanvasAndOverlays();
    appliedPrefixSignImage = null;
    if (selectedSignItem) { selectedSignItem.classList.remove('selected'); selectedSignItem = null; }
    baseImage = new Image();

    loadNftBtn.disabled = true; nftCollectionSelect.disabled = true; nftTokenIdInput.disabled = true;
    setControlsDisabled(true);
    signTypeChoiceGroup.classList.add('hidden'); prefixOptionsGroup.classList.add('hidden'); customOptionsGroup.classList.add('hidden');
    nftStatusEl.textContent = `Loading ${nftContracts[selectedCollection].name} #${tokenId}...`; nftStatusEl.className = '';
    clearCanvas();

    const contractInfo = nftContracts[selectedCollection];
    const contract = new ethers.Contract(contractInfo.address, nftAbi, provider);
    try {
        let tokenURI;
        try {
            tokenURI = await contract.tokenURI(tokenId);
        } catch (contractError) {
            console.error(`Contract error fetching URI for ${tokenId}:`, contractError);
            if (contractError.message?.includes('invalid token ID') || contractError.message?.includes('URI query for nonexistent token')) {
                throw new Error(`Token ID ${tokenId} invalid or does not exist for ${contractInfo.name}.`);
            } else if (contractError.code === 'CALL_EXCEPTION') {
                 throw new Error(`Contract call failed. Check network/address or if Token ID ${tokenId} exists.`);
            }
            throw contractError;
        }
        tokenURI = resolveIpfsUrl(tokenURI);
        if (!tokenURI) throw new Error("Received empty Token URI from contract.");

        nftStatusEl.textContent = "Fetching metadata...";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const response = await fetch(tokenURI, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Metadata fetch error: ${response.status} ${response.statusText} (URL: ${tokenURI.substring(0, 100)}...)`);
        const metadata = await response.json();

        let imageUrl = resolveIpfsUrl(metadata.image || metadata.image_url || metadata.imageUrl || metadata.uri);
        if (!imageUrl) throw new Error("Image URL missing in metadata");
         if (imageUrl.startsWith('http') && !imageUrl.match(/\.(jpeg|jpg|gif|png|svg|webp)$/i)) {
            try {
                nftStatusEl.textContent = "Fetching secondary metadata...";
                const imgJsonResponse = await fetch(imageUrl);
                if (!imgJsonResponse.ok) throw new Error(`Secondary metadata fetch failed: ${imgJsonResponse.status}`);
                const imgJson = await imgJsonResponse.json();
                imageUrl = resolveIpfsUrl(imgJson.image || imgJson.image_url || imgJson.imageUrl || imgJson.uri);
                 if (!imageUrl) throw new Error("Image URL missing in secondary metadata");
            } catch (nestedError) {
                 console.error("Error fetching secondary metadata:", nestedError);
                 throw new Error("Failed to resolve image URL from nested metadata.");
            }
         }


        nftStatusEl.textContent = "Loading image...";
        baseImage = new Image();
        baseImage.crossOrigin = "Anonymous";

        baseImage.onload = () => {
            nftStatusEl.textContent = "Drawing image...";
            drawBaseImage();
            nftStatusEl.textContent = `${nftContracts[selectedCollection].name} #${tokenId} loaded! Choose sign type below.`;
            nftStatusEl.className = 'success';
            signTypeChoiceGroup.classList.remove('hidden');
            signTypePrefixRadio.disabled = false; signTypeCustomRadio.disabled = false;
            signTypePrefixRadio.checked = false; signTypeCustomRadio.checked = false;
            currentSignMode = null;
            loadNftBtn.disabled = false; nftCollectionSelect.disabled = false; nftTokenIdInput.disabled = false;
            if (!signConfigData) fetchSignConfig();
            // Update buttons state now that image is loaded
            updateCustomActionButtons();
        };
        baseImage.onerror = (err) => {
             console.error("Error loading NFT image:", err, "Attempted URL:", imageUrl);
             nftStatusEl.textContent = `Error loading image. Check console. (URL: ${imageUrl.substring(0,100)}...)`;
             nftStatusEl.className = 'error';
             enableNftLoadControlsOnly();
             ctx.fillStyle = "white"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("Image Load Error", canvasWidth / 2, canvasHeight / 2);
        };
        baseImage.src = imageUrl;

    } catch (err) {
         console.error(`Error processing NFT ${tokenId}:`, err);
         let errorMsg = "Error: " + err.message;
         if (err.name === 'AbortError') { errorMsg = "Error: Request timed out."; }
         nftStatusEl.textContent = errorMsg;
         nftStatusEl.className = 'error';
         enableNftLoadControlsOnly();
         ctx.fillStyle = "white"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("NFT Load Error", canvasWidth / 2, canvasHeight / 2);
    }
}
function drawBaseImage() { /* ... codul tău existent ... */
    if(!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) {
        console.warn("drawBaseImage called with incomplete or invalid image.");
        clearCanvas(); // Ensure canvas is clear if image is bad
        return;
    }
    ctx.clearRect(0,0,canvasWidth,canvasHeight);
    ctx.fillStyle="#444"; // Background color for letterboxing
    ctx.fillRect(0,0,canvasWidth,canvasHeight);

    const canvasAspect = canvasWidth / canvasHeight;
    const imageAspect = baseImage.naturalWidth / baseImage.naturalHeight;

    let drawWidth, drawHeight, x, y;

    if (imageAspect > canvasAspect) {
        drawWidth = canvasWidth;
        drawHeight = drawWidth / imageAspect;
        x = 0;
        y = (canvasHeight - drawHeight) / 2;
    } else {
        drawHeight = canvasHeight;
        drawWidth = drawHeight * imageAspect;
        y = 0;
        x = (canvasWidth - drawWidth) / 2;
    }

    try {
        ctx.drawImage(baseImage, x, y, drawWidth, drawHeight);
    } catch(e) {
        console.error("Error drawing base image:", e);
        nftStatusEl.textContent="Error drawing NFT image.";
        nftStatusEl.className='error';
        ctx.fillStyle = "red"; ctx.font = "30px Arial"; ctx.textAlign = "center";
        ctx.fillText("Draw Error", canvasWidth / 2, canvasHeight / 2);
    }
}
function applyOverlay(clearExistingOverlays = true) { /* ... codul tău existent ... */
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0 || currentSignMode !== 'custom') return;
    drawBaseImage();
    drawSignPolygonOnly();
}
function drawSignPolygonOnly() { /* ... codul tău existent ... */
    if (currentSignMode !== 'custom' || !baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) return;

    const color = overlayColorInput.value;
    const currentPolygon = getPolygonForSelectedCollection();
    if (!currentPolygon || currentPolygon.length < 3) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(currentPolygon[0].x, currentPolygon[0].y);
    for (let i = 1; i < currentPolygon.length; i++) {
        ctx.lineTo(currentPolygon[i].x, currentPolygon[i].y);
    }
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineJoin = "round";
    ctx.lineWidth = 14;
    ctx.strokeStyle = "black";
    ctx.stroke();
    ctx.restore();
}

// --- Sign Gallery Functions --- (Neschimbat - presupunem că e ok)
async function fetchSignConfig() { /* ... codul tău existent ... */
    if (signConfigData || isSignConfigLoading) return signConfigData;
    isSignConfigLoading = true;
    const configUrl = SIGNS_JSON_PATH;
    try {
        nftStatusEl.textContent = "Loading sign gallery configuration..."; nftStatusEl.className = '';
        const response = await fetch(configUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} fetching ${configUrl}`);
        signConfigData = await response.json();
        if (!signConfigData.githubUser || !signConfigData.githubRepo || !signConfigData.githubBranch || !signConfigData.imageBasePath || typeof signConfigData.categories !== 'object') {
            throw new Error("Invalid signs.json structure.");
        }
        nftStatusEl.textContent = "Sign gallery configuration loaded."; nftStatusEl.className = 'success';
        if (currentSignMode === 'prefix') populateSignGallery();
        return signConfigData;
    } catch (error) {
        console.error("Error fetching/parsing sign config:", error);
        nftStatusEl.textContent = `Error loading sign gallery: ${error.message}. Check console.`; nftStatusEl.className = 'error';
        if (signGalleryContainer) signGalleryContainer.innerHTML = `<p style="color: var(--error-red);">Error loading signs config. Check console.</p>`;
        signConfigData = null;
        return null;
    } finally {
        isSignConfigLoading = false;
    }
}
function populateSignGallery() { /* ... codul tău existent ... */
    if (!signGalleryContainer) return;

    if (isSignConfigLoading) { signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--portal-blue);">Loading gallery config...</p>'; return; }
    if (!signConfigData) {
        fetchSignConfig().then(config => {
            if (config) {
                populateSignGallery();
            } else {
                signGalleryContainer.innerHTML = '<p style="color: var(--error-red);">Failed to load gallery config.</p>';
            }
        });
        signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--portal-blue);">Fetching gallery config...</p>';
        return;
    }
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) {
        signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--error-red);">Load NFT first.</p>';
        return;
    }

    const currentCollectionKey = nftCollectionSelect.value;
    const signsForCollection = signConfigData.categories[currentCollectionKey];
    signGalleryContainer.innerHTML = '';

    if (!signsForCollection || !Array.isArray(signsForCollection) || signsForCollection.length === 0) {
        signGalleryContainer.innerHTML = `<p style="font-style: italic;">No specific signs found for ${nftContracts[currentCollectionKey]?.name || currentCollectionKey}.</p>`;
        return;
    }

    const { githubUser, githubRepo, githubBranch, imageBasePath } = signConfigData;
    const baseUrl = `https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${githubBranch}/${imageBasePath}/`;

    signsForCollection.forEach(sign => {
        if (!sign.fileName) {
            console.warn("Skipping sign entry with missing fileName:", sign);
            return;
        }
        const signImageUrl = baseUrl + sign.fileName;
        const signName = sign.name || sign.fileName.split('/').pop().split('.')[0];

        const itemDiv = document.createElement('div');
        itemDiv.className = 'sign-item';
        itemDiv.title = `Apply: ${signName}`;
        itemDiv.dataset.imageUrl = signImageUrl;
        itemDiv.dataset.signName = signName;

        const img = document.createElement('img');
        img.src = signImageUrl;
        img.alt = signName;
        img.loading = "lazy";
        img.onerror = () => {
             img.alt = `${signName} (Load Error)`;
             img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 40'%3E%3Crect width='50' height='40' fill='%23555'/%3E%3Ctext x='50%' y='50%' fill='red' font-size='9' dominant-baseline='middle' text-anchor='middle'%3EError%3C/text%3E%3C/svg%3E";
             itemDiv.style.borderColor = 'var(--error-red)';
             console.warn(`Failed to load sign image: ${signImageUrl}`);
        };
        const nameSpan = document.createElement('span');
        nameSpan.textContent = signName;

        itemDiv.appendChild(img);
        itemDiv.appendChild(nameSpan);

        itemDiv.addEventListener('click', () => {
            if (currentSignMode !== 'prefix') return;
            const clickedImageUrl = itemDiv.dataset.imageUrl;
            const clickedSignName = itemDiv.dataset.signName;

            if (selectedSignItem && selectedSignItem !== itemDiv) {
                selectedSignItem.classList.remove('selected');
            }

            if (selectedSignItem === itemDiv) {
                itemDiv.classList.remove('selected');
                selectedSignItem = null;
                appliedPrefixSignImage = null;
                if(baseImage.src && baseImage.complete) drawBaseImage();
                if(savePrefixBtn) savePrefixBtn.disabled = true;
                nftStatusEl.textContent = "Sign removed."; nftStatusEl.className = '';
            } else {
                itemDiv.classList.add('selected');
                selectedSignItem = itemDiv;
                applyPrefixSign(clickedImageUrl, clickedSignName);
            }
        });
        signGalleryContainer.appendChild(itemDiv);

        if (appliedPrefixSignImage && appliedPrefixSignImage.src === signImageUrl) {
            itemDiv.classList.add('selected');
            selectedSignItem = itemDiv;
             if (savePrefixBtn && baseImage.complete && baseImage.naturalWidth > 0) {
                savePrefixBtn.disabled = false;
             }
        }
    });
     updateCustomActionButtons();
}
function applyPrefixSign(signImageUrl, signName) { /* ... codul tău existent ... */
    if (!baseImage.src || !baseImage.complete || currentSignMode !== 'prefix') return;
    nftStatusEl.textContent = `Applying sign: ${signName}...`; nftStatusEl.className = '';
    if(savePrefixBtn) savePrefixBtn.disabled = true;
    if (container.querySelectorAll('.textOverlay, .imgOverlay').length > 0) {
        container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el => el.remove());
        setActiveElement(null);
    }

    const signImage = new Image();
    signImage.crossOrigin = "Anonymous";
    signImage.onload = () => {
        drawBaseImage();
        ctx.drawImage(signImage, 0, 0, canvasWidth, canvasHeight);
        appliedPrefixSignImage = signImage;
        appliedPrefixSignImage.alt = signName;
        nftStatusEl.textContent = `Sign '${signName}' applied. Ready to save.`;
        nftStatusEl.className = 'success';
        if(savePrefixBtn) savePrefixBtn.disabled = false;
    };
    signImage.onerror = () => {
        console.error(`Error loading sign image: ${signImageUrl}`);
        nftStatusEl.textContent = `Error loading sign: ${signName}. Check console.`;
        nftStatusEl.className = 'error';
        appliedPrefixSignImage = null;
        if (selectedSignItem && selectedSignItem.dataset.imageUrl === signImageUrl) {
            selectedSignItem.classList.remove('selected');
            selectedSignItem = null;
        }
        drawBaseImage();
        if(savePrefixBtn) savePrefixBtn.disabled = true;
    };
    signImage.src = signImageUrl;
}

// --- Text & Image Creation (Custom Mode) --- (Neschimbat - presupunem că e ok)
function addText() { /* ... codul tău existent ... */
    if (currentSignMode !== 'custom') { nftStatusEl.textContent = "Switch to Custom Sign mode."; nftStatusEl.className = 'error'; return; }
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { nftStatusEl.textContent = "Load NFT first."; nftStatusEl.className = 'error'; return; }

    const textValue = textInput.value || "New Text";
    const textEl = document.createElement("div");
    textEl.className = "textOverlay";
    const textNode = document.createTextNode(textValue);
    textEl.appendChild(textNode);

    textEl.style.color = textColor.value;
    textEl.style.fontSize = `${DEFAULT_FONT_SIZE}px`;
    textEl.style.fontFamily = fontFamily.value;
    textEl.style.transform = `translate(-50%, -50%) rotate(0deg)`;
    textEl.style.zIndex = "10";
    textEl.style.width = 'auto';
    textEl.style.whiteSpace = 'nowrap';
    textEl.style.overflow = 'hidden';

    const rotateHandle = document.createElement("div"); rotateHandle.className = "handle rotation-handle"; rotateHandle.innerHTML = '↻'; textEl.appendChild(rotateHandle);
    const resizeHandleRight = document.createElement("div"); resizeHandleRight.className = "handle resize-handle-base resize-handle-right"; resizeHandleRight.title = "Resize Width"; textEl.appendChild(resizeHandleRight);
    const resizeHandleLeft = document.createElement("div"); resizeHandleLeft.className = "handle resize-handle-base resize-handle-left"; resizeHandleLeft.title = "Resize Font Size"; textEl.appendChild(resizeHandleLeft);

    const currentPolygon = getPolygonForSelectedCollection();
    const minX = Math.min(...currentPolygon.map(p => p.x)); const maxX = Math.max(...currentPolygon.map(p => p.x));
    const minY = Math.min(...currentPolygon.map(p => p.y)); const maxY = Math.max(...currentPolygon.map(p => p.y));
    const signCenterXPercent = canvasWidth ? ((minX + maxX) / 2) / canvasWidth * 100 : 50;
    const signCenterYPercent = canvasHeight ? ((minY + maxY) / 2) / canvasHeight * 100 : 50;
    const { x: initialX, y: initialY } = calculateElementPosition(signCenterXPercent, signCenterYPercent);
    textEl.style.left = `${initialX}px`;
    textEl.style.top = `${initialY}px`;

    textEl.addEventListener("mousedown", handleTextDragStart); textEl.addEventListener("touchstart", handleTextDragStart, { passive: true });
    rotateHandle.addEventListener("mousedown", handleTextRotateStart); rotateHandle.addEventListener("touchstart", handleTextRotateStart, { passive: true });
    resizeHandleRight.addEventListener("mousedown", handleTextResizeWidthStart); resizeHandleRight.addEventListener("touchstart", handleTextResizeWidthStart, { passive: true });
    resizeHandleLeft.addEventListener("mousedown", handleTextResizeFontSizeStart); resizeHandleLeft.addEventListener("touchstart", handleTextResizeFontSizeStart, { passive: true });

    container.appendChild(textEl);

    requestAnimationFrame(() => {
        if (textEl && container.contains(textEl)) {
            const initialWidth = textEl.offsetWidth;
            textEl.style.width = `${Math.max(initialWidth, 30)}px`;
            textEl.style.whiteSpace = 'normal';
             textEl.style.overflow = 'visible';
            setActiveElement(textEl);
        }
    });
}
function addImage() { /* ... codul tău existent ... */
    if (currentSignMode !== 'custom') { nftStatusEl.textContent = "Switch to Custom Sign mode."; nftStatusEl.className = 'error'; return; }
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { nftStatusEl.textContent = "Load NFT first."; nftStatusEl.className = 'error'; return; }
    if (!imageUpload || !imageUpload.files || imageUpload.files.length === 0) { nftStatusEl.textContent = "Please select an image file."; nftStatusEl.className = 'error'; return; }

    const file = imageUpload.files[0];
    if (!file.type.startsWith('image/')) {
         nftStatusEl.textContent = "Invalid file type. Please select an image.";
         nftStatusEl.className = 'error';
         imageUpload.value = '';
         return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const wrapper = document.createElement("div");
        wrapper.className = "imgOverlay";
        wrapper.style.position="absolute";
        wrapper.style.width="100px";
        wrapper.style.height="auto";
        wrapper.style.transform="translate(-50%, -50%) rotate(0deg)";
        wrapper.style.touchAction="none";
        wrapper.style.zIndex="20";

        const img = document.createElement("img");
        img.src = e.target.result;

        img.onload = () => {
             if(container.offsetWidth > 0 && img.naturalWidth > 0 && img.naturalHeight > 0){
                 const contW = container.offsetWidth;
                 const initialWidth = Math.min(img.naturalWidth * 0.5, contW * 0.4, 150);
                 const aspectRatio = img.naturalWidth / img.naturalHeight;
                 wrapper.style.width=`${initialWidth}px`;
                 wrapper.style.height=`${initialWidth / aspectRatio}px`;
             } else {
                 wrapper.style.width='100px';
                 wrapper.style.height='auto';
                 console.warn("Could not determine container/image size for initial scaling, using fallback.");
             }
             const currentPolygon = getPolygonForSelectedCollection();
             const minX=Math.min(...currentPolygon.map(p=>p.x));const maxX=Math.max(...currentPolygon.map(p=>p.x));
             const minY=Math.min(...currentPolygon.map(p=>p.y));const maxY=Math.max(...currentPolygon.map(p=>p.y));
             const signCenterXPercent=canvasWidth?((minX+maxX)/2)/canvasWidth*100:50;
             const signCenterYPercent=canvasHeight?((minY+maxY)/2)/canvasHeight*100:50;
             const{x:initialX,y:initialY}=calculateElementPosition(signCenterXPercent,signCenterYPercent);
             wrapper.style.left=`${initialX}px`;
             wrapper.style.top=`${initialY}px`;

             setActiveElement(wrapper);
         };
        img.onerror = ()=>{
            console.error("Error loading added image data.");
            nftStatusEl.textContent="Error displaying uploaded image.";
            nftStatusEl.className='error';
            wrapper.remove();
        };
        wrapper.appendChild(img);

        const rotateHandle = document.createElement("div"); rotateHandle.className = "handle rotation-handle"; rotateHandle.innerHTML = '↻'; wrapper.appendChild(rotateHandle);
        const resizeHandleRight = document.createElement("div"); resizeHandleRight.className = "handle resize-handle-base resize-handle-right"; resizeHandleRight.title = "Resize Image"; wrapper.appendChild(resizeHandleRight);

        wrapper.addEventListener("mousedown", handleImageDragStart); wrapper.addEventListener("touchstart", handleImageDragStart, { passive: true });
        rotateHandle.addEventListener("mousedown", handleImageRotateStart); rotateHandle.addEventListener("touchstart", handleImageRotateStart, { passive: true });
        resizeHandleRight.addEventListener("mousedown", handleImageResizeStart); resizeHandleRight.addEventListener("touchstart", handleImageResizeStart, { passive: true });

        container.appendChild(wrapper);
        nftStatusEl.textContent = "Image added."; nftStatusEl.className = 'success';
        imageUpload.value = '';

    };
    reader.onerror = function (err) {
        console.error("FileReader error:",err);
        nftStatusEl.textContent="Error reading image file.";
        nftStatusEl.className='error';
    }
    reader.readAsDataURL(file);
}

// --- Active Element Management & Removal (Custom Mode) ---
function setActiveElement(el) {
    if (activeElement && activeElement !== el) {
        if (container.contains(activeElement)) {
            activeElement.classList.remove("active");
            activeElement.style.zIndex = activeElement.classList.contains('imgOverlay') ? '20' : '10';
        }
    }

    if (el && currentSignMode === 'custom' && container.contains(el)) {
        el.classList.add("active");
        activeElement = el;
        el.style.zIndex = el.classList.contains('imgOverlay') ? '101' : '100';

        if (el.classList.contains('textOverlay')) {
             let textNode = el.childNodes[0];
             while (textNode && textNode.nodeType !== Node.TEXT_NODE) { textNode = textNode.nextSibling; }
             if (textNode) {
                 textInput.value = textNode.nodeValue.trim();
             } else {
                 textInput.value = (el.textContent || '').trim();
             }
             textColor.value = rgb2hex(el.style.color || '#ffffff');
             const currentFont = (el.style.fontFamily || 'Arial').split(',')[0].replace(/['"]/g, "").trim();
             let foundFont = false;
             for (let option of fontFamily.options) {
                 if (option.value.includes(currentFont)) {
                     fontFamily.value = option.value;
                     foundFont = true;
                     break;
                 }
             }
             if (!foundFont) fontFamily.value = 'Arial';
        }
    } else {
        activeElement = null;
    }

    updateCustomActionButtons();
}

// ===========================================================
// MODIFICAT: removeActiveElement CU stopPropagation
// ===========================================================
function removeActiveElement(event) {
    // Oprește imediat propagarea evenimentului click de la buton
    if (event) {
        event.stopPropagation();
    }

    // Verifică dacă există un element activ, este în container și suntem în modul custom
    if (activeElement && container.contains(activeElement) && currentSignMode === 'custom') {
        const elementType = activeElement.classList.contains('textOverlay') ? 'Text' : 'Image';
        activeElement.remove(); // Șterge elementul din DOM
        setActiveElement(null); // Curăță starea activă și actualizează butoanele *după* ștergere
        nftStatusEl.textContent = `${elementType} element removed.`;
        nftStatusEl.className = ''; // Curăță clasa de status
    } else if (currentSignMode !== 'custom') {
        nftStatusEl.textContent = "Delete only works in Custom Sign mode.";
        nftStatusEl.className = 'error';
        console.warn("Attempted to delete element outside of custom mode.");
    } else if (!activeElement) {
        // Această condiție este acum mai probabil atinsă dacă event.stopPropagation nu ar funcționa
        nftStatusEl.textContent = "No element selected to delete (or selection lost).";
        nftStatusEl.className = 'error';
        console.warn("Attempted to delete with no active element or selection lost.");
    } else {
         // Ceva neașteptat
         console.warn("Attempted to delete an element that might be detached or invalid.", activeElement);
         setActiveElement(null); // Forțează curățarea stării
         nftStatusEl.textContent = "Could not delete element (invalid state).";
         nftStatusEl.className = 'error';
    }
}


// --- Interaction Handlers (Common) --- (Neschimbat)
function getEventCoordinates(event) { /* ... codul tău existent ... */ let x,y; if(event.touches&&event.touches.length>0){x=event.touches[0].clientX;y=event.touches[0].clientY;}else if(event.changedTouches&&event.changedTouches.length>0){x=event.changedTouches[0].clientX;y=event.changedTouches[0].clientY;}else{x=event.clientX;y=event.clientY;} return{x,y}; }
function getRotationRad(element) { /* ... codul tău existent ... */ if(!element||!element.style)return 0; const transform=element.style.transform; const rotateMatch=transform.match(/rotate\((-?\d+(\.\d+)?)deg\)/); const rotationDeg=rotateMatch?parseFloat(rotateMatch[1]):0; return rotationDeg*(Math.PI/180); }

// --- Interaction Handlers (Text - Custom Mode) --- (Neschimbat)
function handleTextDragStart(event) { /* ... codul tău existent ... */ if (event.target.classList.contains('handle') || currentSignMode !== 'custom') return; const el = event.currentTarget; setActiveElement(el); textInteractionState.isDragging = true; textInteractionState.isRotating = false; textInteractionState.isResizingWidth = false; textInteractionState.isResizingFontSize = false; el.style.cursor = 'grabbing'; document.body.style.cursor = 'grabbing'; const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); textInteractionState.startX = coords.x - contRect.left; textInteractionState.startY = coords.y - contRect.top; textInteractionState.startLeft = parseFloat(el.style.left || "0"); textInteractionState.startTop = parseFloat(el.style.top || "0"); document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextRotateStart(event) { /* ... codul tău existent ... */ if (currentSignMode !== 'custom') return; event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); textInteractionState.isRotating = true; textInteractionState.isDragging = false; textInteractionState.isResizingWidth = false; textInteractionState.isResizingFontSize = false; document.body.style.cursor = 'alias'; const coords = getEventCoordinates(event); const rect = el.getBoundingClientRect(); textInteractionState.rotateCenterX = rect.left + rect.width / 2; textInteractionState.rotateCenterY = rect.top + rect.height / 2; const dx = coords.x - textInteractionState.rotateCenterX; const dy = coords.y - textInteractionState.rotateCenterY; let startAngle = Math.atan2(dy, dx); const currentRotationRad = getRotationRad(el); textInteractionState.rotateStartAngle = startAngle - currentRotationRad; document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextResizeWidthStart(event) { /* ... codul tău existent ... */ if (currentSignMode !== 'custom') return; event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); textInteractionState.isResizingWidth = true; textInteractionState.isResizingFontSize = false; textInteractionState.isRotating = false; textInteractionState.isDragging = false; document.body.style.cursor = 'ew-resize'; const coords = getEventCoordinates(event); textInteractionState.startX = coords.x; textInteractionState.startY = coords.y; textInteractionState.startWidth = el.offsetWidth; textInteractionState.currentRotationRad = getRotationRad(el); el.style.whiteSpace = 'normal'; el.style.overflow = 'hidden'; document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextResizeFontSizeStart(event) { /* ... codul tău existent ... */ if (currentSignMode !== 'custom') return; event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); textInteractionState.isResizingFontSize = true; textInteractionState.isResizingWidth = false; textInteractionState.isRotating = false; textInteractionState.isDragging = false; document.body.style.cursor = 'ns-resize'; const coords = getEventCoordinates(event); textInteractionState.startX = coords.x; textInteractionState.startY = coords.y; textInteractionState.startFontSize = parseFloat(el.style.fontSize) || DEFAULT_FONT_SIZE; document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextInteractionMove(event) { /* ... codul tău existent ... */ if (!activeElement || !activeElement.classList.contains('textOverlay') || (!textInteractionState.isDragging && !textInteractionState.isRotating && !textInteractionState.isResizingWidth && !textInteractionState.isResizingFontSize)) return; if (event.type === 'touchmove') event.preventDefault(); const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); if (textInteractionState.isDragging) { const currentX = coords.x - contRect.left; const currentY = coords.y - contRect.top; activeElement.style.left = `${textInteractionState.startLeft + (currentX - textInteractionState.startX)}px`; activeElement.style.top = `${textInteractionState.startTop + (currentY - textInteractionState.startY)}px`; } else if (textInteractionState.isRotating) { const dx = coords.x - textInteractionState.rotateCenterX; const dy = coords.y - textInteractionState.rotateCenterY; let angle = Math.atan2(dy, dx); let rotationRad = angle - textInteractionState.rotateStartAngle; let rotationDeg = rotationRad * (180 / Math.PI); activeElement.style.transform = `translate(-50%, -50%) rotate(${rotationDeg}deg)`; } else if (textInteractionState.isResizingWidth) { const dx = coords.x - textInteractionState.startX; const dy = coords.y - textInteractionState.startY; const rotation = textInteractionState.currentRotationRad; const cosR = Math.cos(rotation); const sinR = Math.sin(rotation); const projectedDx = dx * cosR + dy * sinR; let newWidth = textInteractionState.startWidth + projectedDx; activeElement.style.width = `${Math.max(30, newWidth)}px`; } else if (textInteractionState.isResizingFontSize) { const dy = coords.y - textInteractionState.startY; let newSize = textInteractionState.startFontSize - (dy * FONT_SIZE_SENSITIVITY); activeElement.style.fontSize = `${Math.max(MIN_FONT_SIZE, newSize)}px`; } }
function handleTextInteractionEnd(event) { /* ... codul tău existent ... */ if (activeElement && activeElement.classList.contains('textOverlay')) { activeElement.style.cursor = 'grab'; if (textInteractionState.isResizingWidth || textInteractionState.isResizingFontSize) { activeElement.style.overflow = 'visible'; } } document.body.style.cursor = 'default'; textInteractionState.isDragging = false; textInteractionState.isRotating = false; textInteractionState.isResizingWidth = false; textInteractionState.isResizingFontSize = false; document.removeEventListener("mousemove", handleTextInteractionMove); document.removeEventListener("mouseup", handleTextInteractionEnd); document.removeEventListener("touchmove", handleTextInteractionMove); document.removeEventListener("touchend", handleTextInteractionEnd); document.removeEventListener("touchcancel", handleTextInteractionEnd); }

// --- Interaction Handlers (Image - Custom Mode) --- (Neschimbat)
function handleImageDragStart(event) { /* ... codul tău existent ... */ if (event.target.classList.contains('handle') || currentSignMode !== 'custom') return; const el = event.currentTarget; setActiveElement(el); imageInteractionState.isDragging = true; imageInteractionState.isRotating = false; imageInteractionState.isResizing = false; el.style.cursor = 'grabbing'; document.body.style.cursor = 'grabbing'; const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); imageInteractionState.startX = coords.x - contRect.left; imageInteractionState.startY = coords.y - contRect.top; imageInteractionState.startLeft = parseFloat(el.style.left || "0"); imageInteractionState.startTop = parseFloat(el.style.top || "0"); document.addEventListener("mousemove", handleImageInteractionMove); document.addEventListener("mouseup", handleImageInteractionEnd); document.addEventListener("touchmove", handleImageInteractionMove, { passive: false }); document.addEventListener("touchend", handleImageInteractionEnd); document.addEventListener("touchcancel", handleImageInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleImageRotateStart(event) { /* ... codul tău existent ... */ if (currentSignMode !== 'custom') return; event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); imageInteractionState.isRotating = true; imageInteractionState.isDragging = false; imageInteractionState.isResizing = false; document.body.style.cursor = 'alias'; const coords = getEventCoordinates(event); const rect = el.getBoundingClientRect(); imageInteractionState.centerX = rect.left + rect.width / 2; imageInteractionState.centerY = rect.top + rect.height / 2; const dx = coords.x - imageInteractionState.centerX; const dy = coords.y - imageInteractionState.centerY; let startAngle = Math.atan2(dy, dx); imageInteractionState.currentRotationRad = getRotationRad(el); imageInteractionState.startAngle = startAngle - imageInteractionState.currentRotationRad; document.addEventListener("mousemove", handleImageInteractionMove); document.addEventListener("mouseup", handleImageInteractionEnd); document.addEventListener("touchmove", handleImageInteractionMove, { passive: false }); document.addEventListener("touchend", handleImageInteractionEnd); document.addEventListener("touchcancel", handleImageInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleImageResizeStart(event) { /* ... codul tău existent ... */ if (currentSignMode !== 'custom') return; event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); imageInteractionState.isResizing = true; imageInteractionState.isRotating = false; imageInteractionState.isDragging = false; document.body.style.cursor = 'nwse-resize'; const coords = getEventCoordinates(event); imageInteractionState.startX = coords.x; imageInteractionState.startY = coords.y; imageInteractionState.startWidth = el.offsetWidth; imageInteractionState.startHeight = el.offsetHeight; imageInteractionState.aspectRatio = imageInteractionState.startHeight > 0 ? imageInteractionState.startWidth / imageInteractionState.startHeight : 1; imageInteractionState.currentRotationRad = getRotationRad(el); const rect = el.getBoundingClientRect(); imageInteractionState.centerX = rect.left + rect.width / 2; imageInteractionState.centerY = rect.top + rect.height / 2; document.addEventListener("mousemove", handleImageInteractionMove); document.addEventListener("mouseup", handleImageInteractionEnd); document.addEventListener("touchmove", handleImageInteractionMove, { passive: false }); document.addEventListener("touchend", handleImageInteractionEnd); document.addEventListener("touchcancel", handleImageInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleImageInteractionMove(event) { /* ... codul tău existent ... */ if (!activeElement || !activeElement.classList.contains('imgOverlay') || (!imageInteractionState.isDragging && !imageInteractionState.isRotating && !imageInteractionState.isResizing)) return; if (event.type === 'touchmove') event.preventDefault(); const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); if (imageInteractionState.isDragging) { const currentX = coords.x - contRect.left; const currentY = coords.y - contRect.top; activeElement.style.left = `${imageInteractionState.startLeft + (currentX - imageInteractionState.startX)}px`; activeElement.style.top = `${imageInteractionState.startTop + (currentY - imageInteractionState.startY)}px`; } else if (imageInteractionState.isRotating) { const dx = coords.x - imageInteractionState.centerX; const dy = coords.y - imageInteractionState.centerY; let angle = Math.atan2(dy, dx); let rotationRad = angle - imageInteractionState.startAngle; let rotationDeg = rotationRad * (180 / Math.PI); activeElement.style.transform = `translate(-50%, -50%) rotate(${rotationDeg}deg)`; } else if (imageInteractionState.isResizing) { const startDist = Math.hypot(imageInteractionState.startX - imageInteractionState.centerX, imageInteractionState.startY - imageInteractionState.centerY); const currentDist = Math.hypot(coords.x - imageInteractionState.centerX, coords.y - imageInteractionState.centerY); const scaleFactor = startDist > 0 ? currentDist / startDist : 1; let newWidth = imageInteractionState.startWidth * scaleFactor; let newHeight = imageInteractionState.aspectRatio > 0 ? newWidth / imageInteractionState.aspectRatio : newWidth; activeElement.style.width = `${Math.max(30, newWidth)}px`; activeElement.style.height = `${Math.max(30 / (imageInteractionState.aspectRatio || 1), newHeight)}px`; } }
function handleImageInteractionEnd(event) { /* ... codul tău existent ... */ if (activeElement && activeElement.classList.contains('imgOverlay')) { activeElement.style.cursor = 'grab'; } document.body.style.cursor = 'default'; imageInteractionState.isDragging = false; imageInteractionState.isRotating = false; imageInteractionState.isResizing = false; document.removeEventListener("mousemove", handleImageInteractionMove); document.removeEventListener("mouseup", handleImageInteractionEnd); document.removeEventListener("touchmove", handleImageInteractionMove); document.removeEventListener("touchend", handleImageInteractionEnd); document.removeEventListener("touchcancel", handleImageInteractionEnd); }

// --- Utility Functions --- (Neschimbat)
function calculateElementPosition(percentX, percentY) { /* ... codul tău existent ... */ const contRect=container.getBoundingClientRect();if(!contRect||contRect.width===0||contRect.height===0)return{x:0,y:0}; return { x: contRect.width * (percentX/100), y: contRect.height * (percentY/100) }; }
function getCanvasCoordsFromContainerPoint(containerX, containerY) { /* ... codul tău existent ... */ const contRect=container.getBoundingClientRect();if(!contRect||contRect.width===0||contRect.height===0)return{canvasX:0,canvasY:0};const scaleX=canvasWidth/contRect.width; const scaleY=canvasHeight/contRect.height; return{canvasX:containerX*scaleX,canvasY:containerY*scaleY};}
function pointInPolygon(point, vs) { /* ... codul tău existent ... */ const x = point.x, y = point.y; let inside = false; for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) { const xi = vs[i].x, yi = vs[i].y; const xj = vs[j].x, yj = vs[j].y; const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi); if (intersect) inside = !inside; } return inside; }
function rgb2hex(rgb) { /* ... codul tău existent ... */ if(!rgb)return'#ffffff'; if(rgb.startsWith('#'))return rgb; const rgbMatch=rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/); if(rgbMatch){return"#"+rgbMatch.slice(1).map(x=>{const hex=parseInt(x).toString(16);return hex.length===1?"0"+hex:hex;}).join('');} return rgb; }

// --- Text Wrapping Calculation for Canvas (Custom Mode) --- (Neschimbat)
function getWrappedTextLines(text, maxWidthPx, fontStyle) { /* ... codul tău existent ... */ if (!text || maxWidthPx <= 0) return []; ctx.font = fontStyle; const words = text.split(' '); const lines = []; let currentLine = ''; for (let i = 0; i < words.length; i++) { const word = words[i]; const testLine = currentLine ? currentLine + " " + word : word; const testWidth = ctx.measureText(testLine).width; if (testWidth <= maxWidthPx || !currentLine) { currentLine = testLine; } else { lines.push(currentLine); currentLine = word; if (ctx.measureText(currentLine).width > maxWidthPx) { let tempLine = ''; for(let char of currentLine) { if(ctx.measureText(tempLine + char).width > maxWidthPx && tempLine) { lines.push(tempLine); tempLine = char; } else { tempLine += char; } } currentLine = tempLine; } } } if (currentLine) { lines.push(currentLine); } return lines; }


// --- Save Functionality (Unified) --- (Neschimbat - presupunem că e ok)
function saveImage() { /* ... codul tău existent ... */
    const currentNftId = nftTokenIdInput.value || 'unknown';
    const currentCollection = nftCollectionSelect.value || 'unknown';

    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { alert("Load a valid NFT first!"); nftStatusEl.className = 'error'; nftStatusEl.textContent = "NFT not loaded for saving."; return; }
    if (currentSignMode === 'prefix' && !appliedPrefixSignImage) { alert("Select a sign from the gallery before saving."); nftStatusEl.className = 'error'; nftStatusEl.textContent = "No sign selected from gallery."; return; }

    nftStatusEl.textContent = `Generating final image...`; nftStatusEl.className = '';
    const previouslyActive = activeElement; if (activeElement) setActiveElement(null);

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    drawBaseImage();

    if (currentSignMode === 'prefix' && appliedPrefixSignImage && appliedPrefixSignImage.complete) {
        try { ctx.drawImage(appliedPrefixSignImage, 0, 0, canvasWidth, canvasHeight); } catch (e) { console.error("Error drawing prefix sign during save:", e); }
    } else if (currentSignMode === 'custom') {
        drawSignPolygonOnly();
        const containerRect = container.getBoundingClientRect();
        if (!containerRect || containerRect.width === 0 || containerRect.height === 0) {
            console.error("Error getting container rect during save");
            nftStatusEl.className='error'; nftStatusEl.textContent="Save Error: Container rect invalid.";
            if(previouslyActive && container.contains(previouslyActive)) setActiveElement(previouslyActive);
            return;
        }
        const scaleX = canvasWidth / containerRect.width;
        const scaleY = canvasHeight / containerRect.height;

        const allOverlays = Array.from(container.querySelectorAll(".textOverlay, .imgOverlay"));
        allOverlays.sort((a, b) => (parseInt(window.getComputedStyle(a).zIndex) || 0) - (parseInt(window.getComputedStyle(b).zIndex) || 0));

        allOverlays.forEach(el => {
            if (!container.contains(el)) return;

            const elRect = el.getBoundingClientRect();
            const rotationRad = getRotationRad(el);
            const relativeCenterX = (elRect.left + elRect.width / 2) - containerRect.left;
            const relativeCenterY = (elRect.top + elRect.height / 2) - containerRect.top;
            const canvasX = Math.round(relativeCenterX * scaleX);
            const canvasY = Math.round(relativeCenterY * scaleY);

            ctx.save();
            ctx.translate(canvasX, canvasY);
            ctx.rotate(rotationRad);

            if (el.classList.contains('textOverlay')) {
                let textNode = el.childNodes[0];
                 while (textNode && textNode.nodeType !== Node.TEXT_NODE) { textNode = textNode.nextSibling; }
                const text = textNode ? textNode.nodeValue : (el.textContent || '');
                const color = el.style.color || '#ffffff';
                const size = parseFloat(el.style.fontSize) || DEFAULT_FONT_SIZE;
                const font = el.style.fontFamily || 'Arial';
                const domWidth = el.offsetWidth;
                const canvasFontSize = Math.round(size * scaleY);
                const canvasMaxWidth = Math.round(domWidth * scaleX);

                if (canvasFontSize >= 1 && text) {
                    const fontStyle = `${canvasFontSize}px ${font}`;
                    ctx.font = fontStyle;
                    ctx.fillStyle = color;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    const lines = getWrappedTextLines(text, canvasMaxWidth, fontStyle);
                    const lineHeight = canvasFontSize * 1.2;
                    const totalTextHeight = lines.length * lineHeight;
                    let currentY = -(totalTextHeight / 2) + (lineHeight / 2);
                    lines.forEach(line => { ctx.fillText(line, 0, currentY); currentY += lineHeight; });
                }
            } else if (el.classList.contains('imgOverlay')) {
                const imgElement = el.querySelector('img');
                if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
                    const domWidth = el.offsetWidth;
                    const domHeight = el.offsetHeight;
                    const canvasDrawWidth = Math.round(domWidth * scaleX);
                    const canvasDrawHeight = Math.round(domHeight * scaleY);
                    if (canvasDrawWidth > 0 && canvasDrawHeight > 0) {
                        try { ctx.drawImage(imgElement, -canvasDrawWidth / 2, -canvasDrawHeight / 2, canvasDrawWidth, canvasDrawHeight); }
                        catch (e) { console.error("Error drawing image overlay during save:", e); }
                    }
                } else { console.warn("Skipping unloaded/invalid image overlay during save:", imgElement?.src); }
            }
            ctx.restore();
        });
    }

    try {
        const dataURL = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        let filename = "";
        const safeCollection = currentCollection.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const safeNftId = currentNftId.replace(/[^a-z0-9]/gi, '_');
        if (currentSignMode === 'prefix' && appliedPrefixSignImage) {
            const signName = appliedPrefixSignImage.alt || 'sign';
            const safeSignName = signName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            filename = `signed-${safeCollection}-${safeNftId}-${safeSignName}.png`;
        } else { filename = `custom-${safeCollection}-${safeNftId}.png`; }
        link.download = filename; link.href = dataURL; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        nftStatusEl.textContent = `Image saved as ${filename}!`; nftStatusEl.className = 'success';
    } catch (e) {
        console.error("Error saving image:", e); nftStatusEl.className = 'error';
        if (e.name === "SecurityError") { alert("Save Error: Cannot save due to cross-origin image security restrictions (CORS). Ensure NFT/Sign images allow anonymous access."); nftStatusEl.textContent = "Save Error: CORS issue."; }
        else { alert("An error occurred saving the image. Check console."); nftStatusEl.textContent = "Save Error. Check console."; }
    }

     setTimeout(() => {
         if (baseImage.src && baseImage.complete) {
             if (currentSignMode === 'prefix' && appliedPrefixSignImage) { drawBaseImage(); ctx.drawImage(appliedPrefixSignImage, 0, 0, canvasWidth, canvasHeight); }
             else if (currentSignMode === 'custom') { applyOverlay(false); }
             else { drawBaseImage(); }
         } else { clearCanvas(); }
         if (previouslyActive && container.contains(previouslyActive)) { setActiveElement(previouslyActive); }
         else { updateCustomActionButtons(); }
     }, 100);
}