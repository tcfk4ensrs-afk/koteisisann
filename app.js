/*****************************************************************
 * 固定資産棚卸しシステム V5
 * Part1
 *****************************************************************/

const APP_DB_NAME = "AssetInventoryDB";
const APP_DB_VERSION = 1;
const PHOTO_STORE = "photos";

let db = null;
let qrScanner = null;
let currentStream = null;

let previewBlob = null;
let previewDataUrl = null;

let lastScanCode = "";
let lastScanTime = 0;

const els = {
    assetNo: document.getElementById("assetNo"),

    startQrBtn: document.getElementById("startQrBtn"),
    stopQrBtn: document.getElementById("stopQrBtn"),

    openCameraBtn: document.getElementById("openCameraBtn"),
    nextAssetBtn: document.getElementById("nextAssetBtn"),

    summaryArea: document.getElementById("summaryArea"),
    timelineArea: document.getElementById("timelineArea"),
    thumbnailArea: document.getElementById("thumbnailArea"),

    exportZipBtn: document.getElementById("exportZipBtn"),

    cameraModal: document.getElementById("cameraModal"),
    previewModal: document.getElementById("previewModal"),

    cameraVideo: document.getElementById("cameraVideo"),
    previewImage: document.getElementById("previewImage"),

    captureBtn: document.getElementById("captureBtn"),
    saveBtn: document.getElementById("saveBtn"),
    retakeBtn: document.getElementById("retakeBtn")
};

document.addEventListener("DOMContentLoaded", async () => {
    await initDatabase();
    bindEvents();
    await refreshUI();
});

function bindEvents() {

    els.startQrBtn.addEventListener("click", startQrScan);
    els.stopQrBtn.addEventListener("click", stopQrScan);

    els.openCameraBtn.addEventListener("click", openCameraModal);

    els.captureBtn.addEventListener("click", capturePhoto);

    els.saveBtn.addEventListener(
        "click",
        saveCurrentPhoto
    );

    els.retakeBtn.addEventListener(
        "click",
        retakePhoto
    );

    els.nextAssetBtn.addEventListener(
        "click",
        gotoNextAsset
    );

    els.exportZipBtn.addEventListener(
        "click",
        exportZip
    );

}

