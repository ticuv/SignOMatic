// --- Global Constants ---
const canvasWidth = 2048;
const canvasHeight = 2048;
const nftContracts = {
    "GHN": { address: "0xe6d48bf4ee912235398b96e16db6f310c21e82cb", name: "GHN" },
    "AHC": { address: "0x9370045ce37f381500ac7d6802513bb89871e076", name: "AHC" }
};
const nftAbi = ["function tokenURI(uint256 tokenId) public view returns (string)"];
// Asigură-te că Ethers.js este încărcat din HTML înainte de a folosi 'ethers'
const provider = new ethers.JsonRpcProvider("https://eth.llamarpc.com");

// --- Global State ---
let baseImage = new Image();
let activeElement = null;
let textInteractionState = { isDragging: false, isRotating: false, startX: 0, startY: 0, startLeft: 0, startTop: 0, rotateCenterX: 0, rotateCenterY: 0, rotateStartAngle: 0 };
let imageInteractionState = { isDragging: false, isRotating: false, isResizing: false, startX: 0, startY: 0, startLeft: 0, startTop: 0, centerX: 0, centerY: 0, startAngle: 0, currentRotationRad: 0, startWidth: 0, startHeight: 0, aspectRatio: 1 };

// --- DOM Element References ---
let canvas, ctx, container, textInput, textColor, fontSize, fontFamily, removeBtn, nftStatusEl,
    nftCollectionSelect, nftTokenIdInput, loadNftBtn, applyOverlayBtn, overlayColorInput,
    addTextBtn, addImageBtn, resetCanvasBtn,
    saveFullBtn, saveSignBtn, // Referințe pentru butoanele de salvare
    disclaimerBtn, disclaimerModal, closeDisclaimerBtn;

// --- Initialization ---
window.onload = () => {
    // Get Element References
    canvas = document.getElementById("canvas");
    if (!canvas) return console.error("Canvas element not found!");
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return console.error("Could not get 2D context");

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
    addImageBtn = document.getElementById("addImageBtn");
    resetCanvasBtn = document.getElementById("resetCanvas");
    saveFullBtn = document.getElementById("saveFullBtn");
    saveSignBtn = document.getElementById("saveSignBtn");
    disclaimerBtn = document.getElementById("disclaimerBtn");
    disclaimerModal = document.getElementById("disclaimerModal");
    closeDisclaimerBtn = document.getElementById("closeDisclaimerBtn");

    // Initial Setup
    enableEditingControls(false); // Dezactivează majoritatea controalelor inițial
    clearCanvas();
    setupEventListeners(); // Atașează listenerii după ce elementele sunt disponibile
};

function setupEventListeners() {
    // Verifică existența elementelor înainte de a adăuga listeneri
    if (loadNftBtn) loadNftBtn.addEventListener('click', loadNftToCanvas);
    if (applyOverlayBtn) applyOverlayBtn.addEventListener('click', applyOverlay);
    if (overlayColorInput) overlayColorInput.addEventListener('input', applyOverlay);
    if (addTextBtn) addTextBtn.addEventListener('click', addText);
    if (textInput) textInput.addEventListener("input", handleTextControlChange);
    if (textColor) textColor.addEventListener("input", handleTextControlChange);
    if (fontSize) fontSize.addEventListener("input", handleTextControlChange);
    if (fontFamily) fontFamily.addEventListener("input", handleTextControlChange);
    if (addImageBtn) addImageBtn.addEventListener('click', addImage);
    if (removeBtn) removeBtn.addEventListener('click', removeActiveElement);
    if (resetCanvasBtn) resetCanvasBtn.addEventListener('click', handleReset);
    if (nftCollectionSelect) nftCollectionSelect.addEventListener("change", () => { if (baseImage.src && baseImage.complete) { applyOverlay(); } });

    // Save Listeners
    if (saveFullBtn) saveFullBtn.addEventListener('click', () => saveImage('full'));
    if (saveSignBtn) saveSignBtn.addEventListener('click', () => saveImage('sign'));

    // Disclaimer Modal Listeners
    if (disclaimerBtn && disclaimerModal && closeDisclaimerBtn) {
        disclaimerBtn.addEventListener('click', showComicDisclaimer);
        closeDisclaimerBtn.addEventListener('click', hideComicDisclaimer);
        disclaimerModal.addEventListener('click', (event) => {
            if (event.target === disclaimerModal) hideComicDisclaimer();
        });
    }
}

// --- Event Handlers ---
 function handleTextControlChange() { if(activeElement&&activeElement.classList.contains('textOverlay')){activeElement.childNodes[0].nodeValue=textInput.value;activeElement.style.color=textColor.value;activeElement.style.fontSize=fontSize.value+"px";activeElement.style.fontFamily=fontFamily.value;} }
 function handleReset() { if(confirm("Are you sure you want to clear the canvas and all added elements? This cannot be undone.")){clearCanvasAndOverlays();if(baseImage.src&&baseImage.complete&&baseImage.naturalWidth>0){drawBaseImage();applyOverlay();enableEditingControls(true);}else{enableEditingControls(false);} updateControlState(); nftStatusEl.textContent="Canvas Cleared."; nftStatusEl.className='';} }

