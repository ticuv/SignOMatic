// --- Global Constants ---
const canvasWidth = 2048;
const canvasHeight = 2048;
const nftContracts = {
    "GHN": { address: "0xe6d48bf4ee912235398b96e16db6f310c21e82cb", name: "GHN" },
    "AHC": { address: "0x9370045ce37f381500ac7d6802513bb89871e076", name: "AHC" }
};
const nftAbi = ["function tokenURI(uint256 tokenId) public view returns (string)"];
const provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com");

// --- Supabase Setup ---
const SUPABASE_URL = 'https://nwhqhyjgxugrdakuaaps.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53aHFoeWpneHVncmRha3VhYXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQwMTM3NzUsImV4cCI6MjA1OTU4OTc3NX0.zdaCBYkj87BeVShMgjzERAmzJZ5u6N2cCMSzGhY1-rs';
const SUPABASE_BUCKET_NAME = 'sign-gallery'; // IMPORTANT: Make sure this bucket exists in your Supabase project!
let supabase = null;
try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase client initialized.");
    } else {
        console.error("Supabase library not loaded correctly.");
        alert("Error: Could not initialize connection to the gallery. Upload functionality will be disabled.");
    }
} catch (error) {
    console.error("Error initializing Supabase:", error);
    alert("Error: Could not initialize connection to the gallery. Upload functionality will be disabled.");
}


// --- Global State ---
let baseImage = new Image();
let activeElement = null;
let textInteractionState = { isDragging: false, isRotating: false, startX: 0, startY: 0, startLeft: 0, startTop: 0, rotateCenterX: 0, rotateCenterY: 0, rotateStartAngle: 0 };
let imageInteractionState = { isDragging: false, isRotating: false, isResizing: false, startX: 0, startY: 0, startLeft: 0, startTop: 0, centerX: 0, centerY: 0, startAngle: 0, currentRotationRad: 0, startWidth: 0, startHeight: 0, aspectRatio: 1 };

// --- DOM Element References ---
let canvas, ctx, container, textInput, textColor, fontSize, fontFamily, removeBtn, nftStatusEl,
    nftCollectionSelect, nftTokenIdInput, loadNftBtn, applyOverlayBtn, overlayColorInput,
    addTextBtn, addImageBtn, imageUpload, resetCanvasBtn, // Added imageUpload ref explicitly
    saveFullBtn, uploadSignBtn, // Changed saveSignBtn to uploadSignBtn
    disclaimerBtn, disclaimerModal, closeDisclaimerBtn;

// --- Initialization ---
window.onload = () => {
    // Get Element References
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d", { willReadFrequently: true }); // willReadFrequently might improve performance for repeated draws/reads
    container = document.getElementById("canvas-container");
    textInput = document.getElementById("textInput");
    textColor = document.getElementById("textColor");
    fontSize = document.getElementById("fontSize");
    fontFamily = document.getElementById("fontFamily");
    removeBtn = document.getElementById("removeBtn");
    nftStatusEl = document.getElementById("nftStatus");
    nftCollectionSelect = document.getElementById("nftCollection");
    nftTokenIdInput = document.getElementById("nftTokenId");
    loadNftBtn = document.getElementById("loadNftBtn");
    applyOverlayBtn = document.getElementById("applyOverlayBtn");
    overlayColorInput = document.getElementById("overlayColor");
    addTextBtn = document.getElementById("addTextBtn");
    imageUpload = document.getElementById("imageUpload"); // Get reference
    addImageBtn = document.getElementById("addImageBtn");
    resetCanvasBtn = document.getElementById("resetCanvas");
    saveFullBtn = document.getElementById("saveFullBtn");
    uploadSignBtn = document.getElementById("uploadSignBtn"); // Updated reference
    disclaimerBtn = document.getElementById("disclaimerBtn");
    disclaimerModal = document.getElementById("disclaimerModal");
    closeDisclaimerBtn = document.getElementById("closeDisclaimerBtn");

    // Initial Setup
    enableEditingControls(false);
    clearCanvas();
    setupEventListeners();

    // Show disclaimer once on first load (optional)
    // if (!localStorage.getItem('disclaimerShown')) {
    //     showComicDisclaimer();
    //     localStorage.setItem('disclaimerShown', 'true');
    // }
};

function setupEventListeners() {
    if (!loadNftBtn) { console.error("Load button not found!"); return; }

    // Event Listeners
    loadNftBtn.addEventListener('click', loadNftToCanvas);
    applyOverlayBtn.addEventListener('click', applyOverlay);
    overlayColorInput.addEventListener('input', applyOverlay); // Apply color change live
    addTextBtn.addEventListener('click', addText);
    textInput.addEventListener("input", handleTextControlChange);
    textColor.addEventListener("input", handleTextControlChange);
    fontSize.addEventListener("input", handleTextControlChange);
    fontFamily.addEventListener("input", handleTextControlChange);
    addImageBtn.addEventListener('click', addImage);
    removeBtn.addEventListener('click', removeActiveElement);
    resetCanvasBtn.addEventListener('click', handleReset);
    nftCollectionSelect.addEventListener("change", () => { if (baseImage.src && baseImage.complete) { applyOverlay(); } }); // Re-apply overlay if collection changes

    // === UPDATED SAVE/UPLOAD LISTENERS ===
    if (saveFullBtn) {
        saveFullBtn.addEventListener('click', saveFullImageLocally); // Calls specific function now
    }
    if (uploadSignBtn) {
        uploadSignBtn.addEventListener('click', uploadSignToGallery); // Calls the new upload function
        if (!supabase) { // Disable upload button if Supabase failed to init
            uploadSignBtn.disabled = true;
            uploadSignBtn.title = "Gallery connection failed.";
        }
    }
    // === END UPDATED SAVE/UPLOAD LISTENERS ===

    // Disclaimer Modal Listeners
    if (disclaimerBtn && disclaimerModal && closeDisclaimerBtn) {
        disclaimerBtn.addEventListener('click', showComicDisclaimer);
        closeDisclaimerBtn.addEventListener('click', hideComicDisclaimer);
        disclaimerModal.addEventListener('click', (event) => {
            // Close if clicking the background overlay
            if (event.target === disclaimerModal) { hideComicDisclaimer(); }
        });
    } else {
        console.warn("Disclaimer modal elements not found!");
    }

    // Prevent default drag behavior which can interfere
    container.addEventListener('dragstart', (e) => e.preventDefault());
}

