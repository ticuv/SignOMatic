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

function setupEventListeners() {
    if (!loadNftBtn) { console.error("Load button not found!"); return; }

    // NFT Loading
    loadNftBtn.addEventListener('click', loadNftToCanvas);
    nftCollectionSelect.addEventListener("change", () => {
        if (currentSignMode === 'custom' && container.querySelectorAll('.textOverlay, .imgOverlay').length > 0) {
            container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el => el.remove());
            setActiveElement(null);
            applyOverlay(false);
        } else if (currentSignMode === 'prefix') {
            appliedPrefixSignImage = null;
            if (baseImage.src && baseImage.complete) drawBaseImage();
            if(savePrefixBtn) savePrefixBtn.disabled = true; // Disable save on collection change
            populateSignGallery(); // Repopulate gallery
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
    removeBtn.addEventListener('click', removeActiveElement);

    // General Actions
    resetCanvasBtn.addEventListener('click', handleReset);
    saveFullBtn.addEventListener('click', saveImage); // Custom Save
    savePrefixBtn.addEventListener('click', saveImage); // Prefix Save (uses same function)

     // Deselect active element when clicking outside
     document.addEventListener('click', (event) => {
        if (!container.contains(event.target) || event.target === container || event.target === canvas) {
             if (activeElement && currentSignMode === 'custom') { setActiveElement(null); }
        } else if (activeElement && !activeElement.contains(event.target)) {
             let clickedOverlay = event.target.closest('.textOverlay, .imgOverlay');
             if (!clickedOverlay && currentSignMode === 'custom') { setActiveElement(null); }
         }
     }, true);
}

// --- Workflow Management ---
function setControlsDisabled(isDisabled) {
    const customControls = [overlayColorInput, textInput, textColor, fontFamily, addTextBtn, imageUpload, addImageBtn, removeBtn, saveFullBtn];
    const signChoiceRadios = [signTypePrefixRadio, signTypeCustomRadio];
    const prefixControls = [savePrefixBtn]; // Only the prefix save button needs specific handling here

    customControls.forEach(el => { if(el) el.disabled = isDisabled; });
    prefixControls.forEach(el => { if(el) el.disabled = isDisabled; });
    signChoiceRadios.forEach(el => { if(el) el.disabled = isDisabled; });

    // Ensure buttons are definitely disabled if 'isDisabled' is true
    if (isDisabled) {
        if(removeBtn) removeBtn.disabled = true;
        if(saveFullBtn) saveFullBtn.disabled = true;
        if(savePrefixBtn) savePrefixBtn.disabled = true;
    }
    // Specific enabling logic is in setSignMode
}

function setSignMode(mode) {
    // Clear things from the *other* mode
    if (mode === 'prefix' && activeElement) {
        container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el => el.remove());
        setActiveElement(null);
    } else if (mode === 'custom' && appliedPrefixSignImage) {
        appliedPrefixSignImage = null;
        if (selectedSignItem) {
            selectedSignItem.classList.remove('selected');
            selectedSignItem = null;
        }
        if (baseImage.src && baseImage.complete) drawBaseImage(); // Redraw base only
    }

    currentSignMode = mode;
    nftStatusEl.textContent = `Mode selected: ${mode === 'prefix' ? 'Signs Gallery' : 'Custom Sign'}.`;
    nftStatusEl.className = '';

    prefixOptionsGroup.classList.toggle('hidden', mode !== 'prefix');
    customOptionsGroup.classList.toggle('hidden', mode !== 'custom');

    setControlsDisabled(true); // Disable all initially
    signTypePrefixRadio.disabled = false;
    signTypeCustomRadio.disabled = false;

    if (mode === 'prefix') {
         if (baseImage.src && baseImage.complete) {
             if(appliedPrefixSignImage && appliedPrefixSignImage.complete) { // Restore applied sign view
                 drawBaseImage();
                 ctx.drawImage(appliedPrefixSignImage, 0, 0, canvasWidth, canvasHeight);
                 if(savePrefixBtn) savePrefixBtn.disabled = false; // Enable save if sign is applied
             } else { // Just show base image
                 drawBaseImage();
                 if(savePrefixBtn) savePrefixBtn.disabled = true;
             }
             populateSignGallery(); // Load gallery content
         } else { // No NFT loaded
             if(signGalleryContainer) signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--error-red);">Load NFT first.</p>';
             if(savePrefixBtn) savePrefixBtn.disabled = true;
         }
    } else if (mode === 'custom') {
         const customControls = [overlayColorInput, textInput, textColor, fontFamily, addTextBtn, imageUpload, addImageBtn];
         customControls.forEach(el => { if(el) el.disabled = false; });
         updateCustomActionButtons(); // Enable/disable remove/save based on state
         applyOverlay(false); // Redraw base + color polygon
    }

    // Ensure active custom element is cleared unless already in custom mode
    if (mode !== 'custom') {
         setActiveElement(null);
    } else {
        // If switching back to custom, re-enable buttons if applicable
         updateCustomActionButtons();
    }
}

function updateCustomActionButtons() { // Only for CUSTOM mode buttons
    if (currentSignMode !== 'custom') return;
    const isElementActive = activeElement !== null;
    const isImageLoaded = baseImage.src !== "" && baseImage.complete && baseImage.naturalWidth > 0;
    if(removeBtn) removeBtn.disabled = !isElementActive || !isImageLoaded;
    if(saveFullBtn) saveFullBtn.disabled = !isImageLoaded;
}

