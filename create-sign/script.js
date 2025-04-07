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
const SUPABASE_BUCKET_NAME = 'sign-gallery'; // Asigură-te că acest bucket există și politicile RLS sunt setate!
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
let currentUser = null; // Store user session/data

// --- DOM Element References ---
let canvas, ctx, container, textInput, textColor, fontSize, fontFamily, removeBtn, nftStatusEl,
    nftCollectionSelect, nftTokenIdInput, loadNftBtn, applyOverlayBtn, overlayColorInput,
    addTextBtn, addImageBtn, imageUpload, resetCanvasBtn,
    saveFullBtn, uploadSignBtn,
    disclaimerBtn, disclaimerModal, closeDisclaimerBtn,
    // --- AUTH ---
    authStatusDiv; // Reference for auth container div

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
    // --- AUTH ---
    authStatusDiv = document.getElementById("auth-status");

    // Initial Setup
    enableEditingControls(false); // Start with editing disabled
    clearCanvas();
    setupEventListeners();

    // --- AUTH --- Check initial auth state
    if (supabase) {
        checkUserSession(); // Check if already logged in
        monitorAuthState(); // Listen for changes (login/logout)
    } else {
        updateAuthUI(null); // Show connect button if supabase failed
        updateControlState(); // Ensure controls reflect lack of Supabase
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
    if (saveFullBtn) {
        saveFullBtn.addEventListener('click', saveFullImageLocally);
    }
    if (uploadSignBtn) {
        uploadSignBtn.addEventListener('click', uploadSignToGallery);
    }

    // Disclaimer
    if (disclaimerBtn && disclaimerModal && closeDisclaimerBtn) {
        disclaimerBtn.addEventListener('click', showComicDisclaimer);
        closeDisclaimerBtn.addEventListener('click', hideComicDisclaimer);
        disclaimerModal.addEventListener('click', (event) => {
            if (event.target === disclaimerModal) { hideComicDisclaimer(); }
        });
    }

    // Prevent default drag behavior
    container.addEventListener('dragstart', (e) => e.preventDefault());

    // --- AUTH --- Listener for the dynamically added connect/signout buttons
    // Event delegation on the parent div handles dynamically created buttons
    if (authStatusDiv) {
        authStatusDiv.addEventListener('click', (event) => {
            if (event.target.id === 'connectXBtn') {
                signInWithTwitter();
            } else if (event.target.id === 'signOutBtn') {
                signOut();
            }
        });
    }
}

// --- AUTH Functions ---

async function checkUserSession() {
    if (!supabase) return;
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        currentUser = session ? session.user : null;
        updateAuthUI(currentUser);
        updateControlState(); // Update button states based on initial auth
    } catch (error) {
        console.error("Error checking user session:", error);
        updateAuthUI(null);
        updateControlState(); // Reflect error state
    }
}

function monitorAuthState() {
    if (!supabase) return;
    supabase.auth.onAuthStateChange((_event, session) => {
        console.log("Auth state changed:", _event, session);
        currentUser = session ? session.user : null;
        updateAuthUI(currentUser);
        updateControlState(); // Update controls whenever auth changes
    });
}

async function signInWithTwitter() {
    if (!supabase) return;
    try {
        nftStatusEl.textContent = "Redirecting to X for authentication...";
        nftStatusEl.className = '';
        updateControlState(); // Disable buttons during redirect process
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'twitter',
            options: {
                // Important: Redirect back to the current page after X auth
                redirectTo: window.location.href
             }
        });
        if (error) throw error;
        // User is redirected. onAuthStateChange will fire upon return.
    } catch (error) {
        console.error("Error signing in with Twitter:", error);
        nftStatusEl.textContent = `Error connecting with X: ${error.message}`;
        nftStatusEl.className = 'error';
        updateAuthUI(null); // Show connect button again
        updateControlState(); // Re-enable relevant controls
    }
}

async function signOut() {
    if (!supabase || !currentUser) return; // Don't try if not connected or no user
    try {
        nftStatusEl.textContent = "Signing out...";
        nftStatusEl.className = '';
        updateControlState(); // Disable buttons during sign out
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        console.log("Signed out successfully");
        nftStatusEl.textContent = "Signed out.";
        nftStatusEl.className = 'success';
        // currentUser is set to null by onAuthStateChange listener, triggering UI/control updates.
    } catch (error) {
        console.error("Error signing out:", error);
        nftStatusEl.textContent = `Error signing out: ${error.message}`;
        nftStatusEl.className = 'error';
    } finally {
        // Ensure controls are updated even if signout fails network-wise,
        // as onAuthStateChange might handle the client-side state change.
        updateControlState();
    }
}

function updateAuthUI(user) {
    if (!authStatusDiv) return;

    authStatusDiv.innerHTML = ''; // Clear previous content

    if (user) {
        // User is logged in
        // Attempt to get Twitter handle, fallback to email/ID
        const userHandle = user.user_metadata?.user_name || user.user_metadata?.screen_name || user.email || `User ${user.id.substring(0,6)}`;
        const welcomeText = document.createElement('span');
        welcomeText.textContent = `Connected as: @${userHandle}`; // Add @ for clarity
        welcomeText.style.marginRight = '10px';
        welcomeText.style.color = 'var(--slime-green)';
        welcomeText.style.fontWeight = 'bold';
        welcomeText.title = `User ID: ${user.id}`; // Show full ID on hover

        const signOutBtn = document.createElement('button');
        signOutBtn.id = 'signOutBtn';
        signOutBtn.textContent = 'Sign Out';
        signOutBtn.style.backgroundColor = 'var(--error-red)';
        signOutBtn.style.color = 'var(--off-white)';
        signOutBtn.style.borderColor = 'var(--outline-black)'; // Ensure consistency

        authStatusDiv.appendChild(welcomeText);
        authStatusDiv.appendChild(signOutBtn);
    } else {
        // User is logged out
        const connectBtn = document.createElement('button');
        connectBtn.id = 'connectXBtn';
        connectBtn.textContent = 'Connect with X';
        connectBtn.style.backgroundColor = 'var(--portal-blue)'; // Consistent styling
        connectBtn.style.color = 'var(--off-white)';
        connectBtn.style.borderColor = 'var(--outline-black)';

        authStatusDiv.appendChild(connectBtn);
    }
}