// --- Event Handlers ---
 function handleTextControlChange() {
    if (activeElement && activeElement.classList.contains('textOverlay')) {
        // Update the text node directly
        activeElement.childNodes[0].nodeValue = textInput.value;
        activeElement.style.color = textColor.value;
        activeElement.style.fontSize = fontSize.value + "px";
        activeElement.style.fontFamily = fontFamily.value;
    }
 }
 function handleReset() {
    if (confirm("Are you sure you want to clear the canvas and all added elements? This cannot be undone.")) {
        clearCanvasAndOverlays();
        if (baseImage.src && baseImage.complete && baseImage.naturalWidth > 0) {
            // If there was a base image, redraw it and the sign area
            drawBaseImage();
            applyOverlay(); // This also draws the sign polygon
            enableEditingControls(true);
        } else {
            // Otherwise, just disable controls
            enableEditingControls(false);
            nftStatusEl.textContent = "Select collection and ID, then load NFT.";
            nftStatusEl.className = '';
        }
    }
 }

// --- Canvas & Overlay Management ---
function clearCanvasAndOverlays() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#444'; // Default background if no NFT
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el => el.remove());
    setActiveElement(null); // Deselect any active element
    nftStatusEl.textContent = "Canvas Cleared.";
    nftStatusEl.className = '';
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#444'; // Default background
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}

function enableEditingControls(isEnabled) {
    [overlayColorInput, applyOverlayBtn, textInput, textColor, fontSize, fontFamily,
     addTextBtn, imageUpload, addImageBtn, removeBtn, saveFullBtn, uploadSignBtn // Updated button list
    ].forEach(el => {
        if (el) {
            // Special case: Don't enable upload button if Supabase isn't ready
            if (el === uploadSignBtn && !supabase) {
                 el.disabled = true;
                 el.title = "Gallery connection failed.";
            } else {
                 el.disabled = !isEnabled;
                 el.title = ''; // Clear any previous title
            }
        }
    });
    updateControlState(); // Update based on active element etc.
}

function updateControlState() {
    const isElementActive = activeElement !== null;
    const isTextActive = isElementActive && activeElement.classList.contains('textOverlay');
    const isImageLoaded = baseImage.src !== "" && baseImage.complete && baseImage.naturalWidth > 0;

    // Enable/disable based on whether an NFT is loaded
    if (overlayColorInput) overlayColorInput.disabled = !isImageLoaded;
    if (applyOverlayBtn) applyOverlayBtn.disabled = !isImageLoaded;
    if (addTextBtn) addTextBtn.disabled = !isImageLoaded;
    if (imageUpload) imageUpload.disabled = !isImageLoaded;
    if (addImageBtn) addImageBtn.disabled = !isImageLoaded;
    if (saveFullBtn) saveFullBtn.disabled = !isImageLoaded;
    if (uploadSignBtn) {
         uploadSignBtn.disabled = !isImageLoaded || !supabase; // Also disable if supabase failed
         if (!supabase && isImageLoaded) uploadSignBtn.title = "Gallery connection failed.";
         else uploadSignBtn.title = '';
    }


    // Enable/disable text controls only if a text element is active AND NFT loaded
    if (textInput) textInput.disabled = !isTextActive || !isImageLoaded;
    if (textColor) textColor.disabled = !isTextActive || !isImageLoaded;
    if (fontSize) fontSize.disabled = !isTextActive || !isImageLoaded;
    if (fontFamily) fontFamily.disabled = !isTextActive || !isImageLoaded;

    // Enable remove button only if an element is active AND NFT loaded
    if (removeBtn) removeBtn.disabled = !isElementActive || !isImageLoaded;
}


// --- NFT Loading & Drawing ---
function getPolygonForSelectedCollection() {
    const selectedCollection = nftCollectionSelect.value;
    // Define polygons based on collection
    if (selectedCollection === "AHC") {
        // Coordinates for AHC sign area
        return [{x: 1415, y: 316}, {x: 2024, y: 358}, {x: 1958, y: 1324}, {x: 1358, y: 1286}];
    } else { // Default to GHN
        // Coordinates for GHN sign area
        return [{x: 1403, y: 196}, {x: 2034, y: 218}, {x: 1968, y: 1164}, {x: 1358, y: 1126}];
    }
}

function resolveIpfsUrl(url) {
    if (url && url.startsWith("ipfs://")) {
        // Use a reliable public gateway
        return url.replace("ipfs://", "https://ipfs.io/ipfs/");
    }
    return url;
}

async function loadNftToCanvas() {
    const selectedCollection = nftCollectionSelect.value;
    const tokenId = nftTokenIdInput.value;

    if (!tokenId) {
        nftStatusEl.textContent = "Please enter a Token ID.";
        nftStatusEl.className = 'error';
        return;
    }
    if (!nftContracts[selectedCollection]) {
        nftStatusEl.textContent = "Invalid NFT collection selected.";
        nftStatusEl.className = 'error';
        return;
    }

    loadNftBtn.disabled = true;
    enableEditingControls(false); // Disable everything while loading
    clearCanvasAndOverlays(); // Clear previous state
    nftStatusEl.textContent = `Loading ${nftContracts[selectedCollection].name} #${tokenId}...`;
    nftStatusEl.className = '';

    const contractInfo = nftContracts[selectedCollection];
    const contract = new ethers.Contract(contractInfo.address, nftAbi, provider);

    try {
        let tokenURI = await contract.tokenURI(tokenId);
        tokenURI = resolveIpfsUrl(tokenURI);

        nftStatusEl.textContent = "Fetching metadata...";
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 second timeout

        const response = await fetch(tokenURI, { signal: controller.signal });
        clearTimeout(timeoutId); // Clear timeout if fetch completes

        if (!response.ok) {
            throw new Error(`Metadata error: ${response.status} ${response.statusText} (URL: ${tokenURI})`);
        }
        const metadata = await response.json();

        let imageUrl = resolveIpfsUrl(metadata.image || metadata.image_url || metadata.imageUrl); // Handle common image keys
        if (!imageUrl) {
            throw new Error("Image URL missing in metadata");
        }

        nftStatusEl.textContent = "Loading image...";
        baseImage = new Image();
        baseImage.crossOrigin = "Anonymous"; // Important for canvas saving/manipulation

        // --- Image Load Promise ---
        await new Promise((resolve, reject) => {
            baseImage.onload = () => {
                nftStatusEl.textContent = "Drawing image...";
                drawBaseImage(); // Draw the NFT image first
                nftStatusEl.textContent = `${nftContracts[selectedCollection].name} #${tokenId} loaded successfully!`;
                nftStatusEl.className = 'success';
                enableEditingControls(true); // Enable controls now
                loadNftBtn.disabled = false;
                applyOverlay(); // Apply the initial sign color overlay
                resolve(); // Resolve the promise on successful load
            };
            baseImage.onerror = (err) => {
                console.error("Error loading NFT image:", err, "Attempted URL:", imageUrl);
                nftStatusEl.textContent = `Error loading image. Check console. (URL: ${imageUrl.substring(0, 100)}...)`;
                nftStatusEl.className = 'error';
                loadNftBtn.disabled = false;
                clearCanvasAndOverlays(); // Clear canvas on error
                // Draw error message on canvas
                ctx.fillStyle = "white";
                ctx.font = "30px Arial";
                ctx.textAlign = "center";
                ctx.fillText("Image Load Error", canvasWidth / 2, canvasHeight / 2);
                reject(new Error('Image load failed')); // Reject the promise
            };
            baseImage.src = imageUrl;
        });
        // --- End Image Load Promise ---

    } catch (err) {
        console.error(`Error processing NFT ${tokenId}:`, err);
        let errorMsg = "Error: " + err.message;
        if (err.name === 'AbortError') {
            errorMsg = "Error: Metadata request timed out.";
        } else if (err.code === 'CALL_EXCEPTION') {
             if (err.reason?.includes('invalid token ID') || err.message?.includes('invalid token ID')) {
                 errorMsg = `Error: Token ID ${tokenId} invalid or does not exist for ${nftContracts[selectedCollection].name}.`;
             } else {
                 errorMsg = `Error: Could not query contract. Check network/address or token ID.`;
             }
        } else if (err.message?.includes('Metadata error')) {
            errorMsg = `Error fetching metadata: ${err.message.split('(URL:')[0]}`; // Simplify metadata error
        }
        // Add more specific error checks if needed

        nftStatusEl.textContent = errorMsg;
        nftStatusEl.className = 'error';
        loadNftBtn.disabled = false;
        clearCanvasAndOverlays(); // Clear canvas on error
         // Draw error message on canvas
        ctx.fillStyle = "white";
        ctx.font = "30px Arial";
        ctx.textAlign = "center";
        ctx.fillText("NFT Load Error", canvasWidth / 2, canvasHeight / 2);
    }
}


