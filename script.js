// --- START OF FILE script.js ---

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
const DONATION_ADDRESSES = {
    sol: "2Vv3QHAJxZvViaY1HaWvJ5kbnNeUdN1MrZcRYog4ezHE",
    eth: "0xbD0dDE4175d8e854306a09dE4c184392b33a6d9C"
};
const HELP_TEXTS = {
    "nft-load": "Choose a collection (e.g., GHN) and enter the specific Token ID number of the NFT you want to load onto the canvas.",
    "gallery": "Click any pre-made sign below to instantly apply it over your loaded NFT image. Click again to remove it.",
    "custom": "Use these controls to customize the sign: change the sign's background color, add/style your own text, and upload/position additional images.",
    "custom-text": "Select text on canvas to edit here. Use handles on canvas: \n⇦ (Left): Adjust font size.\n⇨ (Right): Adjust text box width.\n↻ (Bottom): Rotate text.",
    "custom-image": "'Choose File' then 'Add Image'. Drag to move. Use handles on canvas:\n⤡ (Bottom-Left): Resize image.\n↻ (Top): Rotate image."
};


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
let lastCustomTextInputValue = ""; // Represents text input value when NO element is selected
let isModalOpen = false; // Track if donation modal is open
let activeHelpButton = null; // Track which help button triggered the current tooltip

// --- DOM Element References ---
let canvas, ctx, container, textInput, textColor, fontFamily, removeBtn, nftStatusEl,
    nftCollectionSelect, nftTokenIdInput, loadNftBtn, overlayColorInput,
    addTextBtn, addImageBtn, resetCanvasBtn, imageUpload,
    saveFullBtn, // Save button for Custom mode
    signTypeChoiceGroup, signTypePrefixRadio, signTypeCustomRadio, signTypeChoiceHeader, // Added header ref
    prefixOptionsGroup, customOptionsGroup,
    signGalleryContainer, savePrefixBtn, prefixFinalActions,
    donateBtn, donateModal, donateModalCloseBtn, sendSolBtn, sendEthBtn,
    donateNetworkChoiceDiv, donateAddressDisplayDiv, donateAddressCode, copyAddressBtn,
    helpTooltip, helpTooltipText; // New elements

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
    signTypeChoiceHeader = document.getElementById("sign-type-choice-header"); // Added
    signTypePrefixRadio = document.getElementById("signTypePrefix");
    signTypeCustomRadio = document.getElementById("signTypeCustom");
    prefixOptionsGroup = document.getElementById("prefix-options-group");
    customOptionsGroup = document.getElementById("custom-options-group");
    signGalleryContainer = document.getElementById("sign-gallery-container");
    savePrefixBtn = document.getElementById("savePrefixBtn");
    prefixFinalActions = document.getElementById("prefix-final-actions"); // Container for prefix save button

    // Donation Modal Elements
    donateBtn = document.getElementById("donateBtn");
    donateModal = document.getElementById("donateModal");
    donateModalCloseBtn = donateModal.querySelector(".modal-close");
    sendSolBtn = document.getElementById("sendSolBtn");
    sendEthBtn = document.getElementById("sendEthBtn");
    donateNetworkChoiceDiv = document.getElementById("donateNetworkChoice");
    donateAddressDisplayDiv = document.getElementById("donateAddressDisplay");
    donateAddressCode = document.getElementById("donateAddress");
    copyAddressBtn = document.getElementById("copyAddressBtn");

    // Help Tooltip Elements
    helpTooltip = document.getElementById("helpTooltip");
    helpTooltipText = document.getElementById("helpTooltipText");


    // Initial Setup
    setControlsDisabled(true); // Start with most controls disabled
    loadNftBtn.disabled = false; // Enable NFT loading
    nftCollectionSelect.disabled = false;
    nftTokenIdInput.disabled = false;
    clearCanvas();
    setupEventListeners();
};

// ===========================================================
// setupEventListeners - UPDATED for Help Tooltip Clicks
// ===========================================================
function setupEventListeners() {
    if (!loadNftBtn) { console.error("Load button not found!"); return; }

    // NFT Loading
    loadNftBtn.addEventListener('click', loadNftToCanvas);
    nftCollectionSelect.addEventListener("change", () => {
        // When collection changes *after* loading, adjust view
        if (baseImage.src && baseImage.complete) {
            hideHelpTooltip(); // Hide tooltip if collection changes
            if (currentSignMode === 'custom') {
                 applyOverlay(false); // Re-apply overlay for new collection polygon
            } else if (currentSignMode === 'prefix') {
                appliedPrefixSignImage = null;
                if (selectedSignItem) { selectedSignItem.classList.remove('selected'); selectedSignItem = null; }
                drawBaseImage();
                if(savePrefixBtn) savePrefixBtn.disabled = true;
                populateSignGallery(); // Refresh gallery for the new collection
            }
            else { drawBaseImage(); }
        }
    });

    // Sign Type Choice
    signTypePrefixRadio.addEventListener('change', () => setSignMode('prefix'));
    signTypeCustomRadio.addEventListener('change', () => setSignMode('custom'));

    // Custom Controls
    overlayColorInput.addEventListener('input', () => { if (currentSignMode === 'custom') applyOverlay(false); });
    addTextBtn.addEventListener('click', addText);
    textInput.addEventListener("input", handleTextControlChange); // Event listener for text input changes
    textColor.addEventListener("input", handleTextControlChange); // Also trigger style updates
    fontFamily.addEventListener("input", handleTextControlChange); // Also trigger style updates
    addImageBtn.addEventListener('click', addImage);

    // Custom Actions
    removeBtn.addEventListener('click', (event) => removeActiveElement(event));

    // General Actions
    resetCanvasBtn.addEventListener('click', handleReset);
    saveFullBtn.addEventListener('click', saveImage); // Custom Save
    savePrefixBtn.addEventListener('click', saveImage); // Prefix Save

     // Deselect active element when clicking outside
     document.addEventListener('click', handleOutsideClick, true); // Use capture phase

     // --- Donation Modal Listeners ---
     if (donateBtn) donateBtn.addEventListener('click', openDonateModal);
     if (donateModalCloseBtn) donateModalCloseBtn.addEventListener('click', closeDonateModal);
     if (donateModal) donateModal.addEventListener('click', (event) => {
         // Close if clicked on the background overlay
         if (event.target === donateModal) { closeDonateModal(); }
     });
     if (sendSolBtn) sendSolBtn.addEventListener('click', () => showDonationAddress('sol'));
     if (sendEthBtn) sendEthBtn.addEventListener('click', () => showDonationAddress('eth'));
     if (copyAddressBtn) copyAddressBtn.addEventListener('click', copyDonationAddress);

     // --- Help Tooltip Listeners (NOW CLICK-BASED) ---
     const helpBtns = document.querySelectorAll('.help-btn');
     helpBtns.forEach(btn => {
         // REMOVED hover/focus listeners
         // btn.addEventListener('mouseenter', showHelpTooltip);
         // btn.addEventListener('mouseleave', hideHelpTooltip);
         // btn.addEventListener('focus', showHelpTooltip); // Accessibility
         // btn.addEventListener('blur', hideHelpTooltip);  // Accessibility
         btn.addEventListener('click', handleHelpClick); // ADDED click listener
     });

     // --- Global listener to close help tooltip on outside click ---
     document.addEventListener('click', (event) => {
         // Hide tooltip if click is outside the tooltip itself AND outside the button that opened it
         if (helpTooltip && helpTooltip.style.display === 'block' && activeHelpButton) {
             if (!helpTooltip.contains(event.target) && event.target !== activeHelpButton) {
                 hideHelpTooltip();
             }
         }
     }, false); // Use bubble phase is fine here


     // --- Keyboard listener for ESC key to close modal AND tooltip ---
     document.addEventListener('keydown', (event) => {
         if (event.key === 'Escape') {
             if (isModalOpen) {
                 closeDonateModal();
             } else if (helpTooltip && helpTooltip.style.display === 'block') {
                 hideHelpTooltip();
             }
         }
     });
}