// --- End AUTH Functions ---


// --- Event Handlers ---
 function handleTextControlChange() {
    if (activeElement && activeElement.classList.contains('textOverlay')) {
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
            drawBaseImage();
            applyOverlay();
            enableEditingControls(true); // Re-enable basic controls if image existed
        } else {
            enableEditingControls(false); // Keep disabled if no base image
            nftStatusEl.textContent = "Select collection and ID, then load NFT.";
            nftStatusEl.className = '';
        }
        // Auth state doesn't change on reset, updateControlState handles button enable state
        updateControlState();
    }
 }

// --- Canvas & Overlay Management ---
function clearCanvasAndOverlays() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#444'; // Default background
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el => el.remove());
    setActiveElement(null);
    // Don't clear NFT status completely on clear, keep general instructions or "Cleared"
    // nftStatusEl.textContent = "Canvas Cleared.";
    // nftStatusEl.className = '';
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}


// --- Control State Management ---
function enableEditingControls(isEnabled) {
    // This function PRIMARILY enables/disables controls based on whether an NFT is loaded (isEnabled=true).
    // The AUTHENTICATION state separately controls the UPLOAD button via updateControlState.
    [overlayColorInput, applyOverlayBtn, textInput, textColor, fontSize, fontFamily,
     addTextBtn, imageUpload, addImageBtn, removeBtn, saveFullBtn
    ].forEach(el => { if (el) el.disabled = !isEnabled; });

    // Load NFT button is handled separately in updateControlState based on loading status
    // Auth controls are handled by updateAuthUI
    // Final state including auth check is done by updateControlState
    updateControlState();
}

function updateControlState() {
    const isElementActive = activeElement !== null;
    const isTextActive = isElementActive && activeElement.classList.contains('textOverlay');
    const isImageLoaded = baseImage.src !== "" && baseImage.complete && baseImage.naturalWidth > 0;
    const isAuthenticated = currentUser !== null;
    const isLoading = nftStatusEl.textContent.includes('Loading') || nftStatusEl.textContent.includes('Fetching') || nftStatusEl.textContent.includes('Redirecting') || nftStatusEl.textContent.includes('Signing out');

    // Disable most editing controls if loading/auth process is happening
    const coreEditingDisabled = !isImageLoaded || isLoading;

    if (overlayColorInput) overlayColorInput.disabled = coreEditingDisabled;
    if (applyOverlayBtn) applyOverlayBtn.disabled = coreEditingDisabled;
    if (addTextBtn) addTextBtn.disabled = coreEditingDisabled;
    if (imageUpload) imageUpload.disabled = coreEditingDisabled;
    if (addImageBtn) addImageBtn.disabled = coreEditingDisabled;
    if (saveFullBtn) saveFullBtn.disabled = coreEditingDisabled;

    // Text controls need NFT loaded AND active text element (and not loading)
    if (textInput) textInput.disabled = coreEditingDisabled || !isTextActive;
    if (textColor) textColor.disabled = coreEditingDisabled || !isTextActive;
    if (fontSize) fontSize.disabled = coreEditingDisabled || !isTextActive;
    if (fontFamily) fontFamily.disabled = coreEditingDisabled || !isTextActive;

    // Remove button needs NFT loaded AND active element (and not loading)
    if (removeBtn) removeBtn.disabled = coreEditingDisabled || !isElementActive;

    // Upload button needs NFT loaded AND authenticated (and not loading)
    if (uploadSignBtn) {
        uploadSignBtn.disabled = coreEditingDisabled || !isAuthenticated;
        if (isLoading) {
             uploadSignBtn.title = "Processing...";
        } else if (isImageLoaded && !isAuthenticated) {
            uploadSignBtn.title = "Connect with X to upload.";
        } else if (!isImageLoaded && isAuthenticated) {
             uploadSignBtn.title = "Load an NFT first.";
        } else if (!isImageLoaded && !isAuthenticated) {
             uploadSignBtn.title = "Load NFT and Connect with X to upload.";
        } else {
            uploadSignBtn.title = ""; // Clear title if enabled
        }
    }

    // Load NFT button disabled only when actively loading
    if (loadNftBtn) loadNftBtn.disabled = isLoading;

    // Auth buttons inside #auth-status are handled by updateAuthUI,
    // but disable them during other loading processes too
    const authButtons = authStatusDiv ? authStatusDiv.querySelectorAll('button') : [];
    authButtons.forEach(btn => btn.disabled = isLoading);
}


// --- NFT Loading & Drawing ---
function getPolygonForSelectedCollection() {
    const selectedCollection = nftCollectionSelect.value;
    if (selectedCollection === "AHC") {
        return [{x: 1415, y: 316}, {x: 2024, y: 358}, {x: 1958, y: 1324}, {x: 1358, y: 1286}];
    } else { // Default GHN
        return [{x: 1403, y: 196}, {x: 2034, y: 218}, {x: 1968, y: 1164}, {x: 1358, y: 1126}];
    }
}

function resolveIpfsUrl(url) {
    if (url && url.startsWith("ipfs://")) {
        return url.replace("ipfs://", "https://ipfs.io/ipfs/");
    }
    return url;
}

