# Ticuv's NFT Sign-O-Matic 👽

[![Live Demo](https://img.shields.io/badge/Live%20Demo-signs.ticuv.art-brightgreen?style=for-the-badge&logo=netlify)](https://signs.ticuv.art)
[![Twitter Follow](https://img.shields.io/twitter/follow/ticu_v?style=social)](https://twitter.com/ticu_v)

Get Schwifty with your NFTs! This tool lets you easily overlay cool, pre-defined "sign" images onto your **God Hates NFTees (GHN)** or **Ape Hater Club (AHC)** NFTs.

Load your NFT by Token ID, pick a sign, preview it, and download the high-resolution (2048x2048px) signed version, ready to show off!

![Sign-O-Matic Screenshot](placeholder-link-to-your-screenshot.png)
*(Replace `placeholder-link-to-your-screenshot.png` with a direct link to an actual screenshot of the app)*

## ✨ Features

*   **Collection Selection:** Choose between GHN and AHC collections.
*   **NFT Loading:** Fetches NFT metadata and image via `tokenURI` using ethers.js (with public RPC fallback).
*   **Dynamic Signs:** Loads available sign overlays dynamically based on the `signs.json` configuration file.
*   **Live Preview:** Instantly see how the selected sign looks on your NFT (300x300px preview).
*   **High-Res Generation:** Creates a final 2048x2048px PNG image with the overlay applied.
*   **Easy Download:** Simple "Generate" button triggers the image download.
*   **Share Modal:** Includes a button to easily share your creation on X (Twitter) and tag @ticu\_v.
*   **Support Options:** Built-in donation links (SOL & ETH/L2s) via a "Buy Coffee" section in the modal.
*   **Responsive Design:** Adapts to different screen sizes.
*   **Unique Style:** Features a fun, Rick & Morty-inspired theme.
*   **Clipboard Integration:** Uses Clipboard.js for easy copying of donation addresses.

## 🚀 Live Demo

Experience the Sign-O-Matic live: **[https://signs.ticuv.art](https://signs.ticuv.art)**

## 🛠️ How to Use

1.  Navigate to [signs.ticuv.art](https://signs.ticuv.art).
2.  Select the NFT Collection you own (GHN or AHC).
3.  Enter the specific **Token ID** of your NFT.
4.  Click the "**Load NFT Glagnar!**" button.
5.  Wait for your NFT image to appear in the preview area.
6.  Once loaded, choose a sign overlay from the "**Pick a sign overlay**" dropdown menu.
7.  The preview will update to show the NFT with the sign.
8.  Click the "**Generate**" button.
9.  Your browser will automatically download the final signed PNG image.
10. *(Optional)* A modal will appear. Use the "Share on X" button to show off your newly signed NFT!
11. *(Optional)* Consider supporting the project by sending some virtual coffee using the donation addresses in the modal.

## ⚙️ Configuration (`signs.json`)

The available sign overlays are managed via the `signs.json` file located in the root of this repository. This file defines:

*   The GitHub repository details (`githubUser`, `githubRepo`, `githubBranch`, `imageBasePath`) used to construct the image URLs.
*   A list of available signs for each category (`AHC`, `GHN`), specifying the display `name` and the `fileName` located within the `images/<category>/` directory on GitHub.

```json
{
  "githubUser": "ticuv",
  "githubRepo": "SignOMatic",
  "githubBranch": "main",
  "imageBasePath": "images",
  "categories": {
    "AHC": [
      { "name": "AHC - Delist", "fileName": "delist.png" },
      { "name": "AHC - Duko", "fileName": "duko.png" }
    ],
    "GHN": [
      { "name": "GHN - Delist", "fileName": "delist.png" },
      { "name": "GHN - Duko", "fileName": "duko.png" }
    ]
  }
}