// --- Click Outside Handler (For deselecting canvas elements) ---
function handleOutsideClick(event) {
    // Modal Check first
    if (isModalOpen && donateModal && !donateModal.querySelector('.modal-content').contains(event.target) && event.target !== donateBtn) {
         // Don't process deselect if click was related to the modal or its trigger button
         return;
    }

    // Help Tooltip Check - Don't deselect if clicking inside the help tooltip
    if (helpTooltip && helpTooltip.style.display === 'block' && helpTooltip.contains(event.target)) {
        return;
    }
    // Help Button Check - Let the help button click handler manage the tooltip state
    if (event.target.classList.contains('help-btn')) {
        return;
    }


    // Deselect Active Element Logic (Canvas Overlays)
    if (currentSignMode === 'custom') {
        const clickedInsideContainer = container.contains(event.target);
        const clickedOnContainerOrCanvas = event.target === container || event.target === canvas;
        // Check if click was on controls that *should not* cause deselect
        const clickedOnInteractiveControl = event.target.closest('#custom-options-group input, #custom-options-group select, #custom-options-group button:not(#removeBtn):not(#saveFullBtn):not(.help-btn)');
        const clickedOnActiveElementHandle = event.target.classList.contains('handle');

        if (activeElement && !clickedOnInteractiveControl && !clickedOnActiveElementHandle) {
             // Click was NOT on a handle or non-action button within the custom controls group

             // Condition 1: Click outside the main canvas container entirely
             if (!clickedInsideContainer) {
                  setActiveElement(null); // Deselect
             // Condition 2: Click directly on the canvas/container background
             } else if (clickedOnContainerOrCanvas) {
                  setActiveElement(null); // Deselect
             // Condition 3: Click inside container, but not on the active element itself or another overlay
             } else if (!activeElement.contains(event.target) && !event.target.closest('.textOverlay, .imgOverlay')) {
                  setActiveElement(null); // Deselect
             }
        }
    }
}

// --- Workflow Management ---
function setControlsDisabled(isDisabled) {
    const customControls = [overlayColorInput, textInput, textColor, fontFamily, addTextBtn, imageUpload, addImageBtn, removeBtn, saveFullBtn];
    const signChoiceRadios = [signTypePrefixRadio, signTypeCustomRadio];
    const prefixControls = [savePrefixBtn];

    customControls.forEach(el => { if(el) el.disabled = isDisabled; });
    prefixControls.forEach(el => { if(el) el.disabled = isDisabled; });
    signChoiceRadios.forEach(el => { if(el) el.disabled = isDisabled; });

    // Also disable help buttons inside custom controls when main controls are disabled
    const customHelpBtns = document.querySelectorAll('#custom-options-group .help-btn');
    customHelpBtns.forEach(btn => { if(btn) btn.disabled = isDisabled; });


    if (isDisabled) {
        if(removeBtn) removeBtn.disabled = true;
        if(saveFullBtn) saveFullBtn.disabled = true;
        if(savePrefixBtn) savePrefixBtn.disabled = true;
    } else {
        // Re-enable relevant help buttons if controls are enabled
         const customHelpBtns = document.querySelectorAll('#custom-options-group .help-btn');
         customHelpBtns.forEach(btn => { if(btn) btn.disabled = false; });
    }
}

// ===========================================================
// setSignMode - Hide help tooltip on mode change
// ===========================================================
function setSignMode(mode) {
    const previousMode = currentSignMode;
    if (mode === previousMode) return;

    hideHelpTooltip(); // Hide any open help tooltip when changing mode

    if (previousMode === 'custom' && textInput) {
        if (!activeElement || !activeElement.classList.contains('textOverlay')) {
             lastCustomTextInputValue = textInput.value;
        }
    }

    currentSignMode = mode;
    const customOverlays = container.querySelectorAll('.textOverlay, .imgOverlay');

    if (mode === 'prefix') {
        customOverlays.forEach(el => el.classList.add('hidden-overlay'));
        if (activeElement) {
            setActiveElement(null);
        }
        if (appliedPrefixSignImage && baseImage.complete) {
            drawBaseImage();
            ctx.drawImage(appliedPrefixSignImage, 0, 0, canvasWidth, canvasHeight);
        } else if (baseImage.complete) {
            drawBaseImage();
        }
        populateSignGallery();

    } else if (mode === 'custom') {
        customOverlays.forEach(el => el.classList.remove('hidden-overlay'));
        appliedPrefixSignImage = null;
        if (selectedSignItem) {
            selectedSignItem.classList.remove('selected');
            selectedSignItem = null;
        }
        if (textInput) {
            textInput.value = lastCustomTextInputValue;
        }
        if (baseImage.complete) {
            applyOverlay(false);
        }
    }

    nftStatusEl.textContent = `Mode selected: ${mode === 'prefix' ? 'Signs Gallery' : 'Custom Sign'}.`;
    nftStatusEl.className = '';
    prefixOptionsGroup.classList.toggle('hidden', mode !== 'prefix');
    customOptionsGroup.classList.toggle('hidden', mode !== 'custom');

    // Show/Hide the "Choose Sign Mode" Header
    if(signTypeChoiceHeader) signTypeChoiceHeader.classList.remove('hidden'); // Always show if mode is chosen

    setControlsDisabled(true); // Disable all first
    signTypePrefixRadio.disabled = false; // Always re-enable choice
    signTypeCustomRadio.disabled = false; // Always re-enable choice
    if (mode === 'custom' && baseImage.complete) {
        const customEditControls = [overlayColorInput, textInput, textColor, fontFamily, addTextBtn, imageUpload, addImageBtn];
        customEditControls.forEach(el => { if(el) el.disabled = false; });
         // Re-enable custom help buttons too
        const customHelpBtns = document.querySelectorAll('#custom-options-group .help-btn');
        customHelpBtns.forEach(btn => { if(btn) btn.disabled = false; });

    } else if (mode === 'prefix' && baseImage.complete) {
        // Enable prefix help button if needed (currently only one)
        const prefixHelpBtn = document.querySelector('#prefix-options-group .help-btn');
        if (prefixHelpBtn) prefixHelpBtn.disabled = false;
    }
    updateCustomActionButtons(); // This will set save/remove button states correctly
}

// Updates ALL action buttons based on current mode and state
function updateCustomActionButtons() {
    const isImageLoaded = baseImage.src !== "" && baseImage.complete && baseImage.naturalWidth > 0;
    const isElementActive = activeElement !== null && container.contains(activeElement);

    const enableRemove = currentSignMode === 'custom' && isImageLoaded && isElementActive;
    const enableSaveFullCustom = currentSignMode === 'custom' && isImageLoaded;
    if (removeBtn) removeBtn.disabled = !enableRemove;
    if (saveFullBtn) saveFullBtn.disabled = !enableSaveFullCustom;

    const enableSavePrefix = currentSignMode === 'prefix' && isImageLoaded && appliedPrefixSignImage;
    if (savePrefixBtn) savePrefixBtn.disabled = !enableSavePrefix;
}


// ===========================================================
// handleTextControlChange - Revised Logic (FIX APPLIED)
// ===========================================================
function handleTextControlChange() {
    if (activeElement && activeElement.classList.contains('textOverlay') && currentSignMode === 'custom') {
        // Update Active Element Directly
        let textNode = activeElement.childNodes[0];
        while (textNode && textNode.nodeType !== Node.TEXT_NODE) { textNode = textNode.nextSibling; }

        if (textNode) {
            textNode.nodeValue = textInput.value || " "; // Update the DOM node directly
        } else {
            // If no text node exists (e.g., cleared text), create one before the first handle
            const firstHandle = activeElement.querySelector('.handle');
            if (firstHandle) {
                 activeElement.insertBefore(document.createTextNode(textInput.value || " "), firstHandle);
            } else {
                 activeElement.appendChild(document.createTextNode(textInput.value || " ")); // Fallback
            }
            console.warn("Created new text node in handleTextControlChange");
        }
        // Update style attributes only if the event source was style-related
        if (event && (event.target === textColor || event.target === fontFamily)) {
            activeElement.style.color = textColor.value;
            activeElement.style.fontFamily = fontFamily.value;
        }

        // Auto-adjust width after text change (only if textInput changed)
        if (!event || event.target === textInput) {
            requestAnimationFrame(() => {
                if (activeElement && activeElement.classList.contains('textOverlay') && container.contains(activeElement)) {
                    const originalWidthStyle = activeElement.style.width;
                    const hadManualWidth = originalWidthStyle && originalWidthStyle !== 'auto';
                    activeElement.style.width = 'auto';
                    const naturalWidth = activeElement.offsetWidth;
                    activeElement.style.width = hadManualWidth ? originalWidthStyle : `${Math.max(30, naturalWidth)}px`;
                }
            });
        }

    } else if (currentSignMode === 'custom' && textInput) {
        // Update General Stored Value (No active text element)
        lastCustomTextInputValue = textInput.value;
    }
}