// --- Canvas & Overlay Management ---
function clearCanvasAndOverlays() {
    ctx.clearRect(0,0,canvasWidth,canvasHeight);
    ctx.fillStyle='#444'; // Culoare de fundal implicită pentru canvas gol
    ctx.fillRect(0,0,canvasWidth,canvasHeight);
    if(container) {
        container.querySelectorAll('.textOverlay, .imgOverlay').forEach(el=>el.remove());
    }
    setActiveElement(null);
    // Nu reseta statusul aici neapărat, poate fi resetat de funcția apelantă
}

function clearCanvas() {
    ctx.clearRect(0,0,canvasWidth,canvasHeight);
    ctx.fillStyle='#444';
    ctx.fillRect(0,0,canvasWidth,canvasHeight);
}

function enableEditingControls(isEnabled) {
    // Include TOATE elementele controlabile aici
    [overlayColorInput, applyOverlayBtn, textInput, textColor, fontSize, fontFamily,
     addTextBtn, imageUpload, addImageBtn, removeBtn, saveFullBtn, saveSignBtn, resetCanvasBtn // Include reset
    ].forEach(el => { if (el) el.disabled = !isEnabled; });
    // Starea butonului reset poate fi mereu activă dacă vrei, scoate-l din listă
    // if(resetCanvasBtn) resetCanvasBtn.disabled = false;
    updateControlState(); // Actualizează starea detaliată
}

function updateControlState() {
    const isElementActive=activeElement!==null;
    const isTextActive=isElementActive&&activeElement.classList.contains('textOverlay');
    const isImageLoaded=baseImage.src!==""&&baseImage.complete&&baseImage.naturalWidth>0;

    if(textInput)textInput.disabled=!isTextActive||!isImageLoaded;
    if(textColor)textColor.disabled=!isTextActive||!isImageLoaded;
    if(fontSize)fontSize.disabled=!isTextActive||!isImageLoaded;
    if(fontFamily)fontFamily.disabled=!isTextActive||!isImageLoaded;
    if(overlayColorInput)overlayColorInput.disabled=!isImageLoaded;
    if(applyOverlayBtn)applyOverlayBtn.disabled=!isImageLoaded;
    if(addTextBtn)addTextBtn.disabled=!isImageLoaded;
    if(imageUpload)imageUpload.disabled=!isImageLoaded;
    if(addImageBtn)addImageBtn.disabled=!isImageLoaded;
    if(saveFullBtn)saveFullBtn.disabled=!isImageLoaded;
    if(saveSignBtn)saveSignBtn.disabled=!isImageLoaded; // Depinde doar de imaginea încărcată (poate salva doar poligonul)
    if(removeBtn)removeBtn.disabled=!isElementActive||!isImageLoaded;
    // Butonul Reset poate fi mereu activ dacă e scos din enableEditingControls
    // if(resetCanvasBtn) resetCanvasBtn.disabled = false;
}