async function initDatabase() {

    return new Promise((resolve, reject) => {

        const request =
            indexedDB.open(
                APP_DB_NAME,
                APP_DB_VERSION
            );

        request.onupgradeneeded =
            (event) => {

                const db =
                    event.target.result;

                if (
                    !db.objectStoreNames.contains(
                        PHOTO_STORE
                    )
                ) {

                    const store =
                        db.createObjectStore(
                            PHOTO_STORE,
                            {
                                keyPath: "id",
                                autoIncrement: true
                            }
                        );

                    store.createIndex(
                        "assetNo",
                        "assetNo",
                        { unique: false }
                    );
                }
            };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve();
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

async function savePhotoRecord(record) {

    return new Promise((resolve, reject) => {

        const tx =
            db.transaction(
                PHOTO_STORE,
                "readwrite"
            );

        const store =
            tx.objectStore(PHOTO_STORE);

        const req =
            store.add(record);

        req.onsuccess =
            () => resolve();

        req.onerror =
            () => reject(req.error);
    });
}

async function getAllPhotos() {

    return new Promise((resolve, reject) => {

        const tx =
            db.transaction(
                PHOTO_STORE,
                "readonly"
            );

        const store =
            tx.objectStore(PHOTO_STORE);

        const req = store.getAll();

        req.onsuccess =
            () => resolve(req.result);

        req.onerror =
            () => reject(req.error);
    });
}

async function deletePhotoRecord(id) {

    return new Promise((resolve, reject) => {

        const tx =
            db.transaction(
                PHOTO_STORE,
                "readwrite"
            );

        const store =
            tx.objectStore(PHOTO_STORE);

        const req =
            store.delete(id);

        req.onsuccess =
            () => resolve();

        req.onerror =
            () => reject(req.error);
    });
}

/********************************************************
 * QR
 ********************************************************/

async function startQrScan() {

    qrScanner =
        new Html5Qrcode(
            "qrReader"
        );

    await qrScanner.start(
        { facingMode: "environment" },
        {
            fps: 10,
            qrbox: 240
        },
        onQrDetected
    );
}

function onQrDetected(text) {

    const now = Date.now();

    if (
        text === lastScanCode &&
        now - lastScanTime < 2000
    ) {
        return;
    }

    lastScanCode = text;
    lastScanTime = now;

    els.assetNo.value = text;

    openCameraModal();
}

async function stopQrScan() {

    if (!qrScanner) return;

    await qrScanner.stop();
    await qrScanner.clear();

    qrScanner = null;
}
/*****************************************************************
 * Part2
 * カメラ
 *****************************************************************/

async function openCameraModal() {

    const assetNo =
        els.assetNo.value.trim();

    if (!assetNo) {
        alert(
            "資産番号を入力してください"
        );
        return;
    }

    els.cameraModal.classList.remove(
        "hidden"
    );

    currentStream =
        await navigator.mediaDevices
            .getUserMedia({
                video: {
                    facingMode:
                        "environment",
                    width: {
                        ideal: 1920
                    },
                    height: {
                        ideal: 1080
                    }
                }
            });

    els.cameraVideo.srcObject =
        currentStream;
}

function closeCameraModal() {

    if (currentStream) {

        currentStream
            .getTracks()
            .forEach(track =>
                track.stop()
            );

        currentStream = null;
    }

    els.cameraModal.classList.add(
        "hidden"
    );
}

async function capturePhoto() {

    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width =
        els.cameraVideo.videoWidth;

    canvas.height =
        els.cameraVideo.videoHeight;

    canvas
        .getContext("2d")
        .drawImage(
            els.cameraVideo,
            0,
            0
        );

    previewDataUrl =
        canvas.toDataURL(
            "image/jpeg",
            0.9
        );

    previewBlob =
        await (
            await fetch(
                previewDataUrl
            )
        ).blob();

    closeCameraModal();

    els.previewImage.src =
        previewDataUrl;

    els.previewModal.classList.remove(
        "hidden"
    );
}

function retakePhoto() {

    els.previewModal.classList.add(
        "hidden"
    );

    openCameraModal();
}

async function saveCurrentPhoto() {

    const assetNo =
        els.assetNo.value.trim();

    const photos =
        await getAllPhotos();

    const seq =
        photos.filter(
            x => x.assetNo === assetNo
        ).length + 1;

    await savePhotoRecord({
        assetNo,
        seq,
        fileName:
            `${assetNo}_${seq}.jpg`,
        blob: previewBlob,
        thumbnail: previewDataUrl,
        capturedAt:
            new Date().toISOString()
    });

    els.previewModal.classList.add(
        "hidden"
    );

    await refreshUI();

    const again =
        confirm(
            "もう1枚撮影しますか？"
        );

    if (again) {

        openCameraModal();

    } else {

        gotoNextAsset();
    }
}

function gotoNextAsset() {

    els.assetNo.value = "";

    refreshUI();
}
/*****************************************************************
 * Part3
 * UI
 *****************************************************************/

async function refreshUI() {

    const photos =
        await getAllPhotos();

    refreshSummary(photos);
    refreshTimeline(photos);
    refreshThumbnails(photos);

    updateCurrentAssetCount(
        photos
    );
}

function updateCurrentAssetCount(
    photos
) {

    const assetNo =
        els.assetNo.value.trim();

    const count =
        photos.filter(
            p => p.assetNo === assetNo
        ).length;

    const el =
        document.getElementById(
            "assetPhotoCount"
        );

    if (el) {
        el.textContent = count;
    }
}

function refreshSummary(
    photos
) {

    const groups = {};

    photos.forEach(photo => {

        if (!groups[photo.assetNo]) {

            groups[photo.assetNo] = 0;
        }

        groups[photo.assetNo]++;

    });

    let html = `
        <div class="font-bold">
        総写真数 : ${photos.length}
        </div>
        <hr class="my-2">
    `;

    Object.entries(groups)
        .forEach(([asset, count]) => {

            html += `
                <div>
                    ${asset}
                    (${count}枚)
                </div>
            `;

        });

    els.summaryArea.innerHTML =
        html;
}

function refreshTimeline(
    photos
) {

    els.timelineArea.innerHTML =
        photos
            .slice()
            .reverse()
            .map(photo => {

                return `
                    <div class="border-b py-1">

                        ${photo.assetNo}
                        /
                        ${photo.fileName}

                    </div>
                `;

            })
            .join("");
}

function refreshThumbnails(
    photos
) {

    els.thumbnailArea.innerHTML =
        photos.map(photo => {

            return `

                <div
                    class="border rounded p-1"
                >

                    ${photo.thumbnail}

                    <div class="text-xs break-all mt-1">

                        ${photo.fileName}

                    </div>

                    <button
                        class="text-red-600 text-xs mt-1"
                        onclick="removePhoto(${photo.id})"
                    >

                        削除

                    </button>

                </div>
            `;

        }).join("");
}

window.showImage =
function(dataUrl) {

    const w =
        window.open();

    w.document.write(
        `
        ${dataUrl}
        `
    );
};

window.removePhoto =
async function(id) {

    const result =
        confirm(
            "削除しますか？"
        );

    if (!result) {
        return;
    }

    await deletePhotoRecord(id);

    await refreshUI();
};


/********************************************************
 * ZIP出力
 ********************************************************/

async function exportZip() {

    const photos =
        await getAllPhotos();

    if (photos.length === 0) {

        alert(
            "保存済みデータがありません"
        );

        return;
    }

    const zip =
        new JSZip();

    const imagesFolder =
        zip.folder(
            "images"
        );

    let csv =
        "\ufeff資産番号,撮影連番,ファイル名,撮影日時\n";

    photos.forEach(photo => {

        imagesFolder.file(
            photo.fileName,
            photo.blob
        );

        csv +=
            `${photo.assetNo},` +
            `${photo.seq},` +
            `${photo.fileName},` +
            `${photo.capturedAt}\n`;

    });

    zip.file(
        "棚卸実績リスト.csv",
        csv
    );

    const zipBlob =
        await zip.generateAsync({
            type: "blob"
        });

    const a =
        document.createElement(
            "a"
        );

    a.href =
        URL.createObjectURL(
            zipBlob
        );

    a.download =
        "棚卸データ.zip";

    a.click();
}
