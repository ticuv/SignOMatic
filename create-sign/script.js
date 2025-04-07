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
const SUPABASE_BUCKET_NAME = 'sign-gallery';
let supabase = null;
try {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("Supabase client initialized.");
    } else {
        console.error("Supabase library not loaded correctly.");
        alert("Error: Could not initialize connection to the gallery service.");
    }
} catch (error) {
    console.error("Error initializing Supabase:", error);
    alert("Error: Could not initialize connection to the gallery service.");
}

// --- Global State ---
let baseImage = new Image();
let activeElement = null;
let textInteractionState = { isDragging: false, isRotating: false, startX: 0, startY: 0, startLeft: 0, startTop: 0, rotateCenterX: 0, rotateCenterY: 0, rotateStartAngle: 0 };
let imageInteractionState = { isDragging: false, isRotating: false, isResizing: false, startX: 0, startY: 0, startLeft: 0, startTop: 0, centerX: 0, centerY: 0, startAngle: 0, currentRotationRad: 0, startWidth: 0, startHeight: 0, aspectRatio: 1 };
// --- AUTH ---
let currentUser = null;
// --- LOADING STATE ---
let isLoadingState = false; // Flag dedicat pentru starea de încărcare

// --- DOM Element References ---
let canvas, ctx, container, textInput, textColor, fontSize, fontFamily, removeBtn, nftStatusEl,
    nftCollectionSelect, nftTokenIdInput, loadNftBtn, applyOverlayBtn, overlayColorInput,
    addTextBtn, addImageBtn, imageUpload, resetCanvasBtn,
    saveFullBtn, uploadSignBtn,
    disclaimerBtn, disclaimerModal, closeDisclaimerBtn,
    authModal, closeAuthModalBtn, connectXModalBtn;

// --- Initialization ---
window.onload = () => {
    // Get Element References
    canvas = document.getElementById("canvas");
    ctx = canvas.getContext("2d", { willReadFrequently: true });
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
    imageUpload = document.getElementById("imageUpload");
    addImageBtn = document.getElementById("addImageBtn");
    resetCanvasBtn = document.getElementById("resetCanvas");
    saveFullBtn = document.getElementById("saveFullBtn");
    uploadSignBtn = document.getElementById("uploadSignBtn");
    disclaimerBtn = document.getElementById("disclaimerBtn");
    disclaimerModal = document.getElementById("disclaimerModal");
    closeDisclaimerBtn = document.getElementById("closeDisclaimerBtn");
    authModal = document.getElementById("authModal");
    closeAuthModalBtn = document.getElementById("closeAuthModalBtn");
    connectXModalBtn = document.getElementById("connectXModalBtn");

    // Initial Setup
    enableEditingControls(false);
    clearCanvas();
    setupEventListeners();

    if (supabase) {
        checkUserSession();
        monitorAuthState();
    } else {
        updateControlState(); // Reflect Supabase init failure
    }
};

function setupEventListeners() {
    // Core Controls
    loadNftBtn.addEventListener('click', loadNftToCanvas);
    applyOverlayBtn.addEventListener('click', applyOverlay);
    overlayColorInput.addEventListener('input', applyOverlay);
    addTextBtn.addEventListener('click', addText);
    textInput.addEventListener("input", handleTextControlChange);
    textColor.addEventListener("input", handleTextControlChange);
    fontSize.addEventListener("input", handleTextControlChange);
    fontFamily.addEventListener("input", handleTextControlChange);
    addImageBtn.addEventListener('click', addImage);
    removeBtn.addEventListener('click', removeActiveElement);
    resetCanvasBtn.addEventListener('click', handleReset);
    nftCollectionSelect.addEventListener("change", () => { if (baseImage.src && baseImage.complete) { applyOverlay(); } });

    // Final Actions
    if (saveFullBtn) saveFullBtn.addEventListener('click', saveFullImageLocally);
    if (uploadSignBtn) uploadSignBtn.addEventListener('click', handleUploadClick);

    // Disclaimer Modal
    if (disclaimerBtn && disclaimerModal && closeDisclaimerBtn) { /* ... listener setup ... */ }

    // Prevent default drag behavior
    container.addEventListener('dragstart', (e) => e.preventDefault());

    // --- AUTH MODAL Listeners ---
    if (authModal && closeAuthModalBtn && connectXModalBtn) { /* ... listener setup ... */ }
}