function drawBaseImage() {
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) return; // Don't draw if image not ready

    const aspectRatio = baseImage.naturalWidth / baseImage.naturalHeight;
    let drawWidth = canvasWidth, drawHeight = canvasHeight;
    let x = 0, y = 0;

    // Maintain aspect ratio and center image (letterboxing/pillarboxing)
    if (canvasWidth / canvasHeight > aspectRatio) { // Canvas wider than image
        drawHeight = canvasHeight;
        drawWidth = drawHeight * aspectRatio;
        x = (canvasWidth - drawWidth) / 2;
    } else { // Canvas taller than or equal aspect ratio to image
        drawWidth = canvasWidth;
        drawHeight = drawWidth / aspectRatio;
        y = (canvasHeight - drawHeight) / 2;
    }

    ctx.clearRect(0, 0, canvasWidth, canvasHeight); // Clear previous frame
    ctx.fillStyle = "#444"; // Background for letterboxing
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    try {
        ctx.drawImage(baseImage, x, y, drawWidth, drawHeight);
    } catch (e) {
        console.error("Error drawing base image:", e);
        nftStatusEl.textContent = "Error drawing NFT image.";
        nftStatusEl.className = 'error';
         // Optionally draw error on canvas
         ctx.fillStyle = "red";
         ctx.font = "30px Arial";
         ctx.textAlign = "center";
         ctx.fillText("Draw Error", canvasWidth / 2, canvasHeight / 2);
    }
}

function applyOverlay() {
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) return; // Need base image to overlay
    drawBaseImage(); // Redraw base image first
    drawSignPolygonOnly(); // Then draw the colored sign polygon on top
}

// Helper to draw just the colored sign polygon (used by applyOverlay and saving)
function drawSignPolygonOnly() {
    const color = overlayColorInput.value;
    const currentPolygon = getPolygonForSelectedCollection();

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

    // Add stroke for definition (optional, adjust as needed)
    ctx.lineJoin = "round"; // Smoother corners
    ctx.lineWidth = 14; // Adjust stroke width as desired
    ctx.strokeStyle = "black"; // Stroke color
    ctx.stroke();
    ctx.restore(); // Restore context state
}


// --- Text & Image Creation ---
function addText() {
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) {
        nftStatusEl.textContent = "Load a valid NFT first.";
        nftStatusEl.className = 'error';
        return;
    }

    const textEl = document.createElement("div");
    textEl.className = "textOverlay";
    textEl.style.position = "absolute"; // Ensure positioning context
    textEl.style.cursor = "grab"; // Indicate draggable
    textEl.innerText = textInput.value || "New Text"; // Use input or default
    textEl.style.color = textColor.value;
    textEl.style.fontSize = fontSize.value + "px";
    textEl.style.fontFamily = fontFamily.value;
    textEl.style.transform = `translate(-50%, -50%) rotate(0deg)`; // Center transform origin
    textEl.style.zIndex = "10"; // Base z-index for text

    // Create Rotation Handle
    const handle = document.createElement("span");
    handle.className = "rotation-handle";
    handle.innerHTML = '↻'; // Unicode rotate icon
    textEl.appendChild(handle);

    // --- Calculate Initial Position (Centered on Sign) ---
    const currentPolygon = getPolygonForSelectedCollection();
    const minX = Math.min(...currentPolygon.map(p => p.x));
    const maxX = Math.max(...currentPolygon.map(p => p.x));
    const minY = Math.min(...currentPolygon.map(p => p.y));
    const maxY = Math.max(...currentPolygon.map(p => p.y));

    // Target center of the polygon in canvas coordinates
    const signCenterX_canvas = (minX + maxX) / 2;
    const signCenterY_canvas = (minY + maxY) / 2;

    // Convert canvas coords to container % (more robust to resize)
     const contRect = container.getBoundingClientRect();
     if (!contRect || contRect.width === 0 || contRect.height === 0) {
          console.warn("Could not get container dimensions, placing at default 50/50");
          textEl.style.left = '50%';
          textEl.style.top = '50%';
     } else {
         const initialX_percent = (signCenterX_canvas / canvasWidth) * 100;
         const initialY_percent = (signCenterY_canvas / canvasHeight) * 100;
         textEl.style.left = `${initialX_percent}%`;
         textEl.style.top = `${initialY_percent}%`;
     }
    // --- End Initial Position Calculation ---


    // Add interaction listeners
    textEl.addEventListener("mousedown", handleTextDragStart);
    textEl.addEventListener("touchstart", handleTextDragStart, { passive: true }); // Use passive for potential scroll
    handle.addEventListener("mousedown", handleTextRotateStart);
    handle.addEventListener("touchstart", handleTextRotateStart, { passive: true });

    container.appendChild(textEl);
    setActiveElement(textEl); // Make the new text active
}


