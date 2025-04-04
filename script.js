// Wrap script in an IIFE
(function() {
    // --- DOM Element Selections ---
    // NFT Mode Elements
    const nftCategoryRadios = document.querySelectorAll('input[name="nftCategory"]');
    const tokenIdInputContainer = document.getElementById('tokenIdInputContainer');
    const tokenIdInput = document.getElementById('tokenIdInput');
    const loadNftButton = document.getElementById('loadNftButton');
    const nftStatus = document.getElementById('nftStatus'); // Specific status for NFT loading

    // Shared Elements
    const errorMessage = document.getElementById('errorMessage');
    const previewArea = document.getElementById('previewArea');
    const previewCanvas = document.getElementById('previewCanvas');
    const finalCanvas = document.getElementById('finalCanvas');
    const controlsSection = document.getElementById('controlsSection'); // Sign controls wrapper
    const signCategoryRadios = document.querySelectorAll('input[name="signCategory"]');
    const signSelectorContainer = document.getElementById('signSelectorContainer');
    const signSelector = document.getElementById('signSelector');
    const signPrompt = document.getElementById('signPrompt');
    const signApplyStatus = document.getElementById('signApplyStatus'); // Specific status for sign application
    const downloadButton = document.getElementById('downloadButton');
    const loader = document.getElementById('loader');

    // --- Contexts ---
    const previewCtx = previewCanvas.getContext('2d');
    const finalCtx = finalCanvas.getContext('2d');

    // --- Constants and State ---
    const FINAL_CANVAS_SIZE = 2048; // For final composition
    let activeBaseImageElement = null; // Holds the loaded NFT Image object
    let currentNftCategory = null; // 'GHN' or 'AHC' for NFT loading
    let currentSignCategory = null; // 'GHN' or 'AHC' for sign selection
    let isProcessing = false; // General processing flag

    // --- Blockchain & Contract Info ---
    const GHN_CONTRACT = "0xe6d48bf4ee912235398b96e16db6f310c21e82cb";
    const AHC_CONTRACT = "0x9370045ce37f381500ac7d6802513bb89871e076";
    const ABI = ["function tokenURI(uint256 tokenId) public view returns (string)"];
    let provider;
    try {
        if (typeof window.ethereum !== 'undefined') {
            provider = new ethers.BrowserProvider(window.ethereum);
            console.log("Using BrowserProvider (MetaMask likely available)");
        } else {
            provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com"); // Public fallback
            console.log("Using public JsonRpcProvider");
        }
    } catch (error) {
        console.error("Failed to initialize ethers provider:", error);
        showError("Could not connect to Ethereum. Get your portal gun fixed!");
        // Disable NFT selection if provider fails
        nftCategoryRadios.forEach(r => {
            r.disabled = true;
            document.querySelector(`label[for="${r.id}"]`)?.classList.add('disabled'); // Optional: style disabled label
        });
        loadNftButton.disabled = true;
        loadNftButton.classList.add('disabled');
    }

    // --- Funny Quips ---
    const funnyQuips = [
        "Pick a sign, you glorious pixel sponge!", "Pick a sign, or the space hamsters revolt!",
        "Choose wisely... the multiverse is watching (and judging).", "Select a sign, *burp*, before Ticuv gets annoyed.",
        "Overlay this garbage, c'mon!", "Just pick one, fleeb! It's not that hard!",
        "This sign better be good, or you're getting squanched.", "Designate the emblem, or face the wrath of Ticuv!"
    ];

    // --- Sign Data (ACTUALIZAT conform structurii GitHub) ---
    const signData = {
        AHC: [
            // Căi relative la index.html, conform noii structuri
            { name: "AHC - Ape Sign", url: "images/AHC/ape.png" },
            { name: "AHC - Delist Sign", url: "images/AHC/delist.png" }
            // Placeholder-ele au fost eliminate
        ],
        GHN: [
            { name: "GHN - Daniel Sign", url: "images/GHN/daniel.png" },
            { name: "GHN - Duko Sign", url: "images/GHN/duko.png" },
            { name: "GHN - Delist Sign", url: "images/GHN/delist.png" }
            // Placeholder-ele au fost eliminate
        ]
    };
    // ***** END OF MODIFICATION *****


    // --- Event Listeners ---
    nftCategoryRadios.forEach(radio => radio.addEventListener('change', handleNftCategoryChange));
    loadNftButton.addEventListener('click', handleLoadNftClick);
    signCategoryRadios.forEach(radio => radio.addEventListener('change', handleSignCategoryChange));
    signSelector.addEventListener('change', handleSignChange);
    downloadButton.addEventListener('click', handleDownload);

    // ==================================
    //       NFT MODE FUNCTIONS
    // ==================================

    function handleNftCategoryChange(event) {
        if (isProcessing) return;
        currentNftCategory = event.target.value;
        console.log('NFT Dimension selected:', currentNftCategory);
        updateNftStatus(`Dimension ${currentNftCategory} selected. Enter Token ID, maggot!`);
        tokenIdInput.value = ''; // Clear previous ID
        tokenIdInput.placeholder = currentNftCategory === 'GHN' ? 'e.g., 1114' : 'e.g., 11862';
        tokenIdInputContainer.classList.remove('hidden');
        tokenIdInput.disabled = false; // Ensure input is enabled
        loadNftButton.disabled = false; // Enable load button
        loadNftButton.classList.remove('disabled');

        // Hide downstream elements if user changes category after loading
        previewArea.classList.add('hidden');
        controlsSection.classList.add('hidden');
        downloadButton.classList.add('hidden', 'disabled');
        activeBaseImageElement = null; // Reset loaded image state
        clearCanvas(previewCtx);
        clearCanvas(finalCtx);
        hideError();
    }

    function handleLoadNftClick() {
         const tokenId = tokenIdInput.value.trim();
         if (!tokenId) {
             showError("No Token ID? Are you trying to annoy Ticuv?");
             return;
         }
         if (!currentNftCategory) {
             showError("Select an NFT dimension first, you ploobus!");
             return;
         }
         if (isProcessing || !provider) return;

         loadAndDisplayNft(tokenId, currentNftCategory);
     }

     async function loadAndDisplayNft(tokenId, category) {
         setProcessing(true);
         showLoader();
         hideError();
         updateNftStatus(`Accessing Dimension ${category} for Token ${tokenId}...`);
         // Reset preview and controls before loading new NFT
         previewArea.classList.add('hidden');
         controlsSection.classList.add('hidden');
         downloadButton.classList.add('hidden', 'disabled');
         activeBaseImageElement = null;
         clearCanvas(previewCtx);
         clearCanvas(finalCtx);


         const contractAddress = category === 'GHN' ? GHN_CONTRACT : AHC_CONTRACT;
         const contract = new ethers.Contract(contractAddress, ABI, provider);

         try {
             updateNftStatus("Contacting the Oracle (Fetching Token URI)...");
             let tokenURI = await contract.tokenURI(tokenId);
             tokenURI = resolveIpfsUrl(tokenURI);
             if (!tokenURI) throw new Error("Token URI is missing or invalid.");

             updateNftStatus("Decoding Ancient Scrolls (Fetching Metadata)...");
             const controller = new AbortController();
             const timeoutId = setTimeout(() => controller.abort(), 15000);
             const response = await fetch(tokenURI, { signal: controller.signal });
             clearTimeout(timeoutId);
             if (!response.ok) throw new Error(`Metadata fetch failed: ${response.statusText}`);
             const metadata = await response.json();

             let imageUrl = resolveIpfsUrl(metadata.image || metadata.image_url || metadata.imageUrl);
             if (!imageUrl) throw new Error("Image URL not found in metadata.");

             updateNftStatus("Capturing Image Essence (Loading Image)...");
             const image = await loadImagePromise(imageUrl, "anonymous"); // Use crossOrigin for external images

             // Success!
             activeBaseImageElement = image; // Store the Image object
             updateNftStatus(`NFT ${tokenId} materialized! Now choose sign dimension.`, true);

             clearCanvas(previewCtx);
             drawScaledImage(previewCtx, activeBaseImageElement); // Draw scaled preview
             previewArea.classList.remove('hidden');

             // Show sign controls
             controlsSection.classList.remove('hidden');
             resetSignSelection(); // Reset sign category/selector
             updateSignApplyStatus("Select sign dimension (GHN/AHC)...");

         } catch (err) {
             console.error(`Error processing NFT ${tokenId} from ${category}:`, err);
             let userMessage = `Failed to load NFT ${tokenId}! ${err.message}`;
              if (err.name === 'AbortError') { userMessage = "Error: Metadata request timed out."; }
              else if (err.message?.includes('CALL_EXCEPTION') || err.message?.includes('invalid token ID')) { userMessage = `Error: Token ID ${tokenId} might not exist in ${category}.`; }
              else if (err.message?.includes('Failed to fetch')) { userMessage = `Network Error fetching metadata.`; }
              else if (err.message?.includes('Image load failed')) { userMessage = `Couldn't load image for NFT ${tokenId}. CORS or URL issue?`; }
             showError(userMessage);
             // Ensure UI is reset on error
             activeBaseImageElement = null;
             previewArea.classList.add('hidden');
             controlsSection.classList.add('hidden');
             downloadButton.classList.add('hidden', 'disabled');

         } finally {
             hideLoader();
             setProcessing(false);
         }
     }

    // --- Helper to resolve IPFS URLs ---
    function resolveIpfsUrl(url) {
        if (url && url.startsWith("ipfs://")) {
          return url.replace("ipfs://", "https://ipfs.io/ipfs/");
        }
        return url;
    }


    // ==================================
    //      SIGN APPLICATION LOGIC
    // ==================================

     function handleSignCategoryChange(event) {
        if (isProcessing || !activeBaseImageElement) return; // Need base NFT image first
        currentSignCategory = event.target.value;
        console.log('Sign Dimension selected:', currentSignCategory);
        updateSignApplyStatus("Now pick a specific sign from the list.");
        populateSignSelector(currentSignCategory);
        signSelectorContainer.classList.remove('hidden');
        // signSelector.disabled = false; // populateSignSelector handles this

        // Attempt to apply the first valid sign automatically
        applyFirstValidSign(currentSignCategory);
    }

    function populateSignSelector(category) {
        signSelector.innerHTML = ''; // Clear previous options
        const signs = signData[category]; // Get signs using the updated signData
        if (!signs || signs.length === 0) {
            const option = document.createElement('option');
            option.disabled = true; option.selected = true;
            option.textContent = "No signs found!";
            signSelector.appendChild(option);
            signSelector.disabled = true;
            updateSignApplyStatus("No signs defined for this dimension!", false);
            disableDownloadButton("No signs!");
            return;
        }

        signSelector.disabled = false;
        let hasValidSign = false;
        // Populate with new signs from the updated signData
        signs.forEach((sign) => {
            const option = document.createElement('option');
            option.value = sign.url; // e.g., "images/GHN/daniel.png"
            option.textContent = sign.name; // e.g., "GHN - Daniel Sign"
            // Basic check if URL seems valid (ends with .png)
            if (!sign.url.toLowerCase().endsWith('.png')) {
                 option.disabled = true;
                 option.textContent += " (Invalid)"; // Should not happen with updated data, but keep check
            } else {
                hasValidSign = true;
            }
            signSelector.appendChild(option);
        });

        // Select the first available (non-disabled) option
        const firstAvailableOption = signSelector.querySelector('option:not([disabled])');
        if (firstAvailableOption) {
            signSelector.value = firstAvailableOption.value;
        } else if (signSelector.options.length > 0) {
            // Should not happen if signData is correct, but fallback
            signSelector.selectedIndex = 0;
        }

        if (!hasValidSign) {
            // This case should ideally not occur with the updated signData
            updateSignApplyStatus("No valid signs found!", false);
            disableDownloadButton("No valid signs!");
            signSelector.disabled = true;
        } else {
             // Disable download until a sign is successfully applied
             disableDownloadButton("Apply sign first!");
        }
    }

     function handleSignChange() {
        if (isProcessing || !activeBaseImageElement || !currentSignCategory) return;
        const selectedSignUrl = signSelector.value;
        const selectedOption = signSelector.options[signSelector.selectedIndex];
        // Apply only if selected option is valid
        if (selectedSignUrl && selectedOption && !selectedOption.disabled) {
             applySignOverlay(selectedSignUrl);
        } else if (selectedOption?.disabled) {
            // This case should not happen with current logic but is safe fallback
            showError("Selected sign is missing or invalid.");
            disableDownloadButton("Invalid sign!");
            resetPreviewToBase(); // Revert preview
        }
    }

    function applyFirstValidSign(category) {
        const firstAvailableOption = signSelector.querySelector('option:not([disabled])');
        if (firstAvailableOption) {
             console.log("Attempting to apply first valid sign:", firstAvailableOption.value);
             applySignOverlay(firstAvailableOption.value);
        } else {
             // This case should not happen with updated signData
             console.log("No valid signs to apply automatically for category:", category);
             resetPreviewToBase();
             updateSignApplyStatus("No valid signs found!", false);
             disableDownloadButton("No signs!");
        }
    }

    // --- Image Loading Promise (Handles CORS for external URLs) ---
    function loadImagePromise(src, crossOrigin = null) {
        return new Promise((resolve, reject) => {
            if (!src || typeof src !== 'string' || src.trim() === '' || src.trim() === '#') {
                 return reject(new Error('Bad image source provided.'));
            }
            const img = new Image();
            // Set crossOrigin only for absolute URLs (like IPFS)
            if (crossOrigin && (src.startsWith('http://') || src.startsWith('https://'))) {
                 img.crossOrigin = crossOrigin;
                 console.log(`Loading image with crossOrigin='${crossOrigin}': ${src}`);
            } else {
                 console.log(`Loading same-origin image: ${src}`); // For local signs
            }
            img.onload = () => resolve(img);
            img.onerror = (err) => {
                console.error(`Failed loading image: ${src}`, err);
                const errorMsg = (src.startsWith('http') ?
                    `Image load failed! Check URL/CORS. (${src.substring(0, 60)}...)` :
                    `Image load failed! Is "${src}" in the correct 'images' folder?`);
                reject(new Error(errorMsg));
            };
            img.src = src;
        });
    }

     // --- Function to draw scaled image ---
    function drawScaledImage(ctx, img) {
         const canvas = ctx.canvas;
         const hRatio = canvas.width / img.naturalWidth;
         const vRatio = canvas.height / img.naturalHeight;
         const ratio = Math.min(hRatio, vRatio);
         const centerShift_x = (canvas.width - img.naturalWidth * ratio) / 2;
         const centerShift_y = (canvas.height - img.naturalHeight * ratio) / 2;

         ctx.clearRect(0, 0, canvas.width, canvas.height);
         ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--medium-dark').trim() || '#2a2a3a';
         ctx.fillRect(0, 0, canvas.width, canvas.height);

         ctx.drawImage(
             img, 0, 0, img.naturalWidth, img.naturalHeight,
             centerShift_x, centerShift_y, img.naturalWidth * ratio, img.naturalHeight * ratio
         );
    }

     async function applySignOverlay(signUrl) {
        if (!activeBaseImageElement) {
            showError("Where's the NFT image, genius? Load one first!");
            return;
        }
        // Basic check: ensure signUrl looks like a path and ends with .png
        if (!signUrl || !signUrl.includes('/') || !signUrl.toLowerCase().endsWith('.png')) {
             showError("Invalid sign URL format. Cannot apply.");
             resetPreviewToBase();
             disableDownloadButton("Invalid Sign!");
             return;
        }
        if (isProcessing) return;

        setProcessing(true);
        showLoader();
        console.log(`Applying sign overlay: ${signUrl}`);
        updateSignApplyStatus("Applying Ticuv's 'Artistic' Touch...");
        hideError();
        disableDownloadButton("Rendering Overlay...");

        try {
            // Load the sign image (relative path, no crossOrigin needed)
            const signImage = await loadImagePromise(signUrl);

            // --- Draw on Final Canvas ---
            clearCanvas(finalCtx);
             const img = activeBaseImageElement;
             const canvas = finalCanvas; // Target the 2048x2048 canvas
             const hRatio = canvas.width / img.naturalWidth;
             const vRatio = canvas.height / img.naturalHeight;
             const ratio = Math.min(hRatio, vRatio); // Fit within 2048x2048
             const centerShift_x = (canvas.width - img.naturalWidth * ratio) / 2;
             const centerShift_y = (canvas.height - img.naturalHeight * ratio) / 2;
            // Optional background for final canvas
             finalCtx.fillStyle = '#000000'; // Black background
             finalCtx.fillRect(0, 0, canvas.width, canvas.height);
             // Draw scaled base NFT image
             finalCtx.drawImage(
                 img, 0, 0, img.naturalWidth, img.naturalHeight,
                 centerShift_x, centerShift_y, img.naturalWidth * ratio, img.naturalHeight * ratio
             );
            // Draw the sign image overlay (assuming it's 2048x2048)
            finalCtx.drawImage(signImage, 0, 0, finalCanvas.width, finalCanvas.height);
            console.log('Final canvas composition complete.');

            // --- Tainting Check ---
            try {
                finalCtx.getImageData(0, 0, 1, 1); // Test read
                console.log('Canvas is NOT tainted after drawing sign.');
                enableDownloadButton(); // Enable download
                updateSignApplyStatus("Overlay complete! Ready to download.", true);
            } catch (e) {
                if (e.name === "SecurityError") {
                    console.error('CANVAS TAINTED!', e);
                    showError(`Security Error! Canvas got tainted. Check NFT image host CORS!`);
                    disableDownloadButton("Canvas Tainted!");
                } else { throw e; }
            }

            // Update preview canvas with the final (scaled down) result
            clearCanvas(previewCtx);
            previewCtx.drawImage(finalCanvas, 0, 0, previewCanvas.width, previewCanvas.height);

        } catch (error) {
            console.error('Error during sign overlay processing:', error);
            showError(`Overlay FAILED! ${error.message}. Ticuv is mad.`);
            resetPreviewToBase(); // Revert preview
            disableDownloadButton("Overlay Error!");
        } finally {
             hideLoader();
             setProcessing(false);
        }
    }

    // ==================================
    //      DOWNLOAD FUNCTION
    // ==================================

    function handleDownload() {
         if (downloadButton.classList.contains('disabled') || isProcessing || !activeBaseImageElement) {
             showError("Cannot download yet. Load NFT & Apply Sign!");
             return;
         }

         try {
             finalCtx.getImageData(0, 0, 1, 1); // Final Taint Check

             const dataURL = finalCanvas.toDataURL('image/png');
             const link = document.createElement('a');

              // Filename Logic
             let filename = 'Ticuvs-Signed-NFT-Junk.png';
             const selectedSignOption = signSelector.options[signSelector.selectedIndex];
             const tokenId = tokenIdInput.value || 'unknown';

             // Ensure all parts are available for descriptive filename
             if (currentNftCategory && currentSignCategory && selectedSignOption && selectedSignOption.textContent && !selectedSignOption.disabled) {
                 const slugify = (text) => text.toLowerCase()
                   .replace(/\s+/g, '-')
                   .replace(/-*\(invalid\)-*/gi, '') // Remove indicators
                   .replace(/[^\w-]+/g, '')
                   .replace(/--+/g, '-')
                   .replace(/^-+/, '').replace(/-+$/, '');
                 const signNameSlug = slugify(selectedSignOption.textContent);
                 if (signNameSlug) {
                     filename = `Ticuv-${currentNftCategory}-${tokenId}-Sign-${currentSignCategory}-${signNameSlug}.png`;
                 } else {
                      filename = `Ticuv-${currentNftCategory}-${tokenId}-Sign-${currentSignCategory}-Custom.png`;
                 }
             } else if (currentNftCategory) {
                  filename = `Ticuv-${currentNftCategory}-${tokenId}-Signed-Output.png`; // Fallback
             }

             link.href = dataURL;
             link.download = filename;
             document.body.appendChild(link);
             link.click();
             document.body.removeChild(link);
             console.log('Download initiated:', filename);
             updateSignApplyStatus("Downloaded! Now scram!", true);

         } catch (error) {
              console.error('Canvas download failed:', error);
              if (error.name === "SecurityError") {
                   showError(`Download FAILED! Canvas is tainted. CORS strikes again!`);
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
        errorMessage.textContent = `Error! ${message}`;
        errorMessage.classList.remove('hidden');
        nftStatus.classList.remove('success'); // Reset status styles
        signApplyStatus.classList.remove('success');
        errorMessage.style.animation = 'none'; // Trigger shake animation
        void errorMessage.offsetWidth; // Reflow
        errorMessage.style.animation = 'shake-rick 0.4s linear infinite';
    }

    function hideError() {
        if (!errorMessage.classList.contains('hidden')) {
            errorMessage.classList.add('hidden');
            errorMessage.textContent = '';
            errorMessage.style.animation = 'none';
        }
    }

    function updateNftStatus(message, isSuccess = false) {
        nftStatus.textContent = message;
        nftStatus.className = isSuccess ? 'success' : '';
        if (message) hideError();
    }
     function updateSignApplyStatus(message, isSuccess = false) {
        signApplyStatus.textContent = message;
        signApplyStatus.className = isSuccess ? 'success' : '';
        if (message) hideError();
    }

    function clearCanvas(context) {
         context.clearRect(0, 0, context.canvas.width, context.canvas.height);
         // Use consistent background for preview and final (before drawing)
         context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--medium-dark').trim() || '#2a2a3a';
         context.fillRect(0, 0, context.canvas.width, context.canvas.height);
    }

    function enableDownloadButton() {
        if (activeBaseImageElement && !isProcessing && signApplyStatus.classList.contains('success')) {
            if (!downloadButton.title.includes("Tainted") && !downloadButton.title.includes("Error") && !downloadButton.title.includes("Failed")) {
                 downloadButton.classList.remove('hidden', 'disabled');
                 downloadButton.title = "Download this beauty!";
                 return;
             }
        }
        // Keep disabled if conditions not met
        // Note: The 'reason' might need updating if called when conditions aren't met
        if (!downloadButton.classList.contains('disabled')) {
            disableDownloadButton("Not Ready");
        }
    }


    function disableDownloadButton(reason = "Not Ready Yet") {
        // Show/hide button based on controls section visibility
        if (controlsSection.classList.contains('hidden')) {
            downloadButton.classList.add('hidden');
        } else {
            downloadButton.classList.remove('hidden');
        }
        downloadButton.classList.add('disabled'); // Always apply disabled class
        downloadButton.title = reason;
    }

    function showLoader() { loader.classList.remove('hidden'); }
    function hideLoader() { loader.classList.add('hidden'); }

    function setProcessing(state) {
         isProcessing = state;
         // Disable controls during processing
         nftCategoryRadios.forEach(r => r.disabled = state || !provider);
         tokenIdInput.disabled = state || !currentNftCategory;
         loadNftButton.disabled = state || !currentNftCategory || !provider;
         signCategoryRadios.forEach(r => r.disabled = state || !activeBaseImageElement);
         signSelector.disabled = state || !currentSignCategory || !activeBaseImageElement || signSelector.options.length === 0 || (signSelector.options[0]?.disabled && signSelector.options.length === 1);

         if (state) {
            loadNftButton.classList.add('disabled');
            disableDownloadButton("Processing...");
         } else {
             // Re-enable controls carefully after processing
             loadNftButton.disabled = !currentNftCategory || !provider;
             if(!loadNftButton.disabled) loadNftButton.classList.remove('disabled'); else loadNftButton.classList.add('disabled');

             // Re-evaluate download button state
             enableDownloadButton();
             // If it remained disabled, update title if it was "Processing..."
             if (downloadButton.classList.contains('disabled') && downloadButton.title === "Processing...") {
                  disableDownloadButton("Apply Sign First"); // Or appropriate reason
             }
         }
     }

     function updateSignPrompt() {
         const randomIndex = Math.floor(Math.random() * funnyQuips.length);
         signPrompt.textContent = `Step 4: ${funnyQuips[randomIndex]}`; // Step 4 in NFT-only flow
     }

    // --- Reset Functions ---

    function resetSignSelection() {
        signCategoryRadios.forEach(radio => { radio.checked = false; radio.disabled = !activeBaseImageElement; });
        signSelectorContainer.classList.add('hidden');
        signSelector.innerHTML = '';
        signSelector.disabled = true;
        currentSignCategory = null;
        updateSignApplyStatus("Select sign dimension...");
        disableDownloadButton("Select Sign");
    }

     function resetInterfaceCompletely() {
         hideError();
         activeBaseImageElement = null;
         clearCanvas(previewCtx);
         clearCanvas(finalCtx);
         previewArea.classList.add('hidden');
         controlsSection.classList.add('hidden');
         signSelectorContainer.classList.add('hidden');
         downloadButton.classList.add('hidden','disabled');

         // Reset NFT Mode specifics
         nftCategoryRadios.forEach(radio => { radio.checked = false; radio.disabled = !provider; });
         tokenIdInputContainer.classList.add('hidden');
         tokenIdInput.value = '';
         tokenIdInput.disabled = true;
         loadNftButton.disabled = true;
         loadNftButton.classList.add('disabled');
         currentNftCategory = null;
         updateNftStatus('Select NFT dimension above...');

         resetSignSelection(); // Also reset sign part

         setProcessing(false);
         hideLoader();
     }

     function resetPreviewToBase() {
          if (activeBaseImageElement) {
             try {
                 clearCanvas(previewCtx);
                 drawScaledImage(previewCtx, activeBaseImageElement);
                 clearCanvas(finalCtx); // Also clear final canvas
                 console.log("Preview reset to base NFT image.");
             } catch (err) {
                 console.error("Error resetting preview to base:", err);
                 clearCanvas(previewCtx);
                 clearCanvas(finalCtx);
             }
         } else {
             clearCanvas(previewCtx);
             clearCanvas(finalCtx);
             previewArea.classList.add('hidden');
         }
         // Ensure download is disabled when reverting preview
         disableDownloadButton("Apply Sign");
     }


    // --- Initial State Setup ---
    resetInterfaceCompletely(); // Start clean, NFT-only mode

})(); // End of IIFE