async function loadNftToCanvas() {
    const selectedCollection = nftCollectionSelect.value;
    const tokenId = nftTokenIdInput.value;

    if (!tokenId) { nftStatusEl.textContent = "Please enter a Token ID."; nftStatusEl.className = 'error'; return; }
    if (!nftContracts[selectedCollection]) { nftStatusEl.textContent = "Invalid NFT collection selected."; nftStatusEl.className = 'error'; return; }

    // Start loading state
    nftStatusEl.textContent = `Loading ${nftContracts[selectedCollection].name} #${tokenId}...`;
    nftStatusEl.className = '';
    enableEditingControls(false); // Disable editing controls first
    updateControlState(); // Update to show loading state (disables Load button etc.)

    clearCanvasAndOverlays(); // Clear previous things

    const contractInfo = nftContracts[selectedCollection];
    const contract = new ethers.Contract(contractInfo.address, nftAbi, provider);

    try {
        let tokenURI = await contract.tokenURI(tokenId);
        tokenURI = resolveIpfsUrl(tokenURI);

        nftStatusEl.textContent = "Fetching metadata..."; updateControlState();
        const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 20000);
        const response = await fetch(tokenURI, { signal: controller.signal }); clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Metadata error: ${response.status} ${response.statusText} (URL: ${tokenURI})`);

        const metadata = await response.json();
        let imageUrl = resolveIpfsUrl(metadata.image || metadata.image_url || metadata.imageUrl);
        if (!imageUrl) throw new Error("Image URL missing in metadata");

        nftStatusEl.textContent = "Loading image..."; updateControlState();
        baseImage = new Image(); baseImage.crossOrigin = "Anonymous";

        await new Promise((resolve, reject) => {
            baseImage.onload = () => {
                nftStatusEl.textContent = "Drawing image..."; updateControlState(); // Show drawing status
                drawBaseImage();
                nftStatusEl.textContent = `${nftContracts[selectedCollection].name} #${tokenId} loaded successfully!`;
                nftStatusEl.className = 'success';
                enableEditingControls(true); // Re-enable core editing controls AFTER successful load
                applyOverlay();
                resolve();
            };
            baseImage.onerror = (err) => {
                console.error("Error loading NFT image:", err, "Attempted URL:", imageUrl);
                nftStatusEl.textContent = `Error loading image. Check console.`;
                nftStatusEl.className = 'error';
                clearCanvasAndOverlays(); ctx.fillStyle = "white"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("Image Load Error", canvasWidth / 2, canvasHeight / 2);
                reject(new Error('Image load failed'));
            };
            baseImage.src = imageUrl;
        });

    } catch (err) {
        console.error(`Error processing NFT ${tokenId}:`, err); let errorMsg = "Error: " + err.message;
        if (err.name === 'AbortError') { errorMsg = "Error: Metadata request timed out."; }
        else if (err.code === 'CALL_EXCEPTION') { if (err.reason?.includes('invalid token ID') || err.message?.includes('invalid token ID')) { errorMsg = `Error: Token ID ${tokenId} invalid or does not exist for ${nftContracts[selectedCollection].name}.`; } else { errorMsg = `Error: Could not query contract. Check network/address or token ID.`; } }
        else if (err.message?.includes('Metadata error')) { errorMsg = `Error fetching metadata: ${err.message.split('(URL:')[0]}`; }
        nftStatusEl.textContent = errorMsg; nftStatusEl.className = 'error';
        clearCanvasAndOverlays(); ctx.fillStyle = "white"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("NFT Load Error", canvasWidth / 2, canvasHeight / 2);
    } finally {
         // Ensure controls are re-evaluated and loading state removed
         updateControlState();
    }
}

function drawBaseImage() {
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) return;
    const aspectRatio = baseImage.naturalWidth / baseImage.naturalHeight;
    let drawWidth = canvasWidth, drawHeight = canvasHeight, x = 0, y = 0;
    if (canvasWidth / canvasHeight > aspectRatio) { drawHeight = canvasHeight; drawWidth = drawHeight * aspectRatio; x = (canvasWidth - drawWidth) / 2; } else { drawWidth = canvasWidth; drawHeight = drawWidth / aspectRatio; y = (canvasHeight - drawHeight) / 2; }
    ctx.clearRect(0, 0, canvasWidth, canvasHeight); ctx.fillStyle = "#444"; ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    try { ctx.drawImage(baseImage, x, y, drawWidth, drawHeight); } catch (e) { console.error("Error drawing base image:", e); nftStatusEl.textContent = "Error drawing NFT image."; nftStatusEl.className = 'error'; ctx.fillStyle = "red"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("Draw Error", canvasWidth / 2, canvasHeight / 2); }
}

function applyOverlay() {
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) return;
    drawBaseImage();
    drawSignPolygonOnly();
}

function drawSignPolygonOnly() {
    const color = overlayColorInput.value;
    const currentPolygon = getPolygonForSelectedCollection();
    ctx.save(); ctx.beginPath(); ctx.moveTo(currentPolygon[0].x, currentPolygon[0].y);
    for (let i = 1; i < currentPolygon.length; i++) { ctx.lineTo(currentPolygon[i].x, currentPolygon[i].y); }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.lineJoin = "round"; ctx.lineWidth = 14; ctx.strokeStyle = "black"; ctx.stroke(); ctx.restore();
}


// --- Text & Image Creation ---
function addText() {
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { nftStatusEl.textContent = "Load a valid NFT first."; nftStatusEl.className = 'error'; return; }
    const textEl = document.createElement("div"); textEl.className = "textOverlay"; textEl.style.position = "absolute"; textEl.style.cursor = "grab"; textEl.innerText = textInput.value || "New Text"; textEl.style.color = textColor.value; textEl.style.fontSize = fontSize.value + "px"; textEl.style.fontFamily = fontFamily.value; textEl.style.transform = `translate(-50%, -50%) rotate(0deg)`; textEl.style.zIndex = "10";
    const handle = document.createElement("span"); handle.className = "rotation-handle"; handle.innerHTML = '↻'; textEl.appendChild(handle);
    positionElementOnSign(textEl); // Use helper for positioning
    textEl.addEventListener("mousedown", handleTextDragStart); textEl.addEventListener("touchstart", handleTextDragStart, { passive: true }); handle.addEventListener("mousedown", handleTextRotateStart); handle.addEventListener("touchstart", handleTextRotateStart, { passive: true });
    container.appendChild(textEl); setActiveElement(textEl);
}

