/* ======================================== */
/*      JavaScript Logic (External V8)      */
/* ... Loads signs.json & includes Coffee */
/* ======================================== */

(function() {
    'use strict';
    console.log("SignOMatic Script V8 Initializing...");

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

     // Basic element check
     const essentialElements = [statusMessage, errorMessage, previewCanvas, finalCanvas, categoryRadios, tokenIdInput, loadNftButton, signSelector, generateButton, loader, shareModalOverlay, shareModal, closeShareModalButton, twitterShareButton, shareSubMessage, coffeeButton, coffeeOptions, copyButtons, tokenIdInputContainer, previewArea, signSection, signPrompt];
     let missingElement = false;
     essentialElements.forEach((el, index) => {
         if (!el && !(el instanceof NodeList)) {
             console.error(`CRITICAL ERROR: Essential DOM element at index ${index} is missing! Check ID.`);
             missingElement = true;
         } else if (el instanceof NodeList && el.length === 0 && (index === 4 /* categoryRadios */ || index === 16 /* copyButtons */)) {
            console.warn(`Warning: NodeList for index ${index} is empty.`);
         } else if (!el) {
             console.error(`CRITICAL ERROR: Essential DOM element is missing (index ${index})! Check ID.`);
              missingElement = true;
         }
     });
     if (missingElement && errorMessage) { errorMessage.textContent = "CRITICAL UI ERROR! Refresh page or contact admin."; errorMessage.classList.remove('hidden'); }


    // --- Contexts ---
    const previewCtx = previewCanvas ? previewCanvas.getContext('2d') : null;
    const finalCtx = finalCanvas ? finalCanvas.getContext('2d') : null;
     if(!previewCtx || !finalCtx) console.error("ERROR: Failed to get canvas contexts!");

    // --- Constants and State ---
    const FINAL_CANVAS_SIZE = 2048;
    const SHARE_MODAL_DELAY = 1000;
    const SIGNS_CONFIG_PATH = 'signs.json'; // Path to the configuration file
    let currentCategory = null;
    let loadedNftImage = null;
    let isProcessing = false;
    let signData = {}; // Will be populated from signs.json
    let currentSignUrl = null;

    // --- Blockchain & Contract Info ---
    const GHN_CONTRACT = "0xe6d48bf4ee912235398b96e16db6f310c21e82cb";
    const AHC_CONTRACT = "0x9370045ce37f381500ac7d6802513bb89871e076";
    const ABI = ["function tokenURI(uint256 tokenId) public view returns (string)"];
    let provider;

    // --- Funny Quips & SubMessages ---
    const funnyQuips = ["Pick a sign...", "Choose wisely...", "Overlay this garbage..."];
    const comicSubMessages = ["Go show off, you magnificent creature!", "Don't let memes be dreams!", "Warning: May cause coolness.", "Your NFT got schwifty!", "Freshly signed!"];

    // --- Fetch and Process Sign Config from JSON ---
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


    // Initialize Ethers provider safely
    function initializeProvider() {
        console.log("Initializing provider...");
        try {
            if (typeof ethers === 'undefined') {
                throw new Error("Ethers.js library is missing!");
            }
            // Prefer MetaMask or similar browser provider
            if (window.ethereum) {
                provider = new ethers.BrowserProvider(window.ethereum);
                console.log("Using BrowserProvider (MetaMask or similar)");
            } else {
                // Fallback to a public RPC provider if no browser wallet detected
                provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com"); // Example public RPC
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
    //        MODAL FUNCTIONS
    // ==================================
     function showShareModal() {
         console.log("Showing Share Modal");
         if (!shareModal || !shareModalOverlay || !twitterShareButton || !shareSubMessage || !coffeeOptions) {
             console.error("Share modal elements missing!");
             return;
         }
         // --- MODIFICARE AICI ---
         const tweetText = `Just generated my sign with Sign-O-Matic by @ticu_v at `; // Textul modificat conform cerinței
         // --- SFÂRȘIT MODIFICARE ---

         const associatedUrl = "https://signs.ticuv.art"; // URL-ul care va fi atașat tweet-ului (poate fi diferit de text)
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
    //        EVENT LISTENERS
    // ==================================
    function addEventListeners() {
         console.log("Adding event listeners...");
         if (loadNftButton) loadNftButton.addEventListener('click', handleLoadNftClick);
         if (signSelector) signSelector.addEventListener('change', handleSignChange);
         if (categoryRadios) categoryRadios.forEach(radio => radio.addEventListener('change', handleCategoryChange));
         if (generateButton) generateButton.addEventListener('click', handleGenerateClick);
         if (closeShareModalButton) closeShareModalButton.addEventListener('click', hideShareModal);
         if (shareModalOverlay) shareModalOverlay.addEventListener('click', (event) => {
             // Close only if clicking the overlay itself, not the modal content
             if (event.target === shareModalOverlay) {
                 hideShareModal();
             }
         });
         if (coffeeButton) {
             coffeeButton.addEventListener('click', () => {
                 if (coffeeOptions) {
                     coffeeOptions.style.display = coffeeOptions.style.display === 'none' ? 'block' : 'none';
                 }
             });
         }

         // Initialize Clipboard.js AFTER the DOM is ready
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
                    setTimeout(() => {
                        e.trigger.textContent = 'Copy';
                    }, 1500);
                });
            } else if (copyButtons && copyButtons.length > 0) {
                console.warn("ClipboardJS library not found or no copy buttons. Attaching fallback alert.");
                copyButtons.forEach(button => {
                    button.addEventListener('click', () => alert('Copy failed. Please copy manually.'));
                });
            }
         } catch (clipboardError) {
             console.error("Error initializing ClipboardJS:", clipboardError);
              if (copyButtons && copyButtons.length > 0) {
                   copyButtons.forEach(button => {
                       button.addEventListener('click', () => alert('Copy functionality error. Please copy manually.'));
                   });
               }
         }
         console.log("Event listeners setup complete.");
    }

    // ==================================
    //        CORE FUNCTIONS
    // ==================================
    function handleCategoryChange(event) {
        console.log("Category changed:", event?.target?.value);
        if (!event?.target || isProcessing) return;
        currentCategory = event.target.value;
        updateStatus(`Selected ${currentCategory}. Enter Token ID...`);
        if(tokenIdInput){
            tokenIdInput.value='';
            tokenIdInput.placeholder = currentCategory === 'GHN' ? 'e.g., 1114' : 'e.g., 11862'; // Example IDs
            tokenIdInput.disabled = false;
        }
        if(tokenIdInputContainer) tokenIdInputContainer.classList.remove('hidden');
        if(loadNftButton){
            loadNftButton.classList.remove('disabled');
            loadNftButton.disabled = false;
        }
        // Hide subsequent sections until NFT is loaded
        if(previewArea) previewArea.classList.add('hidden');
        if(signSection) signSection.classList.add('hidden');
        if(generateButton) generateButton.classList.add('hidden', 'disabled');
        if(previewCtx) clearCanvas(previewCtx);
        if(finalCtx) clearCanvas(finalCtx);
        loadedNftImage = null;
        hideError();
        if(signSelector) signSelector.disabled = true; // Disable sign selector until NFT loads
        currentSignUrl = null;
    }

    function handleLoadNftClick() {
        console.log("Load NFT button clicked");
        if (!tokenIdInput) return;
        const id = tokenIdInput.value.trim();
        if (!id || !/^\d+$/.test(id)) {
            showError("Please enter a valid numeric Token ID.");
            return;
        }
        if (!currentCategory) {
            showError("Wubba lubba dub dub! Select a dimension first!");
            return;
        }
        if (isProcessing || !provider) {
             showError(isProcessing ? "Hold your horses, still processing!" : "Ethereum connection failed. Check console.");
            return;
        }
        loadAndDisplayNft(id, currentCategory);
    }

    async function loadAndDisplayNft(tokenId, category) {
        console.log(`Loading NFT #${tokenId} from category ${category}`);
        if (!provider) { showError("Ethereum provider not initialized."); return; }
        setProcessing(true);
        showLoader();
        hideError();
        updateStatus(`Accessing the ${category} dimension for #${tokenId}...`);
        disableGenerateButton("Loading NFT...");
        if (previewArea) previewArea.classList.add('hidden'); // Hide preview while loading
        if (signSection) signSection.classList.add('hidden'); // Hide sign section
        if (signSelector) signSelector.disabled = true; // Ensure selector is disabled

        const contractAddress = category === 'GHN' ? GHN_CONTRACT : AHC_CONTRACT;
        const contract = new ethers.Contract(contractAddress, ABI, provider);

        try {
            updateStatus("Attempting to fetch token URI...");
            let tokenUri = await contract.tokenURI(tokenId);
            tokenUri = resolveIpfsUrl(tokenUri); // Convert IPFS URI if necessary
            if (!tokenUri) throw new Error("Token URI is missing or invalid.");
            console.log("Resolved Token URI:", tokenUri.substring(0, 100) + "...");

            updateStatus("Fetching NFT metadata...");
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort("Metadata fetch timeout"), 15000); // 15s timeout
            const response = await fetch(tokenUri, { signal: controller.signal });
            clearTimeout(timeoutId); // Clear timeout if fetch succeeds
            if (!response.ok) throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
            const metadata = await response.json();
            console.log("Metadata fetched successfully");

            let imageUrl = resolveIpfsUrl(metadata.image || metadata.image_url || metadata.imageUrl); // Find image URL
            if (!imageUrl) throw new Error("Image URL not found in metadata.");
            console.log("Resolved Image URL:", imageUrl.substring(0, 100) + "...");

            updateStatus("Loading NFT image...");
            // Use 'anonymous' for CORS compatibility if fetching from different origins
            const img = await loadImagePromise(imageUrl, "anonymous");
            loadedNftImage = img; // Store the loaded image

            updateStatus(`NFT #${tokenId} loaded! Now pick a sign overlay.`, true);
            if (previewCtx) drawScaledImage(previewCtx, loadedNftImage); // Draw preview
            if (previewArea) previewArea.classList.remove('hidden'); // Show preview area

            // Populate sign selector for the current category
            if (signData[category] && signData[category].length > 0) {
                populateSignSelector(category);
                updateSignPrompt(); // Update prompt text
                if (signSection) signSection.classList.remove('hidden'); // Show sign selection section
            } else {
                showError(`Aw jeez! No signs configured for the ${category} category.`);
                if (signSection) signSection.classList.add('hidden');
            }
            disableGenerateButton("Select a sign"); // Keep generate disabled until sign is chosen

        } catch (err) {
            console.error(`Error loading NFT #${tokenId}:`, err);
            let userMessage = `Failed to load NFT #${tokenId}. ${err.message || 'Unknown error.'}`;
            if (err.name === 'AbortError') {
                userMessage = `Error: Metadata request timed out. The server might be slow or the link broken.`;
            } else if (err.message?.toLowerCase().includes('invalid tokenid') || err.message?.toLowerCase().includes('uri query for nonexistent token') || err.message?.includes('reverted')) {
                 userMessage = `Error: Token ID #${tokenId} might not exist in the ${category} collection. Double-check the ID.`;
            } else if (err.message?.includes('fetch')) {
                 userMessage = `Network Error: Couldn't reach the server for metadata or image. Check connection or try later.`;
            } else if (err.message?.includes('Image load failed')) {
                userMessage = `Error: Couldn't load the NFT image from the source. It might be broken.`;
            }
             showError(userMessage);
            loadedNftImage = null; // Reset loaded image
            if (previewCtx) clearCanvas(previewCtx);
            if (previewArea) previewArea.classList.add('hidden');
            if (signSection) signSection.classList.add('hidden');
            disableGenerateButton("NFT Load Failed!"); // Disable generate button on failure
        } finally {
            hideLoader();
            setProcessing(false);
        }
    }

     async function handleSignChange() {
         console.log("Sign selection changed");
         if (isProcessing || !signSelector || !loadedNftImage) return; // Ensure NFT is loaded and not busy

         currentSignUrl = signSelector.value; // Get selected sign URL
         console.log("Selected sign URL:", currentSignUrl || "None");

         if (currentSignUrl) {
             // Apply the selected sign to both preview and final canvases
             await applySignToCanvases(currentSignUrl);
         } else {
             // If "-- Select Sign --" is chosen, reset preview to original NFT
             if (previewCtx) drawScaledImage(previewCtx, loadedNftImage);
             // Clear final canvas and redraw original NFT (optional, depends if needed)
             if (finalCtx) {
                 finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
                 // Optionally redraw base image on final canvas if "-- Select Sign --" should allow generating base image
                 // drawScaledImage(finalCtx, loadedNftImage);
             }
             disableGenerateButton("Select a sign"); // Disable generate if no sign selected
             updateStatus("Select a sign overlay.", false);
         }
     }

     async function applySignToCanvases(signUrl) {
         console.log("Applying sign:", signUrl);
         if (!loadedNftImage || !previewCtx || !finalCtx) {
             showError("Internal error: Missing NFT image or canvas context.");
             disableGenerateButton("Error");
             return false; // Indicate failure
         }

         setProcessing(true);
         showLoader();
         updateStatus("Applying sign preview...");
         hideError();
         disableGenerateButton("Applying Sign...");

         try {
             // Load the sign image (ensure CORS compatibility)
             const signImg = await loadImagePromise(signUrl, "anonymous");

             // Prepare the final canvas (high resolution)
             finalCtx.clearRect(0, 0, finalCanvas.width, finalCanvas.height);
             // Optional: Fill background if needed (e.g., if NFT has transparency)
             // finalCtx.fillStyle = '#000'; // Or use a theme color
             // finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
             drawScaledImage(finalCtx, loadedNftImage); // Draw base NFT image scaled
             finalCtx.drawImage(signImg, 0, 0, finalCanvas.width, finalCanvas.height); // Overlay sign
             console.log("Final canvas updated with sign.");

             // Check for canvas tainting (security measure)
             let tainted = false;
             try {
                 finalCtx.getImageData(0, 0, 1, 1); // Attempt to read pixel data
                 console.log("Canvas is not tainted. Proceeding with preview.");
             } catch (e) {
                 if (e.name === "SecurityError") {
                     tainted = true;
                     console.error("CANVAS TAINTED! SecurityError:", e);
                     showError(`Security Error! Canvas is tainted, likely due to CORS issues with the sign or NFT image. Download may fail.`);
                     disableGenerateButton("Canvas Tainted!"); // Prevent generation
                 } else {
                     throw e; // Re-throw other errors
                 }
             }

             if (!tainted) {
                 // Update the preview canvas (low resolution) from the final canvas
                 previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
                 previewCtx.drawImage(finalCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
                 console.log("Preview canvas updated from final canvas.");
                 updateStatus("Preview updated. Ready to Generate!", true);
                 enableGenerateButton(); // Enable the generate button
                 return true; // Indicate success
             } else {
                 // If tainted, only show the base image in preview as we can't show the combined one reliably
                 drawScaledImage(previewCtx, loadedNftImage);
                 return false; // Indicate failure due to taint
             }

         } catch (err) {
             console.error('Error applying sign:', err);
             showError(`Failed to apply sign preview! ${err.message}.`);
             // Reset preview to base image on error
             if (previewCtx && loadedNftImage) drawScaledImage(previewCtx, loadedNftImage);
             disableGenerateButton("Sign Apply Error");
             return false; // Indicate failure
         } finally {
             hideLoader();
             setProcessing(false);
         }
     }


     function populateSignSelector(category) {
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

         disableGenerateButton("Select a sign"); // Ensure generate is disabled initially
     }

    function resolveIpfsUrl(url) {
        if (typeof url !== 'string') return null;
        if (url.startsWith("ipfs://")) {
            // Use a public IPFS gateway
            return url.replace("ipfs://", "https://ipfs.io/ipfs/");
            // Alternative gateways:
            // return url.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/");
            // return url.replace("ipfs://", "https://cloudflare-ipfs.com/ipfs/");
        }
        // Assume it's already an HTTP(S) URL or needs no modification
        return url;
    }

     function loadImagePromise(src, crossOrigin = null) {
         return new Promise((resolve, reject) => {
             if (!src || typeof src !== 'string' || !src.startsWith('http')) {
                 return reject(new Error(`Invalid or non-HTTP(S) image URL provided: ${src}`));
             }
             const img = new Image();
             if (crossOrigin) {
                 // Setting crossOrigin attribute for CORS compatibility
                 img.crossOrigin = crossOrigin; // Use "anonymous" or "use-credentials"
             }
             img.onload = () => {
                 console.log(`Image loaded successfully: ${src.substring(0, 60)}...`);
                 resolve(img);
             };
             img.onerror = (e) => {
                 console.error(`Failed to load image: ${src}`, e);
                 reject(new Error(`Image load failed! Check URL and network.`));
             };
             console.log(`Attempting to load image: ${src.substring(0, 60)}...`);
             img.src = src;
         });
     }

     function drawScaledImage(ctx, img) {
         if (!ctx || !img?.naturalWidth || img.naturalWidth === 0) {
             console.warn("Cannot draw image: Invalid context or image dimensions.");
             return;
         }
         const canvas = ctx.canvas;
         const hRatio = canvas.width / img.naturalWidth;
         const vRatio = canvas.height / img.naturalHeight;
         // Use Math.min to fit the image within the canvas while maintaining aspect ratio
         const ratio = Math.min(hRatio, vRatio);
         const scaledWidth = img.naturalWidth * ratio;
         const scaledHeight = img.naturalHeight * ratio;
         // Calculate center position
         const centerX = (canvas.width - scaledWidth) / 2;
         const centerY = (canvas.height - scaledHeight) / 2;

         // Clear canvas and set background (optional, good for transparency)
         ctx.clearRect(0, 0, canvas.width, canvas.height);
         const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--medium-dark').trim() || '#2a2a3a';
         ctx.fillStyle = bgColor;
         ctx.fillRect(0, 0, canvas.width, canvas.height);

         // Draw the scaled and centered image
         ctx.drawImage(
             img,                // Source image
             0, 0,               // Source x, y
             img.naturalWidth,   // Source width
             img.naturalHeight,  // Source height
             centerX, centerY,   // Destination x, y
             scaledWidth,        // Destination width
             scaledHeight        // Destination height
         );
     }

     // Function called by the "Generate" button click
     function handleGenerateClick() {
         console.log("Generate button clicked");
         if (isProcessing || !loadedNftImage || !currentSignUrl || (generateButton && generateButton.disabled)) {
             showError("Cannot generate. Make sure NFT is loaded, a sign is selected, and there are no errors (like canvas taint).");
             return;
         }
         // Initiate the download process
         handleDownloadLogic();
     }

     // Handles the logic for creating and triggering the download
     function handleDownloadLogic() {
         console.log("Initiating download logic...");
         if (isProcessing || !finalCtx || !loadedNftImage || !finalCanvas) {
             showError("Cannot download image at this moment. Please wait or check errors.");
             return;
         }

         let downloadInitiated = false;
         try {
             console.log("Checking final canvas state before download...");
             // Attempt to read pixel data to detect potential tainting *before* generating data URL
             finalCtx.getImageData(0, 0, 1, 1);
             console.log("Final canvas appears usable. Generating image data URL...");

             // Generate the data URL for the image (PNG format)
             const dataURL = finalCanvas.toDataURL('image/png');
             if (!dataURL || dataURL.length < 100) { // Basic check for empty/invalid URL
                 throw new Error("Generated data URL is empty or invalid.");
             }

             // Create a temporary link element for download
             const link = document.createElement('a');

             // Construct filename
             let filename = 'Ticuvs-Signed-NFT.png'; // Default filename
             const selectedOption = signSelector?.options[signSelector.selectedIndex];
             const tokenIdValue = tokenIdInput?.value || 'unknown-id';

             if (currentCategory && selectedOption?.value) {
                 // Sanitize sign name for filename
                 const slug = (text) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
                 const signNameSlug = slug(selectedOption.textContent);
                 filename = `Ticuv-${currentCategory}-${tokenIdValue}-Sign-${signNameSlug}.png`;
             } else if (currentCategory) {
                  // Fallback filename if sign isn't selected properly (shouldn't happen if button is enabled)
                 filename = `Ticuv-${currentCategory}-${tokenIdValue}-Signed.png`;
             }

             link.href = dataURL;
             link.download = filename;

             // Trigger the download
             document.body.appendChild(link); // Required for Firefox
             link.click();
             document.body.removeChild(link); // Clean up the link

             console.log('Download initiated for file:', filename);
             updateStatus("Schwifty! Download started successfully!", true);
             downloadInitiated = true;

         } catch (error) {
              console.error('Download failed:', error);
              if (error.name === "SecurityError") {
                  showError(`Download FAILED! The canvas is tainted due to cross-origin image loading (CORS). Cannot save the image.`);
              } else {
                  showError(`Download FAILED! An error occurred: ${error.message}.`);
              }
              // Do not show modal if download failed
              downloadInitiated = false;
         }

         // Show the share modal only if the download was successfully initiated
         if (downloadInitiated) {
              console.log(`Download triggered, showing share modal after ${SHARE_MODAL_DELAY}ms delay.`);
              setTimeout(showShareModal, SHARE_MODAL_DELAY);
         }
     }


    // ==================================
    //        UI HELPER FUNCTIONS
    // ==================================
     function showError(message) {
         if (!errorMessage || !statusMessage) return;
         const shortMessage = message.substring(0, 250) + (message.length > 250 ? "..." : "");
         errorMessage.textContent = `Error! ${shortMessage}`;
         errorMessage.classList.remove('hidden');
         statusMessage.classList.remove('success'); // Ensure status is not marked as success
         // Trigger shake animation
         errorMessage.style.animation = 'none'; // Reset animation
         void errorMessage.offsetWidth; // Trigger reflow
         errorMessage.style.animation = 'shake-rick 0.4s linear infinite';
         // Stop animation after a short period
         setTimeout(() => {
             if (errorMessage) errorMessage.style.animation = 'none';
         }, 800); // Stop shaking after 2 cycles
     }

     function hideError() {
         if (!errorMessage) return;
         errorMessage.classList.add('hidden');
         errorMessage.textContent = '';
         errorMessage.style.animation = 'none'; // Ensure animation is stopped
     }

     function updateStatus(message, isSuccess = false) {
         if (!statusMessage) return;
         statusMessage.textContent = message;
         statusMessage.className = isSuccess ? 'success' : '';
         if (isSuccess) {
             hideError(); // Clear any previous errors on success
         }
     }

     function clearCanvas(context) {
         if (!context) return;
         const canvas = context.canvas;
         context.clearRect(0, 0, canvas.width, canvas.height);
         // Optionally fill with background color
         const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--medium-dark').trim() || '#2a2a3a';
         context.fillStyle = bgColor;
         context.fillRect(0, 0, canvas.width, canvas.height);
     }

     function showLoader() { if (loader) loader.classList.remove('hidden'); }
     function hideLoader() { if (loader) loader.classList.add('hidden'); }

     function setProcessing(state) {
         isProcessing = state;
         // Disable/Enable form elements based on processing state
         if (categoryRadios) categoryRadios.forEach(r => r.disabled = state);
         if (tokenIdInput) tokenIdInput.disabled = state || !currentCategory; // Keep disabled if no category
         if (loadNftButton) {
             loadNftButton.disabled = state || !currentCategory; // Keep disabled if no category
             loadNftButton.classList.toggle('disabled', loadNftButton.disabled);
         }
         if (signSelector) signSelector.disabled = state || !loadedNftImage; // Keep disabled if no image loaded
         // Only disable generate button based on state; enabling is handled elsewhere
         if (state && generateButton) {
             generateButton.disabled = true;
             generateButton.classList.add('disabled');
             generateButton.title = "Processing...";
         }
     }

     function updateSignPrompt() {
         if (!signPrompt) return;
         const randomIndex = Math.floor(Math.random() * funnyQuips.length);
         signPrompt.textContent = `Step 3: ${funnyQuips[randomIndex]}`;
     }

     function enableGenerateButton() {
         if (generateButton && loadedNftImage && currentSignUrl) {
             // Check if it was disabled due to specific errors like taint
             const isErrorDisabled = generateButton.title === "Canvas Tainted!" ||
                                     generateButton.title === "Sign Apply Error" ||
                                     generateButton.title === "NFT Load Failed!";
             if (!isErrorDisabled) {
                 generateButton.disabled = false;
                 generateButton.classList.remove('hidden', 'disabled');
                 generateButton.title = "Generate Signed Image"; // Set appropriate title
                 console.log("Generate button enabled.");
             } else {
                 console.log(`Generate button remains disabled due to error: ${generateButton.title}`);
             }
         } else {
             // If conditions not met, ensure it's disabled (might be redundant but safe)
             disableGenerateButton(generateButton.title || "Waiting for input...");
         }
     }

     function disableGenerateButton(reason = "Working...") {
         if (generateButton) {
             generateButton.disabled = true;
             generateButton.classList.add('disabled');
             // Keep it visible if the sign section is visible, otherwise hide
             if (signSection && !signSection.classList.contains('hidden')) {
                 generateButton.classList.remove('hidden');
             } else {
                 generateButton.classList.add('hidden');
             }
             generateButton.title = reason; // Set tooltip for reason
             console.log("Generate button disabled:", reason);
         }
     }

     function resetInterface(isInitialLoad = false) {
         console.log("Resetting interface...");
         hideError();
         updateStatus('Select a dimension to start...');
         if (tokenIdInputContainer) tokenIdInputContainer.classList.add('hidden');
         if (previewArea) previewArea.classList.add('hidden');
         if (signSection) signSection.classList.add('hidden');
         if (generateButton) generateButton.classList.add('hidden', 'disabled');

         loadedNftImage = null;
         currentSignUrl = null;
         if (previewCtx) clearCanvas(previewCtx);
         if (finalCtx) clearCanvas(finalCtx);

         if (categoryRadios) {
             categoryRadios.forEach(r => {
                 r.checked = false;
                 // Disable only if provider failed on initial load
                 r.disabled = isInitialLoad && !provider;
             });
         }
         if (tokenIdInput) {
             tokenIdInput.value = '';
             tokenIdInput.placeholder = '...';
             tokenIdInput.disabled = true;
         }
         if (loadNftButton) {
             loadNftButton.disabled = true;
             loadNftButton.classList.add('disabled');
         }
         if (signSelector) {
             signSelector.innerHTML = ''; // Clear options
             signSelector.disabled = true;
         }
         currentCategory = null;
         setProcessing(false); // Ensure processing state is reset
         hideLoader();
         hideShareModal(); // Ensure modal is hidden

         if (isInitialLoad && !provider) {
             showError("Failed to initialize Ethereum provider. Functionality may be limited.");
         }
     }


    // ==================================
    //        INITIAL SETUP
    // ==================================
    // Use DOMContentLoaded to ensure HTML is parsed before running script
    document.addEventListener('DOMContentLoaded', async () => {
         console.log("DOMContentLoaded event fired.");

         // Initialize the Ethereum provider first
         const providerOk = initializeProvider();

          // Load the sign configuration from JSON file
         const configOk = await loadAndProcessSignConfig(); // Await the async fetch

         // Reset the UI based on initialization status
         resetInterface(true); // Pass true for initial load

         // Add all event listeners
         addEventListeners(); // Includes Clipboard.js initialization

         if (providerOk && configOk) {
             console.log("SignOMatic V8 Initialized Successfully.");
             // Re-enable radio buttons if everything loaded correctly
             if (categoryRadios) categoryRadios.forEach(r => r.disabled = false);
              updateStatus('Select a dimension to begin your artistic journey!');
         } else {
             console.warn("SignOMatic V8 initialized with errors (Provider or Config failed).");
              if (!providerOk) showError("Ethereum provider failed to load. Check console.");
              if (!configOk) showError("Failed to load or parse signs.json configuration.");
              // Keep controls disabled if init failed
              if (categoryRadios) categoryRadios.forEach(r => r.disabled = true);
         }
    });

    console.log("SignOMatic Script V8 execution finished.");

})(); // End of IIFE