// --- LOADING STATE HELPER ---
function setLoadingState(loading, message = "") {
    console.log(`setLoadingState called: loading=${loading}, message="${message}"`); // Debug
    isLoadingState = loading;
    if (loading && message) {
        nftStatusEl.textContent = message;
        nftStatusEl.className = ''; // Neutral class while loading
    } else if (!loading && message) {
        nftStatusEl.textContent = message;
        // Class name (success/error/warning) should be set by the calling function *before* calling setLoadingState(false, finalMessage)
    } else if (!loading && nftStatusEl.textContent.toLowerCase().includes('loading')) {
         // If clearing loading without a final message, and status still shows loading, clear it.
         nftStatusEl.textContent = "";
         nftStatusEl.className = '';
    }
    // ALWAYS update controls after changing loading state
    updateControlState();
}


// --- AUTH Functions ---
async function checkUserSession() { /* ... no changes needed ... */ }
function monitorAuthState() { /* ... no changes needed ... */ }
async function signInWithTwitter() {
    if (!supabase) return;
    try {
        // Use setLoadingState for consistency, even though it's mainly for text status
        setLoadingState(true, "Redirecting to X for authentication...");

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'twitter',
            options: { redirectTo: window.location.href } // Keep redirect for now
        });

        if (error) {
             // Clear loading state *before* throwing error if redirect doesn't happen
             setLoadingState(false);
             throw error;
        }
        // Don't set loading false here, redirect happens. Page reload handles it.
    } catch (error) {
        console.error("Error signing in with Twitter:", error);
        // Make sure loading state is false on error
        setLoadingState(false, `Error connecting with X: ${error.message}`);
        nftStatusEl.className = 'error';
    }
}
async function signOut() { /* ... no changes, maybe add setLoadingState(true/false) around the call? ... */ }

// --- AUTH MODAL Management ---
function showAuthModal() { /* ... no changes ... */ }
function hideAuthModal() { /* ... no changes ... */ }


// --- Event Handlers ---
 function handleTextControlChange() { /* ... no changes ... */ }
 function handleReset() { /* ... no changes ... */ }

// --- Canvas & Overlay Management ---
function clearCanvasAndOverlays() { /* ... no changes ... */ }
function clearCanvas() { /* ... no changes ... */ }


// --- Control State Management ---
function enableEditingControls(isEnabled) {
    // Only enables/disables based on NFT load status (isEnabled)
    [overlayColorInput, applyOverlayBtn, textInput, textColor, fontSize, fontFamily,
     addTextBtn, imageUpload, addImageBtn, removeBtn, saveFullBtn
    ].forEach(el => { if (el) el.disabled = !isEnabled; });
    // Final state check happens in updateControlState
    updateControlState();
}