function handleReset() {
    if (confirm("Are you sure you want to clear the canvas and all added elements/signs? This cannot be undone.")) {
        clearCanvasAndOverlays();
        hideHelpTooltip(); // Hide tooltip on reset
        appliedPrefixSignImage = null;
        if (selectedSignItem) { selectedSignItem.classList.remove('selected'); selectedSignItem = null; }
        if (textInput) textInput.value = '';
        lastCustomTextInputValue = "";
        if (overlayColorInput) overlayColorInput.value = '#00ff00';
        if (textColor) textColor.value = '#ffffff';
        if (fontFamily) fontFamily.value = "'Comic Neue', cursive";
        if (imageUpload) imageUpload.value = '';

        if (baseImage.src && baseImage.complete && baseImage.naturalWidth > 0) {
            drawBaseImage();
            signTypeChoiceGroup.classList.remove('hidden');
            if(signTypeChoiceHeader) signTypeChoiceHeader.classList.remove('hidden');
            signTypePrefixRadio.disabled = false; signTypeCustomRadio.disabled = false;
            signTypePrefixRadio.checked = false; signTypeCustomRadio.checked = false;
            prefixOptionsGroup.classList.add('hidden'); customOptionsGroup.classList.add('hidden');
            currentSignMode = null;
            setControlsDisabled(true); // Disable all
            signTypePrefixRadio.disabled = false; signTypeCustomRadio.disabled = false; // Re-enable choice
            // Re-enable main section help buttons if they exist
            const loadHelpBtn = document.querySelector('#nft-load-group ~ .section-header .help-btn');
            if (loadHelpBtn) loadHelpBtn.disabled = false;


            nftStatusEl.textContent = "Canvas reset. Choose sign type."; nftStatusEl.className = '';
            if(signGalleryContainer) signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--portal-blue);">Loading gallery...</p>';
            if (!signConfigData) fetchSignConfig();

        } else {
            enableNftLoadControlsOnly();
            nftStatusEl.textContent = "Select collection and ID, then load NFT."; nftStatusEl.className = '';
        }
         updateCustomActionButtons();
    }
}

// --- Canvas & Overlay Management ---
function clearCanvasAndOverlays() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el => el.remove());
    setActiveElement(null); // Call setActiveElement with null to reset state
}
function clearCanvas() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}
function enableNftLoadControlsOnly() {
    setControlsDisabled(true); // Disable everything first
    if(loadNftBtn) loadNftBtn.disabled = false;
    if(nftCollectionSelect) nftCollectionSelect.disabled = false;
    if(nftTokenIdInput) nftTokenIdInput.disabled = false;
    // Re-enable NFT load help button
    const loadHelpBtn = document.querySelector('#nft-load-group ~ .section-header .help-btn');
    if (loadHelpBtn) loadHelpBtn.disabled = false;

    if(signTypeChoiceGroup) signTypeChoiceGroup.classList.add('hidden');
    if(signTypeChoiceHeader) signTypeChoiceHeader.classList.add('hidden');
    if(prefixOptionsGroup) prefixOptionsGroup.classList.add('hidden');
    if(customOptionsGroup) customOptionsGroup.classList.add('hidden');
    currentSignMode = null;
     updateCustomActionButtons(); // Ensure save/remove are disabled
}

// --- NFT Loading & Drawing ---
function getPolygonForSelectedCollection(){ const selectedCollection=nftCollectionSelect.value; if(selectedCollection==="AHC"){return[{x:1415,y:316},{x:2024,y:358},{x:1958,y:1324},{x:1358,y:1286}];}else{/* GHN default */ return[{x:1403,y:196},{x:2034,y:218},{x:1968,y:1164},{x:1358,y:1126}];} }
function resolveIpfsUrl(url) { if(url&&url.startsWith("ipfs://")){ return url.replace("ipfs://","https://ipfs.io/ipfs/"); } return url; }
async function loadNftToCanvas() {
    const selectedCollection = nftCollectionSelect.value;
    const tokenId = nftTokenIdInput.value;
    if (!tokenId || parseInt(tokenId) < 0) { nftStatusEl.textContent = "Please enter a valid, non-negative Token ID."; nftStatusEl.className = 'error'; return; }
    if (!nftContracts[selectedCollection]) { console.error(`Selected collection "${selectedCollection}" not found.`); nftStatusEl.textContent = `Error: Collection definition "${selectedCollection}" not found.`; nftStatusEl.className = 'error'; return; }

    clearCanvasAndOverlays();
    hideHelpTooltip(); // Hide tooltip on load
    appliedPrefixSignImage = null;
    if (selectedSignItem) { selectedSignItem.classList.remove('selected'); selectedSignItem = null; }
    baseImage = new Image();
    lastCustomTextInputValue = "";

    loadNftBtn.disabled = true; nftCollectionSelect.disabled = true; nftTokenIdInput.disabled = true;
    setControlsDisabled(true); // Disable everything during load
    signTypeChoiceGroup.classList.add('hidden');
    if(signTypeChoiceHeader) signTypeChoiceHeader.classList.add('hidden');
    prefixOptionsGroup.classList.add('hidden'); customOptionsGroup.classList.add('hidden');
    nftStatusEl.textContent = `Loading ${nftContracts[selectedCollection].name} #${tokenId}...`; nftStatusEl.className = '';
    clearCanvas();

    const contractInfo = nftContracts[selectedCollection];
    const contract = new ethers.Contract(contractInfo.address, nftAbi, provider);
    try {
        let tokenURI = await contract.tokenURI(tokenId).catch(contractError => {
             console.error(`Contract error fetching URI for ${tokenId}:`, contractError);
             if (contractError.message?.includes('invalid token ID') || contractError.message?.includes('URI query for nonexistent token')) { throw new Error(`Token ID ${tokenId} invalid or does not exist for ${contractInfo.name}.`); }
             else if (contractError.code === 'CALL_EXCEPTION') { throw new Error(`Contract call failed. Check network/address or if Token ID ${tokenId} exists.`); }
             throw contractError;
         });
        tokenURI = resolveIpfsUrl(tokenURI);
        if (!tokenURI) throw new Error("Received empty Token URI from contract.");

        nftStatusEl.textContent = "Fetching metadata...";
        const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
        const response = await fetch(tokenURI, { signal: controller.signal }).finally(() => clearTimeout(timeoutId));
        if (!response.ok) throw new Error(`Metadata fetch error: ${response.status} ${response.statusText} (URL: ${tokenURI.substring(0, 100)}...)`);
        const metadata = await response.json();

        let imageUrl = resolveIpfsUrl(metadata.image || metadata.image_url || metadata.imageUrl || metadata.uri);
        if (!imageUrl) throw new Error("Image URL missing in metadata");
        // Enhanced check for nested metadata (common in some contracts)
        if (imageUrl.startsWith('http') && !imageUrl.match(/\.(jpeg|jpg|gif|png|svg|webp)$/i)) {
            try {
                nftStatusEl.textContent = "Fetching secondary metadata...";
                const imgJsonResponseController = new AbortController();
                const imgJsonTimeoutId = setTimeout(() => imgJsonResponseController.abort(), 15000); // Shorter timeout for secondary
                const imgJsonResponse = await fetch(imageUrl, { signal: imgJsonResponseController.signal }).finally(() => clearTimeout(imgJsonTimeoutId));

                if (!imgJsonResponse.ok) throw new Error(`Secondary metadata fetch failed: ${imgJsonResponse.status}`);
                const imgJson = await imgJsonResponse.json();
                imageUrl = resolveIpfsUrl(imgJson.image || imgJson.image_url || imgJson.imageUrl || imgJson.uri);
                if (!imageUrl || !imageUrl.startsWith('http')) throw new Error("Image URL missing or invalid in secondary metadata");
            } catch (nestedError) { console.error("Error fetching/parsing secondary metadata:", nestedError); throw new Error("Failed to resolve image URL from nested metadata."); }
        }

        nftStatusEl.textContent = "Loading image...";
        baseImage = new Image(); baseImage.crossOrigin = "Anonymous";
        baseImage.onload = () => {
            nftStatusEl.textContent = "Drawing image..."; drawBaseImage();
            nftStatusEl.textContent = `${nftContracts[selectedCollection].name} #${tokenId} loaded! Choose sign type below.`; nftStatusEl.className = 'success';
            signTypeChoiceGroup.classList.remove('hidden');
            if(signTypeChoiceHeader) signTypeChoiceHeader.classList.remove('hidden');
            signTypePrefixRadio.disabled = false; signTypeCustomRadio.disabled = false; // Enable choices
            signTypePrefixRadio.checked = false; signTypeCustomRadio.checked = false; currentSignMode = null;
            loadNftBtn.disabled = false; nftCollectionSelect.disabled = false; nftTokenIdInput.disabled = false; // Re-enable load controls
            // Re-enable NFT load help button
            const loadHelpBtn = document.querySelector('#nft-load-group ~ .section-header .help-btn');
            if (loadHelpBtn) loadHelpBtn.disabled = false;

            if (!signConfigData) fetchSignConfig();
            updateCustomActionButtons(); // Ensure save buttons are disabled initially
        };
        baseImage.onerror = (err) => {
             console.error("Error loading NFT image:", err, "Attempted URL:", imageUrl); nftStatusEl.textContent = `Error loading image. Check console. (URL: ${imageUrl.substring(0,100)}...)`; nftStatusEl.className = 'error';
             enableNftLoadControlsOnly(); ctx.fillStyle = "white"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("Image Load Error", canvasWidth / 2, canvasHeight / 2);
        };
        baseImage.src = imageUrl;
    } catch (err) {
         console.error(`Error processing NFT ${tokenId}:`, err); let errorMsg = "Error: " + err.message;
         if (err.name === 'AbortError') { errorMsg = "Error: Request timed out."; }
         nftStatusEl.textContent = errorMsg; nftStatusEl.className = 'error'; enableNftLoadControlsOnly();
         ctx.fillStyle = "white"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("NFT Load Error", canvasWidth / 2, canvasHeight / 2);
    }
}
function drawBaseImage() {
    if(!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { console.warn("drawBaseImage called with incomplete or invalid image."); clearCanvas(); return; }
    ctx.clearRect(0,0,canvasWidth,canvasHeight); ctx.fillStyle="#444"; ctx.fillRect(0,0,canvasWidth,canvasHeight);
    const canvasAspect = canvasWidth / canvasHeight; const imageAspect = baseImage.naturalWidth / baseImage.naturalHeight;
    let drawWidth, drawHeight, x, y;
    if (imageAspect > canvasAspect) { drawWidth = canvasWidth; drawHeight = drawWidth / imageAspect; x = 0; y = (canvasHeight - drawHeight) / 2; }
    else { drawHeight = canvasHeight; drawWidth = drawHeight * imageAspect; y = 0; x = (canvasWidth - drawWidth) / 2; }
    try { ctx.drawImage(baseImage, x, y, drawWidth, drawHeight); }
    catch(e) { console.error("Error drawing base image:", e); nftStatusEl.textContent="Error drawing NFT image."; nftStatusEl.className='error'; ctx.fillStyle = "red"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("Draw Error", canvasWidth / 2, canvasHeight / 2); }
}
function applyOverlay(clearExistingOverlays = true) { // For CUSTOM sign color overlay
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) return;
    if (currentSignMode === 'custom') {
        drawBaseImage();
        drawSignPolygonOnly();
    } else {
         drawBaseImage();
    }
}
function drawSignPolygonOnly() {
    if (currentSignMode !== 'custom' || !baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) return;
    const color = overlayColorInput.value; const currentPolygon = getPolygonForSelectedCollection();
    if (!currentPolygon || currentPolygon.length < 3) return;
    ctx.save(); ctx.beginPath(); ctx.moveTo(currentPolygon[0].x, currentPolygon[0].y);
    for (let i = 1; i < currentPolygon.length; i++) { ctx.lineTo(currentPolygon[i].x, currentPolygon[i].y); }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.lineJoin = "round"; ctx.lineWidth = 14; ctx.strokeStyle = "black"; ctx.stroke(); ctx.restore();
}

