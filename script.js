/* ======================================== */
/* JavaScript Logic (External V8.3 - Interactive) */
/* ... Loads signs.json, Includes Coffee, Color, Text */
/* ======================================== */

(function() {
    'use strict';
    console.log("SignOMatic Script V8.3 Interactive Initializing...");

    // --- DOM Element Selections ---
    const statusMessage = document.getElementById('statusMessage');
    const errorMessage = document.getElementById('errorMessage');
    const previewCanvas = document.getElementById('previewCanvas');
    const finalCanvas = document.getElementById('finalCanvas');
    const categoryRadios = document.querySelectorAll('input[name="category"]');
    const tokenIdInput = document.getElementById('tokenIdInput');
    const loadNftButton = document.getElementById('loadNftButton');
    const signSelector = document.getElementById('signSelector');
    const generateButton = document.getElementById('generateButton');
    const loader = document.getElementById('loader');
    const shareModalOverlay = document.getElementById('shareModalOverlay');
    const shareModal = document.getElementById('shareModal');
    const closeShareModalButton = document.getElementById('closeShareModal');
    const twitterShareButton = document.getElementById('twitterShareButton');
    const shareSubMessage = document.getElementById('shareSubMessage');
    const coffeeButton = document.getElementById('coffeeButton');
    const coffeeOptions = document.getElementById('coffeeOptions');
    const copyButtons = document.querySelectorAll('.copy-button');
    const tokenIdInputContainer = document.getElementById('tokenIdInputContainer');
    const previewArea = document.getElementById('previewArea');
    const signSection = document.getElementById('signSection');
    const signPrompt = document.getElementById('signPrompt');
    // --- NEW Elements from text4.txt ---
    const textColorSelectorContainer = document.getElementById('textColorSelectorContainer');
    const textColorRadios = document.querySelectorAll('input[name="textColor"]');
    const textColorPrompt = document.getElementById('textColorPrompt');
    const textOverlayContainer = document.getElementById('textOverlayContainer');
    const interactiveText = document.getElementById('interactiveText');
    const textInput = document.getElementById('textInput');
    const addTextButton = document.getElementById('addTextButton');
    const removeTextButton = document.getElementById('removeTextButton');
    const textInputSection = document.getElementById('textInputSection');

     // Basic element check (Updated with new elements)
     const essentialElements = [
        statusMessage, errorMessage, previewCanvas, finalCanvas, categoryRadios,
        tokenIdInput, loadNftButton, signSelector, generateButton, loader,
        shareModalOverlay, shareModal, closeShareModalButton, twitterShareButton,
        shareSubMessage, coffeeButton, coffeeOptions, copyButtons, tokenIdInputContainer,
        previewArea, signSection, signPrompt, textColorSelectorContainer, textColorRadios,
        textColorPrompt, textOverlayContainer, interactiveText, textInput, addTextButton,
        removeTextButton, textInputSection
     ];
     let missingElement = false;
     const nameMap = [ // Map indices to names for better error messages
        "statusMessage", "errorMessage", "previewCanvas", "finalCanvas", "categoryRadios",
        "tokenIdInput", "loadNftButton", "signSelector", "generateButton", "loader",
        "shareModalOverlay", "shareModal", "closeShareModalButton", "twitterShareButton",
        "shareSubMessage", "coffeeButton", "coffeeOptions", "copyButtons", "tokenIdInputContainer",
        "previewArea", "signSection", "signPrompt", "textColorSelectorContainer", "textColorRadios",
        "textColorPrompt", "textOverlayContainer", "interactiveText", "textInput", "addTextButton",
        "removeTextButton", "textInputSection"
     ];
     essentialElements.forEach((el, index) => {
         const elName = nameMap[index] || `Element ${index}`;
         if (!el && !(el instanceof NodeList)) {
             console.error(`CRITICAL ERROR: Essential DOM element '${elName}' (ID: ${elName}) is missing!`);
             missingElement = true;
         } else if (el instanceof NodeList && el.length === 0 && (elName === 'categoryRadios' || elName === 'copyButtons' || elName === 'textColorRadios')) {
             console.warn(`Warning: NodeList for '${elName}' is empty.`);
         } else if (el instanceof NodeList && el.length === 0 && !['categoryRadios', 'copyButtons', 'textColorRadios'].includes(elName)) {
            // Error for empty NodeLists that are expected to have items (e.g., if no color radios were defined)
            console.error(`CRITICAL ERROR: Expected NodeList for '${elName}' but it's empty!`);
             missingElement = true;
         }
     });
     if (missingElement && errorMessage) { errorMessage.textContent = "CRITICAL UI ERROR! Refresh page or contact admin."; errorMessage.classList.remove('hidden'); }


    // --- Contexts ---
    const previewCtx = previewCanvas ? previewCanvas.getContext('2d') : null;
    const finalCtx = finalCanvas ? finalCanvas.getContext('2d', { willReadFrequently: true }) : null; // Added hint
     if(!previewCtx || !finalCtx) console.error("ERROR: Failed to get canvas contexts!");

    // --- Constants and State ---
    const FINAL_CANVAS_SIZE = 2048; // Already present
    const SHARE_MODAL_DELAY = 1000; // Already present
    const SIGNS_CONFIG_PATH = 'signs.json'; // Already present
    let currentCategory = null; // Already present
    let loadedNftImage = null; // Already present
    let isProcessing = false; // Already present
    let signData = {}; // Already present
    let currentSignUrl = null; // Already present
    // --- NEW State from text4.txt ---
    let currentSignImage = null; // Store the loaded sign image object
    let selectedSignColor = '#FFFFFF'; // Default sign color (white)
    let currentTextState = {
        content: "",
        x: 0, // Position relative to overlay container top-left
        y: 0,
        rotation: 0, // in degrees
        scale: 1,    // Not implemented in drag, but kept for future
        visible: false,
        color: '#FFFFFF', // Default text element color (can be different from sign color)
        font: "20px 'Luckiest Guy', cursive" // Default font (sync with CSS)
    };

    // --- Blockchain & Contract Info --- (Keep as is)
    const GHN_CONTRACT = "0xe6d48bf4ee912235398b96e16db6f310c21e82cb";
    const AHC_CONTRACT = "0x9370045ce37f381500ac7d6802513bb89871e076";
    const ABI = ["function tokenURI(uint256 tokenId) public view returns (string)"];
    let provider;

    // --- Funny Quips & SubMessages --- (Keep as is, added color quips)
    const funnyQuips = ["Pick a sign...", "Choose wisely...", "Overlay this garbage...", "Make it pretty...", "Slap something on!"];
    const colorQuips = ["Color time!", "Make it pop!", "Contrast is key!", "Choose a hue!", "Sign color magic!"]; // Added
    const comicSubMessages = ["Go show off, you magnificent creature!", "Don't let memes be dreams!", "Warning: May cause coolness.", "Your NFT got schwifty!", "Freshly signed!", "Lookin' sharp!"];

    // --- Fetch and Process Sign Config from JSON --- (Keep as is)
    async function loadAndProcessSignConfig() {
        console.log(`Fetching sign config from ${SIGNS_CONFIG_PATH}...`);
        try {
            const response = await fetch(SIGNS_CONFIG_PATH);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const cfg = await response.json();
             console.log("Fetched config:", cfg);

            if (!cfg?.githubUser || !cfg?.githubRepo || !cfg?.githubBranch || !cfg?.imageBasePath || !cfg?.categories) {
                throw new Error("Invalid Config structure in signs.json");
            }

            const base = `https://raw.githubusercontent.com/${cfg.githubUser}/${cfg.githubRepo}/${cfg.githubBranch}/${cfg.imageBasePath}`;
            signData = {}; // Reset signData

            for (const cat in cfg.categories) {
                if (Array.isArray(cfg.categories[cat])) {
                    signData[cat] = cfg.categories[cat]
                        .map(s => (s.name && s.fileName) ? { name: s.name, url: `${base}/${cat}/${s.fileName}` } : null)
                        .filter(s => s); // Filter out any null entries from invalid config items
                }
            }
            console.log("Processed signData:", signData);
            if (Object.keys(signData).length === 0) {
                 console.warn("No valid categories found in sign config.");
            }
            return true;
        } catch (e) {
            console.error("Config loading/processing error:", e);
            showError(`Sign config error: ${e.message}`);
            if (signSelector) signSelector.disabled = true;
            return false;
        }
    }


    // Initialize Ethers provider safely (Keep as is)
    function initializeProvider() {
        console.log("Initializing provider...");
        try {
            if (typeof ethers === 'undefined') {
                throw new Error("Ethers.js library is missing!");
            }
            if (window.ethereum) {
                provider = new ethers.BrowserProvider(window.ethereum);
                console.log("Using BrowserProvider (MetaMask or similar)");
            } else {
                provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com");
                console.log("Using public JSON-RPC provider (read-only)");
            }
            return true;
        } catch (e) {
            console.error("Provider initialization failed:", e);
            showError(`Ethereum connection error: ${e.message}. Wallet might be needed for some operations.`);
            return false;
        }
    }


    // ==================================
    //        MODAL FUNCTIONS (Keep as is)
    // ==================================
     function showShareModal() {
         console.log("Showing Share Modal");
         if (!shareModal || !shareModalOverlay || !twitterShareButton || !shareSubMessage || !coffeeOptions) {
             console.error("Share modal elements missing!");
             return;
         }
         // Construct tweet text (already updated)
         const tweetText = `Just generated my sign with Sign-O-Matic by @ticu_v at https://signs.ticuv.art! Check it out!`;
         const associatedUrl = "https://signs.ticuv.art";
         const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(associatedUrl)}`;

         twitterShareButton.href = twitterUrl;
         const randomSubIndex = Math.floor(Math.random() * comicSubMessages.length);
         shareSubMessage.innerText = comicSubMessages[randomSubIndex];
         coffeeOptions.style.display = 'none'; // Hide coffee options initially
         shareModalOverlay.classList.remove('hidden');
         shareModal.classList.remove('hidden');
         document.body.style.overflow = 'hidden'; // Prevent background scrolling
     }

     function hideShareModal() {
         console.log("Hiding Share Modal");
         if (!shareModal || !shareModalOverlay) return;
         shareModalOverlay.classList.add('hidden');
         shareModal.classList.add('hidden');
         document.body.style.overflow = ''; // Restore background scrolling
     }

    // ==================================
    //        EVENT LISTENERS (Add new ones)
    // ==================================
    function addEventListeners() {
         console.log("Adding event listeners...");
         if (loadNftButton) loadNftButton.addEventListener('click', handleLoadNftClick);
         if (signSelector) signSelector.addEventListener('change', handleSignChange);
         if (categoryRadios) categoryRadios.forEach(radio => radio.addEventListener('change', handleCategoryChange));
         if (generateButton) generateButton.addEventListener('click', handleGenerateClick);
         if (closeShareModalButton) closeShareModalButton.addEventListener('click', hideShareModal);
         if (shareModalOverlay) shareModalOverlay.addEventListener('click', (event) => {
             if (event.target === shareModalOverlay) hideShareModal();
         });
         if (coffeeButton) {
             coffeeButton.addEventListener('click', () => {
                 if (coffeeOptions) coffeeOptions.style.display = coffeeOptions.style.display === 'none' ? 'block' : 'none';
             });
         }
         // --- NEW Event Listeners ---
         if (textColorRadios) textColorRadios.forEach(radio => radio.addEventListener('change', handleSignColorChange));
         if (addTextButton) addTextButton.addEventListener('click', handleAddOrUpdateText);
         if (removeTextButton) removeTextButton.addEventListener('click', handleRemoveText);
         // Basic Drag Implementation for Text
         if (interactiveText) {
             interactiveText.addEventListener('mousedown', startDrag);
             interactiveText.addEventListener('touchstart', startDrag, { passive: false }); // Add touch support
         }
         // --- END NEW ---

         // Initialize Clipboard.js (Keep as is)
         try {
            if (typeof ClipboardJS !== 'undefined' && copyButtons && copyButtons.length > 0) {
                console.log("Initializing ClipboardJS...");
                const clipboard = new ClipboardJS('.copy-button');
                clipboard.on('success', function(e) {
                    console.log('Copied:', e.text);
                    e.trigger.textContent = 'Copied!';
                    e.trigger.classList.add('copied');
                    setTimeout(() => {
                        e.trigger.textContent = 'Copy';
                        e.trigger.classList.remove('copied');
                    }, 1500);
                    e.clearSelection();
                });
                clipboard.on('error', function(e) {
                    console.error('Copy failed:', e.action);
                    e.trigger.textContent = 'Error';
                    setTimeout(() => { e.trigger.textContent = 'Copy'; }, 1500);
                });
            } else if (copyButtons && copyButtons.length > 0) {
                console.warn("ClipboardJS library not found or no copy buttons. Attaching fallback alert.");
                copyButtons.forEach(button => button.addEventListener('click', () => alert('Copy failed. Please copy manually.')));
            }
         } catch (clipboardError) {
             console.error("Error initializing ClipboardJS:", clipboardError);
             if (copyButtons && copyButtons.length > 0) {
                  copyButtons.forEach(button => button.addEventListener('click', () => alert('Copy functionality error. Please copy manually.')));
             }
         }
         console.log("Event listeners setup complete.");
    }

    // ==================================
    //  NEW: TEXT INTERACTION FUNCTIONS (Copied from text4.txt)
    // ==================================
    let isDragging = false;
    let startX, startY, initialX, initialY;

    function getEventCoords(e) {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    function startDrag(e) {
        if (!currentTextState.visible || !interactiveText || isProcessing) return; // Also check processing state
        if (e.type === 'touchstart') {
            e.preventDefault(); // Prevent page scroll on touch drag
        }
        isDragging = true;
        const coords = getEventCoords(e);
        startX = coords.x;
        startY = coords.y;
        // Get position relative to the parent overlay container
        initialX = interactiveText.offsetLeft;
        initialY = interactiveText.offsetTop;

        interactiveText.style.cursor = 'grabbing';
        interactiveText.style.transition = 'none'; // Disable transition during drag

        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', drag, { passive: false }); // Ensure touchmove prevents scroll
        document.addEventListener('touchend', stopDrag);
        document.addEventListener('touchcancel', stopDrag);
        console.log("Start drag:", initialX, initialY);
    }

    function drag(e) {
        if (!isDragging) return;
        if (e.type === 'touchmove') {
            e.preventDefault(); // Prevent page scroll on touch drag
        }
        const coords = getEventCoords(e);
        const currentX = coords.x - startX;
        const currentY = coords.y - startY;
        let newX = initialX + currentX;
        let newY = initialY + currentY;

        // --- Optional: Boundary Constraints ---
        // const overlayRect = textOverlayContainer.getBoundingClientRect();
        // const textRect = interactiveText.getBoundingClientRect(); // Get current size
        // newX = Math.max(0, Math.min(newX, overlayRect.width - textRect.width));
        // newY = Math.max(0, Math.min(newY, overlayRect.height - textRect.height));
        // --- End Boundary Constraints ---


        // Update element style directly for responsiveness
        interactiveText.style.left = `${newX}px`;
        interactiveText.style.top = `${newY}px`;
        // We are not using transform for positioning here, only for initial centering/rotation/scale if implemented
        // interactiveText.style.transform = `translate(-50%, -50%) rotate(${currentTextState.rotation}deg) scale(${currentTextState.scale})`; // Keep this if you center with transform
    }

    function stopDrag(e) {
        if (!isDragging) return;
        isDragging = false;
        interactiveText.style.cursor = 'move';
        interactiveText.style.transition = ''; // Re-enable transitions if any

        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('touchend', stopDrag);
        document.removeEventListener('touchcancel', stopDrag);

        // Save the final position state (top-left relative to container)
        currentTextState.x = interactiveText.offsetLeft;
        currentTextState.y = interactiveText.offsetTop;
        // TODO: Update rotation and scale state if implementing those interactions
        console.log("Drag end. Saved state (top, left):", currentTextState.y, currentTextState.x);
    }
    // --- END TEXT INTERACTION ---

    // ==================================
    //        CORE FUNCTIONS (Modifications required)
    // ==================================
    function handleCategoryChange(event) { // Modified to reset new elements
        console.log("Category changed:", event?.target?.value);
        if (!event?.target || isProcessing) return;
        currentCategory = event.target.value;
        updateStatus(`Selected ${currentCategory}. Enter Token ID...`);
        if(tokenIdInput){
            tokenIdInput.value='';
            tokenIdInput.placeholder = currentCategory === 'GHN' ? 'e.g., 1114' : 'e.g., 11862';
            tokenIdInput.disabled = false;
        }
        if(tokenIdInputContainer) tokenIdInputContainer.classList.remove('hidden');
        if(loadNftButton){
            loadNftButton.classList.remove('disabled');
            loadNftButton.disabled = false;
        }
        // Hide subsequent sections
        if(previewArea) previewArea.classList.add('hidden');
        if(signSection) signSection.classList.add('hidden');
        if(textColorSelectorContainer) textColorSelectorContainer.classList.add('hidden'); // Hide color
        if(textInputSection) hideTextInputSection(); // Hide text
        if(generateButton) generateButton.classList.add('hidden', 'disabled');
        if(previewCtx) clearCanvas(previewCtx);
        if(finalCtx) clearCanvas(finalCtx);
        loadedNftImage = null;
        currentSignImage = null; // Reset loaded sign image
        hideError();
        if(signSelector) signSelector.disabled = true;
        currentSignUrl = null;
        resetSignColorSelection(); // Reset color selection
        removeTextMask(); // Remove any existing CSS mask
    }

    function handleLoadNftClick() { // Keep as is
        console.log("Load NFT button clicked");
        if (!tokenIdInput) return;
        const id = tokenIdInput.value.trim();
        if (!id || !/^\d+$/.test(id)) {
            showError("Please enter a valid numeric Token ID."); return;
        }
        if (!currentCategory) {
            showError("Wubba lubba dub dub! Select a dimension first!"); return;
        }
        if (isProcessing || !provider) {
             showError(isProcessing ? "Hold your horses, still processing!" : "Ethereum connection failed. Check console."); return;
        }
        loadAndDisplayNft(id, currentCategory);
    }

    async function loadAndDisplayNft(tokenId, category) { // Modified to reset new elements on load
        console.log(`Loading NFT #${tokenId} from category ${category}`);
        if (!provider) { showError("Ethereum provider not initialized."); return; }
        setProcessing(true);
        showLoader();
        hideError();
        updateStatus(`Accessing the ${category} dimension for #${tokenId}...`);
        disableGenerateButton("Loading NFT...");
        if (previewArea) previewArea.classList.add('hidden');
        if (signSection) signSection.classList.add('hidden');
        if (textColorSelectorContainer) textColorSelectorContainer.classList.add('hidden'); // Hide color
        if (textInputSection) hideTextInputSection(); // Hide text
        removeTextMask(); // Remove mask
        if (signSelector) signSelector.disabled = true;

        const contractAddress = category === 'GHN' ? GHN_CONTRACT : AHC_CONTRACT;
        const contract = new ethers.Contract(contractAddress, ABI, provider);

        try {
            updateStatus("Attempting to fetch token URI...");
            let tokenUri = await contract.tokenURI(tokenId);
            tokenUri = resolveIpfsUrl(tokenUri);
            if (!tokenUri) throw new Error("Token URI is missing or invalid.");
            console.log("Resolved Token URI:", tokenUri.substring(0, 100) + "...");

            updateStatus("Fetching NFT metadata...");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort("Metadata fetch timeout"), 15000);
            const response = await fetch(tokenUri, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
            const metadata = await response.json();
            console.log("Metadata fetched successfully");

            let imageUrl = resolveIpfsUrl(metadata.image || metadata.image_url || metadata.imageUrl);
            if (!imageUrl) throw new Error("Image URL not found in metadata.");
            console.log("Resolved Image URL:", imageUrl.substring(0, 100) + "...");

            updateStatus("Loading NFT image...");
            const img = await loadImagePromise(imageUrl, "anonymous");
            loadedNftImage = img; // Store the loaded image

            updateStatus(`NFT #${tokenId} loaded! Now pick a sign overlay.`, true);
            if (previewCtx) drawScaledImage(previewCtx, loadedNftImage); // Draw preview (base image only for now)
            if (previewArea) previewArea.classList.remove('hidden');

            if (signData[category] && signData[category].length > 0) {
                populateSignSelector(category); // Populates selector, hides color/text, resets mask
                updateSignPrompt();
                if (signSection) signSection.classList.remove('hidden');
            } else {
                showError(`Aw jeez! No signs configured for the ${category} category.`);
                if (signSection) signSection.classList.add('hidden');
            }
            disableGenerateButton("Select a sign");
            currentSignUrl = null; // Ensure reset
            currentSignImage = null; // Ensure reset

        } catch (err) {
            console.error(`Error loading NFT #${tokenId}:`, err);
            // Error messages kept from original script.js
            let userMessage = `Failed to load NFT #${tokenId}. ${err.message || 'Unknown error.'}`;
            if (err.name === 'AbortError') userMessage = `Error: Metadata request timed out.`;
            else if (err.message?.toLowerCase().includes('invalid tokenid') || err.message?.toLowerCase().includes('uri query for nonexistent token') || err.message?.includes('reverted')) userMessage = `Error: Token ID #${tokenId} might not exist in ${category}.`;
            else if (err.message?.includes('fetch')) userMessage = `Network Error: Couldn't reach metadata/image server.`;
            else if (err.message?.includes('Image load failed')) userMessage = `Error: Couldn't load the NFT image.`;
            showError(userMessage);
            loadedNftImage = null;
            if (previewCtx) clearCanvas(previewCtx);
            if (previewArea) previewArea.classList.add('hidden');
            if (signSection) signSection.classList.add('hidden');
            disableGenerateButton("NFT Load Failed!");
            hideTextInputSection(); // Ensure text section hidden on failure
            removeTextMask();     // Ensure mask removed on failure
        } finally {
            hideLoader();
            setProcessing(false);
        }
    }

     // REPLACED applySignToCanvases with this flow
     async function handleSignChange() {
         console.log("Sign selection changed");
         if (isProcessing || !signSelector || !loadedNftImage) return;

         const selectedOption = signSelector.options[signSelector.selectedIndex];
         currentSignUrl = selectedOption.value;
         currentSignImage = null; // Reset previously loaded sign image
         hideTextInputSection();  // Hide text section until sign is processed
         removeTextMask();        // Remove old mask immediately
         resetSignColorSelection(); // Reset color to default and disable radios initially
         if (textColorSelectorContainer) textColorSelectorContainer.classList.add('hidden'); // Hide color selector

         console.log("Selected sign URL:", currentSignUrl || "None");

         if (currentSignUrl) {
             // Load the sign image first before applying color/mask
             showLoader();
             updateStatus("Loading sign image...");
             disableGenerateButton("Loading Sign...");
             try {
                currentSignImage = await loadImagePromise(currentSignUrl, "anonymous");
                console.log("Sign image loaded successfully.");

                // Now apply the default color and mask
                const success = await applyColoredSignAndMask(currentSignImage, selectedSignColor); // Use default color initially

                if (success) {
                     if (textColorSelectorContainer) {
                        updateTextColorPrompt();
                        textColorSelectorContainer.classList.remove('hidden'); // Show color options
                        if (textColorRadios) textColorRadios.forEach(r => r.disabled = false); // Enable color radios
                     }
                     showTextInputSection(); // Show text input now that sign is loaded
                     enableGenerateButton(); // Enable generate button
                } else {
                     // Error handled within applyColoredSignAndMask
                     disableGenerateButton("Sign Apply Error");
                     if (textColorSelectorContainer) textColorSelectorContainer.classList.add('hidden');
                     hideTextInputSection();
                     removeTextMask();
                }
             } catch (signLoadError) {
                 console.error("Failed to load sign image:", signLoadError);
                 showError(`Failed to load sign: ${signLoadError.message}`);
                 disableGenerateButton("Sign Load Error");
                 currentSignUrl = null; // Reset URL as load failed
                 currentSignImage = null;
                 if (previewCtx && loadedNftImage) drawScaledImage(previewCtx, loadedNftImage); // Redraw base NFT
                 if (finalCtx) { finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height); if(loadedNftImage) drawScaledImage(finalCtx, loadedNftImage); }
                 if (textColorSelectorContainer) textColorSelectorContainer.classList.add('hidden');
                 hideTextInputSection();
                 removeTextMask();
             } finally {
                 hideLoader(); // Ensure loader hidden even on error
             }

         } else { // No sign selected ("-- Select Sign --")
             currentSignImage = null;
             if (previewCtx && loadedNftImage) drawScaledImage(previewCtx, loadedNftImage); // Show base NFT
             if (finalCtx) { finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height); if(loadedNftImage) drawScaledImage(finalCtx, loadedNftImage); } // Clear/reset final
             if (textColorSelectorContainer) textColorSelectorContainer.classList.add('hidden');
             hideTextInputSection();
             removeTextMask();
             disableGenerateButton("Select a sign");
             updateStatus("Select a sign overlay.", false);
         }
     }

     // NEW: Handle Sign Color Change
     async function handleSignColorChange(event) {
        if (!event?.target || isProcessing || !currentSignImage || !loadedNftImage) {
            console.log("Color change ignored - processing, no sign image, or no NFT.");
            return;
        }
        selectedSignColor = event.target.value;
        console.log("Sign color changed to:", selectedSignColor);
        updateStatus("Updating preview with new sign color...", false);

        // Re-apply color and mask using the already loaded sign image
        const success = await applyColoredSignAndMask(currentSignImage, selectedSignColor);
        if(success) {
            updateStatus("Preview updated.", true);
            enableGenerateButton(); // Ensure generate is enabled
        } else {
            // Error handled in applyColoredSignAndMask
             disableGenerateButton("Sign Color Error");
        }
        // Text input section should already be visible if we got here
    }


    // NEW: Core function for applying color and mask (adapted from text4.txt)
    async function applyColoredSignAndMask(signImg, signColor) {
         console.log(`Applying color: ${signColor} and generating mask.`);
         if (!loadedNftImage || !previewCtx || !finalCtx || !signImg || !previewCanvas || !finalCanvas) {
             showError("Missing NFT/context/sign image or canvases.");
             disableGenerateButton("Internal Error");
             removeTextMask();
             return false;
         }
         setProcessing(true); showLoader();
         updateStatus("Coloring sign & creating mask..."); hideError(); disableGenerateButton("Applying Sign...");

         // Temp canvas for COLORING (final size)
         const tempCanvas = document.createElement('canvas');
         tempCanvas.width = finalCanvas.width;
         tempCanvas.height = finalCanvas.height;
         const tempCtx = tempCanvas.getContext('2d');

         // Temp canvas for CSS MASK (preview size)
         const maskCanvas = document.createElement('canvas');
         maskCanvas.width = previewCanvas.width;
         maskCanvas.height = previewCanvas.height;
         const maskCtx = maskCanvas.getContext('2d');

         if (!tempCtx || !maskCtx) {
             showError("Failed to create temp/mask canvas context.");
             hideLoader(); setProcessing(false); removeTextMask(); return false;
         }

         let success = false;
         try {
             // --- STEP 1: Generate CSS Mask ---
             maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
             // Draw the ORIGINAL sign image onto the mask canvas, scaled to PREVIEW size
             drawScaledImage(maskCtx, signImg); // Use the same scaling logic
             const maskDataUrl = maskCanvas.toDataURL('image/png');

             // Apply CSS mask to the text overlay container
             if (textOverlayContainer) {
                 textOverlayContainer.style.webkitMaskImage = `url(${maskDataUrl})`;
                 textOverlayContainer.style.maskImage = `url(${maskDataUrl})`;
                 // Ensure other mask properties are set (usually done in CSS)
                 textOverlayContainer.style.webkitMaskRepeat = 'no-repeat';
                 textOverlayContainer.style.maskRepeat = 'no-repeat';
                 textOverlayContainer.style.webkitMaskPosition = 'center';
                 textOverlayContainer.style.maskPosition = 'center';
                 textOverlayContainer.style.webkitMaskSize = 'contain'; // Match preview object-fit
                 textOverlayContainer.style.maskSize = 'contain';
                 console.log("CSS Mask applied to text overlay.");
             } else {
                 console.warn("Text overlay container not found for CSS mask.");
             }
             // --- END STEP 1 ---

             // --- STEP 2: Color the sign for the final canvas ---
             tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
             // Draw the sign at FINAL canvas size onto the temp canvas
             tempCtx.drawImage(signImg, 0, 0, tempCanvas.width, tempCanvas.height);
             tempCtx.globalCompositeOperation = 'source-in'; // Color only where sign pixels exist
             tempCtx.fillStyle = signColor;
             tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
             tempCtx.globalCompositeOperation = 'source-over'; // Reset composite mode
             console.log("Colored sign generated on temp canvas.");
             // --- END STEP 2 ---

             // --- STEP 3: Draw onto Final & Preview Canvases (Check Taint) ---
             finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
             drawScaledImage(finalCtx, loadedNftImage); // Draw base NFT
             finalCtx.drawImage(tempCanvas, 0, 0, finalCanvas.width, finalCanvas.height); // Draw COLORED sign overlay
             console.log("Final canvas updated.");

             // Check Taint...
             let tainted = false;
             try {
                 finalCtx.getImageData(0, 0, 1, 1);
                 console.log("Final canvas OK (not tainted).");
             } catch (e) {
                 if (e.name === "SecurityError") {
                     tainted = true;
                     console.error("FINAL CANVAS TAINTED!", e);
                     showError(`Security Error! Canvas tainted (CORS). Cannot generate accurately.`);
                     disableGenerateButton("Canvas Tainted!");
                     // Revert preview to base NFT if tainted
                     if (previewCtx && loadedNftImage) drawScaledImage(previewCtx, loadedNftImage);
                     removeTextMask(); // Remove mask if tainted
                     hideTextInputSection(); // Hide text input if tainted
                     // Keep color selector visible but disable radios? Or hide it too? Hiding is safer.
                     if (textColorSelectorContainer) textColorSelectorContainer.classList.add('hidden');
                     if (textColorRadios) textColorRadios.forEach(r => r.disabled = true);
                     success = false; // Mark as failure
                 } else { throw e; } // Re-throw other errors
             }

             if (!tainted) {
                 // Update preview canvas from the final (now colored) canvas
                 previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                 previewCtx.drawImage(finalCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
                 console.log("Preview updated.");
                 updateStatus("Preview OK. Ready to Generate!", true);
                 // Text and color sections visibility are handled by handleSignChange/handleSignColorChange
                 success = true; // Mark as success
             }
            // Tainted case already handled setting success = false

         } catch (err) {
             console.error('Error applying colored sign and mask:', err);
             showError(`Sign application failed! ${err.message}.`);
             if (previewCtx && loadedNftImage) drawScaledImage(previewCtx, loadedNftImage); // Revert preview
             disableGenerateButton("Sign Apply Error");
             removeTextMask(); // Remove mask on error
             hideTextInputSection(); // Hide text input on error
             if (textColorSelectorContainer) textColorSelectorContainer.classList.add('hidden'); // Hide color on error
             success = false; // Mark as failure
         } finally {
             hideLoader();
             setProcessing(false);
             // Clean up temporary canvases
             tempCanvas.width = tempCanvas.height = 0;
             maskCanvas.width = maskCanvas.height = 0;
         }
         return success; // Return success status
    }


    function populateSignSelector(category) { // Modified to reset color/text/mask
         console.log("Populating sign selector for category:", category);
         if (!signSelector) return;
         signSelector.innerHTML = ''; // Clear existing options

         if (!signData?.[category]?.length) {
             showError(`No sign data available for ${category}. Maybe check signs.json?`);
             signSelector.disabled = true;
             return;
         }

         signSelector.disabled = false; // Enable selector

         // Add placeholder option
         const placeholderOption = document.createElement('option');
         placeholderOption.value = "";
         placeholderOption.textContent = "-- Select Sign --";
         placeholderOption.disabled = true;
         placeholderOption.selected = true;
         signSelector.appendChild(placeholderOption);

         // Add options from signData
         signData[category].forEach(sign => {
             const option = document.createElement('option');
             option.value = sign.url;
             option.textContent = sign.name;
             signSelector.appendChild(option);
         });

         // Reset things that depend on a sign being selected
         disableGenerateButton("Select a sign");
         currentSignUrl = null;
         currentSignImage = null;
         if (textColorSelectorContainer) textColorSelectorContainer.classList.add('hidden');
         resetSignColorSelection();
         hideTextInputSection(); // Hide text section when populating
         removeTextMask(); // Remove mask when populating
    }

    // --- NEW: Text Handling Functions (Copied from text4.txt) ---
    function handleAddOrUpdateText() {
        if (!textInput || !interactiveText || isProcessing) return;
        const newText = textInput.value.trim(); //.substring(0, 30); // Optional: Limit text length

        if (newText) {
            interactiveText.innerText = newText;
            interactiveText.style.display = 'block'; // Make it visible
            currentTextState.content = newText;
            currentTextState.visible = true;

            // Reset position/rotation ONLY if text was previously hidden or had no position
            if (!currentTextState.x && !currentTextState.y) {
                // Recalculate initial center position based on current element size
                requestAnimationFrame(() => { // Use rAF to wait for dimensions after text set
                    if (!textOverlayContainer || !interactiveText) return; // Guard
                    const containerRect = textOverlayContainer.getBoundingClientRect();
                    const textRect = interactiveText.getBoundingClientRect();

                    // Center based on offsetLeft/Top which are relative to the offsetParent (previewArea)
                    const initialLeft = (textOverlayContainer.offsetWidth - interactiveText.offsetWidth) / 2;
                    const initialTop = (textOverlayContainer.offsetHeight - interactiveText.offsetHeight) / 2;

                    interactiveText.style.left = `${initialLeft}px`;
                    interactiveText.style.top = `${initialTop}px`;
                    interactiveText.style.transform = `rotate(0deg) scale(1)`; // Reset transform if used

                    currentTextState.x = initialLeft;
                    currentTextState.y = initialTop;
                    currentTextState.rotation = 0;
                    currentTextState.scale = 1;
                    console.log("Text added/reset:", newText, "at (top, left)", initialTop, initialLeft);
                });
            } else {
                 console.log("Text updated:", newText, "(position kept)");
                 // Keep existing position/rotation (already stored in currentTextState)
            }
        } else {
            handleRemoveText(); // Remove if input is empty
        }
    }

    function handleRemoveText() {
        if (!interactiveText || isProcessing) return;
        interactiveText.innerText = '';
        interactiveText.style.display = 'none'; // Hide the element
        if (textInput) textInput.value = '';
        currentTextState.content = "";
        currentTextState.visible = false;
        // Reset position state as well
        currentTextState.x = 0;
        currentTextState.y = 0;
        currentTextState.rotation = 0;
        currentTextState.scale = 1;
        console.log("Text removed.");
    }

    function showTextInputSection() {
        if (textInputSection && !isProcessing) { // Only show if not processing
             textInputSection.classList.remove('hidden');
             console.log("Text input section shown");
        } else {
             console.log("Text input section kept hidden (processing or element missing).");
        }
    }

    function hideTextInputSection() {
        if (textInputSection) textInputSection.classList.add('hidden');
        handleRemoveText(); // Also remove the text when hiding the section
        console.log("Text input section hidden and text cleared.");
    }

    function removeTextMask() {
         if (textOverlayContainer) {
             textOverlayContainer.style.webkitMaskImage = 'none';
             textOverlayContainer.style.maskImage = 'none';
             console.log("Text mask removed.");
         }
    }
    // --- END NEW Text Handling ---


    function resolveIpfsUrl(url) { // Keep as is
        if (typeof url !== 'string') return null;
        if (url.startsWith("ipfs://")) {
            return url.replace("ipfs://", "https://ipfs.io/ipfs/");
        }
        return url;
    }

    function loadImagePromise(src, crossOrigin = null) { // Keep as is
         return new Promise((resolve, reject) => {
             if (!src || typeof src !== 'string' || !(src.startsWith('http') || src.startsWith('data:'))) { // Allow data URLs
                 return reject(new Error(`Invalid or non-HTTP(S)/data URL: ${src ? src.substring(0, 60) : 'null'}`));
             }
             const img = new Image();
             if (crossOrigin) img.crossOrigin = crossOrigin;
             img.onload = () => {
                 console.log(`Image loaded: ${src.substring(0, 60)}...`);
                 resolve(img);
             };
             img.onerror = (e) => {
                 console.error(`Failed to load image: ${src}`, e);
                 reject(new Error(`Image load failed! Check URL/network.`));
             };
             console.log(`Attempting load: ${src.substring(0, 60)}...`);
             img.src = src;
         });
    }

    function drawScaledImage(ctx, img) { // Keep as is
         if (!ctx || !img?.naturalWidth || img.naturalWidth === 0) {
             console.warn("Cannot draw image: Invalid context or image dimensions.");
             return;
         }
         const canvas = ctx.canvas;
         const hRatio = canvas.width / img.naturalWidth;
         const vRatio = canvas.height / img.naturalHeight;
         const ratio = Math.min(hRatio, vRatio);
         const scaledWidth = img.naturalWidth * ratio;
         const scaledHeight = img.naturalHeight * ratio;
         const centerX = (canvas.width - scaledWidth) / 2;
         const centerY = (canvas.height - scaledHeight) / 2;

         ctx.clearRect(0, 0, canvas.width, canvas.height);
         const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--medium-dark').trim() || '#2a2a3a';
         ctx.fillStyle = bgColor;
         ctx.fillRect(0, 0, canvas.width, canvas.height);

         ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, centerX, centerY, scaledWidth, scaledHeight);
    }

    function handleGenerateClick() { // Modified taint check
         console.log("Generate button clicked");
         // Updated condition: Need NFT, Sign Image (for mask/color), and Generate button not disabled
         if (isProcessing || !loadedNftImage || !currentSignImage || (generateButton && generateButton.disabled)) {
             showError("Cannot generate. Check NFT, sign selection, and errors (like canvas taint).");
             return;
         }
         // Check for taint again just before download attempt
         try {
            finalCtx.getImageData(0,0,1,1); // Check taint
            handleDownloadLogic(); // Proceed if not tainted
         } catch(e) {
             if (e.name === "SecurityError") {
                console.error("Generate FAILED - Tainted Canvas:", e);
                showError(`Generation FAILED! Canvas tainted (CORS). Cannot download accurately.`);
                disableGenerateButton("Canvas Tainted!"); // Keep disabled state
             } else {
                console.error("Generate FAILED - Unexpected Error:", e);
                showError(`Generation FAILED! Unexpected error: ${e.message}`);
             }
         }
     }

    function handleDownloadLogic() { // Modified to draw text and update filename
         console.log("Initiating download logic...");
         if (isProcessing || !finalCtx || !loadedNftImage || !finalCanvas || !previewCanvas /* Need preview dims */) {
             showError("Cannot download image. Check state.");
             return;
         }

         // --- DRAW INTERACTIVE TEXT ON FINAL CANVAS ---
         if (currentTextState.visible && interactiveText && currentTextState.content) {
             console.log("Drawing interactive text onto final canvas...");
             try {
                 // 1. Calculate scale factor between preview and final canvas
                 const scaleX = finalCanvas.width / previewCanvas.width;
                 const scaleY = finalCanvas.height / previewCanvas.height;

                 // 2. Get text properties (use state where possible, fallback to computed)
                 const textElement = interactiveText;
                 const textContent = currentTextState.content;
                 const computedStyle = window.getComputedStyle(textElement);

                 // Text color: Prioritize state if ever customized, else use CSS default
                 const color = currentTextState.color || computedStyle.color;

                 // Font: Parse size from state/computed, scale it, combine with family
                 let fontSize = parseFloat(currentTextState.font || computedStyle.fontSize);
                 fontSize *= scaleY; // Scale font size for the larger canvas
                 const fontFamily = currentTextState.font ? currentTextState.font.split(' ').slice(1).join(' ') : computedStyle.fontFamily;
                 const finalFont = `${fontSize}px ${fontFamily}`; // Construct final font string

                 // 3. Get Position and Rotation from State (relative to preview container top-left)
                 const relativeX = currentTextState.x; // Already stores offsetLeft
                 const relativeY = currentTextState.y; // Already stores offsetTop
                 const rotationDegrees = currentTextState.rotation || 0;
                 const rotationRadians = rotationDegrees * (Math.PI / 180);

                 // 4. Calculate final position and center point for rotation on the large canvas
                 // We need the text element's size *on the preview canvas* to calculate its center offset
                 const previewTextWidth = textElement.offsetWidth;
                 const previewTextHeight = textElement.offsetHeight;
                 const previewCenterXOffset = previewTextWidth / 2;
                 const previewCenterYOffset = previewTextHeight / 2;

                 // Calculate the top-left corner on the final canvas
                 const finalTopLeftX = relativeX * scaleX;
                 const finalTopLeftY = relativeY * scaleY;

                 // Calculate the center point on the final canvas (this will be the rotation origin)
                 const finalCenterX = finalTopLeftX + (previewCenterXOffset * scaleX);
                 const finalCenterY = finalTopLeftY + (previewCenterYOffset * scaleY);


                 // 5. Set context properties and draw
                 finalCtx.save(); // Save current canvas state
                 finalCtx.textAlign = 'center';    // Align text horizontally center relative to finalCenterX
                 finalCtx.textBaseline = 'middle'; // Align text vertically center relative to finalCenterY
                 finalCtx.font = finalFont;
                 finalCtx.fillStyle = color;

                 // Optional: Add text shadow (scaled)
                 finalCtx.shadowColor = 'rgba(0,0,0,0.6)';
                 finalCtx.shadowOffsetX = 1 * scaleX;
                 finalCtx.shadowOffsetY = 1 * scaleY;
                 finalCtx.shadowBlur = 2 * scaleX;

                 // Apply transformations:
                 // a. Translate origin to the calculated center point on the final canvas
                 finalCtx.translate(finalCenterX, finalCenterY);
                 // b. Rotate around this new origin
                 finalCtx.rotate(rotationRadians);
                 // c. Draw the text at (0, 0) relative to the transformed origin
                 finalCtx.fillText(textContent, 0, 0);

                 finalCtx.restore(); // Restore canvas state (removes translation, rotation, shadow)
                 console.log(`Text drawn: '${textContent}' at final center ~(${finalCenterX.toFixed(0)}, ${finalCenterY.toFixed(0)}), Rot: ${rotationDegrees}deg`);

             } catch (textDrawError) {
                  console.error("Error drawing text on final canvas:", textDrawError);
                  showError("Failed to draw text onto final image.");
                  // Decide if download should proceed without text? For now, let it continue.
             }
         } else {
              console.log("No visible text to draw on final canvas.");
         }
         // --- END DRAWING TEXT ---


         // --- Continue with download logic ---
         let downloadInitiated = false;
         try {
             // Re-check taint *after* potentially drawing text (highly unlikely to cause taint)
             finalCtx.getImageData(0, 0, 1, 1);
             console.log("Canvas OK after text draw. Generating URL...");

             const dataURL = finalCanvas.toDataURL('image/png');
             if (!dataURL || dataURL.length < 100) throw new Error("Empty data URL generated.");

             const link = document.createElement('a');

             // Construct filename (Updated to include text indicator)
             let filename = 'Ticuvs-Signed-NFT.png';
             const tokId = tokenIdInput?.value || 'unknown';
             const selectedSignOption = signSelector?.options[signSelector.selectedIndex];
             const selectedSignName = selectedSignOption?.value ? selectedSignOption.text : null;

             // Add '-Text' if text was visible and had content
             const textIndicator = currentTextState.visible && currentTextState.content ? '-Text' : '';

             if (currentCategory && selectedSignName) {
                 const slug = (t) => t.toLowerCase().replace(/\s+/g,'-').replace(/[^\w-]+/g,'');
                 filename = `Ticuv-${currentCategory}-${tokId}-Sign-${slug(selectedSignName)}${textIndicator}.png`;
             } else if (currentCategory) {
                  // Should ideally not happen if generate is enabled, but handles edge case
                 filename = `Ticuv-${currentCategory}-${tokId}-Base${textIndicator}.png`;
             } else {
                 filename = `Ticuv-Signed-NFT${textIndicator}.png`;
             }

             link.href = dataURL;
             link.download = filename;
             document.body.appendChild(link);
             link.click();
             document.body.removeChild(link);
             console.log('Download initiated for:', filename);
             updateStatus("Schwifty! Download started!", true);
             downloadInitiated = true;

         } catch (error) {
              console.error('Download failed:', error);
              if (error.name === "SecurityError") {
                  showError(`Download FAILED! Canvas is tainted (CORS). Cannot save.`);
              } else {
                  showError(`Download FAILED! ${error.message}.`);
              }
              downloadInitiated = false; // Ensure modal doesn't show
         }

         // Show modal only if download was initiated
         if (downloadInitiated) {
              console.log(`Showing share modal after ${SHARE_MODAL_DELAY}ms delay.`);
              setTimeout(showShareModal, SHARE_MODAL_DELAY);
         }
    }


    // ==================================
    //        UI HELPER FUNCTIONS (Modified)
    // ==================================
     function showError(message) { // Keep as is
         if (!errorMessage || !statusMessage) return;
         const shortMessage = message.substring(0, 250) + (message.length > 250 ? "..." : "");
         errorMessage.textContent = `Error! ${shortMessage}`;
         errorMessage.classList.remove('hidden');
         statusMessage.classList.remove('success');
         errorMessage.style.animation = 'none';
         void errorMessage.offsetWidth;
         errorMessage.style.animation = 'shake-rick 0.4s linear infinite';
         setTimeout(() => { if (errorMessage) errorMessage.style.animation = 'none'; }, 800);
     }

     function hideError() { // Keep as is
         if (!errorMessage) return;
         errorMessage.classList.add('hidden');
         errorMessage.textContent = '';
         errorMessage.style.animation = 'none';
     }

     function updateStatus(message, isSuccess = false) { // Keep as is
         if (!statusMessage) return;
         statusMessage.textContent = message;
         statusMessage.className = isSuccess ? 'success' : '';
         if (isSuccess) hideError();
     }

     function clearCanvas(context) { // Keep as is
         if (!context) return;
         const canvas = context.canvas;
         context.clearRect(0, 0, canvas.width, canvas.height);
         const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--medium-dark').trim() || '#2a2a3a';
         context.fillStyle = bgColor;
         context.fillRect(0, 0, canvas.width, canvas.height);
     }

     function showLoader() { if (loader) loader.classList.remove('hidden'); }
     function hideLoader() { if (loader) loader.classList.add('hidden'); }

     function setProcessing(state) { // Modified to include new inputs
         isProcessing = state;
         if (categoryRadios) categoryRadios.forEach(r => r.disabled = state);
         if (tokenIdInput) tokenIdInput.disabled = state || !currentCategory;
         if (loadNftButton) {
             loadNftButton.disabled = state || !currentCategory;
             loadNftButton.classList.toggle('disabled', loadNftButton.disabled);
         }
         if (signSelector) signSelector.disabled = state || !loadedNftImage; // Disable if no NFT loaded
         // --- NEW: Disable color/text inputs ---
         if (textColorRadios) textColorRadios.forEach(r => r.disabled = state || !currentSignImage); // Also disable if no sign loaded
         if (addTextButton) addTextButton.disabled = state;
         if (removeTextButton) removeTextButton.disabled = state;
         if (textInput) textInput.disabled = state;
         if (interactiveText) interactiveText.style.pointerEvents = state ? 'none' : 'auto'; // Disable drag
         // --- END NEW ---

         // Generate button logic (disable if processing or crucial elements missing/tainted)
         if (generateButton) {
             const isTainted = generateButton.title === "Canvas Tainted!";
             const isDisabled = state || !loadedNftImage || !currentSignImage || isTainted; // Need sign image now
             generateButton.disabled = isDisabled;
             generateButton.classList.toggle('disabled', isDisabled);
             // Update title based on why it's disabled
             if (state) { generateButton.title = "Processing..."; }
             else if (isTainted) { generateButton.title = "Canvas Tainted!"; }
             else if (!loadedNftImage) { generateButton.title = "Load NFT First"; }
             else if (!currentSignImage) { generateButton.title = "Select Sign First"; } // Changed from currentSignUrl
             else { generateButton.title = "Generate Signed Image"; } // Default enabled title
         }
     }

     function updateSignPrompt() { // Keep as is
         if (!signPrompt) return;
         const randomIndex = Math.floor(Math.random() * funnyQuips.length);
         signPrompt.textContent = `Step 3: ${funnyQuips[randomIndex]}`;
     }

     // NEW: Update Text Color Prompt
     function updateTextColorPrompt() {
         if (!textColorPrompt) return;
         const idx = Math.floor(Math.random() * colorQuips.length);
         textColorPrompt.textContent = `Step 4: ${colorQuips[idx]}`;
     }

     // NEW: Reset Sign Color Selection
     function resetSignColorSelection() {
        selectedSignColor = '#FFFFFF'; // Reset to default
        if (textColorRadios) {
            const defaultColorRadio = document.getElementById('colorWhite');
            if (defaultColorRadio) defaultColorRadio.checked = true;
            // Disable all color radios until a sign is loaded and applied
            textColorRadios.forEach(r => r.disabled = true);
        }
        // Ensure container is hidden initially or on reset
        if (textColorSelectorContainer) textColorSelectorContainer.classList.add('hidden');
    }


     function enableGenerateButton() { // Modified conditions
         if (generateButton && loadedNftImage && currentSignImage) { // Check for loaded sign IMAGE now
             const isErrorDisabled = generateButton.title === "Canvas Tainted!" ||
                                     generateButton.title === "Sign Apply Error" ||
                                     generateButton.title === "Sign Load Error" ||
                                     generateButton.title === "Sign Color Error" || // Add color error
                                     generateButton.title === "NFT Load Failed!";
             if (!isErrorDisabled) {
                 generateButton.disabled = false;
                 generateButton.classList.remove('hidden', 'disabled');
                 generateButton.title = "Generate Signed Image";
                 console.log("Generate button enabled.");
             } else {
                 console.log(`Generate button remains disabled due to error: ${generateButton.title}`);
                 // Ensure it's visible if sign section is visible, even if disabled
                 if (signSection && !signSection.classList.contains('hidden')) {
                     generateButton.classList.remove('hidden');
                 }
                 generateButton.classList.add('disabled'); // Keep disabled class
             }
         } else {
             // If conditions not met, ensure it's disabled
              const reason = !loadedNftImage ? "Load NFT First" : "Select Sign First";
              disableGenerateButton(reason);
         }
     }

     function disableGenerateButton(reason = "Working...") { // Keep as is, but title updates handled elsewhere too
         if (generateButton) {
             generateButton.disabled = true;
             generateButton.classList.add('disabled');
             if (signSection && !signSection.classList.contains('hidden')) {
                 generateButton.classList.remove('hidden');
             } else {
                 generateButton.classList.add('hidden');
             }
             generateButton.title = reason;
             console.log("Generate button disabled:", reason);
         }
     }

     function resetInterface(isInitialLoad = false) { // Modified to reset new elements
         console.log("Resetting interface...");
         hideError();
         updateStatus('Select a dimension to start...');
         if (tokenIdInputContainer) tokenIdInputContainer.classList.add('hidden');
         if (previewArea) previewArea.classList.add('hidden');
         if (signSection) signSection.classList.add('hidden');
         if (generateButton) generateButton.classList.add('hidden', 'disabled');

         loadedNftImage = null;
         currentSignUrl = null;
         currentSignImage = null; // Reset loaded sign image
         if (previewCtx) clearCanvas(previewCtx);
         if (finalCtx) clearCanvas(finalCtx);

         if (categoryRadios) {
             categoryRadios.forEach(r => { r.checked = false; r.disabled = isInitialLoad && !provider; });
         }
         if (tokenIdInput) { tokenIdInput.value = ''; tokenIdInput.placeholder = '...'; tokenIdInput.disabled = true; }
         if (loadNftButton) { loadNftButton.disabled = true; loadNftButton.classList.add('disabled'); }
         if (signSelector) { signSelector.innerHTML = ''; signSelector.disabled = true; }

         // --- NEW: Reset color, text, mask ---
         resetSignColorSelection();
         hideTextInputSection(); // Hides section and clears text state
         removeTextMask();
         // Reset text state fully
         currentTextState = { content: "", x: 0, y: 0, rotation: 0, scale: 1, visible: false, color: '#FFFFFF', font: "20px 'Luckiest Guy', cursive"};
         if (interactiveText) interactiveText.style.display = 'none'; // Ensure hidden
         // --- END NEW ---

         currentCategory = null;
         setProcessing(false);
         hideLoader();
         hideShareModal();

         if (isInitialLoad && !provider) {
             showError("Failed to initialize Ethereum provider. Functionality may be limited.");
         }
     }


    // ==================================
    //        INITIAL SETUP (Keep mostly as is)
    // ==================================
    document.addEventListener('DOMContentLoaded', async () => {
         console.log("DOMContentLoaded event fired.");
         const providerOk = initializeProvider();
         const configOk = await loadAndProcessSignConfig();

         resetInterface(true); // Reset UI completely, including new elements
         addEventListeners(); // Add listeners AFTER reset (includes new listeners)

         if (providerOk && configOk) {
             console.log("SignOMatic V8.3 Interactive Initialized Successfully.");
             if (categoryRadios) categoryRadios.forEach(r => r.disabled = false);
             updateStatus('Select a dimension to begin!');
         } else {
             console.warn("SignOMatic V8.3 initialized with errors (Provider or Config failed).");
             if (!providerOk) showError("Ethereum provider failed. Public RPC may be used.");
             if (!configOk) showError("Failed to load signs.json config.");
             if (categoryRadios) categoryRadios.forEach(r => r.disabled = true);
         }
    });

    console.log("SignOMatic Script V8.3 execution finished.");

})(); // End of IIFE