function addImage() {
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) {
        nftStatusEl.textContent = "Please load a valid NFT first.";
        nftStatusEl.className = 'error';
        return;
    }
    if (!imageUpload || !imageUpload.files || imageUpload.files.length === 0) {
        nftStatusEl.textContent = "Please select an image file to upload.";
        nftStatusEl.className = 'error';
        return;
    }

    const file = imageUpload.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const wrapper = document.createElement("div");
        wrapper.className = "imgOverlay";
        wrapper.style.position = "absolute";
        wrapper.style.width = "auto"; // Let image decide initially
        wrapper.style.height = "auto";
        wrapper.style.transform = `translate(-50%, -50%) rotate(0deg)`;
        wrapper.style.touchAction = "none"; // Prevent default touch actions
        wrapper.style.cursor = "grab";
        wrapper.style.zIndex = "20"; // Images above text by default

        const img = document.createElement("img");
        img.src = e.target.result;

        img.onload = () => {
            // Set initial size relative to container, after image loads
            if (container.offsetWidth > 0 && img.naturalWidth > 0 && img.naturalHeight > 0) {
                const contW = container.offsetWidth;
                 // Make initial size somewhat reasonable, e.g., 25% of container width, max 150px
                const initialWidth = Math.min(img.naturalWidth, contW * 0.25, 150);
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                wrapper.style.width = `${initialWidth}px`;
                 // Calculate height based on aspect ratio ONLY if aspect ratio is valid
                 if (aspectRatio > 0) {
                     wrapper.style.height = `${initialWidth / aspectRatio}px`;
                 } else {
                     wrapper.style.height = 'auto'; // Fallback
                 }
            } else {
                 // Fallback if container/image dimensions aren't ready
                wrapper.style.width = '100px';
                wrapper.style.height = 'auto';
            }
            // Recalculate and set initial position after size is determined
             positionElementOnSign(wrapper);
        };
        img.onerror = () => {
            console.error("Error loading added image.");
            nftStatusEl.textContent = "Error displaying uploaded image.";
            nftStatusEl.className = 'error';
            wrapper.remove(); // Remove the broken wrapper
        };
        wrapper.appendChild(img);

        // Add Rotation Handle
        const rotateHandle = document.createElement("div");
        rotateHandle.className = "rotation-handle";
        rotateHandle.innerHTML = '↻'; // Unicode rotate icon
        wrapper.appendChild(rotateHandle);

        // Add Resize Handle
        const resizeHandle = document.createElement("div");
        resizeHandle.className = "resize-handle";
        resizeHandle.innerHTML = '↔'; // Unicode resize icon (adjust if needed)
        wrapper.appendChild(resizeHandle);


        // Add interaction listeners
        wrapper.addEventListener("mousedown", handleImageDragStart);
        wrapper.addEventListener("touchstart", handleImageDragStart, { passive: true });
        rotateHandle.addEventListener("mousedown", handleImageRotateStart);
        rotateHandle.addEventListener("touchstart", handleImageRotateStart, { passive: true });
        resizeHandle.addEventListener("mousedown", handleImageResizeStart);
        resizeHandle.addEventListener("touchstart", handleImageResizeStart, { passive: true });

        container.appendChild(wrapper);
        setActiveElement(wrapper); // Make the new image active
        nftStatusEl.textContent = "Image added.";
        nftStatusEl.className = 'success';
        imageUpload.value = ''; // Clear the file input
    };

    reader.onerror = function(err) {
        console.error("FileReader error:", err);
        nftStatusEl.textContent = "Error reading image file.";
        nftStatusEl.className = 'error';
    }

    reader.readAsDataURL(file);
}

// Helper to position an element (text or image) onto the sign area
function positionElementOnSign(element) {
     const currentPolygon = getPolygonForSelectedCollection();
     const minX = Math.min(...currentPolygon.map(p => p.x));
     const maxX = Math.max(...currentPolygon.map(p => p.x));
     const minY = Math.min(...currentPolygon.map(p => p.y));
     const maxY = Math.max(...currentPolygon.map(p => p.y));

     const signCenterX_canvas = (minX + maxX) / 2;
     const signCenterY_canvas = (minY + maxY) / 2;

     const contRect = container.getBoundingClientRect();
     if (!contRect || contRect.width === 0 || contRect.height === 0) {
         console.warn("Could not get container dimensions for positioning, using 50/50 fallback");
         element.style.left = '50%';
         element.style.top = '50%';
     } else {
         const initialX_percent = (signCenterX_canvas / canvasWidth) * 100;
         const initialY_percent = (signCenterY_canvas / canvasHeight) * 100;
         element.style.left = `${initialX_percent}%`;
         element.style.top = `${initialY_percent}%`;
     }
}