function addImage() {
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { nftStatusEl.textContent = "Please load a valid NFT first."; nftStatusEl.className = 'error'; return; }
    if (!imageUpload || !imageUpload.files || imageUpload.files.length === 0) { nftStatusEl.textContent = "Please select an image file."; nftStatusEl.className = 'error'; return; }
    const file = imageUpload.files[0]; const reader = new FileReader();
    reader.onload = function(e) {
        const wrapper = document.createElement("div"); wrapper.className = "imgOverlay"; wrapper.style.position = "absolute"; wrapper.style.width = "auto"; wrapper.style.height = "auto"; wrapper.style.transform = `translate(-50%, -50%) rotate(0deg)`; wrapper.style.touchAction = "none"; wrapper.style.cursor = "grab"; wrapper.style.zIndex = "20";
        const img = document.createElement("img"); img.src = e.target.result;
        img.onload = () => {
            if (container.offsetWidth > 0 && img.naturalWidth > 0 && img.naturalHeight > 0) {
                const contW = container.offsetWidth; const initialWidth = Math.min(img.naturalWidth, contW * 0.25, 150); const aspectRatio = img.naturalWidth / img.naturalHeight; wrapper.style.width = `${initialWidth}px`;
                if (aspectRatio > 0) { wrapper.style.height = `${initialWidth / aspectRatio}px`; } else { wrapper.style.height = 'auto'; }
            } else { wrapper.style.width = '100px'; wrapper.style.height = 'auto'; }
            positionElementOnSign(wrapper); // Position after size is known
        };
        img.onerror = () => { console.error("Error loading added image."); nftStatusEl.textContent = "Error displaying uploaded image."; nftStatusEl.className = 'error'; wrapper.remove(); };
        wrapper.appendChild(img);
        const rotateHandle = document.createElement("div"); rotateHandle.className = "rotation-handle"; rotateHandle.innerHTML = '↻'; wrapper.appendChild(rotateHandle);
        const resizeHandle = document.createElement("div"); resizeHandle.className = "resize-handle"; resizeHandle.innerHTML = '↔'; wrapper.appendChild(resizeHandle);
        wrapper.addEventListener("mousedown", handleImageDragStart); wrapper.addEventListener("touchstart", handleImageDragStart, { passive: true }); rotateHandle.addEventListener("mousedown", handleImageRotateStart); rotateHandle.addEventListener("touchstart", handleImageRotateStart, { passive: true }); resizeHandle.addEventListener("mousedown", handleImageResizeStart); resizeHandle.addEventListener("touchstart", handleImageResizeStart, { passive: true });
        container.appendChild(wrapper); setActiveElement(wrapper); nftStatusEl.textContent = "Image added."; nftStatusEl.className = 'success'; imageUpload.value = '';
    };
    reader.onerror = function(err) { console.error("FileReader error:", err); nftStatusEl.textContent = "Error reading image file."; nftStatusEl.className = 'error'; }
    reader.readAsDataURL(file);
}

function positionElementOnSign(element) {
     const currentPolygon = getPolygonForSelectedCollection();
     const minX = Math.min(...currentPolygon.map(p => p.x)); const maxX = Math.max(...currentPolygon.map(p => p.x));
     const minY = Math.min(...currentPolygon.map(p => p.y)); const maxY = Math.max(...currentPolygon.map(p => p.y));
     const signCenterX_canvas = (minX + maxX) / 2; const signCenterY_canvas = (minY + maxY) / 2;
     const contRect = container.getBoundingClientRect();
     if (!contRect || contRect.width === 0 || contRect.height === 0) {
         console.warn("Could not get container dimensions for positioning, using 50/50 fallback");
         element.style.left = '50%'; element.style.top = '50%';
     } else {
         const initialX_percent = (signCenterX_canvas / canvasWidth) * 100;
         const initialY_percent = (signCenterY_canvas / canvasHeight) * 100;
         element.style.left = `${initialX_percent}%`; element.style.top = `${initialY_percent}%`;
     }
}