// --- NFT Loading & Drawing ---
function getPolygonForSelectedCollection(){const selectedCollection=nftCollectionSelect.value;if(selectedCollection==="AHC"){return[{x:1415,y:316},{x:2024,y:358},{x:1958,y:1324},{x:1358,y:1286}];}else{return[{x:1403,y:196},{x:2034,y:218},{x:1968,y:1164},{x:1358,y:1126}];}}
function resolveIpfsUrl(url) { if(url&&url.startsWith("ipfs://")){return url.replace("ipfs://","https://ipfs.io/ipfs/");}return url;}
async function loadNftToCanvas() {
    const selectedCollection = nftCollectionSelect.value; const tokenId = nftTokenIdInput.value;
    if (!tokenId) { nftStatusEl.textContent = "Please enter a Token ID."; nftStatusEl.className = 'error'; return; }
    if (!nftContracts[selectedCollection]) { nftStatusEl.textContent = "Invalid NFT collection selected."; nftStatusEl.className = 'error'; return; }
    if (loadNftBtn) loadNftBtn.disabled = true;
    enableEditingControls(false); // Dezactivează controalele în timpul încărcării
    clearCanvasAndOverlays(); // Curăță tot
    nftStatusEl.textContent = `Loading ${nftContracts[selectedCollection].name} #${tokenId}...`; nftStatusEl.className = '';

    const contractInfo = nftContracts[selectedCollection];
    try {
        const contract = new ethers.Contract(contractInfo.address, nftAbi, provider);
        let tokenURI = await contract.tokenURI(tokenId); tokenURI = resolveIpfsUrl(tokenURI);
        nftStatusEl.textContent = "Fetching metadata...";
        const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 sec timeout
        const response = await fetch(tokenURI, { signal: controller.signal }); clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Metadata error: ${response.status} ${response.statusText} (URL: ${tokenURI})`);
        const metadata = await response.json();
        let imageUrl = resolveIpfsUrl(metadata.image || metadata.image_url || metadata.imageUrl);
        if (!imageUrl) throw new Error("Image URL missing in metadata");
        nftStatusEl.textContent = "Loading image..."; baseImage = new Image(); baseImage.crossOrigin = "Anonymous"; // Esențial pt salvare canvas
        baseImage.onload = () => {
            nftStatusEl.textContent = "Drawing image..."; drawBaseImage();
            nftStatusEl.textContent = `${nftContracts[selectedCollection].name} #${tokenId} loaded successfully!`; nftStatusEl.className = 'success';
            enableEditingControls(true); // Reactivează controalele
            if (loadNftBtn) loadNftBtn.disabled = false; applyOverlay();
        };
        baseImage.onerror = (err) => {
            console.error("Error loading NFT image:", err, "Attempted URL:", imageUrl); nftStatusEl.textContent = `Error loading image. Check console for details.`; nftStatusEl.className = 'error';
            if (loadNftBtn) loadNftBtn.disabled = false; clearCanvasAndOverlays(); ctx.fillStyle = "white"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("Image Load Error", canvasWidth / 2, canvasHeight / 2);
             updateControlState(); // Actualizează starea butoanelor
        }; baseImage.src = imageUrl;
    } catch (err) {
        console.error(`Error processing NFT ${tokenId}:`, err); let errorMsg = "Error: " + err.message;
        if (err.name === 'AbortError') { errorMsg = "Error: Metadata request timed out."; }
        else if (err.message?.includes('invalid token ID')) { errorMsg = `Error: Token ID ${tokenId} invalid or does not exist.`; }
         else if (err.message?.includes('CALL_EXCEPTION') || err.message?.includes('missing provider')) { errorMsg = `Error: Could not query contract. Check network/provider.`; }
        nftStatusEl.textContent = errorMsg; nftStatusEl.className = 'error'; if (loadNftBtn) loadNftBtn.disabled = false; clearCanvasAndOverlays();
        ctx.fillStyle = "white"; ctx.font = "30px Arial"; ctx.textAlign = "center"; ctx.fillText("NFT Load Error", canvasWidth / 2, canvasHeight / 2);
         updateControlState(); // Actualizează starea butoanelor
    }
 }
function drawBaseImage() { if(!baseImage.src||!baseImage.complete||baseImage.naturalWidth===0)return; const aspectRatio=baseImage.naturalWidth/baseImage.naturalHeight; let drawWidth=canvasWidth,drawHeight=canvasHeight,x=0,y=0; if(canvasWidth/canvasHeight>aspectRatio){drawHeight=canvasHeight;drawWidth=drawHeight*aspectRatio;x=(canvasWidth-drawWidth)/2;}else{drawWidth=canvasWidth;drawHeight=drawWidth/aspectRatio;y=(canvasHeight-drawHeight)/2;} ctx.clearRect(0,0,canvasWidth,canvasHeight); ctx.fillStyle="#444"; ctx.fillRect(0,0,canvasWidth,canvasHeight); try{ctx.drawImage(baseImage,x,y,drawWidth,drawHeight);}catch(e){console.error("Error drawing base image:",e); nftStatusEl.textContent="Error drawing NFT image."; nftStatusEl.className='error';} }
function applyOverlay() { if(!baseImage.src||!baseImage.complete||baseImage.naturalWidth===0)return; drawBaseImage(); drawSignPolygonOnly(); }
function drawSignPolygonOnly() { const color = overlayColorInput.value; const currentPolygon = getPolygonForSelectedCollection(); ctx.beginPath(); ctx.moveTo(currentPolygon[0].x, currentPolygon[0].y); for (let i = 1; i < currentPolygon.length; i++) ctx.lineTo(currentPolygon[i].x, currentPolygon[i].y); ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.lineJoin = "round"; ctx.lineWidth = 14; ctx.strokeStyle = "black"; ctx.stroke(); }