// --- Active Element Management & Removal ---
function setActiveElement(el) {
    // Deactivate previous element
    if (activeElement && activeElement !== el) {
        activeElement.classList.remove("active");
        // Reset z-index to default based on type
        activeElement.style.zIndex = activeElement.classList.contains('imgOverlay') ? '20' : '10';
    }

    // Activate new element
    if (el) {
        el.classList.add("active");
        activeElement = el;
        // Bring active element to the top visually while active
        el.style.zIndex = el.classList.contains('imgOverlay') ? '101' : '100';

        // If it's a text element, update the controls
        if (el.classList.contains('textOverlay')) {
            textInput.value = el.childNodes[0].nodeValue; // Get text content
            textColor.value = rgb2hex(el.style.color || 'rgb(255, 255, 255)'); // Handle unset color
            fontSize.value = parseInt(el.style.fontSize) || 15; // Handle unset size
            // Match font family (handle potential quotes and fallbacks)
            const currentFont = el.style.fontFamily.split(',')[0].replace(/['"]/g, "").trim();
            let foundFont = false;
            for (let option of fontFamily.options) {
                // Check if the option's value string INCLUDES the parsed font name
                if (option.value.toLowerCase().includes(currentFont.toLowerCase())) {
                    fontFamily.value = option.value;
                    foundFont = true;
                    break;
                }
            }
            if (!foundFont) fontFamily.value = 'Arial'; // Fallback if not found
        }
    } else {
        activeElement = null; // No element is active
    }
    updateControlState(); // Update button/input disabled states
}

function removeActiveElement() {
    if (activeElement) {
        activeElement.remove(); // Remove from DOM
        setActiveElement(null); // Set active element to none
    }
}

// --- Interaction Handlers (Drag, Rotate, Resize) ---

function getEventCoordinates(event) {
    let x, y;
    if (event.touches && event.touches.length > 0) { // Active touches
        x = event.touches[0].clientX;
        y = event.touches[0].clientY;
    } else if (event.changedTouches && event.changedTouches.length > 0) { // Touches that ended (touchend)
        x = event.changedTouches[0].clientX;
        y = event.changedTouches[0].clientY;
    } else { // Mouse event
        x = event.clientX;
        y = event.clientY;
    }
    return { x, y };
}

// --- Text Interaction ---
function handleTextDragStart(event) {
    // Ignore if clicking the handle itself
    if (event.target.classList.contains('rotation-handle')) return;

    const el = event.currentTarget; // The .textOverlay div
    setActiveElement(el); // Make sure it's the active one

    textInteractionState.isDragging = true;
    textInteractionState.isRotating = false;
    el.style.cursor = 'grabbing'; // Indicate grabbing
    document.body.style.cursor = 'grabbing'; // Change body cursor too

    const coords = getEventCoordinates(event);
    const contRect = container.getBoundingClientRect();

    // Store initial positions relative to the container
    textInteractionState.startX = coords.x - contRect.left;
    textInteractionState.startY = coords.y - contRect.top;
    // Store initial element position (parse percentage or px)
    textInteractionState.startLeft = el.offsetLeft; // Use offsetLeft/Top for pixel values
    textInteractionState.startTop = el.offsetTop;


    // Add global listeners for move/end
    document.addEventListener("mousemove", handleTextInteractionMove);
    document.addEventListener("mouseup", handleTextInteractionEnd);
    document.addEventListener("touchmove", handleTextInteractionMove, { passive: false }); // Prevent scroll during drag
    document.addEventListener("touchend", handleTextInteractionEnd);
    document.addEventListener("touchcancel", handleTextInteractionEnd);

    // Prevent default only for mouse down to avoid text selection, allow touch defaults for scroll etc. if needed
    if (event.type === 'mousedown') {
        event.preventDefault();
    }
}

function handleTextRotateStart(event) {
    event.stopPropagation(); // Prevent triggering drag on the parent div
    const el = event.currentTarget.parentElement; // The .textOverlay div
    setActiveElement(el);

    textInteractionState.isRotating = true;
    textInteractionState.isDragging = false;
    document.body.style.cursor = 'alias'; // Rotation cursor

    const coords = getEventCoordinates(event);
    const rect = el.getBoundingClientRect(); // Get element's screen position

    // Calculate center of the element for rotation anchor
    textInteractionState.rotateCenterX = rect.left + rect.width / 2;
    textInteractionState.rotateCenterY = rect.top + rect.height / 2;

    // Calculate the starting angle from center to the initial touch/click point
    const dx = coords.x - textInteractionState.rotateCenterX;
    const dy = coords.y - textInteractionState.rotateCenterY;
    let startAngle = Math.atan2(dy, dx); // Angle in radians

    // Get current rotation and subtract it to find the initial offset angle of the handle
    const currentRotationRad = getRotationRad(el);
    textInteractionState.rotateStartAngle = startAngle - currentRotationRad;

    // Add global listeners
    document.addEventListener("mousemove", handleTextInteractionMove);
    document.addEventListener("mouseup", handleTextInteractionEnd);
    document.addEventListener("touchmove", handleTextInteractionMove, { passive: false });
    document.addEventListener("touchend", handleTextInteractionEnd);
    document.addEventListener("touchcancel", handleTextInteractionEnd);

    if (event.type === 'mousedown') {
        event.preventDefault();
    }
}

function handleTextInteractionMove(event) {
    if (!activeElement || !activeElement.classList.contains('textOverlay') || (!textInteractionState.isDragging && !textInteractionState.isRotating)) return;

    // Prevent default scroll/zoom on touchmove if interacting
    if (event.type === 'touchmove') {
        event.preventDefault();
    }

    const coords = getEventCoordinates(event);
    const contRect = container.getBoundingClientRect();

    if (textInteractionState.isDragging) {
        const currentX = coords.x - contRect.left;
        const currentY = coords.y - contRect.top;

        // Calculate new pixel position based on drag delta
        let newLeftPx = textInteractionState.startLeft + (currentX - textInteractionState.startX);
        let newTopPx = textInteractionState.startTop + (currentY - textInteractionState.startY);

        // --- Boundary Check (Optional but recommended) ---
        // Keep element somewhat within the container boundaries
        newLeftPx = Math.max(0, Math.min(contRect.width - activeElement.offsetWidth, newLeftPx));
        newTopPx = Math.max(0, Math.min(contRect.height - activeElement.offsetHeight, newTopPx));
        // --- End Boundary Check ---


        // Convert pixel position to percentage for style setting
        const newLeftPercent = (newLeftPx / contRect.width) * 100;
        const newTopPercent = (newTopPx / contRect.height) * 100;

        activeElement.style.left = `${newLeftPercent}%`;
        activeElement.style.top = `${newTopPercent}%`;

    } else if (textInteractionState.isRotating) {
        // Calculate angle from element center to current pointer position
        const dx = coords.x - textInteractionState.rotateCenterX;
        const dy = coords.y - textInteractionState.rotateCenterY;
        let angle = Math.atan2(dy, dx);

        // Subtract the initial handle offset angle to get the element's true rotation
        let rotationRad = angle - textInteractionState.rotateStartAngle;
        let rotationDeg = rotationRad * (180 / Math.PI); // Convert to degrees

        // Apply rotation using transform
        activeElement.style.transform = `translate(-50%, -50%) rotate(${rotationDeg}deg)`;
    }
}

function handleTextInteractionEnd(event) {
    if (activeElement && activeElement.classList.contains('textOverlay')) {
        activeElement.style.cursor = 'grab'; // Reset cursor
    }
    document.body.style.cursor = 'default'; // Reset body cursor

    textInteractionState.isDragging = false;
    textInteractionState.isRotating = false;

    // Remove global listeners
    document.removeEventListener("mousemove", handleTextInteractionMove);
    document.removeEventListener("mouseup", handleTextInteractionEnd);
    document.removeEventListener("touchmove", handleTextInteractionMove);
    document.removeEventListener("touchend", handleTextInteractionEnd);
    document.removeEventListener("touchcancel", handleTextInteractionEnd);
}


// --- Image Interaction (Similar structure to Text, adds Resizing) ---
function handleImageDragStart(event) {
    // Ignore if clicking handles
    if (event.target.classList.contains('rotation-handle') || event.target.classList.contains('resize-handle')) return;

    const el = event.currentTarget; // The .imgOverlay div
    setActiveElement(el);

    imageInteractionState.isDragging = true;
    imageInteractionState.isRotating = false;
    imageInteractionState.isResizing = false;
    el.style.cursor = 'grabbing';
    document.body.style.cursor = 'grabbing';

    const coords = getEventCoordinates(event);
    const contRect = container.getBoundingClientRect();

    imageInteractionState.startX = coords.x - contRect.left;
    imageInteractionState.startY = coords.y - contRect.top;
    imageInteractionState.startLeft = el.offsetLeft;
    imageInteractionState.startTop = el.offsetTop;

    document.addEventListener("mousemove", handleImageInteractionMove);
    document.addEventListener("mouseup", handleImageInteractionEnd);
    document.addEventListener("touchmove", handleImageInteractionMove, { passive: false });
    document.addEventListener("touchend", handleImageInteractionEnd);
    document.addEventListener("touchcancel", handleImageInteractionEnd);

    if (event.type === 'mousedown') event.preventDefault();
}

function handleImageRotateStart(event) {
    event.stopPropagation();
    const el = event.currentTarget.parentElement; // The .imgOverlay div
    setActiveElement(el);

    imageInteractionState.isRotating = true;
    imageInteractionState.isDragging = false;
    imageInteractionState.isResizing = false;
    document.body.style.cursor = 'alias';

    const coords = getEventCoordinates(event);
    const rect = el.getBoundingClientRect();
    imageInteractionState.centerX = rect.left + rect.width / 2;
    imageInteractionState.centerY = rect.top + rect.height / 2;

    const dx = coords.x - imageInteractionState.centerX;
    const dy = coords.y - imageInteractionState.centerY;
    let startAngle = Math.atan2(dy, dx);

    imageInteractionState.currentRotationRad = getRotationRad(el);
    imageInteractionState.startAngle = startAngle - imageInteractionState.currentRotationRad; // Offset angle

    document.addEventListener("mousemove", handleImageInteractionMove);
    document.addEventListener("mouseup", handleImageInteractionEnd);
    document.addEventListener("touchmove", handleImageInteractionMove, { passive: false });
    document.addEventListener("touchend", handleImageInteractionEnd);
    document.addEventListener("touchcancel", handleImageInteractionEnd);

    if (event.type === 'mousedown') event.preventDefault();
}


function handleImageResizeStart(event) {
    event.stopPropagation();
    const el = event.currentTarget.parentElement; // The .imgOverlay div
    setActiveElement(el);

    imageInteractionState.isResizing = true;
    imageInteractionState.isRotating = false;
    imageInteractionState.isDragging = false;
    document.body.style.cursor = 'nesw-resize'; // Or appropriate resize cursor

    const coords = getEventCoordinates(event);
    imageInteractionState.startX = coords.x; // Use absolute screen coords for resize calc
    imageInteractionState.startY = coords.y;

    // Store initial dimensions and aspect ratio
    imageInteractionState.startWidth = el.offsetWidth;
    imageInteractionState.startHeight = el.offsetHeight;
    imageInteractionState.aspectRatio = imageInteractionState.startHeight > 0 ? imageInteractionState.startWidth / imageInteractionState.startHeight : 1; // Avoid divide by zero

    // Store current rotation and center point for calculations
    imageInteractionState.currentRotationRad = getRotationRad(el);
    const rect = el.getBoundingClientRect();
    imageInteractionState.centerX = rect.left + rect.width / 2; // Center remains constant during resize
    imageInteractionState.centerY = rect.top + rect.height / 2;


    document.addEventListener("mousemove", handleImageInteractionMove);
    document.addEventListener("mouseup", handleImageInteractionEnd);
    document.addEventListener("touchmove", handleImageInteractionMove, { passive: false });
    document.addEventListener("touchend", handleImageInteractionEnd);
    document.addEventListener("touchcancel", handleImageInteractionEnd);

    if (event.type === 'mousedown') event.preventDefault();
}


function handleImageInteractionMove(event) {
    if (!activeElement || !activeElement.classList.contains('imgOverlay') || (!imageInteractionState.isDragging && !imageInteractionState.isRotating && !imageInteractionState.isResizing)) return;

    if (event.type === 'touchmove') event.preventDefault();

    const coords = getEventCoordinates(event);
    const contRect = container.getBoundingClientRect();

    if (imageInteractionState.isDragging) {
        const currentX = coords.x - contRect.left;
        const currentY = coords.y - contRect.top;
        let newLeftPx = imageInteractionState.startLeft + (currentX - imageInteractionState.startX);
        let newTopPx = imageInteractionState.startTop + (currentY - imageInteractionState.startY);

        // Optional Boundary Check (same as text drag)
        newLeftPx = Math.max(0, Math.min(contRect.width - activeElement.offsetWidth, newLeftPx));
        newTopPx = Math.max(0, Math.min(contRect.height - activeElement.offsetHeight, newTopPx));

        const newLeftPercent = (newLeftPx / contRect.width) * 100;
        const newTopPercent = (newTopPx / contRect.height) * 100;
        activeElement.style.left = `${newLeftPercent}%`;
        activeElement.style.top = `${newTopPercent}%`;

    } else if (imageInteractionState.isRotating) {
        const dx = coords.x - imageInteractionState.centerX;
        const dy = coords.y - imageInteractionState.centerY;
        let angle = Math.atan2(dy, dx);
        let rotationRad = angle - imageInteractionState.startAngle;
        let rotationDeg = rotationRad * (180 / Math.PI);
        activeElement.style.transform = `translate(-50%, -50%) rotate(${rotationDeg}deg)`;

    } else if (imageInteractionState.isResizing) {
        const dx = coords.x - imageInteractionState.startX; // Delta movement in screen X
        const dy = coords.y - imageInteractionState.startY; // Delta movement in screen Y

        // Project the mouse movement onto the diagonal axis of the *rotated* element
        // This requires accounting for the element's rotation
        const rotation = imageInteractionState.currentRotationRad;
        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);

        // Rotate the delta vector (dx, dy) by -rotation to align with the element's axes
        const rotatedDx = dx * cosR + dy * sinR;
        // const rotatedDy = -dx * sinR + dy * cosR; // Don't need rotatedDy for corner resize

        // Assuming the resize handle is bottom-right (adjust signs if handle is different corner)
        // The change in width is primarily related to rotatedDx
        // A simple approximation: delta width is proportional to rotatedDx
        // A more accurate approach considers distance from center, but this is often sufficient:
         const diagonalDelta = rotatedDx; // Change along the rotated X-axis (roughly diagonal)

         // Calculate new width, add the delta, ensure minimum size
         let newWidth = imageInteractionState.startWidth + diagonalDelta;
         newWidth = Math.max(20, newWidth); // Minimum width 20px

         // Calculate new height based on aspect ratio
         let newHeight = imageInteractionState.aspectRatio > 0 ? newWidth / imageInteractionState.aspectRatio : newWidth; // Maintain aspect ratio

         // Apply new dimensions
         activeElement.style.width = `${newWidth}px`;
         activeElement.style.height = `${newHeight}px`;
    }
}

function handleImageInteractionEnd(event) {
    if (activeElement && activeElement.classList.contains('imgOverlay')) {
        activeElement.style.cursor = 'grab';
    }
    document.body.style.cursor = 'default';

    imageInteractionState.isDragging = false;
    imageInteractionState.isRotating = false;
    imageInteractionState.isResizing = false;

    document.removeEventListener("mousemove", handleImageInteractionMove);
    document.removeEventListener("mouseup", handleImageInteractionEnd);
    document.removeEventListener("touchmove", handleImageInteractionMove);
    document.removeEventListener("touchend", handleImageInteractionEnd);
    document.removeEventListener("touchcancel", handleImageInteractionEnd);
}

// --- Utility Functions ---
function calculateElementPosition(percentX, percentY) {
    // Calculates pixel coords based on container % (useful for initial placement)
    const contRect = container.getBoundingClientRect();
    if (!contRect || contRect.width === 0 || contRect.height === 0) return { x: 0, y: 0 }; // Fallback

    // Calculate pixel position within the container based on percentage
    const pixelX = contRect.width * (percentX / 100);
    const pixelY = contRect.height * (percentY / 100);

    return { x: pixelX, y: pixelY };
}

function getCanvasCoordsFromContainerPoint(containerX_px, containerY_px) {
     // Converts element's top/left pixel position (relative to container) to canvas coordinates
     const contRect = container.getBoundingClientRect();
     if (!contRect || contRect.width === 0 || contRect.height === 0) return { canvasX: 0, canvasY: 0 }; // Fallback

     // Calculate scaling factor between container size and canvas size
     const scaleX = contRect.width / canvasWidth;
     const scaleY = contRect.height / canvasHeight;

     // Avoid division by zero if scale is 0
     const canvasX = scaleX !== 0 ? containerX_px / scaleX : 0;
     const canvasY = scaleY !== 0 ? containerY_px / scaleY : 0;

     return { canvasX, canvasY };
 }


// Point in Polygon check (Ray Casting Algorithm) - Used for boundary checks if needed
function pointInPolygon(point, vs) {
    const x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i].x, yi = vs[i].y;
        const xj = vs[j].x, yj = vs[j].y;
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function rgb2hex(rgb) {
    if (!rgb) return '#ffffff'; // Default white if no color
    if (rgb.startsWith('#')) return rgb; // Already hex

    const rgbMatch = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (rgbMatch) {
        // Convert RGB values to hex and pad with zero if needed
        return "#" + rgbMatch.slice(1).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    }
    // Handle rgba() - return hex part, ignore alpha for color input
     const rgbaMatch = rgb.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/);
     if (rgbaMatch) {
         return "#" + rgbaMatch.slice(1, 4).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
     }

    console.warn("Could not convert RGB/RGBA to hex:", rgb);
    return '#ffffff'; // Fallback
}

