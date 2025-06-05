// PDF.jsのワーカーの設定
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
}

const fileInput = document.getElementById("pdfInput");
const container = document.getElementById("pdfTextContainer");
const saveBtn = document.getElementById("saveBtn");

let extractedText = "";
let titleGuess = "";
let sections = [];
let fileDataUrl = null;

// IndexedDBの初期化
let db;
const dbName = "papersDB";
const dbVersion = 1;

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);

        request.onerror = (event) => {
            console.error("DBの初期化に失敗しました:", event);
            reject("DBエラー");
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains("papers")) {
                db.createObjectStore("papers", { keyPath: "id" });
            }
            if (!db.objectStoreNames.contains("files")) {
                db.createObjectStore("files", { keyPath: "id" });
            }
        };
    });
};

// データを保存
const savePaper = async (paper) => {
    try {
        const transaction = db.transaction(["papers", "files"], "readwrite");
        const paperStore = transaction.objectStore("papers");
        const fileStore = transaction.objectStore("files");

        if (paper.fileData) {
            await fileStore.put({
                id: paper.id,
                fileData: paper.fileData
            });
            
            const paperWithoutFile = {...paper};
            delete paperWithoutFile.fileData;
            paperWithoutFile.hasFile = true;
            await paperStore.put(paperWithoutFile);
        } else {
            await paperStore.put(paper);
        }

        return true;
    } catch (e) {
        console.error('保存エラー:', e);
        alert('データの保存に失敗しました。');
        return false;
    }
};

fileInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        // PDFファイルをData URLとして読み込む
        const dataUrlReader = new FileReader();
        dataUrlReader.onload = function() {
            fileDataUrl = dataUrlReader.result;
        };
        dataUrlReader.readAsDataURL(file);

        const reader = new FileReader();
        reader.onload = async function () {
            try {
                const pdfData = new Uint8Array(reader.result);
                const loadingTask = pdfjsLib.getDocument({ data: pdfData });
                
                loadingTask.onProgress = function (progressData) {
                    if (progressData.total > 0) {
                        const percent = (progressData.loaded / progressData.total * 100).toFixed(2);
                        container.innerHTML = `PDFを読み込み中... ${percent}%`;
                    }
                };

                const pdf = await loadingTask.promise;

                extractedText = "";
                sections = [];
                let currentSection = { title: "Introduction", content: "" };

                // すべてのページを処理
                for (let i = 1; i <= pdf.numPages; i++) {
                    container.innerHTML = `ページ ${i}/${pdf.numPages} を処理中...`;
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    let pageText = "";
                    let lastY = null;
                    let lineText = "";

                    // 行ごとに処理
                    for (const item of content.items) {
                        if (lastY !== null && Math.abs(lastY - item.transform[5]) > 5) {
                            if (lineText.trim()) {
                                pageText += lineText.trim() + "\n";
                                
                                if (lineText.trim().match(/^([0-9]+\.)*[0-9]+\s+[A-Z]/)) {
                                    if (currentSection.content.trim()) {
                                        sections.push(currentSection);
                                    }
                                    currentSection = { title: lineText.trim(), content: "" };
                                } else {
                                    currentSection.content += lineText.trim() + "\n";
                                }
                            }
                            lineText = "";
                        }
                        lineText += item.str;
                        lastY = item.transform[5];
                    }
                    
                    if (lineText.trim()) {
                        pageText += lineText.trim() + "\n";
                        currentSection.content += lineText.trim() + "\n";
                    }
                    
                    extractedText += pageText + "\n";
                }

                // 最後のセクションを追加
                if (currentSection.content.trim()) {
                    sections.push(currentSection);
                }

                // タイトルの推定（最初の行を使用）
                titleGuess = extractedText.trim().split("\n")[0].slice(0, 100);

                // 抽出結果の表示
                container.innerHTML = `
                    <h3>抽出結果:</h3>
                    <p><strong>タイトル候補:</strong> ${titleGuess}</p>
                    <div class="sections-preview">
                        <h4>検出されたセクション:</h4>
                        ${sections.map((section, i) => `
                            <div class="section-item">
                                <strong>${section.title}</strong>
                                <p>${section.content.slice(0, 100)}...</p>
                            </div>
                        `).join('')}
                    </div>
                `;

                saveBtn.style.display = "inline-block";
            } catch (error) {
                console.error('PDF処理エラー:', error);
                container.innerHTML = `
                    <div class="error-message">
                        PDFの処理中にエラーが発生しました。<br>
                        別のPDFファイルを試すか、ページを再読み込みしてください。
                    </div>
                `;
            }
        };
        reader.readAsArrayBuffer(file);
    } catch (error) {
        console.error('ファイル読み込みエラー:', error);
        container.innerHTML = `
            <div class="error-message">
                ファイルの読み込みに失敗しました。<br>
                別のPDFファイルを試すか、ページを再読み込みしてください。
            </div>
        `;
    }
});

saveBtn.addEventListener("click", async () => {
    const newEntry = {
        id: Date.now().toString(),
        title: titleGuess || "Untitled",
        date: new Date().toISOString().split("T")[0],
        text: extractedText,
        sections: sections,
        summarized: false,
        sectionSummaries: '',
        summary: '',
        fileData: fileDataUrl
    };

    try {
        await savePaper(newEntry);
        alert("論文を保存しました！");
        window.location.href = "index.html";
    } catch (error) {
        console.error('保存に失敗しました:', error);
        alert('論文の保存に失敗しました。');
    }
});

// 初期化
initDB().catch(error => {
    console.error("DBの初期化に失敗しました:", error);
    alert("データベースの初期化に失敗しました。ページを再読み込みしてください。");
});
