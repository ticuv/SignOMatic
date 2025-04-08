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
        // Clear overlays or prefix sign when collection changes after load
        if (baseImage.src && baseImage.complete) { // Only clear if an NFT is loaded
            if (currentSignMode === 'custom' && container.querySelectorAll('.textOverlay, .imgOverlay').length > 0) {
                container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el => el.remove());
                setActiveElement(null); // Deselect and update buttons
                applyOverlay(false); // Redraw base + polygon
            } else if (currentSignMode === 'prefix') {
                appliedPrefixSignImage = null; // Clear applied sign state
                if (selectedSignItem) {
                    selectedSignItem.classList.remove('selected');
                    selectedSignItem = null;
                }
                drawBaseImage(); // Redraw just the base
                if(savePrefixBtn) savePrefixBtn.disabled = true; // Disable save on collection change
                populateSignGallery(); // Repopulate gallery for new collection
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
    removeBtn.addEventListener('click', removeActiveElement); // Correctly linked

    // General Actions
    resetCanvasBtn.addEventListener('click', handleReset);
    saveFullBtn.addEventListener('click', saveImage); // Custom Save
    savePrefixBtn.addEventListener('click', saveImage); // Prefix Save (uses same function)

     // Deselect active element when clicking outside
     document.addEventListener('click', (event) => {
        // Verifică dacă click-ul este în afara containerului principal sau direct pe container/canvas
        const clickedInsideContainer = container.contains(event.target);
        const clickedOnContainerOrCanvas = event.target === container || event.target === canvas;

        if (!clickedInsideContainer || clickedOnContainerOrCanvas) {
             // Click în afara zonei de interes (overlays)
             if (activeElement && currentSignMode === 'custom') {
                 setActiveElement(null); // Deselectează elementul activ
             }
        } else {
             // Click în interiorul containerului, dar verificăm dacă NU e pe un overlay activ sau handle-ul său
             if (activeElement && !activeElement.contains(event.target)) {
                 // Verifică dacă targetul NU este un overlay (text sau imagine)
                 const clickedOverlay = event.target.closest('.textOverlay, .imgOverlay');
                 if (!clickedOverlay && currentSignMode === 'custom') {
                     // Click pe fundalul containerului, dar nu pe un overlay
                     setActiveElement(null); // Deselectează elementul activ
                 }
                 // Dacă s-a dat click pe un *alt* overlay, funcția lui `handle...DragStart` va apela `setActiveElement`
             }
        }
     }, true); // Folosește faza de captură pentru a prinde click-ul devreme
}

// --- Workflow Management ---
function setControlsDisabled(isDisabled) {
    const customControls = [overlayColorInput, textInput, textColor, fontFamily, addTextBtn, imageUpload, addImageBtn, removeBtn, saveFullBtn];
    const signChoiceRadios = [signTypePrefixRadio, signTypeCustomRadio];
    const prefixControls = [savePrefixBtn];

    customControls.forEach(el => { if(el) el.disabled = isDisabled; });
    prefixControls.forEach(el => { if(el) el.disabled = isDisabled; });
    signChoiceRadios.forEach(el => { if(el) el.disabled = isDisabled; });

    // Ensure action buttons are definitely disabled if 'isDisabled' is true
    if (isDisabled) {
        if(removeBtn) removeBtn.disabled = true;
        if(saveFullBtn) saveFullBtn.disabled = true;
        if(savePrefixBtn) savePrefixBtn.disabled = true;
    }
    // Specific enabling logic happens in setSignMode and updateCustomActionButtons
}

function setSignMode(mode) {
    // Clear things from the *other* mode when switching
    if (mode === 'prefix' && currentSignMode === 'custom' && activeElement) {
        container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el => el.remove());
        setActiveElement(null); // Deselect and update buttons
    } else if (mode === 'custom' && currentSignMode === 'prefix' && appliedPrefixSignImage) {
        appliedPrefixSignImage = null; // Clear applied sign state
        if (selectedSignItem) {
            selectedSignItem.classList.remove('selected');
            selectedSignItem = null;
        }
        // Redraw base image only (custom overlay will be applied shortly if needed)
        if (baseImage.src && baseImage.complete) drawBaseImage();
    }

    currentSignMode = mode; // Set the new mode
    nftStatusEl.textContent = `Mode selected: ${mode === 'prefix' ? 'Signs Gallery' : 'Custom Sign'}.`;
    nftStatusEl.className = '';

    // Toggle visibility of control groups
    prefixOptionsGroup.classList.toggle('hidden', mode !== 'prefix');
    customOptionsGroup.classList.toggle('hidden', mode !== 'custom');

    // Disable all action controls initially after mode switch
    setControlsDisabled(true);
    // Re-enable the radio buttons themselves
    signTypePrefixRadio.disabled = false;
    signTypeCustomRadio.disabled = false;

    // Enable controls specific to the selected mode
    if (mode === 'prefix') {
         if (baseImage.src && baseImage.complete) { // Only if NFT is loaded
             // Restore applied sign view if it exists
             if(appliedPrefixSignImage && appliedPrefixSignImage.complete) {
                 drawBaseImage();
                 ctx.drawImage(appliedPrefixSignImage, 0, 0, canvasWidth, canvasHeight);
                 if(savePrefixBtn) savePrefixBtn.disabled = false; // Enable save if sign is applied
             } else {
                 drawBaseImage(); // Just show base image
                 if(savePrefixBtn) savePrefixBtn.disabled = true; // No sign applied, disable save
             }
             populateSignGallery(); // Load/refresh gallery content
         } else { // No NFT loaded
             if(signGalleryContainer) signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--error-red);">Load NFT first.</p>';
             if(savePrefixBtn) savePrefixBtn.disabled = true;
         }
    } else if (mode === 'custom') {
         if (baseImage.src && baseImage.complete) { // Only if NFT is loaded
            const customEditControls = [overlayColorInput, textInput, textColor, fontFamily, addTextBtn, imageUpload, addImageBtn];
            customEditControls.forEach(el => { if(el) el.disabled = false; });
            applyOverlay(false); // Redraw base + color polygon
            updateCustomActionButtons(); // Update remove/save based on current state (activeElement, imageLoaded)
         } else {
            // NFT not loaded, keep custom controls disabled except radios
            updateCustomActionButtons(); // Ensure remove/save are disabled
         }
    }
}

// MODIFIED: Update button states, especially for CUSTOM mode
function updateCustomActionButtons() {
    const isImageLoaded = baseImage.src !== "" && baseImage.complete && baseImage.naturalWidth > 0;

    if (currentSignMode === 'custom') {
        // Verifică dacă un element custom este activ ȘI în container
        const isElementActive = activeElement !== null && container.contains(activeElement);

        // Activează/dezactivează butonul de ștergere (necesită element activ ȘI imagine încărcată)
        if(removeBtn) {
            removeBtn.disabled = !isElementActive || !isImageLoaded;
        }

        // Activează/dezactivează butonul de salvare general (necesită doar imaginea NFT încărcată)
        if(saveFullBtn) {
            saveFullBtn.disabled = !isImageLoaded;
        }
    } else {
        // If not in custom mode, ensure custom buttons are disabled
        if(removeBtn) removeBtn.disabled = true;
        // Keep saveFullBtn disabled if not in custom mode
        if(saveFullBtn) saveFullBtn.disabled = true;
    }

    // Update prefix save button state (independent of custom logic)
    if(savePrefixBtn) {
        savePrefixBtn.disabled = !(currentSignMode === 'prefix' && appliedPrefixSignImage && isImageLoaded);
    }
}