// --- Text & Image Creation ---
function addText() { if(!baseImage.src||!baseImage.complete||baseImage.naturalWidth===0){nftStatusEl.textContent="Load a valid NFT first.";nftStatusEl.className='error';return;} const textEl=document.createElement("div");textEl.className="textOverlay";textEl.innerText=textInput.value||"New Text";textEl.style.color=textColor.value;textEl.style.fontSize=fontSize.value+"px";textEl.style.fontFamily=fontFamily.value;textEl.style.transform=`translate(-50%, -50%) rotate(0deg)`;textEl.style.zIndex="10";const handle=document.createElement("span");handle.className="rotation-handle";handle.innerHTML='↺';textEl.appendChild(handle);const currentPolygon=getPolygonForSelectedCollection();const minX=Math.min(...currentPolygon.map(p=>p.x));const maxX=Math.max(...currentPolygon.map(p=>p.x));const minY=Math.min(...currentPolygon.map(p=>p.y));const maxY=Math.max(...currentPolygon.map(p=>p.y));const signCenterXPercent=canvasWidth?((minX+maxX)/2)/canvasWidth*100:50;const signCenterYPercent=canvasHeight?((minY+maxY)/2)/canvasHeight*100:50;const{x:initialX,y:initialY}=calculateElementPosition(signCenterXPercent,signCenterYPercent);textEl.style.left=`${initialX}px`;textEl.style.top=`${initialY}px`;textEl.addEventListener("mousedown",handleTextDragStart);textEl.addEventListener("touchstart",handleTextDragStart,{passive:true});handle.addEventListener("mousedown",handleTextRotateStart);handle.addEventListener("touchstart",handleTextRotateStart,{passive:true});container.appendChild(textEl);setActiveElement(textEl); updateControlState();}
function addImage() { if(!baseImage.src||!baseImage.complete||baseImage.naturalWidth===0){nftStatusEl.textContent="Please load a valid NFT first.";nftStatusEl.className='error';return;} if(!imageUpload.files||imageUpload.files.length===0){nftStatusEl.textContent="Please select an image file.";nftStatusEl.className='error';return;} const file=imageUpload.files[0];const reader=new FileReader(); reader.onload=function(e){const wrapper=document.createElement("div");wrapper.className="imgOverlay";wrapper.style.position="absolute";wrapper.style.width="auto";wrapper.style.height="auto";wrapper.style.transform="translate(-50%, -50%) rotate(0deg)";wrapper.style.touchAction="none";wrapper.style.zIndex="20";const img=document.createElement("img");img.src=e.target.result; img.onload=()=>{if(container.offsetWidth>0&&img.naturalWidth>0&&img.naturalHeight>0){const contW=container.offsetWidth;const initialWidth=Math.min(img.naturalWidth*0.60,contW*0.5,250);const aspectRatio=img.naturalWidth/img.naturalHeight;wrapper.style.width=`${initialWidth}px`;wrapper.style.height=`${initialWidth/aspectRatio}px`;}else{wrapper.style.width='100px';wrapper.style.height='auto';}}; img.onerror=()=>{console.error("Error loading added image.");nftStatusEl.textContent="Error displaying uploaded image.";nftStatusEl.className='error';wrapper.remove();} wrapper.appendChild(img);const rotateHandle=document.createElement("div");rotateHandle.className="rotation-handle";rotateHandle.innerHTML='↺';wrapper.appendChild(rotateHandle); const resizeHandle=document.createElement("div"); resizeHandle.className="resize-handle"; resizeHandle.innerHTML='⤡'; wrapper.appendChild(resizeHandle); const currentPolygon=getPolygonForSelectedCollection();const minX=Math.min(...currentPolygon.map(p=>p.x));const maxX=Math.max(...currentPolygon.map(p=>p.x));const minY=Math.min(...currentPolygon.map(p=>p.y));const maxY=Math.max(...currentPolygon.map(p=>p.y));const signCenterXPercent=canvasWidth?((minX+maxX)/2)/canvasWidth*100:50;const signCenterYPercent=canvasHeight?((minY+maxY)/2)/canvasHeight*100:50;const{x:initialX,y:initialY}=calculateElementPosition(signCenterXPercent,signCenterYPercent);wrapper.style.left=`${initialX}px`;wrapper.style.top=`${initialY}px`;wrapper.addEventListener("mousedown",handleImageDragStart);wrapper.addEventListener("touchstart",handleImageDragStart,{passive:true});rotateHandle.addEventListener("mousedown",handleImageRotateStart);rotateHandle.addEventListener("touchstart",handleImageRotateStart,{passive:true});resizeHandle.addEventListener("mousedown",handleImageResizeStart);resizeHandle.addEventListener("touchstart",handleImageResizeStart,{passive:true});container.appendChild(wrapper);setActiveElement(wrapper);nftStatusEl.textContent="Image added.";nftStatusEl.className='success';imageUpload.value=''; updateControlState();}; reader.onerror=function(err){console.error("FileReader error:",err);nftStatusEl.textContent="Error reading image file.";nftStatusEl.className='error';} reader.readAsDataURL(file);}