function getRotationRad(element) {
    if (!element || !element.style || !element.style.transform) return 0;
    const transform = element.style.transform;
    // Extract rotation value in degrees using regex
    const rotateMatch = transform.match(/rotate\((-?\d+(\.\d+)?)deg\)/);
    const rotationDeg = rotateMatch ? parseFloat(rotateMatch[1]) : 0;
    // Convert degrees to radians
    return rotationDeg * (Math.PI / 180);
}


// --- DISCLAIMER Functions ---
function showComicDisclaimer() {
    if (disclaimerModal) {
        disclaimerModal.classList.add('visible');
    }
}

function hideComicDisclaimer() {
    if (disclaimerModal) {
        disclaimerModal.classList.remove('visible');
    }
}


// --- Drawing Overlays onto Canvas (Helper for Save/Upload) ---
function drawOverlaysToCanvas(targetCtx, targetCanvasWidth, targetCanvasHeight) {
     const canvasRect = canvas.getBoundingClientRect(); // Get the *displayed* canvas size/pos
     if (!canvasRect || canvasRect.width === 0 || canvasRect.height === 0) {
         console.error("Cannot draw overlays: Invalid canvas dimensions.");
         return false; // Indicate failure
     }

     // Calculate scaling factors between displayed size and actual render size (e.g., 2048x2048)
     const scaleX = targetCanvasWidth / canvasRect.width;
     const scaleY = targetCanvasHeight / canvasRect.height;

     // Get all overlay elements, sort by z-index to draw in correct order
     const allOverlays = Array.from(container.querySelectorAll(".textOverlay, .imgOverlay"));
     allOverlays.sort((a, b) => (parseInt(window.getComputedStyle(a).zIndex) || 0) - (parseInt(window.getComputedStyle(b).zIndex) || 0));

     allOverlays.forEach(el => {
         const elRect = el.getBoundingClientRect(); // Get element's position/size on screen

         // Calculate center of the element relative to the displayed canvas
         const elCenterX_viewport = elRect.left + elRect.width / 2;
         const elCenterY_viewport = elRect.top + elRect.height / 2;

         // Position relative to the canvas's top-left corner
         const relativeCenterX = elCenterX_viewport - canvasRect.left;
         const relativeCenterY = elCenterY_viewport - canvasRect.top;

         // Scale this relative position to the target canvas coordinates
         const canvasX = Math.round(relativeCenterX * scaleX);
         const canvasY = Math.round(relativeCenterY * scaleY);

         // Get rotation
         const rotationRad = getRotationRad(el);

         targetCtx.save(); // Save context state before transforming
         targetCtx.translate(canvasX, canvasY); // Move origin to element center
         targetCtx.rotate(rotationRad); // Rotate around the new origin

         // Draw based on element type
         if (el.classList.contains('textOverlay')) {
             const text = el.childNodes[0].nodeValue;
             const color = el.style.color;
             const size = parseInt(el.style.fontSize);
             const font = el.style.fontFamily;

             // Scale font size based on canvas scaling
             const canvasFontSize = Math.round(size * scaleY); // Scale font size proportionally

             targetCtx.font = `${canvasFontSize}px ${font}`;
             targetCtx.fillStyle = color;
             targetCtx.textAlign = "center";
             targetCtx.textBaseline = "middle"; // Align text vertically to the center
             targetCtx.fillText(text, 0, 0); // Draw text at the transformed origin (0,0)

         } else if (el.classList.contains('imgOverlay')) {
             const imgElement = el.querySelector('img');
             if (imgElement && imgElement.complete && imgElement.naturalWidth > 0) {
                 // Scale element dimensions to canvas size
                  const canvasDrawWidth = Math.round(el.offsetWidth * scaleX);
                  const canvasDrawHeight = Math.round(el.offsetHeight * scaleY);

                 if (canvasDrawWidth > 0 && canvasDrawHeight > 0) {
                      // Draw image centered at the transformed origin
                      targetCtx.drawImage(imgElement, -canvasDrawWidth / 2, -canvasDrawHeight / 2, canvasDrawWidth, canvasDrawHeight);
                 }
             } else {
                 console.warn("Skipping unloaded/invalid image overlay during draw:", imgElement?.src);
             }
         }
         targetCtx.restore(); // Restore context state (removes transform)
     });
     return true; // Indicate success
 }