// --- Event Handlers ---
function handleTextControlChange() {
    if (activeElement && activeElement.classList.contains('textOverlay') && currentSignMode === 'custom') {
        const textNode = activeElement.childNodes[0];
        if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            textNode.nodeValue = textInput.value || " "; // Use space if empty to maintain element size
        } else {
            // Fallback if first child is not a text node (shouldn't happen with current setup)
            let firstChild = activeElement.firstChild;
             while (firstChild && firstChild.nodeType !== Node.TEXT_NODE && !firstChild.classList?.contains('handle')) {
                 firstChild = firstChild.nextSibling; // Find the text node, skipping handles
             }
             if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
                 firstChild.nodeValue = textInput.value || " ";
             } else { // If no text node found, create one before handles
                 activeElement.insertBefore(document.createTextNode(textInput.value || " "), activeElement.querySelector('.handle'));
             }
        }
        activeElement.style.color = textColor.value;
        activeElement.style.fontFamily = fontFamily.value;

        // Auto-adjust width after text change - keep existing width if manually set
        requestAnimationFrame(() => {
             if(activeElement && activeElement.classList.contains('textOverlay') && container.contains(activeElement)) {
                 const originalWidthStyle = activeElement.style.width;
                 const hadManualWidth = originalWidthStyle && originalWidthStyle !== 'auto';
                 activeElement.style.width = 'auto'; // Let it expand naturally
                 const naturalWidth = activeElement.offsetWidth;
                 // Restore previous width OR set to natural width if it was 'auto' or not set
                 activeElement.style.width = hadManualWidth ? originalWidthStyle : `${Math.max(30, naturalWidth)}px`;
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
        // Clear custom controls input fields
        if (textInput) textInput.value = '';
        if (imageUpload) imageUpload.value = ''; // Clear file selection

        if (baseImage.src && baseImage.complete && baseImage.naturalWidth > 0) {
            drawBaseImage(); // Redraw only base image
            signTypeChoiceGroup.classList.remove('hidden');
            signTypePrefixRadio.disabled = false; signTypeCustomRadio.disabled = false;
            signTypePrefixRadio.checked = false; signTypeCustomRadio.checked = false;
            prefixOptionsGroup.classList.add('hidden'); customOptionsGroup.classList.add('hidden');
            currentSignMode = null; // Reset mode
            setControlsDisabled(true); // Disables all action buttons initially
            signTypePrefixRadio.disabled = false; signTypeCustomRadio.disabled = false; // Re-enable radios
            nftStatusEl.textContent = "Canvas reset. Choose sign type."; nftStatusEl.className = '';
            if(signGalleryContainer) signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--portal-blue);">Loading gallery...</p>';
            // Re-fetch config in case it failed before, needed if user selects prefix again
            if (!signConfigData) fetchSignConfig();

        } else {
            // No base image loaded, just reset to initial state
            enableNftLoadControlsOnly();
            nftStatusEl.textContent = "Select collection and ID, then load NFT."; nftStatusEl.className = '';
        }
    }
}

// --- Canvas & Overlay Management ---
function clearCanvasAndOverlays() { // Primarily for custom overlays
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#444'; // Use a default background
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    // Remove only custom overlays
    container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el => el.remove());
    setActiveElement(null); // Deselect any active custom element
}
function clearCanvas() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}
function enableNftLoadControlsOnly() {
    setControlsDisabled(true); // Disable everything first
    // Enable only NFT loading controls
    if(loadNftBtn) loadNftBtn.disabled = false;
    if(nftCollectionSelect) nftCollectionSelect.disabled = false;
    if(nftTokenIdInput) nftTokenIdInput.disabled = false;
    // Hide mode-specific sections
    if(signTypeChoiceGroup) signTypeChoiceGroup.classList.add('hidden');
    if(prefixOptionsGroup) prefixOptionsGroup.classList.add('hidden');
    if(customOptionsGroup) customOptionsGroup.classList.add('hidden');
    currentSignMode = null; // Reset mode state
}

// --- NFT Loading & Drawing ---
function getPolygonForSelectedCollection(){ const selectedCollection=nftCollectionSelect.value; if(selectedCollection==="AHC"){return[{x:1415,y:316},{x:2024,y:358},{x:1958,y:1324},{x:1358,y:1286}];}else{/* GHN default */ return[{x:1403,y:196},{x:2034,y:218},{x:1968,y:1164},{x:1358,y:1126}];} }
function resolveIpfsUrl(url) { if(url&&url.startsWith("ipfs://")){
    // Use a reliable public gateway
    return url.replace("ipfs://","https://ipfs.io/ipfs/");
    // Alternative: return url.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
    // Alternative: return url.replace("ipfs://", "https://cloudflare-ipfs.com/ipfs/");
    } return url;
}
async function loadNftToCanvas() {
    const selectedCollection = nftCollectionSelect.value;
    const tokenId = nftTokenIdInput.value;
    if (!tokenId || parseInt(tokenId) < 0) { // Added check for negative ID
         nftStatusEl.textContent = "Please enter a valid, non-negative Token ID."; nftStatusEl.className = 'error'; return;
    }
    if (!nftContracts[selectedCollection]) { console.error(`Selected collection "${selectedCollection}" not found.`); nftStatusEl.textContent = `Error: Collection definition "${selectedCollection}" not found.`; nftStatusEl.className = 'error'; return; }

    // Clear previous state thoroughly
    clearCanvasAndOverlays();
    appliedPrefixSignImage = null;
    if (selectedSignItem) { selectedSignItem.classList.remove('selected'); selectedSignItem = null; }
    baseImage = new Image(); // Reset base image object

    // Update UI state for loading
    loadNftBtn.disabled = true; nftCollectionSelect.disabled = true; nftTokenIdInput.disabled = true;
    setControlsDisabled(true);
    signTypeChoiceGroup.classList.add('hidden'); prefixOptionsGroup.classList.add('hidden'); customOptionsGroup.classList.add('hidden');
    nftStatusEl.textContent = `Loading ${nftContracts[selectedCollection].name} #${tokenId}...`; nftStatusEl.className = '';
    clearCanvas(); // Show blank canvas during load

    const contractInfo = nftContracts[selectedCollection];
    const contract = new ethers.Contract(contractInfo.address, nftAbi, provider);
    try {
        // Fetch Token URI
        let tokenURI;
        try {
            tokenURI = await contract.tokenURI(tokenId);
        } catch (contractError) {
            // Handle specific contract errors like non-existent token
            console.error(`Contract error fetching URI for ${tokenId}:`, contractError);
            if (contractError.message?.includes('invalid token ID') || contractError.message?.includes('URI query for nonexistent token')) {
                throw new Error(`Token ID ${tokenId} invalid or does not exist for ${contractInfo.name}.`);
            } else if (contractError.code === 'CALL_EXCEPTION') {
                 throw new Error(`Contract call failed. Check network/address or if Token ID ${tokenId} exists.`);
            }
            throw contractError; // Re-throw other contract errors
        }
        tokenURI = resolveIpfsUrl(tokenURI);
        if (!tokenURI) throw new Error("Received empty Token URI from contract.");

        // Fetch Metadata
        nftStatusEl.textContent = "Fetching metadata...";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
        const response = await fetch(tokenURI, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Metadata fetch error: ${response.status} ${response.statusText} (URL: ${tokenURI.substring(0, 100)}...)`);
        const metadata = await response.json();

        // Get and Resolve Image URL
        let imageUrl = resolveIpfsUrl(metadata.image || metadata.image_url || metadata.imageUrl || metadata.uri); // Added metadata.uri as fallback
        if (!imageUrl) throw new Error("Image URL missing in metadata");
         // Handle cases where metadata itself points to another JSON (common with Arweave)
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


        // Load Image
        nftStatusEl.textContent = "Loading image...";
        baseImage = new Image(); // Create new image object
        baseImage.crossOrigin = "Anonymous"; // Essential for canvas saving

        baseImage.onload = () => {
            nftStatusEl.textContent = "Drawing image...";
            drawBaseImage();
            nftStatusEl.textContent = `${nftContracts[selectedCollection].name} #${tokenId} loaded! Choose sign type below.`;
            nftStatusEl.className = 'success';
            // Enable next steps
            signTypeChoiceGroup.classList.remove('hidden');
            signTypePrefixRadio.disabled = false; signTypeCustomRadio.disabled = false;
            signTypePrefixRadio.checked = false; signTypeCustomRadio.checked = false;
            currentSignMode = null; // Reset mode choice
            // Re-enable NFT load controls
            loadNftBtn.disabled = false; nftCollectionSelect.disabled = false; nftTokenIdInput.disabled = false;
            // Fetch sign config if not already loaded
            if (!signConfigData) fetchSignConfig();
        };
        baseImage.onerror = (err) => {
             console.error("Error loading NFT image:", err, "Attempted URL:", imageUrl);
             nftStatusEl.textContent = `Error loading image. Check console. (URL: ${imageUrl.substring(0,100)}...)`;
             nftStatusEl.className = 'error';
             enableNftLoadControlsOnly();
             // Display error on canvas
             ctx.fillStyle = "white"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("Image Load Error", canvasWidth / 2, canvasHeight / 2);
        };
        baseImage.src = imageUrl;

    } catch (err) {
         console.error(`Error processing NFT ${tokenId}:`, err);
         let errorMsg = "Error: " + err.message;
         // Refine error messages based on error type
         if (err.name === 'AbortError') { errorMsg = "Error: Request timed out."; }
         // Keep specific messages from contract/metadata errors
         nftStatusEl.textContent = errorMsg;
         nftStatusEl.className = 'error';
         enableNftLoadControlsOnly(); // Allow user to try again
         // Display error on canvas
         ctx.fillStyle = "white"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("NFT Load Error", canvasWidth / 2, canvasHeight / 2);
    }
 }