// --- Active Element Management & Removal ---
function setActiveElement(el) {
    if (activeElement && activeElement !== el) { activeElement.classList.remove("active"); activeElement.style.zIndex = activeElement.classList.contains('imgOverlay') ? '20' : '10'; }
    if (el) {
        el.classList.add("active"); activeElement = el; el.style.zIndex = el.classList.contains('imgOverlay') ? '101' : '100';
        if (el.classList.contains('textOverlay')) {
            textInput.value = el.childNodes[0].nodeValue; textColor.value = rgb2hex(el.style.color || 'rgb(255, 255, 255)'); fontSize.value = parseInt(el.style.fontSize) || 15;
            const currentFont = el.style.fontFamily.split(',')[0].replace(/['"]/g, "").trim(); let foundFont = false;
            for (let option of fontFamily.options) { if (option.value.toLowerCase().includes(currentFont.toLowerCase())) { fontFamily.value = option.value; foundFont = true; break; } }
            if (!foundFont) fontFamily.value = 'Arial';
        }
    } else { activeElement = null; }
    updateControlState(); // Update buttons based on selection change
}

function removeActiveElement() {
    if (activeElement) { activeElement.remove(); setActiveElement(null); }
}


// --- Interaction Handlers (No Changes Needed) ---
function getEventCoordinates(event) { let x,y; if(event.touches&&event.touches.length>0){x=event.touches[0].clientX;y=event.touches[0].clientY;}else if(event.changedTouches&&event.changedTouches.length>0){x=event.changedTouches[0].clientX;y=event.changedTouches[0].clientY;}else{x=event.clientX;y=event.clientY;} return{x,y}; }
function handleTextDragStart(event) { if(event.target.classList.contains('rotation-handle'))return;const el=event.currentTarget;setActiveElement(el);textInteractionState.isDragging=true;textInteractionState.isRotating=false;el.style.cursor='grabbing';document.body.style.cursor='grabbing';const coords=getEventCoordinates(event);const contRect=container.getBoundingClientRect();textInteractionState.startX=coords.x-contRect.left;textInteractionState.startY=coords.y-contRect.top;textInteractionState.startLeft=el.offsetLeft;textInteractionState.startTop=el.offsetTop;document.addEventListener("mousemove",handleTextInteractionMove);document.addEventListener("mouseup",handleTextInteractionEnd);document.addEventListener("touchmove",handleTextInteractionMove,{passive:false});document.addEventListener("touchend",handleTextInteractionEnd);document.addEventListener("touchcancel",handleTextInteractionEnd);if(event.type==='mousedown')event.preventDefault();}
function handleTextRotateStart(event) { event.stopPropagation();const el=event.currentTarget.parentElement;setActiveElement(el);textInteractionState.isRotating=true;textInteractionState.isDragging=false;document.body.style.cursor='alias';const coords=getEventCoordinates(event);const rect=el.getBoundingClientRect();textInteractionState.rotateCenterX=rect.left+rect.width/2;textInteractionState.rotateCenterY=rect.top+rect.height/2;const dx=coords.x-textInteractionState.rotateCenterX;const dy=coords.y-textInteractionState.rotateCenterY;let startAngle=Math.atan2(dy,dx);const currentRotationRad=getRotationRad(el);textInteractionState.rotateStartAngle=startAngle-currentRotationRad;document.addEventListener("mousemove",handleTextInteractionMove);document.addEventListener("mouseup",handleTextInteractionEnd);document.addEventListener("touchmove",handleTextInteractionMove,{passive:false});document.addEventListener("touchend",handleTextInteractionEnd);document.addEventListener("touchcancel",handleTextInteractionEnd);if(event.type==='mousedown')event.preventDefault();}
function handleTextInteractionMove(event) { if(!activeElement||!activeElement.classList.contains('textOverlay')||(!textInteractionState.isDragging&&!textInteractionState.isRotating))return; if(event.type==='touchmove')event.preventDefault(); const coords=getEventCoordinates(event); const contRect=container.getBoundingClientRect(); if(textInteractionState.isDragging){const currentX=coords.x-contRect.left; const currentY=coords.y-contRect.top; let newLeftPx=textInteractionState.startLeft+(currentX-textInteractionState.startX); let newTopPx=textInteractionState.startTop+(currentY-textInteractionState.startY); newLeftPx=Math.max(0, Math.min(contRect.width - activeElement.offsetWidth, newLeftPx)); newTopPx=Math.max(0, Math.min(contRect.height - activeElement.offsetHeight, newTopPx)); const newLeftPercent=(newLeftPx/contRect.width)*100; const newTopPercent=(newTopPx/contRect.height)*100; activeElement.style.left=`${newLeftPercent}%`; activeElement.style.top=`${newTopPercent}%`;}else if(textInteractionState.isRotating){const dx=coords.x-textInteractionState.rotateCenterX; const dy=coords.y-textInteractionState.rotateCenterY; let angle=Math.atan2(dy,dx); let rotationRad=angle-textInteractionState.rotateStartAngle; let rotationDeg=rotationRad*(180/Math.PI); activeElement.style.transform=`translate(-50%, -50%) rotate(${rotationDeg}deg)`;}}
function handleTextInteractionEnd(event) { if(activeElement&&activeElement.classList.contains('textOverlay')){activeElement.style.cursor='grab';} document.body.style.cursor='default'; textInteractionState.isDragging=false; textInteractionState.isRotating=false; document.removeEventListener("mousemove",handleTextInteractionMove); document.removeEventListener("mouseup",handleTextInteractionEnd); document.removeEventListener("touchmove",handleTextInteractionMove); document.removeEventListener("touchend",handleTextInteractionEnd); document.removeEventListener("touchcancel",handleTextInteractionEnd); }
function handleImageDragStart(event) { if(event.target.classList.contains('rotation-handle')||event.target.classList.contains('resize-handle'))return;const el=event.currentTarget;setActiveElement(el);imageInteractionState.isDragging=true;imageInteractionState.isRotating=false;imageInteractionState.isResizing=false;el.style.cursor='grabbing';document.body.style.cursor='grabbing';const coords=getEventCoordinates(event);const contRect=container.getBoundingClientRect();imageInteractionState.startX=coords.x-contRect.left;imageInteractionState.startY=coords.y-contRect.top;imageInteractionState.startLeft=el.offsetLeft;imageInteractionState.startTop=el.offsetTop;document.addEventListener("mousemove",handleImageInteractionMove);document.addEventListener("mouseup",handleImageInteractionEnd);document.addEventListener("touchmove",handleImageInteractionMove,{passive:false});document.addEventListener("touchend",handleImageInteractionEnd);document.addEventListener("touchcancel",handleImageInteractionEnd);if(event.type==='mousedown')event.preventDefault();}
function handleImageRotateStart(event) { event.stopPropagation();const el=event.currentTarget.parentElement;setActiveElement(el);imageInteractionState.isRotating=true;imageInteractionState.isDragging=false;imageInteractionState.isResizing=false;document.body.style.cursor='alias';const coords=getEventCoordinates(event);const rect=el.getBoundingClientRect();imageInteractionState.centerX=rect.left+rect.width/2;imageInteractionState.centerY=rect.top+rect.height/2;const dx=coords.x-imageInteractionState.centerX;const dy=coords.y-imageInteractionState.centerY;let startAngle=Math.atan2(dy,dx);imageInteractionState.currentRotationRad=getRotationRad(el);imageInteractionState.startAngle=startAngle-imageInteractionState.currentRotationRad;document.addEventListener("mousemove",handleImageInteractionMove);document.addEventListener("mouseup",handleImageInteractionEnd);document.addEventListener("touchmove",handleImageInteractionMove,{passive:false});document.addEventListener("touchend",handleImageInteractionEnd);document.addEventListener("touchcancel",handleImageInteractionEnd);if(event.type==='mousedown')event.preventDefault();}
function handleImageResizeStart(event) { event.stopPropagation();const el=event.currentTarget.parentElement;setActiveElement(el);imageInteractionState.isResizing=true;imageInteractionState.isRotating=false;imageInteractionState.isDragging=false;document.body.style.cursor='nesw-resize'; const coords=getEventCoordinates(event);imageInteractionState.startX=coords.x;imageInteractionState.startY=coords.y;imageInteractionState.startWidth=el.offsetWidth;imageInteractionState.startHeight=el.offsetHeight;imageInteractionState.aspectRatio=imageInteractionState.startHeight>0?imageInteractionState.startWidth/imageInteractionState.startHeight:1;imageInteractionState.currentRotationRad=getRotationRad(el);const rect=el.getBoundingClientRect();imageInteractionState.centerX=rect.left+rect.width/2;imageInteractionState.centerY=rect.top+rect.height/2;document.addEventListener("mousemove",handleImageInteractionMove);document.addEventListener("mouseup",handleImageInteractionEnd);document.addEventListener("touchmove",handleImageInteractionMove,{passive:false});document.addEventListener("touchend",handleImageInteractionEnd);document.addEventListener("touchcancel",handleImageInteractionEnd);if(event.type==='mousedown')event.preventDefault();}
function handleImageInteractionMove(event) { if(!activeElement||!activeElement.classList.contains('imgOverlay')||(!imageInteractionState.isDragging&&!imageInteractionState.isRotating&&!imageInteractionState.isResizing))return; if(event.type==='touchmove')event.preventDefault(); const coords=getEventCoordinates(event); const contRect=container.getBoundingClientRect(); if(imageInteractionState.isDragging){ const currentX=coords.x-contRect.left; const currentY=coords.y-contRect.top; let newLeftPx=imageInteractionState.startLeft+(currentX-imageInteractionState.startX); let newTopPx=imageInteractionState.startTop+(currentY-imageInteractionState.startY); newLeftPx=Math.max(0, Math.min(contRect.width - activeElement.offsetWidth, newLeftPx)); newTopPx=Math.max(0, Math.min(contRect.height - activeElement.offsetHeight, newTopPx)); const newLeftPercent=(newLeftPx/contRect.width)*100; const newTopPercent=(newTopPx/contRect.height)*100; activeElement.style.left=`${newLeftPercent}%`; activeElement.style.top=`${newTopPercent}%`; } else if(imageInteractionState.isRotating){ const dx=coords.x-imageInteractionState.centerX; const dy=coords.y-imageInteractionState.centerY; let angle=Math.atan2(dy,dx); let rotationRad=angle-imageInteractionState.startAngle; let rotationDeg=rotationRad*(180/Math.PI); activeElement.style.transform=`translate(-50%, -50%) rotate(${rotationDeg}deg)`; } else if(imageInteractionState.isResizing){ const dx=coords.x-imageInteractionState.startX; const dy=coords.y-imageInteractionState.startY; const rotation=imageInteractionState.currentRotationRad; const cosR=Math.cos(rotation); const sinR=Math.sin(rotation); const rotatedDx = dx * cosR + dy * sinR; const diagonalDelta = rotatedDx; let newWidth = imageInteractionState.startWidth + diagonalDelta; newWidth = Math.max(20, newWidth); let newHeight = imageInteractionState.aspectRatio>0?newWidth/imageInteractionState.aspectRatio:newWidth; activeElement.style.width=`${newWidth}px`; activeElement.style.height=`${newHeight}px`; }}
function handleImageInteractionEnd(event) { if(activeElement&&activeElement.classList.contains('imgOverlay')){activeElement.style.cursor='grab';} document.body.style.cursor='default'; imageInteractionState.isDragging=false; imageInteractionState.isRotating=false; imageInteractionState.isResizing=false; document.removeEventListener("mousemove",handleImageInteractionMove); document.removeEventListener("mouseup",handleImageInteractionEnd); document.removeEventListener("touchmove",handleImageInteractionMove); document.removeEventListener("touchend",handleImageInteractionEnd); document.removeEventListener("touchcancel",handleImageInteractionEnd); }


// --- Utility Functions (No Changes Needed) ---
function calculateElementPosition(percentX, percentY){ const contRect=container.getBoundingClientRect();if(!contRect||contRect.width===0||contRect.height===0)return{x:0,y:0}; const pixelX=contRect.width*(percentX/100); const pixelY=contRect.height*(percentY/100); return{x:pixelX,y:pixelY}; }
function getCanvasCoordsFromContainerPoint(containerX_px, containerY_px){ const contRect=container.getBoundingClientRect();if(!contRect||contRect.width===0||contRect.height===0)return{canvasX:0,canvasY:0}; const scaleX=canvasWidth/contRect.width; const scaleY=canvasHeight/contRect.height; return{canvasX:containerX_px*scaleX,canvasY:containerY_px*scaleY}; } // Corrected scale calculation
function pointInPolygon(point, vs){ const x=point.x,y=point.y;let inside=false;for(let i=0,j=vs.length-1;i<vs.length;j=i++){const xi=vs[i].x,yi=vs[i].y;const xj=vs[j].x,yj=vs[j].y;const intersect=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi);if(intersect)inside=!inside;}return inside;}
function rgb2hex(rgb){ if(!rgb)return'#ffffff';if(rgb.startsWith('#'))return rgb; const rgbMatch=rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/); if(rgbMatch){return"#"+rgbMatch.slice(1).map(x=>parseInt(x).toString(16).padStart(2,'0')).join('');} const rgbaMatch = rgb.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/); if (rgbaMatch) { return "#" + rgbaMatch.slice(1, 4).map(x => parseInt(x).toString(16).padStart(2, '0')).join('');} console.warn("Could not convert RGB/RGBA to hex:", rgb); return '#ffffff'; }
function getRotationRad(element){ if(!element||!element.style||!element.style.transform)return 0; const transform=element.style.transform; const rotateMatch=transform.match(/rotate\((-?\d+(\.\d+)?)deg\)/); const rotationDeg=rotateMatch?parseFloat(rotateMatch[1]):0; return rotationDeg*(Math.PI/180); }


