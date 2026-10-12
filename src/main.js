import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

// Register GSAP Plugins
gsap.registerPlugin(ScrollTrigger);

// Initialize Lenis for Smooth Scrolling
const lenis = new Lenis({
  lerp: 0.1,
  wheelMultiplier: 1,
  smoothWheel: true,
});

// Sync Lenis with GSAP ScrollTrigger
lenis.on('scroll', ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

// RAF Loop for Lenis
function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Setup Home Link
document.getElementById('home-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  window.scrollTo(0, 0);
  window.location.reload();
});

// --- Animation Modules Skeletons ---

function initHeroAnimations() {
  // TODO: Add hero video and text animations
  console.log('Hero animations initialized');
}

function initProductRevealAnimations() {
  // Section removed based on user feedback
}

function initDismantleAnimations() {
  // Section removed based on user feedback
}

function initVTOAnimations() {
  const vtoTrigger = document.getElementById("vto-trigger");
  const vtoUpload = document.getElementById("vto-upload");
  const vtoContainer = document.getElementById("vto-result-container");
  const heroContent = document.querySelector(".hero-content");
  const scanningState = document.getElementById("vto-scanning-state");
  const finalState = document.getElementById("vto-final-state");
  const resultImg = document.getElementById("vto-result-img");

  if (!vtoTrigger) return;

  // Watch Selection Elements
  const watchSelectionModal = document.getElementById("watch-selection-modal");
  const closeWatchSelectionBtn = document.getElementById("close-watch-selection-btn");
  const tabPreset = document.getElementById("tab-preset");
  const tabCustom = document.getElementById("tab-custom");
  const presetCatalogState = document.getElementById("preset-catalog-state");
  const customUploadState = document.getElementById("custom-upload-state");
  const presetItems = document.querySelectorAll(".preset-item");
  const customWatchUpload = document.getElementById("custom-watch-upload");
  const btnTriggerCustomWatch = document.getElementById("btn-trigger-custom-watch");
  const customWatchPreview = document.getElementById("custom-watch-preview");
  const btnConfirmCustomWatch = document.getElementById("btn-confirm-custom-watch");

  let selectedWatchBase64 = null;

  // Utilities for Base64 conversion
  const fileToBase64 = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(f);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = error => reject(error);
  });

  const fetchUrlToBase64 = async (url) => {
    const res = await fetch(url);
    const blob = await res.blob();
    return fileToBase64(blob);
  };

  // Downscale photos before upload (Vercel limits request bodies to 4.5 MB).
  const resizeToBase64 = (f, maxDim = 1280) => new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const mime = f.type === 'image/png' ? 'image/png' : 'image/jpeg';
      resolve(c.toDataURL(mime, 0.85).split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); fileToBase64(f).then(resolve, reject); };
    img.src = url;
  });

  // --- 1. Watch Selection Logic ---
  const closeWatchModal = () => {
    gsap.to(watchSelectionModal, {
      opacity: 0, duration: 0.3, onComplete: () => {
        watchSelectionModal.style.display = "none";
      }
    });
  };

  vtoTrigger.addEventListener("click", () => {
    watchSelectionModal.style.display = "flex";
    gsap.fromTo(watchSelectionModal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
  });

  if (closeWatchSelectionBtn) closeWatchSelectionBtn.addEventListener("click", closeWatchModal);

  // Tabs switching
  if (tabPreset && tabCustom) {
    tabPreset.addEventListener("click", () => {
      tabPreset.style.background = "#fff";
      tabPreset.style.color = "#000";
      tabCustom.style.background = "transparent";
      tabCustom.style.color = "#fff";
      presetCatalogState.style.display = "flex";
      customUploadState.style.display = "none";
    });

    tabCustom.addEventListener("click", () => {
      tabCustom.style.background = "#fff";
      tabCustom.style.color = "#000";
      tabPreset.style.background = "transparent";
      tabPreset.style.color = "#fff";
      customUploadState.style.display = "flex";
      presetCatalogState.style.display = "none";
    });
  }

  // Preset Selection
  presetItems.forEach(item => {
    item.addEventListener("click", async () => {
      // Tampilkan feedback visual
      item.style.borderColor = "#fff";
      const src = item.getAttribute("data-src");
      selectedWatchBase64 = await fetchUrlToBase64(src);
      closeWatchModal();
      openVtoWristModal();
    });
  });

  // Custom Selection
  if (btnTriggerCustomWatch) {
    btnTriggerCustomWatch.addEventListener("click", () => customWatchUpload.click());
  }

  if (customWatchUpload) {
    customWatchUpload.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (file) {
        if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
          alert('Format tidak didukung. Harap unggah gambar JPG atau PNG.');
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          alert('Ukuran file terlalu besar. Maksimal 5MB.');
          return;
        }
        selectedWatchBase64 = await resizeToBase64(file, 1024);
        customWatchPreview.src = URL.createObjectURL(file);
        customWatchPreview.style.display = "block";
        btnConfirmCustomWatch.style.display = "block";
      }
    });
  }

  if (btnConfirmCustomWatch) {
    btnConfirmCustomWatch.addEventListener("click", () => {
      closeWatchModal();
      openVtoWristModal();
    });
  }


  // --- 2. Wrist Capture Modal Logic ---
  const vtoOptionsModal = document.getElementById("vto-options-modal");
  const closeVtoOptionsBtn = document.getElementById("close-vto-options-btn");
  const btnUploadDevice = document.getElementById("btn-upload-device");
  const btnLiveCamera = document.getElementById("btn-live-camera");
  const vtoOptionsState = document.getElementById("vto-options-state");
  const vtoCameraState = document.getElementById("vto-camera-state");
  const btnCancelCamera = document.getElementById("btn-cancel-camera");
  
  const openVtoWristModal = () => {
    vtoOptionsModal.style.display = "flex";
    gsap.fromTo(vtoOptionsModal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
  };

  const closeVtoModal = () => {
    gsap.to(vtoOptionsModal, {
      opacity: 0, duration: 0.3, onComplete: () => {
        vtoOptionsModal.style.display = "none";
        vtoOptionsState.style.display = "block";
        vtoCameraState.style.display = "none";
      }
    });
    // Menutup instansi YouCam Camera Kit (YMK)
    if (window.YMK) {
      try { window.YMK.close(); } catch(e) {}
    }
  };

  if (closeVtoOptionsBtn) closeVtoOptionsBtn.addEventListener("click", closeVtoModal);

  if (btnUploadDevice) {
    btnUploadDevice.addEventListener("click", () => {
      closeVtoModal();
      vtoUpload.click();
    });
  }

  if (btnLiveCamera) {
    btnLiveCamera.addEventListener("click", async () => {
      vtoOptionsState.style.display = "none";
      vtoCameraState.style.display = "block";
      
      try {
        if (!window.YMK) throw new Error("YMK SDK not loaded");

        const ymkContainer = document.getElementById("YMK-module");
        // Ambil lebar aktual container (batas maksimum 400px dari CSS, atau kurang di mobile)
        const containerWidth = ymkContainer.clientWidth || 360;
        const containerHeight = 480; // Standar optimal untuk rasio portrait
        
        ymkContainer.style.height = `${containerHeight}px`;

        // Menggunakan resolusi absolut 800x960 yang akan di-scale down 50% via CSS
        // Ini memastikan kualitas HD (Retina) tanpa merusak koordinat overlay SDK
        window.YMK.init({
          faceDetectionMode: 'wrist',
          imageFormat: 'base64',
          language: 'enu',
          width: 800,
          height: 960
        });

        // Tangkap event saat YMK ditutup dari tombol silang (X) bawaannya
        window.YMK.addEventListener('closed', function() {
          closeVtoModal();
        });

        // Tangkap event hasil jepretan final (setelah validasi kualitas terpenuhi)
        window.YMK.addEventListener('faceDetectionCaptured', function(result) {
          if (result && result.images && result.images.length > 0) {
            const b64 = result.images[0].image;
            
            // Konversi Base64 YouCam kembali menjadi Blob File untuk dimasukkan ke alur prosesVTO
            fetch(b64)
              .then(res => res.blob())
              .then(async blob => {
                const file = new File([blob], "live_capture.jpg", { type: "image/jpeg" });
                closeVtoModal();
                await processVTO(file);
              });
          }
        });

        window.YMK.openCameraKit();

      } catch (err) {
        console.error("Camera Kit Error", err);
        alert("Unable to access YouCam Camera Kit. Please check permissions or use 'Upload from Device'.");
        closeVtoModal();
      }
    });
  }

  if (btnCancelCamera) {
    btnCancelCamera.addEventListener("click", () => {
      if (window.YMK) {
        try { window.YMK.close(); } catch(e) {}
      }
      vtoCameraState.style.display = "none";
      vtoOptionsState.style.display = "block";
    });
  }

  if (vtoUpload) {
    vtoUpload.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
        alert('Format tidak didukung. Harap unggah gambar JPG atau PNG.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran file terlalu besar. Maksimal 5MB.');
        return;
      }
      await processVTO(file);
    });
  }

  // --- 3. Execute API Call ---
  async function processVTO(file) {
    gsap.to(heroContent, {
      opacity: 0,
      y: -20,
      duration: 0.5,
      onComplete: () => {
        heroContent.style.display = "none";
        vtoContainer.style.display = "block";
        gsap.fromTo(vtoContainer, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.5 });
      }
    });

    scanningState.style.display = "block";
    finalState.style.display = "none";

    let imageUrl = '';

    try {
      const base64WristData = await resizeToBase64(file, 1280);

      // Inject both wrist and watch images into the proxy API
      const response = await fetch('/api/vto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: base64WristData,
          watchImage: selectedWatchBase64
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'API Error from Proxy');
      }
      const data = await response.json();
      
      imageUrl = data.vto_image_url || data.image_url || data.result_image_url || URL.createObjectURL(file);

    } catch (error) {
      console.warn("API Error, using fallback mock for demo purposes.", error);
      await new Promise(resolve => setTimeout(resolve, 2500));
      imageUrl = URL.createObjectURL(file);
    }

    resultImg.src = imageUrl;
    resultImg.onload = () => {
      gsap.to(scanningState, {
        opacity: 0,
        duration: 0.3,
        onComplete: () => {
          scanningState.style.display = "none";
          finalState.style.display = "block";
          gsap.fromTo(finalState, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 });
        }
      });
    };
  }
}