function drawBaseImage() {
    if(!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) {
        console.warn("drawBaseImage called with incomplete or invalid image.");
        clearCanvas(); // Ensure canvas is clear if image is bad
        return;
    }
    ctx.clearRect(0,0,canvasWidth,canvasHeight);
    ctx.fillStyle="#444"; // Background color for letterboxing
    ctx.fillRect(0,0,canvasWidth,canvasHeight);

    // Calculate aspect ratios
    const canvasAspect = canvasWidth / canvasHeight;
    const imageAspect = baseImage.naturalWidth / baseImage.naturalHeight;

    let drawWidth, drawHeight, x, y;

    // Determine dimensions to fit image within canvas while maintaining aspect ratio
    if (imageAspect > canvasAspect) {
        // Image is wider than canvas aspect ratio (letterbox top/bottom)
        drawWidth = canvasWidth;
        drawHeight = drawWidth / imageAspect;
        x = 0;
        y = (canvasHeight - drawHeight) / 2;
    } else {
        // Image is taller than canvas aspect ratio (letterbox left/right)
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
        // Optionally draw an error message on canvas
        ctx.fillStyle = "red"; ctx.font = "30px Arial"; ctx.textAlign = "center";
        ctx.fillText("Draw Error", canvasWidth / 2, canvasHeight / 2);
    }
}
function applyOverlay(clearExistingOverlays = true) { // For CUSTOM sign color overlay
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0 || currentSignMode !== 'custom') return;
    // Redraw the base image first
    drawBaseImage();
    // Then draw the polygon overlay on top
    drawSignPolygonOnly();
}
function drawSignPolygonOnly() {
    // Only draw if in custom mode and NFT is loaded
    if (currentSignMode !== 'custom' || !baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) return;

    const color = overlayColorInput.value;
    const currentPolygon = getPolygonForSelectedCollection();
    if (!currentPolygon || currentPolygon.length < 3) return; // Need at least 3 points

    ctx.save(); // Save context state
    ctx.beginPath();
    ctx.moveTo(currentPolygon[0].x, currentPolygon[0].y);
    for (let i = 1; i < currentPolygon.length; i++) {
        ctx.lineTo(currentPolygon[i].x, currentPolygon[i].y);
    }
    ctx.closePath();

    // Apply fill and stroke
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineJoin = "round";
    ctx.lineWidth = 14; // Consider making this relative or a constant
    ctx.strokeStyle = "black";
    ctx.stroke();
    ctx.restore(); // Restore context state
}