// --- Save Full Image Locally ---
function saveFullImageLocally() {
    const currentNftId = nftTokenIdInput.value || 'unknown';
    const currentCollection = nftCollectionSelect.value || 'unknown';

    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) {
        alert("Load a valid NFT first to save the full image!");
        nftStatusEl.className = 'error';
        nftStatusEl.textContent = "NFT not loaded for full save.";
        return;
    }

    nftStatusEl.textContent = `Generating full image...`;
    nftStatusEl.className = '';
    if (activeElement) activeElement.classList.remove('active'); // Temporarily hide outline

    // 1. Redraw the base NFT image
    drawBaseImage();
    // 2. Draw the colored sign polygon
    drawSignPolygonOnly();
    // 3. Draw all text/image overlays on top
    const overlaysDrawn = drawOverlaysToCanvas(ctx, canvasWidth, canvasHeight);

    if (activeElement) activeElement.classList.add('active'); // Restore outline after drawing

    if (!overlaysDrawn) {
         alert("Error drawing overlays onto the canvas. Cannot save.");
         nftStatusEl.textContent = "Save Error: Overlay draw failed.";
         nftStatusEl.className = 'error';
         // Redraw view without overlays if drawing failed?
         applyOverlay();
         return;
    }

    // 4. Generate data URL and download link
    try {
        const dataURL = canvas.toDataURL("image/png"); // Use PNG
        const link = document.createElement("a");
        const filename = `signed-${currentCollection}-${currentNftId}.png`;
        link.download = filename;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        nftStatusEl.textContent = `Full image saved as ${filename}!`;
        nftStatusEl.className = 'success';
    } catch (e) {
        console.error("Error saving full image:", e);
        if (e.name === "SecurityError") {
            alert("Save Error: Cannot save canvas due to cross-origin image security restrictions. Ensure NFT images allow cross-origin use (CORS).");
            nftStatusEl.textContent = "Save Error: Cross-origin issue.";
        } else {
            alert("An error occurred while saving the full image.");
            nftStatusEl.textContent = "Save Error.";
        }
        nftStatusEl.className = 'error';
        // Redraw the original view if save failed
        applyOverlay(); // Redraw NFT + sign color
        drawOverlaysToCanvas(ctx, canvasWidth, canvasHeight); // Try redrawing overlays in view
        if (activeElement) activeElement.classList.add('active');
    }
}