function updateControlState() {
    const isElementActive = activeElement !== null;
    const isTextActive = isElementActive && activeElement.classList.contains('textOverlay');
    const isImageLoaded = baseImage.src !== "" && baseImage.complete && baseImage.naturalWidth > 0;
    const isAuthenticated = currentUser !== null;
    const isLoading = isLoadingState; // Use the dedicated flag

    console.log(`updateControlState: isImageLoaded=${isImageLoaded}, isLoading=${isLoading}, isAuthenticated=${isAuthenticated}`); // Debug Log

    // Disable core editing if no image loaded OR if loading/processing
    const coreEditingDisabled = !isImageLoaded || isLoading;

    // Apply core disabling
    if (overlayColorInput) overlayColorInput.disabled = coreEditingDisabled;
    if (applyOverlayBtn) applyOverlayBtn.disabled = coreEditingDisabled;
    if (addTextBtn) addTextBtn.disabled = coreEditingDisabled;
    if (imageUpload) imageUpload.disabled = coreEditingDisabled;
    if (addImageBtn) addImageBtn.disabled = coreEditingDisabled;
    if (saveFullBtn) saveFullBtn.disabled = coreEditingDisabled;

    // Text controls: require core enabled AND text active
    if (textInput) textInput.disabled = coreEditingDisabled || !isTextActive;
    if (textColor) textColor.disabled = coreEditingDisabled || !isTextActive;
    if (fontSize) fontSize.disabled = coreEditingDisabled || !isTextActive;
    if (fontFamily) fontFamily.disabled = coreEditingDisabled || !isTextActive;

    // Remove button: require core enabled AND element active
    if (removeBtn) removeBtn.disabled = coreEditingDisabled || !isElementActive;

    // Upload button: require core enabled (image loaded, not loading)
    if (uploadSignBtn) {
        uploadSignBtn.disabled = coreEditingDisabled; // Simplified disabling
        if (isLoading) {
             uploadSignBtn.title = "Processing...";
        } else if (!isImageLoaded) {
             uploadSignBtn.title = "Load an NFT first.";
        } else if (!isAuthenticated) {
            uploadSignBtn.title = "Click to Connect & Upload"; // Hint if not logged in
        } else {
            uploadSignBtn.title = "Upload sign to gallery"; // Ready state
        }
        console.log(`updateControlState: uploadSignBtn.disabled set to ${uploadSignBtn.disabled}, title: "${uploadSignBtn.title}"`); // Debug Log
    }

    // Load NFT button: disable only when actively loading
    if (loadNftBtn) loadNftBtn.disabled = isLoading;

    // Auth modal buttons: disable if main app is loading
    const authModalButtons = authModal ? authModal.querySelectorAll('button') : [];
    authModalButtons.forEach(btn => btn.disabled = isLoading);
}


// --- NFT Loading & Drawing ---
function getPolygonForSelectedCollection() { /* ... no changes ... */ }
function resolveIpfsUrl(url) { /* ... no changes ... */ }
async function loadNftToCanvas() {
    const selectedCollection = nftCollectionSelect.value; const tokenId = nftTokenIdInput.value;
    if (!tokenId) { nftStatusEl.textContent = "Please enter a Token ID."; nftStatusEl.className = 'error'; return; }
    if (!nftContracts[selectedCollection]) { nftStatusEl.textContent = "Invalid NFT collection selected."; nftStatusEl.className = 'error'; return; }

    setLoadingState(true, `Loading ${nftContracts[selectedCollection].name} #${tokenId}...`);
    clearCanvasAndOverlays();
    const contractInfo = nftContracts[selectedCollection]; const contract = new ethers.Contract(contractInfo.address, nftAbi, provider);
    try {
        let tokenURI = await contract.tokenURI(tokenId); tokenURI = resolveIpfsUrl(tokenURI);
        setLoadingState(true, "Fetching metadata...");
        const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 20000);
        const response = await fetch(tokenURI, { signal: controller.signal }); clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Metadata error: ${response.status} ${response.statusText} (URL: ${tokenURI})`);
        const metadata = await response.json(); let imageUrl = resolveIpfsUrl(metadata.image || metadata.image_url || metadata.imageUrl);
        if (!imageUrl) throw new Error("Image URL missing in metadata");
        setLoadingState(true, "Loading image...");
        baseImage = new Image(); baseImage.crossOrigin = "Anonymous";
        await new Promise((resolve, reject) => {
            baseImage.onload = () => {
                console.log("Base image loaded. Complete:", baseImage.complete, "NaturalWidth:", baseImage.naturalWidth); // DEBUG
                setLoadingState(true, "Drawing image..."); // Keep loading state while drawing
                drawBaseImage();
                // Set success message FIRST
                nftStatusEl.textContent = `${nftContracts[selectedCollection].name} #${tokenId} loaded successfully!`;
                nftStatusEl.className = 'success';
                setLoadingState(false); // NOW clear loading state
                enableEditingControls(true); // Enable controls AFTER loading is false
                applyOverlay();
                resolve();
            };
            baseImage.onerror = (err) => {
                console.error("Error loading NFT image:", err, "Attempted URL:", imageUrl);
                nftStatusEl.textContent = `Error loading image. Check console.`;
                nftStatusEl.className = 'error';
                clearCanvasAndOverlays(); ctx.fillStyle = "white"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("Image Load Error", canvasWidth / 2, canvasHeight / 2);
                setLoadingState(false); // Clear loading state on error
                reject(new Error('Image load failed'));
            };
            baseImage.src = imageUrl;
        });
    } catch (err) {
        console.error(`Error processing NFT ${tokenId}:`, err); let errorMsg = "Error: " + err.message;
        // ... (rest of error message handling) ...
        nftStatusEl.textContent = errorMsg; nftStatusEl.className = 'error';
        clearCanvasAndOverlays(); ctx.fillStyle = "white"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("NFT Load Error", canvasWidth / 2, canvasHeight / 2);
        setLoadingState(false); // Clear loading state on error
    }
 }