// --- DISCLAIMER Functions ---
function showComicDisclaimer() { if (disclaimerModal) disclaimerModal.classList.add('visible'); }
function hideComicDisclaimer() { if (disclaimerModal) disclaimerModal.classList.remove('visible'); }


// --- Drawing Overlays onto Canvas Helper ---
function drawOverlaysToCanvas(targetCtx, targetCanvasWidth, targetCanvasHeight) {
     const canvasRect = canvas.getBoundingClientRect();
     if (!canvasRect || canvasRect.width === 0 || canvasRect.height === 0) { console.error("Cannot draw overlays: Invalid canvas dimensions."); return false; }
     const scaleX = targetCanvasWidth / canvasRect.width;
     const scaleY = targetCanvasHeight / canvasRect.height;
     const allOverlays = Array.from(container.querySelectorAll(".textOverlay, .imgOverlay"));
     allOverlays.sort((a, b) => (parseInt(window.getComputedStyle(a).zIndex) || 0) - (parseInt(window.getComputedStyle(b).zIndex) || 0));
     allOverlays.forEach(el => {
         const elRect = el.getBoundingClientRect();
         const elCenterX_viewport = elRect.left + elRect.width / 2; const elCenterY_viewport = elRect.top + elRect.height / 2;
         const relativeCenterX = elCenterX_viewport - canvasRect.left; const relativeCenterY = elCenterY_viewport - canvasRect.top;
         const canvasX = Math.round(relativeCenterX * scaleX); const canvasY = Math.round(relativeCenterY * scaleY);
         const rotationRad = getRotationRad(el);
         targetCtx.save(); targetCtx.translate(canvasX, canvasY); targetCtx.rotate(rotationRad);
         if(el.classList.contains('textOverlay')){
             const text=el.childNodes[0].nodeValue; const color=el.style.color; const size=parseInt(el.style.fontSize); const font=el.style.fontFamily;
             const canvasFontSize = Math.round(size * scaleY); // Use scaleY for font scaling
             targetCtx.font=`${canvasFontSize}px ${font}`; targetCtx.fillStyle=color; targetCtx.textAlign="center"; targetCtx.textBaseline="middle"; targetCtx.fillText(text, 0, 0);
         } else if(el.classList.contains('imgOverlay')){
             const imgElement=el.querySelector('img');
             if(imgElement&&imgElement.complete&&imgElement.naturalWidth>0){
                  const canvasDrawWidth = Math.round(el.offsetWidth * scaleX);
                  const canvasDrawHeight = Math.round(el.offsetHeight * scaleY); // Use element's actual displayed size for scaling
                  if (canvasDrawWidth > 0 && canvasDrawHeight > 0) { targetCtx.drawImage(imgElement, -canvasDrawWidth / 2, -canvasDrawHeight / 2, canvasDrawWidth, canvasDrawHeight); }
             } else { console.warn("Skipping unloaded/invalid image overlay during draw:", imgElement?.src); }
         }
         targetCtx.restore();
     });
     return true;
 }