// --- Upload Sign Only to Supabase Gallery ---
async function uploadSignToGallery() {
    if (!supabase) {
        alert("Error: Cannot upload. Connection to the gallery service failed.");
        nftStatusEl.textContent = "Upload Error: No gallery connection.";
        nftStatusEl.className = 'error';
        return;
    }

    const currentNftId = nftTokenIdInput.value || 'unknown';
    const currentCollection = nftCollectionSelect.value || 'unknown';
    const signColor = overlayColorInput.value;

    // Basic check: Need at least a sign color and loaded NFT
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) {
         alert("Load a valid NFT first before uploading its sign.");
         nftStatusEl.className = 'error';
         nftStatusEl.textContent = "NFT not loaded for sign upload.";
         return;
    }
     if (!signColor) {
          alert("Apply a sign color before uploading.");
          nftStatusEl.className = 'error';
          nftStatusEl.textContent = "No sign color applied.";
          return;
     }


    nftStatusEl.textContent = `Generating sign image for upload...`;
    nftStatusEl.className = '';
    uploadSignBtn.disabled = true; // Disable button during process
    if (activeElement) activeElement.classList.remove('active'); // Hide outline

    // --- Create Sign Image on Canvas ---
    // 1. Clear canvas to TRANSPARENT
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    // 2. Draw ONLY the colored sign polygon
    drawSignPolygonOnly();
    // 3. Draw overlays onto the transparent background
    const overlaysDrawn = drawOverlaysToCanvas(ctx, canvasWidth, canvasHeight);

    // --- Important: Redraw the original full view IN THE BACKGROUND ---
    // Restore the visual state for the user immediately after generating the sign data
     const redrawFullView = () => {
          if (baseImage.src && baseImage.complete) {
              applyOverlay(); // Redraw NFT + sign color
              drawOverlaysToCanvas(ctx, canvasWidth, canvasHeight); // Redraw overlays on top
          } else {
              clearCanvas(); // Or just clear if base image somehow got lost
          }
           if (activeElement) activeElement.classList.add('active'); // Restore outline
           uploadSignBtn.disabled = false; // Re-enable button
     };

    if (!overlaysDrawn) {
         alert("Error drawing overlays onto the canvas. Cannot upload sign.");
         nftStatusEl.textContent = "Upload Error: Overlay draw failed.";
         nftStatusEl.className = 'error';
         redrawFullView(); // Redraw original view even on failure
         return;
    }

    // --- Convert Canvas to Blob for Upload ---
    canvas.toBlob(async (blob) => {
        if (!blob) {
            console.error("Failed to create blob from canvas.");
            alert("Error creating image data for upload.");
            nftStatusEl.textContent = "Upload Error: Blob creation failed.";
            nftStatusEl.className = 'error';
            redrawFullView(); // Redraw original view
            return;
        }

        // --- Perform Supabase Upload ---
        const timestamp = Date.now();
        const fileName = `sign-${currentCollection}-${currentNftId}-${timestamp}.png`;
        const filePath = `${currentCollection}/${fileName}`; // Organize by collection in bucket

        nftStatusEl.textContent = `Uploading sign to gallery...`;
        nftStatusEl.className = '';

        try {
            const { data, error } = await supabase.storage
                .from(SUPABASE_BUCKET_NAME)
                .upload(filePath, blob, {
                    contentType: 'image/png',
                    upsert: false // Don't overwrite existing files with the same name
                });

            if (error) {
                // Throw the error to be caught by the catch block
                throw error;
            }

            if (data) {
                console.log("Supabase upload successful:", data);
                nftStatusEl.textContent = `Sign uploaded successfully! (${fileName})`;
                nftStatusEl.className = 'success';
                // Optionally get public URL:
                // const { data: { publicUrl } } = supabase.storage.from(SUPABASE_BUCKET_NAME).getPublicUrl(filePath);
                // console.log('Public URL:', publicUrl);
            } else {
                 // Should not happen if error is null, but handle defensively
                 throw new Error("Upload completed without error, but no data returned.");
            }

        } catch (error) {
            console.error("Supabase upload error:", error);
            let errorMsg = "Upload Error: Failed to upload sign to gallery.";
             if (error.message?.includes('bucket not found')) {
                errorMsg = `Upload Error: Bucket '${SUPABASE_BUCKET_NAME}' not found. Please create it in Supabase.`;
             } else if (error.message?.includes('mime type') || error.message?.includes('format')) {
                 errorMsg = "Upload Error: Invalid image format for upload.";
             } else if (error.message?.includes('Auth') || error.message?.includes('authorized') || error.message?.includes('RLS')) {
                  errorMsg = "Upload Error: Not authorized. Check Supabase bucket permissions/policies.";
             }
            // Add more specific Supabase error checks if needed

            alert(errorMsg + " Check console for details.");
            nftStatusEl.textContent = errorMsg;
            nftStatusEl.className = 'error';
        } finally {
             // --- ALWAYS Redraw full view and re-enable button ---
             redrawFullView();
        }

    }, 'image/png'); // Specify PNG format for transparency

} // End uploadSignToGallery function