function initReservationModal() {
  const reserveModal = document.getElementById("reservation-modal");
  const closeReserveBtn = document.querySelector("#reservation-modal .close-modal-btn");
  const openReserveBtns = document.querySelectorAll(".open-reserve-modal");
  const vtoContainer = document.getElementById("vto-result-container");
  const heroContent = document.querySelector(".hero-content");

  if (!reserveModal || !closeReserveBtn || openReserveBtns.length === 0) return;

  openReserveBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      // Sembunyikan VTO (jika sedang terbuka) dan tampilkan Modal Reservasi
      if (vtoContainer.style.display !== "none") {
        gsap.to(vtoContainer, { opacity: 0, duration: 0.4, onComplete: () => vtoContainer.style.display = "none" });
      }
      
      reserveModal.style.display = "flex";
      gsap.fromTo(reserveModal, { opacity: 0 }, { opacity: 1, duration: 0.4 });
    });
  });

  closeReserveBtn.addEventListener("click", () => {
    // Tutup Modal
    gsap.to(reserveModal, {
      opacity: 0, duration: 0.4, onComplete: () => {
        reserveModal.style.display = "none";
        
        // Kembalikan Hero Home state jika VTO disembunyikan
        if (heroContent.style.display === "none" && vtoContainer.style.display === "none") {
           heroContent.style.display = "flex";
           gsap.to(heroContent, { opacity: 1, y: 0, duration: 0.5 });
        }
      }
    });
  });

  const reservationForm = document.getElementById("reservation-form");
  const formState = document.getElementById("reservation-form-state");
  const successState = document.getElementById("reservation-success-state");
  const successCloseBtn = document.querySelector(".success-close-btn");

  if (reservationForm) {
    reservationForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const formData = new FormData(reservationForm);
      const urlEncodedData = new URLSearchParams(formData).toString();

      // Send to a form backend if one is configured (VITE_FORM_ENDPOINT, e.g. Formspree).
      // Without it the form runs in demo mode and only shows the confirmation.
      const endpoint = import.meta.env.VITE_FORM_ENDPOINT;
      const send = endpoint
        ? fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
            body: urlEncodedData
          }).then(r => { if (!r.ok) throw new Error("Form HTTP " + r.status); })
        : Promise.resolve();

      send
        .then(() => {
          // Transisi ke Success State
          gsap.to(formState, {
            opacity: 0, duration: 0.3, onComplete: () => {
              formState.style.display = "none";
              successState.style.display = "block";
              gsap.fromTo(successState, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4 });
            }
          });
        })
        .catch(error => {
          console.error("Form submission error", error);
          alert("Gagal mengirim reservasi. Silakan coba lagi.");
        });
    });
  }

  if (successCloseBtn) {
    successCloseBtn.addEventListener("click", () => {
      closeReserveBtn.click(); // Panggil logika tutup modal utama

      // Reset form state setelah modal tertutup agar siap untuk reservasi berikutnya
      setTimeout(() => {
        successState.style.display = "none";
        formState.style.display = "block";
        formState.style.opacity = 1;
        reservationForm.reset();
      }, 500);
    });
  }
}

// Initialize all animations when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initHeroAnimations();
  initProductRevealAnimations();
  initDismantleAnimations();
  initVTOAnimations();
  initReservationModal();
});