// --- Save Full Image Locally ---
function saveFullImageLocally() {
    const currentNftId = nftTokenIdInput.value || 'unknown';
    const currentCollection = nftCollectionSelect.value || 'unknown';
    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { alert("Load a valid NFT first!"); nftStatusEl.className = 'error'; nftStatusEl.textContent = "NFT not loaded for save."; return; }

    nftStatusEl.textContent = `Generating full image...`; nftStatusEl.className = '';
    if (activeElement) activeElement.classList.remove('active');
    drawBaseImage(); drawSignPolygonOnly();
    const overlaysDrawn = drawOverlaysToCanvas(ctx, canvasWidth, canvasHeight);
    if (activeElement) activeElement.classList.add('active');

    if (!overlaysDrawn) { alert("Error drawing overlays. Cannot save."); nftStatusEl.textContent = "Save Error: Overlay draw failed."; nftStatusEl.className = 'error'; applyOverlay(); return; }

    try {
        const dataURL = canvas.toDataURL("image/png"); const link = document.createElement("a"); const filename = `signed-${currentCollection}-${currentNftId}.png`;
        link.download = filename; link.href = dataURL; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        nftStatusEl.textContent = `Full image saved as ${filename}!`; nftStatusEl.className = 'success';
    } catch (e) {
        console.error("Error saving full image:", e);
        if (e.name === "SecurityError") { alert("Save Error: Cross-origin issue."); nftStatusEl.textContent = "Save Error: Cross-origin."; }
        else { alert("Error saving full image."); nftStatusEl.textContent = "Save Error."; }
        nftStatusEl.className = 'error'; applyOverlay(); drawOverlaysToCanvas(ctx, canvasWidth, canvasHeight); if (activeElement) activeElement.classList.add('active');
    }
}