function drawBaseImage() { /* ... no changes ... */ }
function applyOverlay() { /* ... no changes ... */ }
function drawSignPolygonOnly() { /* ... no changes ... */ }


// --- Text & Image Creation ---
function addText() { /* ... no changes ... */ }
function addImage() { /* ... no changes ... */ }
function positionElementOnSign(element) { /* ... no changes ... */ }


// --- Active Element Management & Removal ---
function setActiveElement(el) { /* ... no changes ... */ }
function removeActiveElement() { /* ... no changes ... */ }


// --- Interaction Handlers ---
function getEventCoordinates(event) { /* ... no changes ... */ }
function handleTextDragStart(event) { /* ... no changes ... */ }
function handleTextRotateStart(event) { /* ... no changes ... */ }
function handleTextInteractionMove(event) { /* ... no changes ... */ }
function handleTextInteractionEnd(event) { /* ... no changes ... */ }
function handleImageDragStart(event) { /* ... no changes ... */ }
function handleImageRotateStart(event) { /* ... no changes ... */ }
function handleImageResizeStart(event) { /* ... no changes ... */ }
function handleImageInteractionMove(event) { /* ... no changes ... */ }
function handleImageInteractionEnd(event) { /* ... no changes ... */ }


// --- Utility Functions ---
function calculateElementPosition(percentX, percentY){ /* ... no changes ... */ }
function getCanvasCoordsFromContainerPoint(containerX_px, containerY_px){ /* ... no changes ... */ }
function pointInPolygon(point, vs){ /* ... no changes ... */ }
function rgb2hex(rgb){ /* ... no changes ... */ }
function getRotationRad(element){ /* ... no changes ... */ }


// --- DISCLAIMER Functions ---
function showComicDisclaimer() { /* ... no changes ... */ }
function hideComicDisclaimer() { /* ... no changes ... */ }


// --- Drawing Overlays onto Canvas Helper ---
function drawOverlaysToCanvas(targetCtx, targetCanvasWidth, targetCanvasHeight) { /* ... no changes ... */ }


// --- Save Full Image Locally ---
function saveFullImageLocally() { /* ... no changes ... */ }


// --- Upload Sign Handlers ---

function handleUploadClick() {
    console.log("handleUploadClick triggered!"); // DEBUG
    const isImageLoaded = baseImage.src !== "" && baseImage.complete && baseImage.naturalWidth > 0;
    const isLoading = isLoadingState;

    // Check preconditions again (even though button *should* be disabled)
    if (!isImageLoaded) {
        nftStatusEl.textContent = "Please load an NFT first.";
        nftStatusEl.className = 'warning';
        console.warn("Upload clicked but image not loaded.");
        return;
    }
    if (isLoading) {
        console.warn("Upload clicked while already loading.");
        return; // Ignore click if busy
    }

    console.log("Current User:", currentUser); // DEBUG
    if (currentUser) {
        console.log("User authenticated, calling uploadSignToGallery..."); // DEBUG
        uploadSignToGallery();
    } else {
        console.log("User not authenticated, calling showAuthModal..."); // DEBUG
        showAuthModal();
    }
}