// --- Sign Gallery Functions ---
async function fetchSignConfig() {
    if (signConfigData || isSignConfigLoading) return signConfigData;
    isSignConfigLoading = true; const configUrl = SIGNS_JSON_PATH;
    try {
        nftStatusEl.textContent = "Loading sign gallery configuration..."; nftStatusEl.className = '';
        const response = await fetch(configUrl); if (!response.ok) throw new Error(`HTTP error! status: ${response.status} fetching ${configUrl}`);
        signConfigData = await response.json(); if (!signConfigData.githubUser || !signConfigData.githubRepo || !signConfigData.githubBranch || !signConfigData.imageBasePath || typeof signConfigData.categories !== 'object') { throw new Error("Invalid signs.json structure."); }
        nftStatusEl.textContent = "Sign gallery configuration loaded."; nftStatusEl.className = 'success'; if (currentSignMode === 'prefix') populateSignGallery(); return signConfigData;
    } catch (error) {
        console.error("Error fetching/parsing sign config:", error); nftStatusEl.textContent = `Error loading sign gallery: ${error.message}. Check console.`; nftStatusEl.className = 'error'; if (signGalleryContainer) signGalleryContainer.innerHTML = `<p style="color: var(--error-red);">Error loading signs config. Check console.</p>`; signConfigData = null; return null;
    } finally { isSignConfigLoading = false; }
}
function populateSignGallery() {
    if (!signGalleryContainer) return; if (isSignConfigLoading) { signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--portal-blue);">Loading gallery config...</p>'; return; }
    if (!signConfigData) { fetchSignConfig().then(config => { if (config) { populateSignGallery(); } else { signGalleryContainer.innerHTML = '<p style="color: var(--error-red);">Failed to load gallery config.</p>'; } }); signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--portal-blue);">Fetching gallery config...</p>'; return; }
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { signGalleryContainer.innerHTML = '<p style="font-style: italic; color: var(--error-red);">Load NFT first.</p>'; return; }
    const currentCollectionKey = nftCollectionSelect.value; const signsForCollection = signConfigData.categories[currentCollectionKey]; signGalleryContainer.innerHTML = '';
    if (!signsForCollection || !Array.isArray(signsForCollection) || signsForCollection.length === 0) { signGalleryContainer.innerHTML = `<p style="font-style: italic;">No specific signs found for ${nftContracts[currentCollectionKey]?.name || currentCollectionKey}.</p>`; return; }
    const { githubUser, githubRepo, githubBranch, imageBasePath } = signConfigData; const baseUrl = `https://raw.githubusercontent.com/${githubUser}/${githubRepo}/${githubBranch}/${imageBasePath}/`;
    signsForCollection.forEach(sign => {
        if (!sign.fileName) { console.warn("Skipping sign entry with missing fileName:", sign); return; } const signImageUrl = baseUrl + sign.fileName; const signName = sign.name || sign.fileName.split('/').pop().split('.')[0];
        const itemDiv = document.createElement('div'); itemDiv.className = 'sign-item'; itemDiv.title = `Apply: ${signName}`; itemDiv.dataset.imageUrl = signImageUrl; itemDiv.dataset.signName = signName;
        const img = document.createElement('img'); img.src = signImageUrl; img.alt = signName; img.loading = "lazy";
        img.onerror = () => { img.alt = `${signName} (Load Error)`; img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 40'%3E%3Crect width='50' height='40' fill='%23555'/%3E%3Ctext x='50%' y='50%' fill='red' font-size='9' dominant-baseline='middle' text-anchor='middle'%3EError%3C/text%3E%3C/svg%3E"; itemDiv.style.borderColor = 'var(--error-red)'; console.warn(`Failed to load sign image: ${signImageUrl}`); };
        const nameSpan = document.createElement('span'); nameSpan.textContent = signName; itemDiv.appendChild(img); itemDiv.appendChild(nameSpan);
        itemDiv.addEventListener('click', () => {
            if (currentSignMode !== 'prefix') return; const clickedImageUrl = itemDiv.dataset.imageUrl; const clickedSignName = itemDiv.dataset.signName; if (selectedSignItem && selectedSignItem !== itemDiv) { selectedSignItem.classList.remove('selected'); }
            if (selectedSignItem === itemDiv) { itemDiv.classList.remove('selected'); selectedSignItem = null; appliedPrefixSignImage = null; if(baseImage.src && baseImage.complete) drawBaseImage(); if(savePrefixBtn) savePrefixBtn.disabled = true; nftStatusEl.textContent = "Sign removed."; nftStatusEl.className = ''; }
            else { itemDiv.classList.add('selected'); selectedSignItem = itemDiv; applyPrefixSign(clickedImageUrl, clickedSignName); }
        });
        signGalleryContainer.appendChild(itemDiv);
        if (appliedPrefixSignImage && appliedPrefixSignImage.src === signImageUrl) { itemDiv.classList.add('selected'); selectedSignItem = itemDiv; if (savePrefixBtn && baseImage.complete && baseImage.naturalWidth > 0) { savePrefixBtn.disabled = false; } }
    });
    updateCustomActionButtons();
}

// ===========================================================
// applyPrefixSign - Do NOT remove custom overlays (FIX APPLIED)
// ===========================================================
function applyPrefixSign(signImageUrl, signName) {
    if (!baseImage.src || !baseImage.complete || currentSignMode !== 'prefix') return;
    nftStatusEl.textContent = `Applying sign: ${signName}...`; nftStatusEl.className = '';
    if(savePrefixBtn) savePrefixBtn.disabled = true;

    const signImage = new Image(); signImage.crossOrigin = "Anonymous";
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


// ===========================================================
// addText - Adjust text input handling (FIX APPLIED)
// ===========================================================
function addText() {
    if (currentSignMode !== 'custom') { nftStatusEl.textContent = "Switch to Custom Sign mode."; nftStatusEl.className = 'error'; return; }
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { nftStatusEl.textContent = "Load NFT first."; nftStatusEl.className = 'error'; return; }

    const textValue = textInput.value || "New Text";

    const textEl = document.createElement("div"); textEl.className = "textOverlay";
    const textNode = document.createTextNode(textValue); textEl.appendChild(textNode);
    textEl.style.color = textColor.value; textEl.style.fontSize = `${DEFAULT_FONT_SIZE}px`; textEl.style.fontFamily = fontFamily.value;
    textEl.style.transform = `translate(-50%, -50%) rotate(0deg)`; textEl.style.zIndex = "10"; textEl.style.width = 'auto'; textEl.style.whiteSpace = 'nowrap'; textEl.style.overflow = 'hidden';

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
    requestAnimationFrame(() => {
        if (textEl && container.contains(textEl)) {
            const initialWidth = textEl.offsetWidth; textEl.style.width = `${Math.max(initialWidth, 30)}px`; textEl.style.whiteSpace = 'normal'; textEl.style.overflow = 'visible';
            setActiveElement(textEl);
        }
    });
}


function addImage() {
    if (currentSignMode !== 'custom') { nftStatusEl.textContent = "Switch to Custom Sign mode."; nftStatusEl.className = 'error'; return; }
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { nftStatusEl.textContent = "Load NFT first."; nftStatusEl.className = 'error'; return; }
    if (!imageUpload || !imageUpload.files || imageUpload.files.length === 0) { nftStatusEl.textContent = "Please select an image file."; nftStatusEl.className = 'error'; return; }
    const file = imageUpload.files[0]; if (!file.type.startsWith('image/')) { nftStatusEl.textContent = "Invalid file type. Please select an image."; nftStatusEl.className = 'error'; imageUpload.value = ''; return; }
    const reader = new FileReader();
    reader.onload = function (e) {
        const wrapper = document.createElement("div"); wrapper.className = "imgOverlay"; wrapper.style.position="absolute"; wrapper.style.width="100px"; wrapper.style.height="auto"; wrapper.style.transform="translate(-50%, -50%) rotate(0deg)"; wrapper.style.touchAction="none"; wrapper.style.zIndex="20";
        const img = document.createElement("img"); img.src = e.target.result;
        img.onload = () => {
             if(container.offsetWidth > 0 && img.naturalWidth > 0 && img.naturalHeight > 0){ const contW = container.offsetWidth; const initialWidth = Math.min(img.naturalWidth * 0.5, contW * 0.4, 150); const aspectRatio = img.naturalWidth / img.naturalHeight; wrapper.style.width=`${initialWidth}px`; wrapper.style.height=`${initialWidth / aspectRatio}px`; }
             else { wrapper.style.width='100px'; wrapper.style.height='auto'; console.warn("Could not determine container/image size for initial scaling, using fallback."); }
             const currentPolygon = getPolygonForSelectedCollection(); const minX=Math.min(...currentPolygon.map(p=>p.x));const maxX=Math.max(...currentPolygon.map(p=>p.x)); const minY=Math.min(...currentPolygon.map(p=>p.y));const maxY=Math.max(...currentPolygon.map(p=>p.y)); const signCenterXPercent=canvasWidth?((minX+maxX)/2)/canvasWidth*100:50; const signCenterYPercent=canvasHeight?((minY+maxY)/2)/canvasHeight*100:50; const{x:initialX,y:initialY}=calculateElementPosition(signCenterXPercent,signCenterYPercent); wrapper.style.left=`${initialX}px`; wrapper.style.top=`${initialY}px`;
             setActiveElement(wrapper);
         };
        img.onerror = ()=>{ console.error("Error loading added image data."); nftStatusEl.textContent="Error displaying uploaded image."; nftStatusEl.className='error'; wrapper.remove(); };
        wrapper.appendChild(img);
        const rotateHandle = document.createElement("div"); rotateHandle.className = "handle rotation-handle"; rotateHandle.innerHTML = '↻'; wrapper.appendChild(rotateHandle);
        // NOTE: Image uses the SAME right resize handle class as text for simplicity, CSS handles the positioning difference.
        const resizeHandle = document.createElement("div"); resizeHandle.className = "handle resize-handle-base resize-handle-right"; resizeHandle.title = "Resize Image"; wrapper.appendChild(resizeHandle);

        wrapper.addEventListener("mousedown", handleImageDragStart); wrapper.addEventListener("touchstart", handleImageDragStart, { passive: true });
        rotateHandle.addEventListener("mousedown", handleImageRotateStart); rotateHandle.addEventListener("touchstart", handleImageRotateStart, { passive: true });
        resizeHandle.addEventListener("mousedown", handleImageResizeStart); resizeHandle.addEventListener("touchstart", handleImageResizeStart, { passive: true });
        container.appendChild(wrapper); nftStatusEl.textContent = "Image added."; nftStatusEl.className = 'success'; imageUpload.value = '';
    };
    reader.onerror = function (err) { console.error("FileReader error:",err); nftStatusEl.textContent="Error reading image file."; nftStatusEl.className='error'; }
    reader.readAsDataURL(file);
}

// ===========================================================
// setActiveElement - Hide help tooltip on element selection change
// ===========================================================
function setActiveElement(el) {
    const previouslyActiveElement = activeElement;
    if (previouslyActiveElement !== el) {
         hideHelpTooltip(); // Hide tooltip when selection changes
    }

    // Deselect Previous
    if (previouslyActiveElement && previouslyActiveElement !== el) {
        if (container.contains(previouslyActiveElement)) {
            previouslyActiveElement.classList.remove("active");
            previouslyActiveElement.style.zIndex = previouslyActiveElement.classList.contains('imgOverlay') ? '20' : '10';
        }
         // If deselecting a text overlay, store its current input value
         if (previouslyActiveElement.classList.contains('textOverlay') && currentSignMode === 'custom' && textInput) {
             // No action needed here, textInput should already reflect the active element's value
         } else if (currentSignMode === 'custom' && textInput) {
            // If deselecting something else (or clicking outside), restore the general text value
            textInput.value = lastCustomTextInputValue;
        }
    }

    // Select New Element
    if (el && currentSignMode === 'custom' && container.contains(el)) {
        el.classList.add("active");
        activeElement = el;
        el.style.zIndex = el.classList.contains('imgOverlay') ? '101' : '100';

        if (el.classList.contains('textOverlay')) {
            // Set controls FROM selected TEXT element
            let textNode = el.childNodes[0];
            while (textNode && textNode.nodeType !== Node.TEXT_NODE) { textNode = textNode.nextSibling; }
            // Handle cases where text might be empty or only contain handles initially
            let currentTextValue = "";
            if (textNode) {
                currentTextValue = textNode.nodeValue.trim(); // Get text content, trim whitespace
            } else {
                // Fallback: Look for text content excluding handle symbols if no text node found
                 currentTextValue = Array.from(el.childNodes)
                     .filter(node => node.nodeType === Node.TEXT_NODE)
                     .map(node => node.nodeValue)
                     .join('')
                     .replace(/[↻⇦⇨]/g, '') // Remove handle symbols just in case
                     .trim();
            }


            textInput.value = currentTextValue; // Set input field FROM the element

            textColor.value = rgb2hex(el.style.color || '#ffffff');
            const currentFont = (el.style.fontFamily || 'Arial').split(',')[0].replace(/['"]/g, "").trim();
            let foundFont = false;
            for (let option of fontFamily.options) { if (option.value.includes(currentFont)) { fontFamily.value = option.value; foundFont = true; break; } }
            if (!foundFont) fontFamily.value = 'Arial';

        } else if (el.classList.contains('imgOverlay')) {
             // If selecting an IMAGE overlay, ensure input shows general value
             if (currentSignMode === 'custom' && textInput) {
                 textInput.value = lastCustomTextInputValue;
             }
        }

    } else {
        // Deselecting Completely (clicked outside, etc.)
        activeElement = null;
        if (currentSignMode === 'custom' && textInput) {
            textInput.value = lastCustomTextInputValue; // Restore general text value
        }
    }
    updateCustomActionButtons();
}


// ===========================================================
// removeActiveElement - Adjust text input handling (FIX APPLIED)
// ===========================================================
function removeActiveElement(event) {
    if (event) { event.stopPropagation(); }
    hideHelpTooltip(); // Hide tooltip if removing element

    if (activeElement && container.contains(activeElement) && currentSignMode === 'custom') {
        const elementType = activeElement.classList.contains('textOverlay') ? 'Text' : 'Image';
        activeElement.remove();
        setActiveElement(null); // Deselect and restore general text value if needed
        nftStatusEl.textContent = `${elementType} element removed.`;
        nftStatusEl.className = '';
    } else if (currentSignMode !== 'custom') {
        nftStatusEl.textContent = "Delete only works in Custom Sign mode.";
        nftStatusEl.className = 'error';
        console.warn("Delete clicked outside custom mode.");
    } else if (!activeElement) {
        nftStatusEl.textContent = "No element selected to delete.";
        nftStatusEl.className = 'error';
        console.warn("Delete clicked with no active element.");
    } else {
         console.warn("Attempted to delete an element not in container or invalid state.", activeElement);
         setActiveElement(null);
         nftStatusEl.textContent = "Could not delete element.";
         nftStatusEl.className = 'error';
    }
}


// --- Interaction Handlers ---
function getEventCoordinates(event) { let x,y; if(event.touches&&event.touches.length>0){x=event.touches[0].clientX;y=event.touches[0].clientY;}else if(event.changedTouches&&event.changedTouches.length>0){x=event.changedTouches[0].clientX;y=event.changedTouches[0].clientY;}else{x=event.clientX;y=event.clientY;} return{x,y}; }
function getRotationRad(element) { if(!element||!element.style)return 0; const transform=element.style.transform; const rotateMatch=transform.match(/rotate\((-?\d+(\.\d+)?)deg\)/); const rotationDeg=rotateMatch?parseFloat(rotateMatch[1]):0; return rotationDeg*(Math.PI/180); }
function handleTextDragStart(event) { if (event.target.classList.contains('handle') || currentSignMode !== 'custom') return; hideHelpTooltip(); const el = event.currentTarget; setActiveElement(el); textInteractionState.isDragging = true; textInteractionState.isRotating = false; textInteractionState.isResizingWidth = false; textInteractionState.isResizingFontSize = false; el.style.cursor = 'grabbing'; document.body.style.cursor = 'grabbing'; const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); textInteractionState.startX = coords.x - contRect.left; textInteractionState.startY = coords.y - contRect.top; textInteractionState.startLeft = parseFloat(el.style.left || "0"); textInteractionState.startTop = parseFloat(el.style.top || "0"); document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextRotateStart(event) { if (currentSignMode !== 'custom') return; hideHelpTooltip(); event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); textInteractionState.isRotating = true; textInteractionState.isDragging = false; textInteractionState.isResizingWidth = false; textInteractionState.isResizingFontSize = false; document.body.style.cursor = 'alias'; const coords = getEventCoordinates(event); const rect = el.getBoundingClientRect(); textInteractionState.rotateCenterX = rect.left + rect.width / 2; textInteractionState.rotateCenterY = rect.top + rect.height / 2; const dx = coords.x - textInteractionState.rotateCenterX; const dy = coords.y - textInteractionState.rotateCenterY; let startAngle = Math.atan2(dy, dx); const currentRotationRad = getRotationRad(el); textInteractionState.rotateStartAngle = startAngle - currentRotationRad; document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextResizeWidthStart(event) { if (currentSignMode !== 'custom') return; hideHelpTooltip(); event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); textInteractionState.isResizingWidth = true; textInteractionState.isResizingFontSize = false; textInteractionState.isRotating = false; textInteractionState.isDragging = false; document.body.style.cursor = 'ew-resize'; const coords = getEventCoordinates(event); textInteractionState.startX = coords.x; textInteractionState.startY = coords.y; textInteractionState.startWidth = el.offsetWidth; textInteractionState.currentRotationRad = getRotationRad(el); el.style.whiteSpace = 'normal'; el.style.overflow = 'hidden'; document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextResizeFontSizeStart(event) { if (currentSignMode !== 'custom') return; hideHelpTooltip(); event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); textInteractionState.isResizingFontSize = true; textInteractionState.isResizingWidth = false; textInteractionState.isRotating = false; textInteractionState.isDragging = false; document.body.style.cursor = 'ns-resize'; const coords = getEventCoordinates(event); textInteractionState.startX = coords.x; textInteractionState.startY = coords.y; textInteractionState.startFontSize = parseFloat(el.style.fontSize) || DEFAULT_FONT_SIZE; document.addEventListener("mousemove", handleTextInteractionMove); document.addEventListener("mouseup", handleTextInteractionEnd); document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); document.addEventListener("touchend", handleTextInteractionEnd); document.addEventListener("touchcancel", handleTextInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleTextInteractionMove(event) { if (!activeElement || !activeElement.classList.contains('textOverlay') || (!textInteractionState.isDragging && !textInteractionState.isRotating && !textInteractionState.isResizingWidth && !textInteractionState.isResizingFontSize)) return; if (event.type === 'touchmove') event.preventDefault(); const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); if (textInteractionState.isDragging) { const currentX = coords.x - contRect.left; const currentY = coords.y - contRect.top; activeElement.style.left = `${textInteractionState.startLeft + (currentX - textInteractionState.startX)}px`; activeElement.style.top = `${textInteractionState.startTop + (currentY - textInteractionState.startY)}px`; } else if (textInteractionState.isRotating) { const dx = coords.x - textInteractionState.rotateCenterX; const dy = coords.y - textInteractionState.rotateCenterY; let angle = Math.atan2(dy, dx); let rotationRad = angle - textInteractionState.rotateStartAngle; let rotationDeg = rotationRad * (180 / Math.PI); activeElement.style.transform = `translate(-50%, -50%) rotate(${rotationDeg}deg)`; } else if (textInteractionState.isResizingWidth) { const dx = coords.x - textInteractionState.startX; const dy = coords.y - textInteractionState.startY; const rotation = textInteractionState.currentRotationRad; const cosR = Math.cos(rotation); const sinR = Math.sin(rotation); const projectedDx = dx * cosR + dy * sinR; let newWidth = textInteractionState.startWidth + projectedDx; activeElement.style.width = `${Math.max(30, newWidth)}px`; } else if (textInteractionState.isResizingFontSize) { const dy = coords.y - textInteractionState.startY; let newSize = textInteractionState.startFontSize - (dy * FONT_SIZE_SENSITIVITY); activeElement.style.fontSize = `${Math.max(MIN_FONT_SIZE, newSize)}px`; } }
function handleTextInteractionEnd(event) { if (activeElement && activeElement.classList.contains('textOverlay')) { activeElement.style.cursor = 'grab'; if (textInteractionState.isResizingWidth || textInteractionState.isResizingFontSize) { activeElement.style.overflow = 'visible'; } } document.body.style.cursor = 'default'; textInteractionState.isDragging = false; textInteractionState.isRotating = false; textInteractionState.isResizingWidth = false; textInteractionState.isResizingFontSize = false; document.removeEventListener("mousemove", handleTextInteractionMove); document.removeEventListener("mouseup", handleTextInteractionEnd); document.removeEventListener("touchmove", handleTextInteractionMove); document.removeEventListener("touchend", handleTextInteractionEnd); document.removeEventListener("touchcancel", handleTextInteractionEnd); }
function handleImageDragStart(event) { if (event.target.classList.contains('handle') || currentSignMode !== 'custom') return; hideHelpTooltip(); const el = event.currentTarget; setActiveElement(el); imageInteractionState.isDragging = true; imageInteractionState.isRotating = false; imageInteractionState.isResizing = false; el.style.cursor = 'grabbing'; document.body.style.cursor = 'grabbing'; const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); imageInteractionState.startX = coords.x - contRect.left; imageInteractionState.startY = coords.y - contRect.top; imageInteractionState.startLeft = parseFloat(el.style.left || "0"); imageInteractionState.startTop = parseFloat(el.style.top || "0"); document.addEventListener("mousemove", handleImageInteractionMove); document.addEventListener("mouseup", handleImageInteractionEnd); document.addEventListener("touchmove", handleImageInteractionMove, { passive: false }); document.addEventListener("touchend", handleImageInteractionEnd); document.addEventListener("touchcancel", handleImageInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleImageRotateStart(event) { if (currentSignMode !== 'custom') return; hideHelpTooltip(); event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); imageInteractionState.isRotating = true; imageInteractionState.isDragging = false; imageInteractionState.isResizing = false; document.body.style.cursor = 'alias'; const coords = getEventCoordinates(event); const rect = el.getBoundingClientRect(); imageInteractionState.centerX = rect.left + rect.width / 2; imageInteractionState.centerY = rect.top + rect.height / 2; const dx = coords.x - imageInteractionState.centerX; const dy = coords.y - imageInteractionState.centerY; let startAngle = Math.atan2(dy, dx); imageInteractionState.currentRotationRad = getRotationRad(el); imageInteractionState.startAngle = startAngle - imageInteractionState.currentRotationRad; document.addEventListener("mousemove", handleImageInteractionMove); document.addEventListener("mouseup", handleImageInteractionEnd); document.addEventListener("touchmove", handleImageInteractionMove, { passive: false }); document.addEventListener("touchend", handleImageInteractionEnd); document.addEventListener("touchcancel", handleImageInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleImageResizeStart(event) { if (currentSignMode !== 'custom') return; hideHelpTooltip(); event.stopPropagation(); const el = event.currentTarget.parentElement; setActiveElement(el); imageInteractionState.isResizing = true; imageInteractionState.isRotating = false; imageInteractionState.isDragging = false; document.body.style.cursor = 'nwse-resize'; // Corner resize cursor
    const coords = getEventCoordinates(event); imageInteractionState.startX = coords.x; imageInteractionState.startY = coords.y; imageInteractionState.startWidth = el.offsetWidth; imageInteractionState.startHeight = el.offsetHeight; imageInteractionState.aspectRatio = imageInteractionState.startHeight > 0 ? imageInteractionState.startWidth / imageInteractionState.startHeight : 1; imageInteractionState.currentRotationRad = getRotationRad(el); const rect = el.getBoundingClientRect(); imageInteractionState.centerX = rect.left + rect.width / 2; imageInteractionState.centerY = rect.top + rect.height / 2; document.addEventListener("mousemove", handleImageInteractionMove); document.addEventListener("mouseup", handleImageInteractionEnd); document.addEventListener("touchmove", handleImageInteractionMove, { passive: false }); document.addEventListener("touchend", handleImageInteractionEnd); document.addEventListener("touchcancel", handleImageInteractionEnd); if (event.type === 'mousedown') event.preventDefault(); }
function handleImageInteractionMove(event) { if (!activeElement || !activeElement.classList.contains('imgOverlay') || (!imageInteractionState.isDragging && !imageInteractionState.isRotating && !imageInteractionState.isResizing)) return; if (event.type === 'touchmove') event.preventDefault(); const coords = getEventCoordinates(event); const contRect = container.getBoundingClientRect(); if (imageInteractionState.isDragging) { const currentX = coords.x - contRect.left; const currentY = coords.y - contRect.top; activeElement.style.left = `${imageInteractionState.startLeft + (currentX - imageInteractionState.startX)}px`; activeElement.style.top = `${imageInteractionState.startTop + (currentY - imageInteractionState.startY)}px`; } else if (imageInteractionState.isRotating) { const dx = coords.x - imageInteractionState.centerX; const dy = coords.y - imageInteractionState.centerY; let angle = Math.atan2(dy, dx); let rotationRad = angle - imageInteractionState.startAngle; let rotationDeg = rotationRad * (180 / Math.PI); activeElement.style.transform = `translate(-50%, -50%) rotate(${rotationDeg}deg)`; } else if (imageInteractionState.isResizing) { const startDist = Math.hypot(imageInteractionState.startX - imageInteractionState.centerX, imageInteractionState.startY - imageInteractionState.centerY); const currentDist = Math.hypot(coords.x - imageInteractionState.centerX, coords.y - imageInteractionState.centerY); const scaleFactor = startDist > 0 ? currentDist / startDist : 1; let newWidth = imageInteractionState.startWidth * scaleFactor; let newHeight = imageInteractionState.aspectRatio > 0 ? newWidth / imageInteractionState.aspectRatio : newWidth; activeElement.style.width = `${Math.max(30, newWidth)}px`; activeElement.style.height = `${Math.max(30 / (imageInteractionState.aspectRatio || 1), newHeight)}px`; } }
function handleImageInteractionEnd(event) { if (activeElement && activeElement.classList.contains('imgOverlay')) { activeElement.style.cursor = 'grab'; } document.body.style.cursor = 'default'; imageInteractionState.isDragging = false; imageInteractionState.isRotating = false; imageInteractionState.isResizing = false; document.removeEventListener("mousemove", handleImageInteractionMove); document.removeEventListener("mouseup", handleImageInteractionEnd); document.removeEventListener("touchmove", handleImageInteractionMove); document.removeEventListener("touchend", handleImageInteractionEnd); document.removeEventListener("touchcancel", handleImageInteractionEnd); }

// --- Utility Functions ---
function calculateElementPosition(percentX, percentY) { const contRect=container.getBoundingClientRect();if(!contRect||contRect.width===0||contRect.height===0)return{x:0,y:0}; return { x: contRect.width * (percentX/100), y: contRect.height * (percentY/100) }; }
function getCanvasCoordsFromContainerPoint(containerX, containerY) { const contRect=container.getBoundingClientRect();if(!contRect||contRect.width===0||contRect.height===0)return{canvasX:0,canvasY:0};const scaleX=canvasWidth/contRect.width; const scaleY=canvasHeight/contRect.height; return{canvasX:containerX*scaleX,canvasY:containerY*scaleY};}
function pointInPolygon(point, vs) { const x = point.x, y = point.y; let inside = false; for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) { const xi = vs[i].x, yi = vs[i].y; const xj = vs[j].x, yj = vs[j].y; const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi); if (intersect) inside = !inside; } return inside; }
function rgb2hex(rgb) { if(!rgb)return'#ffffff'; if(rgb.startsWith('#'))return rgb; const rgbMatch=rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/); if(rgbMatch){return"#"+rgbMatch.slice(1).map(x=>{const hex=parseInt(x).toString(16);return hex.length===1?"0"+hex:hex;}).join('');} return rgb; }
function getWrappedTextLines(text, maxWidthPx, fontStyle) { if (!text || maxWidthPx <= 0) return []; ctx.font = fontStyle; const words = text.split(' '); const lines = []; let currentLine = ''; for (let i = 0; i < words.length; i++) { const word = words[i]; const testLine = currentLine ? currentLine + " " + word : word; const testWidth = ctx.measureText(testLine).width; if (testWidth <= maxWidthPx || !currentLine) { currentLine = testLine; } else { lines.push(currentLine); currentLine = word; if (ctx.measureText(currentLine).width > maxWidthPx) { let tempLine = ''; for(let char of currentLine) { if(ctx.measureText(tempLine + char).width > maxWidthPx && tempLine) { lines.push(tempLine); tempLine = char; } else { tempLine += char; } } currentLine = tempLine; } } } if (currentLine) { lines.push(currentLine); } return lines; }


// --- Save Functionality ---
function saveImage() {
    const currentNftId = nftTokenIdInput.value || 'unknown';
    const currentCollection = nftCollectionSelect.value || 'unknown';
    hideHelpTooltip(); // Hide tooltip before saving

    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { alert("Load a valid NFT first!"); nftStatusEl.className = 'error'; nftStatusEl.textContent = "NFT not loaded for saving."; return; }
    if (currentSignMode === 'prefix' && !appliedPrefixSignImage) { alert("Select a sign from the gallery before saving."); nftStatusEl.className = 'error'; nftStatusEl.textContent = "No sign selected from gallery."; return; }

    nftStatusEl.textContent = `Generating final image...`; nftStatusEl.className = '';
    const previouslyActive = activeElement; if (activeElement) setActiveElement(null); // Deselect for clean save

    // Start Drawing
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    drawBaseImage();

    if (currentSignMode === 'prefix' && appliedPrefixSignImage && appliedPrefixSignImage.complete) {
        try { ctx.drawImage(appliedPrefixSignImage, 0, 0, canvasWidth, canvasHeight); } catch (e) { console.error("Error drawing prefix sign during save:", e); }
    } else if (currentSignMode === 'custom') {
        drawSignPolygonOnly(); // Draw custom color polygon

        const containerRect = container.getBoundingClientRect();
        if (!containerRect || containerRect.width === 0 || containerRect.height === 0) { console.error("Error getting container rect during save"); nftStatusEl.className='error'; nftStatusEl.textContent="Save Error: Container rect invalid."; if(previouslyActive && container.contains(previouslyActive)) setActiveElement(previouslyActive); return; }
        const scaleX = canvasWidth / containerRect.width;
        const scaleY = canvasHeight / containerRect.height;

        const allOverlays = Array.from(container.querySelectorAll(".textOverlay, .imgOverlay"));
        allOverlays.sort((a, b) => (parseInt(window.getComputedStyle(a).zIndex) || 0) - (parseInt(window.getComputedStyle(b).zIndex) || 0));

        allOverlays.forEach(el => {
            if (!container.contains(el) || el.classList.contains('hidden-overlay')) return; // Skip hidden overlays

            const elRect = el.getBoundingClientRect(); const rotationRad = getRotationRad(el);
            const relativeCenterX = (elRect.left + elRect.width / 2) - containerRect.left;
            const relativeCenterY = (elRect.top + elRect.height / 2) - containerRect.top;
            const canvasX = Math.round(relativeCenterX * scaleX); const canvasY = Math.round(relativeCenterY * scaleY);

            ctx.save(); ctx.translate(canvasX, canvasY); ctx.rotate(rotationRad);

            if (el.classList.contains('textOverlay')) {
                let textNode = el.childNodes[0]; while (textNode && textNode.nodeType !== Node.TEXT_NODE) { textNode = textNode.nextSibling; }
                const text = textNode ? textNode.nodeValue : (el.textContent || '').replace(/[↻⇦⇨]/g, '').trim(); // Get text, remove handle chars
                const color = el.style.color || '#ffffff'; const size = parseFloat(el.style.fontSize) || DEFAULT_FONT_SIZE; const font = el.style.fontFamily || 'Arial'; const domWidth = el.offsetWidth;
                const canvasFontSize = Math.round(size * scaleY); const canvasMaxWidth = Math.round(domWidth * scaleX);
                if (canvasFontSize >= 1 && text) {
                    const fontStyle = `${canvasFontSize}px ${font}`; ctx.font = fontStyle; ctx.fillStyle = color; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                    const lines = getWrappedTextLines(text, canvasMaxWidth, fontStyle); const lineHeight = canvasFontSize * 1.2; const totalTextHeight = lines.length * lineHeight; let currentY = -(totalTextHeight / 2) + (lineHeight / 2);
                    lines.forEach(line => { ctx.fillText(line, 0, currentY); currentY += lineHeight; });
                }
            } else if (el.classList.contains('imgOverlay')) {
                const imgElement = el.querySelector('img');
                if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
                    const domWidth = el.offsetWidth; const domHeight = el.offsetHeight;
                    const canvasDrawWidth = Math.round(domWidth * scaleX); const canvasDrawHeight = Math.round(domHeight * scaleY);
                    if (canvasDrawWidth > 0 && canvasDrawHeight > 0) { try { ctx.drawImage(imgElement, -canvasDrawWidth / 2, -canvasDrawHeight / 2, canvasDrawWidth, canvasDrawHeight); } catch (e) { console.error("Error drawing image overlay during save:", e); } }
                } else { console.warn("Skipping unloaded/invalid image overlay during save:", imgElement?.src); }
            }
            ctx.restore();
        });
    }
    // End Drawing

    // Generate Download Link
    try {
        const dataURL = canvas.toDataURL("image/png"); const link = document.createElement("a");
        let filename = ""; const safeCollection = currentCollection.replace(/[^a-z0-9]/gi, '_').toLowerCase(); const safeNftId = currentNftId.replace(/[^a-z0-9]/gi, '_');
        if (currentSignMode === 'prefix' && appliedPrefixSignImage) {
            const signName = appliedPrefixSignImage.alt || 'sign'; const safeSignName = signName.replace(/[^a-z0-9]/gi, '_').toLowerCase(); filename = `signed-${safeCollection}-${safeNftId}-${safeSignName}.png`;
        } else { filename = `custom-${safeCollection}-${safeNftId}.png`; }
        link.download = filename; link.href = dataURL; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        nftStatusEl.textContent = `Image saved as ${filename}!`; nftStatusEl.className = 'success';
    } catch (e) {
        console.error("Error saving image:", e); nftStatusEl.className = 'error';
        if (e.name === "SecurityError") { alert("Save Error: Cannot save due to cross-origin image security restrictions (CORS). Ensure NFT/Sign images allow anonymous access."); nftStatusEl.textContent = "Save Error: CORS issue."; }
        else { alert("An error occurred saving the image. Check console."); nftStatusEl.textContent = "Save Error. Check console."; }
    }

     // Restore Canvas View & Active Element
     setTimeout(() => {
         if (baseImage.src && baseImage.complete) {
             if (currentSignMode === 'prefix' && appliedPrefixSignImage) { drawBaseImage(); ctx.drawImage(appliedPrefixSignImage, 0, 0, canvasWidth, canvasHeight); }
             else if (currentSignMode === 'custom') { applyOverlay(false); } // Redraw custom overlay + base
             else { drawBaseImage(); }
         } else { clearCanvas(); }
         if (previouslyActive && container.contains(previouslyActive)) {
             setActiveElement(previouslyActive); // Re-select the previously active element
         } else {
             // If nothing was active or element was removed, ensure controls reflect state
             if (currentSignMode === 'custom' && textInput) {
                 textInput.value = lastCustomTextInputValue; // Restore general text value
             }
             updateCustomActionButtons(); // Update button states (e.g., disable remove)
         }
         // Ensure custom overlays are visible again if in custom mode
         if (currentSignMode === 'custom') {
             const customOverlays = container.querySelectorAll('.textOverlay, .imgOverlay');
             customOverlays.forEach(el => el.classList.remove('hidden-overlay'));
         }

     }, 100);
}


// --- Donation Modal Functions ---
function openDonateModal() {
    if (!donateModal) return;
    hideHelpTooltip(); // Close tooltip if opening modal
    // Reset view
    donateNetworkChoiceDiv.classList.remove('hidden');
    donateAddressDisplayDiv.classList.add('hidden');
    donateAddressCode.textContent = '';
    copyAddressBtn.textContent = 'Copy';
    copyAddressBtn.classList.remove('copied');
    // Show modal
    document.body.classList.add('modal-open');
    isModalOpen = true;
}

function closeDonateModal() {
    if (!donateModal) return;
    document.body.classList.remove('modal-open');
    isModalOpen = false;
}

function showDonationAddress(network) {
    const address = DONATION_ADDRESSES[network];
    if (!address || !donateNetworkChoiceDiv || !donateAddressDisplayDiv || !donateAddressCode) return;

    donateAddressCode.textContent = address;
    donateNetworkChoiceDiv.classList.add('hidden');
    donateAddressDisplayDiv.classList.remove('hidden');
    copyAddressBtn.textContent = 'Copy'; // Reset copy button text
    copyAddressBtn.classList.remove('copied');
}

function copyDonationAddress() {
    const address = donateAddressCode.textContent;
    if (!address || !navigator.clipboard) {
        // Fallback for older browsers or insecure contexts
        try {
            const tempInput = document.createElement('textarea');
            tempInput.value = address;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            copyAddressBtn.textContent = 'Copied!';
            copyAddressBtn.classList.add('copied');
            setTimeout(() => { if (copyAddressBtn.classList.contains('copied')) { copyAddressBtn.textContent = 'Copy'; copyAddressBtn.classList.remove('copied'); } }, 2000);
        } catch (err) {
            console.error('Fallback copy failed:', err);
            alert("Failed to copy address automatically. Please select and copy manually.");
        }
        return;
    }
    // Use Clipboard API
    navigator.clipboard.writeText(address).then(() => {
        copyAddressBtn.textContent = 'Copied!';
        copyAddressBtn.classList.add('copied');
        setTimeout(() => { if (copyAddressBtn.classList.contains('copied')) { copyAddressBtn.textContent = 'Copy'; copyAddressBtn.classList.remove('copied'); } }, 2000);
    }).catch(err => {
        console.error('Failed to copy address: ', err);
        alert("Failed to copy address. You may need to grant clipboard permission or copy manually.");
    });
}


// --- Help Tooltip Functions (CLICK BASED) ---

function handleHelpClick(event) {
    event.stopPropagation(); // Prevent this click from immediately closing the tooltip via the global listener
    const btn = event.currentTarget;
    if (btn.disabled) return;

    // If this button's tooltip is already open, close it
    if (btn === activeHelpButton) {
        hideHelpTooltip();
    } else {
        // Otherwise, hide any other open tooltip and show this one
        hideHelpTooltip(); // Hide previous one if any
        displayHelpTooltip(btn);
    }
}

function displayHelpTooltip(btn) {
    const helpKey = btn.dataset.helpKey;
    const text = HELP_TEXTS[helpKey];

    if (!text || !helpTooltip || !helpTooltipText) return;

    helpTooltipText.innerHTML = text.replace(/\n/g, '<br>'); // Replace newline chars with <br> for HTML display

    const btnRect = btn.getBoundingClientRect();
    // Use temporary display to calculate dimensions accurately, avoiding race conditions
    helpTooltip.style.visibility = 'hidden';
    helpTooltip.style.display = 'block';
    const tooltipRect = helpTooltip.getBoundingClientRect();
    helpTooltip.style.display = 'none';
    helpTooltip.style.visibility = 'visible';

    const spaceAbove = btnRect.top;
    const spaceBelow = window.innerHeight - btnRect.bottom;
    const tooltipHeight = tooltipRect.height;
    const tooltipWidth = tooltipRect.width;
    let top, left;

    // Decide vertical position (prefer above if enough space)
    if (spaceAbove > tooltipHeight + 10) { // Removed check against spaceBelow, prioritize above
        top = btnRect.top - tooltipHeight - 8; // Position above button + arrow space
        helpTooltip.classList.remove('point-down');
    } else {
        top = btnRect.bottom + 8; // Position below button + arrow space
        helpTooltip.classList.add('point-down');
    }

    // Calculate initial horizontal position (centered on button)
    left = btnRect.left + (btnRect.width / 2) - (tooltipWidth / 2);

    // Prevent going off left edge
    if (left < 5) {
        left = 5;
    }
    // Prevent going off right edge
    if (left + tooltipWidth > window.innerWidth - 5) {
        left = window.innerWidth - tooltipWidth - 5;
    }

    helpTooltip.style.left = `${left}px`;
    helpTooltip.style.top = `${top}px`;
    helpTooltip.style.display = 'block'; // Now display it
    activeHelpButton = btn; // Remember which button opened this tooltip
}

function hideHelpTooltip() {
    if (!helpTooltip) return;
    helpTooltip.style.display = 'none';
    activeHelpButton = null; // Forget which button was active
}


// --- END OF FILE script.js ---