// --- Event Handlers ---
function handleTextControlChange() {
    if (activeElement && activeElement.classList.contains('textOverlay') && currentSignMode === 'custom') {
        const textNode = activeElement.childNodes[0];
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            textNode.nodeValue = textInput.value || " "; // Use space if empty to maintain element size
        } else {
            // Fallback if first child is not a text node (shouldn't happen with current setup)
            while (activeElement.firstChild) { activeElement.removeChild(activeElement.firstChild); } // Clear existing
            activeElement.insertBefore(document.createTextNode(textInput.value || " "), activeElement.firstChild); // Add new text node
        }
        activeElement.style.color = textColor.value;
        activeElement.style.fontFamily = fontFamily.value;
        // Auto-adjust width after text change (optional, can be complex with wrapping)
        requestAnimationFrame(() => {
             if(activeElement && activeElement.classList.contains('textOverlay')) {
                 const originalWidthStyle = activeElement.style.width;
                 activeElement.style.width = 'auto'; // Let it expand naturally
                 const naturalWidth = activeElement.offsetWidth;
                 // Restore previous width OR set to natural width if it was 'auto'
                 activeElement.style.width = originalWidthStyle !== 'auto' ? originalWidthStyle : `${Math.max(30, naturalWidth)}px`;
             }
         });
    }
}
function handleReset() {
    if (confirm("Are you sure you want to clear the canvas and all added elements/signs? This cannot be undone.")) {
        clearCanvasAndOverlays(); // Clears custom overlays
        appliedPrefixSignImage = null; // Clear applied prefix sign state
        if (selectedSignItem) {
            selectedSignItem.classList.remove('selected');
            selectedSignItem = null;
        }

        if (baseImage.src && baseImage.complete && baseImage.naturalWidth > 0) {
            drawBaseImage(); // Redraw only base image
            signTypeChoiceGroup.classList.remove('hidden');
            signTypePrefixRadio.disabled = false; signTypeCustomRadio.disabled = false;
            signTypePrefixRadio.checked = false; signTypeCustomRadio.checked = false;
            prefixOptionsGroup.classList.add('hidden'); customOptionsGroup.classList.add('hidden');
            setControlsDisabled(true); // Disables all action buttons initially
            signTypePrefixRadio.disabled = false; signTypeCustomRadio.disabled = false;
            currentSignMode = null;
            nftStatusEl.textContent = "Canvas reset. Choose sign type."; nftStatusEl.className = '';
            if(signGalleryContainer) signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--portal-blue);">Loading gallery...</p>';
            fetchSignConfig(); // Ensure config is loaded if user selects prefix again

        } else {
            enableNftLoadControlsOnly();
            nftStatusEl.textContent = "Select collection and ID, then load NFT."; nftStatusEl.className = '';
        }
    }
}

// --- Canvas & Overlay Management ---
function clearCanvasAndOverlays() { // Primarily for custom overlays
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el => el.remove());
    setActiveElement(null);
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
}

// --- NFT Loading & Drawing ---
function getPolygonForSelectedCollection(){ const selectedCollection=nftCollectionSelect.value; if(selectedCollection==="AHC"){return[{x:1415,y:316},{x:2024,y:358},{x:1958,y:1324},{x:1358,y:1286}];}else{/* GHN default */ return[{x:1403,y:196},{x:2034,y:218},{x:1968,y:1164},{x:1358,y:1126}];} }
function resolveIpfsUrl(url) { if(url&&url.startsWith("ipfs://")){return url.replace("ipfs://","https://ipfs.io/ipfs/");}return url; }
async function loadNftToCanvas() {
    const selectedCollection = nftCollectionSelect.value;
    const tokenId = nftTokenIdInput.value;
    if (!tokenId) { nftStatusEl.textContent = "Please enter a Token ID."; nftStatusEl.className = 'error'; return; }
    if (!nftContracts[selectedCollection]) { console.error(`Selected collection "${selectedCollection}" not found.`); nftStatusEl.textContent = `Error: Collection definition "${selectedCollection}" not found.`; nftStatusEl.className = 'error'; return; }

    // Clear previous state
    clearCanvasAndOverlays();
    appliedPrefixSignImage = null;
    if (selectedSignItem) { selectedSignItem.classList.remove('selected'); selectedSignItem = null; }

    loadNftBtn.disabled = true; nftCollectionSelect.disabled = true; nftTokenIdInput.disabled = true;
    setControlsDisabled(true);
    signTypeChoiceGroup.classList.add('hidden'); prefixOptionsGroup.classList.add('hidden'); customOptionsGroup.classList.add('hidden');
    nftStatusEl.textContent = `Loading ${nftContracts[selectedCollection].name} #${tokenId}...`; nftStatusEl.className = '';

    const contractInfo = nftContracts[selectedCollection];
    const contract = new ethers.Contract(contractInfo.address, nftAbi, provider);
    try {
        let tokenURI = await contract.tokenURI(tokenId); tokenURI = resolveIpfsUrl(tokenURI);
        nftStatusEl.textContent = "Fetching metadata...";
        const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
        const response = await fetch(tokenURI, { signal: controller.signal }); clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Metadata error: ${response.status} ${response.statusText} (URL: ${tokenURI.substring(0, 100)}...)`);
        const metadata = await response.json();
        let imageUrl = resolveIpfsUrl(metadata.image || metadata.image_url || metadata.imageUrl);
        if (!imageUrl) throw new Error("Image URL missing in metadata");
        nftStatusEl.textContent = "Loading image..."; baseImage = new Image(); baseImage.crossOrigin = "Anonymous";
        baseImage.onload = () => {
            nftStatusEl.textContent = "Drawing image..."; drawBaseImage();
            nftStatusEl.textContent = `${nftContracts[selectedCollection].name} #${tokenId} loaded! Choose sign type below.`; nftStatusEl.className = 'success';
            signTypeChoiceGroup.classList.remove('hidden');
            signTypePrefixRadio.disabled = false; signTypeCustomRadio.disabled = false;
            signTypePrefixRadio.checked = false; signTypeCustomRadio.checked = false;
            currentSignMode = null;
            loadNftBtn.disabled = false; nftCollectionSelect.disabled = false; nftTokenIdInput.disabled = false;
            fetchSignConfig(); // Fetch config in background
        };
        baseImage.onerror = (err) => {
             console.error("Error loading NFT image:", err, "Attempted URL:", imageUrl); nftStatusEl.textContent = `Error loading image. Check console.`; nftStatusEl.className = 'error';
             enableNftLoadControlsOnly();
             ctx.fillStyle = "white"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("Image Load Error", canvasWidth / 2, canvasHeight / 2);
        };
        baseImage.src = imageUrl;
    } catch (err) {
         console.error(`Error processing NFT ${tokenId}:`, err); let errorMsg = "Error: " + err.message;
         if (err.name === 'AbortError') { errorMsg = "Error: Metadata request timed out."; }
         else if (err.message?.includes('invalid token ID') || err.message?.includes('URI query for nonexistent token')) { errorMsg = `Error: Token ID ${tokenId} invalid or does not exist.`; }
         else if (err.message?.includes('CALL_EXCEPTION')) { errorMsg = `Error: Could not query contract. Check network/address or Token ID.`; }
         nftStatusEl.textContent = errorMsg; nftStatusEl.className = 'error';
         enableNftLoadControlsOnly();
         ctx.fillStyle = "white"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("NFT Load Error", canvasWidth / 2, canvasHeight / 2);
    }
 }