// --- Active Element Management & Removal ---
function setActiveElement(el) { if(activeElement&&activeElement!==el){activeElement.classList.remove("active");activeElement.style.zIndex=activeElement.classList.contains('imgOverlay')?'20':'10';} if(el){el.classList.add("active");activeElement=el;el.style.zIndex=el.classList.contains('imgOverlay')?'101':'100';if(el.classList.contains('textOverlay')){textInput.value=el.childNodes[0].nodeValue;textColor.value=rgb2hex(el.style.color);fontSize.value=parseInt(el.style.fontSize);const currentFont=el.style.fontFamily.split(',')[0].replace(/['"]/g,"").trim();let foundFont=false;for(let option of fontFamily.options){if(option.value.includes(currentFont)){fontFamily.value=option.value;foundFont=true;break;}}if(!foundFont)fontFamily.value='Arial';}}else{activeElement=null;} updateControlState();}
function removeActiveElement() { if(activeElement){activeElement.remove();setActiveElement(null); updateControlState();} }

// --- Interaction Handlers ---
function getEventCoordinates(event) { let x,y; if(event.touches&&event.touches.length>0){x=event.touches[0].clientX;y=event.touches[0].clientY;}else if(event.changedTouches&&event.changedTouches.length>0){x=event.changedTouches[0].clientX;y=event.changedTouches[0].clientY;}else{x=event.clientX;y=event.clientY;} return{x,y}; }
function handleTextDragStart(event) { if(event.target.classList.contains('rotation-handle'))return;const el=event.currentTarget;setActiveElement(el);textInteractionState.isDragging=true;textInteractionState.isRotating=false;el.style.cursor='grabbing';document.body.style.cursor='grabbing';const coords=getEventCoordinates(event);const contRect=container.getBoundingClientRect();textInteractionState.startX=coords.x-contRect.left;textInteractionState.startY=coords.y-contRect.top;textInteractionState.startLeft=parseFloat(el.style.left||"0");textInteractionState.startTop=parseFloat(el.style.top||"0");document.addEventListener("mousemove",handleTextInteractionMove);document.addEventListener("mouseup",handleTextInteractionEnd);document.addEventListener("touchmove",handleTextInteractionMove,{passive:false});document.addEventListener("touchend",handleTextInteractionEnd);document.addEventListener("touchcancel",handleTextInteractionEnd);if(event.type==='mousedown')event.preventDefault();}
function handleTextRotateStart(event) { event.stopPropagation();const el=event.currentTarget.parentElement;setActiveElement(el);textInteractionState.isRotating=true;textInteractionState.isDragging=false;document.body.style.cursor='alias';const coords=getEventCoordinates(event);const rect=el.getBoundingClientRect();textInteractionState.rotateCenterX=rect.left+rect.width/2;textInteractionState.rotateCenterY=rect.top+rect.height/2;const dx=coords.x-textInteractionState.rotateCenterX;const dy=coords.y-textInteractionState.rotateCenterY;let startAngle=Math.atan2(dy,dx);const currentRotationRad=getRotationRad(el);textInteractionState.rotateStartAngle=startAngle-currentRotationRad;document.addEventListener("mousemove",handleTextInteractionMove);document.addEventListener("mouseup",handleTextInteractionEnd);document.addEventListener("touchmove",handleTextInteractionMove,{passive:false});document.addEventListener("touchend",handleTextInteractionEnd);document.addEventListener("touchcancel",handleTextInteractionEnd);if(event.type==='mousedown')event.preventDefault();}
function handleTextInteractionMove(event) { if(!activeElement||!activeElement.classList.contains('textOverlay')||(!textInteractionState.isDragging&&!textInteractionState.isRotating))return; if(event.type==='touchmove')event.preventDefault(); const coords=getEventCoordinates(event); const contRect=container.getBoundingClientRect(); if(textInteractionState.isDragging){const currentX=coords.x-contRect.left; const currentY=coords.y-contRect.top; let potentialNewLeft=textInteractionState.startLeft+(currentX-textInteractionState.startX); let potentialNewTop=textInteractionState.startTop+(currentY-textInteractionState.startY); const{canvasX,canvasY}=getCanvasCoordsFromContainerPoint(potentialNewLeft,potentialNewTop); if(pointInPolygon({x:canvasX,y:canvasY},getPolygonForSelectedCollection())){activeElement.style.left=`${potentialNewLeft}px`; activeElement.style.top=`${potentialNewTop}px`;}}else if(textInteractionState.isRotating){const dx=coords.x-textInteractionState.rotateCenterX; const dy=coords.y-textInteractionState.rotateCenterY; let angle=Math.atan2(dy,dx); let rotationRad=angle-textInteractionState.rotateStartAngle; let rotationDeg=rotationRad*(180/Math.PI); activeElement.style.transform=`translate(-50%, -50%) rotate(${rotationDeg}deg)`;}}
function handleTextInteractionEnd(event) { if(activeElement&&activeElement.classList.contains('textOverlay')){activeElement.style.cursor='grab';} document.body.style.cursor='default'; textInteractionState.isDragging=false; textInteractionState.isRotating=false; document.removeEventListener("mousemove",handleTextInteractionMove); document.removeEventListener("mouseup",handleTextInteractionEnd); document.removeEventListener("touchmove",handleTextInteractionMove); document.removeEventListener("touchend",handleTextInteractionEnd); document.removeEventListener("touchcancel",handleTextInteractionEnd); }
function handleImageDragStart(event) { if(event.target.classList.contains('rotation-handle')||event.target.classList.contains('resize-handle'))return;const el=event.currentTarget;setActiveElement(el);imageInteractionState.isDragging=true;imageInteractionState.isRotating=false;imageInteractionState.isResizing=false;el.style.cursor='grabbing';document.body.style.cursor='grabbing';const coords=getEventCoordinates(event);const contRect=container.getBoundingClientRect();imageInteractionState.startX=coords.x-contRect.left;imageInteractionState.startY=coords.y-contRect.top;imageInteractionState.startLeft=parseFloat(el.style.left||"0");imageInteractionState.startTop=parseFloat(el.style.top||"0");document.addEventListener("mousemove",handleImageInteractionMove);document.addEventListener("mouseup",handleImageInteractionEnd);document.addEventListener("touchmove",handleImageInteractionMove,{passive:false});document.addEventListener("touchend",handleImageInteractionEnd);document.addEventListener("touchcancel",handleImageInteractionEnd);if(event.type==='mousedown')event.preventDefault();}
function handleImageRotateStart(event) { event.stopPropagation();const el=event.currentTarget.parentElement;setActiveElement(el);imageInteractionState.isRotating=true;imageInteractionState.isDragging=false;imageInteractionState.isResizing=false;document.body.style.cursor='alias';const coords=getEventCoordinates(event);const rect=el.getBoundingClientRect();imageInteractionState.centerX=rect.left+rect.width/2;imageInteractionState.centerY=rect.top+rect.height/2;const dx=coords.x-imageInteractionState.centerX;const dy=coords.y-imageInteractionState.centerY;let startAngle=Math.atan2(dy,dx);imageInteractionState.currentRotationRad=getRotationRad(el);imageInteractionState.startAngle=startAngle-imageInteractionState.currentRotationRad;document.addEventListener("mousemove",handleImageInteractionMove);document.addEventListener("mouseup",handleImageInteractionEnd);document.addEventListener("touchmove",handleImageInteractionMove,{passive:false});document.addEventListener("touchend",handleImageInteractionEnd);document.addEventListener("touchcancel",handleImageInteractionEnd);if(event.type==='mousedown')event.preventDefault();}
function handleImageResizeStart(event) { event.stopPropagation();const el=event.currentTarget.parentElement;setActiveElement(el);imageInteractionState.isResizing=true;imageInteractionState.isRotating=false;imageInteractionState.isDragging=false;document.body.style.cursor='nesw-resize'; const coords=getEventCoordinates(event);imageInteractionState.startX=coords.x;imageInteractionState.startY=coords.y;imageInteractionState.startWidth=el.offsetWidth;imageInteractionState.startHeight=el.offsetHeight;imageInteractionState.aspectRatio=imageInteractionState.startHeight>0?imageInteractionState.startWidth/imageInteractionState.startHeight:1;imageInteractionState.currentRotationRad=getRotationRad(el);const rect=el.getBoundingClientRect();imageInteractionState.centerX=rect.left+rect.width/2;imageInteractionState.centerY=rect.top+rect.height/2;document.addEventListener("mousemove",handleImageInteractionMove);document.addEventListener("mouseup",handleImageInteractionEnd);document.addEventListener("touchmove",handleImageInteractionMove,{passive:false});document.addEventListener("touchend",handleImageInteractionEnd);document.addEventListener("touchcancel",handleImageInteractionEnd);if(event.type==='mousedown')event.preventDefault();}
function handleImageInteractionMove(event) { if(!activeElement||!activeElement.classList.contains('imgOverlay')||(!imageInteractionState.isDragging&&!imageInteractionState.isRotating&&!imageInteractionState.isResizing))return; if(event.type==='touchmove')event.preventDefault(); const coords=getEventCoordinates(event); const contRect=container.getBoundingClientRect(); if(imageInteractionState.isDragging){const currentX=coords.x-contRect.left;const currentY=coords.y-contRect.top;let potentialNewLeft=imageInteractionState.startLeft+(currentX-imageInteractionState.startX);let potentialNewTop=imageInteractionState.startTop+(currentY-imageInteractionState.startY);const{canvasX,canvasY}=getCanvasCoordsFromContainerPoint(potentialNewLeft,potentialNewTop);if(pointInPolygon({x:canvasX,y:canvasY},getPolygonForSelectedCollection())){activeElement.style.left=`${potentialNewLeft}px`;activeElement.style.top=`${potentialNewTop}px`;}}else if(imageInteractionState.isRotating){const dx=coords.x-imageInteractionState.centerX;const dy=coords.y-imageInteractionState.centerY;let angle=Math.atan2(dy,dx);let rotationRad=angle-imageInteractionState.startAngle;let rotationDeg=rotationRad*(180/Math.PI);activeElement.style.transform=`translate(-50%, -50%) rotate(${rotationDeg}deg)`;}else if(imageInteractionState.isResizing){const dx=coords.x-imageInteractionState.startX;const dy=coords.y-imageInteractionState.startY;const rotation=imageInteractionState.currentRotationRad;const cosR=Math.cos(rotation);const sinR=Math.sin(rotation);const rotatedDx = dx * cosR + dy * sinR;const rotatedDy = -dx * sinR + dy * cosR; const diagonalDelta = (-rotatedDx + rotatedDy) / 2; let newWidth = imageInteractionState.startWidth + diagonalDelta; newWidth = Math.max(30, newWidth); let newHeight = imageInteractionState.aspectRatio>0?newWidth/imageInteractionState.aspectRatio:newWidth; activeElement.style.width=`${newWidth}px`; activeElement.style.height=`${newHeight}px`; }}
function handleImageInteractionEnd(event) { if(activeElement&&activeElement.classList.contains('imgOverlay')){activeElement.style.cursor='grab';} document.body.style.cursor='default'; imageInteractionState.isDragging=false; imageInteractionState.isRotating=false; imageInteractionState.isResizing=false; document.removeEventListener("mousemove",handleImageInteractionMove); document.removeEventListener("mouseup",handleImageInteractionEnd); document.removeEventListener("touchmove",handleImageInteractionMove); document.removeEventListener("touchend",handleImageInteractionEnd); document.removeEventListener("touchcancel",handleImageInteractionEnd); }

// --- Utility Functions ---
function calculateElementPosition(percentX,percentY){const contRect=container.getBoundingClientRect();if(!contRect||contRect.width===0||contRect.height===0)return{x:0,y:0};const scaleX=contRect.width/canvasWidth;const scaleY=contRect.height/canvasHeight;const targetCanvasX=canvasWidth*(percentX/100);const targetCanvasY=canvasHeight*(percentY/100);return{x:targetCanvasX*scaleX,y:targetCanvasY*scaleY};}
function getCanvasCoordsFromContainerPoint(containerX,containerY){const contRect=container.getBoundingClientRect();if(!contRect||contRect.width===0||contRect.height===0)return{canvasX:0,canvasY:0};const scaleX=contRect.width/canvasWidth;const scaleY=contRect.height/canvasHeight;return{canvasX:containerX/scaleX,canvasY:containerY/scaleY};}
function pointInPolygon(point,vs){const x=point.x,y=point.y;let inside=false;for(let i=0,j=vs.length-1;i<vs.length;j=i++){const xi=vs[i].x,yi=vs[i].y;const xj=vs[j].x,yj=vs[j].y;const intersect=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi);if(intersect)inside=!inside;}return inside;}
function rgb2hex(rgb){if(!rgb)return'#ffffff';if(rgb.startsWith('#'))return rgb;const rgbMatch=rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);if(rgbMatch){return"#"+rgbMatch.slice(1).map(x=>parseInt(x).toString(16).padStart(2,'0')).join('');}return rgb;}
function getRotationRad(element){if(!element||!element.style)return 0;const transform=element.style.transform;const rotateMatch=transform.match(/rotate\((-?\d+(\.\d+)?)deg\)/);const rotationDeg=rotateMatch?parseFloat(rotateMatch[1]):0;return rotationDeg*(Math.PI/180);}

// --- DISCLAIMER Functions ---
function showComicDisclaimer() { if (disclaimerModal) { disclaimerModal.classList.add('visible'); } }
function hideComicDisclaimer() { if (disclaimerModal) { disclaimerModal.classList.remove('visible'); } }

// --- Save Functionality (Handles 'full' and 'sign' modes) ---
function saveImage(mode = 'full') { // Default to 'full' if no mode specified
    const currentNftId = nftTokenIdInput.value || 'unknown';
    const currentCollection = nftCollectionSelect.value || 'unknown';

    if (mode === 'full' && (!baseImage.src || !baseImage.complete || baseImage.naturalWidth === 0)) {
        alert("Load a valid NFT first to save the full image!");
        if(nftStatusEl) { nftStatusEl.className = 'error'; nftStatusEl.textContent = "NFT not loaded for full save."; }
        return;
    }
    if (mode === 'sign' && !overlayColorInput.value && !container?.querySelectorAll(".textOverlay, .imgOverlay").length > 0) {
         alert("Add at least a sign color or an element before saving the sign only.");
         if(nftStatusEl) { nftStatusEl.className = 'error'; nftStatusEl.textContent = "No sign elements to save."; }
         return;
    }

    if(nftStatusEl) { nftStatusEl.textContent = `Generating ${mode === 'full' ? 'full' : 'sign'} image...`; nftStatusEl.className = ''; }
    if (activeElement) activeElement.classList.remove('active'); // Temporarily hide outline

    // --- Prepare Canvas Based on Mode ---
    if (mode === 'full') {
        drawBaseImage(); // Draw NFT background
        drawSignPolygonOnly(); // Draw colored polygon on top
    } else if (mode === 'sign') {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight); // Clear to TRANSPARENT
        drawSignPolygonOnly(); // Draw colored polygon on transparent background
    }

    // --- Draw Overlays (Common Logic) ---
    const canvasRect = canvas.getBoundingClientRect();
    if(!canvasRect || canvasRect.width === 0 || canvasRect.height === 0) {
         alert("Error: Could not get canvas dimensions for saving.");
         if(nftStatusEl) { nftStatusEl.className='error'; nftStatusEl.textContent="Save Error: Canvas rect invalid."; }
         if(activeElement) activeElement.classList.add('active'); // Restore outline if error
         return;
    }
    const scaleX = canvasRect.width / canvasWidth;
    const scaleY = canvasRect.height / canvasHeight;

    const allOverlays = Array.from(container.querySelectorAll(".textOverlay, .imgOverlay"));
    allOverlays.sort((a, b) => (parseInt(window.getComputedStyle(a).zIndex) || 0) - (parseInt(window.getComputedStyle(b).zIndex) || 0));

    allOverlays.forEach(el => {
        const elRect = el.getBoundingClientRect();
        const rotationRad = getRotationRad(el);
        const elCenterX_viewport = elRect.left + elRect.width / 2;
        const elCenterY_viewport = elRect.top + elRect.height / 2;
        const relativeCenterX = elCenterX_viewport - canvasRect.left;
        const relativeCenterY = elCenterY_viewport - canvasRect.top;
        const rawCanvasX = (relativeCenterX / canvasRect.width) * canvasWidth;
        const rawCanvasY = (relativeCenterY / canvasRect.height) * canvasHeight;
        const canvasX = Math.round(rawCanvasX);
        const canvasY = Math.round(rawCanvasY);

        ctx.save();
        ctx.translate(canvasX, canvasY);
        ctx.rotate(rotationRad);

        if(el.classList.contains('textOverlay')){
            const text=el.childNodes[0].nodeValue; const color=el.style.color; const size=parseInt(el.style.fontSize); const font=el.style.fontFamily;
            const canvasFontSize = Math.round(size / scaleY);
            ctx.font=`${canvasFontSize}px ${font}`; ctx.fillStyle=color; ctx.textAlign="center"; ctx.textBaseline="middle";
            ctx.fillText(text, 0, 0);
        } else if(el.classList.contains('imgOverlay')){
            const imgElement=el.querySelector('img');
            if(imgElement&&imgElement.complete&&imgElement.naturalWidth>0){
                 const domWidth = el.offsetWidth;
                 const canvasDrawWidth = Math.round(domWidth / scaleX);
                 const naturalAspectRatio = imgElement.naturalWidth > 0 ? imgElement.naturalHeight / imgElement.naturalWidth : 1;
                 const canvasDrawHeight = Math.round(canvasDrawWidth * naturalAspectRatio);
                 if (canvasDrawWidth > 0 && canvasDrawHeight > 0) {
                    ctx.drawImage(imgElement, -canvasDrawWidth / 2, -canvasDrawHeight / 2, canvasDrawWidth, canvasDrawHeight);
                 }
            } else {
                console.warn("Skipping unloaded/invalid image overlay during save:", imgElement?.src);
            }
        }
        ctx.restore();
    });

    if (activeElement) activeElement.classList.add('active'); // Restore outline after drawing

    // --- Generate Filename and Download ---
    try {
        const dataURL = canvas.toDataURL("image/png"); // PNG supports transparency
        const link = document.createElement("a");
        let filename;
        if (mode === 'full') {
            filename = `signed-${currentCollection}-${currentNftId}.png`;
        } else { // mode === 'sign'
            filename = `sign-${currentCollection}-${currentNftId}.png`;
        }
        link.download = filename;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        if(nftStatusEl) { nftStatusEl.textContent = `${mode === 'full' ? 'Full image' : 'Sign'} saved as ${filename}!`; nftStatusEl.className = 'success'; }
    } catch (e) {
        console.error("Error saving image:", e);
        if(nftStatusEl) nftStatusEl.className = 'error';
        if (e.name === "SecurityError") {
            alert("Save Error: Cannot save canvas due to cross-origin image security restrictions. Ensure NFT images allow cross-origin use (CORS).");
             if(nftStatusEl) nftStatusEl.textContent = "Save Error: Cross-origin issue.";
        } else {
            alert("An error occurred while saving the image.");
             if(nftStatusEl) nftStatusEl.textContent = "Save Error.";
        }
    }

    // --- Redraw original view after saving 'sign only' ---
    if (mode === 'sign') {
         setTimeout(() => {
             if (baseImage.src && baseImage.complete) {
                applyOverlay(); // Redraw the full view
             } else {
                 clearCanvas(); // Sau doar curăță dacă nu era NFT
             }
         }, 100);
    }
} // End saveImage function