async function uploadSignToGallery() {
    console.log("uploadSignToGallery called"); // DEBUG
    if (!currentUser) { console.error("UploadSignToGallery called without authenticated user!"); showAuthModal(); return; }
    if (!supabase) { alert("Gallery connection error."); return; }

    const currentNftId = nftTokenIdInput.value || 'unknown';
    const currentCollection = nftCollectionSelect.value || 'unknown';
    const signColor = overlayColorInput.value;

    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { /* redundant check */ return; }
    if (!signColor) { alert("Apply sign color first."); return; }

    setLoadingState(true, `Generating sign image for upload...`);
    if (activeElement) activeElement.classList.remove('active');

    // --- Function to Redraw the user's view ---
     const redrawFullView = () => {
          console.log("Redrawing full view..."); // DEBUG
          if (baseImage.src && baseImage.complete) { applyOverlay(); drawOverlaysToCanvas(ctx, canvasWidth, canvasHeight); }
          else { clearCanvas(); }
          if (activeElement) activeElement.classList.add('active');
          updateControlState(); // Update controls AFTER redraw is done
     };

    // --- Create Sign Image on Canvas (using setTimeout to allow UI update) ---
    setTimeout(async () => {
        try {
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            drawSignPolygonOnly();
            const overlaysDrawn = drawOverlaysToCanvas(ctx, canvasWidth, canvasHeight);

            if (!overlaysDrawn) {
                throw new Error("Overlay draw failed during sign generation.");
            }

            // --- Convert Canvas to Blob ---
            const blob = await new Promise((resolve, reject) => {
                canvas.toBlob((b) => {
                    if (b) resolve(b);
                    else reject(new Error("Canvas to Blob conversion failed."));
                }, 'image/png');
            });

             // --- Perform Supabase Upload ---
            const timestamp = Date.now();
            const userId = currentUser.id;
            const userHandle = currentUser.user_metadata?.user_name || currentUser.user_metadata?.screen_name || 'unknown_user';
            const fileName = `sign-${currentCollection}-${currentNftId}-${userHandle}-${timestamp}.png`;
            const filePath = `${currentCollection}/${userId}/${fileName}`;

            setLoadingState(true, `Uploading sign as @${userHandle}...`); // Update status

            const { data, error } = await supabase.storage
                .from(SUPABASE_BUCKET_NAME)
                .upload(filePath, blob, { contentType: 'image/png', upsert: false });

            if (error) throw error; // Throw to catch block

            if (data) {
                console.log("Supabase upload successful:", data);
                nftStatusEl.textContent = `Sign uploaded successfully! (${fileName})`;
                nftStatusEl.className = 'success';
                setLoadingState(false); // Clear loading on success
                // Optional DB Insert Logic Here
            } else {
                 throw new Error("Upload completed without error, but no data returned.");
            }

        } catch (error) {
            console.error("Error during sign generation or upload:", error);
            let errorMsg = "Upload Error: Failed to upload sign.";
            if (error.message?.includes('Blob conversion failed')) { errorMsg = "Upload Error: Failed to generate image data."; }
            else if (error.message?.includes('Overlay draw failed')) { errorMsg = "Upload Error: Failed to draw overlays for sign."; }
            else if (error.message?.includes('bucket not found')) { errorMsg = `Upload Error: Bucket '${SUPABASE_BUCKET_NAME}' not found.`; }
            else if (error.message?.includes('mime type')) { errorMsg = "Upload Error: Invalid image format."; }
            else if (error.message?.includes('Auth') || error.message?.includes('policy') || error.message?.includes('RLS')) { errorMsg = "Upload Error: Not authorized (Check Bucket Policies/RLS)."; }
            // ... other specific error checks ...
            alert(errorMsg + " Check console for details.");
            nftStatusEl.textContent = errorMsg; nftStatusEl.className = 'error';
            setLoadingState(false); // Clear loading state on error
        } finally {
             // --- ALWAYS Redraw full view ---
             redrawFullView();
        }

    }, 50); // Small delay (50ms) to allow "Generating..." message to show

} // End uploadSignToGallery function