function drawBaseImage() {
    if(!baseImage.src||!baseImage.complete||baseImage.naturalWidth===0)return;
    ctx.clearRect(0,0,canvasWidth,canvasHeight); ctx.fillStyle="#444"; ctx.fillRect(0,0,canvasWidth,canvasHeight);
    const aspectRatio=baseImage.naturalWidth/baseImage.naturalHeight; let drawWidth=canvasWidth,drawHeight=canvasHeight,x=0,y=0; if(canvasWidth/canvasHeight>aspectRatio){drawHeight=canvasHeight;drawWidth=drawHeight*aspectRatio;x=(canvasWidth-drawWidth)/2;}else{drawWidth=canvasWidth;drawHeight=drawWidth/aspectRatio;y=(canvasHeight-drawHeight)/2;} try{ctx.drawImage(baseImage,x,y,drawWidth,drawHeight);}catch(e){console.error("Error drawing base image:",e); nftStatusEl.textContent="Error drawing NFT image."; nftStatusEl.className='error';}
}
function applyOverlay(clearExistingOverlays = true) { // For CUSTOM sign color overlay
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0 || currentSignMode !== 'custom') return;
    drawBaseImage();
    drawSignPolygonOnly();
}
function drawSignPolygonOnly() {
    const color = overlayColorInput.value;
    const currentPolygon = getPolygonForSelectedCollection();
    ctx.beginPath(); ctx.moveTo(currentPolygon[0].x, currentPolygon[0].y);
    for (let i = 1; i < currentPolygon.length; i++) { ctx.lineTo(currentPolygon[i].x, currentPolygon[i].y); }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    ctx.lineJoin = "round"; ctx.lineWidth = 14; ctx.strokeStyle = "black"; ctx.stroke();
}