// --- Sign Gallery Functions ---
async function fetchSignConfig() {
    if (signConfigData || isSignConfigLoading) return signConfigData;
    isSignConfigLoading = true;
    const configUrl = SIGNS_JSON_PATH;
    try {
        nftStatusEl.textContent = "Loading sign gallery configuration..."; nftStatusEl.className = '';
        const response = await fetch(configUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status} fetching ${configUrl}`);
        signConfigData = await response.json();
        // Basic validation of the config structure
        if (!signConfigData.githubUser || !signConfigData.githubRepo || !signConfigData.githubBranch || !signConfigData.imageBasePath || typeof signConfigData.categories !== 'object') {
            throw new Error("Invalid signs.json structure.");
        }
        nftStatusEl.textContent = "Sign gallery configuration loaded."; nftStatusEl.className = 'success';
        // If user is already in prefix mode, populate the gallery now
        if (currentSignMode === 'prefix') populateSignGallery();
        return signConfigData;
    } catch (error) {
        console.error("Error fetching/parsing sign config:", error);
        nftStatusEl.textContent = `Error loading sign gallery: ${error.message}. Check console.`; nftStatusEl.className = 'error';
        if (signGalleryContainer) signGalleryContainer.innerHTML = `<p style="color: var(--error-red);">Error loading signs config. Check console.</p>`;
        signConfigData = null; // Reset config data on error
        return null;
    } finally {
        isSignConfigLoading = false;
    }
}

function populateSignGallery() {
    if (!signGalleryContainer) return;

    // Handle loading/error states for config
    if (isSignConfigLoading) { signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--portal-blue);">Loading gallery config...</p>'; return; }
    if (!signConfigData) {
        // Attempt to fetch config if missing
        fetchSignConfig().then(config => {
            if (config) {
                populateSignGallery(); // Retry populating after successful fetch
            } else {
                // Display error if fetch failed
                signGalleryContainer.innerHTML = '<p style="color: var(--error-red);">Failed to load gallery config.</p>';
            }
        });
        signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--portal-blue);">Fetching gallery config...</p>';
        return;
    }
    // Handle state where NFT is not loaded
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) {
        signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--error-red);">Load NFT first.</p>';
        return;
    }

    const currentCollectionKey = nftCollectionSelect.value;
    const signsForCollection = signConfigData.categories[currentCollectionKey];
    signGalleryContainer.innerHTML = ''; // Clear previous content (loading message, old signs)

    if (!signsForCollection || !Array.isArray(signsForCollection) || signsForCollection.length === 0) {
        signGalleryContainer.innerHTML = `<p style="font-style: italic;">No specific signs found for ${nftContracts[currentCollectionKey]?.name || currentCollectionKey}.</p>`;
        return;
    }

    const { githubUser, githubRepo, githubBranch, imageBasePath } = signConfigData;
    const baseUrl = `https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${githubBranch}/${imageBasePath}/`;

    signsForCollection.forEach(sign => {
        if (!sign.fileName) {
            console.warn("Skipping sign entry with missing fileName:", sign);
            return; // Skip invalid entries
        }
        const signImageUrl = baseUrl + sign.fileName;
        const signName = sign.name || sign.fileName.split('/').pop().split('.')[0]; // Better default name derivation

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
             // Simple SVG placeholder for error
             img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 40'%3E%3Crect width='50' height='40' fill='%23555'/%3E%3Ctext x='50%' y='50%' fill='red' font-size='9' dominant-baseline='middle' text-anchor='middle'%3EError%3C/text%3E%3C/svg%3E";
             itemDiv.style.borderColor = 'var(--error-red)';
             console.warn(`Failed to load sign image: ${signImageUrl}`);
        };
        const nameSpan = document.createElement('span');
        nameSpan.textContent = signName;

        itemDiv.appendChild(img);
        itemDiv.appendChild(nameSpan);

        itemDiv.addEventListener('click', () => {
            if (currentSignMode !== 'prefix') return; // Only act in prefix mode
            const clickedImageUrl = itemDiv.dataset.imageUrl;
            const clickedSignName = itemDiv.dataset.signName;

            // Deselect previous if different
            if (selectedSignItem && selectedSignItem !== itemDiv) {
                selectedSignItem.classList.remove('selected');
            }

            if (selectedSignItem === itemDiv) { // Clicked the already selected item - deselect it
                itemDiv.classList.remove('selected');
                selectedSignItem = null;
                appliedPrefixSignImage = null;
                if(baseImage.src && baseImage.complete) drawBaseImage(); // Redraw base only
                if(savePrefixBtn) savePrefixBtn.disabled = true; // Disable save
                nftStatusEl.textContent = "Sign removed."; nftStatusEl.className = '';
            } else { // Clicked a new item - select it
                itemDiv.classList.add('selected');
                selectedSignItem = itemDiv;
                applyPrefixSign(clickedImageUrl, clickedSignName); // Apply the new sign
            }
        });
        signGalleryContainer.appendChild(itemDiv);

        // Reselect if this was the previously applied sign (e.g., after collection change and back)
        if (appliedPrefixSignImage && appliedPrefixSignImage.src === signImageUrl) {
            itemDiv.classList.add('selected');
            selectedSignItem = itemDiv;
             // Ensure save button is enabled if sign is re-selected
             if (savePrefixBtn && baseImage.complete && baseImage.naturalWidth > 0) {
                savePrefixBtn.disabled = false;
             }
        }
    });
     // Ensure save button state is correct after populating
     updateCustomActionButtons();
}


function applyPrefixSign(signImageUrl, signName) {
    if (!baseImage.src || !baseImage.complete || currentSignMode !== 'prefix') return;
    nftStatusEl.textContent = `Applying sign: ${signName}...`; nftStatusEl.className = '';
    if(savePrefixBtn) savePrefixBtn.disabled = true; // Disable save during load
    // Clear any custom overlays if they somehow exist
    if (container.querySelectorAll('.textOverlay, .imgOverlay').length > 0) {
        container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el => el.remove());
        setActiveElement(null);
    }

    const signImage = new Image();
    signImage.crossOrigin = "Anonymous"; // Essential for canvas saving
    signImage.onload = () => {
        drawBaseImage(); // Redraw base first
        ctx.drawImage(signImage, 0, 0, canvasWidth, canvasHeight); // Draw sign over it
        appliedPrefixSignImage = signImage; // Store reference to the loaded sign
        appliedPrefixSignImage.alt = signName; // Store name for saving filename
        nftStatusEl.textContent = `Sign '${signName}' applied. Ready to save.`;
        nftStatusEl.className = 'success';
        if(savePrefixBtn) savePrefixBtn.disabled = false; // Enable save now
    };
    signImage.onerror = () => {
        console.error(`Error loading sign image: ${signImageUrl}`);
        nftStatusEl.textContent = `Error loading sign: ${signName}. Check console.`;
        nftStatusEl.className = 'error';
        appliedPrefixSignImage = null; // Reset state on error
        // Deselect item in gallery if it was selected
        if (selectedSignItem && selectedSignItem.dataset.imageUrl === signImageUrl) {
            selectedSignItem.classList.remove('selected');
            selectedSignItem = null;
        }
        drawBaseImage(); // Go back to just base image
        if(savePrefixBtn) savePrefixBtn.disabled = true; // Disable save
    };
    signImage.src = signImageUrl;
}

// --- Text & Image Creation (Custom Mode) ---
function addText() {
    if (currentSignMode !== 'custom') { nftStatusEl.textContent = "Switch to Custom Sign mode."; nftStatusEl.className = 'error'; return; }
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { nftStatusEl.textContent = "Load NFT first."; nftStatusEl.className = 'error'; return; }

    const textValue = textInput.value || "New Text";
    const textEl = document.createElement("div");
    textEl.className = "textOverlay";
    // Create the text node and append it
    const textNode = document.createTextNode(textValue);
    textEl.appendChild(textNode);

    // Apply styles
    textEl.style.color = textColor.value;
    textEl.style.fontSize = `${DEFAULT_FONT_SIZE}px`;
    textEl.style.fontFamily = fontFamily.value;
    textEl.style.transform = `translate(-50%, -50%) rotate(0deg)`;
    textEl.style.zIndex = "10";
    textEl.style.width = 'auto'; // Initial width auto
    textEl.style.whiteSpace = 'nowrap'; // Prevent natural wrapping initially
    textEl.style.overflow = 'hidden'; // Hide overflow text initially

    // Create and append handles *after* text node
    const rotateHandle = document.createElement("div"); rotateHandle.className = "handle rotation-handle"; rotateHandle.innerHTML = '↻'; textEl.appendChild(rotateHandle);
    const resizeHandleRight = document.createElement("div"); resizeHandleRight.className = "handle resize-handle-base resize-handle-right"; resizeHandleRight.title = "Resize Width"; textEl.appendChild(resizeHandleRight);
    const resizeHandleLeft = document.createElement("div"); resizeHandleLeft.className = "handle resize-handle-base resize-handle-left"; resizeHandleLeft.title = "Resize Font Size"; textEl.appendChild(resizeHandleLeft);

    // Calculate initial position based on sign area center
    const currentPolygon = getPolygonForSelectedCollection();
    const minX = Math.min(...currentPolygon.map(p => p.x)); const maxX = Math.max(...currentPolygon.map(p => p.x));
    const minY = Math.min(...currentPolygon.map(p => p.y)); const maxY = Math.max(...currentPolygon.map(p => p.y));
    const signCenterXPercent = canvasWidth ? ((minX + maxX) / 2) / canvasWidth * 100 : 50;
    const signCenterYPercent = canvasHeight ? ((minY + maxY) / 2) / canvasHeight * 100 : 50;
    const { x: initialX, y: initialY } = calculateElementPosition(signCenterXPercent, signCenterYPercent);
    textEl.style.left = `${initialX}px`;
    textEl.style.top = `${initialY}px`;

    // Add interaction listeners
    textEl.addEventListener("mousedown", handleTextDragStart); textEl.addEventListener("touchstart", handleTextDragStart, { passive: true });
    rotateHandle.addEventListener("mousedown", handleTextRotateStart); rotateHandle.addEventListener("touchstart", handleTextRotateStart, { passive: true });
    resizeHandleRight.addEventListener("mousedown", handleTextResizeWidthStart); resizeHandleRight.addEventListener("touchstart", handleTextResizeWidthStart, { passive: true });
    resizeHandleLeft.addEventListener("mousedown", handleTextResizeFontSizeStart); resizeHandleLeft.addEventListener("touchstart", handleTextResizeFontSizeStart, { passive: true });

    // Append to container
    container.appendChild(textEl);

    // Set fixed width after measuring and activate
    requestAnimationFrame(() => {
        if (textEl && container.contains(textEl)) {
            const initialWidth = textEl.offsetWidth;
            textEl.style.width = `${Math.max(initialWidth, 30)}px`; // Set width based on content, min 30px
            textEl.style.whiteSpace = 'normal'; // Allow wrapping now
             textEl.style.overflow = 'visible'; // Show overflow now
            setActiveElement(textEl); // Select the newly added text
        }
    });
}
function addImage() {
    if (currentSignMode !== 'custom') { nftStatusEl.textContent = "Switch to Custom Sign mode."; nftStatusEl.className = 'error'; return; }
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { nftStatusEl.textContent = "Load NFT first."; nftStatusEl.className = 'error'; return; }
    if (!imageUpload || !imageUpload.files || imageUpload.files.length === 0) { nftStatusEl.textContent = "Please select an image file."; nftStatusEl.className = 'error'; return; }

    const file = imageUpload.files[0];
    // Basic file type check
    if (!file.type.startsWith('image/')) {
         nftStatusEl.textContent = "Invalid file type. Please select an image.";
         nftStatusEl.className = 'error';
         imageUpload.value = ''; // Clear invalid selection
         return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const wrapper = document.createElement("div");
        wrapper.className = "imgOverlay";
        // Set initial styles before image load for positioning
        wrapper.style.position="absolute";
        wrapper.style.width="100px"; // Temporary width
        wrapper.style.height="auto";
        wrapper.style.transform="translate(-50%, -50%) rotate(0deg)";
        wrapper.style.touchAction="none";
        wrapper.style.zIndex="20";

        const img = document.createElement("img");
        img.src = e.target.result;

        img.onload = () => {
             // Set size and position *after* image has loaded its dimensions
             if(container.offsetWidth > 0 && img.naturalWidth > 0 && img.naturalHeight > 0){
                 const contW = container.offsetWidth;
                 const initialWidth = Math.min(img.naturalWidth * 0.5, contW * 0.4, 150); // Max 150px or 40% of container
                 const aspectRatio = img.naturalWidth / img.naturalHeight;
                 wrapper.style.width=`${initialWidth}px`;
                 wrapper.style.height=`${initialWidth / aspectRatio}px`;
             } else {
                 // Fallback size if dimensions aren't available (less likely here)
                 wrapper.style.width='100px';
                 wrapper.style.height='auto';
                 console.warn("Could not determine container/image size for initial scaling, using fallback.");
             }
             // Position based on sign center
             const currentPolygon = getPolygonForSelectedCollection();
             const minX=Math.min(...currentPolygon.map(p=>p.x));const maxX=Math.max(...currentPolygon.map(p=>p.x));
             const minY=Math.min(...currentPolygon.map(p=>p.y));const maxY=Math.max(...currentPolygon.map(p=>p.y));
             const signCenterXPercent=canvasWidth?((minX+maxX)/2)/canvasWidth*100:50;
             const signCenterYPercent=canvasHeight?((minY+maxY)/2)/canvasHeight*100:50;
             const{x:initialX,y:initialY}=calculateElementPosition(signCenterXPercent,signCenterYPercent);
             wrapper.style.left=`${initialX}px`;
             wrapper.style.top=`${initialY}px`;

             // Now that it's sized and positioned, activate it
             setActiveElement(wrapper);
         };
        img.onerror = ()=>{
            console.error("Error loading added image data.");
            nftStatusEl.textContent="Error displaying uploaded image.";
            nftStatusEl.className='error';
            wrapper.remove(); // Remove broken wrapper
        };
        wrapper.appendChild(img);

        // Add handles
        const rotateHandle = document.createElement("div"); rotateHandle.className = "handle rotation-handle"; rotateHandle.innerHTML = '↻'; wrapper.appendChild(rotateHandle);
        const resizeHandleRight = document.createElement("div"); resizeHandleRight.className = "handle resize-handle-base resize-handle-right"; resizeHandleRight.title = "Resize Image"; wrapper.appendChild(resizeHandleRight);

        // Add interaction listeners
        wrapper.addEventListener("mousedown", handleImageDragStart); wrapper.addEventListener("touchstart", handleImageDragStart, { passive: true });
        rotateHandle.addEventListener("mousedown", handleImageRotateStart); rotateHandle.addEventListener("touchstart", handleImageRotateStart, { passive: true });
        resizeHandleRight.addEventListener("mousedown", handleImageResizeStart); resizeHandleRight.addEventListener("touchstart", handleImageResizeStart, { passive: true });

        // Append wrapper to container
        container.appendChild(wrapper);
        nftStatusEl.textContent = "Image added."; nftStatusEl.className = 'success';
        imageUpload.value = ''; // Clear file input after successful load start

    };
    reader.onerror = function (err) {
        console.error("FileReader error:",err);
        nftStatusEl.textContent="Error reading image file.";
        nftStatusEl.className='error';
    }
    reader.readAsDataURL(file);
 }

// --- Active Element Management & Removal (Custom Mode) ---
// MODIFIED: More robust active element handling
function setActiveElement(el) {
    // Deselect the currently active element if it exists and is different
    if (activeElement && activeElement !== el) {
        if (container.contains(activeElement)) { // Check if still in DOM
            activeElement.classList.remove("active");
            // Reset z-index
            activeElement.style.zIndex = activeElement.classList.contains('imgOverlay') ? '20' : '10';
        }
    }

    // Set the new element as active if it's valid
    if (el && currentSignMode === 'custom' && container.contains(el)) {
        el.classList.add("active");
        activeElement = el;
        // Bring active element to the front
        el.style.zIndex = el.classList.contains('imgOverlay') ? '101' : '100';

        // Update controls if it's a text element
        if (el.classList.contains('textOverlay')) {
             let textNode = el.childNodes[0];
             // Find the actual text node, skipping handles if necessary
             while (textNode && textNode.nodeType !== Node.TEXT_NODE) {
                 textNode = textNode.nextSibling;
             }
             if (textNode) {
                 textInput.value = textNode.nodeValue.trim();
             } else {
                 textInput.value = (el.textContent || '').trim(); // Fallback
             }
             textColor.value = rgb2hex(el.style.color || '#ffffff');
             // Match font in dropdown
             const currentFont = (el.style.fontFamily || 'Arial').split(',')[0].replace(/['"]/g, "").trim();
             let foundFont = false;
             for (let option of fontFamily.options) {
                 if (option.value.includes(currentFont)) {
                     fontFamily.value = option.value;
                     foundFont = true;
                     break;
                 }
             }
             if (!foundFont) fontFamily.value = 'Arial'; // Default
        }
    } else {
        // If no valid element is passed, or not in custom mode, clear active element
        activeElement = null;
    }

    // ALWAYS update button states after changing selection
    updateCustomActionButtons();
}

// MODIFIED: Added status messages and checks
function removeActiveElement() {
    // Check if there is an active element, it's in the container, and we are in custom mode
    if (activeElement && container.contains(activeElement) && currentSignMode === 'custom') {
        const elementType = activeElement.classList.contains('textOverlay') ? 'Text' : 'Image';
        activeElement.remove(); // Remove the element from the DOM
        setActiveElement(null); // Clear the active element state and update buttons
        nftStatusEl.textContent = `${elementType} element removed.`;
        nftStatusEl.className = ''; // Clear error/success class
    } else if (currentSignMode !== 'custom') {
        nftStatusEl.textContent = "Delete only works in Custom Sign mode.";
        nftStatusEl.className = 'error';
        console.warn("Attempted to delete element outside of custom mode.");
    } else if (!activeElement) {
        nftStatusEl.textContent = "No element selected to delete.";
        nftStatusEl.className = 'error';
        console.warn("Attempted to delete with no active element.");
    } else {
         // Should not happen if logic is correct, but handles edge cases
         console.warn("Attempted to delete an element that might be detached or invalid.", activeElement);
         setActiveElement(null); // Ensure state is cleared
         nftStatusEl.textContent = "Could not delete element (invalid state).";
         nftStatusEl.className = 'error';
    }
}


// --- Interaction Handlers (Common) ---
function getEventCoordinates(event) { let x,y; if(event.touches&&event.touches.length>0){x=event.touches[0].clientX;y=event.touches[0].clientY;}else if(event.changedTouches&&event.changedTouches.length>0){x=event.changedTouches[0].clientX;y=event.changedTouches[0].clientY;}else{x=event.clientX;y=event.clientY;} return{x,y}; }
function getRotationRad(element) { if(!element||!element.style)return 0; const transform=element.style.transform; const rotateMatch=transform.match(/rotate\((-?\d+(\.\d+)?)deg\)/); const rotationDeg=rotateMatch?parseFloat(rotateMatch[1]):0; return rotationDeg*(Math.PI/180); }

// --- Interaction Handlers (Text - Custom Mode) ---
function handleTextDragStart(event) { if (event.target.classList.contains('handle') || currentSignMode !== 'custom') return; const el = event.currentTarget; setActiveElement(el); textInteractionState.isDragging = true; textInteractionState.isRotating = false; textInteractionState.isResizingWidth = false; textInteractionState.isResizingFontSize = false; el.style.cursor = 'grabbing'; document.body.style.cursor = 'grabbing'; const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); textInteractionState.startX = coords.x - contRect.left; textInteractionState.startY = coords.y - contRect.top; textInteractionState.startLeft = parseFloat(el.style.left || "0"); textInteractionState.startTop = parseFloat(el.style.top || "0"); document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextRotateStart(event) { if (currentSignMode !== 'custom') return; event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); textInteractionState.isRotating = true; textInteractionState.isDragging = false; textInteractionState.isResizingWidth = false; textInteractionState.isResizingFontSize = false; document.body.style.cursor = 'alias'; const coords = getEventCoordinates(event); const rect = el.getBoundingClientRect(); textInteractionState.rotateCenterX = rect.left + rect.width / 2; textInteractionState.rotateCenterY = rect.top + rect.height / 2; const dx = coords.x - textInteractionState.rotateCenterX; const dy = coords.y - textInteractionState.rotateCenterY; let startAngle = Math.atan2(dy, dx); const currentRotationRad = getRotationRad(el); textInteractionState.rotateStartAngle = startAngle - currentRotationRad; document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextResizeWidthStart(event) { if (currentSignMode !== 'custom') return; event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); textInteractionState.isResizingWidth = true; textInteractionState.isResizingFontSize = false; textInteractionState.isRotating = false; textInteractionState.isDragging = false; document.body.style.cursor = 'ew-resize'; const coords = getEventCoordinates(event); textInteractionState.startX = coords.x; textInteractionState.startY = coords.y; textInteractionState.startWidth = el.offsetWidth; textInteractionState.currentRotationRad = getRotationRad(el); el.style.whiteSpace = 'normal'; el.style.overflow = 'hidden'; // Hide overflow during resize
    document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextResizeFontSizeStart(event) { if (currentSignMode !== 'custom') return; event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); textInteractionState.isResizingFontSize = true; textInteractionState.isResizingWidth = false; textInteractionState.isRotating = false; textInteractionState.isDragging = false; document.body.style.cursor = 'ns-resize'; const coords = getEventCoordinates(event); textInteractionState.startX = coords.x; textInteractionState.startY = coords.y; textInteractionState.startFontSize = parseFloat(el.style.fontSize) || DEFAULT_FONT_SIZE; document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextInteractionMove(event) { if (!activeElement || !activeElement.classList.contains('textOverlay') || (!textInteractionState.isDragging && !textInteractionState.isRotating && !textInteractionState.isResizingWidth && !textInteractionState.isResizingFontSize)) return; if (event.type === 'touchmove') event.preventDefault(); const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); if (textInteractionState.isDragging) { const currentX = coords.x - contRect.left; const currentY = coords.y - contRect.top; activeElement.style.left = `${textInteractionState.startLeft + (currentX - textInteractionState.startX)}px`; activeElement.style.top = `${textInteractionState.startTop + (currentY - textInteractionState.startY)}px`; } else if (textInteractionState.isRotating) { const dx = coords.x - textInteractionState.rotateCenterX; const dy = coords.y - textInteractionState.rotateCenterY; let angle = Math.atan2(dy, dx); let rotationRad = angle - textInteractionState.rotateStartAngle; let rotationDeg = rotationRad * (180 / Math.PI); activeElement.style.transform = `translate(-50%, -50%) rotate(${rotationDeg}deg)`; } else if (textInteractionState.isResizingWidth) { const dx = coords.x - textInteractionState.startX; const dy = coords.y - textInteractionState.startY; const rotation = textInteractionState.currentRotationRad; const cosR = Math.cos(rotation); const sinR = Math.sin(rotation); const projectedDx = dx * cosR + dy * sinR; let newWidth = textInteractionState.startWidth + projectedDx; activeElement.style.width = `${Math.max(30, newWidth)}px`; } else if (textInteractionState.isResizingFontSize) { const dy = coords.y - textInteractionState.startY; let newSize = textInteractionState.startFontSize - (dy * FONT_SIZE_SENSITIVITY); activeElement.style.fontSize = `${Math.max(MIN_FONT_SIZE, newSize)}px`; } }
function handleTextInteractionEnd(event) {
    if (activeElement && activeElement.classList.contains('textOverlay')) {
        activeElement.style.cursor = 'grab';
        if (textInteractionState.isResizingWidth || textInteractionState.isResizingFontSize) {
             activeElement.style.overflow = 'visible'; // Restore visibility after resize
        }
    }
    document.body.style.cursor = 'default';
    textInteractionState.isDragging = false; textInteractionState.isRotating = false; textInteractionState.isResizingWidth = false; textInteractionState.isResizingFontSize = false;
    document.removeEventListener("mousemove", handleTextInteractionMove); document.removeEventListener("mouseup", handleTextInteractionEnd); document.removeEventListener("touchmove", handleTextInteractionMove); document.removeEventListener("touchend", handleTextInteractionEnd); document.removeEventListener("touchcancel", handleTextInteractionEnd);
}

// --- Interaction Handlers (Image - Custom Mode) ---
function handleImageDragStart(event) { if (event.target.classList.contains('handle') || currentSignMode !== 'custom') return; const el = event.currentTarget; setActiveElement(el); imageInteractionState.isDragging = true; imageInteractionState.isRotating = false; imageInteractionState.isResizing = false; el.style.cursor = 'grabbing'; document.body.style.cursor = 'grabbing'; const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); imageInteractionState.startX = coords.x - contRect.left; imageInteractionState.startY = coords.y - contRect.top; imageInteractionState.startLeft = parseFloat(el.style.left || "0"); imageInteractionState.startTop = parseFloat(el.style.top || "0"); document.addEventListener("mousemove", handleImageInteractionMove); document.addEventListener("mouseup", handleImageInteractionEnd); document.addEventListener("touchmove", handleImageInteractionMove, { passive: false }); document.addEventListener("touchend", handleImageInteractionEnd); document.addEventListener("touchcancel", handleImageInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleImageRotateStart(event) { if (currentSignMode !== 'custom') return; event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); imageInteractionState.isRotating = true; imageInteractionState.isDragging = false; imageInteractionState.isResizing = false; document.body.style.cursor = 'alias'; const coords = getEventCoordinates(event); const rect = el.getBoundingClientRect(); imageInteractionState.centerX = rect.left + rect.width / 2; imageInteractionState.centerY = rect.top + rect.height / 2; const dx = coords.x - imageInteractionState.centerX; const dy = coords.y - imageInteractionState.centerY; let startAngle = Math.atan2(dy, dx); imageInteractionState.currentRotationRad = getRotationRad(el); imageInteractionState.startAngle = startAngle - imageInteractionState.currentRotationRad; document.addEventListener("mousemove", handleImageInteractionMove); document.addEventListener("mouseup", handleImageInteractionEnd); document.addEventListener("touchmove", handleImageInteractionMove, { passive: false }); document.addEventListener("touchend", handleImageInteractionEnd); document.addEventListener("touchcancel", handleImageInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleImageResizeStart(event) { if (currentSignMode !== 'custom') return; event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); imageInteractionState.isResizing = true; imageInteractionState.isRotating = false; imageInteractionState.isDragging = false; document.body.style.cursor = 'nwse-resize'; const coords = getEventCoordinates(event); imageInteractionState.startX = coords.x; imageInteractionState.startY = coords.y; imageInteractionState.startWidth = el.offsetWidth; imageInteractionState.startHeight = el.offsetHeight; imageInteractionState.aspectRatio = imageInteractionState.startHeight > 0 ? imageInteractionState.startWidth / imageInteractionState.startHeight : 1; imageInteractionState.currentRotationRad = getRotationRad(el); const rect = el.getBoundingClientRect(); imageInteractionState.centerX = rect.left + rect.width / 2; imageInteractionState.centerY = rect.top + rect.height / 2; document.addEventListener("mousemove", handleImageInteractionMove); document.addEventListener("mouseup", handleImageInteractionEnd); document.addEventListener("touchmove", handleImageInteractionMove, { passive: false }); document.addEventListener("touchend", handleImageInteractionEnd); document.addEventListener("touchcancel", handleImageInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleImageInteractionMove(event) { if (!activeElement || !activeElement.classList.contains('imgOverlay') || (!imageInteractionState.isDragging && !imageInteractionState.isRotating && !imageInteractionState.isResizing)) return; if (event.type === 'touchmove') event.preventDefault(); const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); if (imageInteractionState.isDragging) { const currentX = coords.x - contRect.left; const currentY = coords.y - contRect.top; activeElement.style.left = `${imageInteractionState.startLeft + (currentX - imageInteractionState.startX)}px`; activeElement.style.top = `${imageInteractionState.startTop + (currentY - imageInteractionState.startY)}px`; } else if (imageInteractionState.isRotating) { const dx = coords.x - imageInteractionState.centerX; const dy = coords.y - imageInteractionState.centerY; let angle = Math.atan2(dy, dx); let rotationRad = angle - imageInteractionState.startAngle; let rotationDeg = rotationRad * (180 / Math.PI); activeElement.style.transform = `translate(-50%, -50%) rotate(${rotationDeg}deg)`; } else if (imageInteractionState.isResizing) { const startDist = Math.hypot(imageInteractionState.startX - imageInteractionState.centerX, imageInteractionState.startY - imageInteractionState.centerY); const currentDist = Math.hypot(coords.x - imageInteractionState.centerX, coords.y - imageInteractionState.centerY); const scaleFactor = startDist > 0 ? currentDist / startDist : 1; let newWidth = imageInteractionState.startWidth * scaleFactor; let newHeight = imageInteractionState.aspectRatio > 0 ? newWidth / imageInteractionState.aspectRatio : newWidth; activeElement.style.width = `${Math.max(30, newWidth)}px`; activeElement.style.height = `${Math.max(30 / (imageInteractionState.aspectRatio || 1), newHeight)}px`; } } // Added fallback for aspectRatio
function handleImageInteractionEnd(event) { if (activeElement && activeElement.classList.contains('imgOverlay')) { activeElement.style.cursor = 'grab'; } document.body.style.cursor = 'default'; imageInteractionState.isDragging = false; imageInteractionState.isRotating = false; imageInteractionState.isResizing = false; document.removeEventListener("mousemove", handleImageInteractionMove); document.removeEventListener("mouseup", handleImageInteractionEnd); document.removeEventListener("touchmove", handleImageInteractionMove); document.removeEventListener("touchend", handleImageInteractionEnd); document.removeEventListener("touchcancel", handleImageInteractionEnd); }

// --- Utility Functions ---
function calculateElementPosition(percentX, percentY) { const contRect=container.getBoundingClientRect();if(!contRect||contRect.width===0||contRect.height===0)return{x:0,y:0}; return { x: contRect.width * (percentX/100), y: contRect.height * (percentY/100) }; }
function getCanvasCoordsFromContainerPoint(containerX, containerY) { const contRect=container.getBoundingClientRect();if(!contRect||contRect.width===0||contRect.height===0)return{canvasX:0,canvasY:0};const scaleX=canvasWidth/contRect.width; const scaleY=canvasHeight/contRect.height; return{canvasX:containerX*scaleX,canvasY:containerY*scaleY};}
function pointInPolygon(point, vs) { const x = point.x, y = point.y; let inside = false; for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) { const xi = vs[i].x, yi = vs[i].y; const xj = vs[j].x, yj = vs[j].y; const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi); if (intersect) inside = !inside; } return inside; }
function rgb2hex(rgb) { if(!rgb)return'#ffffff'; if(rgb.startsWith('#'))return rgb; const rgbMatch=rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/); if(rgbMatch){return"#"+rgbMatch.slice(1).map(x=>{const hex=parseInt(x).toString(16);return hex.length===1?"0"+hex:hex;}).join('');} return rgb; } // Ensure 2 digits per color component

// --- Text Wrapping Calculation for Canvas (Custom Mode) ---
function getWrappedTextLines(text, maxWidthPx, fontStyle) {
    if (!text || maxWidthPx <= 0) return [];
    ctx.font = fontStyle;
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine ? currentLine + " " + word : word;
        const testWidth = ctx.measureText(testLine).width;

        if (testWidth <= maxWidthPx || !currentLine) {
            currentLine = testLine;
        } else {
            lines.push(currentLine);
            currentLine = word;
            // Handle single words wider than maxWidth
            if (ctx.measureText(currentLine).width > maxWidthPx) {
                let tempLine = '';
                for(let char of currentLine) {
                    if(ctx.measureText(tempLine + char).width > maxWidthPx && tempLine) {
                        lines.push(tempLine);
                        tempLine = char;
                    } else {
                        tempLine += char;
                    }
                }
                currentLine = tempLine; // Remaining part
            }
        }
    }
    if (currentLine) { lines.push(currentLine); }
    return lines;
}


// --- Save Functionality (Unified) ---
function saveImage() {
    const currentNftId = nftTokenIdInput.value || 'unknown';
    const currentCollection = nftCollectionSelect.value || 'unknown';

    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { alert("Load a valid NFT first!"); nftStatusEl.className = 'error'; nftStatusEl.textContent = "NFT not loaded for saving."; return; }
    if (currentSignMode === 'prefix' && !appliedPrefixSignImage) { alert("Select a sign from the gallery before saving."); nftStatusEl.className = 'error'; nftStatusEl.textContent = "No sign selected from gallery."; return; }
    // Add check: In custom mode, maybe require at least one element or polygon color change? Optional.

    nftStatusEl.textContent = `Generating final image...`; nftStatusEl.className = '';
    const previouslyActive = activeElement; if (activeElement) setActiveElement(null); // Deselect custom element for clean render

    // --- Start Drawing ---
    // Use a temporary canvas for drawing to avoid flicker on main canvas? Maybe not necessary yet.
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    drawBaseImage(); // 1. Base NFT

    if (currentSignMode === 'prefix' && appliedPrefixSignImage && appliedPrefixSignImage.complete) {
         // 2. Applied Prefix Sign
        try { ctx.drawImage(appliedPrefixSignImage, 0, 0, canvasWidth, canvasHeight); } catch (e) { console.error("Error drawing prefix sign during save:", e); }
    } else if (currentSignMode === 'custom') {
        // 2. Custom Sign Background Color
        // Check if color is not the default placeholder OR if user interacted with it?
        // Simple check: just draw if value is set (already done)
        drawSignPolygonOnly(); // Draw polygon based on overlayColorInput.value

        // 3. Custom Overlays (Text/Images)
        const containerRect = container.getBoundingClientRect();
        if (!containerRect || containerRect.width === 0 || containerRect.height === 0) {
            console.error("Error getting container rect during save");
            nftStatusEl.className='error'; nftStatusEl.textContent="Save Error: Container rect invalid.";
            if(previouslyActive && container.contains(previouslyActive)) setActiveElement(previouslyActive); // Reselect if possible
            return;
        }
        const scaleX = canvasWidth / containerRect.width;
        const scaleY = canvasHeight / containerRect.height;

        const allOverlays = Array.from(container.querySelectorAll(".textOverlay, .imgOverlay"));
        allOverlays.sort((a, b) => (parseInt(window.getComputedStyle(a).zIndex) || 0) - (parseInt(window.getComputedStyle(b).zIndex) || 0));

        allOverlays.forEach(el => {
            if (!container.contains(el)) return; // Skip detached elements if any exist

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

                if (canvasFontSize >= 1 && text) { // Only draw if font size is valid and text exists
                    const fontStyle = `${canvasFontSize}px ${font}`;
                    ctx.font = fontStyle;
                    ctx.fillStyle = color;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";

                    const lines = getWrappedTextLines(text, canvasMaxWidth, fontStyle);
                    const lineHeight = canvasFontSize * 1.2;
                    const totalTextHeight = lines.length * lineHeight;
                    let currentY = -(totalTextHeight / 2) + (lineHeight / 2);

                    lines.forEach(line => {
                        ctx.fillText(line, 0, currentY);
                        currentY += lineHeight;
                    });
                }

            } else if (el.classList.contains('imgOverlay')) {
                const imgElement = el.querySelector('img');
                if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
                    const domWidth = el.offsetWidth;
                    const domHeight = el.offsetHeight;
                    const canvasDrawWidth = Math.round(domWidth * scaleX);
                    const canvasDrawHeight = Math.round(domHeight * scaleY);

                    if (canvasDrawWidth > 0 && canvasDrawHeight > 0) {
                        try {
                            ctx.drawImage(imgElement, -canvasDrawWidth / 2, -canvasDrawHeight / 2, canvasDrawWidth, canvasDrawHeight);
                        } catch (e) {
                            console.error("Error drawing image overlay during save:", e);
                        }
                    }
                } else {
                    console.warn("Skipping unloaded/invalid image overlay during save:", imgElement?.src);
                }
            }
            ctx.restore();
        });
    }
    // --- End Drawing ---

    // --- Generate Download Link ---
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
        } else {
            filename = `custom-${safeCollection}-${safeNftId}.png`;
        }
        link.download = filename;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        nftStatusEl.textContent = `Image saved as ${filename}!`;
        nftStatusEl.className = 'success';
    } catch (e) {
        console.error("Error saving image:", e);
        nftStatusEl.className = 'error';
        if (e.name === "SecurityError") {
             alert("Save Error: Cannot save due to cross-origin image security restrictions (CORS). Ensure NFT/Sign images allow anonymous access.");
             nftStatusEl.textContent = "Save Error: CORS issue.";
        } else {
             alert("An error occurred saving the image. Check console.");
             nftStatusEl.textContent = "Save Error. Check console.";
        }
    }

     // --- Restore Canvas View ---
     setTimeout(() => {
         if (baseImage.src && baseImage.complete) {
             if (currentSignMode === 'prefix' && appliedPrefixSignImage) {
                 drawBaseImage();
                 ctx.drawImage(appliedPrefixSignImage, 0, 0, canvasWidth, canvasHeight);
             }
             else if (currentSignMode === 'custom') {
                 applyOverlay(false); // Redraws base + polygon
             }
             else {
                 drawBaseImage(); // Just redraw base if no mode active or no sign/overlay
             }
         } else {
             clearCanvas(); // Clear if base image isn't loaded
         }
         // Restore the previously active element's visual state if it exists
         if (previouslyActive && container.contains(previouslyActive)) {
             setActiveElement(previouslyActive);
         } else {
             // Ensure buttons are correctly updated even if no element was previously active
             updateCustomActionButtons();
         }
     }, 100);
} // End saveImage function