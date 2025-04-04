/* ======================================== */
/*          script.js for SignOMatic        */
/* Handles NFT loading, overlay & download  */
/* ======================================== */

(function() {
    'use strict'; // Enable strict mode

    // --- DOM Element Selections ---
    const statusMessage = document.getElementById('statusMessage');
    const errorMessage = document.getElementById('errorMessage');
    const nftSelectionSection = document.getElementById('nftSelectionSection');
    const signSection = document.getElementById('signSection');
    const previewArea = document.getElementById('previewArea');
    const previewCanvas = document.getElementById('previewCanvas');
    const finalCanvas = document.getElementById('finalCanvas');
    const categoryRadios = document.querySelectorAll('input[name="category"]');
    const tokenIdInputContainer = document.getElementById('tokenIdInputContainer');
    const tokenIdInput = document.getElementById('tokenIdInput');
    const loadNftButton = document.getElementById('loadNftButton');
    const signSelectorContainer = document.getElementById('signSelectorContainer');
    const signSelector = document.getElementById('signSelector');
    const downloadButton = document.getElementById('downloadButton');
    const signPrompt = document.getElementById('signPrompt');
    const loader = document.getElementById('loader');

    // --- Contexts ---
    // Get contexts safely, checking if canvas elements exist
    const previewCtx = previewCanvas ? previewCanvas.getContext('2d') : null;
    const finalCtx = finalCanvas ? finalCanvas.getContext('2d') : null;

    // --- Constants and State ---
    const FINAL_CANVAS_SIZE = 2048;
    let currentCategory = null;
    let loadedNftImage = null;
    let isProcessing = false; // General processing flag
    let signConfig = null; // Stores loaded sign configuration from JSON
    let signData = {}; // Stores processed sign data with full URLs

    // --- Blockchain & Contract Info (using Ethers.js from HTML) ---
    const GHN_CONTRACT = "0xe6d48bf4ee912235398b96e16db6f310c21e82cb";
    const AHC_CONTRACT = "0x9370045ce37f381500ac7d6802513bb89871e076";
    const ABI = ["function tokenURI(uint256 tokenId) public view returns (string)"];
    let provider;

    // Initialize Ethers provider safely
    function initializeProvider() {
        try {
            if (typeof ethers === 'undefined') {
                throw new Error("Ethers.js library not loaded!");
            }
            if (window.ethereum) {
                provider = new ethers.BrowserProvider(window.ethereum);
                console.log("Using BrowserProvider (MetaMask likely available)");
            } else {
                provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com");
                console.log("Using public JsonRpcProvider");
            }
            return true; // Success
        } catch (error) {
            console.error("FATAL: Failed to initialize ethers provider:", error);
            showError(`FATAL ERROR: Could not initialize Ethereum connection. ${error.message}. App functionality limited!`);
            // Disable critical parts of the app
            if(categoryRadios) categoryRadios.forEach(r => r.disabled = true);
            if(tokenIdInput) tokenIdInput.disabled = true;
            if(loadNftButton) loadNftButton.disabled = true;
            if(loadNftButton) loadNftButton.classList.add('disabled');
            return false; // Failure
        }
    }

    // --- Funny Quips ---
    const funnyQuips = [
        "Pick a sign, you glorious pixel sponge!", "Pick a sign, or the space hamsters revolt!",
        "Choose wisely... the multiverse is watching (and judging).", "Select a sign, *burp*, before Ticuv gets annoyed.",
        "Overlay this garbage, c'mon!", "Just pick one, fleeb! It's not that hard!",
        "This sign better be good, or you're getting squanched.", "Designate the emblem, or face the wrath of Ticuv!"
    ];

    // --- Load Sign Configuration from JSON ---
    async function loadSignConfig() {
        try {
            const response = await fetch('signs.json'); // Assumes signs.json is in the same folder
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
            }
            signConfig = await response.json();
            console.log("Sign configuration loaded:", signConfig);

            // Validate basic structure
            if (!signConfig || !signConfig.githubUser || !signConfig.githubRepo || !signConfig.githubBranch || !signConfig.imageBasePath || typeof signConfig.categories !== 'object') {
                 throw new Error("Invalid signs.json structure. Missing required fields.");
            }

            // Process the loaded config into the signData structure
            const GITHUB_RAW_BASE_URL = `https://raw.githubusercontent.com/${signConfig.githubUser}/${signConfig.githubRepo}/${signConfig.githubBranch}/${signConfig.imageBasePath}`;
            signData = {}; // Reset processed data

            for (const category in signConfig.categories) {
                if (Array.isArray(signConfig.categories[category])) {
                    signData[category] = signConfig.categories[category].map(sign => {
                        if (!sign.name || !sign.fileName) {
                             console.warn(`Skipping invalid sign entry in category ${category}:`, sign);
                             return null; // Skip invalid entries
                        }
                        return {
                             name: sign.name,
                             url: `${GITHUB_RAW_BASE_URL}/${category}/${sign.fileName}` // Construct full URL
                        };
                    }).filter(sign => sign !== null); // Filter out invalid entries
                } else {
                     console.warn(`Invalid data type for category ${category} in signs.json. Expected array.`);
                }
            }
            console.log("Processed signData:", signData);
            return true; // Indicate success

        } catch (error) {
            console.error("Could not load or process signs.json:", error);
            showError(`Failed to load sign configuration (signs.json). ${error.message}`);
            if(signSelector) signSelector.disabled = true;
            return false; // Indicate failure
        }
    }

    // ==================================
    //        EVENT LISTENERS
    // ==================================
    function addEventListeners() {
        if (loadNftButton) loadNftButton.addEventListener('click', handleLoadNftClick);
        if (signSelector) signSelector.addEventListener('change', handleSignChange);
        if (downloadButton) downloadButton.addEventListener('click', handleDownload);
        if (categoryRadios) categoryRadios.forEach(radio => radio.addEventListener('change', handleCategoryChange));
    }

    // ==================================
    //        CORE FUNCTIONS
    // ==================================

    function handleCategoryChange(event) {
        if (isProcessing) return;
        currentCategory = event.target.value;
        console.log('Dimension selected:', currentCategory);
        updateStatus(`Dimension ${currentCategory} selected. Enter Token ID, maggot!`);
        if (tokenIdInput) {
            tokenIdInput.value = '';
            tokenIdInput.placeholder = currentCategory === 'GHN' ? 'e.g., 1114' : 'e.g., 11862';
            tokenIdInput.disabled = false; // Enable input now
        }
        if (tokenIdInputContainer) tokenIdInputContainer.classList.remove('hidden');
        if (loadNftButton) {
            loadNftButton.classList.remove('disabled');
            loadNftButton.disabled = false; // Enable button now
        }

        // Reset downstream elements
        if (previewArea) previewArea.classList.add('hidden');
        if (signSection) signSection.classList.add('hidden');
        if (downloadButton) downloadButton.classList.add('hidden', 'disabled');
        if (previewCtx) clearCanvas(previewCtx);
        if (finalCtx) clearCanvas(finalCtx);
        loadedNftImage = null;
        hideError();
        // Ensure sign selector is disabled until NFT loads
        if (signSelector) signSelector.disabled = true;
    }

    function handleLoadNftClick() {
        if (!tokenIdInput) return;
        const tokenId = tokenIdInput.value.trim();
        if (!tokenId || !/^\d+$/.test(tokenId)) { // Check if it's a non-empty string of digits
            showError("Invalid Token ID. Must be a number, nerd!");
            return;
        }
        if (!currentCategory) {
            showError("Select a dimension first, you ploobus!");
            return;
        }
        if (isProcessing || !provider) {
             if(!provider) showError("Ethereum connection failed, cannot load NFT.");
             else showError("Processing... Hold your space horses!");
            return;
        }
        loadAndDisplayNft(tokenId, currentCategory);
    }

    async function loadAndDisplayNft(tokenId, category) {
        if (!provider) {
            showError("Ethereum provider not available. Cannot load NFT.");
            return;
        }
        setProcessing(true);
        showLoader();
        hideError();
        updateStatus(`Accessing Dimension ${category} for Token ${tokenId}...`);
        disableDownloadButton("Loading NFT...");
        if (previewArea) previewArea.classList.add('hidden');
        if (signSection) signSection.classList.add('hidden');
        if (signSelector) signSelector.disabled = true; // Keep disabled during load

        const contractAddress = category === 'GHN' ? GHN_CONTRACT : AHC_CONTRACT;
        const contract = new ethers.Contract(contractAddress, ABI, provider);

        try {
            updateStatus("Contacting the Oracle (Fetching Token URI)...");
            let tokenURI = await contract.tokenURI(tokenId);
            tokenURI = resolveIpfsUrl(tokenURI);
            if (!tokenURI) throw new Error("Token URI is missing or invalid.");
            console.log("Token URI:", tokenURI);

            updateStatus("Decoding Ancient Scrolls (Fetching Metadata)...");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort("Metadata fetch timed out"), 15000); // 15s timeout with message
            const response = await fetch(tokenURI, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`Metadata fetch failed: ${response.status} ${response.statusText}`);
            const metadata = await response.json();
            console.log("Metadata:", metadata);

            let imageUrl = resolveIpfsUrl(metadata.image || metadata.image_url || metadata.imageUrl);
            if (!imageUrl) throw new Error("Image URL not found in metadata.");
            console.log("Image URL:", imageUrl);

            updateStatus("Capturing Image Essence (Loading Image)...");
            const image = await loadImagePromise(imageUrl, "anonymous"); // Use anonymous for CORS

            loadedNftImage = image;
            updateStatus(`NFT ${tokenId} materialized! Now pick a sign overlay.`, true);

            if (previewCtx) drawScaledImage(previewCtx, loadedNftImage);
            if (previewArea) previewArea.classList.remove('hidden');

            // Prepare Sign Section only if config was loaded successfully
            if (signConfig && signData[category]) {
                populateSignSelector(category); // This will enable the selector
                updateSignPrompt();
                if (signSection) signSection.classList.remove('hidden');
            } else {
                 showError(`Sign configuration for ${category} missing or failed to load. Cannot select overlay.`);
            }
            disableDownloadButton("Select sign first!"); // Keep download disabled

        } catch (err) {
            console.error(`Error processing NFT ${tokenId} from ${category}:`, err);
            let userMessage = `Failed to load NFT ${tokenId}! ${err.message || 'Unknown error'}`;
             if (err.name === 'AbortError') {
                  userMessage = `Error: ${err.message || 'Request timed out'}. The server's probably run by a Jerry.`;
             } else if (err.message?.includes('invalid token ID') || err.message?.includes('execution reverted')) {
                  userMessage = `Error: Token ID ${tokenId} is likely invalid or doesn't exist in Dimension ${category}. Check your coordinates!`;
             } else if (err.message?.includes('Failed to fetch')) {
                  userMessage = `Network Error fetching metadata/image. Maybe a portal storm?`;
             } else if (err.message?.includes('Image load failed')) {
                  userMessage = `Couldn't load the image for NFT ${tokenId}. Bad URL or CORS issue?`;
             }
            showError(userMessage);
            loadedNftImage = null;
            if (previewCtx) clearCanvas(previewCtx);
            if (previewArea) previewArea.classList.add('hidden');
            if (signSection) signSection.classList.add('hidden');
            disableDownloadButton("NFT Load Failed!");
        } finally {
            hideLoader();
            setProcessing(false);
        }
    }

    function handleSignChange() {
        if (isProcessing || !signSelector) return;
        const selectedSignUrl = signSelector.value;
        if (selectedSignUrl && loadedNftImage) {
            applySignOverlay(selectedSignUrl);
        } else if (!loadedNftImage) {
            showError("Load an NFT first, you numbskull!");
            disableDownloadButton("Load NFT first!");
        } else {
             // No sign selected (placeholder is selected)
             if (previewCtx && loadedNftImage) drawScaledImage(previewCtx, loadedNftImage); // Redraw original NFT in preview
             disableDownloadButton("Select sign first!");
        }
    }

    function populateSignSelector(category) {
        if (!signSelector) return;
        signSelector.innerHTML = ''; // Clear existing options

        if (!signData || !signData[category] || signData[category].length === 0) {
            console.error(`Sign data for category ${category} not available or empty.`);
            // Error should have been shown during config load or NFT load
            signSelector.disabled = true;
            return;
        }
        signSelector.disabled = false; // Enable now

        // Add placeholder
        const placeholderOption = document.createElement('option');
        placeholderOption.value = "";
        placeholderOption.textContent = "-- Select Sign Overlay --";
        placeholderOption.disabled = true; // Keep it unselectable
        placeholderOption.selected = true;
        signSelector.appendChild(placeholderOption);

        // Populate with signs
        signData[category].forEach((sign) => {
            const option = document.createElement('option');
            option.value = sign.url;
            option.textContent = sign.name;
            signSelector.appendChild(option);
        });
        disableDownloadButton("Select sign first!");
    }

    function resolveIpfsUrl(url) {
         if (url && typeof url === 'string') {
              if (url.startsWith("ipfs://")) {
                  // Use a reliable public gateway known for good CORS headers
                  return url.replace("ipfs://", "https://ipfs.io/ipfs/");
              }
              // Add other gateway checks/replacements if needed
          }
          return url; // Return original URL if not IPFS or if it's already HTTP(S)
    }

    function loadImagePromise(src, crossOrigin = null) {
        return new Promise((resolve, reject) => {
            if (!src || typeof src !== 'string' || !src.startsWith('http')) {
                return reject(new Error(`Invalid image source URL provided: ${src ? src.substring(0,60) : 'null'}`));
            }
            const img = new Image();
            if (crossOrigin) img.crossOrigin = crossOrigin; // Set crossOrigin *before* src
            img.onload = () => resolve(img);
            img.onerror = (errEvent) => {
                console.error(`Failed loading image: ${src}`, errEvent);
                reject(new Error(`Image load failed! URL: ${src.substring(0, 60)}... Check URL/Network/CORS.`));
            };
            img.src = src;
        });
    }

    async function applySignOverlay(signUrl) {
        if (!loadedNftImage) { showError("Where's the NFT, genius?"); return; }
        if (!signUrl) { showError("No sign selected? Pick one!"); return; }
        if (isProcessing || !finalCtx || !previewCtx) return;

        setProcessing(true);
        showLoader();
        console.log(`Applying sign overlay: ${signUrl}`);
        updateStatus("Applying Ticuv's 'Artistic' Touch...");
        hideError();
        disableDownloadButton("Rendering Overlay...");

        try {
            const signImage = await loadImagePromise(signUrl, "anonymous"); // Use anonymous for CORS

            // Draw on final canvas (high-res)
            finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
            finalCtx.fillStyle = '#000000'; // Black background
            finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
            drawScaledImage(finalCtx, loadedNftImage); // Draw NFT first
            finalCtx.drawImage(signImage, 0, 0, finalCanvas.width, finalCanvas.height); // Draw sign over it
            console.log('Final canvas composition complete.');

            // Check for canvas tainting
            let isTainted = false;
            try {
                finalCtx.getImageData(0, 0, 1, 1); // Attempt to read pixel data
                console.log('Canvas is NOT tainted after drawing sign.');
            } catch (e) {
                if (e.name === "SecurityError") {
                    isTainted = true;
                    console.error('CANVAS TAINTED! Likely CORS issue.', loadedNftImage.src, signUrl, e);
                    showError(`Security Error! Canvas got tainted (CORS issue likely with NFT or Sign image). Cannot download.`);
                    disableDownloadButton("Canvas Tainted!");
                } else {
                    throw e; // Re-throw other errors
                }
            }

            // Update preview canvas ONLY if not tainted
            if (!isTainted) {
                previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                previewCtx.drawImage(finalCanvas, 0, 0, previewCanvas.width, previewCanvas.height); // Draw scaled final result
                console.log('Preview canvas updated.');
                enableDownloadButton(); // Enable download
                updateStatus("Overlay complete! Ready to download.", true);
            } else {
                 // If tainted, maybe show original NFT in preview instead of black/empty
                 drawScaledImage(previewCtx, loadedNftImage);
                 console.warn("Preview showing original NFT due to canvas taint.");
            }

        } catch (error) {
            console.error('Error during sign overlay processing:', error);
            showError(`Overlay FAILED! ${error.message}. Ticuv is disappointed.`);
            disableDownloadButton("Overlay Error!");
            // Optionally reset preview to original NFT on error
            if (previewCtx && loadedNftImage) drawScaledImage(previewCtx, loadedNftImage);
        } finally {
            hideLoader();
            setProcessing(false);
        }
    }

    function drawScaledImage(ctx, img) {
        if (!ctx || !img || !img.naturalWidth || !img.naturalHeight) {
             console.error("Cannot draw image - invalid context or image dimensions", ctx, img);
             return;
        };
        const canvas = ctx.canvas;
        const hRatio = canvas.width / img.naturalWidth;
        const vRatio = canvas.height / img.naturalHeight;
        const ratio = Math.min(hRatio, vRatio); // Fit entirely
        const scaledWidth = img.naturalWidth * ratio;
        const scaledHeight = img.naturalHeight * ratio;
        const centerShift_x = (canvas.width - scaledWidth) / 2;
        const centerShift_y = (canvas.height - scaledHeight) / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Use CSS variable for background color, fallback if needed
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--medium-dark').trim() || '#2a2a3a';
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight,
                      centerShift_x, centerShift_y, scaledWidth, scaledHeight);
    }

    function handleDownload() {
        if (!downloadButton || downloadButton.classList.contains('disabled') || isProcessing || !finalCtx) return;

        try {
            // Verify canvas is not tainted right before download attempt
            finalCtx.getImageData(0, 0, 1, 1);

            const dataURL = finalCanvas.toDataURL('image/png');
            const link = document.createElement('a');

            // Filename Logic
            let filename = 'Ticuvs-Signed-NFT-Junk.png';
            const selectedSignOption = signSelector ? signSelector.options[signSelector.selectedIndex] : null;
            const tokenId = tokenIdInput ? (tokenIdInput.value || 'unknown') : 'unknown';
            if (currentCategory && selectedSignOption?.value) { // Check if a sign is actually selected
                const slugify = (text) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
                filename = `Ticuv-${currentCategory}-${tokenId}-Sign-${slugify(selectedSignOption.textContent)}.png`;
            } else if (currentCategory) {
                 filename = `Ticuv-${currentCategory}-${tokenId}-Base.png`; // If no sign selected but download somehow possible
            }

            link.href = dataURL;
            link.download = filename;
            document.body.appendChild(link); // Required for Firefox
            link.click();
            document.body.removeChild(link); // Clean up
            console.log('Download initiated:', filename);
            updateStatus("Downloaded! Get outta here!", true);

        } catch (error) {
             console.error('Canvas download failed:', error);
             if (error.name === "SecurityError") {
                  showError(`Download FAILED! Canvas is tainted (CORS issue). Cannot save image.`);
             } else {
                  showError(`Download FAILED! ${error.message}. Did you break it?!`);
             }
             disableDownloadButton("Download Failed!");
        }
    }

    // ==================================
    //        UI HELPER FUNCTIONS
    // ==================================

    function showError(message) {
        if (!errorMessage || !statusMessage) return;
        const displayMessage = message.length > 250 ? message.substring(0, 247) + "..." : message;
        errorMessage.textContent = `Error! ${displayMessage}`;
        errorMessage.classList.remove('hidden');
        statusMessage.classList.remove('success'); // Ensure status isn't marked as success
        // Apply shake animation
        errorMessage.style.animation = 'none';
        void errorMessage.offsetWidth; // Trigger reflow to restart animation
        errorMessage.style.animation = 'shake-rick 0.4s linear infinite';
    }

    function hideError() {
        if (!errorMessage) return;
        errorMessage.classList.add('hidden');
        errorMessage.textContent = '';
        errorMessage.style.animation = 'none'; // Stop animation
    }

    function updateStatus(message, isSuccess = false) {
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = isSuccess ? 'success' : '';
        if (isSuccess) hideError(); // Hide error on success status
    }

    function clearCanvas(context) {
        if (!context) return;
        const canvas = context.canvas;
        context.clearRect(0, 0, canvas.width, canvas.height);
        const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--medium-dark').trim() || '#2a2a3a';
        context.fillStyle = bgColor;
        context.fillRect(0, 0, canvas.width, canvas.height);
    }

    function enableDownloadButton() {
        if (!downloadButton || !loadedNftImage || !signSelector || signSelector.value === "") {
            disableDownloadButton("Need NFT & Sign first!");
            return;
        }
        // Only enable if not disabled by a persistent error state
        const isErrorState = downloadButton.title === "Canvas Tainted!" ||
                             downloadButton.title === "Overlay Error!" ||
                             downloadButton.title === "Download Failed!" ||
                             downloadButton.title === "NFT Load Failed!";
        if (!isErrorState) {
            downloadButton.classList.remove('hidden', 'disabled');
            downloadButton.disabled = false;
            downloadButton.title = "Download this beauty!";
        }
    }

    function disableDownloadButton(reason = "Working...") {
        if (!downloadButton) return;
        downloadButton.classList.add('disabled');
        downloadButton.disabled = true;
        // Show/hide based on sign section visibility
        if (signSection && !signSection.classList.contains('hidden')) {
            downloadButton.classList.remove('hidden');
        } else {
            downloadButton.classList.add('hidden');
        }
        downloadButton.title = reason;
    }

    function showLoader() {
        if (loader) loader.classList.remove('hidden');
    }

    function hideLoader() {
        if (loader) loader.classList.add('hidden');
    }

    function setProcessing(state) {
        isProcessing = state;
        // Disable controls safely
        if(categoryRadios) categoryRadios.forEach(r => r.disabled = state);
        if(tokenIdInput) tokenIdInput.disabled = state || !currentCategory; // Keep disabled if no category
        if(loadNftButton) {
            loadNftButton.disabled = state || !currentCategory;
            if(loadNftButton.disabled) loadNftButton.classList.add('disabled'); else loadNftButton.classList.remove('disabled');
        }
        if(signSelector) signSelector.disabled = state || !loadedNftImage; // Keep disabled if no NFT loaded

        // Handle download button separately based on state
        if (state) {
             // If processing starts, ensure download is disabled visually
             if (downloadButton) {
                 downloadButton.classList.add('disabled');
                 downloadButton.disabled = true;
                 // Don't change title if it's already an error state
                 if (!downloadButton.title.includes("Error") && !downloadButton.title.includes("Tainted") && !downloadButton.title.includes("Failed")) {
                      downloadButton.title = "Processing...";
                  }
             }
        } else {
             // When processing finishes, re-evaluate download button state
             if (loadedNftImage && signSelector && signSelector.value !== "") {
                  enableDownloadButton(); // Attempt to enable if conditions are met AND no error occurred
              } else if (loadedNftImage) {
                  disableDownloadButton("Select sign first!");
              } else {
                   disableDownloadButton("Load NFT first!");
              }
        }
    }

    function updateSignPrompt() {
        if (!signPrompt) return;
        const randomIndex = Math.floor(Math.random() * funnyQuips.length);
        signPrompt.textContent = `Step 3: ${funnyQuips[randomIndex]}`;
    }

    // Full interface reset (called on initial load)
    function resetInterface(isInitialLoad = false) {
        console.log("Resetting interface...");
        hideError();
        updateStatus('Select a dimension above...');
        if (tokenIdInputContainer) tokenIdInputContainer.classList.add('hidden');
        if (previewArea) previewArea.classList.add('hidden');
        if (signSection) signSection.classList.add('hidden');
        if (downloadButton) downloadButton.classList.add('hidden','disabled');

        loadedNftImage = null;
        if (previewCtx) clearCanvas(previewCtx);
        if (finalCtx) clearCanvas(finalCtx);

        if (categoryRadios) categoryRadios.forEach(radio => {
            radio.checked = false;
            radio.disabled = !provider; // Keep disabled if provider failed
        });
        if (tokenIdInput) {
            tokenIdInput.value = '';
            tokenIdInput.placeholder = 'e.g., ----';
            tokenIdInput.disabled = true; // Disabled until category selected
        }
        if (loadNftButton) {
             loadNftButton.disabled = true;
             loadNftButton.classList.add('disabled');
        }
        if (signSelector) {
             signSelector.innerHTML = '';
             signSelector.disabled = true;
        }
        currentCategory = null;

        // Only allow processing if provider is ok
        setProcessing(!provider);
        hideLoader();

         // Show specific error if provider failed on initial load
         if (isInitialLoad && !provider) {
              showError("Ethereum provider initialization failed. Core functions disabled.");
          }
    }

    // --- Initial Setup ---
    document.addEventListener('DOMContentLoaded', async () => {
        console.log("DOM fully loaded. Initializing SignOMatic...");
        const providerOk = initializeProvider();
        const configOk = await loadSignConfig(); // Load config after DOM is ready

        resetInterface(true); // Perform initial reset after setup attempts
        addEventListeners();

        if (providerOk && configOk) {
             console.log("SignOMatic Initialized Successfully.");
             // Maybe update status briefly?
             // updateStatus("Ready! Select a dimension.", true);
             // setTimeout(()=> updateStatus('Select a dimension above...'), 2000);
         } else {
             console.warn("SignOMatic initialized with errors (Provider or Config failed).");
             // Error messages should already be displayed by the failing functions
         }
    });

})(); // End of IIFE