// --- Sign Gallery Functions ---
async function fetchSignConfig() {
    if (signConfigData || isSignConfigLoading) return signConfigData; // Return cached data or if already loading
    isSignConfigLoading = true;
    // Use the constant path relative to index.html
    const configUrl = SIGNS_JSON_PATH;
    try {
        nftStatusEl.textContent = "Loading sign gallery configuration..."; nftStatusEl.className = '';
        const response = await fetch(configUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} fetching ${configUrl}`);
        signConfigData = await response.json();
        if (!signConfigData.githubUser || !signConfigData.githubRepo || !signConfigData.githubBranch || !signConfigData.imageBasePath || !signConfigData.categories) {
            throw new Error("Invalid signs.json structure.");
        }
        nftStatusEl.textContent = "Sign gallery configuration loaded."; nftStatusEl.className = 'success';
        if (currentSignMode === 'prefix') populateSignGallery(); // Populate if already in prefix mode
        return signConfigData;
    } catch (error) {
        console.error("Error fetching/parsing sign config:", error);
        nftStatusEl.textContent = `Error loading sign gallery: ${error.message}. Check console.`; nftStatusEl.className = 'error';
        if (signGalleryContainer) signGalleryContainer.innerHTML = `<p style="color: var(--error-red);">Error loading signs. Check console.</p>`;
        signConfigData = null; // Reset config data on error
        return null;
    } finally {
        isSignConfigLoading = false;
    }
}

function populateSignGallery() {
    if (!signGalleryContainer) return;
    if (isSignConfigLoading) { signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--portal-blue);">Loading gallery config...</p>'; return; }
    if (!signConfigData) {
        fetchSignConfig().then(config => {
            if (config) populateSignGallery(); // Try populating again after fetch completes
            else signGalleryContainer.innerHTML = '<p style="color: var(--error-red);">Failed to load gallery config.</p>';
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
    signGalleryContainer.innerHTML = ''; // Clear previous content

    if (!signsForCollection || signsForCollection.length === 0) {
        signGalleryContainer.innerHTML = `<p style="font-style: italic;">No specific signs found for ${currentCollectionKey}.</p>`; return;
    }

    const { githubUser, githubRepo, githubBranch, imageBasePath } = signConfigData;
    // Construct the base URL for RAW GitHub content
    const baseUrl = `https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${githubBranch}/${imageBasePath}/`;

    signsForCollection.forEach(sign => {
        // fileName should be relative to imageBasePath (e.g., "GHN/duko.png")
        const signImageUrl = baseUrl + sign.fileName;
        const signName = sign.name || sign.fileName.split('/').pop(); // Use provided name or derive from filename
        const itemDiv = document.createElement('div'); itemDiv.className = 'sign-item'; itemDiv.title = `Apply: ${signName}`; itemDiv.dataset.imageUrl = signImageUrl; itemDiv.dataset.signName = signName; // Store name for later use

        const img = document.createElement('img'); img.src = signImageUrl; img.alt = signName; img.loading = "lazy";
        img.onerror = () => {
             img.alt = `${signName} (Load Error)`;
             img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'%3E%3Ctext x='50%' y='50%' fill='red' font-size='10' dominant-baseline='middle' text-anchor='middle'%3EError%3C/text%3E%3C/svg%3E"; // Placeholder
             itemDiv.style.borderColor = 'var(--error-red)';
             console.warn(`Failed to load sign image: ${signImageUrl}`);
        }
        const nameSpan = document.createElement('span'); nameSpan.textContent = signName;
        itemDiv.appendChild(img); itemDiv.appendChild(nameSpan);

        itemDiv.addEventListener('click', () => {
            if (currentSignMode !== 'prefix') return; // Only act in prefix mode
            const clickedImageUrl = itemDiv.dataset.imageUrl;
            const clickedSignName = itemDiv.dataset.signName;

            if (selectedSignItem && selectedSignItem !== itemDiv) selectedSignItem.classList.remove('selected'); // Deselect previous

            if (selectedSignItem === itemDiv) { // Clicked the already selected item - deselect it
                itemDiv.classList.remove('selected');
                selectedSignItem = null;
                appliedPrefixSignImage = null;
                if(baseImage.src && baseImage.complete) drawBaseImage(); // Redraw base only
                if(savePrefixBtn) savePrefixBtn.disabled = true;
                nftStatusEl.textContent = "Sign removed."; nftStatusEl.className = '';
            } else { // Clicked a new item - select it
                itemDiv.classList.add('selected');
                selectedSignItem = itemDiv;
                applyPrefixSign(clickedImageUrl, clickedSignName); // Apply the new sign
            }
        });
        signGalleryContainer.appendChild(itemDiv);

        // Reselect if this was the previously applied sign
        if (appliedPrefixSignImage && appliedPrefixSignImage.src === signImageUrl) {
            itemDiv.classList.add('selected');
            selectedSignItem = itemDiv;
        }
    });
}


function applyPrefixSign(signImageUrl, signName) {
    if (!baseImage.src || !baseImage.complete || currentSignMode !== 'prefix') return;
    nftStatusEl.textContent = `Applying sign: ${signName}...`; nftStatusEl.className = '';
    if(savePrefixBtn) savePrefixBtn.disabled = true;
    if (container.querySelectorAll('.textOverlay, .imgOverlay').length > 0) { container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el => el.remove()); setActiveElement(null); }

    const signImage = new Image(); signImage.crossOrigin = "Anonymous";
    signImage.onload = () => {
        drawBaseImage(); ctx.drawImage(signImage, 0, 0, canvasWidth, canvasHeight);
        appliedPrefixSignImage = signImage; appliedPrefixSignImage.alt = signName; // Store name too
        nftStatusEl.textContent = `Sign '${signName}' applied. Ready to save.`; nftStatusEl.className = 'success';
        if(savePrefixBtn) savePrefixBtn.disabled = false;
    };
    signImage.onerror = () => {
        console.error(`Error loading sign image: ${signImageUrl}`); nftStatusEl.textContent = `Error loading sign: ${signName}. Check console.`; nftStatusEl.className = 'error';
        appliedPrefixSignImage = null; if (selectedSignItem) { selectedSignItem.classList.remove('selected'); selectedSignItem = null; }
        drawBaseImage(); if(savePrefixBtn) savePrefixBtn.disabled = true;
    };
    signImage.src = signImageUrl;
}

// --- Text & Image Creation (Custom Mode) ---
function addText() {
    if (currentSignMode !== 'custom') { nftStatusEl.textContent = "Switch to Custom Sign mode."; nftStatusEl.className = 'error'; return; }
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { nftStatusEl.textContent = "Load NFT first."; nftStatusEl.className = 'error'; return; }
    const textValue = textInput.value || "New Text"; const textEl = document.createElement("div"); textEl.className = "textOverlay"; textEl.appendChild(document.createTextNode(textValue));
    textEl.style.color = textColor.value; textEl.style.fontSize = `${DEFAULT_FONT_SIZE}px`; textEl.style.fontFamily = fontFamily.value;
    textEl.style.transform = `translate(-50%, -50%) rotate(0deg)`; textEl.style.zIndex = "10"; textEl.style.width = 'auto'; textEl.style.whiteSpace = 'nowrap'; // Prevent natural wrapping initially
    const rotateHandle = document.createElement("div"); rotateHandle.className = "handle rotation-handle"; rotateHandle.innerHTML = '↻'; textEl.appendChild(rotateHandle);
    const resizeHandleRight = document.createElement("div"); resizeHandleRight.className = "handle resize-handle-base resize-handle-right"; resizeHandleRight.title = "Resize Width"; textEl.appendChild(resizeHandleRight);
    const resizeHandleLeft = document.createElement("div"); resizeHandleLeft.className = "handle resize-handle-base resize-handle-left"; resizeHandleLeft.title = "Resize Font Size"; textEl.appendChild(resizeHandleLeft);
    const currentPolygon = getPolygonForSelectedCollection(); const minX = Math.min(...currentPolygon.map(p => p.x)); const maxX = Math.max(...currentPolygon.map(p => p.x)); const minY = Math.min(...currentPolygon.map(p => p.y)); const maxY = Math.max(...currentPolygon.map(p => p.y)); const signCenterXPercent = canvasWidth ? ((minX + maxX) / 2) / canvasWidth * 100 : 50; const signCenterYPercent = canvasHeight ? ((minY + maxY) / 2) / canvasHeight * 100 : 50; const { x: initialX, y: initialY } = calculateElementPosition(signCenterXPercent, signCenterYPercent);
    textEl.style.left = `${initialX}px`; textEl.style.top = `${initialY}px`;
    textEl.addEventListener("mousedown", handleTextDragStart); textEl.addEventListener("touchstart", handleTextDragStart, { passive: true });
    rotateHandle.addEventListener("mousedown", handleTextRotateStart); rotateHandle.addEventListener("touchstart", handleTextRotateStart, { passive: true });
    resizeHandleRight.addEventListener("mousedown", handleTextResizeWidthStart); resizeHandleRight.addEventListener("touchstart", handleTextResizeWidthStart, { passive: true });
    resizeHandleLeft.addEventListener("mousedown", handleTextResizeFontSizeStart); resizeHandleLeft.addEventListener("touchstart", handleTextResizeFontSizeStart, { passive: true });
    container.appendChild(textEl);
    requestAnimationFrame(() => { if (textEl && container.contains(textEl)) { const initialWidth = textEl.offsetWidth; textEl.style.width = `${Math.max(initialWidth, 30)}px`; textEl.style.whiteSpace = 'normal'; setActiveElement(textEl); } }); // Set fixed width after measuring, allow wrap
}
function addImage() {
    if (currentSignMode !== 'custom') { nftStatusEl.textContent = "Switch to Custom Sign mode."; nftStatusEl.className = 'error'; return; }
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { nftStatusEl.textContent = "Load NFT first."; nftStatusEl.className = 'error'; return; }
    if (!imageUpload || !imageUpload.files || imageUpload.files.length === 0) { nftStatusEl.textContent = "Please select an image file."; nftStatusEl.className = 'error'; return; }
    const file = imageUpload.files[0]; const reader = new FileReader();
    reader.onload = function (e) {
        const wrapper = document.createElement("div"); wrapper.className = "imgOverlay"; wrapper.style.position="absolute";wrapper.style.width="auto";wrapper.style.height="auto";wrapper.style.transform="translate(-50%, -50%) rotate(0deg)";wrapper.style.touchAction="none";wrapper.style.zIndex="20";
        const img = document.createElement("img"); img.src = e.target.result;
        img.onload = () => {
             if(container.offsetWidth > 0 && img.naturalWidth > 0 && img.naturalHeight > 0){
                 const contW = container.offsetWidth;
                 // Calculate initial size based on container width, limiting max size
                 const initialWidth = Math.min(img.naturalWidth * 0.5, contW * 0.4, 150); // Max 150px or 40% of container
                 const aspectRatio = img.naturalWidth / img.naturalHeight;
                 wrapper.style.width=`${initialWidth}px`;
                 wrapper.style.height=`${initialWidth / aspectRatio}px`;
             } else {
                 // Fallback size if container/image dimensions aren't available yet
                 wrapper.style.width='100px';
                 wrapper.style.height='auto';
                 console.warn("Could not determine container/image size for initial scaling, using fallback.");
             }
             // Position after size is set
             const currentPolygon = getPolygonForSelectedCollection(); const minX=Math.min(...currentPolygon.map(p=>p.x));const maxX=Math.max(...currentPolygon.map(p=>p.x));const minY=Math.min(...currentPolygon.map(p=>p.y));const maxY=Math.max(...currentPolygon.map(p=>p.y));const signCenterXPercent=canvasWidth?((minX+maxX)/2)/canvasWidth*100:50;const signCenterYPercent=canvasHeight?((minY+maxY)/2)/canvasHeight*100:50;const{x:initialX,y:initialY}=calculateElementPosition(signCenterXPercent,signCenterYPercent);wrapper.style.left=`${initialX}px`;wrapper.style.top=`${initialY}px`;
         };
        img.onerror = ()=>{console.error("Error loading added image.");nftStatusEl.textContent="Error displaying uploaded image.";nftStatusEl.className='error';wrapper.remove();}; wrapper.appendChild(img);
        const rotateHandle = document.createElement("div"); rotateHandle.className = "handle rotation-handle"; rotateHandle.innerHTML = '↻'; wrapper.appendChild(rotateHandle);
        const resizeHandleRight = document.createElement("div"); resizeHandleRight.className = "handle resize-handle-base resize-handle-right"; resizeHandleRight.title = "Resize Image"; wrapper.appendChild(resizeHandleRight);
        wrapper.addEventListener("mousedown", handleImageDragStart); wrapper.addEventListener("touchstart", handleImageDragStart, { passive: true }); rotateHandle.addEventListener("mousedown", handleImageRotateStart); rotateHandle.addEventListener("touchstart", handleImageRotateStart, { passive: true });
        resizeHandleRight.addEventListener("mousedown", handleImageResizeStart); resizeHandleRight.addEventListener("touchstart", handleImageResizeStart, { passive: true });
        container.appendChild(wrapper); setActiveElement(wrapper); nftStatusEl.textContent = "Image added."; nftStatusEl.className = 'success'; imageUpload.value = ''; // Clear file input
    };
    reader.onerror = function (err) { console.error("FileReader error:",err);nftStatusEl.textContent="Error reading image file.";nftStatusEl.className='error'; }
    reader.readAsDataURL(file);
 }

// --- Active Element Management & Removal (Custom Mode) ---
function setActiveElement(el) {
    if (activeElement && activeElement !== el) { activeElement.classList.remove("active"); activeElement.style.zIndex = activeElement.classList.contains('imgOverlay') ? '20' : '10'; }
    if (el && currentSignMode === 'custom' && container.contains(el)) {
        el.classList.add("active"); activeElement = el; el.style.zIndex = el.classList.contains('imgOverlay') ? '101' : '100';
        if (el.classList.contains('textOverlay')) {
             const textNode = el.childNodes[0]; if (textNode && textNode.nodeType === Node.TEXT_NODE) { textInput.value = textNode.nodeValue.trim(); } else { textInput.value = (el.textContent || '').trim(); } // Trim whitespace
             textColor.value = rgb2hex(el.style.color || '#ffffff');
             const currentFont = (el.style.fontFamily || 'Arial').split(',')[0].replace(/['"]/g, "").trim(); let foundFont = false;
             for (let option of fontFamily.options) { if (option.value.includes(currentFont)) { fontFamily.value = option.value; foundFont = true; break; } } if (!foundFont) fontFamily.value = 'Arial';
        }
    } else { activeElement = null; }
    updateCustomActionButtons(); // Update remove/save state
}
function removeActiveElement() { // Only for custom mode elements
    if (activeElement && currentSignMode === 'custom') { activeElement.remove(); setActiveElement(null); }
}

// --- Interaction Handlers (Common) ---
function getEventCoordinates(event) { let x,y; if(event.touches&&event.touches.length>0){x=event.touches[0].clientX;y=event.touches[0].clientY;}else if(event.changedTouches&&event.changedTouches.length>0){x=event.changedTouches[0].clientX;y=event.changedTouches[0].clientY;}else{x=event.clientX;y=event.clientY;} return{x,y}; }
function getRotationRad(element) { if(!element||!element.style)return 0; const transform=element.style.transform; const rotateMatch=transform.match(/rotate\((-?\d+(\.\d+)?)deg\)/); const rotationDeg=rotateMatch?parseFloat(rotateMatch[1]):0; return rotationDeg*(Math.PI/180); }

// --- Interaction Handlers (Text - Custom Mode) ---
function handleTextDragStart(event) { if (event.target.classList.contains('handle') || currentSignMode !== 'custom') return; const el = event.currentTarget; setActiveElement(el); textInteractionState.isDragging = true; textInteractionState.isRotating = false; textInteractionState.isResizingWidth = false; textInteractionState.isResizingFontSize = false; el.style.cursor = 'grabbing'; document.body.style.cursor = 'grabbing'; const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); textInteractionState.startX = coords.x - contRect.left; textInteractionState.startY = coords.y - contRect.top; textInteractionState.startLeft = parseFloat(el.style.left || "0"); textInteractionState.startTop = parseFloat(el.style.top || "0"); document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextRotateStart(event) { if (currentSignMode !== 'custom') return; event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); textInteractionState.isRotating = true; textInteractionState.isDragging = false; textInteractionState.isResizingWidth = false; textInteractionState.isResizingFontSize = false; document.body.style.cursor = 'alias'; const coords = getEventCoordinates(event); const rect = el.getBoundingClientRect(); textInteractionState.rotateCenterX = rect.left + rect.width / 2; textInteractionState.rotateCenterY = rect.top + rect.height / 2; const dx = coords.x - textInteractionState.rotateCenterX; const dy = coords.y - textInteractionState.rotateCenterY; let startAngle = Math.atan2(dy, dx); const currentRotationRad = getRotationRad(el); textInteractionState.rotateStartAngle = startAngle - currentRotationRad; document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextResizeWidthStart(event) { if (currentSignMode !== 'custom') return; event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); textInteractionState.isResizingWidth = true; textInteractionState.isResizingFontSize = false; textInteractionState.isRotating = false; textInteractionState.isDragging = false; document.body.style.cursor = 'ew-resize'; const coords = getEventCoordinates(event); textInteractionState.startX = coords.x; textInteractionState.startY = coords.y; textInteractionState.startWidth = el.offsetWidth; textInteractionState.currentRotationRad = getRotationRad(el); el.style.whiteSpace = 'normal'; // Allow wrapping during resize
    document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextResizeFontSizeStart(event) { if (currentSignMode !== 'custom') return; event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); textInteractionState.isResizingFontSize = true; textInteractionState.isResizingWidth = false; textInteractionState.isRotating = false; textInteractionState.isDragging = false; document.body.style.cursor = 'ns-resize'; const coords = getEventCoordinates(event); textInteractionState.startX = coords.x; textInteractionState.startY = coords.y; textInteractionState.startFontSize = parseFloat(el.style.fontSize) || DEFAULT_FONT_SIZE; document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextInteractionMove(event) { if (!activeElement || !activeElement.classList.contains('textOverlay') || (!textInteractionState.isDragging && !textInteractionState.isRotating && !textInteractionState.isResizingWidth && !textInteractionState.isResizingFontSize)) return; if (event.type === 'touchmove') event.preventDefault(); const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); if (textInteractionState.isDragging) { const currentX = coords.x - contRect.left; const currentY = coords.y - contRect.top; activeElement.style.left = `${textInteractionState.startLeft + (currentX - textInteractionState.startX)}px`; activeElement.style.top = `${textInteractionState.startTop + (currentY - textInteractionState.startY)}px`; } else if (textInteractionState.isRotating) { const dx = coords.x - textInteractionState.rotateCenterX; const dy = coords.y - textInteractionState.rotateCenterY; let angle = Math.atan2(dy, dx); let rotationRad = angle - textInteractionState.rotateStartAngle; let rotationDeg = rotationRad * (180 / Math.PI); activeElement.style.transform = `translate(-50%, -50%) rotate(${rotationDeg}deg)`; } else if (textInteractionState.isResizingWidth) { const dx = coords.x - textInteractionState.startX; const dy = coords.y - textInteractionState.startY; const rotation = textInteractionState.currentRotationRad; const cosR = Math.cos(rotation); const sinR = Math.sin(rotation); const projectedDx = dx * cosR + dy * sinR; let newWidth = textInteractionState.startWidth + projectedDx; activeElement.style.width = `${Math.max(30, newWidth)}px`; } else if (textInteractionState.isResizingFontSize) { const dy = coords.y - textInteractionState.startY; let newSize = textInteractionState.startFontSize - (dy * FONT_SIZE_SENSITIVITY); activeElement.style.fontSize = `${Math.max(MIN_FONT_SIZE, newSize)}px`; } }
function handleTextInteractionEnd(event) { if (activeElement && activeElement.classList.contains('textOverlay')) { activeElement.style.cursor = 'grab'; } document.body.style.cursor = 'default'; textInteractionState.isDragging = false; textInteractionState.isRotating = false; textInteractionState.isResizingWidth = false; textInteractionState.isResizingFontSize = false; document.removeEventListener("mousemove", handleTextInteractionMove); document.removeEventListener("mouseup", handleTextInteractionEnd); document.removeEventListener("touchmove", handleTextInteractionMove); document.removeEventListener("touchend", handleTextInteractionEnd); document.removeEventListener("touchcancel", handleTextInteractionEnd); }

// --- Interaction Handlers (Image - Custom Mode) ---
function handleImageDragStart(event) { if (event.target.classList.contains('handle') || currentSignMode !== 'custom') return; const el = event.currentTarget; setActiveElement(el); imageInteractionState.isDragging = true; imageInteractionState.isRotating = false; imageInteractionState.isResizing = false; el.style.cursor = 'grabbing'; document.body.style.cursor = 'grabbing'; const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); imageInteractionState.startX = coords.x - contRect.left; imageInteractionState.startY = coords.y - contRect.top; imageInteractionState.startLeft = parseFloat(el.style.left || "0"); imageInteractionState.startTop = parseFloat(el.style.top || "0"); document.addEventListener("mousemove", handleImageInteractionMove); document.addEventListener("mouseup", handleImageInteractionEnd); document.addEventListener("touchmove", handleImageInteractionMove, { passive: false }); document.addEventListener("touchend", handleImageInteractionEnd); document.addEventListener("touchcancel", handleImageInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleImageRotateStart(event) { if (currentSignMode !== 'custom') return; event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); imageInteractionState.isRotating = true; imageInteractionState.isDragging = false; imageInteractionState.isResizing = false; document.body.style.cursor = 'alias'; const coords = getEventCoordinates(event); const rect = el.getBoundingClientRect(); imageInteractionState.centerX = rect.left + rect.width / 2; imageInteractionState.centerY = rect.top + rect.height / 2; const dx = coords.x - imageInteractionState.centerX; const dy = coords.y - imageInteractionState.centerY; let startAngle = Math.atan2(dy, dx); imageInteractionState.currentRotationRad = getRotationRad(el); imageInteractionState.startAngle = startAngle - imageInteractionState.currentRotationRad; document.addEventListener("mousemove", handleImageInteractionMove); document.addEventListener("mouseup", handleImageInteractionEnd); document.addEventListener("touchmove", handleImageInteractionMove, { passive: false }); document.addEventListener("touchend", handleImageInteractionEnd); document.addEventListener("touchcancel", handleImageInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleImageResizeStart(event) { if (currentSignMode !== 'custom') return; event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); imageInteractionState.isResizing = true; imageInteractionState.isRotating = false; imageInteractionState.isDragging = false; document.body.style.cursor = 'nwse-resize'; const coords = getEventCoordinates(event); imageInteractionState.startX = coords.x; imageInteractionState.startY = coords.y; imageInteractionState.startWidth = el.offsetWidth; imageInteractionState.startHeight = el.offsetHeight; imageInteractionState.aspectRatio = imageInteractionState.startHeight > 0 ? imageInteractionState.startWidth / imageInteractionState.startHeight : 1; imageInteractionState.currentRotationRad = getRotationRad(el); const rect = el.getBoundingClientRect(); imageInteractionState.centerX = rect.left + rect.width / 2; imageInteractionState.centerY = rect.top + rect.height / 2; document.addEventListener("mousemove", handleImageInteractionMove); document.addEventListener("mouseup", handleImageInteractionEnd); document.addEventListener("touchmove", handleImageInteractionMove, { passive: false }); document.addEventListener("touchend", handleImageInteractionEnd); document.addEventListener("touchcancel", handleImageInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleImageInteractionMove(event) { if (!activeElement || !activeElement.classList.contains('imgOverlay') || (!imageInteractionState.isDragging && !imageInteractionState.isRotating && !imageInteractionState.isResizing)) return; if (event.type === 'touchmove') event.preventDefault(); const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); if (imageInteractionState.isDragging) { const currentX = coords.x - contRect.left; const currentY = coords.y - contRect.top; activeElement.style.left = `${imageInteractionState.startLeft + (currentX - imageInteractionState.startX)}px`; activeElement.style.top = `${imageInteractionState.startTop + (currentY - imageInteractionState.startY)}px`; } else if (imageInteractionState.isRotating) { const dx = coords.x - imageInteractionState.centerX; const dy = coords.y - imageInteractionState.centerY; let angle = Math.atan2(dy, dx); let rotationRad = angle - imageInteractionState.startAngle; let rotationDeg = rotationRad * (180 / Math.PI); activeElement.style.transform = `translate(-50%, -50%) rotate(${rotationDeg}deg)`; } else if (imageInteractionState.isResizing) { const startDist = Math.hypot(imageInteractionState.startX - imageInteractionState.centerX, imageInteractionState.startY - imageInteractionState.centerY); const currentDist = Math.hypot(coords.x - imageInteractionState.centerX, coords.y - imageInteractionState.centerY); const scaleFactor = startDist > 0 ? currentDist / startDist : 1; let newWidth = imageInteractionState.startWidth * scaleFactor; let newHeight = imageInteractionState.aspectRatio > 0 ? newWidth / imageInteractionState.aspectRatio : newWidth; activeElement.style.width = `${Math.max(30, newWidth)}px`; activeElement.style.height = `${Math.max(30 / imageInteractionState.aspectRatio, newHeight)}px`; } }
function handleImageInteractionEnd(event) { if (activeElement && activeElement.classList.contains('imgOverlay')) { activeElement.style.cursor = 'grab'; } document.body.style.cursor = 'default'; imageInteractionState.isDragging = false; imageInteractionState.isRotating = false; imageInteractionState.isResizing = false; document.removeEventListener("mousemove", handleImageInteractionMove); document.removeEventListener("mouseup", handleImageInteractionEnd); document.removeEventListener("touchmove", handleImageInteractionMove); document.removeEventListener("touchend", handleImageInteractionEnd); document.removeEventListener("touchcancel", handleImageInteractionEnd); }

// --- Utility Functions ---
function calculateElementPosition(percentX, percentY) { const contRect=container.getBoundingClientRect();if(!contRect||contRect.width===0||contRect.height===0)return{x:0,y:0};/*const scaleX=contRect.width/canvasWidth;const scaleY=contRect.height/canvasHeight;const targetCanvasX=canvasWidth*(percentX/100);const targetCanvasY=canvasHeight*(percentY/100);return{x:targetCanvasX*scaleX,y:targetCanvasY*scaleY};*/ return { x: contRect.width * (percentX/100), y: contRect.height * (percentY/100) }; } // Simplified: Position relative to container %
function getCanvasCoordsFromContainerPoint(containerX, containerY) { const contRect=container.getBoundingClientRect();if(!contRect||contRect.width===0||contRect.height===0)return{canvasX:0,canvasY:0};const scaleX=canvasWidth/contRect.width; const scaleY=canvasHeight/contRect.height; return{canvasX:containerX*scaleX,canvasY:containerY*scaleY};}
function pointInPolygon(point, vs) { const x = point.x, y = point.y; let inside = false; for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) { const xi = vs[i].x, yi = vs[i].y; const xj = vs[j].x, yj = vs[j].y; const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi); if (intersect) inside = !inside; } return inside; }
function rgb2hex(rgb) { if(!rgb)return'#ffffff'; if(rgb.startsWith('#'))return rgb; const rgbMatch=rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/); if(rgbMatch){return"#"+rgbMatch.slice(1).map(x=>parseInt(x).toString(16).padStart(2,'0')).join('');} return rgb; }

// --- Text Wrapping Calculation for Canvas (Custom Mode) ---
function getWrappedTextLines(text, maxWidthPx, fontStyle) {
    if (!text) return [];
    ctx.font = fontStyle; // Ensure context has the correct font for measurement
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        // Handle potential multiple spaces or leading/trailing spaces in words if needed
        const testLine = currentLine ? currentLine + " " + word : word;
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth <= maxWidthPx || !currentLine) { // If fits, or if it's the first word on the line
            currentLine = testLine;
        } else {
            // Doesn't fit, push the previous line and start a new one
            lines.push(currentLine);
            currentLine = word;
            // Check if the single word itself exceeds the max width
            if (ctx.measureText(currentLine).width > maxWidthPx) {
                // Basic character wrapping (could be improved for hyphenation)
                let tempLine = '';
                for(let char of currentLine) {
                    if(ctx.measureText(tempLine + char).width > maxWidthPx) {
                        lines.push(tempLine);
                        tempLine = char;
                    } else {
                        tempLine += char;
                    }
                }
                currentLine = tempLine; // The remaining part of the word becomes the current line start
            }
        }
    }
    if (currentLine) { // Push the last line
        lines.push(currentLine);
    }
    return lines;
}


// --- Save Functionality (Unified) ---
function saveImage() {
    const currentNftId = nftTokenIdInput.value || 'unknown';
    const currentCollection = nftCollectionSelect.value || 'unknown';

    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { alert("Load a valid NFT first!"); nftStatusEl.className = 'error'; nftStatusEl.textContent = "NFT not loaded for saving."; return; }
    if (currentSignMode === 'prefix' && !appliedPrefixSignImage) { alert("Select a sign from the gallery before saving."); nftStatusEl.className = 'error'; nftStatusEl.textContent = "No sign selected from gallery."; return; }

    nftStatusEl.textContent = `Generating final image...`; nftStatusEl.className = '';
    const previouslyActive = activeElement; if (activeElement) setActiveElement(null); // Deselect custom element for clean render

    // --- Start Drawing ---
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    drawBaseImage(); // 1. Base NFT

    if (currentSignMode === 'prefix' && appliedPrefixSignImage && appliedPrefixSignImage.complete) {
         // 2. Applied Prefix Sign
        try { ctx.drawImage(appliedPrefixSignImage, 0, 0, canvasWidth, canvasHeight); } catch (e) { console.error("Error drawing prefix sign during save:", e); }
    } else if (currentSignMode === 'custom') {
        // 2. Custom Sign Background Color
        if (overlayColorInput.value) drawSignPolygonOnly();

        // 3. Custom Overlays (Text/Images)
        // We need the *display* container's rect to scale DOM element positions to canvas coordinates
        const containerRect = container.getBoundingClientRect();
        if (!containerRect || containerRect.width === 0 || containerRect.height === 0) { console.error("Error getting container rect during save"); nftStatusEl.className='error'; nftStatusEl.textContent="Save Error: Container rect invalid."; if(previouslyActive) setActiveElement(previouslyActive); return; }
        const scaleX = canvasWidth / containerRect.width;
        const scaleY = canvasHeight / containerRect.height;

        const allOverlays = Array.from(container.querySelectorAll(".textOverlay, .imgOverlay"));
        // Sort by z-index to draw in correct order (lower z-index first)
        allOverlays.sort((a, b) => (parseInt(window.getComputedStyle(a).zIndex) || 0) - (parseInt(window.getComputedStyle(b).zIndex) || 0));

        allOverlays.forEach(el => {
            const elRect = el.getBoundingClientRect();
            const rotationRad = getRotationRad(el);
            // Calculate center relative to the container top-left
            const relativeCenterX = (elRect.left + elRect.width / 2) - containerRect.left;
            const relativeCenterY = (elRect.top + elRect.height / 2) - containerRect.top;
            // Scale the relative center to canvas coordinates
            const canvasX = Math.round(relativeCenterX * scaleX);
            const canvasY = Math.round(relativeCenterY * scaleY);

            ctx.save();
            ctx.translate(canvasX, canvasY); // Move origin to element center on canvas
            ctx.rotate(rotationRad);        // Rotate around the new origin

            if (el.classList.contains('textOverlay')) {
                const textNode = el.childNodes[0];
                const text = textNode && textNode.nodeType === Node.TEXT_NODE ? textNode.nodeValue : (el.textContent || '');
                const color = el.style.color || '#ffffff';
                const size = parseFloat(el.style.fontSize) || DEFAULT_FONT_SIZE;
                const font = el.style.fontFamily || 'Arial';
                const domWidth = el.offsetWidth; // Use the actual rendered width of the DOM element

                // Scale font size and width based on container->canvas scaling
                const canvasFontSize = Math.round(size * scaleY); // Scale font based on height ratio
                const canvasMaxWidth = Math.round(domWidth * scaleX); // Scale available width based on width ratio

                const fontStyle = `${canvasFontSize}px ${font}`;
                ctx.font = fontStyle;
                ctx.fillStyle = color;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";

                const lines = getWrappedTextLines(text, canvasMaxWidth, fontStyle);
                const lineHeight = canvasFontSize * 1.2; // Approximate line height
                const totalTextHeight = lines.length * lineHeight;
                let currentY = -(totalTextHeight / 2) + (lineHeight / 2); // Start drawing from top

                lines.forEach(line => {
                    ctx.fillText(line, 0, currentY); // Draw centered horizontally at the translated origin
                    currentY += lineHeight;
                });

            } else if (el.classList.contains('imgOverlay')) {
                const imgElement = el.querySelector('img');
                if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
                    const domWidth = el.offsetWidth;
                    const domHeight = el.offsetHeight;
                    // Scale DOM dimensions to canvas dimensions
                    const canvasDrawWidth = Math.round(domWidth * scaleX);
                    const canvasDrawHeight = Math.round(domHeight * scaleY);

                    if (canvasDrawWidth > 0 && canvasDrawHeight > 0) {
                        try {
                            // Draw the image centered at the translated/rotated origin
                            ctx.drawImage(imgElement, -canvasDrawWidth / 2, -canvasDrawHeight / 2, canvasDrawWidth, canvasDrawHeight);
                        } catch (e) {
                            console.error("Error drawing image overlay during save:", e);
                        }
                    }
                } else {
                    console.warn("Skipping unloaded/invalid image overlay during save:", imgElement?.src);
                }
            }
            ctx.restore(); // Restore context state (translation, rotation)
        });
    }
    // --- End Drawing ---

    // --- Generate Download Link ---
    try {
        const dataURL = canvas.toDataURL("image/png"); const link = document.createElement("a");
        let filename = "";
        if (currentSignMode === 'prefix' && appliedPrefixSignImage) {
            const signName = appliedPrefixSignImage.alt || 'sign'; // Use stored name
            const safeSignName = signName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            filename = `signed-${currentCollection}-${currentNftId}-${safeSignName}.png`;
        } else { filename = `custom-${currentCollection}-${currentNftId}.png`; }
        link.download = filename; link.href = dataURL; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        nftStatusEl.textContent = `Image saved as ${filename}!`; nftStatusEl.className = 'success';
    } catch (e) {
        console.error("Error saving image:", e); nftStatusEl.className = 'error';
        if (e.name === "SecurityError") { alert("Save Error: Cannot save due to cross-origin image security restrictions. Ensure NFT/Sign images allow anonymous access (CORS)."); nftStatusEl.textContent = "Save Error: CORS issue."; }
        else { alert("An error occurred saving the image."); nftStatusEl.textContent = "Save Error."; }
    }

     // --- Restore Canvas View ---
     // Use setTimeout to allow the download prompt to appear before redrawing
     setTimeout(() => {
         if (baseImage.src && baseImage.complete) {
             if (currentSignMode === 'prefix' && appliedPrefixSignImage) {
                 // Redraw base + prefix sign
                 drawBaseImage();
                 ctx.drawImage(appliedPrefixSignImage, 0, 0, canvasWidth, canvasHeight);
             }
             else if (currentSignMode === 'custom') {
                 // Redraw base + custom polygon (overlays are still in DOM)
                 applyOverlay(false);
             }
             else {
                 // Just redraw base image if no mode active or no sign applied
                 drawBaseImage();
             }
         } else {
             clearCanvas(); // Clear if base image isn't loaded
         }
         // Restore the previously active element's visual state if it exists
         if (previouslyActive && container.contains(previouslyActive)) {
             setActiveElement(previouslyActive);
         }
     }, 100); // 100ms delay
} // End saveImage function