// --- Upload Sign Only to Supabase Gallery ---
async function uploadSignToGallery() {
    // --- AUTH Check ---
    if (!currentUser) {
        alert("Please connect with X first to upload your sign to the gallery.");
        nftStatusEl.textContent = "Authentication required for upload."; nftStatusEl.className = 'error';
        const connectBtn = document.getElementById('connectXBtn'); if (connectBtn) connectBtn.focus();
        return;
    }
    if (!supabase) { alert("Error: Cannot upload. Connection to the gallery service failed."); nftStatusEl.textContent = "Upload Error: No gallery connection."; nftStatusEl.className = 'error'; return; }

    const currentNftId = nftTokenIdInput.value || 'unknown';
    const currentCollection = nftCollectionSelect.value || 'unknown';
    const signColor = overlayColorInput.value;

    if (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0) { alert("Load a valid NFT first."); nftStatusEl.className = 'error'; nftStatusEl.textContent = "NFT not loaded for upload."; return; }
    if (!signColor) { alert("Apply a sign color first."); nftStatusEl.className = 'error'; nftStatusEl.textContent = "No sign color applied."; return; }

    nftStatusEl.textContent = `Generating sign image for upload...`; nftStatusEl.className = '';
    // Disable button *immediately*
    if(uploadSignBtn) uploadSignBtn.disabled = true;
    updateControlState(); // Reflect busy state

    if (activeElement) activeElement.classList.remove('active');

    // --- Create Sign Image on Canvas ---
    ctx.clearRect(0, 0, canvasWidth, canvasHeight); // Clear to TRANSPARENT
    drawSignPolygonOnly();
    const overlaysDrawn = drawOverlaysToCanvas(ctx, canvasWidth, canvasHeight);

    // --- Function to Redraw the user's view ---
     const redrawFullView = () => {
          if (baseImage.src && baseImage.complete) {
              applyOverlay(); // Redraw NFT + sign color
              drawOverlaysToCanvas(ctx, canvasWidth, canvasHeight); // Redraw overlays on top
          } else {
              clearCanvas(); // Or just clear if base image somehow got lost
          }
           if (activeElement) activeElement.classList.add('active'); // Restore outline if exists
           updateControlState(); // Re-evaluate all button states (including upload)
     };

    if (!overlaysDrawn) {
         alert("Error drawing overlays onto the canvas. Cannot upload sign.");
         nftStatusEl.textContent = "Upload Error: Overlay draw failed."; nftStatusEl.className = 'error';
         redrawFullView(); // Redraw original view even on failure
         return;
    }

    // --- Convert Canvas to Blob ---
    canvas.toBlob(async (blob) => {
        if (!blob) {
            console.error("Failed to create blob from canvas."); alert("Error creating image data for upload.");
            nftStatusEl.textContent = "Upload Error: Blob creation failed."; nftStatusEl.className = 'error';
            redrawFullView(); return;
        }

        // --- Perform Supabase Upload ---
        const timestamp = Date.now();
        const userId = currentUser.id;
        const userHandle = currentUser.user_metadata?.user_name || currentUser.user_metadata?.screen_name || 'unknown_user';
        const fileName = `sign-${currentCollection}-${currentNftId}-${userHandle}-${timestamp}.png`;
        const filePath = `${currentCollection}/${userId}/${fileName}`; // User-specific folder

        nftStatusEl.textContent = `Uploading sign as @${userHandle}...`; nftStatusEl.className = '';
        updateControlState(); // Keep buttons disabled during upload

        try {
            const { data, error } = await supabase.storage
                .from(SUPABASE_BUCKET_NAME)
                .upload(filePath, blob, { contentType: 'image/png', upsert: false });

            if (error) throw error; // Throw to catch block

            if (data) {
                console.log("Supabase upload successful:", data);
                nftStatusEl.textContent = `Sign uploaded successfully! (${fileName})`;
                nftStatusEl.className = 'success';

                // --- Optional: Save metadata to 'signs' table ---
                // try {
                //     const { error: dbError } = await supabase.from('signs').insert({
                //         user_id: userId, storage_path: data.path, nft_collection: currentCollection,
                //         nft_token_id: currentNftId, user_x_handle: userHandle });
                //     if (dbError) throw new Error(`DB Insert Error: ${dbError.message}`);
                //     console.log("Sign metadata saved to database.");
                // } catch(dbInsertError) {
                //     console.error("Error saving sign metadata to DB:", dbInsertError);
                //     nftStatusEl.textContent += " (DB meta save failed)"; nftStatusEl.className = 'warning';
                // }
                // --- End Optional DB Insert ---

            } else {
                 throw new Error("Upload completed without error, but no data returned.");
            }

        } catch (error) {
            console.error("Supabase upload error:", error);
            let errorMsg = "Upload Error: Failed to upload sign.";
             if (error.message?.includes('bucket not found')) { errorMsg = `Upload Error: Bucket '${SUPABASE_BUCKET_NAME}' not found.`; }
             else if (error.message?.includes('mime type')) { errorMsg = "Upload Error: Invalid image format."; }
             else if (error.message?.includes('Auth') || error.message?.includes('authorized') || error.message?.includes('policy') || error.message?.includes('RLS')) { errorMsg = "Upload Error: Not authorized (Check Bucket Policies/RLS). Are you connected?"; }
             else if (error.code === 'PGRST116') { errorMsg = "Upload Error: Database Table/Schema issue?"; }
             else if (error.message?.includes('unique constraint')) { errorMsg = "Upload Error: Duplicate entry."; }

            alert(errorMsg + " Check console for details.");
            nftStatusEl.textContent = errorMsg; nftStatusEl.className = 'error';
        } finally {
             // --- ALWAYS Redraw full view and update controls ---
             redrawFullView();
        }

    }, 'image/png');

} // End uploadSignToGallery function