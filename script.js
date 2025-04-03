// Wrap script in an IIFE
(function() {
    // --- DOM Element Selections (Keep these the same) ---
    const imageUpload = document.getElementById('imageUpload');
    const imageInfo = document.getElementById('imageInfo');
    const errorMessage = document.getElementById('errorMessage');
    const controlsSection = document.getElementById('controlsSection');
    const previewArea = document.getElementById('previewArea');
    const previewCanvas = document.getElementById('previewCanvas');
    const finalCanvas = document.getElementById('finalCanvas');
    const categoryRadios = document.querySelectorAll('input[name="category"]');
    const signSelectorContainer = document.getElementById('signSelectorContainer');
    const signSelector = document.getElementById('signSelector');
    const downloadButton = document.getElementById('downloadButton');
    const signPrompt = document.getElementById('signPrompt'); // Target for quips
    const uploadSection = document.getElementById('uploadSection');
    const loader = document.getElementById('loader');

    // --- Contexts ---
    const previewCtx = previewCanvas.getContext('2d');
    const finalCtx = finalCanvas.getContext('2d');

    // --- Constants and State ---
    const REQUIRED_WIDTH = 2048;
    const REQUIRED_HEIGHT = 2048;
    let currentCategory = null;
    let baseImageDataUrl = null;
    let isProcessing = false;

    // --- Funny Quips (Replace "Morty") ---
    const funnyQuips = [
        "Pick a sign, you glorious pixel sponge!",
        "Pick a sign, or the space hamsters revolt!",
        "Choose wisely... the multiverse is watching (and judging).",
        "Select a sign, *burp*, before Ticuv gets annoyed.",
        "Overlay this garbage, c'mon!",
        "Just pick one, fleeb! It's not that hard!",
        "This sign better be good, or you're getting squanched.",
        "Designate the emblem, or face the wrath of Ticuv!"
    ];

    // --- Sign Data ---
    // Updated to use relative paths from the GitHub repository structure
    const signData = {
        AHC: [
            { name: "AHC - Ape Sign", url: "images/AHC/ape.png" },
            // You might want to download and add the other AHC images locally too
            { name: "AHC - Blips and Chitz Placeholder", url: "images/placeholderAHC2.png" }, // Needs local file
            { name: "AHC - Anatomy Park Placeholder", url: "images/placeholderAHC3.png" }  // Needs local file
        ],
        GHN: [
            { name: "GHN - Daniel Sign", url: "images/GHN/daniel.png" },
            { name: "GHN - Duko Sign", url: "images/GHN/duko.png" },
            { name: "GHN - MC Sign", url: "images/GHN/mc.png" },
            // You might want to add a 4th GHN image locally
            { name: "GHN - Placeholder Zone", url: "images/placeholderGHN4.png" } // Needs local file
        ]
    };


    // --- Event Listeners (Keep functional) ---
    imageUpload.addEventListener('change', handleFileSelect);
    categoryRadios.forEach(radio => radio.addEventListener('change', handleCategoryChange));
    signSelector.addEventListener('change', handleSignChange);
    downloadButton.addEventListener('click', handleDownload);
    uploadSection.addEventListener('dragover', handleDragOver);
    uploadSection.addEventListener('dragleave', handleDragLeave);
    uploadSection.addEventListener('drop', handleDrop);

    // ==================================
    //        CORE FUNCTIONS
    // ==================================

    function handleFileSelect(event) {
        const file = event.target.files ? event.target.files[0] : null;
        if (file) {
            processImageFile(file);
        }
    }

    function processImageFile(file) {
         if (isProcessing) return;
         setProcessing(true);
         showLoader();
         resetInterfaceOnUpload();
         disableDownloadButton("Checking your junk..."); // Ticuv text

        if (!file) {
            updateInfo('No file? Come on, shleemypants!');
            hideLoader();
            setProcessing(false);
            return;
        }

        if (!['image/jpeg', 'image/png'].includes(file.type)) {
            showError('Wrong file type, smoothbrain! PNG or JPG!');
            resetUploadInput();
            hideLoader();
            setProcessing(false);
            return;
        }

        updateInfo(`Analyzing "${file.name}"... Don't Bork it up.`);

        const reader = new FileReader();
        reader.onload = function(e) {
            const tempImg = new Image();
            tempImg.onload = function() {
                if (tempImg.naturalWidth !== REQUIRED_WIDTH || tempImg.naturalHeight !== REQUIRED_HEIGHT) {
                    showError(`WRONG SIZE! Need ${REQUIRED_WIDTH}x${REQUIRED_HEIGHT}px! You brought ${tempImg.naturalWidth}x${tempImg.naturalHeight}px junk!`);
                    resetUploadInput();
                    clearCanvas(previewCtx);
                    clearCanvas(finalCtx);
                    previewArea.classList.add('hidden');
                } else {
                    hideError();
                    baseImageDataUrl = e.target.result;
                    updateInfo(`"${file.name}" validated! Barely. Pick a dimension!`, true);
                    clearCanvas(previewCtx);
                    previewCtx.drawImage(tempImg, 0, 0, previewCanvas.width, previewCanvas.height);
                    previewArea.classList.remove('hidden');
                    controlsSection.classList.remove('hidden');
                    // Important: Reset sign selection and disable download until a sign is chosen/applied
                    signSelector.innerHTML = '';
                    signSelectorContainer.classList.add('hidden');
                    categoryRadios.forEach(radio => radio.checked = false);
                    currentCategory = null;
                    disableDownloadButton("Pick a dimension first!");
                }
                hideLoader();
                setProcessing(false);
            };
            tempImg.onerror = function() {
                showError('This image is busted! Like your last invention.');
                resetInterface(); // Full reset on critical image load error
                hideLoader();
                setProcessing(false);
            };
            tempImg.src = e.target.result;
        };
        reader.onerror = function() {
            showError('File Read Error! Dropped it in the portal fluid?');
            resetInterface(); // Full reset on file read error
            hideLoader();
            setProcessing(false);
        };
        reader.readAsDataURL(file);
    }

    function handleCategoryChange(event) {
        if (isProcessing || !baseImageDataUrl) return; // Don't process if busy or no base image
        currentCategory = event.target.value;
        console.log('Dimension selected:', currentCategory);
        disableDownloadButton("Pick the sign, slowpoke!");
        updateSignPrompt();

        populateSignSelector(currentCategory);
        signSelectorContainer.classList.remove('hidden');

        // Automatically apply the first available sign of the selected category
        const firstAvailableSign = signData[currentCategory]?.find(sign => !sign.url.includes('placeholder') && sign.url.endsWith('.png'));
        if (firstAvailableSign) {
            applySign(firstAvailableSign.url);
        } else {
             console.error("No valid default sign found for category:", currentCategory);
             showError("Error! No valid signs defined for this dimension! Ticuv is slacking.");
             // Clear potential previous preview and disable download
             clearCanvas(previewCtx);
             clearCanvas(finalCtx); // Also clear final canvas
             // Attempt to redraw base image if available
             if (baseImageDataUrl) {
                 loadImagePromise(baseImageDataUrl).then(baseImage => {
                     finalCtx.drawImage(baseImage, 0, 0, finalCanvas.width, finalCanvas.height);
                     previewCtx.drawImage(baseImage, 0, 0, previewCanvas.width, previewCanvas.height);
                 }).catch(err => console.error("Error redrawing base image:", err));
             }
             disableDownloadButton("No signs here!");
        }
    }


    function handleSignChange() {
        if (isProcessing || !baseImageDataUrl) return;
        const selectedSignUrl = signSelector.value;
        if (selectedSignUrl) {
             applySign(selectedSignUrl);
        }
    }

     function populateSignSelector(category) {
        signSelector.innerHTML = ''; // Clear previous options
        const signs = signData[category];
        if (!signs || signs.length === 0) {
            // Add a disabled placeholder if no signs exist
            const option = document.createElement('option');
            option.disabled = true;
            option.selected = true;
            option.textContent = "No signs found for this category!";
            signSelector.appendChild(option);
            signSelector.disabled = true; // Disable selector
            return;
        };

        signSelector.disabled = false; // Ensure selector is enabled
        signs.forEach((sign) => {
            const option = document.createElement('option');
            option.value = sign.url;
            option.textContent = sign.name;
            // Basic check if URL looks like a placeholder or doesn't end with .png
            if (sign.url.includes('placeholder') || !sign.url.endsWith('.png')) {
                 option.disabled = true;
                 option.textContent += " (Missing)"; // Indicate missing
            }
            signSelector.appendChild(option);
        });

        // Select the first available (non-disabled) option if possible
        const firstAvailableOption = signSelector.querySelector('option:not([disabled])');
        if (firstAvailableOption) {
            signSelector.value = firstAvailableOption.value;
        } else if (signSelector.options.length > 0) {
             signSelector.selectedIndex = 0; // Select the first (likely disabled) if none are available
        }
    }

    // No changes needed in loadImagePromise, it should handle relative paths fine
     function loadImagePromise(src, crossOrigin = null) {
        return new Promise((resolve, reject) => {
            if (!src || src === '#') return reject(new Error('Bad image source. Elementary, my dear Flargan.'));
            const img = new Image();
            // IMPORTANT: Do NOT set crossOrigin for relative paths (same-origin images)
            // Only set it if the src is an absolute URL (http:// or https://)
            if (crossOrigin && (src.startsWith('http://') || src.startsWith('https://'))) {
                 img.crossOrigin = crossOrigin;
            }
            img.onload = () => resolve(img);
            img.onerror = (err) => {
                console.error(`Failed loading image: ${src}`, err);
                // Provide a more specific error for local files
                const errorMsg = (src.startsWith('http') ?
                    `Image load failed! Check the interdimensional router! (${src.substring(0, 60)}...)` :
                    `Image load failed! Is "${src}" in the correct 'images' folder and uploaded to GitHub?`);
                reject(new Error(errorMsg));
            };
            img.src = src;
        });
    }

    async function applySign(signUrl) {
        if (!baseImageDataUrl) {
            showError("Upload an image FIRST! Are you a Gazorpian?");
            return;
        }
        // More robust check for invalid/missing URLs
        if (!signUrl || signUrl.includes('placeholder') || !signUrl.endsWith('.png')) {
            showError("Invalid or missing sign URL selected. Can't apply.");
            // Reset preview to show only base image if possible
            if (baseImageDataUrl) {
                try {
                    const baseImage = await loadImagePromise(baseImageDataUrl);
                    clearCanvas(finalCtx);
                    finalCtx.drawImage(baseImage, 0, 0, finalCanvas.width, finalCanvas.height);
                    clearCanvas(previewCtx);
                    previewCtx.drawImage(finalCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
                } catch (err) {
                     console.error("Error resetting preview with base image:", err);
                     clearCanvas(previewCtx);
                     clearCanvas(finalCtx);
                }
            } else {
                clearCanvas(previewCtx);
                clearCanvas(finalCtx);
            }
            disableDownloadButton("Select a valid sign!");
            return;
        }
         if (isProcessing) return;

         setProcessing(true);
         showLoader();
         console.log(`Applying sign: ${signUrl}`);
         updateInfo("Slapping that sign on... *burp*... Ticuv style.");
         hideError();
         disableDownloadButton("Rendering... Don't touch anything!");

        try {
            // Load base image first to always have it available
            const baseImage = await loadImagePromise(baseImageDataUrl);

            // Attempt to load the sign image
            const signImage = await loadImagePromise(signUrl); // No crossOrigin needed for relative paths

            // Clear and draw base image first
            clearCanvas(finalCtx);
            finalCtx.drawImage(baseImage, 0, 0, finalCanvas.width, finalCanvas.height);

            // Draw the sign overlay
            let dx = 0; let dy = 0;
            finalCtx.drawImage(signImage, dx, dy, finalCanvas.width, finalCanvas.height);
            console.log('Final canvas done.');

            // Since images are same-origin now, tainting shouldn't occur.
            // We can directly enable download and update preview.
            enableDownloadButton();
            updateInfo("Overlay complete! Bask in its mediocre glory!", true);

            clearCanvas(previewCtx);
            previewCtx.drawImage(finalCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
            console.log('Preview canvas updated.');

        } catch (error) {
            // Catch errors from loadImagePromise (e.g., image not found)
            console.error('Error during image processing:', error);
            showError(`Sign Processing FAILED! ${error.message}. Ticuv saw that.`);

            // Reset preview to show only base image on error
            try {
                const baseImgForError = await loadImagePromise(baseImageDataUrl);
                clearCanvas(previewCtx);
                clearCanvas(finalCtx);
                finalCtx.drawImage(baseImgForError, 0, 0, finalCanvas.width, finalCanvas.height);
                previewCtx.drawImage(baseImgForError, 0, 0, previewCanvas.width, previewCanvas.height);
            } catch (baseLoadError) {
                 console.error("Failed to load base image even for error display:", baseLoadError);
                 clearCanvas(previewCtx); // Clear everything if base fails too
                 clearCanvas(finalCtx);
            }

            disableDownloadButton("Error! Try Again?");
        } finally {
             hideLoader();
             setProcessing(false);
        }
    }

    // No changes needed in handleDownload, as canvas tainting should be resolved
    function handleDownload() {
         if (downloadButton.classList.contains('disabled') || isProcessing) return;

         try {
             // Check if final canvas actually has content (basic check)
             // A more robust check might be needed, but this catches empty canvas.
              const pixelData = finalCtx.getImageData(0, 0, 1, 1).data;
              if (pixelData[3] === 0 && baseImageDataUrl == null) { // Check alpha and if base image was ever loaded
                  throw new Error("Canvas is empty or only contains transparent pixels!");
              }

             const dataURL = finalCanvas.toDataURL('image/png');
             const link = document.createElement('a');

             let filename = 'Ticuvs-Magnificent-Overlay.png';
             const selectedSignOption = signSelector.options[signSelector.selectedIndex];
             // Ensure selected option exists and is not disabled before generating filename
             if (currentCategory && selectedSignOption && selectedSignOption.textContent && !selectedSignOption.disabled) {
                 const slugify = (text) => text.toLowerCase()
                   .replace(/\s+/g, '-') // Replace spaces with -
                   .replace(/-*\(missing\)-*/g, '') // Remove (missing) indicator
                   .replace(/[^\w-]+/g, '') // Remove all non-word chars except -
                   .replace(/--+/g, '-') // Replace multiple - with single -
                   .replace(/^-+/, '') // Trim - from start
                   .replace(/-+$/, ''); // Trim - from end
                 const signNameSlug = slugify(selectedSignOption.textContent);
                 if (signNameSlug) { // Ensure slug is not empty after processing
                     filename = `Ticuv-${currentCategory}-Sign-${signNameSlug}.png`;
                 }
             }

             link.href = dataURL;
             link.download = filename;

             document.body.appendChild(link);
             link.click();
             document.body.removeChild(link);
             console.log('Download initiated:', filename);
             updateInfo("Downloaded! Now scram!", true);

         } catch (error) {
              console.error('Canvas download failed:', error);
               // SecurityError should not happen with same-origin images
              showError(`Download FAILED! ${error.message}. Maybe the canvas hates you.`);
         }
    }


    // ==================================
    //      DRAG & DROP HANDLERS (Keep functional)
    // ==================================

    function handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        uploadSection.classList.add('drag-over');
    }

    function handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        uploadSection.classList.remove('drag-over');
    }

    function handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        uploadSection.classList.remove('drag-over');

        const files = event.dataTransfer.files;
        if (files.length > 0) {
            // Set the files property of the hidden file input
            imageUpload.files = files;
             // Trigger the change event manually
            const changeEvent = new Event('change', { bubbles: true });
            imageUpload.dispatchEvent(changeEvent);
            // processImageFile(files[0]); // No longer needed directly, handled by change event
        }
    }

    // ==================================
    //        UI HELPER FUNCTIONS
    // ==================================

    function showError(message) {
        errorMessage.textContent = `Error! ${message}`;
        errorMessage.classList.remove('hidden');
        imageInfo.classList.remove('success'); // Ensure info text isn't styled as success
        // Start shake animation only when an error is shown
        errorMessage.style.animation = 'shake-rick 0.4s linear infinite';
    }

    function hideError() {
        errorMessage.classList.add('hidden');
        errorMessage.textContent = '';
        errorMessage.style.animation = 'none'; // Stop animation when hiding
    }

    function updateInfo(message, isSuccess = false) {
         imageInfo.textContent = message;
         imageInfo.className = isSuccess ? 'success' : '';
         // If we're updating info (especially success), hide any previous error
         if (!errorMessage.classList.contains('hidden')) {
            hideError();
         }
    }

    function resetUploadInput() {
        imageUpload.value = ''; // Clears the selected file
    }

    function clearCanvas(context) {
         context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }

    function enableDownloadButton() {
        downloadButton.classList.remove('hidden', 'disabled');
        downloadButton.title = "Click it already!";
    }

    function disableDownloadButton(reason = "Working... Don't rush genius!") {
        // Make sure button is visible before disabling if needed
        if (controlsSection.classList.contains('hidden')) {
             downloadButton.classList.add('hidden');
        } else {
             downloadButton.classList.remove('hidden');
        }
        downloadButton.classList.add('disabled');
        downloadButton.title = reason;
    }

    function showLoader() {
         loader.classList.remove('hidden');
    }

    function hideLoader() {
         loader.classList.add('hidden');
    }

     function setProcessing(state) {
         isProcessing = state;
         imageUpload.disabled = state;
         categoryRadios.forEach(r => r.disabled = state);
         signSelector.disabled = state;
         // Also disable download button while processing
         if (state) {
            disableDownloadButton("Processing...");
         }
         // Note: Enabling the download button is now handled explicitly in applySign on success
         // or potentially needs re-evaluation based on state after processing if error occurred.
     }

    function updateSignPrompt() {
         const randomIndex = Math.floor(Math.random() * funnyQuips.length);
         signPrompt.textContent = `Step 3: ${funnyQuips[randomIndex]}`;
    }

    /** Full interface reset */
    function resetInterface() {
         hideError();
         controlsSection.classList.add('hidden');
         previewArea.classList.add('hidden');
         signSelectorContainer.classList.add('hidden');
         downloadButton.classList.add('hidden','disabled');
         baseImageDataUrl = null;
         clearCanvas(previewCtx);
         clearCanvas(finalCtx);
         categoryRadios.forEach(radio => { radio.checked = false; radio.disabled = false; });
         signSelector.innerHTML = '';
         signSelector.disabled = false;
         currentCategory = null;
         updateInfo('Waiting for your pathetic image...');
         resetUploadInput();
         imageUpload.disabled = false;
         setProcessing(false);
         hideLoader();
     }

     /** Partial reset for new upload attempt */
     function resetInterfaceOnUpload() {
         hideError();
         // Keep controls hidden until image is validated
         controlsSection.classList.add('hidden');
         signSelectorContainer.classList.add('hidden');
         previewArea.classList.add('hidden');
         downloadButton.classList.add('hidden', 'disabled');
         baseImageDataUrl = null; // Clear previous base image data
         clearCanvas(previewCtx);
         clearCanvas(finalCtx);
         // Don't reset radios/selector yet, wait for validation
         currentCategory = null;
         updateInfo('Processing upload... Don\'t break Ticuv\'s stuff.');
     }

    // --- Initial State Setup ---
    resetInterface(); // Start clean (and chaotic Ticuv style)

})(); // End of IIFE